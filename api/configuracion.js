// parqueo/api/configuracion.js
import { db } from "./db.js";
import bcrypt from "bcryptjs"; 
import { authGuard } from "./_lib/auth.js"; // <-- NUEVO

export default async function handler(req, res) {
  try {
    const user = authGuard(req, res); // <-- NUEVO
    if (!user) return; // <-- NUEVO

    let data = {};
    
    // --- PASO 1: LECTURA LIMPIA ---
    // Ya no intentamos crear la tabla aquí. Se asume que ya existe en Turso.
    if (req.method === "GET") {
      const result = await db.execute("SELECT * FROM configuracion WHERE id = 1");
      if (result.rows.length > 0) {
        data = result.rows[0];
      }
      return res.status(200).json(data);
    }

    // --- PASO 2: GUARDADO ---
    if (req.method === "POST") {
      const body = req.body;
      
      // Manejo de Contraseña: Si el usuario ingresó una nueva, la hasheamos
      let hashedPass = body.admin_pass;
      if (body.admin_pass && body.admin_pass.length > 0) {
          const salt = await bcrypt.genSalt(10);
          hashedPass = await bcrypt.hash(body.admin_pass, salt);
      }

      const fields = [
        'nombre', 'nit', 'direccion', 'telefono',
        'tarifa_particular_hora', 'tarifa_particular_noche', 'tarifa_particular_semana', 'tarifa_particular_quincena', 'tarifa_particular_mes',
        'tarifa_moto_hora', 'tarifa_moto_noche', 'tarifa_moto_semana', 'tarifa_moto_quincena', 'tarifa_moto_mes',
        'tarifa_camioneta_hora', 'tarifa_camioneta_noche', 'tarifa_camioneta_semana', 'tarifa_camioneta_quincena', 'tarifa_camioneta_mes',
        'admin_nombre', 'admin_email', 'admin_notif', 'admin_user'
      ];
      
      // Mapeamos los valores normales
      const values = fields.map(f => body[f] || (f.startsWith('tarifa_') ? 0 : ''));
      
      // Agregamos manualmente la contraseña hasheada al final del array
      values.push(hashedPass);
      
      // Agregamos admin_pass al array de campos para el SQL
      const allFields = [...fields, 'admin_pass'];

      // Guardar en TABLA CONFIGURACION
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

      // Sincronizar con TABLA USUARIOS (Para que el cambio de usuario/clave funcione en el login)
      if (body.admin_user || body.admin_pass || body.admin_email) {
          try {
              let userUpdates = [];
              let userArgs = [];
              
              if (body.admin_user) { userUpdates.push("usuario = ?"); userArgs.push(body.admin_user); }
              if (body.admin_email) { userUpdates.push("email = ?"); userArgs.push(body.admin_email); }
              if (body.admin_nombre) { userUpdates.push("nombre = ?"); userArgs.push(body.admin_nombre); }
              
              // Solo actualizamos la contraseña en usuarios si se ingresó una nueva
              if (body.admin_pass && body.admin_pass.length > 0) {
                  userUpdates.push("password = ?");
                  userArgs.push(hashedPass); // Usamos la misma versión hasheada
              }

              if (userUpdates.length > 0) {
                  const sqlUser = `UPDATE usuarios SET ${userUpdates.join(', ')} WHERE rol = 'admin'`;
                  await db.execute({ sql: sqlUser, args: userArgs });
              }
          } catch (syncError) {
              console.error("Error sincronizando usuarios:", syncError.message);
              // No fallamos la petición completa, pero logueamos el error
          }
      }

      return res.status(200).json({ 
          success: true, 
          message: "Configuración guardada correctamente. Si cambiaste usuario o contraseña, vuelve a iniciar sesión." 
      });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("Error General Configuración:", error.message);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}