import { db } from "./db.js"

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await db.execute(`SELECT * FROM historial ORDER BY id DESC`)
      return res.status(200).json(result.rows)
    }
    
    if (req.method === "POST") {
      // CASO 1: REGISTRO NORMAL DE VEHÍCULO (Desde puestos)
      const { plate, type, spot, entry, exit, paid, date } = req.body
      
      // CASO 2: REGISTRO GENÉRICO (Para Caja, Gastos, etc.)
      // Si viene 'action_type', es un log del sistema, no un auto
      if (req.body.action_type) {
          const { action_type, description, amount, ref_date } = req.body;
          
          const logDate = ref_date || new Date().toISOString().split("T")[0];
          const logTime = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

          // Guardamos en historial usando las columnas existentes
          // type = action_type (ej: CAJA, GASTO)
          // spot = description (ej: Pago mensual)
          // paid = amount
          // plate = "---" (No aplica)
          await db.execute({
              sql: `INSERT INTO historial (date, entry, exit, plate, type, spot, paid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [logDate, logTime, null, "---", action_type, description || "", amount || 0]
          });
          return res.status(200).json({ success: true, message: "Log registrado" });
      }

      // Lógica original de vehículos
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
      // CASO 1: BORRAR RANGO (Limpiar Historial)
      if (req.query.fromDate && req.query.toDate) {
          const { fromDate, toDate } = req.query;
          // Verificar seguridad básica
          if (!fromDate || !toDate) return res.status(400).json({ error: "Fechas requeridas" });

          await db.execute({
              sql: `DELETE FROM historial WHERE date >= ? AND date <= ?`,
              args: [fromDate, toDate]
          });
          return res.status(200).json({ success: true, message: "Historial limpiado en el rango seleccionado" });
      }

      // CASO 2: BORRAR INDIVIDUAL
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