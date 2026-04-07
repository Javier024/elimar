import { db } from "./db.js";

async function isPlateAvailable(plate, currentSpotId = null) {
    const plateSafe = `"${plate}"`; 
    const officialCheck = await db.execute({
        sql: `SELECT p.id FROM puestos p 
               JOIN clientes c ON p.cliente_id = c.id 
               WHERE p.estado = 'ocupado' AND c.placa = ? AND p.id != ?`,
        args: [plate, currentSpotId || -1]
    });
    if (officialCheck.rows.length > 0) return false;

    const visitorCheck = await db.execute({
        sql: `SELECT id FROM puestos 
               WHERE estado = 'ocupado' 
               AND llave_caracteristicas LIKE ? 
               AND id != ?`,
        args: [`%"placa":"${plate}"%`, currentSpotId || -1]
    });
    return visitorCheck.rows.length === 0;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const result = await db.execute(`
        SELECT p.*, 
               c.nombre as cliente_nombre, 
               c.placa as cliente_placa, 
               c.telefono as cliente_telefono,
               c.cuota_mensual,
               c.tipo_vehiculo as cliente_tipo_vehiculo
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
      if (existe.rows.length > 0) return res.status(400).json({ error: "Número existe" });
      await db.execute({ sql: `INSERT INTO puestos (numero, estado, puesto_info, llave_caracteristicas) VALUES (?, 'libre', '{}', '{}')`, args: [numero] });
      return res.status(200).json({ success: true, message: "Puesto creado" });
    }

    if (req.method === "PUT") {
      const { id, accion, llave_info, temp_name, temp_plate, spot_id_selected, nuevo_numero, nombre, placa, cliente_id } = req.body;
      const targetId = id || spot_id_selected;

      if (!targetId && accion !== 'editar_numero') return res.status(400).json({ error: "ID del puesto requerido" });

      const now = Math.floor(Date.now() / 1000);

      // --- 0. RESERVAR ---
      if (accion === "reservar") {
          const llaveData = {
              reservation: { nombre: nombre, placa: placa || '', fecha: now }
          };
          await db.execute({ 
              sql: `UPDATE puestos SET estado = 'reservado', llave_caracteristicas = ? WHERE id = ?`, 
              args: [JSON.stringify(llaveData), targetId] 
          });
          return res.status(200).json({ success: true, message: "Reserva creada" });
      }

      // --- 1. OCUPAR RESERVA (Con opción de asignar cliente) ---
      if (accion === "ocupar_reserva") {
        const spotCheck = await db.execute({ sql: "SELECT * FROM puestos WHERE id = ?", args: [targetId] });
        if (spotCheck.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotCheck.rows[0];
        if (s.estado !== 'reservado') return res.status(400).json({ error: "El puesto no está en estado reservado" });
        
        if (cliente_id) {
            const cliente = (await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] })).rows[0];
            if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
            if (!(await isPlateAvailable(cliente.placa, targetId))) return res.status(400).json({ error: `La placa ${cliente.placa} ya está en otro puesto.` });
            
            await db.execute({ 
                sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = '{}' WHERE id = ?`, 
                args: [cliente_id, now, targetId] 
            });
            await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, args: ['ingreso', cliente.placa, targetId, now, new Date().toISOString().split("T")[0]] });
            return res.status(200).json({ success: true, message: "Cliente asignado desde reserva." });
        }
        
        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'ocupado', hora_inicio = ? WHERE id = ?`, 
            args: [now, targetId] 
        });
        return res.status(200).json({ success: true, message: "Reserva ocupada y hora registrada." });
      }

      // --- 2. EDITAR NUMERO ---
      if (accion === "editar_numero") {
          if (!targetId || !nuevo_numero) return res.status(400).json({ error: "ID y nuevo número requeridos" });
          const existe = await db.execute({ sql: "SELECT id FROM puestos WHERE numero = ? AND id != ?", args: [nuevo_numero, targetId] });
          if (existe.rows.length > 0) return res.status(400).json({ error: "El número ya está en uso" });
          await db.execute({ sql: "UPDATE puestos SET numero = ? WHERE id = ?", args: [nuevo_numero, targetId] });
          return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      // --- 3. SALIDA OFICIAL (Salir y Cobrar → TOTALLY LIBRE) ---
      if (accion === "salida_oficial") {
        const spotActual = await db.execute({ sql: `SELECT p.*, c.nombre, c.placa, c.telefono FROM puestos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`, args: [targetId] });
        if (spotActual.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotActual.rows[0];
        
        // Limpia TODO el puesto
        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, puesto_info = '{}', llave_caracteristicas = '{}' WHERE id = ?`, 
            args: [targetId] 
        });
        
        try { 
            await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, exit, date) VALUES (?, ?, ?, ?, ?, ?)`, args: ['salida', s.placa || '---', s.numero, s.hora_inicio || now, now, new Date().toISOString().split("T")[0]] }); 
        } catch(e) { console.error("Historial error:", e); }
        return res.status(200).json({ success: true, message: "Salida registrada." });
      }

      // --- 4. SALIDA DE VIAJE (Guarda datos del dueño) ---
      if (accion === "salida_viaje") {
        const spotActual = await db.execute({ 
            sql: `SELECT p.*, c.nombre, c.placa, c.telefono FROM puestos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`, 
            args: [targetId] 
        });
        if (spotActual.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotActual.rows[0];
        
        // Guardar info del dueño con fecha de salida
        const ownerInfo = {
            nombre: s.nombre || 'Desconocido',
            placa: s.placa || '---',
            telefono: s.telefono || '',
            cliente_id: s.cliente_id,
            fecha_salida: now
        };
        
        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, puesto_info = ?, llave_caracteristicas = '{}' WHERE id = ?`, 
            args: [JSON.stringify(ownerInfo), targetId] 
        });
        
        try { 
            await db.execute({ 
                sql: `INSERT INTO historial (type, plate, spot, entry, exit, date) VALUES (?, ?, ?, ?, ?, ?)`, 
                args: ['salida_viaje', s.placa || '---', s.numero, s.hora_inicio || now, now, new Date().toISOString().split("T")[0]] 
            }); 
        } catch(e) { console.error("Historial error:", e); }
        
        return res.status(200).json({ success: true, message: "Salida de viaje registrada. Puesto disponible para visitante." });
      }

      // --- 5. RESTAURAR DUEÑO (Con contador de días) ---
      if (accion === "restaurar_dueno") {
        const s = (await db.execute({ sql: "SELECT * FROM puestos WHERE id = ?", args: [targetId] })).rows[0];
        const owner = JSON.parse(s.puesto_info || '{}');
        if (!owner.nombre) return res.status(400).json({ error: "No hay dueño guardado" });
        
        // Calcular días fuera
        let diasFuera = 0;
        if (owner.fecha_salida) {
            const diffSegundos = now - Number(owner.fecha_salida);
            diasFuera = Math.max(0, Math.floor(diffSegundos / 86400));
        }
        
        // Actualizar info del dueño con fecha de regreso y días fuera
        owner.fecha_regreso = now;
        owner.ultima_estadia_fuera = diasFuera;
        
        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = '{}', puesto_info = ? WHERE id = ?`, 
            args: [owner.cliente_id || null, now, JSON.stringify(owner), targetId] 
        });
        
        try {
            await db.execute({ 
                sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, 
                args: ['regreso_dueno', owner.placa || '---', targetId, now, new Date().toISOString().split("T")[0]] 
            });
        } catch(e) {}
        
        return res.status(200).json({ 
            success: true, 
            message: diasFuera > 0 
                ? `${owner.nombre} restaurado. Estuvo fuera ${diasFuera} día(s).` 
                : `${owner.nombre} restaurado.`,
            dias_fuera: diasFuera 
        });
      }

      // --- 6. ASIGNAR VISITANTE ---
      if (accion === "asignar_visitante") {
        let nombre = temp_name;
        let placa = temp_plate;
        let telefono = "";
        if (cliente_id) {
            const client = (await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] })).rows[0];
            if (client) { nombre = client.nombre; placa = client.placa; telefono = client.telefono || ''; }
        }
        if (!nombre || !placa) return res.status(400).json({ error: "Nombre y Placa son requeridos" });
        if (!(await isPlateAvailable(placa, targetId))) return res.status(400).json({ error: `La placa ${placa.toUpperCase()} ya está en otro puesto.` });
        if (spot_id_selected && spot_id_selected != targetId) {
             await db.execute(`UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, [spot_id_selected]);
        }
        const llaveData = {
            temp_user: { nombre, placa: placa.toUpperCase(), telefono: telefono, fecha_ingreso: now }, 
            llave: llave_info || { tiene: false, desc: "" } 
        };
        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'ocupado', llave_caracteristicas = ?, hora_inicio = ? WHERE id = ?`, 
            args: [JSON.stringify(llaveData), now, targetId] 
        });
        await db.execute({ 
            sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, 
            args: ['ingreso_visitante', placa.toUpperCase(), targetId, now, new Date().toISOString().split("T")[0]] 
        });
        return res.status(200).json({ success: true, message: "Ingreso registrado" });
      }

      // --- 7. ASIGNAR REGISTRADO ---
      if (accion === "asignar_registrado") {
        if (!cliente_id) return res.status(400).json({ error: "Cliente requerido" });
        const cliente = (await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] })).rows[0];
        if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
        if (!(await isPlateAvailable(cliente.placa, targetId))) return res.status(400).json({ error: `El cliente ${cliente.nombre} ya está en puesto.` });
        await db.execute({ 
            sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = '{}' WHERE id = ?`, 
            args: [cliente_id, now, targetId] 
        });
        await db.execute({ 
            sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, 
            args: ['ingreso', cliente.placa, targetId, now, new Date().toISOString().split("T")[0]] 
        });
        return res.status(200).json({ success: true, message: "Cliente asignado" });
      }

      // --- 8. SALIDA VISITANTE (Preserva dueño si existe) ---
      if (accion === "salir_visitante") {
        const spot = (await db.execute({ sql: "SELECT puesto_info FROM puestos WHERE id = ?", args: [targetId] })).rows[0];
        const owner = JSON.parse(spot.puesto_info || '{}');
        
        if (owner.nombre) {
            // Hay dueño guardado: limpiar visitante pero mantener dueño
            await db.execute({ 
                sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, 
                args: [targetId] 
            });
        } else {
            // No hay dueño: limpiar todo
            await db.execute({ 
                sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}', puesto_info = '{}' WHERE id = ?`, 
                args: [targetId] 
            });
        }
        return res.status(200).json({ success: true, message: "Liberado" });
      }
      
      return res.status(200).json({ success: true });
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