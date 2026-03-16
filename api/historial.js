import { db } from "./db.js"

export default async function handler(req, res) {

  try {
    // GET: Listar
    if (req.method === "GET") {
      const result = await db.execute(`SELECT * FROM historial ORDER BY id DESC`)
      return res.status(200).json(result.rows)
    }

    // POST: Registrar Entrada (Normal o Manual)
    if (req.method === "POST") {
      const { plate, type, spot } = req.body
      const now = new Date()
      const date = now.toISOString().split("T")[0]
      const entry = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })

      await db.execute({
        sql: `INSERT INTO historial (date, entry, plate, type, spot, paid) VALUES (?,?,?,?,?,?)`,
        args: [date, entry, plate, type, spot, 0]
      })

      return res.status(200).json({ success: true, message: "Registro agregado" })
    }

    // PUT: Registrar Salida
    if (req.method === "PUT") {
      const { id, paid } = req.body
      const now = new Date()
      const exit = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })

      await db.execute({
        sql: `UPDATE historial SET exit=?, paid=? WHERE id=?`,
        args: [exit, paid, id]
      })

      return res.status(200).json({ success: true })
    }

    // DELETE: Eliminar registro (Admin)
    if (req.method === "DELETE") {
      const { id } = req.query
      await db.execute({ sql: `DELETE FROM historial WHERE id=?`, args: [id] })
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: "Método no permitido" })

  } catch (error) {
    console.error("ERROR API HISTORIAL:", error)
    return res.status(500).json({ error: "Error servidor" })
  }
}