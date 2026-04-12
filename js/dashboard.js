// parqueo/js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard: Iniciando...");
    actualizarSaludo();
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
        await cargarDatosDashboard();
    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        mostrarError("Error fatal: " + error.message);
    }
});

const formatearMoneda = (amount) => {
    const valor = amount || 0;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);
};

function actualizarSaludo() {
    const usuario = JSON.parse(sessionStorage.getItem('parkingUser'));
    const el = document.getElementById('sidebar-user-name');
    if (usuario && el) {
        const h = new Date().getHours();
        let s = "Buenas noches";
        if (h >= 5 && h < 12) s = "Buenos días";
        else if (h >= 12 && h < 19) s = "Buenas tardes";
        el.innerHTML = `<span class="text-indigo-600 font-bold">${s},</span> ${usuario.nombre.split(' ')[0]}`;
    }
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileMenuOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full');
        if (sidebar.classList.contains('-translate-x-full')) { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }
        else { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }
    }
}

function cerrarSesion() {
    if (confirm('¿Cerrar sesión?')) { sessionStorage.removeItem('parkingUser'); window.location.replace('index.html'); }
}

/* ═══════════ HELPERS DE TEMA ═══════════ */
function esDark() { return document.documentElement.classList.contains('dark'); }
function cTexto() { return esDark() ? '#cbd5e1' : '#475569'; }
function cGrid() { return esDark() ? '#334155' : '#f1f5f9'; }
function cDisponible() { return esDark() ? '#334155' : '#f1f5f9'; }
function cBordeDona() { return esDark() ? '#1e293b' : '#ffffff'; }

function colorOcupacion(pct) {
    if (pct >= 80) return '#ef4444';
    if (pct >= 50) return '#f59e0b';
    return '#10b981';
}

/* ═══════════ TEXTO "SIN DATOS" ═══════════ */
function mostrarSinDatos(canvasId, texto) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = esDark() ? '#64748b' : '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto || 'Sin datos aún', canvas.width / 2, canvas.height / 2);
}

/* ═══════════ DATOS PRINCIPALES ═══════════ */
async function cargarDatosDashboard() {
    const btnIcon = document.querySelector('button[onclick="cargarDatosDashboard()"] i');
    if (btnIcon) btnIcon.classList.add('fa-spin');
    mostrarLoaders(true);
    ocultarError();

    try {
        const res = await fetch('/api/dashboard', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) {
            if (res.status === 401) throw new Error('Sesión expirada.');
            throw new Error('Error del servidor: ' + res.status);
        }
        const d = await res.json();

        if (d.kpi) {
            const k = d.kpi;

            // KPIs
            actualizarKPI('libres', k.libres || 0);
            actualizarKPI('reservados', k.reservados || 0);
            actualizarKPI('deudores', k.deudores || 0);
            actualizarKPI('clientes', k.clientes || 0);
            actualizarKPI('ingresos', formatearMoneda(k.ingresos));
            actualizarKPI('gastos', formatearMoneda(k.gastos));

            // Desglose por tipo
            actualizarKPI('carrosDentro', k.carrosDentro || 0);
            actualizarKPI('motosDentro', k.motosDentro || 0);
            actualizarKPI('camionetasDentro', k.camionetasDentro || 0);

            // Balance con color dinámico
            actualizarKPIBalance('balanceHoy', k.balanceHoy || 0);

            // Ocupación
            const pctEl = document.getElementById('ocupacion-porcentaje');
            if (pctEl) pctEl.textContent = (k.ocupacionPorcentaje || 0) + '%';
        }

        // Gráficas
        if (d.chartFinanzas && d.chartFinanzas.length > 0) {
            try { renderFinanzas(d.chartFinanzas); } catch(e) { console.error(e); }
        } else { mostrarSinDatos('ingresosGastosChart', 'Sin datos financieros'); }

        try { renderOcupacion(d.kpi ? d.kpi.ocupacionPorcentaje : 0); } catch(e) { console.error(e); }

        if (d.chartMetodosPago && d.chartMetodosPago.length > 0) {
            try { renderMetodosPago(d.chartMetodosPago); } catch(e) { console.error(e); }
        } else { mostrarSinDatos('metodosPagoChart', 'Sin métodos de pago'); }

        if (d.chartHorasPico && d.chartHorasPico.length > 0) {
            try { renderHorasPico(d.chartHorasPico); } catch(e) { console.error(e); }
        } else { mostrarSinDatos('horasPicoChart', 'Sin actividad aún'); }

        if (d.chartTipoVehiculo && d.chartTipoVehiculo.length > 0) {
            try { renderTipoVehiculo(d.chartTipoVehiculo); } catch(e) { console.error(e); }
        } else { mostrarSinDatos('tipoVehiculoChart', 'Sin datos de vehículos'); }

        if (d.chartTopClientes && d.chartTopClientes.length > 0) {
            try { renderTopClientes(d.chartTopClientes); } catch(e) { console.error(e); }
        } else { mostrarSinDatos('topClientesChart', 'Sin clientes frecuentes'); }

        if (d.movimientosRecientes) {
            try { renderMovimientos(d.movimientosRecientes); } catch(e) { console.error(e); }
        }

    } catch (error) {
        console.error('Error dashboard:', error);
        mostrarError(error.message || "Error de conexión");
        if (error.message.includes('Sesión') || error.message.includes('401'))
            setTimeout(() => { sessionStorage.removeItem('parkingUser'); window.location.replace('index.html'); }, 2000);
    } finally {
        mostrarLoaders(false);
        if (btnIcon) btnIcon.classList.remove('fa-spin');
    }
}

/* ═══════════ ACTUALIZADORES ═══════════ */
function actualizarKPI(key, valor) {
    const el = document.querySelector(`[data-kpi="${key}"]`);
    if (el) el.textContent = valor;
}

function actualizarKPIBalance(key, valor) {
    const el = document.querySelector(`[data-kpi="${key}"]`);
    if (!el) return;
    el.textContent = formatearMoneda(valor);
    el.className = valor >= 0
        ? 'text-lg font-bold leading-tight text-emerald-600 dark:text-emerald-400'
        : 'text-lg font-bold leading-tight text-rose-600 dark:text-rose-400';
}

function mostrarLoaders(m) { document.querySelectorAll('.loader').forEach(l => { if(m) l.classList.remove('hidden'); else l.classList.add('hidden'); }); }
function mostrarError(msg) { const b = document.getElementById('error-banner'); if(b) { b.classList.remove('hidden'); const p = b.querySelector('p'); if(p) p.textContent = msg; } }
function ocultarError() { const b = document.getElementById('error-banner'); if(b) b.classList.add('hidden'); }

/* ═══════════ INSTANCIAS ═══════════ */
let chFinanzas = null, chOcupacion = null, chMetodos = null, chHorasPico = null, chTipoVehiculo = null, chTopClientes = null;

/* ═══════════ 1. FLUJO FINANCIERO ═══════════ */
function renderFinanzas(data) {
    const canvas = document.getElementById('ingresosGastosChart');
    if (!canvas) return;
    if (chFinanzas) chFinanzas.destroy();

    const mapa = {};
    data.forEach(i => {
        if (!mapa[i.date]) mapa[i.date] = { ingresos: 0, gastos: 0 };
        if (i.type === 'ingreso') mapa[i.date].ingresos += (i.amount || 0);
        else mapa[i.date].gastos += (i.amount || 0);
    });
    const fechas = Object.keys(mapa).sort();

    chFinanzas = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: fechas.map(f => { const p = f.split('-'); return p[2] + '/' + p[1]; }),
            datasets: [
                { label: 'Ingresos', data: fechas.map(f => mapa[f].ingresos), backgroundColor: '#6366f1', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 },
                { label: 'Gastos', data: fechas.map(f => mapa[f].gastos), backgroundColor: '#f43f5e', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter' }, color: cTexto() } },
                tooltip: { backgroundColor: '#1e293b', padding: 12, cornerRadius: 8, callbacks: { label: ctx => ctx.dataset.label + ': ' + formatearMoneda(ctx.parsed.y) } }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2,4], color: cGrid() }, ticks: { font: { family: 'Inter' }, color: cTexto(), callback: v => v >= 1000000 ? '$'+(v/1000000).toFixed(1)+'M' : v >= 1000 ? '$'+(v/1000).toFixed(0)+'K' : '$'+v } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' }, color: cTexto() } }
            }
        }
    });
}

/* ═══════════ 2. MÉTODOS DE PAGO ═══════════ */
function renderMetodosPago(data) {
    const canvas = document.getElementById('metodosPagoChart');
    if (!canvas) return;
    if (chMetodos) chMetodos.destroy();

    const colores = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#f43f5e','#06b6d4'];
    const total = data.reduce((s, d) => s + (d.total || 0), 0);

    chMetodos = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.metodo),
            datasets: [{ data: data.map(d => d.total), backgroundColor: colores.slice(0, data.length), borderWidth: 2, borderColor: cBordeDona(), hoverOffset: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 }, color: cTexto(), padding: 10 } },
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => { const pct = total > 0 ? ((ctx.parsed/total)*100).toFixed(1) : 0; return ctx.label + ': ' + formatearMoneda(ctx.parsed) + ' (' + pct + '%)'; } } }
            }
        }
    });
}

/* ═══════════ 3. HORAS PICO ═══════════ */
function renderHorasPico(data) {
    const canvas = document.getElementById('horasPicoChart');
    if (!canvas) return;
    if (chHorasPico) chHorasPico.destroy();

    const ctx = canvas.getContext('2d');
    const mapa = {};
    data.forEach(d => { mapa[parseInt(d.hora)] = d.total || 0; });
    const labels = [];
    const valores = [];
    for (let h = 5; h <= 22; h++) {
        labels.push(h.toString().padStart(2, '0') + ':00');
        valores.push(mapa[h] || 0);
    }

    const gradiente = ctx.createLinearGradient(0, 0, 0, 220);
    gradiente.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    gradiente.addColorStop(1, 'rgba(245, 158, 11, 0)');

    const maxVal = Math.max(...valores);
    const maxIdx = valores.indexOf(maxVal);
    const pointColors = valores.map((v, i) => i === maxIdx ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)');
    const pointRadii = valores.map((v, i) => i === maxIdx ? 6 : 0);

    chHorasPico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vehículos', data: valores, borderColor: '#f59e0b', backgroundColor: gradiente,
                borderWidth: 2.5, fill: true, tension: 0.4,
                pointBackgroundColor: pointColors, pointBorderColor: pointColors,
                pointRadius: pointRadii, pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => ctx.parsed.y + ' vehículo' + (ctx.parsed.y !== 1 ? 's' : '') + ' (promedio)' } } },
            scales: {
                y: { beginAtZero: true, grid: { color: cGrid() }, ticks: { stepSize: 1, font: { family: 'Inter', size: 10 }, color: cTexto() } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, color: cTexto(), maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }
            }
        }
    });
}

/* ═══════════ 4. OCUPACIÓN ACTUAL ═══════════ */
function renderOcupacion(porcentaje) {
    const canvas = document.getElementById('ocupacionChart');
    if (!canvas) return;
    if (chOcupacion) chOcupacion.destroy();

    chOcupacion = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Ocupado', 'Disponible'],
            datasets: [{ data: [porcentaje, 100 - porcentaje], backgroundColor: [colorOcupacion(porcentaje), cDisponible()], borderWidth: 0, hoverOffset: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
}

/* ═══════════ 5. TIPO DE VEHÍCULO ═══════════ */
function renderTipoVehiculo(data) {
    const canvas = document.getElementById('tipoVehiculoChart');
    if (!canvas) return;
    if (chTipoVehiculo) chTipoVehiculo.destroy();

    const mapaColores = { 'Carro': '#3b82f6', 'Moto': '#f59e0b', 'Camioneta': '#8b5cf6', 'Bicicleta': '#10b981' };
    const coloresDefault = ['#6366f1','#f43f5e','#0ea5e9','#f59e0b','#10b981','#8b5cf6'];
    const total = data.reduce((s, d) => s + (d.total || 0), 0);

    chTipoVehiculo = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.tipo || 'Otro'),
            datasets: [{ data: data.map(d => d.total), backgroundColor: data.map((d, i) => mapaColores[d.tipo] || coloresDefault[i % coloresDefault.length]), borderWidth: 2, borderColor: cBordeDona(), hoverOffset: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '55%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 }, color: cTexto(), padding: 12 } },
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => { const pct = total > 0 ? ((ctx.parsed/total)*100).toFixed(1) : 0; return ctx.label + ': ' + ctx.parsed + ' (' + pct + '%)'; } } }
            }
        }
    });
}

/* ═══════════ 6. TOP 5 CLIENTES ═══════════ */
function renderTopClientes(data) {
    const canvas = document.getElementById('topClientesChart');
    if (!canvas) return;
    if (chTopClientes) chTopClientes.destroy();

    const invertido = data.slice().reverse();
    const colores = ['#94a3b8','#94a3b8','#94a3b8','#f59e0b','#f59e0b'];

    chTopClientes = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: invertido.map(d => d.plate || '---'),
            datasets: [{ label: 'Visitas', data: invertido.map(d => d.total), backgroundColor: invertido.map((d, i) => colores[i]), borderRadius: 4, barPercentage: 0.7 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => ctx.parsed.x + ' visita' + (ctx.parsed.x !== 1 ? 's' : '') } } },
            scales: {
                x: { beginAtZero: true, grid: { color: cGrid() }, ticks: { stepSize: 1, font: { family: 'Inter', size: 10 }, color: cTexto() } },
                y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11, weight: 'bold' }, color: cTexto() } }
            }
        }
    });
}

/* ═══════════ 7. MOVIMIENTOS RECIENTES ═══════════ */
function renderMovimientos(movimientos) {
    const container = document.getElementById('movimientos-container');
    if (!container) return;

    if (!movimientos || movimientos.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">No hay movimientos recientes.</div>';
        return;
    }

    let html = '';
    movimientos.forEach(mov => {
        let icon = 'fa-car', color = 'text-blue-600';
        const tipo = (mov.type || '').toLowerCase();
        if (tipo.includes('gasto')) { icon = 'fa-receipt'; color = 'text-rose-600'; }
        else if (tipo.includes('caja')) { icon = 'fa-cash-register'; color = 'text-emerald-600'; }
        else if (tipo.includes('moto')) { icon = 'fa-motorcycle'; }

        const badge = !mov.exit ? '<span class="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>' : '';

        html += `
            <div class="flex items-center justify-between p-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onclick="location.href='pages/historial.html'">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center ${color}">
                        <i class="fa-solid ${icon} text-xs"></i>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-slate-800 dark:text-slate-200">${mov.type} ${badge}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">${mov.plate || '---'} <span class="mx-1">•</span> ${mov.date}</p>
                    </div>
                </div>
                <div class="text-xs text-slate-400 dark:text-slate-500 font-mono">${mov.entry}</div>
            </div>`;
    });
    container.innerHTML = html;
}