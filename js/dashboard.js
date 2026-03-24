// parqueo/js/dashboard.js

(function checkAuth() {
    const user = sessionStorage.getItem('parkingUser');
    if (!user) { window.location.replace('index.html'); }
})();

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
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);
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
            overlay.classList.add('hidden'); overlay.classList.remove('flex');
        } else {
            overlay.classList.remove('hidden'); overlay.classList.add('flex');
        }
    }
}

function cerrarSesion() {
    if(confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        sessionStorage.removeItem('parkingUser');
        window.location.replace('index.html');
    }
}

async function cargarDatosDashboard() {
    mostrarLoaders(true);
    ocultarError();

    try {
        const respuesta = await fetch('/api/dashboard');
        if (!respuesta.ok) throw new Error(`Error del servidor: ${respuesta.status}`);
        const datos = await respuesta.json();

        if (datos.kpi) {
            actualizarKPI('vehiculos', datos.kpi.vehiculos || 0);
            actualizarKPI('libres', datos.kpi.libres || 0);
            actualizarKPI('reservados', datos.kpi.reservados || 0);
            actualizarKPI('ingresos', formatearMoneda(datos.kpi.ingresos));
            actualizarKPI('gastos', formatearMoneda(datos.kpi.gastos));
            actualizarKPI('ingresosTotal', formatearMoneda(datos.kpi.ingresosTotal)); // NUEVO
            actualizarKPI('gastosTotal', formatearMoneda(datos.kpi.gastosTotal));     // NUEVO
            actualizarKPI('alertas', datos.kpi.alertas || 0);
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
        
        // Renderizar gráfica nueva (Ocupación Mensual)
        try {
            if (datos.chartOcupacionMes && Array.isArray(datos.chartOcupacionMes)) {
                renderizarGraficoOcupacionMes(datos.chartOcupacionMes);
            }
        } catch (err) { console.error("Error renderizando ocupación mensual:", err); }

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
    if (elemento) elemento.textContent = valor;
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
let chartOcupacionMesInstance = null; // Nueva instancia

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
                { 
                    label: 'Ingresos', 
                    data: datosIngresos, 
                    borderColor: '#4f46e5', 
                    backgroundColor: 'rgba(79, 70, 229, 0.1)', 
                    tension: 0.4, 
                    fill: true,
                    pointRadius: 3
                },
                { 
                    label: 'Gastos', 
                    data: datosGastos, 
                    borderColor: '#f43f5e', 
                    backgroundColor: 'rgba(244, 63, 94, 0)', 
                    borderDash: [5, 5], 
                    tension: 0.4,
                    pointRadius: 3
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true } } 
            }, 
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
    if (chartOcupacionInstance) chartOcupacionInstance.destroy();

    chartOcupacionInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ocupado', 'Disponible'],
            datasets: [{ 
                data: [porcentaje, 100 - porcentaje], 
                backgroundColor: ['#4f46e5', '#f1f5f9'], 
                borderWidth: 0,
                hoverOffset: 4
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

// --- NUEVA FUNCIÓN: Gráfica de Ocupación Mensual ---
function renderizarGraficoOcupacionMes(data) {
    const canvas = document.getElementById('ocupacionMesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartOcupacionMesInstance) chartOcupacionMesInstance.destroy();

    const meses = data.map(d => d.mes.split('-')[1]); // EJ: "2023-10" -> "10"
    const porcentajes = data.map(d => d.porcentaje);

    chartOcupacionMesInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Ocupación Promedio (%)',
                data: porcentajes,
                backgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100 }
            },
            plugins: {
                legend: { display: false }
            }
        }
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
        const tipo = (mov.type || "").toLowerCase();
        if (tipo.includes('gasto')) { icon = 'fa-receipt'; color = 'text-rose-600'; }
        else if (tipo.includes('caja')) { icon = 'fa-cash-register'; color = 'text-emerald-600'; }
        else if (tipo.includes('moto')) { icon = 'fa-motorcycle'; }
        
        let estadoBadge = '';
        if (!mov.exit) {
            estadoBadge = `<span class="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>`;
        }

        html += `
            <div class="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer" onclick="location.href='pages/historial.html'">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center ${color}">
                        <i class="fa-solid ${icon} text-xs"></i>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-slate-800">${mov.type} ${estadoBadge}</p>
                        <p class="text-xs text-slate-500">${mov.plate || '---'} <span class="mx-1">•</span> ${mov.date}</p>
                    </div>
                </div>
                <div class="text-xs text-slate-400 font-mono">${mov.entry}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}