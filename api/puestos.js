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

    // 2. Buscar en Nocturnos (dentro del JSON llave_caracteristicas)
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
      // Al crear, hora_inicio es NULL (vacío)
      await db.execute({ sql: `INSERT INTO puestos (numero, estado, puesto_info, llave_caracteristicas) VALUES (?, 'libre', '{}', '{}')`, args: [numero] });
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    if (req.method === "PUT") {
      const { id, accion, llave_info, temp_name, temp_plate, spot_id_selected, cliente_id: nocturno_cliente_id, nuevo_numero } = req.body;
      const targetId = id || spot_id_selected;

      if (!targetId && accion !== 'editar_numero') return res.status(400).json({ error: "ID del puesto requerido" });

      const now = Math.floor(Date.now() / 1000); // Fecha Unix actual

      // --- 0. OCUPAR RESERVA ---
      // Aquí guardamos la hora_inicio porque el cliente acaba de llegar.
      if (accion === "ocupar_reserva") {
        const spotCheck = await db.execute({ sql: "SELECT * FROM puestos WHERE id = ?", args: [targetId] });
        if (spotCheck.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotCheck.rows[0];
        if (s.estado !== 'reservado') return res.status(400).json({ error: "El puesto no está en estado reservado" });

        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'ocupado', hora_inicio = ? WHERE id = ?`, 
            args: [now, targetId] 
        });
        return res.status(200).json({ success: true, message: "Reserva ocupada y hora registrada." });
      }

      // --- 1. EDITAR NUMERO ---
      if (accion === "editar_numero") {
          if (!targetId || !nuevo_numero) return res.status(400).json({ error: "ID y nuevo número requeridos" });
          const existe = await db.execute({ sql: "SELECT id FROM puestos WHERE numero = ? AND id != ?", args: [nuevo_numero, targetId] });
          if (existe.rows.length > 0) return res.status(400).json({ error: "El número ya está en uso" });
          await db.execute({ sql: "UPDATE puestos SET numero = ? WHERE id = ?", args: [nuevo_numero, targetId] });
          return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // --- 2. SALIDA OFICIAL ---
      if (accion === "salida_oficial") {
        const spotActual = await db.execute({ sql: `SELECT p.*, c.nombre, c.placa, c.telefono FROM puestos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`, args: [targetId] });
        if (spotActual.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotActual.rows[0];
        let ownerInfo = {};
        if (s.cliente_id && s.nombre) ownerInfo = { nombre: s.nombre, placa: s.placa, telefono: s.telefono || '' };

        // Al salir, borramos hora_inicio (ponemos NULL)
        await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, puesto_info = ?, llave_caracteristicas = '{}' WHERE id = ?`, args: [JSON.stringify(ownerInfo), targetId] });
        
        try {
            await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, exit, date) VALUES (?, ?, ?, ?, ?, ?)`, args: ['salida', s.placa || '---', s.numero, s.hora_inicio || now, now, new Date().toISOString().split("T")[0]] });
        } catch(e) { console.error("Historial error:", e); }
        return res.status(200).json({ success: true, message: "Salida registrada." });
      }

      // --- 3. RESTAURAR DUEÑO ---
      if (accion === "restaurar_dueno") {
        const s = (await db.execute({ sql: "SELECT * FROM puestos WHERE id = ?", args: [targetId] })).rows[0];
        const owner = JSON.parse(s.puesto_info || '{}');
        if(!owner.nombre) return res.status(400).json({ error: "No hay dueño guardado" });
        
        // Al restaurar, asumimos que el dueño llega "ahora", así que actualizamos hora_inicio
        await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = NULL, hora_inicio = ?, llave_caracteristicas = '{}' WHERE id = ?`, args: [now, targetId] });
        return res.status(200).json({ success: true, message: "Dueño restaurado" });
      }

      // --- 4. ASIGNAR NOCTURNO (VISITANTE) ---
      if (accion === "asignar_nocturno") {
        let nombre = temp_name;
        let placa = temp_plate;
        let telefono = "";
        if (nocturno_cliente_id) {
            const clientRes = await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [nocturno_cliente_id] });
            const client = clientRes.rows[0];
            if (client) { nombre = client.nombre; placa = client.placa; telefono = client.telefono || ''; }
        }
        if (!nombre || !placa) return res.status(400).json({ error: "Nombre y Placa son requeridos" });
        if (!(await isPlateAvailable(placa, targetId))) return res.status(400).json({ error: `La placa ${placa.toUpperCase()} ya está en otro puesto.` });
        if (spot_id_selected && spot_id_selected != targetId) {
             await db.execute(`UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, [spot_id_selected]);
        }
        const llaveData = {
            temp_user: { nombre: nombre, placa: placa.toUpperCase(), telefono: telefono, fecha_ingreso: now },
            llave: llave_info || { tiene: false, desc: "" }
        };
        // Guardamos hora_inicio
        await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', llave_caracteristicas = ?, hora_inicio = ? WHERE id = ?`, args: [JSON.stringify(llaveData), now, targetId] });
        await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, args: ['ingreso_nocturno', placa.toUpperCase(), targetId, now, new Date().toISOString().split("T")[0]] });
        return res.status(200).json({ success: true, message: "Ingreso registrado" });
      }

      // --- 5. ASIGNAR REGISTRADO (OFICIAL) ---
      if (accion === "asignar_registrado") {
        const { cliente_id } = req.body;
        if (!cliente_id) return res.status(400).json({ error: "Cliente requerido" });
        const cRes = await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] });
        const cliente = cRes.rows[0];
        if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
        if (!(await isPlateAvailable(cliente.placa, targetId))) return res.status(400).json({ error: `El cliente ${cliente.nombre} ya está en otro puesto.` });
        
        // Guardamos hora_inicio
        await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = '{}' WHERE id = ?`, args: [cliente_id, now, targetId] });
        await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, args: ['ingreso', cliente.placa, targetId, now, new Date().toISOString().split("T")[0]] });
        return res.status(200).json({ success: true, message: "Cliente asignado" });
      }

      // --- 6. SALIDA NOCTURNO ---
      if (accion === "salir_nocturno") {
        const s = (await db.execute({ sql: "SELECT puesto_info FROM puestos WHERE id = ?", args: [targetId] })).rows[0];
        const owner = JSON.parse(s.puesto_info || '{}');
        if (owner.nombre) {
            await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, args: [targetId] });
        } else {
            await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}', puesto_info = '{}' WHERE id = ?`, args: [targetId] });
        }
        return res.status(200).json({ success: true, message: "Liberado" });
      }
      
      // --- 7. LIMPIAR ---
      if (accion === "limpiar") {
        await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, args: [targetId] });
        return res.status(200).json({ success: true, message: "Limpio" });
      }
      return res.status(200).json({ success: true, message: "Acción realizada" });
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "ID requerido" });
      await db.execute({ sql: "DELETE FROM puestos WHERE id = ?", args: [id] });
      return res.status(200).json({ success: true, message: "Eliminado" });
    }
    
    if (req.method === "PATCH") {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: "ID requerido" });
        await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, puesto_info = '{}', llave_caracteristicas = '{}', hora_inicio = NULL WHERE id = ?`, args: [id] });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Método no permitido" });
  } catch (error) {
    console.error("ERROR API:", error);
    return res.status(500).json({ error: "Error interno", detalle: error.message });
  }
}