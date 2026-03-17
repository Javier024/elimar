import { db } from "./db.js";

export default async function handler(req, res) {
  try {
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
      const rows = result.rows.map(row => ({
        ...row,
        deuda: 0,
        fecha_registro: row.fecha_registro || null 
      }));
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const { numero } = req.body;
      if (!numero) return res.status(400).json({ error: "Número requerido" });
      const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=?", args: [numero] });
      if (check.rows.length > 0) return res.status(400).json({ error: "El número ya existe" });
      
      await db.execute({ sql: `INSERT INTO puestos (numero, estado) VALUES (?, ?)`, args: [numero, "libre"] });
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    if (req.method === "PUT") {
      const { id, cliente_id, estado, llave, accion, fecha_regreso, nuevo_numero } = req.body;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      // CASO 1: EDITAR NÚMERO
      if (accion === "editar_numero") {
        if (!nuevo_numero) return res.status(400).json({ error: "Nuevo número requerido" });
        const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=? AND id!=?", args: [nuevo_numero, id] });
        if (check.rows.length > 0) return res.status(400).json({ error: "Número en uso" });
        await db.execute({ sql: `UPDATE puestos SET numero=? WHERE id=?`, args: [nuevo_numero, id] });
        return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // CASO 2: SALIDA TEMPORAL (AUSENCIA)
      if (accion === "salida_temporal") {
        if (!fecha_regreso) return res.status(400).json({ error: "Fecha requerida" });
        const current = await db.execute({ sql: "SELECT cliente_id, numero FROM puestos WHERE id=?", args: [id] });
        const clienteOriginal = current.rows[0]?.cliente_id;
        const numeroPuesto = current.rows[0]?.numero;

        if (!clienteOriginal) return res.status(400).json({ error: "Puesto vacío" });

        const infoAusencia = JSON.stringify({ tipo: "ausencia", cliente_id_original: clienteOriginal, fecha_regreso: fecha_regreso, fecha_salida: new Date().toISOString() });

        // Actualizar Puesto
        await db.execute({ sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, fecha_registro=NULL, llave_caracteristicas=? WHERE id=?`, args: [infoAusencia, id] });
        
        // ACTUALIZAR HISTORIAL (Marcar salida temporal)
        await db.execute({ sql: `UPDATE historial SET exit=?, spot='AUSENCIA' WHERE exit IS NULL AND spot=?`, args: [new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}), numeroPuesto] });

        return res.status(200).json({ success: true, message: "Ausencia activada" });
      }

      // CASO 3: ASIGNAR CLIENTE (INGRESO VEHÍCULO)
      if (cliente_id) {
        // Buscar datos del cliente para el historial
        const clientData = await db.execute({ sql: "SELECT placa, tipo_vehiculo FROM clientes WHERE id=?", args: [cliente_id] });
        const clientInfo = clientData.rows[0];
        
        // Datos del puesto
        const spotData = await db.execute({ sql: "SELECT numero FROM puestos WHERE id=?", args: [id] });
        const spotNum = spotData.rows[0].numero;

        const ahora = new Date();
        const dateStr = ahora.toISOString().split("T")[0];
        const timeStr = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

        // Actualizar Puesto
        await db.execute({
          sql: `UPDATE puestos SET estado=?, cliente_id=?, fecha_registro=?, hora_inicio=strftime('%s', 'now'), llave_caracteristicas=? WHERE id=?`,
          args: [estado || 'ocupado', cliente_id, ahora.toISOString(), llave || null, id]
        });

        // --- INTEGRACIÓN HISTORIAL: REGISTRAR ENTRADA ---
        if (clientInfo) {
            await db.execute({
                sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [dateStr, timeStr, null, clientInfo.placa, clientInfo.tipo_vehiculo, spotNum, 0]
            });
        }

        return res.status(200).json({ success: true, message: `Puesto asignado` });
      } 
      else {
        await db.execute({ sql: `UPDATE puestos SET llave_caracteristicas=? WHERE id=?`, args: [llave || null, id] });
        return res.status(200).json({ success: true, message: "Info actualizada" });
      }
    }

    // PATCH: LIBERAR PUESTO (SALIDA DEFINITIVA)
    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      // Obtener info antes de borrar para actualizar historial
      const spotInfo = await db.execute({ sql: "SELECT numero FROM puestos WHERE id=?", args: [id] });
      const spotNum = spotInfo.rows[0]?.numero;

      await db.execute({
        sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, hora_inicio=NULL, fecha_registro=NULL, llave_caracteristicas=NULL WHERE id=?`,
        args: [id]
      });

      // --- INTEGRACIÓN HISTORIAL: REGISTRAR SALIDA ---
      if(spotNum) {
        const exitTime = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        await db.execute({ 
            sql: `UPDATE historial SET exit=? WHERE exit IS NULL AND spot=?`, 
            args: [exitTime, spotNum] 
        });
      }

      return res.status(200).json({ success: true, message: "Puesto liberado" });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });
      await db.execute({ sql: `DELETE FROM puestos WHERE id=?`, args: [id] });
      return res.status(200).json({ success: true, message: "Puesto eliminado" });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("API PUESTOS ERROR:", error);
    return res.status(500).json({ error: "Error interno", detalle: error.message });
  }
}