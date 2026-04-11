// parqueo/api/dashboard.js
import { db } from "./db.js";
import { authGuard } from "./_lib/auth.js"; // <-- NUEVO

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== "GET") {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const user = authGuard(req, res); // <-- NUEVO
    if (!user) return; // <-- NUEVO

    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = new Date().toISOString().slice(0, 7);
    
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
    let chartMetodosPagoData = [];
    let chartSemanalData = []; 
    let movimientosRecientes = [];

    // --- OPTIMIZACIÓN MAESTRA: PROMISE.ALLSETTLED ---
    // En lugar de hacer 14 'await' uno tras otro (lento), se lanzan todos al mismo tiempo (rápido).
    const results = await Promise.allSettled([
      // 0. Puestos
      db.execute(`SELECT COUNT(*) as total, SUM(CASE WHEN estado = 'ocupado' THEN 1 ELSE 0 END) as ocupados, SUM(CASE WHEN estado = 'libre' THEN 1 ELSE 0 END) as libres, SUM(CASE WHEN estado = 'reservado' THEN 1 ELSE 0 END) as reservados FROM puestos`),
      // 1. Ingresos Hoy
      db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM caja WHERE date = ?`, [hoy]),
      // 2. Gastos Hoy
      db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM gastos WHERE date = ?`, [hoy]),
      // 3. Ingresos Total
      db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM caja`),
      // 4. Gastos Total
      db.execute(`SELECT COALESCE(SUM(amount), 0) as total FROM gastos`),
      // 5. Clientes
      db.execute("SELECT COUNT(*) as total FROM clientes"),
      // 6. Alertas
      db.execute(`SELECT COUNT(*) as total FROM clientes WHERE fecha_registro < date('now', '-24 hours')`),
      // 7. Deudores
      db.execute(`SELECT COUNT(*) as total FROM clientes c WHERE c.placa NOT IN (SELECT plate FROM caja ca WHERE ca.date LIKE ? AND ca.plate != '---')`, [`${mesActual}%`]),
      // 8. Gráfica Finanzas (Ingresos 7 días)
      db.execute(`SELECT date, SUM(amount) as monto FROM caja WHERE date >= date('now', '-7 days') GROUP BY date`),
      // 9. Gráfica Finanzas (Gastos 7 días)
      db.execute(`SELECT date, SUM(amount) as monto FROM gastos WHERE date >= date('now', '-7 days') GROUP BY date`),
      // 10. Gráfica Métodos de Pago
      db.execute(`SELECT method, COALESCE(SUM(amount), 0) as total FROM caja GROUP BY method`),
      // 11. Gráfica Actividad Mensual
      db.execute(`SELECT strftime('%Y-%m', date) as mes, COUNT(*) as total_movimientos FROM historial WHERE date >= date('now', '-6 months') GROUP BY mes ORDER BY mes ASC`),
      // 12. Historial Reciente
      db.execute(`SELECT * FROM historial ORDER BY id DESC LIMIT 5`),
      // 13. Gráfica Semanal
      db.execute(`SELECT date, COUNT(*) as total_vehiculos FROM historial WHERE date >= date('now', '-7 days') GROUP BY date ORDER BY date ASC`)
    ]);

    // --- ASIGNACIÓN SEGURA DE RESULTADOS ---
    
    // 0. Puestos
    if (results[0].status === 'fulfilled') {
      const data = results[0].value.rows[0];
      if (data) {
        kpi.vehiculos = data.ocupados || 0;
        kpi.libres = data.libres || 0;
        kpi.reservados = data.reservados || 0;
        kpi.ocupacionPorcentaje = data.total > 0 ? Math.round((data.ocupados / data.total) * 100) : 0;
      }
    }

    // 1 a 7. KPIs numéricos simples
    if (results[1].status === 'fulfilled') kpi.ingresos = results[1].value.rows[0]?.total || 0;
    if (results[2].status === 'fulfilled') kpi.gastos = results[2].value.rows[0]?.total || 0;
    if (results[3].status === 'fulfilled') kpi.ingresosTotal = results[3].value.rows[0]?.total || 0;
    if (results[4].status === 'fulfilled') kpi.gastosTotal = results[4].value.rows[0]?.total || 0;
    if (results[5].status === 'fulfilled') kpi.clientes = results[5].value.rows[0]?.total || 0;
    if (results[6].status === 'fulfilled') kpi.alertas = results[6].value.rows[0]?.total || 0;
    if (results[7].status === 'fulfilled') kpi.deudores = results[7].value.rows[0]?.total || 0;

    // 8 y 9. Gráfica Finanzas (Merge de Ingresos y Gastos)
    if (results[8].status === 'fulfilled' && results[9].status === 'fulfilled') {
      const mapaFechas = {};
      
      results[8].value.rows.forEach(r => {
        if(!mapaFechas[r.date]) mapaFechas[r.date] = { ingresos: 0, gastos: 0 };
        mapaFechas[r.date].ingresos += r.monto;
      });
      
      results[9].value.rows.forEach(r => {
        if(!mapaFechas[r.date]) mapaFechas[r.date] = { ingresos: 0, gastos: 0 };
        mapaFechas[r.date].gastos += r.monto;
      });

      Object.keys(mapaFechas).sort().forEach(fecha => {
        chartFinanzasData.push({ date: fecha, type: 'ingreso', amount: mapaFechas[fecha].ingresos });
        chartFinanzasData.push({ date: fecha, type: 'gasto', amount: mapaFechas[fecha].gastos });
      });
    }

    // 10. Métodos de Pago
    if (results[10].status === 'fulfilled') {
      chartMetodosPagoData = results[10].value.rows.map(r => ({
        metodo: r.method || 'Sin definir',
        total: r.total
      }));
    }

    // 11. Actividad Mensual
    if (results[11].status === 'fulfilled') {
      chartOcupacionMesData = results[11].value.rows.map(r => ({
        mes: r.mes, 
        total: r.total_movimientos 
      }));
    }

    // 12. Movimientos Recientes
    if (results[12].status === 'fulfilled') {
      movimientosRecientes = results[12].value.rows;
    }

    // 13. Gráfica Semanal
    if (results[13].status === 'fulfilled') {
      chartSemanalData = results[13].value.rows.map(r => ({
        fecha: r.date,
        total: r.total_vehiculos
      }));
    }

    return res.status(200).json({
      kpi: kpi,
      chartFinanzas: chartFinanzasData,
      chartOcupacionMes: chartOcupacionMesData, 
      chartMetodosPago: chartMetodosPagoData,
      chartSemanal: chartSemanalData,
      movimientosRecientes: movimientosRecientes
    });

  } catch (error) {
    console.error("Error Dashboard:", error);
    return res.status(500).json({ message: 'Error interno', error: error.message });
  }
}