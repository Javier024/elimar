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
      clientes: 0,
      alertas: 0,
      deudores: 0,
      ocupacionPorcentaje: 0
    };
    
    let chartFinanzasData = [];
    let movimientosRecientes = [];

    // --- 1. PUESTOS ---
    try {
      const puestosResult = await db.execute(`
        SELECT 
          COUNT(*) as total,
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
    } catch (e) {
      console.error("Error puestos:", e);
    }

    // --- 2. CAJA Y GASTOS (USANDO COLUMNAS REALES: amount, category) ---
    try {
      // Consultamos la tabla 'caja'. 
      // Ingresos = category 'Ingreso' (O similares) o category null por defecto
      // Gastos = category 'Gasto' o los que están en la tabla 'gastos'
      
      // Para simplificar y unificar, sumamos TODO de 'caja' positivo como ingreso 
      // y buscamos en 'gastos' para los egresos, basado en tu estructura.
      
      // A. INGRESOS (Suma de todo lo que esté en la tabla 'caja' hoy, asumiendo que ahí registras cobros)
      const ingresosResult = await db.execute(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM caja 
        WHERE date = ?
      `, [hoy]);
      kpi.ingresos = ingresosResult.rows[0]?.total || 0;

      // B. GASTOS (Suma de lo que esté en la tabla 'gastos' hoy)
      const gastosResult = await db.execute(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM gastos 
        WHERE date = ?
      `, [hoy]);
      kpi.gastos = gastosResult.rows[0]?.total || 0;

    } catch (e) {
      console.error("Error finanzas:", e);
    }

    // --- 3. CLIENTES ---
    try {
      const cRes = await db.execute("SELECT COUNT(*) as total FROM clientes");
      kpi.clientes = cRes.rows[0]?.total || 0;
    } catch (e) {}

    // --- 4. ALERTAS ---
    try {
      const aRes = await db.execute(`
        SELECT COUNT(*) as total 
        FROM clientes 
        WHERE fecha_registro < date('now', '-24 hours')
      `);
      kpi.alertas = aRes.rows[0]?.total || 0;
    } catch (e) {}

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
    } catch (e) {}

    // --- 6. GRÁFICA FINANCIERA (Unificando tabla caja y gastos) ---
    try {
      // Obtenemos ingresos de 'caja' y gastos de 'gastos' para los últimos 7 días
      const ingresosChart = await db.execute(`
        SELECT date, SUM(amount) as monto
        FROM caja
        WHERE date >= date('now', '-7 days')
        GROUP BY date
      `);

      const gastosChart = await db.execute(`
        SELECT date, SUM(amount) as monto
        FROM gastos
        WHERE date >= date('now', '-7 days')
        GROUP BY date
      `);

      // Unimos datos en un solo mapa por fecha
      const mapaFechas = {};
      
      ingresosChart.rows.forEach(r => {
        if(!mapaFechas[r.date]) mapaFechas[r.date] = { ingresos: 0, gastos: 0 };
        mapaFechas[r.date].ingresos += r.monto;
      });

      gastosChart.rows.forEach(r => {
        if(!mapaFechas[r.date]) mapaFechas[r.date] = { ingresos: 0, gastos: 0 };
        mapaFechas[r.date].gastos += r.monto;
      });

      // Convertimos a array plano para Chart.js
      Object.keys(mapaFechas).sort().forEach(fecha => {
        chartFinanzasData.push({ date: fecha, type: 'ingreso', amount: mapaFechas[fecha].ingresos });
        chartFinanzasData.push({ date: fecha, type: 'gasto', amount: mapaFechas[fecha].gastos });
      });

    } catch (e) {
      console.error("Error gráfica:", e);
    }

    // --- 7. HISTORIAL ---
    try {
      const hRes = await db.execute(`
        SELECT type, spot, plate, date, entry, exit 
        FROM historial 
        ORDER BY id DESC LIMIT 5
      `);
      movimientosRecientes = hRes.rows;
    } catch (e) {}

    return res.status(200).json({
      kpi: kpi,
      chartFinanzas: chartFinanzasData,
      movimientosRecientes: movimientosRecientes
    });

  } catch (error) {
    console.error("Error Dashboard:", error);
    return res.status(500).json({ message: 'Error interno', error: error.message });
  }
}