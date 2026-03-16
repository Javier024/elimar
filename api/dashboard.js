// parqueo/api/dashboard.js
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // ---------------------------------------------------------
    // CONSULTAS A TU BASE DE DATOS ACTUAL
    // ---------------------------------------------------------

    // 1. Vehículos Dentro (Tabla: historial)
    // Buscamos donde la columna 'exit' esté vacía o sea NULL
    const resultDentro = await client.execute("SELECT COUNT(*) as count FROM historial WHERE exit IS NULL OR exit = ''");
    
    // 2. Puestos (Tabla: puestos)
    // Total de puestos registrados
    const resultTotalPuestos = await client.execute("SELECT COUNT(*) as count FROM puestos");
    const totalPuestos = resultTotalPuestos.rows[0].count;

    // Puestos Libres (donde estado sea 'libre')
    const resultLibres = await client.execute("SELECT COUNT(*) as count FROM puestos WHERE estado = 'libre'");
    
    // Puestos Reservados (donde estado sea 'reservado' u otro)
    const resultReservados = await client.execute("SELECT COUNT(*) as count FROM puestos WHERE estado = 'reservado'");

    // 3. Clientes (Tabla: clientes)
    const resultClientes = await client.execute("SELECT COUNT(*) as count FROM clientes");

    // 4. Ingresos de Hoy (Tabla: caja)
    // Usamos la columna 'date' (texto) y comparamos con la fecha actual
    const resultIngresosHoy = await client.execute(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM caja 
      WHERE date = DATE('now')
    `);

    // 5. Gastos de Hoy (Tabla: gastos)
    const resultGastosHoy = await client.execute(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM gastos 
      WHERE date = DATE('now')
    `);

    // 6. Alertas (Tabla: historial)
    // Vehículos llevan más de 24h sin salir (asumiendo formato de hora en 'entry' o 'date')
    const resultAlertas = await client.execute(`
      SELECT COUNT(*) as count 
      FROM historial 
      WHERE (exit IS NULL OR exit = '') 
      AND datetime(entry) < datetime('now', '-24 hours')
    `);

    // 7. Datos para Gráfico Financiero (Últimos 7 días)
    // Unimos ingresos (caja) y gastos (gastos)
    const resultFinanzas = await client.execute(`
        SELECT date, SUM(amount) as amount, 'ingreso' as type FROM caja WHERE date >= DATE('now', '-7 days') GROUP BY date
        UNION ALL
        SELECT date, SUM(amount) as amount, 'gasto' as type FROM gastos WHERE date >= DATE('now', '-7 days') GROUP BY date
        ORDER BY date ASC
    `);

    // ---------------------------------------------------------
    // ESTRUCTURA DE RESPUESTA
    // ---------------------------------------------------------
    const vehiculosDentro = resultDentro.rows[0].count;
    const libres = resultLibres.rows[0].count;

    const data = {
      kpi: {
        vehiculos: vehiculosDentro,
        libres: libres,
        reservados: resultReservados.rows[0].count,
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