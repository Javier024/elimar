import { db } from "./db.js";

export default async function handler(req, res) {
  try {
    // ================================
    // GET → LISTAR PUESTOS
    // ================================
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
      
      // Mapeo seguro para evitar errores si la columna no existe
      const rows = result.rows.map(row => ({
        ...row,
        deuda: 0,
        // Si la columna no existe en la DB, intentamos devolver null para no romper el render
        fecha_registro: row.fecha_registro || null 
      }));

      return res.status(200).json(rows);
    }

    // ================================
    // POST → CREAR PUESTO
    // ================================
    if (req.method === "POST") {
      const { numero } = req.body;
      if (!numero) return res.status(400).json({ error: "Número requerido" });

      const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=?", args: [numero] });
      if (check.rows.length > 0) {
        return res.status(400).json({ error: "El número de puesto ya existe" });
      }

      await db.execute({
        sql: `INSERT INTO puestos (numero, estado) VALUES (?, ?)`,
        args: [numero, "libre"]
      });
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    // ================================
    // PUT → ACTUALIZAR (ASIGNAR / EDITAR / AUSENCIA)
    // ================================
    if (req.method === "PUT") {
      const { id, cliente_id, estado, llave, accion, fecha_regreso, nuevo_numero } = req.body;

      if (!id) return res.status(400).json({ error: "ID requerido" });

      // --- CASO 1: EDITAR NÚMERO ---
      if (accion === "editar_numero") {
        if (!nuevo_numero) return res.status(400).json({ error: "Nuevo número requerido" });
        
        const check = await db.execute({ sql: "SELECT id FROM puestos WHERE numero=? AND id!=?", args: [nuevo_numero, id] });
        if (check.rows.length > 0) {
          return res.status(400).json({ error: "Ese número ya está en uso en otro puesto" });
        }

        await db.execute({
          sql: `UPDATE puestos SET numero=? WHERE id=?`,
          args: [nuevo_numero, id]
        });
        return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // --- CASO 2: SALIDA TEMPORAL ---
      if (accion === "salida_temporal") {
        if (!fecha_regreso) return res.status(400).json({ error: "Fecha de regreso requerida" });
        
        // Obtener cliente actual
        const current = await db.execute({ sql: "SELECT cliente_id FROM puestos WHERE id=?", args: [id] });
        const clienteOriginal = current.rows[0]?.cliente_id;

        if (!clienteOriginal) return res.status(400).json({ error: "El puesto está vacío" });

        // Guardar JSON y liberar puesto
        const infoAusencia = JSON.stringify({
          tipo: "ausencia",
          cliente_id_original: clienteOriginal,
          fecha_regreso: fecha_regreso,
          fecha_salida: new Date().toISOString()
        });

        await db.execute({
          sql: `UPDATE puestos SET estado='libre', cliente_id=NULL, fecha_registro=NULL, llave_caracteristicas=? WHERE id=?`,
          args: [infoAusencia, id]
        });

        return res.status(200).json({ success: true, message: "Ausencia activada" });
      }

      // --- CASO 3: ASIGNAR CLIENTE ---
      if (cliente_id) {
        const tipoEstado = estado || 'ocupado';
        // FECHA DE REGISTRO: 
        // Intentamos obtener la fecha actual. 
        // NOTA: En SQLite moderno, strftime('%s', 'now') devuelve timestamp (entero).
        const ahora = new Date().toISOString(); 

        // Construimos el SQL dinámico para evitar errores de columna
        let sqlUpdate = `
          UPDATE puestos
          SET estado=?, cliente_id=?, fecha_registro=?, hora_inicio=strftime('%s', 'now'), llave_caracteristicas=?
          WHERE id=?
        `;
        
        await db.execute({
          sql: sqlUpdate,
          // Enviamos 'llave' para mantener ausencias si existen
          args: [tipoEstado, cliente_id, ahora, llave || null, id]
        });
        return res.status(200).json({ success: true, message: `Puesto ${tipoEstado}` });
      } 
      
      // --- CASO 4: SOLO ACTUALIZAR LLAVES ---
      else {
        await db.execute({
          sql: `UPDATE puestos SET llave_caracteristicas=? WHERE id=?`,
          args: [llave || null, id]
        });
        return res.status(200).json({ success: true, message: "Info actualizada" });
      }
    }

    // ================================
    // PATCH → LIBERAR PUESTO
    // ================================
    if (req.method === "PATCH") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });

      await db.execute({
        sql: `
          UPDATE puestos
          SET estado='libre', cliente_id=NULL, hora_inicio=NULL, fecha_registro=NULL, llave_caracteristicas=NULL
          WHERE id=?
        `,
        args: [id]
      });
      return res.status(200).json({ success: true, message: "Puesto liberado" });
    }

    // ================================
    // DELETE → ELIMINAR PUESTO
    // ================================
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