// parqueo/api/auth.js
// AGREGAMOS ESTAS DOS LÍNEAS PARA FORZAR LA CARGA DE LAS VARIABLES
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); 

import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { db } from "./db.js";

export default async function handler(req, res) {
    try {
        // --- POST: LOGIN ---
        if (req.method === "POST" && !req.query.action) {
            const { user, pass } = req.body;

            if (!user || !pass) {
                return res.status(400).json({ success: false, message: "Usuario y contraseña requeridos" });
            }

            const result = await db.execute("SELECT * FROM usuarios WHERE usuario = ?", [user]);
            const foundUser = result.rows[0];

            if (!foundUser) {
                return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
            }

            // Verificar Hash
            const isMatch = await bcrypt.compare(pass, foundUser.password);

            if (isMatch) {
                return res.status(200).json({
                    success: true,
                    user: {
                        id: foundUser.id,
                        nombre: foundUser.nombre,
                        email: foundUser.email,
                        rol: foundUser.role
                    }
                });
            } else {
                return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
            }
        }

        // --- POST: RECUPERAR CONTRASEÑA ---
        if (req.method === "POST" && req.query.action === "recover") {
            const { user, method } = req.body; 

            if (!user) {
                return res.status(400).json({ success: false, message: "Usuario requerido" });
            }

            const result = await db.execute("SELECT * FROM usuarios WHERE usuario = ?", [user]);
            const foundUser = result.rows[0];

            if (!foundUser) {
                return res.status(404).json({ success: false, message: "Usuario no encontrado" });
            }

            // --- MÉTODO WHATSAPP ---
            if (method === 'whatsapp') {
                const configResult = await db.execute("SELECT telefono FROM configuracion WHERE id = 1");
                const config = configResult.rows[0];

                if (!config || !config.telefono) {
                    return res.status(400).json({ success: false, message: "No hay teléfono de contacto en configuración." });
                }

                const mensaje = `Hola, soy el usuario *${user}* (${foundUser.nombre}). He olvidado mi contraseña del sistema PARQUEADERO ELIMAR. Por favor, ayúdenme a restablecerla.`;
                const cleanPhone = config.telefono.replace(/\D/g, '');
                const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`;

                return res.status(200).json({ success: true, whatsappUrl });
            }

            // --- MÉTODO EMAIL ---
            if (method === 'email') {
                if (!foundUser.email) {
                    return res.status(400).json({ success: false, message: "Este usuario no tiene correo registrado." });
                }

                // Depuración (Opcional): Imprime en consola lo que está leyendo
                console.log("Enviando correo con usuario:", process.env.EMAIL_USER);

                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                // Generar nueva contraseña temporal
                const tempPass = Math.random().toString(36).slice(-8);
                const salt = await bcrypt.genSalt(10);
                const hashPass = await bcrypt.hash(tempPass, salt);

                // Guardar nueva contraseña hasheada
                await db.execute("UPDATE usuarios SET password = ? WHERE id = ?", [hashPass, foundUser.id]);

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: foundUser.email,
                    subject: 'Recuperación de Contraseña - Parqueadero Elimar',
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                            <h2 style="color: #0f172a;">Hola ${foundUser.nombre},</h2>
                            <p>Hemos generado una contraseña temporal para tu cuenta.</p>
                            <p style="background: #f1f5f9; padding: 10px; font-size: 18px; font-weight: bold; display: inline-block; border-radius: 4px;">${tempPass}</p>
                            <p style="color: #666;">Por seguridad, te recomendamos cambiarla inmediatamente después de iniciar sesión.</p>
                        </div>
                    `
                };

                try {
                    await transporter.sendMail(mailOptions);
                    return res.status(200).json({ success: true, message: "Contraseña temporal enviada a tu correo." });
                } catch (emailError) {
                    console.error("Error enviando correo:", emailError);
                    return res.status(500).json({ success: false, message: "Error al enviar el correo. Contacta al soporte." });
                }
            }
        }

        return res.status(405).json({ error: "Método no permitido" });

    } catch (error) {
        console.error("Error Auth:", error);
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
}