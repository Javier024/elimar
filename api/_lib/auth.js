import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'elimar_super_secret_key_2024';

export function generateToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ 
        id: user.id, 
        nombre: user.nombre, 
        rol: user.rol,
        exp: Date.now() + (15 * 60 * 1000) // Expira en 15 minutos
    })).toString('base64url');
    
    const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
    if (!token) return null;
    try {
        const [header, body, signature] = token.split('.');
        const expectedSig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
        
        if (signature !== expectedSig) return null; // Token manipulado
        
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (payload.exp < Date.now()) return null; // Token expirado
        
        return payload;
    } catch (e) {
        return null;
    }
}

// Middleware para proteger las APIs
export function authGuard(req, res) {
    const token = req.headers['x-session-token'];
    const user = verifyToken(token);
    
    if (!user) {
        return res.status(401).json({ error: "No autorizado. Inicia sesión de nuevo." });
    }
    return user; // Devuelve los datos del usuario para usarlos en la API si se necesita
}