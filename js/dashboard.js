// parqueo/js/dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard: Iniciando...");
    await new Promise(resolve => setTimeout(resolve, 150));
    try {
        await cargarDatosDashboard();
    } catch (error) {
        console.error("Error crítico al iniciar:", error);
        mostrarError("Error fatal: " + error.message);
    }
});

/* ═════════════ PAGINACIÓN: Estado global ═══════════ */
var deudoresData = [];
var deudoresPagina = 1;
var DEUDORES_POR_PAGINA = 4;

var proximosPagosData = [];
var proximosPagosPagina = 1;
var PROXIMOS_PAGOS_POR_PAGINA = 4;

/* ═════════════ HELPERS ═══════════ */
function fmtMoneda(amount) {
    if (typeof window.formatearMoneda === 'function') return window.formatearMoneda(amount);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
}

function esDark() { return document.documentElement.classList.contains('dark'); }
function cTexto() { return esDark() ? '#cbd5e1' : '#475569'; }
function cGrid() { return esDark() ? '#334155' : '#f1f5f9'; }
function cDisponible() { return esDark() ? '#334155' : '#f1f5f9'; }
function cBordeDona() { return esDark() ? '#1e293b' : '#ffffff'; }
function colorOcupacion(pct) { if (pct >= 80) return '#ef4444'; if (pct >= 50) return '#f59e0b'; return '#10b981'; }

function mostrarSinDatos(canvasId, texto) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = esDark() ? '#64748b' : '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto || 'Sin datos aún', canvas.width / 2, canvas.height / 2);
}

function toggleMenu() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('mobileMenuOverlay');
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
    if (confirm('¿Cerrar sesión?')) {
        sessionStorage.removeItem('parkingUser');
        sessionStorage.removeItem('parkingToken');
        window.location.replace('index.html');
    }
}

/* ═════════════ CARGA PRINCIPAL ═══════════ */
async function cargarDatosDashboard() {
    var btnIcon = document.querySelector('button[onclick="cargarDatosDashboard()"] i');
    if (btnIcon) btnIcon.classList.add('fa-spin');
    mostrarLoaders(true);
    ocultarError();

    try {
        var res = await fetch('/api/dashboard', {
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            if (res.status === 401) throw new Error('Sesión expirada.');
            throw new Error('Error del servidor: ' + res.status);
        }

        var d = await res.json();
        console.log("Dashboard datos:", d);

        if (d.kpi) {
            var k = d.kpi;
            setKPI('libres', k.libres || 0);
            setKPI('reservados', k.reservados || 0);
            setKPI('deudores', k.deudores || 0);
            setKPI('clientes', k.clientes || 0);
            setKPI('ingresos', fmtMoneda(k.ingresos));
            setKPI('gastos', fmtMoneda(k.gastos));
            setKPI('carrosDentro', k.carrosDentro || 0);
            setKPI('motosDentro', k.motosDentro || 0);
            setKPI('camionetasDentro', k.camionetasDentro || 0);
            setKPIBalance('balanceHoy', k.balanceHoy || 0);

            var pctEl = document.getElementById('ocupacion-porcentaje');
            if (pctEl) pctEl.textContent = (k.ocupacionPorcentaje || 0) + '%';
        }

        deudoresData = (d.deudores && Array.isArray(d.deudores)) ? d.deudores : [];
        deudoresPagina = 1;
        renderDeudoresDashboard();

        proximosPagosData = (d.proximosPagos && Array.isArray(d.proximosPagos)) ? d.proximosPagos : [];
        proximosPagosPagina = 1;
        renderProximosPagos();

        if (d.chartFinanzas && d.chartFinanzas.length > 0) {
            try { renderFinanzas(d.chartFinanzas); } catch (e) { console.error(e); }
        } else { mostrarSinDatos('ingresosGastosChart', 'Sin datos financieros'); }

        try { renderOcupacion(d.kpi ? d.kpi.ocupacionPorcentaje : 0); } catch (e) { console.error(e); }

        if (d.chartMetodosPago && d.chartMetodosPago.length > 0) {
            try { renderMetodosPago(d.chartMetodosPago); } catch (e) { console.error(e); }
        } else { mostrarSinDatos('metodosPagoChart', 'Sin métodos de pago'); }

        if (d.chartHorasPico && d.chartHorasPico.length > 0) {
            try { renderHorasPico(d.chartHorasPico); } catch (e) { console.error(e); }
        } else { mostrarSinDatos('horasPicoChart', 'Sin actividad aún'); }

        if (d.chartTipoVehiculo && d.chartTipoVehiculo.length > 0) {
            try { renderTipoVehiculo(d.chartTipoVehiculo); } catch (e) { console.error(e); }
        } else { mostrarSinDatos('tipoVehiculoChart', 'Sin datos de vehículos'); }

        if (d.chartTopClientes && d.chartTopClientes.length > 0) {
            try { renderTopClientes(d.chartTopClientes); } catch (e) { console.error(e); }
        } else { mostrarSinDatos('topClientesChart', 'Sin clientes frecuentes'); }

        if (d.movimientosRecientes) {
            try { renderMovimientos(d.movimientosRecientes); } catch (e) { console.error(e); }
        }

    } catch (error) {
        console.error('Error dashboard:', error);
        mostrarError(error.message || "Error de conexión");
        if (error.message.indexOf('Sesión') !== -1 || error.message.indexOf('401') !== -1) {
            setTimeout(function () {
                sessionStorage.removeItem('parkingUser');
                sessionStorage.removeItem('parkingToken');
                window.location.replace('index.html');
            }, 2000);
        }
    } finally {
        mostrarLoaders(false);
        if (btnIcon) btnIcon.classList.remove('fa-spin');
    }
}

function setKPI(key, valor) {
    var el = document.querySelector('[data-kpi="' + key + '"]');
    if (el) el.textContent = valor;
}

function setKPIBalance(key, valor) {
    var el = document.querySelector('[data-kpi="' + key + '"]');
    if (!el) return;
    el.textContent = fmtMoneda(valor);
    if (valor >= 0) {
        el.className = 'text-lg font-bold leading-tight text-emerald-600 dark:text-emerald-400';
    } else {
        el.className = 'text-lg font-bold leading-tight text-rose-600 dark:text-rose-400';
    }
}

function mostrarLoaders(m) {
    var loaders = document.querySelectorAll('.loader');
    for (var i = 0; i < loaders.length; i++) {
        if (m) loaders[i].classList.remove('hidden');
        else loaders[i].classList.add('hidden');
    }
}

function mostrarError(msg) {
    var b = document.getElementById('error-banner');
    if (b) {
        b.classList.remove('hidden');
        var p = b.querySelector('p');
        if (p) p.textContent = msg;
    }
}

function ocultarError() {
    var b = document.getElementById('error-banner');
    if (b) b.classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PAGINACIÓN — 4 items por página
   ═══════════════════════════════════════════════════════════ */
function htmlPaginacion(paginaActual, totalItems, porPagina, fnAnterior, fnSiguiente, fnIrPagina) {
    var totalPaginas = Math.ceil(totalItems / porPagina);
    if (totalPaginas <= 1) return '';

    var inicio = (paginaActual - 1) * porPagina + 1;
    var fin = Math.min(paginaActual * porPagina, totalItems);
    var antDisabled = paginaActual <= 1;
    var sigDisabled = paginaActual >= totalPaginas;

    var html = '<div class="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-slate-600/50 px-1">';

    // Contador izquierdo
    html += '<span class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide">' + inicio + '–' + fin + ' de ' + totalItems + '</span>';

    // Botones + números
    html += '<div class="flex items-center gap-1.5">';

    // Botón ANTERIOR
    if (antDisabled) {
        html += '<span class="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-700/50 select-none"><i class="fa-solid fa-chevron-left mr-1"></i>Ant</span>';
    } else {
        html += '<button onclick="' + fnAnterior + '" class="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer shadow-sm active:scale-95 transition-all"><i class="fa-solid fa-chevron-left mr-1"></i>Ant</button>';
    }

    // Números de página
    for (var i = 1; i <= totalPaginas; i++) {
        if (totalPaginas > 7) {
            if (i !== 1 && i !== totalPaginas && i < paginaActual - 1) {
                if (i === paginaActual - 2) html += '<span class="text-slate-400 dark:text-slate-500 text-[11px] px-1">…</span>';
                continue;
            }
            if (i !== 1 && i !== totalPaginas && i > paginaActual + 1) {
                if (i === paginaActual + 2) html += '<span class="text-slate-400 dark:text-slate-500 text-[11px] px-1">…</span>';
                continue;
            }
        }

        if (i === paginaActual) {
            html += '<span class="w-7 h-7 flex items-center justify-center text-[11px] font-black rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40">' + i + '</span>';
        } else {
            html += '<button onclick="' + fnIrPagina + '(' + i + ')" class="w-7 h-7 flex items-center justify-center text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors">' + i + '</button>';
        }
    }

    // Botón SIGUIENTE
    if (sigDisabled) {
        html += '<span class="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-700/50 select-none">Sig<i class="fa-solid fa-chevron-right ml-1"></i></span>';
    } else {
        html += '<button onclick="' + fnSiguiente + '" class="px-3 py-1.5 text-[11px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 cursor-pointer shadow-sm active:scale-95 transition-all">Sig<i class="fa-solid fa-chevron-right ml-1"></i></button>';
    }

    html += '</div></div>';
    return html;
}

/* ═══════════════════════════════════════════════════════════
   DEUDORES DEL MES — PAGINADO a 4
   ═══════════════════════════════════════════════════════════ */
function irPaginaDeudores(p) { deudoresPagina = p; renderDeudoresDashboard(); }
function antPaginaDeudores() { if (deudoresPagina > 1) { deudoresPagina--; renderDeudoresDashboard(); } }
function sigPaginaDeudores() { var tp = Math.ceil(deudoresData.length / DEUDORES_POR_PAGINA); if (deudoresPagina < tp) { deudoresPagina++; renderDeudoresDashboard(); } }

function renderDeudoresDashboard() {
    var container = document.getElementById('deudores-dashboard-container');
    if (!container) return;

    if (deudoresData.length === 0) {
        container.innerHTML = '<div class="text-center py-5">' +
            '<i class="fa-solid fa-circle-check text-emerald-500 text-3xl mb-2 block"></i>' +
            '<p class="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">¡Todos al día!</p>' +
            '<p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Sin deudores este mes</p></div>';
        return;
    }

    var total = deudoresData.length;
    var inicio = (deudoresPagina - 1) * DEUDORES_POR_PAGINA;
    var fin = Math.min(inicio + DEUDORES_POR_PAGINA, total);
    var pagina = deudoresData.slice(inicio, fin);

    var html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">';

    for (var i = 0; i < pagina.length; i++) {
        var d = pagina[i];
        var phoneClean = (d.telefono || '').replace(/\D/g, '');
        var waMsg = '';
        if (typeof window.generarMensajeDeudorWhatsApp === 'function') {
            waMsg = encodeURIComponent(window.generarMensajeDeudorWhatsApp(d.nombre, d.placa, d.cuota, d.periodicidad));
        }
        var waLink = phoneClean ? 'https://wa.me/57' + phoneClean + '?text=' + waMsg : '#';
        var iconVeh = (d.tipoVehiculo === 'Moto') ? 'fa-motorcycle' : ((d.tipoVehiculo === 'Camioneta') ? 'fa-truck-pickup' : 'fa-car');
        var cajaHref = './pages/caja.html?plate=' + encodeURIComponent(d.placa || '') + '&client=' + encodeURIComponent(d.nombre || '') + '&phone=' + encodeURIComponent(d.telefono || '');

        html += '<div class="deudor-card bg-white dark:bg-slate-700/50 rounded-lg border border-red-100 dark:border-red-900/30 p-3 hover:shadow-md transition-all">';
        html += '<div class="flex justify-between items-start mb-2">';
        html += '<div class="flex items-center gap-2 min-w-0">';
        html += '<i class="fa-solid ' + iconVeh + ' text-red-400 dark:text-red-500 text-xs flex-shrink-0"></i>';
        html += '<span class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">' + (d.nombre || '---') + '</span>';
        html += '</div>';
        html += '<span class="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800/50 flex-shrink-0 ml-2">DEUDOR</span>';
        html += '</div>';

        html += '<div class="flex items-center gap-2 mb-2">';
        html += '<span class="font-mono text-xs bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">' + (d.placa || '---') + '</span>';
        if (d.periodicidad) {
            html += '<span class="text-[10px] text-slate-400 dark:text-slate-500">' + d.periodicidad + '</span>';
        }
        html += '</div>';

        if (d.ultimo_pago) {
            html += '<div class="text-[10px] text-slate-400 dark:text-slate-500 mb-2">Último pago: ' + d.ultimo_pago + '</div>';
        }

        html += '<div class="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-600/50">';
        html += '<a href="' + waLink + '" target="_blank" class="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-xs font-medium transition-colors"><i class="fa-brands fa-whatsapp"></i> Recordar</a>';
        html += '<a href="' + cajaHref + '" class="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-xs font-medium transition-colors"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</a>';
        html += '</div></div>';
    }

    html += '</div>';

    // PAGINACIÓN — siempre se agrega si hay más de 4
    html += htmlPaginacion(deudoresPagina, total, DEUDORES_POR_PAGINA, 'antPaginaDeudores()', 'sigPaginaDeudores()', 'irPaginaDeudores');

    container.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════
   PRÓXIMOS PAGOS — PAGINADO a 4
   ═══════════════════════════════════════════════════════════ */
function irPaginaProximos(p) { proximosPagosPagina = p; renderProximosPagos(); }
function antPaginaProximos() { if (proximosPagosPagina > 1) { proximosPagosPagina--; renderProximosPagos(); } }
function sigPaginaProximos() { var tp = Math.ceil(proximosPagosData.length / PROXIMOS_PAGOS_POR_PAGINA); if (proximosPagosPagina < tp) { proximosPagosPagina++; renderProximosPagos(); } }

function renderProximosPagos() {
    var container = document.getElementById('proximos-pagos-container');
    if (!container) return;

    if (proximosPagosData.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 dark:text-slate-500 py-5 text-sm">' +
            '<i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> Ningún pago próximo en los próximos 7 días</div>';
        return;
    }

    var total = proximosPagosData.length;
    var inicio = (proximosPagosPagina - 1) * PROXIMOS_PAGOS_POR_PAGINA;
    var fin = Math.min(inicio + PROXIMOS_PAGOS_POR_PAGINA, total);
    var pagina = proximosPagosData.slice(inicio, fin);

    var html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">';

    for (var i = 0; i < pagina.length; i++) {
        var p = pagina[i];
        var badgeColor, badgeBg, badgeBorder, badgeText;

        if (p.diasRestantes <= 0) {
            badgeColor = 'text-red-700 dark:text-red-300'; badgeBg = 'bg-red-100 dark:bg-red-900/40'; badgeBorder = 'border-red-200 dark:border-red-800/50'; badgeText = 'VENCIDO';
        } else if (p.diasRestantes === 1) {
            badgeColor = 'text-red-600 dark:text-red-400'; badgeBg = 'bg-red-50 dark:bg-red-900/20'; badgeBorder = 'border-red-200 dark:border-red-800/50'; badgeText = 'MAÑANA';
        } else if (p.diasRestantes <= 2) {
            badgeColor = 'text-amber-600 dark:text-amber-400'; badgeBg = 'bg-amber-50 dark:bg-amber-900/20'; badgeBorder = 'border-amber-200 dark:border-amber-800/50'; badgeText = p.diasRestantes + ' días';
        } else {
            badgeColor = 'text-slate-500 dark:text-slate-400'; badgeBg = 'bg-slate-50 dark:bg-slate-700/50'; badgeBorder = 'border-slate-200 dark:border-slate-600'; badgeText = p.diasRestantes + ' días';
        }

        var iconVeh = (p.tipoVehiculo === 'Moto') ? 'fa-motorcycle' : ((p.tipoVehiculo === 'Camioneta') ? 'fa-truck-pickup' : 'fa-car');
        var ringClass = (p.diasRestantes <= 0) ? 'ring-1 ring-red-200 dark:ring-red-800/50' : '';

        html += '<div class="pago-card bg-white dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600/50 p-3 ' + ringClass + '">';
        html += '<div class="flex justify-between items-start mb-2">';
        html += '<div class="flex items-center gap-2 min-w-0">';
        html += '<i class="fa-solid ' + iconVeh + ' text-slate-400 dark:text-slate-500 text-xs flex-shrink-0"></i>';
        html += '<span class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">' + (p.nombre || '---') + '</span>';
        html += '</div>';
        html += '<span class="text-[10px] font-bold ' + badgeColor + ' ' + badgeBg + ' px-2 py-0.5 rounded-full border ' + badgeBorder + ' flex-shrink-0 ml-2">' + badgeText + '</span>';
        html += '</div>';

        html += '<div class="flex items-center gap-2 mb-2">';
        html += '<span class="font-mono text-xs bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">' + (p.placa || '---') + '</span>';
        if (p.periodicidad) {
            html += '<span class="text-[10px] text-slate-400 dark:text-slate-500">' + p.periodicidad + '</span>';
        }
        html += '</div>';

        html += '<div class="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-600/50">';
        html += '<span class="text-[10px] text-slate-400 dark:text-slate-500">Último: ' + (p.ultimoPago || '---') + '</span>';
        html += '<span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">' + fmtMoneda(p.cuota) + '</span>';
        html += '</div></div>';
    }

    html += '</div>';

    // PAGINACIÓN — siempre se agrega si hay más de 4
    html += htmlPaginacion(proximosPagosPagina, total, PROXIMOS_PAGOS_POR_PAGINA, 'antPaginaProximos()', 'sigPaginaProximos()', 'irPaginaProximos');

    container.innerHTML = html;
}

/* ═════════════ CHARTS ═══════════ */
var chFinanzas = null, chOcupacion = null, chMetodos = null, chHorasPico = null, chTipoVehiculo = null, chTopClientes = null;

function renderFinanzas(data) {
    var canvas = document.getElementById('ingresosGastosChart');
    if (!canvas) return;
    if (chFinanzas) chFinanzas.destroy();

    var mapa = {};
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (!mapa[item.date]) mapa[item.date] = { ingresos: 0, gastos: 0 };
        if (item.type === 'ingreso') mapa[item.date].ingresos += (item.amount || 0);
        else mapa[item.date].gastos += (item.amount || 0);
    }

    var fechas = Object.keys(mapa).sort();
    var labelsArr = [], ingArr = [], gasArr = [];
    for (var f = 0; f < fechas.length; f++) {
        var parts = fechas[f].split('-');
        labelsArr.push(parts[2] + '/' + parts[1]);
        ingArr.push(mapa[fechas[f]].ingresos);
        gasArr.push(mapa[fechas[f]].gastos);
    }

    chFinanzas = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labelsArr,
            datasets: [
                { label: 'Ingresos', data: ingArr, backgroundColor: '#6366f1', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 },
                { label: 'Gastos', data: gasArr, backgroundColor: '#f43f5e', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter' }, color: cTexto() } },
                tooltip: { backgroundColor: '#1e293b', padding: 12, cornerRadius: 8, callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + fmtMoneda(ctx.parsed.y); } } }
            },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 4], color: cGrid() }, ticks: { font: { family: 'Inter' }, color: cTexto(), callback: function (v) { return v >= 1000000 ? '$' + (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'K' : '$' + v; } } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' }, color: cTexto() } }
            }
        }
    });
}

function renderMetodosPago(data) {
    var canvas = document.getElementById('metodosPagoChart');
    if (!canvas) return;
    if (chMetodos) chMetodos.destroy();

    var colores = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4'];
    var total = 0;
    var labelsArr = [], valsArr = [];
    for (var i = 0; i < data.length; i++) {
        labelsArr.push(data[i].metodo);
        valsArr.push(data[i].total);
        total += (data[i].total || 0);
    }

    chMetodos = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labelsArr,
            datasets: [{ data: valsArr, backgroundColor: colores.slice(0, data.length), borderWidth: 2, borderColor: cBordeDona(), hoverOffset: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 }, color: cTexto(), padding: 10 } },
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: function (ctx) { var pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0; return ctx.label + ': ' + fmtMoneda(ctx.parsed) + ' (' + pct + '%)'; } } }
            }
        }
    });
}

function renderHorasPico(data) {
    var canvas = document.getElementById('horasPicoChart');
    if (!canvas) return;
    if (chHorasPico) chHorasPico.destroy();

    var ctx = canvas.getContext('2d');
    var mapa = {};
    for (var i = 0; i < data.length; i++) { mapa[parseInt(data[i].hora)] = data[i].total || 0; }

    var labels = [], valores = [];
    for (var h = 5; h <= 22; h++) {
        labels.push(h.toString().padStart(2, '0') + ':00');
        valores.push(mapa[h] || 0);
    }

    var gradiente = ctx.createLinearGradient(0, 0, 0, 220);
    gradiente.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    gradiente.addColorStop(1, 'rgba(245, 158, 11, 0)');

    var maxVal = Math.max.apply(null, valores);
    var maxIdx = valores.indexOf(maxVal);

    var pointBg = [], pointBd = [], pointRd = [];
    for (var p = 0; p < valores.length; p++) {
        var isActive = p === maxIdx;
        pointBg.push(isActive ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)');
        pointBd.push(isActive ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)');
        pointRd.push(isActive ? 6 : 0);
    }

    chHorasPico = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Vehículos', data: valores, borderColor: '#f59e0b', backgroundColor: gradiente, borderWidth: 2.5, fill: true, tension: 0.4, pointBackgroundColor: pointBg, pointBorderColor: pointBd, pointRadius: pointRd, pointHoverRadius: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: function (ctx) { return ctx.parsed.y + ' vehículo' + (ctx.parsed.y !== 1 ? 's' : '') + ' (promedio)'; } } } },
            scales: {
                y: { beginAtZero: true, grid: { color: cGrid() }, ticks: { stepSize: 1, font: { family: 'Inter', size: 10 }, color: cTexto() } },
                x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, color: cTexto(), maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }
            }
        }
    });
}

function renderOcupacion(porcentaje) {
    var canvas = document.getElementById('ocupacionChart');
    if (!canvas) return;
    if (chOcupacion) chOcupacion.destroy();

    chOcupacion = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Ocupado', 'Disponible'], datasets: [{ data: [porcentaje, 100 - porcentaje], backgroundColor: [colorOcupacion(porcentaje), cDisponible()], borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
}

function renderTipoVehiculo(data) {
    var canvas = document.getElementById('tipoVehiculoChart');
    if (!canvas) return;
    if (chTipoVehiculo) chTipoVehiculo.destroy();

    var mapaColores = { 'Carro': '#3b82f6', 'Moto': '#f59e0b', 'Camioneta': '#8b5cf6', 'Bicicleta': '#10b981' };
    var coloresDefault = ['#6366f1', '#f43f5e', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6'];
    var total = 0;
    var labelsArr = [], valsArr = [], bgArr = [];
    for (var i = 0; i < data.length; i++) {
        labelsArr.push(data[i].tipo || 'Otro');
        valsArr.push(data[i].total);
        bgArr.push(mapaColores[data[i].tipo] || coloresDefault[i % coloresDefault.length]);
        total += (data[i].total || 0);
    }

    chTipoVehiculo = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: labelsArr, datasets: [{ data: valsArr, backgroundColor: bgArr, borderWidth: 2, borderColor: cBordeDona(), hoverOffset: 6 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '55%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 }, color: cTexto(), padding: 12 } },
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: function (ctx) { var pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0; return ctx.label + ': ' + ctx.parsed + ' (' + pct + '%)'; } } }
            }
        }
    });
}

function renderTopClientes(data) {
    var canvas = document.getElementById('topClientesChart');
    if (!canvas) return;
    if (chTopClientes) chTopClientes.destroy();

    var invertido = data.slice().reverse();
    var colores = ['#94a3b8', '#94a3b8', '#94a3b8', '#f59e0b', '#f59e0b'];
    var labelsArr = [], valsArr = [], bgArr = [];
    for (var i = 0; i < invertido.length; i++) {
        labelsArr.push(invertido[i].plate || '---');
        valsArr.push(invertido[i].total);
        bgArr.push(colores[i]);
    }

    chTopClientes = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: labelsArr, datasets: [{ label: 'Visitas', data: valsArr, backgroundColor: bgArr, borderRadius: 4, barPercentage: 0.7 }] },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: function (ctx) { return ctx.parsed.x + ' visita' + (ctx.parsed.x !== 1 ? 's' : ''); } } } },
            scales: {
                x: { beginAtZero: true, grid: { color: cGrid() }, ticks: { stepSize: 1, font: { family: 'Inter', size: 10 }, color: cTexto() } },
                y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11, weight: 'bold' }, color: cTexto() } }
            }
        }
    });
}

function renderMovimientos(movimientos) {
    var container = document.getElementById('movimientos-container');
    if (!container) return;

    if (!movimientos || movimientos.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">No hay movimientos recientes.</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < movimientos.length; i++) {
        var mov = movimientos[i];
        var icon = 'fa-car', color = 'text-blue-600';
        var tipo = (mov.type || '').toLowerCase();

        if (tipo.indexOf('gasto') !== -1) { icon = 'fa-receipt'; color = 'text-rose-600'; }
        else if (tipo.indexOf('caja') !== -1 || tipo.indexOf('pago') !== -1) { icon = 'fa-cash-register'; color = 'text-emerald-600'; }
        else if (tipo.indexOf('moto') !== -1) { icon = 'fa-motorcycle'; }
        else if (tipo.indexOf('salida') !== -1) { icon = 'fa-right-from-bracket'; color = 'text-orange-600'; }
        else if (tipo.indexOf('entrada') !== -1) { icon = 'fa-right-to-bracket'; color = 'text-green-600'; }

        var badge = (!mov.exit) ? '<span class="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>' : '';

        html += '<div class="flex items-center justify-between p-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onclick="location.href=\'./pages/historial.html\'">';
        html += '<div class="flex items-center gap-3">';
        html += '<div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center ' + color + '"><i class="fa-solid ' + icon + ' text-xs"></i></div>';
        html += '<div>';
        html += '<p class="text-sm font-medium text-slate-800 dark:text-slate-200">' + (mov.type || '') + ' ' + badge + '</p>';
        html += '<p class="text-xs text-slate-500 dark:text-slate-400">' + (mov.plate || '---') + ' <span class="mx-1">•</span> ' + (mov.date || '') + '</p>';
        html += '</div></div>';
        html += '<div class="text-xs text-slate-400 dark:text-slate-500 font-mono">' + (mov.entry || '') + '</div>';
        html += '</div>';
    }

    container.innerHTML = html;
}