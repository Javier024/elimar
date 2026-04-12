/* ==============================================
   TIMELINE PANEL - Historial Cruzado por Vehículo
   Panel deslizante lateral con línea de tiempo
   ============================================== */

window.abrirTimeline = function(placa) {
    // Evitar duplicados
    if (document.getElementById('tl-overlay')) {
        document.getElementById('tl-overlay').remove();
    }

    var isDark = document.documentElement.classList.contains('dark');

    // ─── PALETA DE COLORES ───
    var C = {
        bg:       isDark ? '#0f172a' : '#ffffff',
        bgAlt:    isDark ? '#1e293b' : '#f8fafc',
        bgHeader: isDark ? '#0f172a' : '#f1f5f9',
        bgFooter: isDark ? '#0f172a' : '#f8fafc',
        border:   isDark ? '#1e293b' : '#e2e8f0',
        borderH:  isDark ? '#334155' : '#e2e8f0',
        text:     isDark ? '#e2e8f0' : '#1e293b',
        textSec:  isDark ? '#94a3b8' : '#64748b',
        textDim:  isDark ? '#475569' : '#94a3b8',
        accent:   '#6366f1',
        accentL:  isDark ? '#312e81' : '#eef2ff',
        green:    '#10b981',
        greenBg:  isDark ? '#064e3b' : '#ecfdf5',
        blue:     '#6366f1',
        blueBg:   isDark ? '#312e81' : '#eef2ff',
        red:      '#ef4444',
        redBg:    isDark ? '#450a0a' : '#fef2f2',
        amber:    '#f59e0b',
        amberBg:  isDark ? '#451a03' : '#fffbeb',
        purple:   '#a855f7',
        purpleBg: isDark ? '#3b0764' : '#faf5ff',
        slate:    '#64748b',
        slateBg:  isDark ? '#1e293b' : '#f1f5f9',
        line:     isDark ? '#334155' : '#e2e8f0',
        overlay:  isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.5)',
        shadow:   isDark ? '0 0 60px rgba(0,0,0,0.5)' : '-8px 0 40px rgba(0,0,0,0.12)',
        cardBg:   isDark ? '#1e293b' : '#ffffff',
    };

    // ─── CREAR OVERLAY ───
    var overlay = document.createElement('div');
    overlay.id = 'tl-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;justify-content:flex-end;background:' + C.overlay + ';backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity 0.3s ease;';

    // ─── CREAR PANEL ───
    var panel = document.createElement('div');
    panel.id = 'tl-panel';
    panel.style.cssText = 'width:420px;max-width:100vw;height:100vh;background:' + C.bg + ';display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.16,1,0.3,1);box-shadow:' + C.shadow + ';';

    // ─── HEADER ───
    var header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px 16px;border-bottom:1px solid ' + C.borderH + ';background:' + C.bgHeader + ';flex-shrink:0;';

    var headerTop = document.createElement('div');
    headerTop.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';

    var infoCol = document.createElement('div');
    infoCol.style.cssText = 'display:flex;align-items:center;gap:12px;min-width:0;flex:1;';

    var iconBox = document.createElement('div');
    iconBox.style.cssText = 'width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(99,102,241,0.3);';
    iconBox.innerHTML = '<i class="fa-solid fa-timeline" style="color:#fff;font-size:16px;"></i>';

    var texts = document.createElement('div');
    texts.style.cssText = 'min-width:0;';
    texts.innerHTML = '<p style="font-size:11px;font-weight:600;color:' + C.textDim + ';text-transform:uppercase;letter-spacing:1px;margin:0 0 2px 0;">Historial del Vehículo</p>' +
        '<p style="font-size:18px;font-weight:800;color:' + C.accent + ';font-family:\'Inter\',monospace;letter-spacing:1.5px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + placa.toUpperCase() + '</p>';

    infoCol.appendChild(iconBox);
    infoCol.appendChild(texts);

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'width:34px;height:34px;border-radius:10px;border:1px solid ' + C.border + ';background:' + C.cardBg + ';color:' + C.textDim + ';cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;margin-left:12px;';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark" style="font-size:14px;"></i>';
    closeBtn.onmouseenter = function() { this.style.borderColor = C.red; this.style.color = C.red; this.style.background = C.redBg; };
    closeBtn.onmouseleave = function() { this.style.borderColor = C.border; this.style.color = C.textDim; this.style.background = C.cardBg; };

    headerTop.appendChild(infoCol);
    headerTop.appendChild(closeBtn);
    header.appendChild(headerTop);

    var summaryBar = document.createElement('div');
    summaryBar.id = 'tl-summary';
    summaryBar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    header.appendChild(summaryBar);

    // ─── BODY ───
    var body = document.createElement('div');
    body.id = 'tl-body';
    body.style.cssText = 'flex:1;overflow-y:auto;padding:24px;';

    body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">' +
        '<div style="position:relative;width:40px;height:40px;">' +
        '<div style="position:absolute;inset:0;border:3px solid ' + C.border + ';border-top-color:' + C.accent + ';border-radius:50%;animation:tl-spin 0.8s linear infinite;"></div>' +
        '</div>' +
        '<p style="font-size:13px;color:' + C.textDim + ';font-weight:500;">Consultando historial...</p></div>';

    var styleEl = document.createElement('style');
    styleEl.id = 'tl-styles';
    styleEl.textContent = '@keyframes tl-spin{to{transform:rotate(360deg)}}' +
        '#tl-body::-webkit-scrollbar{width:4px}' +
        '#tl-body::-webkit-scrollbar-track{background:transparent}' +
        '#tl-body::-webkit-scrollbar-thumb{background:' + (isDark ? '#334155' : '#cbd5e1') + ';border-radius:2px}';
    document.head.appendChild(styleEl);

    // ─── FOOTER ───
    var footer = document.createElement('div');
    footer.style.cssText = 'padding:14px 24px;border-top:1px solid ' + C.borderH + ';background:' + C.bgFooter + ';display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
    var countEl = document.createElement('span');
    countEl.id = 'tl-count';
    countEl.style.cssText = 'font-size:12px;font-weight:600;color:' + C.textDim + ';';
    countEl.textContent = '—';
    var refreshBtn = document.createElement('button');
    refreshBtn.style.cssText = 'font-size:12px;font-weight:600;color:' + C.accent + ';background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:6px;transition:background 0.2s;';
    refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="font-size:11px;"></i> Actualizar';
    refreshBtn.onmouseenter = function() { this.style.background = C.accentL; };
    refreshBtn.onmouseleave = function() { this.style.background = 'none'; };
    refreshBtn.onclick = function() { fetchHistorial(); };
    footer.appendChild(countEl);
    footer.appendChild(refreshBtn);

    // ─── ENSAMBLAR ───
    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    document.body.style.overflow = 'hidden';

    requestAnimationFrame(function() {
        overlay.style.opacity = '1';
        panel.style.transform = 'translateX(0)';
    });

    function cerrar() {
        panel.style.transform = 'translateX(100%)';
        overlay.style.opacity = '0';
        setTimeout(function() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
            document.body.style.overflow = '';
        }, 350);
    }
    closeBtn.onclick = cerrar;
    overlay.onclick = function(e) { if (e.target === overlay) cerrar(); };
    document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); }
    });

    // ─── FETCH (CORREGIDO: Trae todo y filtra en JS para evitar problemas de espacios) ───
    function fetchHistorial() {
        body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">' +
            '<div style="position:relative;width:40px;height:40px;">' +
            '<div style="position:absolute;inset:0;border:3px solid ' + C.border + ';border-top-color:' + C.accent + ';border-radius:50%;animation:tl-spin 0.8s linear infinite;"></div></div>' +
            '<p style="font-size:13px;color:' + C.textDim + ';font-weight:500;">Consultando historial...</p></div>';
        summaryBar.innerHTML = '';
        countEl.textContent = '—';

        // ✅ TRAER TODO EL HISTORIAL (sin ?placa=)
        fetch('/api/historial')
            .then(function(r) {
                if (!r.ok) throw new Error('Error ' + r.status);
                return r.json();
            })
            .then(function(data) {
                var arr = Array.isArray(data) ? data : (data.data || data.historial || data.registros || []);
                
                // ✅ FILTRAR EN JS LIMPIANDO ESPACIOS
                var placaLimpia = placa.trim().toUpperCase();
                var filtrados = arr.filter(function(r) {
                    var p = (r.plate || r.placa || '').trim().toUpperCase();
                    return p === placaLimpia;
                });
                
                render(filtrados);
            })
            .catch(function(err) {
                body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;padding:20px;">' +
                    '<div style="width:52px;height:52px;border-radius:50%;background:' + C.redBg + ';display:flex;align-items:center;justify-content:center;">' +
                    '<i class="fa-solid fa-wifi" style="font-size:20px;color:' + C.red + ';transform:rotate(45deg);"></i></div>' +
                    '<p style="font-size:14px;font-weight:700;color:' + C.text + ';margin:0;">Sin conexión</p>' +
                    '<p style="font-size:12px;color:' + C.textDim + ';text-align:center;max-width:260px;margin:0;line-height:1.5;">' + err.message + '</p>' +
                    '<button onclick="window.abrirTimeline(\'' + placa + '\')" style="margin-top:4px;padding:8px 20px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.cardBg + ';color:' + C.text + ';font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;">Reintentar</button></div>';
                countEl.textContent = 'Error';
            });
    }

    // ─── RENDERIZAR ───
    function render(registros) {
        countEl.textContent = registros.length + ' registro' + (registros.length !== 1 ? 's' : '');

        var resumen = { ingresos: 0, salidas: 0, pagos: 0, gastos: 0 };
        registros.forEach(function(r) {
            var t = (r.tipo || r.accion || r.type || '').toLowerCase();
            if (t.includes('ingreso') || t.includes('entrada')) resumen.ingresos++;
            else if (t.includes('salida')) resumen.salidas++;
            else if (t.includes('pago') || t.includes('cobro') || t.includes('renov')) resumen.pagos++;
            else if (t.includes('gasto') || t.includes('egreso')) resumen.gastos++;
        });

        summaryBar.innerHTML =
            makeChip(C.green, C.greenBg, 'fa-right-to-bracket', resumen.ingresos, 'Ingresos') +
            makeChip(C.blue, C.blueBg, 'fa-right-from-bracket', resumen.salidas, 'Salidas') +
            makeChip(C.amber, C.amberBg, 'fa-dollar-sign', resumen.pagos, 'Pagos') +
            makeChip(C.red, C.redBg, 'fa-receipt', resumen.gastos, 'Gastos');

        if (registros.length === 0) {
            body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;">' +
                '<div style="width:60px;height:60px;border-radius:50%;background:' + C.slateBg + ';display:flex;align-items:center;justify-content:center;">' +
                '<i class="fa-solid fa-inbox" style="font-size:24px;color:' + C.slate + ';"></i></div>' +
                '<p style="font-size:15px;font-weight:700;color:' + C.text + ';margin:0;">Sin registros</p>' +
                '<p style="font-size:12px;color:' + C.textDim + ';margin:0;">Esta placa no tiene historial aún.</p></div>';
            return;
        }

        var html = '<div style="position:relative;padding-left:32px;">';
        html += '<div style="position:absolute;left:11px;top:6px;bottom:6px;width:2px;background:' + C.line + ';border-radius:1px;"></div>';

        registros.forEach(function(reg, i) {
            var tipo = (reg.tipo || reg.accion || reg.type || '').toLowerCase();
            var fecha = reg.fecha || reg.date || reg.createdAt || '';
            var hora = reg.hora || reg.time || reg.entry || '';
            var desc = reg.descripcion || reg.detalle || reg.detail || reg.motivo || reg.spot || '';
            var monto = reg.monto || reg.valor || reg.amount || reg.paid || 0;
            var puesto = reg.puesto || reg.spot || '';
            var nombre = reg.nombre || reg.cliente || reg.name || '';

            var color, bg, icon;
            if (tipo.includes('ingreso') || tipo.includes('entrada')) {
                color = C.green; bg = C.greenBg; icon = 'fa-right-to-bracket';
            } else if (tipo.includes('salida')) {
                color = C.blue; bg = C.blueBg; icon = 'fa-right-from-bracket';
            } else if (tipo.includes('gasto') || tipo.includes('egreso')) {
                color = C.red; bg = C.redBg; icon = 'fa-receipt';
            } else if (tipo.includes('pago') || tipo.includes('cobro') || tipo.includes('renov')) {
                color = C.amber; bg = C.amberBg; icon = 'fa-coins';
            } else if (tipo.includes('reserv')) {
                color = C.purple; bg = C.purpleBg; icon = 'fa-bookmark';
            } else {
                color = C.slate; bg = C.slateBg; icon = 'fa-circle-dot';
            }

            var fechaStr = '';
            if (fecha) {
                try {
                    var d = new Date(fecha);
                    if (isNaN(d.getTime())) d = new Date(fecha.replace(/-/g, '/'));
                    if (!isNaN(d.getTime())) {
                        fechaStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
                    } else { fechaStr = fecha; }
                } catch(e) { fechaStr = fecha; }
            }

            var isLast = i === registros.length - 1;

            html += '<div style="position:relative;padding-bottom:' + (isLast ? '0' : '18px') + ';">';

            html += '<div style="position:absolute;left:-27px;top:6px;width:20px;height:20px;border-radius:50%;background:' + bg + ';border:2.5px solid ' + color + ';display:flex;align-items:center;justify-content:center;z-index:2;">';
            html += '<i class="fa-solid ' + icon + '" style="font-size:8px;color:' + color + ';"></i></div>';

            html += '<div style="background:' + bg + ';border:1px solid ' + color + '18;border-radius:12px;padding:14px 16px;transition:transform 0.15s;cursor:default;" onmouseenter="this.style.transform=\'translateX(3px)\'" onmouseleave="this.style.transform=\'none\'">';

            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">';
            html += '<span style="font-size:10px;font-weight:800;color:' + color + ';text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;">' + (reg.tipo || reg.accion || reg.type || tipo) + '</span>';
            if (fechaStr || hora) {
                html += '<span style="font-size:10px;color:' + C.textDim + ';font-weight:500;white-space:nowrap;">' + fechaStr + (hora ? ' · ' + hora : '') + '</span>';
            }
            html += '</div>';

            if (nombre) {
                html += '<p style="font-size:14px;font-weight:700;color:' + C.text + ';margin:0 0 4px 0;line-height:1.3;">' + nombre + '</p>';
            }

            if (desc && desc !== puesto) {
                html += '<p style="font-size:12px;color:' + C.textSec + ';font-weight:400;margin:0 0 6px 0;line-height:1.4;">' + desc + '</p>';
            }

            var hasMonto = monto && Number(monto) !== 0;
            var hasPuesto = !!puesto;
            if (hasMonto || hasPuesto) {
                html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
                if (hasMonto) {
                    var mColor = (tipo.includes('gasto') || tipo.includes('egreso')) ? C.red : C.green;
                    var mSign = (tipo.includes('gasto') || tipo.includes('egreso')) ? '-' : '+';
                    html += '<span style="font-size:15px;font-weight:800;color:' + mColor + ';font-family:\'Inter\',monospace;letter-spacing:-0.3px;">' + mSign + '$' + Number(monto).toLocaleString('es-CO') + '</span>';
                }
                if (hasPuesto) {
                    html += '<span style="font-size:10px;font-weight:700;color:' + C.textDim + ';background:' + C.cardBg + ';padding:3px 8px;border-radius:6px;border:1px solid ' + C.border + ';"><i class="fa-solid fa-square-parking" style="margin-right:3px;font-size:9px;"></i>Puesto ' + puesto + '</span>';
                }
                html += '</div>';
            }

            html += '</div></div>';
        });

        html += '</div>';
        body.innerHTML = html;
    }

    function makeChip(color, bg, icon, count, label) {
        if (count === 0) return '';
        return '<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;background:' + bg + ';border:1px solid ' + color + '20;">' +
            '<i class="fa-solid ' + icon + '" style="font-size:10px;color:' + color + ';"></i>' +
            '<span style="font-size:11px;font-weight:700;color:' + color + ';">' + count + '</span>' +
            '<span style="font-size:10px;font-weight:500;color:' + color + '99;">' + label + '</span></div>';
    }

    // Iniciar fetch
    fetchHistorial();
};