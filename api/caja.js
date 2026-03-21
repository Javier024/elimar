import { db } from "./db.js"
import { logToHistory } from "./historial.js" // Importamos el logger

export default async function handler(req, res) {
  try {
    // --- GET: LISTA DE DEUDORES ---
    if (req.method === "GET" && req.query.deudores === "true") {
      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const offset = (page - 1) * limit;
      
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      
      const result = await db.execute(`
        SELECT nombre, placa, telefono 
        FROM clientes 
        WHERE placa NOT IN (
          SELECT plate FROM caja 
          WHERE date LIKE ? AND plate != '---'
        )
        LIMIT ? OFFSET ?
      `, [`${currentMonthPrefix}%`, limit, offset]);

      const countResult = await db.execute(`
        SELECT COUNT(*) as total 
        FROM clientes 
        WHERE placa NOT IN (
          SELECT plate FROM caja 
          WHERE date LIKE ? AND plate != '---'
        )
      `, [`${currentMonthPrefix}%`]);

      const totalDeudores = countResult.rows[0].total;

      return res.status(200).json({ 
        rows: result.rows, 
        total: totalDeudores,
        page: page,
        totalPages: Math.ceil(totalDeudores / limit)
      });
    }

    // --- GET: LEER CAJA NORMAL ---
    if (req.method === "GET") {
      const result = await db.execute("SELECT * FROM caja ORDER BY id DESC");
      return res.status(200).json(result.rows);
    }

    // --- POST: REGISTRAR COBRO ---
    if (req.method === "POST") {
      const { client, plate, spot, phone, amount, method, client_id, period_type, period_quantity } = req.body;

      if (!amount) return res.status(400).json({ error: "Monto requerido" });

      const now = new Date();
      const time = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      const date = now.toISOString().split("T")[0];

      // Insertar en Caja
      await db.execute({
        sql: `INSERT INTO caja (client, plate, spot, phone, amount, method, time, date, period_type, period_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          client || "Cliente General", 
          plate || "---", 
          spot || "---", 
          phone || "", 
          amount, 
          method || "Efectivo", 
          time, 
          date,
          period_type || "Noche",
          period_quantity || 1
        ]
      });

      // --- INTEGRACIÓN CON HISTORIAL (Pendientes) ---
      // Esto actualiza registros viejos si el cliente debía dinero
      if (plate && plate !== "---") {
          await db.execute({
              sql: `UPDATE historial SET paid=? WHERE plate=? AND exit IS NOT NULL AND paid = 0`,
              args: [amount, plate]
          });
      }

      // --- NUEVO: REGISTRAR EN HISTORIAL GLOBAL ---
      // Registramos que se hizo un cobro nuevo
      await logToHistory(
          'CAJA', 
          `Cobro: ${client} (${plate})`, 
          amount, 
          plate
      );

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