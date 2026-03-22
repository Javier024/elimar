// parqueo/api/configuracion.js
import { db } from "./db.js";

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

    // --- PASO 2: AUTO-CREACIÓN DE LA TABLA (Si falló el paso 1) ---
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

        // Volvemos a intentar leer para llenar 'data'
        const reRead = await db.execute("SELECT * FROM configuracion WHERE id = 1");
        if (reRead.rows.length > 0) data = reRead.rows[0];

      } catch (createError) {
        console.error("Error CRÍTICO creando tabla:", createError);
        return res.status(500).json({ 
          error: "No se pudo inicializar la configuración. La base de datos no tiene permisos para crear tablas o hay un conflicto.", 
          detalle: createError.message 
        });
      }
    }

    // --- PASO 3: RESPUESTA A PETICIONES (GET / POST) ---
    
    if (req.method === "GET") {
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const body = req.body;
      
      // Verificamos si ya existe un registro con ID 1 para saber si hacemos UPDATE o INSERT
      const check = await db.execute("SELECT id FROM configuracion WHERE id = 1");

      const fields = [
        'nombre', 'nit', 'direccion', 'telefono',
        'tarifa_particular_hora', 'tarifa_particular_noche', 'tarifa_particular_semana', 'tarifa_particular_quincena', 'tarifa_particular_mes',
        'tarifa_moto_hora', 'tarifa_moto_noche', 'tarifa_moto_semana', 'tarifa_moto_quincena', 'tarifa_moto_mes',
        'tarifa_camioneta_hora', 'tarifa_camioneta_noche', 'tarifa_camioneta_semana', 'tarifa_camioneta_quincena', 'tarifa_camioneta_mes',
        'admin_nombre', 'admin_email', 'admin_notif', 'admin_user', 'admin_pass'
      ];
      
      const values = fields.map(f => body[f] || 0); // Usamos 0 como default para números
      
      if (check.rows.length > 0) {
        // UPDATE
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        await db.execute({ sql: `UPDATE configuracion SET ${setClause} WHERE id = 1`, args: values });
      } else {
        // INSERT (Fallback)
        const placeholders = fields.map(() => '?').join(',');
        await db.execute({ 
          sql: `INSERT INTO configuracion (id, ${fields.join(',')}) VALUES (1, ${placeholders})`, 
          args: [1, ...values] 
        });
      }

      return res.status(200).json({ success: true, message: "Configuración guardada correctamente" });
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("Error General Configuración:", error);
    return res.status(500).json({ error: "Error interno del servidor", detalle: error.message });
  }
}