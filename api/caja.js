import { db } from "./db.js"

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await db.execute("SELECT * FROM caja ORDER BY id DESC");
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      const { client, plate, spot, phone, amount, method, client_id } = req.body;

      if (!amount) return res.status(400).json({ error: "Monto requerido" });

      const now = new Date();
      const time = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      const date = now.toISOString().split("T")[0];

      // Insertar en Caja
      await db.execute({
        sql: `INSERT INTO caja (client, plate, spot, phone, amount, method, time, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [client || "Cliente General", plate || "---", spot || "---", phone || "", amount, method || "Efectivo", time, date]
      });

      // --- INTEGRACIÓN CON HISTORIAL ---
      // Si hay una placa, marcamos el registro activo en historial como pagado
      if (plate && plate !== "---") {
          await db.execute({
              sql: `UPDATE historial SET paid=? WHERE plate=? AND exit IS NOT NULL AND paid = 0`,
              args: [amount, plate]
          });
      }

      return res.status(200).json({ success: true, message: "Cobro registrado" });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });
      await db.execute({ sql: "DELETE FROM caja WHERE id = ?", args: [id] });
      return res.status(200).json({ success: true, message: "Transacción anulada" });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("ERROR API CAJA:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}