// parqueo/api/dashboard.js
import { db } from "./db.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 1. Vehículos Dentro (Historial sin salida)
    const resultDentro = await db.execute("SELECT COUNT(*) as count FROM historial WHERE exit IS NULL OR exit = ''");
    
    // 2. Puestos Totales y Libres
    const resultTotalPuestos = await db.execute("SELECT COUNT(*) as count FROM puestos");
    const totalPuestos = resultTotalPuestos.rows[0].count;

    const resultLibres = await db.execute("SELECT COUNT(*) as count FROM puestos WHERE estado = 'libre'");
    
    // 3. Clientes Registrados
    const resultClientes = await db.execute("SELECT COUNT(*) as count FROM clientes");

    // 4. Ingresos de Hoy (Conexión con Caja)
    const resultIngresosHoy = await db.execute(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM caja 
      WHERE date = DATE('now')
    `);

    // 5. Gastos de Hoy (Conexión con Gastos)
    const resultGastosHoy = await db.execute(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM gastos 
      WHERE date = DATE('now')
    `);

    // 6. Alertas (Vehículos > 24h)
    const resultAlertas = await db.execute(`
      SELECT COUNT(*) as count 
      FROM historial 
      WHERE (exit IS NULL OR exit = '') 
      AND datetime(entry) < datetime('now', '-24 hours')
    `);

    // 7. Gráfico Financiero (Últimos 7 días)
    const resultFinanzas = await db.execute(`
        SELECT date, SUM(amount) as amount, 'ingreso' as type FROM caja WHERE date >= DATE('now', '-7 days') GROUP BY date
        UNION ALL
        SELECT date, SUM(amount) as amount, 'gasto' as type FROM gastos WHERE date >= DATE('now', '-7 days') GROUP BY date
        ORDER BY date ASC
    `);

    const vehiculosDentro = resultDentro.rows[0].count;
    const libres = resultLibres.rows[0].count;

    const data = {
      kpi: {
        vehiculos: vehiculosDentro,
        libres: libres,
        reservados: 0, // Se calcula en lógica de frontend si es necesario, o query extra
        ingresos: resultIngresosHoy.rows[0].total,
        gastos: resultGastosHoy.rows[0].total,
        alertas: resultAlertas.rows[0].count,
        clientes: resultClientes.rows[0].count,
        ocupacionPorcentaje: totalPuestos > 0 ? Math.round(((totalPuestos - libres) / totalPuestos) * 100) : 0
      },
      chartFinanzas: resultFinanzas.rows
    };

    return res.status(200).json(data);

  } catch (error) {
    console.error("Error en API Dashboard:", error);
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
}