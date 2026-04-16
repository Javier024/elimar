// parqueo/api/historial.js
import { db } from "./db.js";
import { authGuard } from "./_lib/auth.js";

export default async function handler(req, res) {
  try {
    const user = authGuard(req, res);
    if (!user) return;

    if (req.method === "GET") {
      const action = req.query.action;
      const placa = req.query.placa;

      // Reemplazar esa sección completa
if (action === "backup") {
    try {
        const [
            historial
        ] = await Promise.all([
            db.execute("SELECT * FROM historial ORDER BY date DESC, id DESC")
        ]);

        const backup = {
            info: { 
                tabla: "historial", 
                fecha_generacion: new Date().toISOString(),
                total_registros: historial.rows.length 
            },
            datos: historial.rows
        };

        return res.status(200).json(backup);
    } catch (backupError) {
        console.error("Error en backup historial:", backupError);
        return res.status(500).json({ error: "Error al generar backup" });
    }
}

      let sql = "SELECT * FROM historial ORDER BY date DESC, entry DESC";
      let args = [];

      // ✅ CORREGIDO: Usar TRIM en SQL para ignorar espacios
      if (placa) {
          sql = "SELECT * FROM historial WHERE TRIM(plate) = ? ORDER BY date DESC, entry DESC";
          args = [placa.trim()];
      }

      const result = await db.execute({ sql: sql, args: args });
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      const { plate, type, spot, entry, exit, paid, date, action_type, description, amount, ref_date } = req.body;

      const logDate = ref_date || date || new Date().toISOString().split("T")[0];
      const logTime = entry || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

      const finalType = action_type || type || "SISTEMA";
      const finalSpot = description || spot || "";
      const finalAmount = amount !== undefined ? amount : (paid || 0);
      // ✅ CORREGIDO: TRIM a la placa antes de guardar
      const finalPlate = (plate || "---").trim();

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
export async function logToHistory(action_type, description, amount = 0, plate = "---", ref_date = null) {
  try {
    const logDate = ref_date || new Date().toISOString().split("T")[0];
    const logTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    // ✅ TRIM a la placa
    const cleanPlate = (plate || "---").trim();

    await db.execute({
      sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [logDate, logTime, null, cleanPlate, action_type, description || "", amount || 0]
    });
  } catch (error) {
    console.error("Error guardando log global:", error);
  }
}