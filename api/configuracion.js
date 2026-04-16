// parqueo/api/configuracion.js
import { db } from "./db.js";
import bcrypt from "bcryptjs"; 
import { authGuard } from "./_lib/auth.js";

// Auto-migrador para columnas de WhatsApp
let hasAutoMigrated = false;
async function autoMigrate() {
    if (hasAutoMigrated) return;
    hasAutoMigrated = true;
    
    // Primero verificar que la tabla existe
    try {
        await db.execute("SELECT id FROM configuracion LIMIT 1");
    } catch (e) {
        // La tabla no existe, crearla
        console.log("Creando tabla configuracion...");
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS configuracion (
                    id INTEGER PRIMARY KEY,
                    nombre TEXT DEFAULT '',
                    nit TEXT DEFAULT '',
                    direccion TEXT DEFAULT '',
                    telefono TEXT DEFAULT '',
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
                    admin_nombre TEXT DEFAULT '',
                    admin_email TEXT DEFAULT '',
                    admin_notif INTEGER DEFAULT 0,
                    admin_user TEXT DEFAULT '',
                    admin_pass TEXT DEFAULT '',
                    wa_numero TEXT DEFAULT '',
                    wa_mensajes TEXT DEFAULT '{}',
                    wa_mensajes_activos TEXT DEFAULT '{"ingreso":true,"salida":true,"cobro":true,"deudor":true}',
                    tema_color TEXT DEFAULT 'indigo'
                )
            `);
            console.log("Tabla configuracion creada exitosamente");
        } catch (createErr) {
            console.error("Error creando tabla:", createErr.message);
        }
        return;
    }
    
    // Agregar columnas nuevas si no existen
    const columnsToAdd = [
        { sql: "ALTER TABLE configuracion ADD COLUMN wa_mensajes TEXT DEFAULT '{}'", error: "ya existe" },
        { sql: "ALTER TABLE configuracion ADD COLUMN wa_numero TEXT DEFAULT ''", error: "ya existe" },
        { sql: "ALTER TABLE configuracion ADD COLUMN wa_mensajes_activos TEXT DEFAULT '{\"ingreso\":true,\"salida\":true,\"cobro\":true,\"deudor\":true}'", error: "ya existe" },
        { sql: "ALTER TABLE configuracion ADD COLUMN tema_color TEXT DEFAULT 'indigo'", error: "ya existe" }
    ];
    
    for (const col of columnsToAdd) {
        try {
            await db.execute(col.sql);
        } catch (e) {
            // Columna ya existe, es normal
        }
    }
}

// Asegurar que exista una fila inicial
async function ensureInitialRow() {
    try {
        const check = await db.execute("SELECT id FROM configuracion WHERE id = 1");
        if (!check.rows || check.rows.length === 0) {
            // Insertar fila inicial con valores por defecto
            const defaultMensajes = JSON.stringify({
                ingreso: '🔔 *{{nombre_parqueadero}}*\n\nVehículo ingresado:\nPlaca: *{{placa}}*\nPuesto: #{{puesto}}\nFecha: {{fecha}}',
                salida: '🚗 *{{nombre_parqueadero}}*\n\nSalida registrada:\nPlaca: *{{placa}}*\nPuesto: #{{puesto}}\nTiempo: {{tiempo}}',
                cobro: '💰 *Recibo de Pago - {{nombre_parqueadero}}*\n\nCliente: {{cliente}}\nPlaca: *{{placa}}*\nMonto: *${{monto}}*\nFecha: {{fecha}}',
                deudor: '{{saludo}}, estimad@ {{nombre}} 🙏\n\nLe escribo de parte del *{{nombre_parqueadero}}* 🅿️ para recordarle sobre el servicio de este mes.\n\n🚗 Placa: *{{placa}}*\n💰 Valor: {{cuota}}\n\nPor favor realice su pago a la brevedad. ¡Gracias! 🙌'
            });
            
            const defaultActivos = JSON.stringify({
                ingreso: true,
                salida: true,
                cobro: true,
                deudor: true
            });
            
            await db.execute({
                sql: `INSERT INTO configuracion (
                    id, nombre, nit, direccion, telefono,
                    tarifa_particular_hora, tarifa_particular_noche, tarifa_particular_semana, tarifa_particular_quincena, tarifa_particular_mes,
                    tarifa_moto_hora, tarifa_moto_noche, tarifa_moto_semana, tarifa_moto_quincena, tarifa_moto_mes,
                    tarifa_camioneta_hora, tarifa_camioneta_noche, tarifa_camioneta_semana, tarifa_camioneta_quincena, tarifa_camioneta_mes,
                    admin_nombre, admin_email, admin_notif, admin_user, admin_pass,
                    wa_numero, wa_mensajes, wa_mensajes_activos, tema_color
                ) VALUES (1, 'PARQUEADERO ELIMAR', '1044212776', 'Cll 20 N° 4-81 Barrio San José', '3206753900',
                    5000, 8000, 45000, 85000, 150000,
                    3000, 5000, 25000, 50000, 80000,
                    6000, 10000, 55000, 100000, 180000,
                    'Administrador', '', 0, 'admin', '',
                    '', ?, ?, 'indigo')`,
                args: [defaultMensajes, defaultActivos]
            });
            console.log("Fila inicial de configuración creada");
        }
    } catch (e) {
        console.error("Error verificando fila inicial:", e.message);
    }
}

export default async function handler(req, res) {
  try {
    const user = authGuard(req, res);
    if (!user) return;

    // Ejecutar migraciones y asegurar fila inicial
    await autoMigrate();
    await ensureInitialRow();

    // --- PASO 1: LECTURA ---
    if (req.method === "GET") {
      const action = req.query.action;

      // ===== BACKUP COMPLETO =====
      if (action === "backup") {
        try {
          const safeQuery = async (sql) => {
            try { 
                const result = await db.execute(sql); 
                return result.rows; 
            } catch (err) { 
                console.warn(`[Backup Omitido] Error: ${err.message}`); 
                return []; 
            }
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

          // Ocultar contraseña en backup
          const usuarios = usuariosRaw.map(u => { 
              const copia = { ...u }; 
              delete copia.password; 
              return copia; 
          });

          const backup = {
            info: { 
                sistema: "PARQUEADERO ELIMAR", 
                version: "2.0", 
                fecha_generacion: new Date().toISOString(), 
                generado_por: user.nombre || user.usuario || "Admin" 
            },
            tablas: { configuracion, clientes, puestos, caja, gastos, historial, usuarios },
            resumen: { 
                total_configuracion: configuracion.length, 
                total_clientes: clientes.length, 
                total_puestos: puestos.length, 
                total_caja: caja.length, 
                total_gastos: gastos.length, 
                total_historial: historial.length, 
                total_usuarios: usuarios.length 
            }
          };

          return res.status(200).json(backup);
        } catch (backupError) {
          console.error("Error crítico generando backup:", backupError);
          return res.status(500).json({ 
              error: "Error al generar el backup", 
              detalle: backupError.message 
          });
        }
      }

      // ===== OBTENER CONFIGURACIÓN =====
      const result = await db.execute("SELECT * FROM configuracion WHERE id = 1");
      const data = result.rows.length > 0 ? result.rows[0] : {};
      
      // Parsear wa_mensajes si existe
      if (typeof data.wa_mensajes === 'string') {
          try {
              data.wa_mensajes = JSON.parse(data.wa_mensajes);
          } catch(e) {
              data.wa_mensajes = {};
          }
      }
      
      // Parsear wa_mensajes_activos si existe
      if (typeof data.wa_mensajes_activos === 'string') {
          try {
              data.wa_mensajes_activos = JSON.parse(data.wa_mensajes_activos);
          } catch(e) {
              data.wa_mensajes_activos = { ingreso: true, salida: true, cobro: true, deudor: true };
          }
      }
      
      return res.status(200).json(data);
    }

    // --- PASO 2: GUARDADO ---
    if (req.method === "POST") {
      const body = req.body;
      
      // Hash de contraseña si se proporciona
      let hashedPass = body.admin_pass;
      if (body.admin_pass && body.admin_pass.length > 0) {
          const salt = await bcrypt.genSalt(10);
          hashedPass = await bcrypt.hash(body.admin_pass, salt);
      }

      // Campos a guardar
      const fields = [
        'nombre', 'nit', 'direccion', 'telefono',
        'tarifa_particular_hora', 'tarifa_particular_noche', 'tarifa_particular_semana', 'tarifa_particular_quincena', 'tarifa_particular_mes',
        'tarifa_moto_hora', 'tarifa_moto_noche', 'tarifa_moto_semana', 'tarifa_moto_quincena', 'tarifa_moto_mes',
        'tarifa_camioneta_hora', 'tarifa_camioneta_noche', 'tarifa_camioneta_semana', 'tarifa_camioneta_quincena', 'tarifa_camioneta_mes',
        'admin_nombre', 'admin_email', 'admin_notif', 'admin_user',
        'wa_numero', 'wa_mensajes', 'wa_mensajes_activos', 'tema_color'
      ];
      
      const values = fields.map(f => {
          if (f === 'wa_mensajes' || f === 'wa_mensajes_activos') {
              // Convertir objeto a JSON string
              return typeof body[f] === 'string' ? body[f] : JSON.stringify(body[f] || {});
          }
          if (f.startsWith('tarifa_') || f === 'admin_notif') {
              return body[f] || 0;
          }
          return body[f] || '';
      });
      
      values.push(hashedPass);
      const allFields = [...fields, 'admin_pass'];

      const check = await db.execute("SELECT id FROM configuracion WHERE id = 1");

      if (check.rows.length > 0) {
        const setClause = allFields.map(f => `${f} = ?`).join(', ');
        await db.execute({ 
            sql: `UPDATE configuracion SET ${setClause} WHERE id = 1`, 
            args: values 
        });
      } else {
        const placeholders = allFields.map(() => '?').join(',');
        await db.execute({ 
            sql: `INSERT INTO configuracion (id, ${allFields.join(',')}) VALUES (1, ${placeholders})`, 
            args: [1, ...values] 
        });
      }

      // Sincronizar con tabla de usuarios
      if (body.admin_user || body.admin_pass || body.admin_email || body.admin_nombre) {
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
          message: "Configuración guardada correctamente.",
          nombre: body.nombre || 'PARQUEADERO ELIMAR'
      });
    }

    // --- PASO 3: RESTAURAR BACKUP (NUEVO) ---
    if (req.method === "PUT" && req.query.action === "restore") {
        try {
            const { data: backupData } = req.body;
            
            if (!backupData || !backupData.tablas) {
                return res.status(400).json({ error: "Formato de backup inválido" });
            }

            const safeInsert = async (tabla, datos) => {
                if (!datos || datos.length === 0) return;
                
                // Limpiar tabla
                await db.execute(`DELETE FROM ${tabla}`);
                
                // Obtener columnas del primer registro
                const columns = Object.keys(datos[0]);
                const placeholders = columns.map(() => '?').join(',');
                const cols = columns.join(',');
                
                for (const row of datos) {
                    const values = columns.map(col => row[col] !== undefined ? row[col] : null);
                    try {
                        await db.execute({
                            sql: `INSERT INTO ${tabla} (${cols}) VALUES (${placeholders})`,
                            args: values
                        });
                    } catch(e) {
                        console.warn(`Error insertando en ${tabla}:`, e.message);
                    }
                }
            };

            // No restaurar usuarios (seguridad)
            await safeInsert('configuracion', backupData.tablas.configuracion);
            await safeInsert('clientes', backupData.tablas.clientes);
            await safeInsert('puestos', backupData.tablas.puestos);
            await safeInsert('caja', backupData.tablas.caja);
            await safeInsert('gastos', backupData.tablas.gastos);
            await safeInsert('historial', backupData.tablas.historial);

            return res.status(200).json({ 
                success: true, 
                message: "Backup restaurado correctamente. (Usuarios no fueron modificados por seguridad)" 
            });
        } catch (restoreError) {
            console.error("Error restaurando backup:", restoreError);
            return res.status(500).json({ 
                error: "Error al restaurar backup", 
                detalle: restoreError.message 
            });
        }
    }

    // --- PASO 4: FORMATEAR SISTEMA ---
    if (req.method === "PUT" && req.query.action === "format") {
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
        await db.execute("DELETE FROM historial");
        await db.execute("DELETE FROM gastos");
        await db.execute("DELETE FROM caja");
        await db.execute("DELETE FROM clientes");
        await db.execute("DELETE FROM puestos");
        await db.execute("DELETE FROM configuracion");
        await db.execute("DELETE FROM usuarios WHERE rol != 'admin'");

        // Re-crear fila inicial
        await ensureInitialRow();

        return res.status(200).json({ 
          success: true, 
          message: "Sistema formateado exitosamente." 
        });
      } catch (deleteError) {
        console.error("Error borrando tablas:", deleteError);
        return res.status(500).json({ error: "Error al limpiar", detalle: deleteError.message });
      }
    }

    return res.status(405).json({ error: "Método no permitido" });

  } catch (error) {
    console.error("Error General Configuración:", error.message);
    return res.status(500).json({ 
        error: "Error interno del servidor", 
        detalle: error.message 
    });
  }
}