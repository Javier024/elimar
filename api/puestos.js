// parqueo/api/puestos.js
import { db } from "./db.js";

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
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    // --- PUT: ACTUALIZAR PUESTO ---
    if (req.method === "PUT") {
      const { id, cliente_id, estado, llave, accion, fecha_regreso, nuevo_numero, es_reserva } = req.body;
      
      // VERIFICACIÓN DE SEGURIDAD: El ID es obligatorio
      if (!id) return res.status(400).json({ error: "ID del puesto requerido" });

      // CASO 1: MODO NOCTURNO
      if (accion === "activar_nocturno") {
        const current = await db.execute({ sql: "SELECT cliente_id FROM puestos WHERE id=?", args: [id] });
        const ownerId = current.rows[0]?.cliente_id;
        
        if (!ownerId) return res.status(400).json({ error: "El puesto está vacío, no se puede activar nocturno" });

        const metaNocturno = JSON.stringify({ 
            tipo: 'nocturno', 
            owner_id: ownerId, 
            fecha_inicio: new Date().toISOString() 
        });

        await db.execute({ 
            sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, llave_caracteristicas=? WHERE id=?`, 
            args: [metaNocturno, id] 
        });

        return res.status(200).json({ success: true, message: "Modo Nocturno activado." });
      }

      // CASO 2: RESTAURAR NOCTURNO
      if (accion === "restaurar_nocturno") {
        const current = await db.execute({ sql: "SELECT llave_caracteristicas FROM puestos WHERE id=?", args: [id] });
        const metaStr = current.rows[0]?.llave_caracteristicas;
        
        if (!metaStr) return res.status(400).json({ error: "No hay datos de restauración" });

        let meta;
        try { meta = JSON.parse(metaStr); } catch (e) { return res.status(400).json({ error: "Error de datos internos" }); }

        if (!meta.owner_id) return res.status(400).json({ error: "Dueño original no identificado" });

        await db.execute({
            sql: `UPDATE puestos SET estado='ocupado', cliente_id=?, llave_caracteristicas=NULL WHERE id=?`,
            args: [meta.owner_id, id]
        });

        return res.status(200).json({ success: true, message: "Puesto restaurado al dueño original" });
      }

      // CASO 3: EDITAR NÚMERO
      if (accion === "editar_numero") {
        if (!nuevo_numero) return res.status(400).json({ error: "Nuevo número requerido" });
        const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=? AND id!=?", args: [nuevo_numero, id] });
        if (check.rows.length > 0) return res.status(400).json({ error: "Número en uso" });
        await db.execute({ sql: `UPDATE puestos SET numero=? WHERE id=?`, args: [nuevo_numero, id] });
        return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // CASO 4: ASIGNAR CLIENTE / RESERVAR
      if (cliente_id) {
        // Verificar que el cliente existe
        const clientData = await db.execute({ sql: "SELECT placa, tipo_vehiculo FROM clientes WHERE id=?", args: [cliente_id] });
        const clientInfo = clientData.rows[0];
        
        if (!clientInfo) return res.status(400).json({ error: "El cliente seleccionado no existe en la base de datos" });

        // VALIDACIÓN DE PLACA ÚNICA
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

        // PRESERVACIÓN DE METADATOS NOCTURNOS
        let finalLlave = llave; 
        const currentMeta = spotData.rows[0]?.llave_caracteristicas;
        
        // Si el puesto tiene info nocturna y no enviamos una nueva 'llave', mantenemos la info del dueño original
        if (!finalLlave && currentMeta) {
            try {
                const metaObj = JSON.parse(currentMeta);
                if(metaObj.tipo === 'nocturno') {
                    finalLlave = currentMeta;
                }
            } catch(e) { /* Ignorar error de parseo */ }
        }

        await db.execute({
          sql: `UPDATE puestos SET estado=?, cliente_id=?, hora_inicio=strftime('%s', 'now'), llave_caracteristicas=? WHERE id=?`,
          args: [finalEstado, cliente_id, finalLlave || null, id]
        });

        // Solo registrar historial si NO es reserva
        if (!es_reserva) {
            await db.execute({
                sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [dateStr, timeStr, null, clientInfo.placa, clientInfo.tipo_vehiculo, spotNum, 0]
            });
        }

        return res.status(200).json({ success: true, message: finalEstado === 'reservado' ? "Puesto Reservado" : "Puesto asignado" });
      } 
      else {
        // Actualización simple de llaves/metadatos sin cliente
        await db.execute({ sql: `UPDATE puestos SET llave_caracteristicas=? WHERE id=?`, args: [llave || null, id] });
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

      // Si no es nocturno, limpiamos llave_caracteristicas
      let esNocturno = false;
      if (metaStr) {
          try { esNocturno = JSON.parse(metaStr).tipo === 'nocturno'; } catch(e){}
      }

      if (!esNocturno) {
          setClause += ", llave_caracteristicas=NULL";
      }

      await db.execute({ sql: `UPDATE puestos SET ${setClause} WHERE id=?`, args: setArgs });

      if(spotNum) {
        const exitTime = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        await db.execute({ 
            sql: `UPDATE historial SET exit=? WHERE exit IS NULL AND spot=?`, 
            args: [exitTime, spotNum] 
        });
      }

      return res.status(200).json({ success: true, message: "Puesto liberado" });
    }

    // --- DELETE: ELIMINAR PUESTO ---
    if (req.method === "DELETE") {
      let id = req.body ? req.body.id : null;
      if (!id && req.query) id = req.query.id;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      const spot = await db.execute({ sql: "SELECT id, estado FROM puestos WHERE id=?", args: [id] });
      if (!spot.rows[0]) return res.status(404).json({ error: "Puesto no encontrado" });
      if (spot.rows[0].estado !== 'libre') {
          return res.status(400).json({ error: `No se puede eliminar. El puesto está ${spot.rows[0].estado}.` });
      }

      await db.execute({ sql: `DELETE FROM puestos WHERE id=?`, args: [id] });
      return res.status(200).json({ success: true, message: "Puesto eliminado permanentemente" });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("API PUESTOS ERROR:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}