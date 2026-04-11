// parqueo/api/historial.js
import { db } from "./db.js";
import { authGuard } from "./_lib/auth.js"; // <-- NUEVO

export default async function handler(req, res) {
  try {
    const user = authGuard(req, res); // <-- NUEVO
    if (!user) return; // <-- NUEVO (Si no hay token válido, corta la ejecución)

    if (req.method === "GET") {
      // JOIN usando c.placa (nombre correcto de la columna en clientes)
      const result = await db.execute(`
        SELECT 
          h.id, 
          h.date, 
          h.entry, 
          h.exit, 
          h.plate, 
          h.type, 
          h.spot, 
          h.paid, 
          c.tipo_vehiculo
        FROM historial h 
        LEFT JOIN clientes c ON h.plate = c.placa 
        ORDER BY h.date DESC, h.entry DESC
      `);
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      const { plate, type, spot, entry, exit, paid, date, action_type, description, amount, ref_date } = req.body;

      const logDate = ref_date || date || new Date().toISOString().split("T")[0];
      const logTime = entry || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

      const finalType = action_type || type || "SISTEMA";
      const finalSpot = description || spot || "";
      const finalAmount = amount !== undefined ? amount : (paid || 0);
      const finalPlate = plate || "---";

      await db.execute({
        sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [logDate, logTime, exit, finalPlate, finalType, finalSpot, finalAmount]
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === "PUT") {
      const { id, paid, exit } = req.body;
      let updates = [];
      let args = [];

      if (paid !== undefined) { updates.push("paid=?"); args.push(paid); }

      if (exit) {
        updates.push("exit=?");
        const exitTime = (typeof exit === 'string' && exit.includes(':'))
          ? exit
          : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        args.push(exitTime);
      }

      if (updates.length === 0) return res.status(400).json({ error: "Nada que actualizar" });

      args.push(id);
      await db.execute({
        sql: `UPDATE historial SET ${updates.join(", ")} WHERE id=?`,
        args: args
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });
      await db.execute({ sql: `DELETE FROM historial WHERE id=?`, args: [id] });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("ERROR API HISTORIAL:", error);
    return res.status(500).json({ 
      error: "Error interno", 
      detalle: error.message 
    });
  }
}

// Función Helper Global
// NOTA: Esta función NO lleva authGuard porque es llamada internamente 
// por otras APIs (como gastos.js) que YA pasaron por el filtro de autenticación.
export async function logToHistory(action_type, description, amount = 0, plate = "---", ref_date = null) {
  try {
    const logDate = ref_date || new Date().toISOString().split("T")[0];
    const logTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    await db.execute({
      sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [logDate, logTime, null, plate, action_type, description || "", amount || 0]
    });
  } catch (error) {
    console.error("Error guardando log global:", error);
  }
}