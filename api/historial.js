import { db } from "./db"

export default async function handler(req,res){

try{

// =================================
// GET → LISTAR HISTORIAL
// =================================

if(req.method==="GET"){

const result = await db.execute(
`SELECT * FROM historial
ORDER BY id DESC`
)

return res.json(result.rows)

}


// =================================
// POST → REGISTRAR ENTRADA
// =================================

if(req.method==="POST"){

const { plate, type, spot } = req.body

const now = new Date()

const date = now.toISOString().split("T")[0]

const entry = now.toLocaleTimeString("es-ES",{
hour:"2-digit",
minute:"2-digit"
})

await db.execute({

sql:`INSERT INTO historial
(date,entry,plate,type,spot,paid)
VALUES (?,?,?,?,?,?)`,

args:[
date,
entry,
plate,
type,
spot,
0
]

})

return res.json({
success:true
})

}


// =================================
// PUT → REGISTRAR SALIDA
// =================================

if(req.method==="PUT"){

const { id, paid } = req.body

const now = new Date()

const exit = now.toLocaleTimeString("es-ES",{
hour:"2-digit",
minute:"2-digit"
})

await db.execute({

sql:`UPDATE historial
SET exit=?,
paid=?
WHERE id=?`,

args:[
exit,
paid,
id
]

})

return res.json({
success:true
})

}


// =================================

return res.status(405).json({
error:"Metodo no permitido"
})

}catch(error){

console.error("ERROR API HISTORIAL:",error)

return res.status(500).json({
error:"Error servidor"
})

}

}