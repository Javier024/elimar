// parqueo/api/dashboard.js
import { db } from "./db.js";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 1. Vehículos Dentro
    const resultDentro = await db.execute("SELECT COUNT(*) as count FROM historial WHERE exit IS NULL OR exit = ''");
    
    // 2. Puestos Totales
    const resultTotalPuestos = await db.execute("SELECT COUNT(*) as count FROM puestos");
    const totalPuestos = resultTotalPuestos.rows[0].count;

    // 3. Puestos Libres
    const resultLibres = await db.execute("SELECT COUNT(*) as count FROM puestos WHERE estado = 'libre'");
    
    // 4. Puestos Reservados
    const resultReservados = await db.execute("SELECT COUNT(*) as count FROM puestos WHERE estado = 'reservado'");
    
    // 5. Clientes Registrados
    const resultClientes = await db.execute("SELECT COUNT(*) as count FROM clientes");

    // 6. Ingresos de Hoy (Caja)
    const resultIngresosHoy = await db.execute(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM caja 
      WHERE date = DATE('now', 'localtime')
    `);

    // 7. Gastos de Hoy (Gastos)
    const resultGastosHoy = await db.execute(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM gastos 
      WHERE date = DATE('now', 'localtime')
    `);

    // 8. Alertas (Vehículos > 24h)
    const resultAlertas = await db.execute(`
      SELECT COUNT(*) as count 
      FROM historial 
      WHERE (exit IS NULL OR exit = '') 
      AND datetime(entry) < datetime('now', '-24 hours')
    `);

    // 9. Gráfico Financiero (Últimos 7 días)
    const resultFinanzas = await db.execute(`
        SELECT date, SUM(amount) as amount, 'ingreso' as type FROM caja WHERE date >= DATE('now', '-6 days', 'localtime') GROUP BY date
        UNION ALL
        SELECT date, SUM(amount) as amount, 'gasto' as type FROM gastos WHERE date >= DATE('now', '-6 days', 'localtime') GROUP BY date
        ORDER BY date ASC
    `);

    // 10. Movimientos Recientes
    const resultMovimientos = await db.execute(`
        SELECT * FROM historial 
        ORDER BY id DESC 
        LIMIT 5
    `);

    // 11. NUEVO: DEUDORES DEL MES (Integración con Caja)
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const resultDeudores = await db.execute(`
      SELECT COUNT(*) as total 
      FROM clientes 
      WHERE placa NOT IN (
        SELECT plate FROM caja 
        WHERE date LIKE ? AND plate != '---'
      )
    `, [`${currentMonthPrefix}%`]);

    const vehiculosDentro = resultDentro.rows[0].count;
    const libres = resultLibres.rows[0].count;
    const reservados = resultReservados.rows[0].count;

    const data = {
      kpi: {
        vehiculos: vehiculosDentro,
        libres: libres,
        reservados: reservados,
        ingresos: resultIngresosHoy.rows[0].total,
        gastos: resultGastosHoy.rows[0].total,
        alertas: resultAlertas.rows[0].count,
        clientes: resultClientes.rows[0].count,
        deudores: resultDeudores.rows[0].total, // Nuevo KPI
        ocupacionPorcentaje: totalPuestos > 0 ? Math.round(((totalPuestos - libres) / totalPuestos) * 100) : 0
      },
      chartFinanzas: resultFinanzas.rows,
      movimientosRecientes: resultMovimientos.rows
    };

    return res.status(200).json(data);

  } catch (error) {
    console.error("Error en API Dashboard:", error);
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
}