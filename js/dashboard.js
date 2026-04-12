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
        el.innerHTML = `<span class="text-indigo-600 dark:text-indigo-400 font-bold">${s},</span> ${usuario.nombre.split(' ')[0]}`;
    }
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
    if (confirm('¿Cerrar sesión?')) { 
        sessionStorage.removeItem('parkingUser'); 
        sessionStorage.removeItem('parkingToken');
        window.location.replace('index.html'); 
    }
}

function esDark() { return document.documentElement.classList.contains('dark'); }
function cTexto() { return esDark() ? '#cbd5e1' : '#475569'; }
function cGrid() { return esDark() ? '#334155' : '#f1f5f9'; }
function cDisponible() { return esDark() ? '#334155' : '#f1f5f9'; }
function cBordeDona() { return esDark() ? '#1e293b' : '#ffffff'; }
function colorOcupacion(pct) { if (pct >= 80) return '#ef4444'; if (pct >= 50) return '#f59e0b'; return '#10b981'; }

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

async function cargarDatosDashboard() {
    const btnIcon = document.querySelector('button[onclick="cargarDatosDashboard()"] i');
    if (btnIcon) btnIcon.classList.add('fa-spin');
    mostrarLoaders(true);
    ocultarError();

    try {
        const res = await fetch('/api/dashboard', { 
            credentials: 'same-origin', 
            headers: { 'Content-Type': 'application/json' } 
        });
        
        if (!res.ok) {
            if (res.status === 401) throw new Error('Sesión expirada.');
            throw new Error('Error del servidor: ' + res.status);
        }
        
        const d = await res.json();
        console.log("Datos del dashboard:", d); // DEBUG

        if (d.kpi) {
            const k = d.kpi;
            actualizarKPI('libres', k.libres || 0);
            actualizarKPI('reservados', k.reservados || 0);
            actualizarKPI('deudores', k.deudores || 0);
            actualizarKPI('clientes', k.clientes || 0);
            actualizarKPI('ingresos', formatearMoneda(k.ingresos));
            actualizarKPI('gastos', formatearMoneda(k.gastos));
            actualizarKPI('carrosDentro', k.carrosDentro || 0);
            actualizarKPI('motosDentro', k.motosDentro || 0);
            actualizarKPI('camionetasDentro', k.camionetasDentro || 0);
            actualizarKPIBalance('balanceHoy', k.balanceHoy || 0);
            
            const pctEl = document.getElementById('ocupacion-porcentaje');
            if (pctEl) pctEl.textContent = (k.ocupacionPorcentaje || 0) + '%';
            
            // DEBUG: Mostrar cantidad de deudores en consola
            console.log("Deudores encontrados:", k.deudores);
        }

        // NUEVO: Renderizar sección de deudores
        if (d.deudores) {
            try { 
                renderDeudoresDashboard(d.deudores, d.kpi?.deudores || 0); 
            } catch(e) { 
                console.error("Error renderizando deudores:", e); 
            }
        }

        if (d.proximosPagos) {
            try { renderProximosPagos(d.proximosPagos); } catch(e) { console.error(e); }
        } else {
            const ppContainer = document.getElementById('proximos-pagos-container');
            if (ppContainer) ppContainer.innerHTML = '<div class="text-center text-slate-400 dark:text-slate-500 py-4 text-sm">Sin pagos próximos</div>';
        }

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
            setTimeout(() => { 
                sessionStorage.removeItem('parkingUser'); 
                sessionStorage.removeItem('parkingToken');
                window.location.replace('index.html'); 
            }, 2000);
    } finally {
        mostrarLoaders(false);
        if (btnIcon) btnIcon.classList.remove('fa-spin');
    }
}

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

function mostrarLoaders(m) { 
    document.querySelectorAll('.loader').forEach(l => { 
        if(m) l.classList.remove('hidden'); 
        else l.classList.add('hidden'); 
    }); 
}

function mostrarError(msg) { 
    const b = document.getElementById('error-banner'); 
    if(b) { 
        b.classList.remove('hidden'); 
        const p = b.querySelector('p'); 
        if(p) p.textContent = msg; 
    } 
}

function ocultarError() { 
    const b = document.getElementById('error-banner'); 
    if(b) b.classList.add('hidden'); 
}

/* ═════════════ NUEVO: SECCIÓN DEUDORES EN DASHBOARD ═══════════ */
function renderDeudoresDashboard(deudores, total) {
    const container = document.getElementById('deudores-dashboard-container');
    if (!container) return;

    if (!deudores || deudores.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fa-solid fa-check-circle text-emerald-500 text-2xl mb-2"></i>
                <p class="text-sm text-emerald-600 dark:text-emerald-400 font-medium">¡Todos al día! 🎉</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Sin deudores este mes</p>
            </div>`;
        return;
    }

    let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">';
    
    deudores.forEach(function(d) {
        const phoneClean = (d.telefono || '').replace(/\D/g, '');
        const whatsappLink = phoneClean ? `https://wa.me/57${phoneClean}?text=Hola ${d.nombre}, te recordamos que tienes el servicio del parqueadero pendiente de este mes.` : '#';
        const iconVeh = d.tipo_vehiculo === 'Moto' ? 'fa-motorcycle' : (d.tipo_vehiculo === 'Camioneta' ? 'fa-truck-pickup' : 'fa-car');
        
        html += `
            <div class="deudor-card bg-white dark:bg-slate-700/50 rounded-lg border border-red-100 dark:border-red-900/30 p-3 hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <i class="fa-solid ${iconVeh} text-red-400 dark:text-red-500 text-xs flex-shrink-0"></i>
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">${d.nombre}</span>
                    </div>
                    <span class="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800/50 flex-shrink-0 ml-2">DEUDOR</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="font-mono text-xs bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">${d.placa}</span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500">${d.periodicidad || ''}</span>
                </div>
                ${d.ultimo_pago ? `<div class="text-[10px] text-slate-400 dark:text-slate-500 mb-2">Último pago: ${d.ultimo_pago}</div>` : ''}
                <div class="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-600/50">
                    <a href="${whatsappLink}" target="_blank" class="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-xs font-medium transition-colors">
                        <i class="fa-brands fa-whatsapp"></i> Recordar
                    </a>
                    <a href="./pages/caja.html?plate=${encodeURIComponent(d.placa)}&client=${encodeURIComponent(d.nombre)}&phone=${encodeURIComponent(d.telefono || '')}" class="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-xs font-medium transition-colors">
                        <i class="fa-solid fa-money-bill-wave"></i> Cobrar
                    </a>
                </div>
            </div>`;
    });
    
    html += '</div>';
    
    // Agregar enlace para ver todos
    if (total > deudores.length) {
        html += `
            <div class="mt-3 text-center">
                <a href="./pages/caja.html" class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 inline-flex items-center gap-1">
                    Ver todos los ${total} deudores <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </a>
            </div>`;
    }
    
    container.innerHTML = html;
}

/* ═════════════ PRÓXIMOS PAGOS POR VENCER ═══════════ */
function renderProximosPagos(data) {
    const container = document.getElementById('proximos-pagos-container');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 dark:text-slate-500 py-4 text-sm"><i class="fa-solid fa-check-circle text-emerald-400 mr-1"></i> Ningún pago próximo en los próximos 7 días</div>';
        return;
    }

    let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">';

    data.forEach(function(p) {
        let badgeColor, badgeBg, badgeBorder, badgeText;

        if (p.diasRestantes <= 0) {
            badgeColor = 'text-red-700 dark:text-red-300';
            badgeBg = 'bg-red-100 dark:bg-red-900/40';
            badgeBorder = 'border-red-200 dark:border-red-800/50';
            badgeText = 'VENCIDO';
        } else if (p.diasRestantes === 1) {
            badgeColor = 'text-red-600 dark:text-red-400';
            badgeBg = 'bg-red-50 dark:bg-red-900/20';
            badgeBorder = 'border-red-200 dark:border-red-800/50';
            badgeText = 'MAÑANA';
        } else if (p.diasRestantes <= 2) {
            badgeColor = 'text-amber-600 dark:text-amber-400';
            badgeBg = 'bg-amber-50 dark:bg-amber-900/20';
            badgeBorder = 'border-amber-200 dark:border-amber-800/50';
            badgeText = p.diasRestantes + ' días';
        } else {
            badgeColor = 'text-slate-500 dark:text-slate-400';
            badgeBg = 'bg-slate-50 dark:bg-slate-700/50';
            badgeBorder = 'border-slate-200 dark:border-slate-600';
            badgeText = p.diasRestantes + ' días';
        }

        const iconVeh = p.tipoVehiculo === 'Moto' ? 'fa-motorcycle' : (p.tipoVehiculo === 'Camioneta' ? 'fa-truck-pickup' : 'fa-car');

        html += `
            <div class="pago-card bg-white dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600/50 p-3 ${p.diasRestantes <= 0 ? 'ring-1 ring-red-200 dark:ring-red-800/50' : ''}">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <i class="fa-solid ${iconVeh} text-slate-400 dark:text-slate-500 text-xs flex-shrink-0"></i>
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">${p.nombre}</span>
                    </div>
                    <span class="text-[10px] font-bold ${badgeColor} ${badgeBg} px-2 py-0.5 rounded-full border ${badgeBorder} flex-shrink-0 ml-2">${badgeText}</span>
                </div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="font-mono text-xs bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">${p.placa}</span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500">${p.periodicidad}</span>
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-600/50">
                    <span class="text-[10px] text-slate-400 dark:text-slate-500">Último: ${p.ultimoPago}</span>
                    <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">${formatearMoneda(p.cuota)}</span>
                </div>
            </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

/* ═════════════ INSTANCIAS DE CHARTS ═══════════ */
let chFinanzas = null, chOcupacion = null, chMetodos = null, chHorasPico = null, chTipoVehiculo = null, chTopClientes = null;

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
            responsive: true, 
            maintainAspectRatio: false, 
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
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '60%',
            plugins: { 
                legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 }, color: cTexto(), padding: 10 } }, 
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => { const pct = total > 0 ? ((ctx.parsed/total)*100).toFixed(1) : 0; return ctx.label + ': ' + formatearMoneda(ctx.parsed) + ' (' + pct + '%)'; } } } 
            }
        }
    });
}

function renderHorasPico(data) {
    const canvas = document.getElementById('horasPicoChart');
    if (!canvas) return;
    if (chHorasPico) chHorasPico.destroy();
    
    const ctx = canvas.getContext('2d');
    const mapa = {};
    data.forEach(d => { mapa[parseInt(d.hora)] = d.total || 0; });
    const labels = [], valores = [];
    for (let h = 5; h <= 22; h++) { 
        labels.push(h.toString().padStart(2, '0') + ':00'); 
        valores.push(mapa[h] || 0); 
    }
    
    const gradiente = ctx.createLinearGradient(0, 0, 0, 220);
    gradiente.addColorStop(0, 'rgba(245, 158, 11, 0.25)'); 
    gradiente.addColorStop(1, 'rgba(245, 158, 11, 0)');
    const maxVal = Math.max(...valores), maxIdx = valores.indexOf(maxVal);
    
    chHorasPico = new Chart(ctx, {
        type: 'line', 
        data: { 
            labels, 
            datasets: [{ 
                label: 'Vehículos', 
                data: valores, 
                borderColor: '#f59e0b', 
                backgroundColor: gradiente, 
                borderWidth: 2.5, 
                fill: true, 
                tension: 0.4, 
                pointBackgroundColor: valores.map((v, i) => i === maxIdx ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)'), 
                pointBorderColor: valores.map((v, i) => i === maxIdx ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)'), 
                pointRadius: valores.map((v, i) => i === maxIdx ? 6 : 0), 
                pointHoverRadius: 6 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false }, 
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => ctx.parsed.y + ' vehículo' + (ctx.parsed.y !== 1 ? 's' : '') + ' (promedio)' } } 
            }, 
            scales: { 
                y: { beginAtZero: true, grid: { color: cGrid() }, ticks: { stepSize: 1, font: { family: 'Inter', size: 10 }, color: cTexto() } }, 
                x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, color: cTexto(), maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } } 
            } 
        }
    });
}

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
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '78%', 
            plugins: { legend: { display: false }, tooltip: { enabled: false } } 
        }
    });
}

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
            datasets: [{ 
                data: data.map(d => d.total), 
                backgroundColor: data.map((d, i) => mapaColores[d.tipo] || coloresDefault[i % coloresDefault.length]), 
                borderWidth: 2, 
                borderColor: cBordeDona(), 
                hoverOffset: 6 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            cutout: '55%', 
            plugins: { 
                legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Inter', size: 11 }, color: cTexto(), padding: 12 } }, 
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => { const pct = total > 0 ? ((ctx.parsed/total)*100).toFixed(1) : 0; return ctx.label + ': ' + ctx.parsed + ' (' + pct + '%)'; } } } 
            } 
        }
    });
}

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
            responsive: true, 
            maintainAspectRatio: false, 
            indexAxis: 'y', 
            plugins: { 
                legend: { display: false }, 
                tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 6, callbacks: { label: ctx => ctx.parsed.x + ' visita' + (ctx.parsed.x !== 1 ? 's' : '') } } 
            }, 
            scales: { 
                x: { beginAtZero: true, grid: { color: cGrid() }, ticks: { stepSize: 1, font: { family: 'Inter', size: 10 }, color: cTexto() } }, 
                y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11, weight: 'bold' }, color: cTexto() } } 
            } 
        }
    });
}

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
        else if (tipo.includes('caja') || tipo.includes('pago')) { icon = 'fa-cash-register'; color = 'text-emerald-600'; }
        else if (tipo.includes('moto')) { icon = 'fa-motorcycle'; }
        else if (tipo.includes('salida')) { icon = 'fa-right-from-bracket'; color = 'text-orange-600'; }
        else if (tipo.includes('entrada')) { icon = 'fa-right-to-bracket'; color = 'text-green-600'; }
        
        const badge = !mov.exit ? '<span class="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>' : '';
        
        html += `
            <div class="flex items-center justify-between p-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onclick="location.href='./pages/historial.html'">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center ${color}"><i class="fa-solid ${icon} text-xs"></i></div>
                    <div>
                        <p class="text-sm font-medium text-slate-800 dark:text-slate-200">${mov.type} ${badge}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">${mov.plate || '---'} <span class="mx-1">•</span> ${mov.date}</p>
                    </div>
                </div>
                <div class="text-xs text-slate-400 dark:text-slate-500 font-mono">${mov.entry || ''}</div>
            </div>`;
    });
    container.innerHTML = html;
} 