import { db } from "./db.js"

export default async function handler(req, res) {
  try {
    
    // =========================================
    // GET: OBTENER CONFIGURACIÓN ACTUAL
    // =========================================
    if (req.method === "GET") {
      // Buscamos siempre el registro ID 1
      const result = await db.execute(
        `SELECT * FROM configuracion WHERE id = 1`
      )
      
      // Si no hay filas (primera vez), devolvemos null
      // El frontend manejará los valores por defecto
      if (result.rows.length === 0) {
        return res.status(200).json(null)
      }
      
      return res.status(200).json(result.rows[0])
    }

    // =========================================
    // PUT: GUARDAR O ACTUALIZAR CONFIGURACIÓN
    // =========================================
    if (req.method === "PUT") {
      const body = req.body

      // Usamos INSERT OR REPLACE para simplificar:
      // Si ID=1 existe -> Actualiza.
      // Si ID=1 no existe -> Crea nuevo con ID=1.
      await db.execute({
        sql: `
          INSERT OR REPLACE INTO configuracion 
          (id, nombre, nit, direccion, telefono,
           tarifa_carro_hora, tarifa_carro_noche, tarifa_carro_semana, tarifa_carro_quincena, tarifa_carro_mes,
           tarifa_moto_hora, tarifa_moto_noche, tarifa_moto_semana, tarifa_moto_quincena, tarifa_moto_mes,
           tarifa_bici_hora, tarifa_bici_noche, tarifa_bici_semana, tarifa_bici_quincena, tarifa_bici_mes,
           admin_nombre, admin_email, admin_notif)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,
        args: [
          1, // ID Fijo
          // General
          body.nombre,
          body.nit,
          body.direccion,
          body.telefono,
          // Carros
          body.tarifa_carro_hora, 
          body.tarifa_carro_noche, 
          body.tarifa_carro_semana, 
          body.tarifa_carro_quincena, 
          body.tarifa_carro_mes,
          // Motos
          body.tarifa_moto_hora, 
          body.tarifa_moto_noche, 
          body.tarifa_moto_semana, 
          body.tarifa_moto_quincena, 
          body.tarifa_moto_mes,
          // Bicis
          body.tarifa_bici_hora, 
          body.tarifa_bici_noche, 
          body.tarifa_bici_semana, 
          body.tarifa_bici_quincena, 
          body.tarifa_bici_mes,
          // Admin
          body.admin_nombre, 
          body.admin_email, 
          body.admin_notif ? 1 : 0 // Convertir boolean a 0 o 1 para SQLite
        ]
      })

      return res.status(200).json({ success: true, message: "Configuración guardada" })
    }

    // Si intentan usar otro método (POST, DELETE)
    return res.status(405).json({ error: "Método no permitido" })

  } catch (error) {
    console.error("ERROR API CONFIGURACION:", error)
    return res.status(500).json({ error: "Error interno del servidor" })
  }
}