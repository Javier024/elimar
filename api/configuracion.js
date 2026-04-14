import { db } from "./db.js";
import bcrypt from "bcryptjs"; 
import { authGuard } from "./_lib/auth.js";

// NUEVO: Auto-migrador para agregar las columnas de WhatsApp sin tocar la DB manualmente
// Esto es 100% seguro, falla silenciosamente si las columnas ya existen.
let hasAutoMigrated = false;
async function autoMigrate() {
    if (hasAutoMigrated) return;
    hasAutoMigrated = true;
    try { await db.execute("ALTER TABLE configuracion ADD COLUMN wa_mensajes TEXT DEFAULT '{}'"); } catch(e) {}
    try { await db.execute("ALTER TABLE configuracion ADD COLUMN wa_numero TEXT DEFAULT ''"); } catch(e) {}
}

export default async function handler(req, res) {
  try {
    const user = authGuard(req, res);
    if (!user) return;

    // --- PASO 1: LECTURA ---
    if (req.method === "GET") {
      const action = req.query.action;

      // ===== BACKUP COMPLETO =====
      if (action === "backup") {
        try {
          const safeQuery = async (sql) => {
            try { const result = await db.execute(sql); return result.rows; } catch (err) { console.warn(`[Backup Omitido] Error: ${err.message}`); return []; }
          };

          const [
            configuracion, clientes, puestos, caja, gastos, historial, usuariosRaw
          ] = await Promise.all([
            safeQuery("SELECT * FROM configuracion"),
            safeQuery("SELECT * FROM clientes"),
            safeQuery("SELECT * FROM puestos"),
            safeQuery("SELECT * FROM caja ORDER BY fecha DESC, id DESC"),
            safeQuery("SELECT * FROM gastos ORDER BY date DESC, id DESC"),
            safeQuery("SELECT * FROM historial ORDER BY date DESC, entry DESC"),
            safeQuery("SELECT * FROM usuarios")
          ]);

          const usuarios = usuariosRaw.map(u => { const copia = { ...u }; delete copia.password; return copia; });

          const backup = {
            info: { sistema: "PARQUEADERO ELIMAR", version: "1.0", fecha_generacion: new Date().toISOString(), generado_por: user.nombre || user.usuario || "Admin" },
            tablas: { configuracion, clientes, puestos, caja, gastos, historial, usuarios },
            resumen: { total_configuracion: configuracion.length, total_clientes: clientes.length, total_puestos: puestos.length, total_caja: caja.length, total_gastos: gastos.length, total_historial: historial.length, total_usuarios: usuarios.length }
          };

          return res.status(200).json(backup);
        } catch (backupError) {
          console.error("Error crítico generando backup:", backupError);
          return res.status(500).json({ error: "Error al generar el backup", detalle: backupError.message });
        }
      }

      // Ejecutar auto-migración antes de leer
      await autoMigrate();

      // Lógica normal de GET
      const result = await db.execute("SELECT * FROM configuracion WHERE id = 1");
      const data = result.rows.length > 0 ? result.rows[0] : {};
      return res.status(200).json(data);
    }

    // --- PASO 2: GUARDADO ---
    if (req.method === "POST") {
      // Ejecutar auto-migración antes de guardar
      await autoMigrate();

      const body = req.body;
      
      let hashedPass = body.admin_pass;
      if (body.admin_pass && body.admin_pass.length > 0) {
          const salt = await bcrypt.genSalt(10);
          hashedPass = await bcrypt.hash(body.admin_pass, salt);
      }

      // NUEVO: Se agregaron wa_numero y wa_mensajes a la lista de campos
      const fields = [
        'nombre', 'nit', 'direccion', 'telefono',
        'tarifa_particular_hora', 'tarifa_particular_noche', 'tarifa_particular_semana', 'tarifa_particular_quincena', 'tarifa_particular_mes',
        'tarifa_moto_hora', 'tarifa_moto_noche', 'tarifa_moto_semana', 'tarifa_moto_quincena', 'tarifa_moto_mes',
        'tarifa_camioneta_hora', 'tarifa_camioneta_noche', 'tarifa_camioneta_semana', 'tarifa_camioneta_quincena', 'tarifa_camioneta_mes',
        'admin_nombre', 'admin_email', 'admin_notif', 'admin_user',
        'wa_numero', 'wa_mensajes' // CAMPOS NUEVOS
      ];
      
      const values = fields.map(f => body[f] || (f.startsWith('tarifa_') ? 0 : ''));
      values.push(hashedPass);
      const allFields = [...fields, 'admin_pass'];

      const check = await db.execute("SELECT id FROM configuracion WHERE id = 1");

      if (check.rows.length > 0) {
        const setClause = allFields.map(f => `${f} = ?`).join(', ');
        await db.execute({ sql: `UPDATE configuracion SET ${setClause} WHERE id = 1`, args: values });
      } else {
        const placeholders = allFields.map(() => '?').join(',');
        await db.execute({ 
          sql: `INSERT INTO configuracion (id, ${allFields.join(',')}) VALUES (1, ${placeholders})`, 
          args: [1, ...values] 
        });
      }

      if (body.admin_user || body.admin_pass || body.admin_email) {
          try {
              let userUpdates = [];
              let userArgs = [];
              
              if (body.admin_user) { userUpdates.push("usuario = ?"); userArgs.push(body.admin_user); }
              if (body.admin_email) { userUpdates.push("email = ?"); userArgs.push(body.admin_email); }
              if (body.admin_nombre) { userUpdates.push("nombre = ?"); userArgs.push(body.admin_nombre); }
              if (body.admin_pass && body.admin_pass.length > 0) {
                  userUpdates.push("password = ?");
                  userArgs.push(hashedPass);
              }

              if (userUpdates.length > 0) {
                  const sqlUser = `UPDATE usuarios SET ${userUpdates.join(', ')} WHERE rol = 'admin'`;
                  await db.execute({ sql: sqlUser, args: userArgs });
              }
          } catch (syncError) {
              console.error("Error sincronizando usuarios:", syncError.message);
          }
      }

      return res.status(200).json({ 
          success: true, 
          message: "Configuración guardada correctamente." 
      });
    }

    // --- PASO 3: FORMATEAR SISTEMA ---
    if (req.method === "PUT") {
      const action = req.query.action;

      if (action === "format") {
        const { confirm_pass } = req.body;

        if (!confirm_pass) {
          return res.status(400).json({ error: "Se requiere la contraseña" });
        }

        const adminRes = await db.execute("SELECT password FROM usuarios WHERE rol = 'admin' LIMIT 1");
        if (adminRes.rows.length === 0) {
          return res.status(400).json({ error: "No se encontró usuario administrador" });
        }

        const isValid = await bcrypt.compare(confirm_pass, adminRes.rows[0].password);
        if (!isValid) {
          return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        try {
          const safeDelete = async (sql) => {
            try { await db.execute(sql); } catch (e) { console.warn("Format omitido:", e.message); }
          };

          await safeDelete("DELETE FROM historial");
          await safeDelete("DELETE FROM gastos");
          await safeDelete("DELETE FROM caja");
          await safeDelete("DELETE FROM clientes");
          await safeDelete("DELETE FROM puestos");
          await safeDelete("DELETE FROM configuracion");
          await safeDelete("DELETE FROM usuarios WHERE rol != 'admin'");

          return res.status(200).json({ 
            success: true, 
            message: "Sistema formateado exitosamente." 
          });
        } catch (deleteError) {
          console.error("Error borrando tablas:", deleteError);
          return res.status(500).json({ error: "Error al limpiar", detalle: deleteError.message });
        }
      }
      return res.status(400).json({ error: "Acción PUT no válida" });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("Error General Configuración:", error.message);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}