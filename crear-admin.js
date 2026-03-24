import 'dotenv/config'; // Carga el .env
import bcrypt from 'bcryptjs';
import { db } from "./api/db.js";

const ADMIN_USUARIO = "admin"; 
const PASSWORD_PLANO = "1234"; 
const ADMIN_NOMBRE = "Administrador";
const ADMIN_EMAIL = "admin@elimar.com";

(async () => {
    try {
        console.log("Conectando y verificando usuario...");

        // 1. Generar el Hash SIEMPRE
        const hash = await bcrypt.hash(PASSWORD_PLANO, 10);
        console.log("Hash generado.");

        // 2. Verificar si existe
        const check = await db.execute("SELECT id FROM usuarios WHERE usuario = ?", [ADMIN_USUARIO]);

        if (check.rows.length > 0) {
            // SI EXISTE: Actualizamos la contraseña y el email por si acaso
            console.log("Usuario existente detectado. Actualizando contraseña a HASH...");
            await db.execute(
                "UPDATE usuarios SET password = ?, email = ? WHERE usuario = ?", 
                [hash, ADMIN_EMAIL, ADMIN_USUARIO]
            );
            console.log("✅ Contraseña actualizada correctamente.");
        } else {
            // NO EXISTE: Lo creamos
            console.log("Creando nuevo usuario...");
            await db.execute(
                "INSERT INTO usuarios (usuario, password, nombre, email, rol) VALUES (?, ?, ?, ?, ?)", 
                [ADMIN_USUARIO, hash, ADMIN_NOMBRE, ADMIN_EMAIL, 'admin']
            );
            console.log("✅ Usuario Admin creado.");
        }

        console.log("--------------------------------");
        console.log("LISTO. Usa estas credenciales:");
        console.log("Usuario:", ADMIN_USUARIO);
        console.log("Clave:", PASSWORD_PLANO);
        console.log("--------------------------------");

    } catch (error) {
        console.error("❌ Error:", error);
    }
})();