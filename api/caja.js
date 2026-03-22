import { db } from "./db.js"
import { logToHistory } from "./historial.js"

export default async function handler(req, res) {
  try {
    // --- GET: LISTA DE DEUDORES (CORREGIDO) ---
    if (req.method === "GET" && req.query.deudores === "true") {
      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const offset = (page - 1) * limit;
      
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      
      // Consulta mejorada: Unimos clientes para poder filtrar por medio_pago si fuera necesario
      // Y usamos ca.date que existe en la tabla.
      const result = await db.execute(`
        SELECT c.nombre, c.placa, c.telefono, c.medio_pago
        FROM clientes c
        WHERE c.placa NOT IN (
          SELECT plate FROM caja ca 
          WHERE ca.date LIKE ? AND ca.plate != '---'
        )
        LIMIT ? OFFSET ?
      `, [`${currentMonthPrefix}%`, limit, offset]);

      // Contar total para paginación
      const countResult = await db.execute(`
        SELECT COUNT(*) as total 
        FROM clientes c
        WHERE c.placa NOT IN (
          SELECT plate FROM caja ca 
          WHERE ca.date LIKE ? AND ca.plate != '---'
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
      // Si piden un registro específico para editar
      if (req.query.id) {
          const result = await db.execute({ sql: "SELECT * FROM caja WHERE id = ?", args: [req.query.id] });
          if (result.rows.length === 0) return res.status(404).json({ error: "Registro no encontrado" });
          return res.status(200).json(result.rows[0]);
      }

      // Lista normal con JOIN para mostrar alertas de vencimiento
      const result = await db.execute(`
        SELECT ca.*, 
               cli.medio_pago as cliente_medio_pago,
               cli.nombre as cliente_nombre_completo
        FROM caja ca
        LEFT JOIN clientes cli ON ca.plate = cli.placa
        ORDER BY ca.date DESC, ca.id DESC
      `);
      return res.status(200).json(result.rows);
    }

    // --- POST: REGISTRAR COBRO ---
    if (req.method === "POST") {
      const { client, plate, spot, phone, amount, method, client_id, period_type, period_quantity, date } = req.body;

      if (!amount) return res.status(400).json({ error: "Monto requerido" });

      const now = new Date();
      const paymentDate = date || now.toISOString().split("T")[0];
      const time = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

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
          paymentDate,
          period_type || "Noche",
          period_quantity || 1
        ]
      });

      if (plate && plate !== "---") {
          await db.execute({
              sql: `UPDATE historial SET paid=? WHERE plate=? AND exit IS NOT NULL AND paid = 0`,
              args: [amount, plate]
          });
      }

      await logToHistory('CAJA', `Cobro: ${client} (${plate})`, amount, plate);

      return res.status(200).json({ success: true, message: "Cobro registrado" });
    }

    // --- PUT: EDITAR COBRO ---
    if (req.method === "PUT") {
        const { id, client, plate, spot, phone, amount, method, period_type, period_quantity, date } = req.body;
        
        if (!id) return res.status(400).json({ error: "ID requerido" });
        if (!amount) return res.status(400).json({ error: "Monto requerido" });

        const paymentDate = date || new Date().toISOString().split("T")[0];

        await db.execute({
            sql: `UPDATE caja SET client=?, plate=?, spot=?, phone=?, amount=?, method=?, period_type=?, period_quantity=?, date=? WHERE id=?`,
            args: [client, plate, spot, phone, amount, method, period_type, period_quantity, paymentDate, id]
        });

        return res.status(200).json({ success: true, message: "Transacción actualizada" });
    }

    // --- DELETE: ANULAR COBRO ---
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