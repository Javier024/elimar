// parqueo/api/clientes.js
import { db } from "./db.js";
import { authGuard } from "./_lib/auth.js"; // <-- NUEVO

// Helper para formatear fechas consistentemente
const formatDate = (dateInput) => {
    if (!dateInput) return new Date().toISOString().split("T")[0];
    return new Date(dateInput).toISOString().split("T")[0];
};

export default async function handler(req, res) {
    try {
        const user = authGuard(req, res); if (!user) return; // <-- NUEVO

        if (req.method === "GET") {
            // OPTIMIZACIÓN: Usamos LEFT JOIN en lugar de subconsulta por cada fila.
            // Esto mejora drásticamente el rendimiento con muchos clientes.
            const result = await db.execute(`
                SELECT c.*, 
                       MAX(caja.date) as last_payment_date
                FROM clientes c 
                LEFT JOIN caja ON c.placa = caja.plate
                GROUP BY c.id
                ORDER BY c.id DESC
            `);
            return res.status(200).json(result.rows);
        }

        if (req.method === "POST") {
            const { nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle, cuota_mensual } = req.body;

            if (!nombre || !placa) {
                return res.status(400).json({ error: "Nombre y Placa son obligatorios" });
            }

            // Verificar duplicados
            const placaExistente = await db.execute({
                sql: "SELECT id FROM clientes WHERE placa = ?",
                args: [placa]
            });

            if (placaExistente.rows.length > 0) {
                return res.status(400).json({ error: "Esta placa ya está registrada en el sistema." });
            }

            const pagoFinal = (medio_pago === 'Otro') ? medio_detalle : medio_pago;
            const fechaAUsar = formatDate(fecha_registro);
            const timestampAhora = Date.now(); 
            const cuota = cuota_mensual || 0;
            
            // El orden de las columnas coincide con el esquema y los argumentos
            await db.execute({
                sql: `INSERT INTO clientes (nombre, telefono, placa, tipo_vehiculo, creado_en, created_at, fecha_registro, medio_pago, cuota_mensual) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [nombre, telefono, placa, tipo, timestampAhora, new Date().toISOString(), fechaAUsar, pagoFinal, cuota] 
            });

            return res.status(200).json({ success: true, message: "Cliente registrado correctamente" });
        }

        if (req.method === "PUT") {
            const { id, nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle, cuota_mensual } = req.body;
            
            if (!id) return res.status(400).json({ error: "ID es requerido para actualizar" });

            const pagoFinal = (medio_pago === 'Otro') ? medio_detalle : medio_pago;
            const cuota = cuota_mensual || 0;
            const fechaFinal = formatDate(fecha_registro);

            await db.execute({
                sql: `UPDATE clientes 
                      SET nombre = ?, telefono = ?, placa = ?, tipo_vehiculo = ?, fecha_registro = ?, medio_pago = ?, cuota_mensual = ? 
                      WHERE id = ?`,
                args: [nombre, telefono, placa, tipo, fechaFinal, pagoFinal, cuota, id]
            });
            
            return res.status(200).json({ success: true, message: "Cliente actualizado correctamente" });
        }

        if (req.method === "DELETE") {
            const id = req.body.id || req.query.id;
            if (!id) return res.status(400).json({ error: "ID es requerido para eliminar" });

            // Transacción simple: Liberar puesto y luego borrar
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