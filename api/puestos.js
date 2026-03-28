import { db } from "./db.js";

// --- FUNCIÓN AUXILIAR: VERIFICAR DISPONIBILIDAD DE PLACA ---
async function isPlateAvailable(plate, currentSpotId = null) {
    // 1. Buscar en Clientes Oficiales
    const officialCheck = await db.execute({
        sql: `SELECT p.id FROM puestos p 
               JOIN clientes c ON p.cliente_id = c.id 
               WHERE p.estado = 'ocupado' AND c.placa = ? AND p.id != ?`,
        args: [plate, currentSpotId || -1]
    });
    if (officialCheck.rows.length > 0) return false;

    // 2. Buscar en Nocturnos (Dentro del JSON llave_caracteristicas)
    const nocturnalCheck = await db.execute({
        sql: `SELECT id FROM puestos 
               WHERE estado = 'ocupado' 
               AND llave_caracteristicas LIKE ? 
               AND id != ?`,
        args: [`%"placa":"${plate}"%`, currentSpotId || -1]
    });

    return nocturnalCheck.rows.length === 0;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await db.execute(`
        SELECT p.*, 
               c.nombre as cliente_nombre, 
               c.placa as cliente_placa, 
               c.telefono as cliente_telefono,
               c.cuota_mensual
        FROM puestos p 
        LEFT JOIN clientes c ON p.cliente_id = c.id 
        ORDER BY CAST(p.numero AS INTEGER) ASC
      `);
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      const { numero } = req.body;
      if (!numero) return res.status(400).json({ error: "Número requerido" });
      
      const existe = await db.execute({ sql: "SELECT id FROM puestos WHERE numero = ?", args: [numero] });
      if (existe.rows.length > 0) return res.status(400).json({ error: "El número de puesto ya existe" });

      await db.execute({
        sql: `INSERT INTO puestos (numero, estado, puesto_info, llave_caracteristicas) VALUES (?, 'libre', '{}', '{}')`,
        args: [numero]
      });
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    if (req.method === "PUT") {
      const { id, accion, llave_info, temp_name, temp_plate, spot_id_selected, cliente_id: nocturno_cliente_id } = req.body;

      if (!id) return res.status(400).json({ error: "ID requerido" });

      // --- 1. SALIDA OFICIAL ---
      if (accion === "salida_oficial") {
        const spotActual = await db.execute({ 
            sql: `SELECT p.*, c.nombre, c.placa, c.telefono 
                   FROM puestos p 
                   LEFT JOIN clientes c ON p.cliente_id = c.id 
                   WHERE p.id = ?`, 
            args: [id] 
        });

        if (spotActual.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotActual.rows[0];

        let ownerInfo = {};
        if (s.cliente_id && s.nombre) {
            ownerInfo = {
                nombre: s.nombre,
                placa: s.placa,
                telefono: s.telefono || ''
            };
        }

        await db.execute({
            sql: `UPDATE puestos 
                SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL,
                    puesto_info = ?, llave_caracteristicas = '{}'
                WHERE id = ?`,
            args: [JSON.stringify(ownerInfo), id]
        });

        try {
            await db.execute({
                sql: `INSERT INTO historial (type, plate, spot, entry, exit, date) VALUES (?, ?, ?, ?, ?, ?)`,
                args: ['salida', s.placa || '---', s.numero, s.hora_inicio || Math.floor(Date.now()/1000), Math.floor(Date.now()/1000), new Date().toISOString().split("T")[0]]
            });
        } catch(e) { console.error("Historial error:", e); }

        return res.status(200).json({ success: true, message: "Salida registrada." });
      }

      // --- 2. RESTAURAR DUEÑO ---
      if (accion === "restaurar_dueno") {
        const s = (await db.execute({ sql: "SELECT * FROM puestos WHERE id = ?", args: [id] })).rows[0];
        const owner = JSON.parse(s.puesto_info || '{}');
        if(!owner.nombre) return res.status(400).json({ error: "No hay dueño guardado" });

        await db.execute({
          sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = NULL, hora_inicio = ?, llave_caracteristicas = '{}' WHERE id = ?`,
          args: [Math.floor(Date.now() / 1000), id]
        });
        return res.status(200).json({ success: true, message: "Dueño restaurado" });
      }

      // --- 3. ASIGNAR NOCTURNO ---
      if (accion === "asignar_nocturno") {
        let nombre = temp_name;
        let placa = temp_plate;
        let telefono = "";

        if (nocturno_cliente_id) {
            const clientRes = await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [nocturno_cliente_id] });
            const client = clientRes.rows[0];
            if (client) {
                nombre = client.nombre;
                placa = client.placa;
                telefono = client.telefono || '';
            }
        }

        if (!nombre || !placa) return res.status(400).json({ error: "Nombre y Placa son requeridos" });

        const disponible = await isPlateAvailable(placa, id);
        if (!disponible) return res.status(400).json({ error: `La placa ${placa.toUpperCase()} ya está en otro puesto.` });

        if (spot_id_selected) {
             await db.execute(`UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, [spot_id_selected]);
        }

        const llaveData = {
            temp_user: {
                nombre: nombre,
                placa: placa.toUpperCase(),
                telefono: telefono,
                fecha_ingreso: Math.floor(Date.now() / 1000)
            },
            llave: llave_info || { tiene: false, desc: "" }
        };

        await db.execute({
            sql: `UPDATE puestos SET estado = 'ocupado', llave_caracteristicas = ?, hora_inicio = ? WHERE id = ?`,
            args: [JSON.stringify(llaveData), Math.floor(Date.now() / 1000), id]
        });

        await db.execute({
            sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`,
            args: ['ingreso_nocturno', placa.toUpperCase(), id, Math.floor(Date.now()/1000), new Date().toISOString().split("T")[0]]
        });

        return res.status(200).json({ success: true, message: "Nocturno ingresado" });
      }

      // --- 4. ASIGNAR REGISTRADO ---
      if (accion === "asignar_registrado") {
        const { cliente_id } = req.body;
        if (!cliente_id) return res.status(400).json({ error: "Cliente requerido" });
        
        const cRes = await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] });
        const cliente = cRes.rows[0];
        if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

        const disponible = await isPlateAvailable(cliente.placa, id);
        if (!disponible) return res.status(400).json({ error: `El cliente ${cliente.nombre} (Placa: ${cliente.placa}) ya está en otro puesto.` });

        await db.execute({
          sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = '{}' WHERE id = ?`,
          args: [cliente_id, Math.floor(Date.now() / 1000), id]
        });

        await db.execute({
            sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`,
            args: ['ingreso', cliente.placa, id, Math.floor(Date.now()/1000), new Date().toISOString().split("T")[0]]
        });

        return res.status(200).json({ success: true, message: "Cliente asignado" });
      }
      
      // --- 5. LIMPIAR ---
      if (accion === "limpiar") {
        await db.execute({
          sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`,
          args: [id]
        });
        return res.status(200).json({ success: true, message: "Puesto limpiado" });
      }

      return res.status(200).json({ success: true, message: "Acción realizada" });
    }

    // --- DELETE: ELIMINACIÓN FORZADA (Aquí está la lógica del botón eliminar) ---
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });
      
      await db.execute({ sql: "DELETE FROM puestos WHERE id = ?", args: [id] });
      return res.status(200).json({ success: true, message: "Puesto eliminado permanentemente" });
    }
    
    if (req.method === "PATCH") {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: "ID requerido" });
        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, puesto_info = '{}', llave_caracteristicas = '{}', hora_inicio = NULL WHERE id = ?`, 
            args: [id] 
        });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("ERROR API PUESTOS:", error);
    return res.status(500).json({ error: "Error interno", detalle: error.message });
  }
}