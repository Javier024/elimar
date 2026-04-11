import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { db } from "./db.js";
import { generateToken } from "./_lib/auth.js";

export default async function handler(req, res) {
    try {
        // --- POST: LOGIN ---
        if (req.method === "POST" && !req.query.action) {
            const { user, pass } = req.body;
            if (!user || !pass) return res.status(400).json({ success: false, message: "Usuario y contraseña requeridos" });

            const result = await db.execute("SELECT * FROM usuarios WHERE usuario = ?", [user]);
            if (!result.rows || result.rows.length === 0) {
                return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
            }

            const foundUser = result.rows[0];
            const isMatch = await bcrypt.compare(pass, foundUser.password);

            if (isMatch) {
                // GENERAMOS EL TOKEN SEGURO
                const token = generateToken(foundUser);
                return res.status(200).json({
                    success: true,
                    token: token, // <-- NUEVO: Se envía al frontend
                    user: { id: foundUser.id, nombre: foundUser.nombre, email: foundUser.email, rol: foundUser.rol }
                });
            } else {
                return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
            }
        }

        // --- POST: RECUPERAR CONTRASEÑA ---
        if (req.method === "POST" && req.query.action === "recover") {
            const { user } = req.body;
            if (!user) return res.status(400).json({ success: false, message: "Usuario requerido" });

            const result = await db.execute("SELECT * FROM usuarios WHERE usuario = ?", [user]);
            const foundUser = result.rows[0];
            if (!foundUser) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
            if (!foundUser.email) return res.status(400).json({ success: false, message: "Este usuario no tiene correo registrado." });

            const transporter = nodemailer.createTransport({
                service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const tempPass = Math.random().toString(36).slice(-8);
            const hashPass = await bcrypt.hash(tempPass, 10);
            await db.execute("UPDATE usuarios SET password = ? WHERE id = ?", [hashPass, foundUser.id]);

            await transporter.sendMail({
                from: process.env.EMAIL_USER, to: foundUser.email,
                subject: 'Recuperación - Parqueadero Elimar',
                html: `<div style="font-family: Arial; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2>Hola ${foundUser.nombre},</h2><p>Tu contraseña temporal es:</p>
                    <p style="background: #f1f5f9; padding: 10px; font-size: 18px; font-weight: bold; display: inline-block; border-radius: 4px;">${tempPass}</p>
                    <p style="color: #666;">Cámbiala al iniciar sesión.</p></div>`
            });

            return res.status(200).json({ success: true, message: "Contraseña temporal enviada a tu correo." });
        }

        return res.status(405).json({ error: "Método no permitido" });
    } catch (error) {
        console.error("Error Auth:", error.message);
        return res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
}