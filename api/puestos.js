import { db } from "./db.js";
import { logToHistory } from "./historial.js";

export default async function handler(req, res) {
  try {
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

    if (req.method === "POST") {
      const { numero } = req.body;
      if (!numero) return res.status(400).json({ error: "Número requerido" });
      
      const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=?", args: [numero] });
      if (check.rows.length > 0) return res.status(400).json({ error: "El número ya existe" });
      
      await db.execute({ 
        sql: `INSERT INTO puestos (numero, estado, fecha_registro) VALUES (?, ?, ?)`, 
        args: [numero, "libre", new Date().toISOString()] 
      });

      await logToHistory('PUESTO', `Creado puesto #${numero}`, 0, "---");
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    if (req.method === "PUT") {
      const { id, cliente_id, estado, llave_info, accion, fecha_regreso, nuevo_numero, es_reserva } = req.body;
      
      if (!id) return res.status(400).json({ error: "ID del puesto requerido" });

      if (accion === "actualizar_llave") {
          const current = await db.execute({ sql: "SELECT llave_caracteristicas, puesto_info FROM puestos WHERE id=?", args: [id] });
          const metaStr = current.rows[0]?.llave_caracteristicas;
          const infoStr = current.rows[0]?.puesto_info;
          let meta = {}; let info = {};
          try { meta = metaStr ? JSON.parse(metaStr) : {}; } catch(e) { meta = {}; }
          try { info = infoStr ? JSON.parse(infoStr) : {}; } catch(e) { info = {}; }
          if (llave_info) { meta.llave = llave_info; } else { delete meta.llave; }
          await db.execute({ sql: `UPDATE puestos SET llave_caracteristicas=?, puesto_info=? WHERE id=?`, args: [JSON.stringify(meta), JSON.stringify(info), id] });
          await logToHistory('PUESTO', llave_info ? `Llave Guardada` : "Llave Recuperada", 0, "---");
          return res.status(200).json({ success: true, message: "Llave actualizada" });
      }

      if (accion === "activar_nocturno") {
        const current = await db.execute({ sql: "SELECT id, estado, cliente_id, llave_caracteristicas, puesto_info, numero FROM puestos WHERE id=?", args: [id] });
        const spotData = current.rows[0];
        if (!spotData || spotData.estado !== 'ocupado') return res.status(400).json({ error: "Solo se puede activar modo nocturno en puestos OCUPADOS." });
        const ownerId = spotData.cliente_id;
        const existingMeta = spotData.llave_caracteristicas;
        const spotNum = spotData.numero;

        const clientData = await db.execute({ sql: "SELECT fecha_registro, medio_pago, placa, tipo_vehiculo, nombre, cuota_mensual FROM clientes WHERE id=?", args: [ownerId] });
        const clientInfo = clientData.rows[0];
        if (!clientInfo) return res.status(400).json({ error: "Error al leer datos del cliente" });

        const infoToSave = { owner_id: ownerId, nombre: clientInfo.nombre, placa: clientInfo.placa, tipo: clientInfo.tipo_vehiculo, fecha_registro: clientInfo.fecha_registro, medio_pago: clientInfo.medio_pago, cuota_mensual: clientInfo.cuota_mensual };
        let meta = { tipo: 'nocturno', owner_id: ownerId, fecha_inicio_nocturno: new Date().toISOString() };
        if (existingMeta) { try { const parsed = JSON.parse(existingMeta); if(parsed.llave) meta.llave = parsed.llave; } catch(e) {} }
        
        await db.execute({ sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, llave_caracteristicas=?, puesto_info=? WHERE id=?`, args: [JSON.stringify(meta), JSON.stringify(infoToSave), id] });
        await logToHistory('PUESTO', `Modo Nocturno Activado #${spotNum}`, 0, "---");
        return res.status(200).json({ success: true, message: "Modo Nocturno activado." });
      }

      if (accion === "restaurar_nocturno") {
        const current = await db.execute({ sql: "SELECT llave_caracteristicas, puesto_info, numero FROM puestos WHERE id=?", args: [id] });
        const metaStr = current.rows[0]?.llave_caracteristicas;
        const infoStr = current.rows[0]?.puesto_info;
        const spotNum = current.rows[0]?.numero;
        if (!metaStr || !infoStr) return res.status(400).json({ error: "No hay datos de restauración" });
        let meta; let info;
        try { meta = JSON.parse(metaStr); } catch (e) { return res.status(400).json({ error: "Error de datos internos" }); }
        try { info = JSON.parse(infoStr); } catch(e) { return res.status(400).json({ error: "Error datos info" }); }
        if (!meta.owner_id) return res.status(400).json({ error: "Dueño original no identificado" });
        const newMeta = meta.llave ? { llave: meta.llave } : null;
        await db.execute({ sql: `UPDATE puestos SET estado='ocupado', cliente_id=?, llave_caracteristicas=?, puesto_info=NULL, hora_inicio=strftime('%s', 'now') WHERE id=?`, args: [meta.owner_id, newMeta ? JSON.stringify(newMeta) : null, id] });
        await logToHistory('PUESTO', `Restaurado a Dueño #${spotNum}`, 0, "---");
        return res.status(200).json({ success: true, message: "Puesto restaurado al dueño original" });
      }

      if (accion === "editar_numero") {
        if (!nuevo_numero) return res.status(400).json({ error: "Nuevo número requerido" });
        const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=? AND id!=?", args: [nuevo_numero, id] });
        if (check.rows.length > 0) return res.status(400).json({ error: "Número en uso" });
        const spotData = await db.execute({ sql: "SELECT numero FROM puestos WHERE id=?", args: [id] });
        const viejoNumero = spotData.rows[0]?.numero;
        await db.execute({ sql: `UPDATE puestos SET numero=? WHERE id=?`, args: [nuevo_numero, id] });
        await logToHistory('PUESTO', `Editado puesto #${viejoNumero} a #${nuevo_numero}`, 0, "---");
        return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // CASO 4: ASIGNAR CLIENTE / RESERVAR
      if (cliente_id) {
        const clientData = await db.execute({ sql: "SELECT placa, tipo_vehiculo, fecha_registro, medio_pago, cuota_mensual FROM clientes WHERE id=?", args: [cliente_id] });
        const clientInfo = clientData.rows[0];
        if (!clientInfo) return res.status(400).json({ error: "El cliente seleccionado no existe" });

        // Validación de duplicados
        const duplicateCheck = await db.execute(`SELECT p.numero FROM puestos p JOIN clientes c ON p.cliente_id = c.id WHERE c.placa = ? AND p.estado IN ('ocupado', 'reservado') AND p.id != ?`, [clientInfo.placa, id]);
        if (duplicateCheck.rows.length > 0) return res.status(400).json({ error: `El vehículo ${clientInfo.placa} ya está en el puesto ${duplicateCheck.rows[0].numero}` });

        const spotData = await db.execute({ sql: "SELECT numero, llave_caracteristicas, puesto_info FROM puestos WHERE id=?", args: [id] });
        const spotNum = spotData.rows[0]?.numero;
        if(!spotNum) return res.status(404).json({ error: "Puesto no encontrado" });

        const finalEstado = es_reserva ? 'reservado' : (estado || 'ocupado');
        const dateStr = new Date().toISOString().split("T")[0]; // Fecha de hoy para historial
        const timeStr = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

        let finalMetaString = null;
        const currentMetaStr = spotData.rows[0]?.llave_caracteristicas;
        let meta = {}; 
        if (currentMetaStr) try { meta = JSON.parse(currentMetaStr); } catch(e) { meta = {}; }

        const clientInfoForSpot = {
            fecha_registro: clientInfo.fecha_registro,
            medio_pago: clientInfo.medio_pago,
            cuota_mensual: clientInfo.cuota_mensual
        };

        if (llave_info) meta.llave = llave_info;
        let finalPuestoInfoString = null;

        if (meta.tipo === 'nocturno') {
            const currentInfoStr = spotData.rows[0]?.puesto_info;
            finalPuestoInfoString = currentInfoStr; 
        } else {
            delete meta.tipo; delete meta.owner_id; delete meta.fecha_inicio_nocturno;
            finalPuestoInfoString = JSON.stringify(clientInfoForSpot);
        }
        
        if (Object.keys(meta).length === 0) finalMetaString = null;
        else finalMetaString = JSON.stringify(meta);

        // ACTUALIZACIÓN: Guardamos fecha_registro (Fecha de Ingreso al puesto) como fecha actual
        const fechaIngresoPuesto = new Date().toISOString().split("T")[0];

        await db.execute({
          sql: `UPDATE puestos SET estado=?, cliente_id=?, hora_inicio=strftime('%s', 'now'), llave_caracteristicas=?, puesto_info=?, fecha_registro=? WHERE id=?`,
          args: [finalEstado, cliente_id, finalMetaString, finalPuestoInfoString, fechaIngresoPuesto, id]
        });

        if (!es_reserva) {
            await logToHistory(clientInfo.tipo_vehiculo, `Ingreso: ${clientInfo.placa}`, 0, clientInfo.placa, dateStr);
        }

        return res.status(200).json({ success: true, message: finalEstado === 'reservado' ? "Puesto Reservado" : "Puesto asignado" });
      } else {
        await db.execute({ sql: `UPDATE puestos SET llave_caracteristicas=? WHERE id=?`, args: [llave_info ? JSON.stringify(llave_info) : null, id] });
        return res.status(200).json({ success: true, message: "Info actualizada" });
      }
    }

    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      const spotInfo = await db.execute({ sql: "SELECT numero, llave_caracteristicas, puesto_info, estado, cliente_id FROM puestos WHERE id=?", args: [id] });
      const spotNum = spotInfo.rows[0]?.numero;
      const metaStr = spotInfo.rows[0]?.llave_caracteristicas;
      const clienteIdActual = spotInfo.rows[0]?.cliente_id;
      
      let esNocturno = false;
      if (metaStr) { try { const meta = JSON.parse(metaStr); esNocturno = meta.tipo === 'nocturno'; } catch(e){} }

      let finalPuestoInfoString = null;
      if (esNocturno && clienteIdActual) {
          try {
              const tempClientData = await db.execute({ sql: "SELECT nombre, placa FROM clientes WHERE id=?", args: [clienteIdActual] });
              const tempClient = tempClientData.rows[0];
              if (tempClient) {
                  let currentInfo = {};
                  const infoStr = spotInfo.rows[0]?.puesto_info;
                  if(infoStr) try { currentInfo = JSON.parse(infoStr); } catch(e){}
                  currentInfo.last_temp_user = { nombre: tempClient.nombre, placa: tempClient.placa, fecha_salida: new Date().toISOString() };
                  finalPuestoInfoString = JSON.stringify(currentInfo);
              }
          } catch(e) { console.error("Error guardando info último temporal:", e); }
      }

      let setClause = "estado='libre', cliente_id=NULL, hora_inicio=NULL, fecha_registro=NULL"; // Limpiar fecha de ingreso al liberar
      let setArgs = [id];

      if (!esNocturno) {
          setClause += ", llave_caracteristicas=NULL, puesto_info=NULL";
      } else {
          setClause += ", puesto_info=?";
          setArgs = [finalPuestoInfoString, id];
      }

      await db.execute({ sql: `UPDATE puestos SET ${setClause} WHERE id=?`, args: setArgs });

      if(spotNum) {
        const exitTime = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        await db.execute({ sql: `UPDATE historial SET exit=? WHERE exit IS NULL AND spot=?`, args: [exitTime, spotNum] });
        await logToHistory('PUESTO', `Liberado puesto #${spotNum}`, 0, "---");
      }

      return res.status(200).json({ success: true, message: "Puesto liberado" });
    }

    if (req.method === "DELETE") {
      let id = req.body ? req.body.id : null;
      if (!id && req.query) id = req.query.id;
      if (!id) return res.status(400).json({ error: "ID requerido" });
      const spot = await db.execute({ sql: "SELECT id, estado, numero FROM puestos WHERE id=?", args: [id] });
      if (!spot.rows[0]) return res.status(404).json({ error: "Puesto no encontrado" });
      if (spot.rows[0].estado !== 'libre') return res.status(400).json({ error: `No se puede eliminar. El puesto está ${spot.rows[0].estado}.` });
      await db.execute({ sql: `DELETE FROM puestos WHERE id=?`, args: [id] });
      await logToHistory('PUESTO', `Eliminado puesto #${spot.rows[0].numero}`, 0, "---");
      return res.status(200).json({ success: true, message: "Puesto eliminado permanentemente" });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("API PUESTOS ERROR:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}