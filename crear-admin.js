// parqueo/crear-admin.js
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createClient } from "@libsql/client";

// 1. CARGAR VARIABLES EXPLÍCITAMENTE
// Esto se ejecuta antes de intentar conectar a la BD
dotenv.config({ path: '.env.local' });

// 2. VERIFICAR QUE LAS VARIABLES EXISTEN (Debugging)
const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    console.error("❌ ERROR CRÍTICO: No se encontró TURSO_DATABASE_URL en .env.local");
    process.exit(1);
}

if (!token) {
    console.error("❌ ERROR CRÍTICO: TURSO_AUTH_TOKEN está vacío en .env.local");
    console.log("Por favor copia el token desde tu panel de Turso.");
    process.exit(1);
}

// 3. CREAR CLIENTE DE BASE DE DATOS MANUALMENTE
// Ya no importamos desde api/db.js para evitar el problema del orden de carga
const db = createClient({
  url: url,
  authToken: token
});

// --- LÓGICA DEL ADMIN ---

const ADMIN_USUARIO = "admin"; 
const PASSWORD_PLANO = "1234"; 
const ADMIN_NOMBRE = "Administrador";
const ADMIN_EMAIL = "guzmanmaceajavier@gmail.com";

(async () => {
    try {
        console.log("Conectando a Turso y verificando usuario...");

        // 1. Generar el Hash
        const hash = await bcrypt.hash(PASSWORD_PLANO, 10);
        console.log("Hash generado correctamente.");

        // 2. Verificar si existe
        // Nota: En Turso/LibSQL la sintaxis puede variar ligeramente, usamos execute estándar
        const check = await db.execute({
            sql: "SELECT id FROM usuarios WHERE usuario = ?",
            args: [ADMIN_USUARIO]
        });

        // LibSQL devuelve las filas en .rows
        if (check.rows && check.rows.length > 0) {
            // SI EXISTE: Actualizamos
            console.log("Usuario existente detectado. Actualizando contraseña...");
            await db.execute({
                sql: "UPDATE usuarios SET password = ?, email = ? WHERE usuario = ?", 
                args: [hash, ADMIN_EMAIL, ADMIN_USUARIO]
            });
            console.log("✅ Contraseña actualizada correctamente.");
        } else {
            // NO EXISTE: Lo creamos
            console.log("Creando nuevo usuario admin...");
            await db.execute({
                sql: "INSERT INTO usuarios (usuario, password, nombre, email, rol) VALUES (?, ?, ?, ?, ?)", 
                args: [ADMIN_USUARIO, hash, ADMIN_NOMBRE, ADMIN_EMAIL, 'admin']
            });
            console.log("✅ Usuario Admin creado.");
        }

        console.log("--------------------------------");
        console.log("LISTO. Usa estas credenciales:");
        console.log("Usuario:", ADMIN_USUARIO);
        console.log("Clave:", PASSWORD_PLANO);
        console.log("--------------------------------");

    } catch (error) {
        console.error("❌ Error durante el proceso:", error.message);
        console.error(error);
    }
})();