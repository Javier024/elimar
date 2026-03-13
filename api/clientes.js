import { db } from "./db.js"

export default async function handler(req, res) {

  try {

    // ============================
    // GET → LISTAR CLIENTES
    // ============================
    if (req.method === "GET") {
      const result = await db.execute(
        "SELECT * FROM clientes ORDER BY id DESC"
      )
      return res.status(200).json(result.rows)
    }

    // ============================
    // POST → CREAR CLIENTE
    // ============================
    if (req.method === "POST") {
      const { nombre, telefono, placa, tipo } = req.body

      if (!nombre || !placa) {
        return res.status(400).json({ error: "Nombre y Placa son obligatorios" })
      }

      await db.execute({
        sql: `
          INSERT INTO clientes (nombre, telefono, placa, tipo_vehiculo)
          VALUES (?, ?, ?, ?)
        `,
        args: [nombre, telefono, placa, tipo]
      })

      return res.status(200).json({ success: true, message: "Cliente registrado" })
    }

    // ============================
    // PUT → ACTUALIZAR
    // ============================
    if (req.method === "PUT") {
      const { id, nombre, telefono, placa, tipo } = req.body

      if (!id) {
        return res.status(400).json({ error: "ID es requerido para actualizar" })
      }

      await db.execute({
        sql: `
          UPDATE clientes
          SET nombre=?, telefono=?, placa=?, tipo_vehiculo=?
          WHERE id=?
        `,
        args: [nombre, telefono, placa, tipo, id]
      })

      return res.status(200).json({ success: true, message: "Cliente actualizado" })
    }

    // ============================
    // DELETE → ELIMINAR
    // ============================
    if (req.method === "DELETE") {
      const id = req.query.id

      if (!id) {
        return res.status(400).json({ error: "ID es requerido para eliminar" })
      }

      await db.execute({
        sql: "DELETE FROM clientes WHERE id=?",
        args: [id]
      })

      return res.status(200).json({ success: true, message: "Cliente eliminado" })
    }

    return res.status(405).json({
      error: "Método no permitido"
    })

  } catch (error) {
    console.error("API CLIENTES ERROR:", error)
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message
    })
  }
}