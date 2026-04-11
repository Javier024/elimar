//parqueo/api/caja.js
import { db } from "./db.js"
import { authGuard } from "./_lib/auth.js" 

export default async function handler(req, res) {
  try {
    const user = authGuard(req, res); 
    if (!user) return; 

    // --- GET: LISTA DE DEUDORES ---
    if (req.method === "GET" && req.query.deudores === "true") {
      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const offset = (page - 1) * limit;
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      
      const result = await db.execute(`
        SELECT c.id, c.nombre, c.placa, c.telefono, c.medio_pago, c.cuota_mensual
        FROM clientes c
        WHERE c.placa NOT IN (
          SELECT plate FROM caja ca 
          WHERE ca.date LIKE ? AND ca.plate != '---'
        )
        LIMIT ? OFFSET ?
      `, [`${currentMonthPrefix}%`, limit, offset]);

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
      if (req.query.id) {
          const result = await db.execute({ 
              sql: `SELECT ca.*, c.tipo_vehiculo as cliente_tipo_vehiculo 
                     FROM caja ca 
                     LEFT JOIN clientes c ON ca.plate = c.placa 
                     WHERE ca.id = ?`, 
              args: [req.query.id] 
          });
          if (result.rows.length === 0) return res.status(404).json({ error: "Registro no encontrado" });
          return res.status(200).json(result.rows[0]);
      }

      const result = await db.execute(`
        SELECT ca.*, 
               cli.medio_pago as cliente_medio_pago,
               cli.telefono as cliente_telefono,
               cli.nombre as cliente_nombre_completo,
               cli.cuota_mensual,
               cli.tipo_vehiculo as cliente_tipo_vehiculo,
               (SELECT date FROM caja c2 WHERE c2.plate = ca.plate AND c2.date < ca.date ORDER BY c2.date DESC LIMIT 1) as last_payment_date
        FROM caja ca
        LEFT JOIN clientes cli ON ca.plate = cli.placa
        ORDER BY ca.date DESC, ca.id DESC
      `);
      return res.status(200).json(result.rows);
    }

    // --- POST: REGISTRAR COBRO ---
    if (req.method === "POST") {
      const { client, plate, spot, phone, amount, method, client_id, period_type, period_quantity, date, entrada_timestamp } = req.body;

      if (!amount) return res.status(400).json({ error: "Monto requerido" });

      const now = new Date();
      const paymentDate = date || now.toISOString().split("T")[0];
      const time = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

      const numAmount = parseFloat(amount);
      const numQty = parseInt(period_quantity) || 1;

      if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ error: "Monto inválido" });

      const result = await db.execute({
        sql: `INSERT INTO caja (client, plate, spot, phone, amount, method, time, date, paid, period_quantity, period_type, entrada_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          client || "Cliente General", 
          plate || "---", 
          spot || "---", 
          phone || "", 
          numAmount, 
          method || "Efectivo", 
          time, 
          paymentDate,
          "0", 
          numQty,
          period_type || "Noche",
          entrada_timestamp || null
        ]
      });

      let newId = 0;
      if (result && result.lastInsertRowid !== undefined) newId = Number(result.lastInsertRowid);
      else if (result && result.lastID !== undefined) newId = Number(result.lastID);

      return res.status(200).json({ 
        success: true, 
        message: "Cobro registrado",
        data: {
          id: newId,
          client, plate, spot, phone, amount: numAmount, method, time, date: paymentDate, period_type, period_quantity: numQty, entrada_timestamp
        }
      });
    }

    // --- PUT: EDITAR COBRO ---
    if (req.method === "PUT") {
        const { id, client, plate, spot, phone, amount, method, period_type, period_quantity, date } = req.body;
        if (!id) return res.status(400).json({ error: "ID requerido" });
        if (!amount) return res.status(400).json({ error: "Monto requerido" });

        const numAmount = parseFloat(amount);
        const numQty = parseInt(period_quantity) || 1;
        const paymentDate = date || new Date().toISOString().split("T")[0];

        await db.execute({
            sql: `UPDATE caja SET client=?, plate=?, spot=?, phone=?, amount=?, method=?, period_type=?, period_quantity=?, date=? WHERE id=?`,
            args: [client, plate, spot, phone, numAmount, method, period_type, numQty, paymentDate, id]
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