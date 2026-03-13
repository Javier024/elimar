import { db } from "./db";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const { username, password } = req.body;

  const result = await db.execute({
    sql: "SELECT * FROM usuarios WHERE username=?",
    args: [username]
  });

  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: "Usuario no existe" });
  }

  if (user.password !== password) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }

  res.json({
    success: true,
    user: user.username
  });
}