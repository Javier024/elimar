// parqueo/api/clientes.js
import { db } from "./db.js";
import { logToHistory } from "./historial.js" // Importamos el logger

export default async function handler(req, res) {
  try {
    // --- GET: Obtener todos los clientes ---
    if (req.method === "GET") {
      const result = await db.execute("SELECT * FROM clientes ORDER BY id DESC");
      return res.status(200).json(result.rows);
    }

    // --- POST: Crear nuevo cliente ---
    if (req.method === "POST") {
      const { nombre, telefono, placa, tipo } = req.body;

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

      const fechaHoy = new Date().toISOString().split("T")[0];
      
      await db.execute({
        sql: `INSERT INTO clientes (nombre, telefono, placa, tipo_vehiculo, creado_en) VALUES (?, ?, ?, ?, ?)`,
        args: [nombre, telefono, placa, tipo, fechaHoy] 
      });

      // --- NUEVO: REGISTRAR EN HISTORIAL GLOBAL ---
      await logToHistory(
          'CLIENTE', 
          `Nuevo Cliente: ${nombre}`, 
          0, 
          placa
      );

      return res.status(200).json({ success: true, message: "Cliente registrado correctamente" });
    }

    // --- PUT: Actualizar cliente ---
    if (req.method === "PUT") {
      const { id, nombre, telefono, placa, tipo } = req.body;
      
      if (!id) return res.status(400).json({ error: "ID es requerido para actualizar" });

      await db.execute({
        sql: `UPDATE clientes SET nombre = ?, telefono = ?, placa = ?, tipo_vehiculo = ? WHERE id = ?`,
        args: [nombre, telefono, placa, tipo, id]
      });
      
      return res.status(200).json({ success: true, message: "Cliente actualizado correctamente" });
    }

    // --- DELETE: Eliminar cliente ---
    if (req.method === "DELETE") {
      const id = req.body.id || req.query.id;

      if (!id) return res.status(400).json({ error: "ID es requerido para eliminar" });

      await db.execute({
        sql: "DELETE FROM clientes WHERE id = ?",
        args: [id]
      });

      return res.status(200).json({ success: true, message: "Cliente eliminado correctamente" });
    }
    
    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("API CLIENTES ERROR:", error);
    return res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
}