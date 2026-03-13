import { db } from "./db.js"

export default async function handler(req, res) {

  try {

    // ======================================
    // GET → LISTAR TRANSACCIONES
    // ======================================
    if (req.method === "GET") {
      const result = await db.execute(
        "SELECT * FROM caja ORDER BY id DESC"
      )
      return res.status(200).json(result.rows)
    }

    // ======================================
    // POST → REGISTRAR COBRO
    // ======================================
    if (req.method === "POST") {
      const { client, plate, spot, phone, amount, method } = req.body

      if (!amount) {
        return res.status(400).json({ error: "Monto requerido" })
      }

      const now = new Date()
      const time = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      const date = now.toISOString().split("T")[0]

      await db.execute({
        sql: `
          INSERT INTO caja
          (client, plate, spot, phone, amount, method, time, date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          client || "Cliente General",
          plate || "---",
          spot || "---",
          phone || "",
          amount,
          method || "Efectivo",
          time,
          date
        ]
      })

      return res.status(200).json({ success: true, message: "Cobro registrado" })
    }

    // ======================================
    // DELETE → ANULAR TRANSACCION
    // ======================================
    if (req.method === "DELETE") {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: "ID requerido" })

      await db.execute({
        sql: "DELETE FROM caja WHERE id = ?",
        args: [id]
      })

      return res.status(200).json({ success: true, message: "Transacción anulada" })
    }

    return res.status(405).json({ error: "Método no permitido" })

  } catch (error) {
    console.error("ERROR API CAJA:", error)
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message })
  }
}