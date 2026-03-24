// parqueo/api/configuracion.js
import { db } from "./db.js";
import bcrypt from "bcryptjs"; // Importamos bcrypt para encriptar la nueva contraseña

export default async function handler(req, res) {
  try {
    // --- PASO 1: INTENTO DE LECTURA ---
    let data = {};
    let tablaExiste = false;

    try {
      const result = await db.execute("SELECT * FROM configuracion WHERE id = 1");
      if (result.rows.length > 0) {
        data = result.rows[0];
        tablaExiste = true;
      }
    } catch (e) {
      console.log("Tabla configuracion no existe aún. Intentando crearla...");
    }

    // --- PASO 2: AUTO-CREACIÓN DE LA TABLA ---
    if (!tablaExiste) {
      try {
        console.log("Ejecutando CREATE TABLE...");
        await db.execute(`
          CREATE TABLE IF NOT EXISTS configuracion (
            id INTEGER PRIMARY KEY,
            nombre TEXT,
            nit TEXT,
            direccion TEXT,
            telefono TEXT,
            tarifa_particular_hora INTEGER DEFAULT 0,
            tarifa_particular_noche INTEGER DEFAULT 0,
            tarifa_particular_semana INTEGER DEFAULT 0,
            tarifa_particular_quincena INTEGER DEFAULT 0,
            tarifa_particular_mes INTEGER DEFAULT 0,
            tarifa_moto_hora INTEGER DEFAULT 0,
            tarifa_moto_noche INTEGER DEFAULT 0,
            tarifa_moto_semana INTEGER DEFAULT 0,
            tarifa_moto_quincena INTEGER DEFAULT 0,
            tarifa_moto_mes INTEGER DEFAULT 0,
            tarifa_camioneta_hora INTEGER DEFAULT 0,
            tarifa_camioneta_noche INTEGER DEFAULT 0,
            tarifa_camioneta_semana INTEGER DEFAULT 0,
            tarifa_camioneta_quincena INTEGER DEFAULT 0,
            tarifa_camioneta_mes INTEGER DEFAULT 0,
            admin_nombre TEXT,
            admin_email TEXT,
            admin_notif INTEGER DEFAULT 0,
            admin_user TEXT,
            admin_pass TEXT
          )
        `);
        
        // Insertar datos iniciales
        await db.execute(`
          INSERT OR IGNORE INTO configuracion (id, nombre, admin_user, admin_pass) 
          VALUES (1, 'Mi Parqueadero', 'admin', 'admin')
        `);
        console.log("Tabla creada con éxito.");

        // Volvemos a intentar leer
        const reRead = await db.execute("SELECT * FROM configuracion WHERE id = 1");
        if (reRead.rows.length > 0) data = reRead.rows[0];

      } catch (createError) {
        console.error("Error CRÍTICO creando tabla:", createError);
        return res.status(500).json({ 
          error: "No se pudo inicializar la configuración.", 
          detalle: createError.message 
        });
      }
    }

    // --- PASO 3: RESPUESTA A PETICIONES ---
    
    if (req.method === "GET") {
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const body = req.body;
      
      // --- NUEVA LÓGICA: Manejo de Contraseña ---
      // Si el usuario ingresó una nueva contraseña, la hasheamos ANTES de guardarla
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

      // --- NUEVA LÓGICA: Sincronizar con TABLA USUARIOS ---
      // Esto es lo que faltaba: Actualizar la tabla de login real
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
                  // Actualizamos el usuario con rol 'admin'
                  // Nota: Esto asume que solo hay 1 admin, si hay varios, podrías buscar por el ID del usuario actual en sesión
                  const sqlUser = `UPDATE usuarios SET ${userUpdates.join(', ')} WHERE rol = 'admin'`;
                  await db.execute({ sql: sqlUser, args: userArgs });
                  console.log("Sincronización con tabla usuarios: OK");
              }
          } catch (syncError) {
              console.error("Error sincronizando usuarios:", syncError);
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
    console.error("Error General Configuración:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}