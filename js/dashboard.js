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
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileMenuOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full');
        
        if (sidebar.classList.contains('-translate-x-full')) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        } else {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        }
    }
}

function cerrarSesion() {
    if(confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        window.location.href = '/index.html';
    }
}

async function cargarDatosDashboard() {
    mostrarLoaders(true);
    ocultarError();

    try {
        const respuesta = await fetch('/api/dashboard');
        
        if (!respuesta.ok) {
            throw new Error(`Error del servidor: ${respuesta.status} ${respuesta.statusText}`);
        }

        const datos = await respuesta.json();

        if (datos.kpi) {
            actualizarKPI('vehiculos', datos.kpi.vehiculos || 0);
            actualizarKPI('libres', datos.kpi.libres || 0);
            actualizarKPI('reservados', datos.kpi.reservados || 0);
            actualizarKPI('ingresos', formatearMoneda(datos.kpi.ingresos));
            actualizarKPI('gastos', formatearMoneda(datos.kpi.gastos));
            actualizarKPI('alertas', datos.kpi.alertas || 0);
            actualizarKPI('clientes', datos.kpi.clientes || 0);
            
            // ACTUALIZACIÓN NUEVA: DEUDORES
            actualizarKPI('deudores', datos.kpi.deudores || 0);
            
            const porcentajeElem = document.getElementById('ocupacion-porcentaje');
            if(porcentajeElem) porcentajeElem.textContent = `${datos.kpi.ocupacionPorcentaje || 0}%`;
        }

        try {
            if (datos.chartFinanzas && Array.isArray(datos.chartFinanzas)) {
                renderizarGraficoFinanzas(datos.chartFinanzas);
            }
        } catch (err) { console.error("Error renderizando finanzas:", err); }

        try {
            renderizarGraficoOcupacion(datos.kpi ? datos.kpi.ocupacionPorcentaje : 0);
        } catch (err) { console.error("Error renderizando ocupación:", err); }

        try {
            if (datos.movimientosRecientes) {
                renderizarMovimientosRecientes(datos.movimientosRecientes);
            }
        } catch (err) { console.error("Error movimientos:", err); }

    } catch (error) {
        console.error('Error cargando dashboard:', error);
        mostrarError(error.message || "Error de conexión desconocido");
    } finally {
        mostrarLoaders(false);
    }
}

function actualizarKPI(key, valor) {
    const elemento = document.querySelector(`[data-kpi="${key}"]`);
    if (elemento) {
        // Si hay un badge numérico dentro, actualizamos ese en lugar de todo el texto
        const badge = elemento.querySelector('.kpi-badge-number');
        if(badge) {
            badge.textContent = valor;
        } else {
            elemento.textContent = valor;
        }
    }
}

function mostrarLoaders(mostrar) {
    const loaders = document.querySelectorAll('.loader');
    loaders.forEach(l => { if(mostrar) l.classList.remove('hidden'); else l.classList.add('hidden'); });
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

let chartFinanzasInstance = null;
let chartOcupacionInstance = null;

function renderizarGraficoFinanzas(data) {
    const canvas = document.getElementById('ingresosGastosChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (!Array.isArray(data)) return;

    const mapaDatos = {};
    data.forEach(item => {
        if (!mapaDatos[item.date]) mapaDatos[item.date] = { ingresos: 0, gastos: 0 };
        if (item.type === 'ingreso') mapaDatos[item.date].ingresos += (item.amount || 0);
        else if (item.type === 'gasto') mapaDatos[item.date].gastos += (item.amount || 0);
    });

    const fechas = Object.keys(mapaDatos).sort();
    const datosIngresos = fechas.map(f => mapaDatos[f].ingresos);
    const datosGastos = fechas.map(f => mapaDatos[f].gastos);

    if (chartFinanzasInstance) chartFinanzasInstance.destroy();

    chartFinanzasInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fechas,
            datasets: [
                { label: 'Ingresos', data: datosIngresos, borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', tension: 0.4, fill: true },
                { label: 'Gastos', data: datosGastos, borderColor: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.05)', borderDash: [5, 5], tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { borderDash: [2, 2] } }, x: { grid: { display: false } } } }
    });
}

function renderizarGraficoOcupacion(porcentaje) {
    const canvas = document.getElementById('ocupacionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartOcupacionInstance) chartOcupacionInstance.destroy();

    chartOcupacionInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ocupado', 'Disponible'],
            datasets: [{ data: [porcentaje, 100 - porcentaje], backgroundColor: ['#4f46e5', '#f1f5f9'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
    });
}

function renderizarMovimientosRecientes(movimientos) {
    const container = document.getElementById('movimientos-container');
    if(!container) return;

    if (!movimientos || movimientos.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-4 text-sm">No hay movimientos recientes.</div>`;
        return;
    }

    let html = '';
    movimientos.forEach(mov => {
        let icon = 'fa-car';
        let color = 'text-blue-600';
        let detalle = mov.spot || mov.plate || "Detalle";
        
        if (mov.type === 'GASTO') {
            icon = 'fa-receipt';
            color = 'text-rose-600';
            detalle = `Gasto: ${mov.spot}`;
        } else if (mov.type === 'CAJA') {
            icon = 'fa-cash-register';
            color = 'text-emerald-600';
            detalle = `Cobro: ${mov.spot}`;
        } else if (mov.type === 'CLIENTE') {
            icon = 'fa-user-plus';
            color = 'text-indigo-600';
            detalle = `Cliente: ${mov.spot}`;
        } else {
            if (mov.exit) color = 'text-slate-600';
            else color = 'text-amber-600';
        }

        html += `
            <div class="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer" onclick="location.href='pages/historial.html'">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center ${color}">
                        <i class="fa-solid ${icon} text-xs"></i>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-slate-800">${mov.type}</p>
                        <p class="text-xs text-slate-500">${detalle} <span class="mx-1">•</span> ${mov.date}</p>
                    </div>
                </div>
                <div class="text-xs text-slate-400">${mov.entry}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}