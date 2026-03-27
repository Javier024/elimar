import { db } from "./db.js";
import { logToHistory } from "./historial.js";

export default async function handler(req, res) {
  try {
    // --- GET: Leer Puestos ---
    if (req.method === "GET") {
      const result = await db.execute(`
        SELECT p.*, 
               c.nombre as cliente_nombre,
               c.placa as cliente_placa,
               c.tipo_vehiculo as cliente_tipo,
               c.fecha_registro as cliente_fecha_registro,
               c.medio_pago as cliente_medio_pago,
               c.cuota_mensual as cliente_cuota_mensual,
               c.telefono as cliente_telefono
        FROM puestos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        ORDER BY p.id ASC
      `);
      return res.status(200).json(result.rows);
    }

    // --- POST: Crear Puesto ---
    if (req.method === "POST") {
      const { numero } = req.body;
      if (!numero) return res.status(400).json({ error: "Número requerido" });
      
      const check = await db.execute("SELECT id FROM puestos WHERE numero=?", [numero]);
      if (check.rows.length > 0) return res.status(400).json({ error: "El número ya existe" });
      
      await db.execute("INSERT INTO puestos (numero, estado, fecha_registro) VALUES (?, ?, ?)", [numero, "libre", new Date().toISOString()]);
      
      // PROTECTOR: Si el historial falla, no matamos la app
      try { await logToHistory('PUESTO', `Creado puesto #${numero}`, 0, "---"); } catch(e) { console.warn("Historial falló:", e.message); }
      
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    // --- PUT: Actualizar (Lógica Completa) ---
    if (req.method === "PUT") {
      const { id, cliente_id, estado, llave_info, accion, nuevo_numero, es_reserva, temp_name, temp_plate, hora_inicio } = req.body;
      
      if (!id) return res.status(400).json({ error: "ID del puesto requerido" });

      // 1. ACTUALIZAR LLAVE
      if (accion === "actualizar_llave") {
          const current = await db.execute("SELECT llave_caracteristicas FROM puestos WHERE id=?", [id]);
          const metaStr = current.rows[0]?.llave_caracteristicas;
          let meta = metaStr ? JSON.parse(metaStr) : {};
          if (llave_info) { meta.llave = llave_info; } else { delete meta.llave; }
          
          await db.execute("UPDATE puestos SET llave_caracteristicas=? WHERE id=?", [JSON.stringify(meta), id]);
          try { await logToHistory('PUESTO', llave_info ? `Llave Guardada` : "Llave Recuperada", 0, "---"); } catch(e){}
          return res.status(200).json({ success: true, message: "Llave actualizada" });
      }

      // 2. ACTIVAR NOCTURNO (Lógica Completa Restaurada)
      if (accion === "activar_nocturno") {
        const current = await db.execute("SELECT id, estado, cliente_id, llave_caracteristicas, numero FROM puestos WHERE id=?", [id]);
        const spotData = current.rows[0];
        if (!spotData || spotData.estado !== 'ocupado') return res.status(400).json({ error: "Solo en puestos ocupados." });
        
        const ownerId = spotData.cliente_id;
        const existingMeta = spotData.llave_caracteristicas;
        
        const clientData = await db.execute("SELECT fecha_registro, medio_pago, placa, tipo_vehiculo, nombre, cuota_mensual FROM clientes WHERE id=?", [ownerId]);
        const clientInfo = clientData.rows[0];
        if (!clientInfo) return res.status(400).json({ error: "Error datos cliente" });

        // Guardamos toda la info del dueño en 'puesto_info' para restaurarla mañana
        const infoToSave = { 
            owner_id: ownerId, 
            nombre: clientInfo.nombre, 
            placa: clientInfo.placa, 
            tipo: clientInfo.tipo_vehiculo, 
            fecha_registro: clientInfo.fecha_registro, 
            medio_pago: clientInfo.medio_pago, 
            cuota_mensual: clientInfo.cuota_mensual 
        };
        
        let meta = { 
            tipo: 'nocturno', 
            owner_id: ownerId, 
            fecha_inicio_nocturno: new Date().toISOString() 
        };
        
        if (existingMeta) { 
            try { const parsed = JSON.parse(existingMeta); if(parsed.llave) meta.llave = parsed.llave; } catch(e) {} 
        }
        
        await db.execute("UPDATE puestos SET estado='libre', cliente_id=NULL, llave_caracteristicas=?, puesto_info=? WHERE id=?", [JSON.stringify(meta), JSON.stringify(infoToSave), id]);
        
        try { await logToHistory('PUESTO', `Modo Nocturno Activado #${spotData.numero}`, 0, "---"); } catch(e){}
        
        return res.status(200).json({ success: true, message: "Modo Nocturno activado." });
      }

      // 3. RESTAURAR NOCTURNO (Lógica Completa Restaurada)
      if (accion === "restaurar_nocturno") {
        const current = await db.execute("SELECT llave_caracteristicas, puesto_info, numero FROM puestos WHERE id=?", [id]);
        const metaStr = current.rows[0]?.llave_caracteristicas;
        const infoStr = current.rows[0]?.puesto_info;
        if (!metaStr || !infoStr) return res.status(400).json({ error: "No hay datos de restauración" });
        
        let meta; let info;
        try { meta = JSON.parse(metaStr); } catch (e) { return res.status(400).json({ error: "Error datos internos" }); }
        try { info = JSON.parse(infoStr); } catch(e) { return res.status(400).json({ error: "Error datos info" }); }
        
        if (!meta.owner_id) return res.status(400).json({ error: "Dueño original no identificado" });
        
        const newMeta = meta.llave ? { llave: meta.llave } : null;
        // Usamos timestamp numérico de JS para coincidir con tu columna NUMERIC
        const timestamp = Math.floor(Date.now() / 1000);
        
        await db.execute("UPDATE puestos SET estado='ocupado', cliente_id=?, llave_caracteristicas=?, puesto_info=NULL, hora_inicio=?, fecha_registro=? WHERE id=?", [meta.owner_id, newMeta ? JSON.stringify(newMeta) : null, timestamp, info.fecha_registro || new Date().toISOString().split('T')[0], id]);
        
        try { await logToHistory('PUESTO', `Restaurado a Dueño #${info.nombre}`, 0, "---"); } catch(e){}
        
        return res.status(200).json({ success: true, message: "Puesto restaurado al dueño original" });
      }

      // 4. EDITAR NÚMERO
      if (accion === "editar_numero") {
        if (!nuevo_numero) return res.status(400).json({ error: "Nuevo número requerido" });
        const check = await db.execute("SELECT id FROM puestos WHERE numero=? AND id!=?", [nuevo_numero, id]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Número en uso" });
        await db.execute("UPDATE puestos SET numero=? WHERE id=?", [nuevo_numero, id]);
        try { await logToHistory('PUESTO', `Editado puesto #${nuevo_numero}`, 0, "---"); } catch(e){}
        return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // 5. ASIGNAR CLIENTE / USUARIO TEMPORAL (Lógica Completa)
      if (cliente_id || (temp_name && temp_plate)) {
        let clientInfo = null;
        
        if (cliente_id) {
            // CLIENTE REGISTRADO
            const clientData = await db.execute("SELECT placa, tipo_vehiculo, fecha_registro, medio_pago, cuota_mensual, nombre, telefono FROM clientes WHERE id=?", [cliente_id]);
            clientInfo = clientData.rows[0];
            if (!clientInfo) return res.status(400).json({ error: "Cliente no encontrado" });
            
            const duplicateCheck = await db.execute(`SELECT p.numero FROM puestos p JOIN clientes c ON p.cliente_id = c.id WHERE c.placa = ? AND p.estado IN ('ocupado', 'reservado') AND p.id != ?`, [clientInfo.placa, id]);
            if (duplicateCheck.rows.length > 0) return res.status(400).json({ error: `Vehículo ${clientInfo.placa} ya está en puesto ${duplicateCheck.rows[0].numero}` });
        } else {
            // USUARIO TEMPORAL
            clientInfo = {
                nombre: temp_name,
                placa: temp_plate,
                tipo_vehiculo: "No especificado",
                fecha_registro: new Date().toISOString(),
                medio_pago: "Efectivo",
                cuota_mensual: 0
            };
        }

        const spotData = await db.execute("SELECT numero, llave_caracteristicas FROM puestos WHERE id=?", [id]);
        const spotNum = spotData.rows[0]?.numero;
        if(!spotNum) return res.status(404).json({ error: "Puesto no encontrado" });

        const finalEstado = es_reserva ? 'reservado' : (estado || 'ocupado');
        
        // Gestión de Metadatos (Llaves, Temporales)
        let finalMetaString = null;
        const currentMetaStr = spotData.rows[0]?.llave_caracteristicas;
        let meta = {}; 
        if (currentMetaStr) try { meta = JSON.parse(currentMetaStr); } catch(e) { meta = {}; }

        if (llave_info) meta.llave = llave_info;
        
        if (!cliente_id) {
            // Guardamos datos del temporal en meta
            meta.temp_user = { nombre: temp_name, placa: temp_plate, ingreso: new Date().toISOString() };
        } else {
            // Si asignamos un cliente oficial, limpiamos datos temporales viejos
            delete meta.temp_user; 
        }

        if (Object.keys(meta).length > 0) finalMetaString = JSON.stringify(meta);

        const fechaRegistro = (clientInfo && clientInfo.fecha_registro) ? clientInfo.fecha_registro.split('T')[0] : new Date().toISOString().split('T')[0];

        // Timestamp numérico para columna NUMERIC
        const timestamp = hora_inicio ? parseInt(hora_inicio) : Math.floor(Date.now() / 1000);

        await db.execute(
            "UPDATE puestos SET estado=?, cliente_id=?, hora_inicio=?, llave_caracteristicas=?, puesto_info=NULL, fecha_registro=? WHERE id=?",
            [finalEstado, cliente_id || null, timestamp, finalMetaString, fechaRegistro, id]
        );

        if (!es_reserva) {
            try { await logToHistory(clientInfo.tipo_vehiculo, `Ingreso: ${clientInfo.placa} (${!cliente_id ? 'Temporal' : 'Oficial'})`, 0, clientInfo.placa); } catch(e){}
        }

        return res.status(200).json({ success: true, message: finalEstado === 'reservado' ? "Reserva creada" : "Vehículo asignado" });
      } else {
        return res.status(400).json({ error: "Debe seleccionar un cliente o ingresar datos manuales." });
      }
    }

    // --- PATCH: Liberar Puesto ---
    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      const spotInfo = await db.execute("SELECT numero, llave_caracteristicas, cliente_id FROM puestos WHERE id=?", [id]);
      const spotNum = spotInfo.rows[0]?.numero;
      const metaStr = spotInfo.rows[0]?.llave_caracteristicas;
      const clienteIdActual = spotInfo.rows[0]?.cliente_id;
      
      // Log específico para temporales
      if (clienteIdActual === null && metaStr) {
          try {
              const meta = JSON.parse(metaStr);
              if (meta.temp_user) {
                  try { await logToHistory('TEMPORAL', `Salida: ${meta.temp_user.placa}`, 0, meta.temp_user.placa); } catch(e){}
              }
          } catch(e) {}
      }

      // Liberación total
      await db.execute(
          "UPDATE puestos SET estado='libre', cliente_id=NULL, hora_inicio=NULL, fecha_registro=NULL, puesto_info=NULL, llave_caracteristicas=NULL WHERE id=?", 
          [id] 
      );

      if(spotNum) {
        if (clienteIdActual) {
             try { await db.execute("UPDATE historial SET exit=? WHERE exit IS NULL AND spot=?", [new Date().toLocaleTimeString("es-CO"), spotNum]); } catch(e){}
        }
        try { await logToHistory('PUESTO', `Liberado puesto #${spotNum}`, 0, "---"); } catch(e){}
      }
      return res.status(200).json({ success: true, message: "Puesto liberado" });
    }

    // --- DELETE: ELIMINAR PUESTO (Corregido y Seguro) ---
    if (req.method === "DELETE") {
      // LECTURA PRIORITARIA DE LA URL (Query Param) PARA EVITAR ERRORES DE BODY
      let id = req.query.id;
      
      // Fallback si por alguna razón no llega en la URL (aunque el JS lo envía ahí)
      if (!id && req.body) id = req.body.id;
      
      if (!id) return res.status(400).json({ error: "ID requerido" });

      const spot = await db.execute("SELECT numero FROM puestos WHERE id=?", [id]);
      if (!spot.rows[0]) return res.status(404).json({ error: "Puesto no encontrado" });
      
      await db.execute("DELETE FROM puestos WHERE id=?", [id]);
      
      try { await logToHistory('PUESTO', `Eliminado puesto #${spot.rows[0].numero}`, 0, "---"); } catch(e){}
      
      return res.status(200).json({ success: true, message: "Puesto eliminado permanentemente" });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("API PUESTOS ERROR:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}