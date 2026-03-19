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
      // Ahora 'fecha_registro' sí se devolverá porque existe en la DB
      return res.status(200).json(result.rows);
    }

    // --- POST: CREAR PUESTO (Aquí va la fecha de registro) ---
    if (req.method === "POST") {
      const { numero } = req.body;
      if (!numero) return res.status(400).json({ error: "Número requerido" });
      
      const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=?", args: [numero] });
      if (check.rows.length > 0) return res.status(400).json({ error: "El número ya existe" });
      
      // INSERTAMOS 'fecha_registro' con la fecha actual
      await db.execute({ 
        sql: `INSERT INTO puestos (numero, estado, fecha_registro) VALUES (?, ?, ?)`, 
        args: [numero, "libre", new Date().toISOString()] 
      });
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    // --- PUT: ASIGNAR VEHÍCULO ---
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

        // NOTA: NO actualizamos fecha_registro aquí
        await db.execute({ 
          sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, hora_inicio=NULL, llave_caracteristicas=? WHERE id=?`, 
          args: [infoAusencia, id] 
        });
        
        await db.execute({ sql: `UPDATE historial SET exit=?, spot='AUSENCIA' WHERE exit IS NULL AND spot=?`, args: [new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}), numeroPuesto] });

        return res.status(200).json({ success: true, message: "Ausencia activada" });
      }

      // CASO 3: ASIGNAR CLIENTE (INGRESO VEHÍCULO)
      if (cliente_id) {
        const clientData = await db.execute({ sql: "SELECT placa, tipo_vehiculo FROM clientes WHERE id=?", args: [cliente_id] });
        const clientInfo = clientData.rows[0];
        
        const spotData = await db.execute({ sql: "SELECT numero FROM puestos WHERE id=?", args: [id] });
        const spotNum = spotData.rows[0].numero;

        const ahora = new Date();
        const dateStr = ahora.toISOString().split("T")[0];
        const timeStr = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

        // NOTA: NO actualizamos fecha_registro aquí. Solo hora_inicio (entrada del coche)
        await db.execute({
          sql: `UPDATE puestos SET estado=?, cliente_id=?, hora_inicio=strftime('%s', 'now'), llave_caracteristicas=? WHERE id=?`,
          args: [estado || 'ocupado', cliente_id, llave || null, id]
        });

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

    // --- PATCH: LIBERAR PUESTO ---
    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      const spotInfo = await db.execute({ sql: "SELECT numero FROM puestos WHERE id=?", args: [id] });
      const spotNum = spotInfo.rows[0]?.numero;

      // NOTA: NO borramos fecha_registro al liberar. El puesto sigue existiendo.
      await db.execute({
        sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, hora_inicio=NULL, llave_caracteristicas=NULL WHERE id=?`,
        args: [id]
      });

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