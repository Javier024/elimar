// parqueo/js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard: Iniciando...");
    mostrarFechaYHora();
    actualizarSaludo();
    iniciarReloj();       
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

function mostrarFechaYHora() {
    try {
        const fechaElemento = document.getElementById('fecha-actual');
        if (fechaElemento) {
            actualizarTextoHora();
        }
    } catch (e) { console.error("Error fecha:", e); }
}

function actualizarTextoHora() {
    const fechaElemento = document.getElementById('fecha-actual');
    if (!fechaElemento) return;

    const ahora = new Date();
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    const opcionesHora = { hour: 'numeric', minute: '2-digit' };
    
    const textoFecha = ahora.toLocaleDateString('es-ES', opcionesFecha);
    const textoHora = ahora.toLocaleTimeString('es-ES', opcionesHora);
    
    const fechaFormateada = textoFecha.charAt(0).toUpperCase() + textoFecha.slice(1);
    
    fechaElemento.innerHTML = `<span class="hidden sm:inline">${fechaFormateada}</span> <span class="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded ml-1">${textoHora}</span>`;
}

function iniciarReloj() {
    setInterval(actualizarTextoHora, 60000);
}

function actualizarSaludo() {
    const usuario = JSON.parse(sessionStorage.getItem('parkingUser'));
    const usuarioDisplay = document.getElementById('sidebar-user-name');
    
    if (usuario && usuarioDisplay) {
        const hora = new Date().getHours();
        let saludo = "Buenas noches";
        
        if (hora >= 5 && hora < 12) saludo = "Buenos días";
        else if (hora >= 12 && hora < 19) saludo = "Buenas tardes";
        
        usuarioDisplay.innerHTML = `<span class="text-indigo-600 font-bold">${saludo},</span> ${usuario.nombre.split(' ')[0]}`;
    }
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
    const btnIcon = document.querySelector('button[onclick="cargarDatosDashboard()"] i');
    if(btnIcon) btnIcon.classList.add('fa-spin');
    
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
            actualizarKPI('ingresosTotal', formatearMoneda(datos.kpi.ingresosTotal));
            actualizarKPI('gastosTotal', formatearMoneda(datos.kpi.gastosTotal));
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
        
        try {
            if (datos.chartOcupacionMes && Array.isArray(datos.chartOcupacionMes)) {
                renderizarGraficaOcupacionMes(datos.chartOcupacionMes);
            }
        } catch (err) { console.error("Error renderizando ocupación mensual:", err); }

        try {
            if (datos.chartMetodosPago && Array.isArray(datos.chartMetodosPago)) {
                renderizarGraficaMetodosPago(datos.chartMetodosPago);
            }
        } catch (err) { console.error("Error renderizando métodos:", err); }

        // NUEVA GRÁFICA SEMANAL
        try {
            if (datos.chartSemanal && Array.isArray(datos.chartSemanal)) {
                renderizarGraficaSemanal(datos.chartSemanal);
            }
        } catch (err) { console.error("Error renderizando gráfica semanal:", err); }

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
        if(btnIcon) btnIcon.classList.remove('fa-spin');
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
let chartOcupacionMesInstance = null;
let chartMetodosPagoInstance = null;
let chartSemanalInstance = null; // Nueva instancia

// --- MODIFICADA: Ahora es Gráfico de Barras ---
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
        type: 'bar', // CAMBIO: De 'line' a 'bar'
        data: {
            labels: fechas.map(f => {
                // Formatear fecha DD/MM para mejor lectura en barras
                const parts = f.split('-');
                return `${parts[2]}/${parts[1]}`;
            }),
            datasets: [
                { 
                    label: 'Ingresos', 
                    data: datosIngresos, 
                    backgroundColor: '#6366f1', // Color sólido
                    borderRadius: 4, // Bordes redondeados estilo moderno
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                },
                { 
                    label: 'Gastos', 
                    data: datosGastos, 
                    backgroundColor: '#f43f5e', // Color sólido
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter' } } },
                tooltip: { 
                    backgroundColor: '#1e293b',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { size: 13 },
                    bodyFont: { size: 13 }
                }
            }, 
            scales: { 
                y: { 
                    beginAtZero: true, 
                    grid: { borderDash: [2, 4], color: '#f1f5f9' },
                    ticks: { font: { family: 'Inter' } }
                }, 
                x: { 
                    grid: { display: false },
                    ticks: { font: { family: 'Inter' } }
                } 
            } 
        }
    });
}

// --- NUEVA: Gráfica Semanal ---
function renderizarGraficaSemanal(data) {
    const canvas = document.getElementById('semanalChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!Array.isArray(data)) return;
    if (chartSemanalInstance) chartSemanalInstance.destroy();

    const labels = data.map(d => {
        const parts = d.fecha.split('-');
        return `${parts[2]}/${parts[1]}`;
    });
    const valores = data.map(d => d.total);

    chartSemanalInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Movimientos',
                data: valores,
                backgroundColor: '#0ea5e9', // Azul cielo
                borderRadius: 4,
                barPercentage: 0.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f1f5f9' },
                    ticks: { stepSize: 1, font: { family: 'Inter' } } // Enteros para coches
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 10,
                    cornerRadius: 6
                }
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
            cutout: '80%', 
            plugins: { legend: { display: false } } 
        }
    });
}

function renderizarGraficaOcupacionMes(data) {
    const canvas = document.getElementById('ocupacionMesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartOcupacionMesInstance) chartOcupacionMesInstance.destroy();

    const labels = data.map(d => {
        const fecha = new Date(d.mes + '-01');
        return fecha.toLocaleDateString('es-ES', { month: 'short' });
    });
    const valores = data.map(d => d.total_movimientos);

    chartOcupacionMesInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Movimientos',
                data: valores,
                backgroundColor: '#8b5cf6', // Violeta
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { family: 'Inter' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 10,
                    cornerRadius: 6
                }
            }
        }
    });
}

function renderizarGraficaMetodosPago(data) {
    const canvas = document.getElementById('metodosPagoChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartMetodosPagoInstance) chartMetodosPagoInstance.destroy();

    const labels = data.map(d => d.metodo);
    const valores = data.map(d => d.total);
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']; 

    chartMetodosPagoInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { family: 'Inter', size: 12 }
                    }
                }
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