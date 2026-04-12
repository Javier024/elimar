// parqueo/api/dashboard.js
import { db } from "./db.js";
import { authGuard } from "./_lib/auth.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== "GET") return res.status(405).json({ message: 'Method not allowed' });

  try {
    const user = authGuard(req, res);
    if (!user) return;

    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = new Date().toISOString().slice(0, 7);

    let kpi = {
      vehiculos: 0, libres: 0, reservados: 0,
      ingresos: 0, gastos: 0,
      clientes: 0, deudores: 0, ocupacionPorcentaje: 0,
      carrosDentro: 0, motosDentro: 0, camionetasDentro: 0,
      balanceHoy: 0
    };

    let chartFinanzasData = [];
    let chartMetodosPagoData = [];
    let chartHorasPicoData = [];
    let chartTipoVehiculoData = [];
    let chartTopClientesData = [];
    let movimientosRecientes = [];
    let proximosPagosData = [];
    let deudoresDetalle = []; // NUEVO: Lista detallada de deudores

    const results = await Promise.allSettled([
      // 0. Puestos
      db.execute(`SELECT COUNT(*) as total, SUM(CASE WHEN estado = 'ocupado' THEN 1 ELSE 0 END) as ocupados, SUM(CASE WHEN estado = 'libre' THEN 1 ELSE 0 END) as libres, SUM(CASE WHEN estado = 'reservado' THEN 1 ELSE 0 END) as reservados FROM puestos`),
      
      // 1. Ingresos Hoy
      db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM caja WHERE date = ?`, [hoy]),
      
      // 2. Gastos Hoy
      db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM gastos WHERE date = ?`, [hoy]),
      
      // 3. Clientes
      db.execute("SELECT COUNT(*) as total FROM clientes"),
      
      // 4. Deudores - CORREGIDO: NOT EXISTS + TRIM + filtrar placas inválidas
      db.execute(`
        SELECT COUNT(*) as total 
        FROM clientes c
        WHERE c.placa IS NOT NULL 
          AND TRIM(c.placa) != '' 
          AND TRIM(c.placa) != '---'
          AND NOT EXISTS (
            SELECT 1 FROM caja ca 
            WHERE TRIM(ca.plate) = TRIM(c.placa) 
              AND ca.date LIKE ? 
              AND ca.plate IS NOT NULL
              AND TRIM(ca.plate) != '---'
          )
      `, [`${mesActual}%`]),
      
      // 4.5 NUEVO: Detalle de deudores para mostrar en dashboard
      db.execute(`
        SELECT c.id, c.nombre, TRIM(c.placa) as placa, c.telefono, 
               c.medio_pago as periodicidad, c.cuota_mensual as cuota,
               c.tipo_vehiculo,
               (SELECT MAX(ca.date) FROM caja ca WHERE TRIM(ca.plate) = TRIM(c.placa) AND ca.plate IS NOT NULL) as ultimo_pago
        FROM clientes c
        WHERE c.placa IS NOT NULL 
          AND TRIM(c.placa) != '' 
          AND TRIM(c.placa) != '---'
          AND NOT EXISTS (
            SELECT 1 FROM caja ca 
            WHERE TRIM(ca.plate) = TRIM(c.placa) 
              AND ca.date LIKE ? 
              AND ca.plate IS NOT NULL
              AND TRIM(ca.plate) != '---'
          )
        ORDER BY c.nombre ASC
        LIMIT 10
      `, [`${mesActual}%`]),
      
      // 5. Finanzas Ingresos 7 días
      db.execute(`SELECT date, SUM(amount) as monto FROM caja WHERE date >= date('now', '-7 days') GROUP BY date`),
      
      // 6. Finanzas Gastos 7 días
      db.execute(`SELECT date, SUM(amount) as monto FROM gastos WHERE date >= date('now', '-7 days') GROUP BY date`),
      
      // 7. Métodos de Pago
      db.execute(`SELECT method, COALESCE(SUM(amount), 0) as total FROM caja WHERE plate IS NOT NULL AND TRIM(plate) != '---' GROUP BY method`),
      
      // 8. Horas Pico
      db.execute(`
        SELECT CAST(SUBSTR(entry, 1, INSTR(entry || ':', ':') - 1) AS INTEGER) as hora, COUNT(*) as total 
        FROM historial 
        WHERE date >= date('now', '-7 days') 
          AND entry IS NOT NULL 
          AND entry != '' 
          AND entry != '--:--'
        GROUP BY hora 
        ORDER BY hora
      `),
      
      // 9. Historial Reciente
      db.execute(`SELECT * FROM historial ORDER BY id DESC LIMIT 8`),
      
      // 10. Tipo de Vehículo (30 días)
      db.execute(`
        SELECT c.tipo_vehiculo as tipo, COUNT(*) as total 
        FROM historial h 
        INNER JOIN clientes c ON TRIM(h.plate) = TRIM(c.placa) 
        WHERE h.date >= date('now', '-30 days') 
          AND h.plate IS NOT NULL
          AND TRIM(h.plate) != '' 
          AND TRIM(h.plate) != '---'
          AND c.tipo_vehiculo IS NOT NULL 
          AND c.tipo_vehiculo != '' 
        GROUP BY c.tipo_vehiculo 
        ORDER BY total DESC
      `),
      
      // 11. Top 5 Clientes
      db.execute(`
        SELECT TRIM(plate) as plate, COUNT(*) as total 
        FROM historial 
        WHERE date >= date('now', '-30 days') 
          AND plate IS NOT NULL 
          AND TRIM(plate) != '' 
          AND TRIM(plate) != '---' 
        GROUP BY TRIM(plate) 
        ORDER BY total DESC 
        LIMIT 5
      `),
      
      // 12. Desglose vehículos adentro
      db.execute(`
        SELECT c.tipo_vehiculo as tipo, COUNT(*) as total 
        FROM puestos p 
        INNER JOIN clientes c ON p.cliente_id = c.id 
        WHERE p.estado = 'ocupado' 
          AND c.tipo_vehiculo IS NOT NULL 
          AND c.tipo_vehiculo != '' 
        GROUP BY c.tipo_vehiculo
      `),
      
      // 13. Próximos pagos por vencer
      db.execute(`
        SELECT 
            c.id,
            c.nombre,
            TRIM(c.placa) as placa,
            c.medio_pago as periodicidad,
            c.cuota_mensual as cuota,
            c.tipo_vehiculo,
            MAX(ca.date) as ultimo_pago
        FROM clientes c
        INNER JOIN caja ca ON TRIM(c.placa) = TRIM(ca.plate)
        WHERE c.placa IS NOT NULL
          AND TRIM(c.placa) != ''
          AND TRIM(c.placa) != '---'
          AND c.medio_pago IS NOT NULL 
          AND c.medio_pago != '' 
          AND c.medio_pago != 'Otro'
          AND c.medio_pago != 'Diario'
          AND ca.plate IS NOT NULL
        GROUP BY c.id
        HAVING ultimo_pago IS NOT NULL
        ORDER BY ultimo_pago ASC
      `)
    ]);

    // 0. Puestos
    if (results[0].status === 'fulfilled') {
      const d = results[0].value.rows[0];
      if (d) {
        kpi.vehiculos = d.ocupados || 0;
        kpi.libres = d.libres || 0;
        kpi.reservados = d.reservados || 0;
        kpi.ocupacionPorcentaje = d.total > 0 ? Math.round((d.ocupados / d.total) * 100) : 0;
      }
    }

    // 1-4. KPIs simples
    if (results[1].status === 'fulfilled') kpi.ingresos = results[1].value.rows[0]?.total || 0;
    if (results[2].status === 'fulfilled') kpi.gastos = results[2].value.rows[0]?.total || 0;
    if (results[3].status === 'fulfilled') kpi.clientes = results[3].value.rows[0]?.total || 0;
    if (results[4].status === 'fulfilled') kpi.deudores = results[4].value.rows[0]?.total || 0;

    kpi.balanceHoy = kpi.ingresos - kpi.gastos;

    // 4.5 NUEVO: Detalle de deudores
    if (results[5].status === 'fulfilled') {
      deudoresDetalle = results[5].value.rows || [];
    }

    // 12. Desglose por tipo adentro (índice 13 ahora porque agregamos 4.5)
    if (results[13].status === 'fulfilled') {
      results[13].value.rows.forEach(r => {
        const tipo = (r.tipo || '').toLowerCase();
        if (tipo === 'carro') kpi.carrosDentro = r.total || 0;
        else if (tipo === 'moto') kpi.motosDentro = r.total || 0;
        else if (tipo === 'camioneta') kpi.camionetasDentro = r.total || 0;
      });
    }

    // 5-6. Finanzas (índices 6 y 7)
    if (results[6].status === 'fulfilled' && results[7].status === 'fulfilled') {
      const mapa = {};
      results[6].value.rows.forEach(r => { if(!mapa[r.date]) mapa[r.date] = { ingresos: 0, gastos: 0 }; mapa[r.date].ingresos += r.monto; });
      results[7].value.rows.forEach(r => { if(!mapa[r.date]) mapa[r.date] = { ingresos: 0, gastos: 0 }; mapa[r.date].gastos += r.monto; });
      Object.keys(mapa).sort().forEach(fecha => {
        chartFinanzasData.push({ date: fecha, type: 'ingreso', amount: mapa[fecha].ingresos });
        chartFinanzasData.push({ date: fecha, type: 'gasto', amount: mapa[fecha].gastos });
      });
    }

    if (results[8].status === 'fulfilled') chartMetodosPagoData = results[8].value.rows.map(r => ({ metodo: r.method || 'Sin definir', total: r.total }));
    if (results[9].status === 'fulfilled') chartHorasPicoData = results[9].value.rows.filter(r => r.hora !== null && r.hora >= 0 && r.hora <= 23);
    if (results[10].status === 'fulfilled') movimientosRecientes = results[10].value.rows;
    if (results[11].status === 'fulfilled') chartTipoVehiculoData = results[11].value.rows;
    if (results[12].status === 'fulfilled') chartTopClientesData = results[12].value.rows;

    // 14. Próximos pagos (índice 14)
    if (results[14].status === 'fulfilled') {
      const diasPorPeriodicidad = {
        'Semanal': 7,
        'Quincenal': 15,
        'Mensual': 30
      };

      const hoyDate = new Date(hoy + 'T12:00:00');

      results[14].value.rows.forEach(row => {
        const periodicidad = (row.periodicidad || '').trim();
        const dias = diasPorPeriodicidad[periodicidad];
        if (!dias) return;

        const ultimoPagoStr = row.ultimo_pago;
        if (!ultimoPagoStr) return;

        const ultimoPago = new Date(ultimoPagoStr + 'T12:00:00');
        if (isNaN(ultimoPago.getTime())) return;

        const proximoPago = new Date(ultimoPago);
        proximoPago.setDate(proximoPago.getDate() + dias);
        
        const diffMs = proximoPago.getTime() - hoyDate.getTime();
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Solo los próximos 7 días (incluyendo vencidos)
        if (diasRestantes <= 7) {
          proximosPagosData.push({
            id: row.id,
            nombre: row.nombre,
            placa: row.placa,
            periodicidad: periodicidad,
            cuota: row.cuota || 0,
            tipoVehiculo: row.tipo_vehiculo || 'Carro',
            ultimoPago: ultimoPagoStr,
            diasRestantes: diasRestantes
          });
        }
      });

      // Ordenar: los más urgentes primero
      proximosPagosData.sort((a, b) => a.diasRestantes - b.diasRestantes);
      proximosPagosData = proximosPagosData.slice(0, 8);
    }

    return res.status(200).json({
      kpi,
      chartFinanzas: chartFinanzasData,
      chartMetodosPago: chartMetodosPagoData,
      chartHorasPico: chartHorasPicoData,
      chartTipoVehiculo: chartTipoVehiculoData,
      chartTopClientes: chartTopClientesData,
      movimientosRecientes,
      proximosPagos: proximosPagosData,
      deudores: deudoresDetalle  // NUEVO: Enviar detalle de deudores
    });

  } catch (error) {
    console.error("Error Dashboard:", error);
    return res.status(500).json({ message: 'Error interno', error: error.message });
  }
}