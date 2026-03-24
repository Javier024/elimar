// parqueo/api/dashboard.js
import { db } from "./db.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== "GET") {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const hoy = new Date().toISOString().split("T")[0];
    
    let kpi = {
      vehiculos: 0,
      libres: 0,
      reservados: 0,
      ingresos: 0,       
      gastos: 0,         
      ingresosTotal: 0,  
      gastosTotal: 0,    
      clientes: 0,
      alertas: 0,
      deudores: 0,
      ocupacionPorcentaje: 0
    };
    
    let chartFinanzasData = [];
    let chartOcupacionMesData = []; 
    let chartMetodosPagoData = []; // NUEVO: Datos para métodos de pago
    let movimientosRecientes = [];

    // --- 1. PUESTOS ---
    try {
      const puestosResult = await db.execute(`
        SELECT COUNT(*) as total,
        SUM(CASE WHEN estado = 'ocupado' THEN 1 ELSE 0 END) as ocupados,
        SUM(CASE WHEN estado = 'libre' THEN 1 ELSE 0 END) as libres,
        SUM(CASE WHEN estado = 'reservado' THEN 1 ELSE 0 END) as reservados
        FROM puestos
      `);
      const data = puestosResult.rows[0];
      if (data) {
        kpi.vehiculos = data.ocupados || 0;
        kpi.libres = data.libres || 0;
        kpi.reservados = data.reservados || 0;
        kpi.ocupacionPorcentaje = data.total > 0 ? Math.round((data.ocupados / data.total) * 100) : 0;
      }
    } catch (e) { console.error("Error puestos:", e); }

    // --- 2. CAJA Y GASTOS ---
    try {
      const ingresosHoyResult = await db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM caja WHERE date = ?`, [hoy]);
      kpi.ingresos = ingresosHoyResult.rows[0]?.total || 0;

      const gastosHoyResult = await db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM gastos WHERE date = ?`, [hoy]);
      kpi.gastos = gastosHoyResult.rows[0]?.total || 0;

      const ingresosTotalResult = await db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM caja`);
      kpi.ingresosTotal = ingresosTotalResult.rows[0]?.total || 0;

      const gastosTotalResult = await db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM gastos`);
      kpi.gastosTotal = gastosTotalResult.rows[0]?.total || 0;

    } catch (e) { console.error("Error finanzas:", e); }

    // --- 3. CLIENTES ---
    try {
      const cRes = await db.execute("SELECT COUNT(*) as total FROM clientes");
      kpi.clientes = cRes.rows[0]?.total || 0;
    } catch (e) { console.error("Error clientes:", e); }

    // --- 4. ALERTAS ---
    try {
      const aRes = await db.execute(`SELECT COUNT(*) as total FROM clientes WHERE fecha_registro < date('now', '-24 hours')`);
      kpi.alertas = aRes.rows[0]?.total || 0;
    } catch (e) { console.error("Error alertas:", e); }

    // --- 5. DEUDORES ---
    try {
      const mesActual = new Date().toISOString().slice(0, 7);
      const dRes = await db.execute(`
        SELECT COUNT(*) as total
        FROM clientes c
        WHERE c.placa NOT IN (
          SELECT plate FROM caja ca 
          WHERE ca.date LIKE ? AND ca.plate != '---'
        )
      `, [`${mesActual}%`]);
      kpi.deudores = dRes.rows[0]?.total || 0;
    } catch (e) { console.error("Error deudores:", e); }

    // --- 6. GRÁFICA FINANCIERA (7 Días) ---
    try {
      const ingresosChart = await db.execute(`SELECT date, SUM(amount) as monto FROM caja WHERE date >= date('now', '-7 days') GROUP BY date`);
      const gastosChart = await db.execute(`SELECT date, SUM(amount) as monto FROM gastos WHERE date >= date('now', '-7 days') GROUP BY date`);

      const mapaFechas = {};
      ingresosChart.rows.forEach(r => {
        if(!mapaFechas[r.date]) mapaFechas[r.date] = { ingresos: 0, gastos: 0 };
        mapaFechas[r.date].ingresos += r.monto;
      });
      gastosChart.rows.forEach(r => {
        if(!mapaFechas[r.date]) mapaFechas[r.date] = { ingresos: 0, gastos: 0 };
        mapaFechas[r.date].gastos += r.monto;
      });

      Object.keys(mapaFechas).sort().forEach(fecha => {
        chartFinanzasData.push({ date: fecha, type: 'ingreso', amount: mapaFechas[fecha].ingresos });
        chartFinanzasData.push({ date: fecha, type: 'gasto', amount: mapaFechas[fecha].gastos });
      });
    } catch (e) { console.error("Error gráfica finanzas:", e); }

    // --- 7. GRÁFICA MÉTODOS DE PAGO (NUEVO) ---
    try {
      const metodosResult = await db.execute(`
        SELECT method, COALESCE(SUM(amount), 0) as total 
        FROM caja 
        GROUP BY method
      `);
      chartMetodosPagoData = metodosResult.rows.map(r => ({
        metodo: r.method || 'Sin definir',
        total: r.total
      }));
    } catch (e) { console.error("Error gráfica métodos:", e); }

    // --- 8. GRÁFICA ACTIVIDAD MENSUAL ---
    try {
        // Traemos los movimientos de los últimos 6 meses
        const actividadMesResult = await db.execute(`
            SELECT 
                strftime('%Y-%m', date) as mes, 
                COUNT(*) as total_movimientos
            FROM historial 
            WHERE date >= date('now', '-6 months')
            GROUP BY mes
            ORDER BY mes ASC
        `);

        chartOcupacionMesData = actividadMesResult.rows.map(r => ({
            mes: r.mes, 
            total: r.total_movimientos 
        }));

    } catch (e) { 
        console.error("Error gráfica actividad mensual:", e); 
    }

    // --- 9. HISTORIAL RECIENTE ---
    try {
      const hRes = await db.execute(`SELECT * FROM historial ORDER BY id DESC LIMIT 5`);
      movimientosRecientes = hRes.rows;
    } catch (e) { console.error("Error historial:", e); }

    return res.status(200).json({
      kpi: kpi,
      chartFinanzas: chartFinanzasData,
      chartOcupacionMes: chartOcupacionMesData, 
      chartMetodosPago: chartMetodosPagoData, // Enviando datos nuevos
      movimientosRecientes: movimientosRecientes
    });

  } catch (error) {
    console.error("Error Dashboard:", error);
    return res.status(500).json({ message: 'Error interno', error: error.message });
  }
}