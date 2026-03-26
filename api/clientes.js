// parqueo/api/clientes.js
import { db } from "./db.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await db.execute(`
        SELECT c.*, 
               (SELECT date FROM caja WHERE plate = c.placa ORDER BY date DESC LIMIT 1) as last_payment_date
        FROM clientes c 
        ORDER BY c.id DESC
      `);
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      const { nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle, cuota_mensual } = req.body;

      if (!nombre || !placa) {
        return res.status(400).json({ error: "Nombre y Placa son obligatorios" });
      }

      const placaExistente = await db.execute({
        sql: "SELECT id FROM clientes WHERE placa = ?",
        args: [placa]
      });

      if (placaExistente.rows.length > 0) {
        return res.status(400).json({ error: "Esta placa ya está registrada en el sistema." });
      }

      const pagoFinal = (medio_pago === 'Otro') ? medio_detalle : medio_pago;
      // CORRECCIÓN FECHA: Asegurar formato correcto YYYY-MM-DD
      const fechaAUsar = fecha_registro ? new Date(fecha_registro).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
      const timestampAhora = Date.now(); 
      const cuota = cuota_mensual || 0;
      
      await db.execute({
        sql: `INSERT INTO clientes (nombre, telefono, placa, tipo_vehiculo, creado_en, created_at, fecha_registro, medio_pago, cuota_mensual) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [nombre, telefono, placa, tipo, timestampAhora, new Date().toISOString(), fechaAUsar, pagoFinal, cuota] 
      });

      return res.status(200).json({ success: true, message: "Cliente registrado correctamente" });
    }

    if (req.method === "PUT") {
      const { id, nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle, cuota_mensual } = req.body;
      
      if (!id) return res.status(400).json({ error: "ID es requerido para actualizar" });

      const pagoFinal = (medio_pago === 'Otro') ? medio_detalle : medio_pago;
      const cuota = cuota_mensual || 0;
      // CORRECCIÓN FECHA EN ACTUALIZACIÓN
      const fechaFinal = fecha_registro ? new Date(fecha_registro).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      await db.execute({
        sql: `UPDATE clientes SET nombre = ?, telefono = ?, placa = ?, tipo_vehiculo = ?, fecha_registro = ?, medio_pago = ?, cuota_mensual = ? WHERE id = ?`,
        args: [nombre, telefono, placa, tipo, fechaFinal, pagoFinal, cuota, id]
      });
      
      return res.status(200).json({ success: true, message: "Cliente actualizado correctamente" });
    }

    if (req.method === "DELETE") {
      const id = req.body.id || req.query.id;
      if (!id) return res.status(400).json({ error: "ID es requerido para eliminar" });

      await db.execute({ 
        sql: "UPDATE puestos SET cliente_id=NULL, estado='libre', hora_inicio=NULL, llave_caracteristicas=NULL, puesto_info=NULL WHERE cliente_id = ?", 
        args: [id] 
      });

      await db.execute({ sql: "DELETE FROM clientes WHERE id = ?", args: [id] });
      
      return res.status(200).json({ success: true, message: "Cliente eliminado y puesto liberado correctamente" });
    }
    
    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("API CLIENTES ERROR:", error);
    return res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
}