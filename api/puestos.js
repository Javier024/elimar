import { db } from "./db.js";
import { logToHistory } from "./historial.js" // Importamos el logger

export default async function handler(req, res) {
  try {
    // --- GET: LEER PUESTOS ---
    if (req.method === "GET") {
      const result = await db.execute(`
        SELECT p.*, 
               c.nombre as cliente_nombre,
               c.placa as cliente_placa,
               c.tipo_vehiculo as cliente_tipo
        FROM puestos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        ORDER BY p.id ASC
      `);
      return res.status(200).json(result.rows);
    }

    // --- POST: CREAR PUESTO ---
    if (req.method === "POST") {
      const { numero } = req.body;
      if (!numero) return res.status(400).json({ error: "Número requerido" });
      
      const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=?", args: [numero] });
      if (check.rows.length > 0) return res.status(400).json({ error: "El número ya existe" });
      
      await db.execute({ 
        sql: `INSERT INTO puestos (numero, estado, fecha_registro) VALUES (?, ?, ?)`, 
        args: [numero, "libre", new Date().toISOString()] 
      });

      // --- NUEVO: REGISTRAR EN HISTORIAL ---
      await logToHistory('PUESTO', `Creado puesto #${numero}`, 0, "---");

      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    // --- PUT: ACTUALIZAR PUESTO ---
    if (req.method === "PUT") {
      const { id, cliente_id, estado, llave_info, accion, fecha_regreso, nuevo_numero, es_reserva } = req.body;
      
      if (!id) return res.status(400).json({ error: "ID del puesto requerido" });

      // CASO 0: ACTUALIZAR LLAVE
      if (accion === "actualizar_llave") {
          const current = await db.execute({ sql: "SELECT llave_caracteristicas FROM puestos WHERE id=?", args: [id] });
          const metaStr = current.rows[0]?.llave_caracteristicas;
          let meta = {};
          try { meta = metaStr ? JSON.parse(metaStr) : {}; } catch(e) { meta = {}; }

          if (llave_info) {
              meta.llave = llave_info;
          } else {
              delete meta.llave;
          }

          await db.execute({
              sql: `UPDATE puestos SET llave_caracteristicas=? WHERE id=?`,
              args: [JSON.stringify(meta), id]
          });

          // --- NUEVO: LOG DE LLAVE ---
          await logToHistory('PUESTO', llave_info ? `Llave Guardada: ${llave_info.desc}` : "Llave Recuperada", 0, "---");

          return res.status(200).json({ success: true, message: "Llave actualizada" });
      }

      // CASO 1: MODO NOCTURNO
      if (accion === "activar_nocturno") {
        const current = await db.execute({ sql: "SELECT cliente_id, llave_caracteristicas, numero FROM puestos WHERE id=?", args: [id] });
        const ownerId = current.rows[0]?.cliente_id;
        const existingMeta = current.rows[0]?.llave_caracteristicas;
        const spotNum = current.rows[0]?.numero;

        if (!ownerId) return res.status(400).json({ error: "El puesto está vacío, no se puede activar nocturno" });

        let meta = { tipo: 'nocturno', owner_id: ownerId, fecha_inicio: new Date().toISOString() };
        
        if (existingMeta) {
            try {
                const parsed = JSON.parse(existingMeta);
                if (parsed.llave) meta.llave = parsed.llave;
            } catch(e) {}
        }

        await db.execute({ 
            sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, llave_caracteristicas=? WHERE id=?`, 
            args: [JSON.stringify(meta), id] 
        });

        // --- NUEVO: LOG NOCTURNO ---
        await logToHistory('PUESTO', `Modo Nocturno Activado #${spotNum}`, 0, "---");

        return res.status(200).json({ success: true, message: "Modo Nocturno activado." });
      }

      // CASO 2: RESTAURAR NOCTURNO
      if (accion === "restaurar_nocturno") {
        const current = await db.execute({ sql: "SELECT llave_caracteristicas, numero FROM puestos WHERE id=?", args: [id] });
        const metaStr = current.rows[0]?.llave_caracteristicas;
        const spotNum = current.rows[0]?.numero;
        
        if (!metaStr) return res.status(400).json({ error: "No hay datos de restauración" });

        let meta;
        try { meta = JSON.parse(metaStr); } catch (e) { return res.status(400).json({ error: "Error de datos internos" }); }

        if (!meta.owner_id) return res.status(400).json({ error: "Dueño original no identificado" });

        const newMeta = meta.llave ? { llave: meta.llave } : null;

        await db.execute({
            sql: `UPDATE puestos SET estado='ocupado', cliente_id=?, llave_caracteristicas=? WHERE id=?`,
            args: [meta.owner_id, newMeta ? JSON.stringify(newMeta) : null, id]
        });

        // --- NUEVO: LOG RESTAURACIÓN ---
        await logToHistory('PUESTO', `Restaurado a Dueño #${spotNum}`, 0, "---");

        return res.status(200).json({ success: true, message: "Puesto restaurado al dueño original" });
      }

      // CASO 3: EDITAR NÚMERO
      if (accion === "editar_numero") {
        if (!nuevo_numero) return res.status(400).json({ error: "Nuevo número requerido" });
        const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=? AND id!=?", args: [nuevo_numero, id] });
        if (check.rows.length > 0) return res.status(400).json({ error: "Número en uso" });
        
        // Obtenemos el número viejo para el log
        const spotData = await db.execute({ sql: "SELECT numero FROM puestos WHERE id=?", args: [id] });
        const viejoNumero = spotData.rows[0]?.numero;

        await db.execute({ sql: `UPDATE puestos SET numero=? WHERE id=?`, args: [nuevo_numero, id] });
        
        // --- NUEVO: LOG EDICIÓN ---
        await logToHistory('PUESTO', `Editado puesto #${viejoNumero} a #${nuevo_numero}`, 0, "---");

        return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // CASO 4: ASIGNAR CLIENTE / RESERVAR
      if (cliente_id) {
        const clientData = await db.execute({ sql: "SELECT placa, tipo_vehiculo FROM clientes WHERE id=?", args: [cliente_id] });
        const clientInfo = clientData.rows[0];
        
        if (!clientInfo) return res.status(400).json({ error: "El cliente seleccionado no existe" });

        const duplicateCheck = await db.execute(`
          SELECT p.numero 
          FROM puestos p
          JOIN clientes c ON p.cliente_id = c.id
          WHERE c.placa = ? AND p.estado IN ('ocupado', 'reservado') AND p.id != ?
        `, [clientInfo.placa, id]);

        if (duplicateCheck.rows.length > 0) {
          return res.status(400).json({ error: `El vehículo con placa ${clientInfo.placa} ya está en el puesto ${duplicateCheck.rows[0].numero}` });
        }

        const spotData = await db.execute({ sql: "SELECT numero, llave_caracteristicas FROM puestos WHERE id=?", args: [id] });
        const spotNum = spotData.rows[0]?.numero;
        
        if(!spotNum) return res.status(404).json({ error: "Puesto no encontrado" });

        const finalEstado = es_reserva ? 'reservado' : (estado || 'ocupado');
        const ahora = new Date();
        const dateStr = ahora.toISOString().split("T")[0];
        const timeStr = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

        let finalMetaString = null;
        const currentMetaStr = spotData.rows[0]?.llave_caracteristicas;
        let meta = {};
        
        if (currentMetaStr) {
            try { meta = JSON.parse(currentMetaStr); } catch(e) { meta = {}; }
        }

        if (llave_info) {
            meta.llave = llave_info;
        }
        
        if (Object.keys(meta).length > 0) {
            if (meta.tipo === 'nocturno') delete meta.tipo;
            if (meta.owner_id) delete meta.owner_id;
            if (meta.fecha_inicio) delete meta.fecha_inicio;
            
            if (Object.keys(meta).length === 0) {
                finalMetaString = null;
            } else {
                finalMetaString = JSON.stringify(meta);
            }
        }

        await db.execute({
          sql: `UPDATE puestos SET estado=?, cliente_id=?, hora_inicio=strftime('%s', 'now'), llave_caracteristicas=? WHERE id=?`,
          args: [finalEstado, cliente_id, finalMetaString, id]
        });

        // --- CAMBIO CLAVE: Usar logToHistory para el ingreso del vehículo ---
        if (!es_reserva) {
            // Usamos el logger global
            await logToHistory(
                clientInfo.tipo_vehiculo, 
                `Ingreso: ${clientInfo.placa}`, 
                0, 
                clientInfo.placa,
                dateStr // Pasamos la fecha actual
            );
            
            // Ajustamos la hora de entrada manualmente en el historial porque logToHistory usa la hora actual del servidor (que es correcta),
            // pero si necesitas forzar el timeStr específico de arriba, podrías hacerlo, pero timeStr y ahora son lo mismo.
        }

        return res.status(200).json({ success: true, message: finalEstado === 'reservado' ? "Puesto Reservado" : "Puesto asignado" });
      } 
      else {
        await db.execute({ sql: `UPDATE puestos SET llave_caracteristicas=? WHERE id=?`, args: [llave_info ? JSON.stringify(llave_info) : null, id] });
        return res.status(200).json({ success: true, message: "Info actualizada" });
      }
    }

    // --- PATCH: LIBERAR PUESTO ---
    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      const spotInfo = await db.execute({ sql: "SELECT numero, llave_caracteristicas FROM puestos WHERE id=?", args: [id] });
      const spotNum = spotInfo.rows[0]?.numero;
      const metaStr = spotInfo.rows[0]?.llave_caracteristicas;

      let setClause = "estado='libre', cliente_id=NULL, hora_inicio=NULL";
      let setArgs = [id];

      let esNocturno = false;
      if (metaStr) {
          try { 
              const meta = JSON.parse(metaStr);
              esNocturno = meta.tipo === 'nocturno';
          } catch(e){}
      }

      if (!esNocturno) {
          setClause += ", llave_caracteristicas=NULL";
      }

      await db.execute({ sql: `UPDATE puestos SET ${setClause} WHERE id=?`, args: setArgs });

      if(spotNum) {
        const exitTime = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        
        // Actualizar historial de vehículos (Salida)
        await db.execute({ 
            sql: `UPDATE historial SET exit=? WHERE exit IS NULL AND spot=?`, 
            args: [exitTime, spotNum] 
        });

        // --- NUEVO: LOG LIBERACIÓN ---
        // Esto registra que se liberó un puesto (acción administrativa)
        await logToHistory('PUESTO', `Liberado puesto #${spotNum}`, 0, "---");
      }

      return res.status(200).json({ success: true, message: "Puesto liberado" });
    }

    // --- DELETE: ELIMINAR PUESTO ---
    if (req.method === "DELETE") {
      let id = req.body ? req.body.id : null;
      if (!id && req.query) id = req.query.id;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      const spot = await db.execute({ sql: "SELECT id, estado, numero FROM puestos WHERE id=?", args: [id] });
      if (!spot.rows[0]) return res.status(404).json({ error: "Puesto no encontrado" });
      if (spot.rows[0].estado !== 'libre') {
          return res.status(400).json({ error: `No se puede eliminar. El puesto está ${spot.rows[0].estado}.` });
      }

      await db.execute({ sql: `DELETE FROM puestos WHERE id=?`, args: [id] });
      
      // --- NUEVO: LOG ELIMINACIÓN ---
      await logToHistory('PUESTO', `Eliminado puesto #${spot.rows[0].numero}`, 0, "---");

      return res.status(200).json({ success: true, message: "Puesto eliminado permanentemente" });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("API PUESTOS ERROR:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}