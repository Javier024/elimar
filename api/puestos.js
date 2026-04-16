// parqueo/api/puestos.js
import { db } from "./db.js";
import { authGuard } from "./_lib/auth.js";

async function isPlateAvailable(plate, currentSpotId = null) {
    const cleanPlate = plate.trim();
    if (!cleanPlate) return true;

    // Buscar en clientes oficiales
    const officialCheck = await db.execute({
        sql: `SELECT p.id FROM puestos p 
               JOIN clientes c ON p.cliente_id = c.id 
               WHERE p.estado = 'ocupado' AND c.placa = ? AND p.id != ?`,
        args: [cleanPlate, currentSpotId || -1]
    });
    if (officialCheck.rows.length > 0) return false;

    // Buscar en visitantes - MEJORADO: Usar JSON en vez de LIKE
    const allSpots = await db.execute({
        sql: `SELECT id, llave_caracteristicas FROM puestos WHERE estado = 'ocupado' AND id != ?`,
        args: [currentSpotId || -1]
    });

    for (const spot of allSpots.rows) {
        try {
            const meta = JSON.parse(spot.llave_caracteristicas || '{}');
            if (meta.temp_user && meta.temp_user.placa) {
                // Comparación exacta, sin inyección SQL
                if (meta.temp_user.placa.trim().toUpperCase() === cleanPlate.toUpperCase()) {
                    return false;
                }
            }
        } catch(e) {
            // JSON inválido, ignorar
        }
    }

    return true;
}

export default async function handler(req, res) {
  try {
    const user = authGuard(req, res);
    if (!user) return;

    if (req.method === "GET") {
      // 1. Consulta principal (nunca falla)
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

      // 2. Últimos pagos por placa (columnas reales: plate, date, amount)
      var pagosMap = {};
      try {
        const pagos = await db.execute(`
          SELECT plate, date, amount 
          FROM caja c1
          WHERE c1.date = (SELECT MAX(c2.date) FROM caja c2 WHERE c2.plate = c1.plate)
            AND c1.plate IS NOT NULL AND c1.plate != ''
        `);
        pagos.rows.forEach(function(row) {
          var key = (row.plate || '').trim().toUpperCase();
          if (key) pagosMap[key] = { fecha: row.date, monto: row.amount };
        });
      } catch(e) {
        console.log("Info: No se pudo leer pagos:", e.message);
      }

      // 3. Asignar pago a cada puesto
      var rows = result.rows.map(function(row) {
        var key = (row.cliente_placa || '').trim().toUpperCase();
        if (pagosMap[key]) {
          row.ultimo_pago_fecha = pagosMap[key].fecha;
          row.ultimo_pago_monto = pagosMap[key].monto;
        } else {
          row.ultimo_pago_fecha = null;
          row.ultimo_pago_monto = null;
        }
        return row;
      });

      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const { numero, cantidad } = req.body;
      if (cantidad && Number(cantidad) > 0) {
        const count = Math.min(Number(cantidad), 500);
        const last = await db.execute({ sql: "SELECT numero FROM puestos ORDER BY CAST(numero AS INTEGER) DESC LIMIT 1", args: [] });
        let startNum = 1;
        if (last.rows.length > 0) {
          const parsed = parseInt(last.rows[0].numero);
          if (!isNaN(parsed)) startNum = parsed + 1;
        }
        let created = 0;
        for (let i = 0; i < count; i++) {
          const num = String(startNum + i);
          const existe = await db.execute({ sql: "SELECT id FROM puestos WHERE numero = ?", args: [num] });
          if (existe.rows.length === 0) {
            await db.execute({ sql: `INSERT INTO puestos (numero, estado, puesto_info, llave_caracteristicas) VALUES (?, 'libre', '{}', '{}')`, args: [num] });
            created++;
          }
        }
        return res.status(200).json({ success: true, message: `${created} puestos creados desde #${startNum}`, created });
      }
      if (!numero) return res.status(400).json({ error: "Número o cantidad requerido" });
      const numTrim = String(numero).trim();
      if (!numTrim) return res.status(400).json({ error: "Número vacío" });
      const existe = await db.execute({ sql: "SELECT id FROM puestos WHERE numero = ?", args: [numTrim] });
      if (existe.rows.length > 0) return res.status(400).json({ error: "El puesto #" + numTrim + " ya existe" });
      await db.execute({ sql: `INSERT INTO puestos (numero, estado, puesto_info, llave_caracteristicas) VALUES (?, 'libre', '{}', '{}')`, args: [numTrim] });
      return res.status(200).json({ success: true, message: "Puesto #" + numTrim + " creado correctamente" });
    }

    if (req.method === "PUT") {
      const { id, accion, llave_info, temp_name, temp_plate, spot_id_selected, nuevo_numero, nombre, placa, cliente_id, tipo_vehiculo } = req.body;
      const targetId = id || spot_id_selected;
      if (!targetId && accion !== 'editar_numero') return res.status(400).json({ error: "ID del puesto requerido" });
      const now = Math.floor(Date.now() / 1000);

      if (accion === "reservar") {
          const llaveData = { reservation: { nombre: nombre, placa: placa || '', fecha: now } };
          await db.execute({ sql: `UPDATE puestos SET estado = 'reservado', llave_caracteristicas = ? WHERE id = ?`, args: [JSON.stringify(llaveData), targetId] });
          return res.status(200).json({ success: true, message: "Reserva creada" });
      }

      if (accion === "ocupar_reserva") {
        const spotCheck = await db.execute({ sql: "SELECT * FROM puestos WHERE id = ?", args: [targetId] });
        if (spotCheck.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotCheck.rows[0];
        if (s.estado !== 'reservado') return res.status(400).json({ error: "El puesto no está en estado reservado" });
        var llaveDataReserva = {};
        if (llave_info && llave_info.tiene) { llaveDataReserva = { llave: llave_info }; }
        if (cliente_id) {
            const cliente = (await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] })).rows[0];
            if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
            if (!(await isPlateAvailable(cliente.placa, targetId))) return res.status(400).json({ error: `La placa ${cliente.placa} ya está en otro puesto.` });
            await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = ? WHERE id = ?`, args: [cliente_id, now, JSON.stringify(llaveDataReserva), targetId] });
            await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, args: ['ingreso', cliente.placa, targetId, now, new Date().toISOString().split("T")[0]] });
            return res.status(200).json({ success: true, message: "Cliente asignado desde reserva." });
        }
        await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', hora_inicio = ?, llave_caracteristicas = ? WHERE id = ?`, args: [now, JSON.stringify(llaveDataReserva), targetId] });
        return res.status(200).json({ success: true, message: "Reserva ocupada y hora registrada." });
      }

      if (accion === "editar_numero") {
          if (!targetId || !nuevo_numero) return res.status(400).json({ error: "ID y nuevo número requeridos" });
          const existe = await db.execute({ sql: "SELECT id FROM puestos WHERE numero = ? AND id != ?", args: [nuevo_numero, targetId] });
          if (existe.rows.length > 0) return res.status(400).json({ error: "El número ya está en uso" });
          await db.execute({ sql: "UPDATE puestos SET numero = ? WHERE id = ?", args: [nuevo_numero, targetId] });
          return res.status(200).json({ success: true, message: "Número actualizado" });
      }

      if (accion === "salida_oficial") {
        const spotActual = await db.execute({ sql: `SELECT p.*, c.nombre, c.placa, c.telefono FROM puestos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`, args: [targetId] });
        if (spotActual.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotActual.rows[0];
        var llaveSalida = {};
        try { llaveSalida = JSON.parse(s.llave_caracteristicas || '{}').llave || {}; } catch(e) {}
        await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, puesto_info = '{}', llave_caracteristicas = '{}' WHERE id = ?`, args: [targetId] });
        try { await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, exit, date) VALUES (?, ?, ?, ?, ?, ?)`, args: ['salida', s.placa || '---', s.numero, s.hora_inicio || now, now, new Date().toISOString().split("T")[0]] }); } catch(e) {}
        var msgSalida = "Salida registrada.";
        if (llaveSalida.tiene) msgSalida += " ⚠️ Recuerde entregar la llave.";
        return res.status(200).json({ success: true, message: msgSalida });
      }

      if (accion === "salida_viaje") {
        const spotActual = await db.execute({ sql: `SELECT p.*, c.nombre, c.placa, c.telefono FROM puestos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?`, args: [targetId] });
        if (spotActual.rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
        const s = spotActual.rows[0];
        const ownerInfo = { nombre: s.nombre || 'Desconocido', placa: s.placa || '---', telefono: s.telefono || '', cliente_id: s.cliente_id, fecha_salida: now };
        await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, puesto_info = ?, llave_caracteristicas = '{}' WHERE id = ?`, args: [JSON.stringify(ownerInfo), targetId] });
        try { await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, exit, date) VALUES (?, ?, ?, ?, ?, ?)`, args: ['salida_viaje', s.placa || '---', s.numero, s.hora_inicio || now, now, new Date().toISOString().split("T")[0]] }); } catch(e) {}
        return res.status(200).json({ success: true, message: "Salida de viaje registrada." });
      }

      if (accion === "restaurar_dueno") {
        const s = (await db.execute({ sql: "SELECT * FROM puestos WHERE id = ?", args: [targetId] })).rows[0];
        const owner = JSON.parse(s.puesto_info || '{}');
        if (!owner.nombre) return res.status(400).json({ error: "No hay dueño guardado" });
        let diasFuera = 0;
        if (owner.fecha_salida) { const diffSegundos = now - Number(owner.fecha_salida); diasFuera = Math.max(0, Math.floor(diffSegundos / 86400)); }
        owner.fecha_regreso = now;
        owner.ultima_estadia_fuera = diasFuera;
        await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = '{}', puesto_info = ? WHERE id = ?`, args: [owner.cliente_id || null, now, JSON.stringify(owner), targetId] });
        try { await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, args: ['regreso_dueno', owner.placa || '---', targetId, now, new Date().toISOString().split("T")[0]] }); } catch(e) {}
        return res.status(200).json({ success: true, message: diasFuera > 0 ? `${owner.nombre} restaurado. Estuvo fuera ${diasFuera} día(s).` : `${owner.nombre} restaurado.`, dias_fuera: diasFuera });
      }

      if (accion === "asignar_visitante") {
        let nombre = temp_name, placa = temp_plate, telefono = "", tipoVeh = tipo_vehiculo || 'Carro';
        if (cliente_id) {
            const client = (await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] })).rows[0];
            if (client) { nombre = client.nombre; placa = client.placa; telefono = client.telefono || ''; tipoVeh = client.tipo_vehiculo || 'Carro'; }
        }
        if (!nombre || !placa) return res.status(400).json({ error: "Nombre y Placa son requeridos" });
        if (!(await isPlateAvailable(placa, targetId))) return res.status(400).json({ error: `La placa ${placa.toUpperCase()} ya está en otro puesto.` });
        if (spot_id_selected && spot_id_selected != targetId) {
             await db.execute(`UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, [spot_id_selected]);
        }
        const llaveData = { temp_user: { nombre, placa: placa.toUpperCase(), telefono: telefono, tipo_vehiculo: tipoVeh, fecha_ingreso: now } };
        if (llave_info && llave_info.tiene) { llaveData.llave = llave_info; }
        await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', llave_caracteristicas = ?, hora_inicio = ? WHERE id = ?`, args: [JSON.stringify(llaveData), now, targetId] });
        await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, args: ['ingreso_visitante', placa.toUpperCase(), targetId, now, new Date().toISOString().split("T")[0]] });
        return res.status(200).json({ success: true, message: "Ingreso registrado" });
      }

      if (accion === "asignar_registrado") {
        if (!cliente_id) return res.status(400).json({ error: "Cliente requerido" });
        const cliente = (await db.execute({ sql: "SELECT * FROM clientes WHERE id = ?", args: [cliente_id] })).rows[0];
        if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
        if (!(await isPlateAvailable(cliente.placa, targetId))) return res.status(400).json({ error: `El cliente ${cliente.nombre} ya está en puesto.` });
        var llaveDataReg = {};
        if (llave_info && llave_info.tiene) { llaveDataReg = { llave: llave_info }; }
        await db.execute({ sql: `UPDATE puestos SET estado = 'ocupado', cliente_id = ?, hora_inicio = ?, llave_caracteristicas = ? WHERE id = ?`, args: [cliente_id, now, JSON.stringify(llaveDataReg), targetId] });
        await db.execute({ sql: `INSERT INTO historial (type, plate, spot, entry, date) VALUES (?, ?, ?, ?, ?)`, args: ['ingreso', cliente.placa, targetId, now, new Date().toISOString().split("T")[0]] });
        return res.status(200).json({ success: true, message: "Cliente asignado" });
      }

      if (accion === "salir_visitante") {
        const spot = (await db.execute({ sql: "SELECT puesto_info, llave_caracteristicas FROM puestos WHERE id = ?", args: [targetId] })).rows[0];
        const owner = JSON.parse(spot.puesto_info || '{}');
        var llaveVisitSalida = {};
        try { llaveVisitSalida = JSON.parse(spot.llave_caracteristicas || '{}').llave || {}; } catch(e) {}
        if (owner.nombre) {
            await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}' WHERE id = ?`, args: [targetId] });
        } else {
            await db.execute({ sql: `UPDATE puestos SET estado = 'libre', cliente_id = NULL, hora_inicio = NULL, llave_caracteristicas = '{}', puesto_info = '{}' WHERE id = ?`, args: [targetId] });
        }
        var msgVisit = "Liberado";
        if (llaveVisitSalida.tiene) msgVisit += " ⚠️ Recuerde entregar la llave.";
        return res.status(200).json({ success: true, message: msgVisit });
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