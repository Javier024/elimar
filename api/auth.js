// parqueo/api/auth.js
import { db } from "./db.js";

export default async function handler(req, res) {
  try {
    // --- POST: LOGIN ---
    if (req.method === "POST" && !req.query.action) {
      const { user, pass } = req.body;

      if (!user || !pass) {
        return res.status(400).json({ success: false, message: "Usuario y contraseña requeridos" });
      }

      // Buscar en la nueva tabla USUARIOS
      const result = await db.execute("SELECT * FROM usuarios WHERE usuario = ?", [user]);
      
      // Verificar si existe el usuario y si la contraseña coincide
      const foundUser = result.rows[0];

      if (foundUser && foundUser.password === pass) {
        return res.status(200).json({ 
          success: true, 
          user: { 
            id: foundUser.id,
            nombre: foundUser.nombre || 'Usuario', 
            email: foundUser.email || '' 
          }
        });
      }

      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    // --- POST: RECUPERAR CONTRASEÑA ---
    if (req.method === "POST" && req.query.action === "recover") {
      const { user } = req.body;
      
      if (!user) {
        return res.status(400).json({ success: false, message: "El campo usuario es requerido" });
      }

      // Buscar si el usuario existe en la tabla usuarios
      const result = await db.execute("SELECT * FROM usuarios WHERE usuario = ?", [user]);
      const foundUser = result.rows[0];

      if (!foundUser) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      // OPCIÓN A: Buscar teléfono en la tabla CONFIGURACIÓN (como respaldo global)
      // OPCIÓN B: Agregar campo 'telefono' a la tabla usuarios.
      // Por compatibilidad con tu código anterior, seguiremos usando el teléfono de 'configuración'
      
      const configResult = await db.execute("SELECT * FROM configuracion WHERE id = 1");
      const adminConfig = configResult.rows[0];
      
      // Si no hay configuración ni teléfono, error
      if (!adminConfig || !adminConfig.telefono) {
         return res.status(400).json({ success: false, message: "No hay un teléfono de contacto configurado." });
      }

      const phone = adminConfig.telefono;
      const mensaje = `Hola ${foundUser.nombre}. 👋\n\nSoy el usuario: *${user}*.\n\nHe olvidado mi contraseña del sistema ParkingSys y necesito ayuda para restablecerla.`;
      
      const cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`;

      return res.status(200).json({ 
        success: true, 
        whatsappUrl: whatsappUrl,
        hint: "Redirigiendo a WhatsApp para contactar al administrador..."
      });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("Error Auth:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}