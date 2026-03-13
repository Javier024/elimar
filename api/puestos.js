import { db } from "./db.js"

export default async function handler(req, res) {

  try {

    // ================================
    // GET → LISTAR PUESTOS
    // ================================
    if (req.method === "GET") {
      // Hacemos JOIN para traer el nombre del cliente si existe
      const result = await db.execute(`
        SELECT p.*, 
               c.nombre as cliente_nombre,
               c.placa as cliente_placa,
               c.tipo_vehiculo as cliente_tipo
        FROM puestos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        ORDER BY p.id ASC
      `)
      return res.status(200).json(result.rows)
    }

    // ================================
    // POST → CREAR PUESTO
    // ================================
    if (req.method === "POST") {
      const { numero } = req.body

      if (!numero) {
        return res.status(400).json({ error: "El número del puesto es requerido" })
      }

      await db.execute({
        sql: `INSERT INTO puestos (numero, estado) VALUES (?, ?)`,
        args: [numero, "libre"]
      })

      return res.status(200).json({ success: true, message: "Puesto creado correctamente" })
    }

    // ================================
    // PUT → OCUPAR PUESTO
    // ================================
    if (req.method === "PUT") {
      const { id, cliente_id } = req.body

      if (!id || !cliente_id) {
        return res.status(400).json({ error: "ID del puesto y Cliente son requeridos" })
      }

      await db.execute({
        sql: `
          UPDATE puestos
          SET estado='ocupado',
              cliente_id=?,
              hora_inicio=strftime('%s', 'now')
          WHERE id=?
        `,
        args: [cliente_id, id]
      })

      return res.status(200).json({ success: true, message: "Puesto ocupado" })
    }

    // ================================
    // PATCH → LIBERAR PUESTO
    // ================================
    if (req.method === "PATCH") {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: "ID requerido" })

      await db.execute({
        sql: `
          UPDATE puestos
          SET estado='libre',
              cliente_id=NULL,
              hora_inicio=NULL
          WHERE id=?
        `,
        args: [id]
      })

      return res.status(200).json({ success: true, message: "Puesto liberado" })
    }

    // ================================
    // DELETE → ELIMINAR
    // ================================
    if (req.method === "DELETE") {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: "ID requerido" })

      await db.execute({
        sql: `DELETE FROM puestos WHERE id=?`,
        args: [id]
      })

      return res.status(200).json({ success: true, message: "Puesto eliminado" })
    }

    return res.status(405).json({ error: "Método no permitido" })

  } catch (error) {
    console.error("API PUESTOS ERROR:", error)
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message
    })
  }
}