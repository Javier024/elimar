import { db } from "./db.js"

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await db.execute(`SELECT * FROM historial ORDER BY date DESC, entry DESC`)
      return res.status(200).json(result.rows)
    }
    
    if (req.method === "POST") {
      const { plate, type, spot, entry, exit, paid, date, action_type, description, amount, ref_date } = req.body;
      
      // Si es un log del sistema (Caja, Gastos, etc.)
      if (action_type) {
          const logDate = ref_date || new Date().toISOString().split("T")[0];
          const logTime = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

          await db.execute({
              sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [logDate, logTime, null, "---", action_type, description || "", amount || 0]
          });
          return res.status(200).json({ success: true, message: "Log registrado" });
      }

      // Registro normal de vehículo
      const now = new Date()
      const d = date || now.toISOString().split("T")[0]
      const t = entry || now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      
      await db.execute({ 
          sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?,?,?,?,?,?,?)`, 
          args: [d, t, exit, plate, type, spot, paid || 0] 
      })
      return res.status(200).json({ success: true, message: "Registro agregado" })
    }
    
    if (req.method === "PUT") {
      const { id, paid } = req.body
      const now = new Date()
      const exit = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      await db.execute({ sql: `UPDATE historial SET exit=?, paid=? WHERE id=?`, args: [exit, paid, id] })
      return res.status(200).json({ success: true })
    }
    
    if (req.method === "DELETE") {
      // Seguridad extra: req.query podría ser undefined en algunos entornos
      const query = req.query || {};
      const { id, fromDate, toDate, type } = query;

      // CASO 1: BORRAR INDIVIDUAL
      if (id) {
          await db.execute({ sql: `DELETE FROM historial WHERE id=?`, args: [id] });
          return res.status(200).json({ success: true });
      }

      // CASO 2: LIMPIEZA MASIVA
      if (!fromDate && !toDate && !type) {
          return res.status(400).json({ error: "Se requiere fecha o categoría para limpiar" });
      }

      let sql = "DELETE FROM historial WHERE 1=1";
      let params = [];

      if (fromDate && toDate) {
          sql += " AND date >= ? AND date <= ?";
          params.push(fromDate, toDate);
      }

      if (type && type !== 'all') {
          sql += " AND type = ?";
          params.push(type);
      }

      await db.execute({ sql, args: params });
      return res.status(200).json({ success: true, message: "Historial limpiado correctamente" });
    }
    
    return res.status(405).json({ error: "Método no permitido" })
  } catch (error) {
    console.error("ERROR API HISTORIAL:", error)
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message })
  }
}

// --- FUNCIÓN PARA REGISTRAR EVENTOS DESDE OTRAS PÁGINAS ---
export async function logToHistory(action_type, description, amount = 0, plate = "---", ref_date = null) {
  try {
    const logDate = ref_date || new Date().toISOString().split("T")[0];
    const logTime = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

    await db.execute({
      sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [logDate, logTime, null, plate, action_type, description || "", amount || 0]
    });
  } catch (error) {
    console.error("Error guardando log global:", error);
  }
}