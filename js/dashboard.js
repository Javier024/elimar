// parqueo/js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard: Iniciando...");
    mostrarFecha();
    try {
        await cargarDatosDashboard();
    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        mostrarError("Error fatal al iniciar la interfaz: " + error.message);
    }
});

const formatearMoneda = (amount) => {
    const valor = amount || 0;
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(valor);
};

function mostrarFecha() {
    try {
        const fechaElemento = document.getElementById('fecha-actual');
        if (fechaElemento) {
            const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const hoy = new Date();
            let textoFecha = hoy.toLocaleDateString('es-ES', opciones);
            textoFecha = textoFecha.charAt(0).toUpperCase() + textoFecha.slice(1);
            fechaElemento.textContent = textoFecha;
        }
    } catch (e) { console.error("Error fecha:", e); }
}

function toggleMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return;

    // Usamos style.display directamente para evitar conflictos con Tailwind 'hidden'
    // y asegurar que el menú se abra/cierre siempre.
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'flex';
        console.log("Menú abierto");
    } else {
        menu.style.display = 'none';
        console.log("Menú cerrado");
    }
}

function cerrarSesion() {
    if(confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        localStorage.removeItem('user_token'); 
        window.location.href = '/index.html';
    }
}

async function cargarDatosDashboard() {
    mostrarLoaders(true);
    ocultarError();

    try {
        console.log("Fetching /api/dashboard...");
        const respuesta = await fetch('/api/dashboard');
        
        if (!respuesta.ok) {
            throw new Error(`Error HTTP: ${respuesta.status}`);
        }
        
        const datos = await respuesta.json();
        console.log("Datos recibidos:", datos);

        if (datos.kpi) {
            actualizarKPI('vehiculos', datos.kpi.vehiculos || 0);
            actualizarKPI('libres', datos.kpi.libres || 0);
            actualizarKPI('reservados', datos.kpi.reservados || 0);
            actualizarKPI('ingresos', formatearMoneda(datos.kpi.ingresos));
            actualizarKPI('alertas', datos.kpi.alertas || 0);
            actualizarKPI('clientes', datos.kpi.clientes || 0);
            
            const porcentajeElem = document.getElementById('ocupacion-porcentaje');
            if(porcentajeElem) porcentajeElem.textContent = `${datos.kpi.ocupacionPorcentaje || 0}%`;
        }

        try {
            if (datos.chartFinanzas && Array.isArray(datos.chartFinanzas)) {
                renderizarGraficoFinanzas(datos.chartFinanzas);
            }
        } catch (err) {
            console.error("Error renderizando gráfico finanzas:", err);
        }

        try {
            renderizarGraficoOcupacion(datos.kpi ? datos.kpi.ocupacionPorcentaje : 0);
        } catch (err) {
            console.error("Error renderizando gráfico ocupación:", err);
        }

    } catch (error) {
        console.error('Error cargando dashboard:', error);
        mostrarError(error.message || "Error de conexión desconocido");
    } finally {
        mostrarLoaders(false);
        console.log("Dashboard: Carga finalizada.");
    }
}

function actualizarKPI(key, valor) {
    const elemento = document.querySelector(`[data-kpi="${key}"]`);
    if (elemento) elemento.textContent = valor;
}

function mostrarLoaders(mostrar) {
    const loaders = document.querySelectorAll('.loader');
    loaders.forEach(l => {
        if(mostrar) l.classList.remove('hidden');
        else l.classList.add('hidden');
    });
}

function mostrarError(mensaje) {
    const banner = document.getElementById('error-banner');
    if(banner) {
        banner.classList.remove('hidden');
        const mensajeElem = banner.querySelector('p');
        if(mensajeElem) mensajeElem.textContent = mensaje;
    }
}

function ocultarError() {
    const banner = document.getElementById('error-banner');
    if(banner) banner.classList.add('hidden');
}

// --- CHART.JS ---
let chartFinanzasInstance = null;
let chartOcupacionInstance = null;

function renderizarGraficoFinanzas(data) {
    const canvas = document.getElementById('ingresosGastosChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (!Array.isArray(data)) {
        console.warn("chartFinanzas no es un array:", data);
        return;
    }

    const mapaDatos = {};
    
    data.forEach(item => {
        if (!mapaDatos[item.date]) {
            mapaDatos[item.date] = { ingresos: 0, gastos: 0 };
        }
        if (item.type === 'ingreso') {
            mapaDatos[item.date].ingresos += (item.amount || 0);
        } else if (item.type === 'gasto') {
            mapaDatos[item.date].gastos += (item.amount || 0);
        }
    });

    const fechas = Object.keys(mapaDatos).sort();
    const datosIngresos = fechas.map(f => mapaDatos[f].ingresos);
    const datosGastos = fechas.map(f => mapaDatos[f].gastos);

    if (chartFinanzasInstance) {
        chartFinanzasInstance.destroy();
    }

    chartFinanzasInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [
                { 
                    label: 'Ingresos', 
                    data: datosIngresos, 
                    borderColor: '#4f46e5', 
                    backgroundColor: 'rgba(79, 70, 229, 0.1)', 
                    tension: 0.4, 
                    fill: true 
                },
                { 
                    label: 'Gastos', 
                    data: datosGastos, 
                    borderColor: '#f43f5e', 
                    backgroundColor: 'rgba(244, 63, 94, 0.05)', 
                    borderDash: [5, 5], 
                    tension: 0.4 
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { beginAtZero: true, grid: { borderDash: [2, 2] } }, 
                x: { grid: { display: false } } 
            } 
        }
    });
}

function renderizarGraficoOcupacion(porcentaje) {
    const canvas = document.getElementById('ocupacionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartOcupacionInstance) {
        chartOcupacionInstance.destroy();
    }

    chartOcupacionInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ocupado', 'Disponible'],
            datasets: [{ 
                data: [porcentaje, 100 - porcentaje], 
                backgroundColor: ['#4f46e5', '#f1f5f9'], 
                borderWidth: 0 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '75%', 
            plugins: { legend: { display: false } } 
        }
    });
}