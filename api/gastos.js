import { db } from "./db.js"
import { logToHistory } from "./historial.js" // Importamos el logger

export default async function handler(req, res){
  try{
    if(req.method === "GET"){
      const result = await db.execute("SELECT * FROM gastos ORDER BY id DESC")
      return res.status(200).json(result.rows)
    }
    if(req.method === "POST"){
      const { concept, category, amount, date } = req.body
      if(!concept || !amount){ return res.status(400).json({ error:"Concepto y monto son obligatorios" }) }
      
      // Insertar en Gastos
      await db.execute({
        sql:`INSERT INTO gastos (concept, category, amount, date) VALUES (?,?,?,?)`,
        args:[concept, category || "General", amount, date || new Date().toISOString().split("T")[0]]
      })

      // --- NUEVO: REGISTRAR EN HISTORIAL GLOBAL ---
      await logToHistory(
          'GASTO', 
          concept, 
          amount, 
          "---"
      );

      return res.status(200).json({ success:true })
    }
    if(req.method === "PUT"){
      const { id, concept, category, amount, date } = req.body
      if(!id){ return res.status(400).json({ error:"ID requerido" }) }
      await db.execute({
        sql:`UPDATE gastos SET concept=?, category=?, amount=?, date=? WHERE id=?`,
        args:[concept, category, amount, date, id]
      })
      return res.status(200).json({ success:true })
    }
    if(req.method === "DELETE"){
      const { id } = req.query
      if(!id){ return res.status(400).json({ error:"ID requerido" }) }
      await db.execute({ sql:"DELETE FROM gastos WHERE id=?", args:[id] })
      return res.status(200).json({ success:true })
    }
    return res.status(405).json({ error:"Metodo no permitido" })
  }catch(error){
    console.error("ERROR API GASTOS:",error)
    return res.status(500).json({ error:"Error interno del servidor", detail:error.message })
  }
}