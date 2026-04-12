// parqueo/js/historial.js

// ==================== MÓDULO GLOBAL ====================
window.HistorialModule = (function() {
    var allHistory = [];
    var filteredHistory = [];
    var currentPage = 1;
    var itemsPerPage = 10;

    // ==================== HELPERS ====================

    function getVehicleIcon(tipo) {
        if (!tipo) return 'fa-car-side';
        var t = tipo.toLowerCase();
        if (t.includes('moto')) return 'fa-motorcycle';
        if (t.includes('camioneta') || t.includes('suv')) return 'fa-truck-pickup';
        return 'fa-car-side';
    }

    function getVehicleLabel(tipo) {
        if (!tipo) return 'Vehículo';
        var t = tipo.toLowerCase();
        if (t.includes('moto')) return 'Moto';
        if (t.includes('camioneta') || t.includes('suv')) return 'Camioneta';
        if (t.includes('particular')) return 'Carro';
        if (t.includes('carro')) return 'Carro';
        return tipo;
    }

    function detectarTipoVehiculo(item) {
        var texto = ((item.spot || '') + ' ' + (item.plate || '') + ' ' + (item.type || '')).toLowerCase();
        if (texto.includes('moto')) return 'moto';
        if (texto.includes('camioneta') || texto.includes('suv')) return 'camioneta';
        if (texto.includes('carro') || texto.includes('particular')) return 'carro';
        return '';
    }

        // ✅ HELPER: Parsear campo spot (formato compacto "c:Nombre|p:12|m:Efectivo|t:Mes|n:1|v:Carro")
    function parseSpotData(spot) {
        if (!spot) return {};
        if (typeof spot === 'object') return spot;
        
        // Intentar JSON primero (por si hay registros viejos en ese formato)
        try {
            var parsed = JSON.parse(spot);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch(e) {}
        
        // Formato compacto con pipes
        var result = {};
        if (typeof spot === 'string' && spot.includes('|')) {
            spot.split('|').forEach(function(part) {
                var idx = part.indexOf(':');
                if (idx > 0) {
                    var key = part.substring(0, idx).trim();
                    var val = part.substring(idx + 1).trim();
                    var keyMap = { 'c': 'cliente', 'p': 'puesto', 'm': 'metodo', 't': 'periodo', 'n': 'cantidad', 'v': 'tipo_vehiculo', 'tel': 'telefono' };
                    result[keyMap[key] || key] = val;
                }
            });
            if (Object.keys(result).length > 0) return result;
        }
        
        return {};
    }

    // ✅ HELPER: Obtener texto legible del spot
    function getSpotText(item) {
        if ((item.type || '') === 'pago_caja' || (item.type || '') === 'anulacion_pago') {
            var sd = parseSpotData(item.spot);
            var parts = [];
            if (sd.puesto && sd.puesto !== '---') parts.push('Puesto ' + sd.puesto);
            if (sd.metodo) parts.push(sd.metodo);
            if (sd.periodo) parts.push(sd.periodo + ' x' + (sd.cantidad || 1));
            if (sd.cliente) parts.push(sd.cliente);
            return parts.length > 0 ? parts.join(' · ') : 'Pago registrado';
        }
        return item.spot || '';
    }

    // ==================== CARGA DE DATOS ====================

    function loadHistory() {
        fetch("/api/historial")
            .then(function(res) {
                if (res.status === 401) {
                    mostrarToast("Sesión expirada", "error");
                    setTimeout(function() {
                        if (typeof logout === 'function') logout();
                    }, 1500);
                    throw new Error("No autorizado");
                }
                if (!res.ok) throw new Error("Error API: " + res.status);
                return res.json();
            })
            .then(function(data) {
                allHistory = Array.isArray(data) ? data : [];
                
                allHistory.forEach(function(item) {
                    if (item.plate) item.plate = item.plate.trim();
                    if (item.spot) item.spot = item.spot.trim();
                    if (item.entry) item.entry = item.entry.trim();
                    if (item.exit) item.exit = item.exit.trim();
                    if (item.type) item.type = item.type.trim();
                });
                
                allHistory.sort(function(a, b) {
                    if (a.date !== b.date) return b.date.localeCompare(a.date);
                    return (b.entry || '').localeCompare(a.entry || '');
                });
                applyFilters();
            })
            .catch(function(error) {
                console.error("Error cargando historial:", error);
                if (error.message !== "No autorizado") {
                    mostrarToast("Error cargando historial", "error");
                }
            });
    }

    // ==================== FILTROS ====================

    function applyFilters() {
        var startStr = document.getElementById("filterDateStart").value;
        var endStr = document.getElementById("filterDateEnd").value;
        var searchStr = document.getElementById("filterSearch").value.toLowerCase();
        var typeVal = document.getElementById("filterType").value;

        var filtered = allHistory.filter(function(item) {
            if (startStr && item.date < startStr) return false;
            if (endStr && item.date > endStr) return false;

            if (typeVal !== "all") {
                var itemTypeLower = (item.type || "").toLowerCase();
                var vehicleType = (item.tipo_vehiculo || "").toLowerCase();
                var detectedVehicle = detectarTipoVehiculo(item);
                // ✅ Para pagos de caja, también revisar tipo_vehiculo dentro del JSON del spot
                var spotData = parseSpotData(item.spot);
                var spotVehicleType = (spotData.tipo_vehiculo || "").toLowerCase();
                var effectiveVehicleType = vehicleType || spotVehicleType;
                var match = false;

                switch(typeVal) {
                    case 'ingreso': match = itemTypeLower === 'ingreso'; break;
                    case 'ingreso_visitante': match = itemTypeLower === 'ingreso_visitante'; break;
                    case 'salida': match = itemTypeLower === 'salida' || itemTypeLower === 'salida_viaje'; break;
                    case 'regreso_dueno': match = itemTypeLower === 'regreso_dueno'; break;
                    case 'gasto': match = itemTypeLower === 'gasto' || itemTypeLower === 'egreso' || itemTypeLower === 'anulacion_pago'; break;
                    case 'pago': match = itemTypeLower.includes('pago') || itemTypeLower.includes('cobro') || itemTypeLower.includes('renov'); break;
                    case 'vehiculo_carro': match = effectiveVehicleType.includes('carro') || effectiveVehicleType.includes('particular') || detectedVehicle === 'carro'; break;
                    case 'vehiculo_moto': match = effectiveVehicleType.includes('moto') || detectedVehicle === 'moto'; break;
                    case 'vehiculo_camioneta': match = effectiveVehicleType.includes('camioneta') || effectiveVehicleType.includes('suv') || detectedVehicle === 'camioneta'; break;
                    default: match = itemTypeLower.includes(typeVal.toLowerCase());
                }
                if (!match) return false;
            }

            if (searchStr) {
                // ✅ Para pagos de caja, buscar también dentro del JSON del spot
                var spotSearchText = item.spot || '';
                if ((item.type || '') === 'pago_caja' || (item.type || '') === 'anulacion_pago') {
                    var sd = parseSpotData(item.spot);
                    spotSearchText = [
                        sd.cliente || '', sd.puesto || '', sd.metodo || '',
                        sd.periodo || '', sd.telefono || ''
                    ].join(' ');
                }

                var searchText = [
                    item.plate || "", spotSearchText, item.type || "",
                    item.tipo_vehiculo || "", item.entry || "", item.exit || ""
                ].join(" ").toLowerCase();

                if (!searchText.includes(searchStr)) return false;
            }

            return true;
        });

        filteredHistory.length = 0;
        for (var i = 0; i < filtered.length; i++) {
            filteredHistory.push(filtered[i]);
        }

        currentPage = 1;
        renderFeed();
    }

    // ==================== ELIMINAR ====================

    function deleteItem(id) {
        if (!confirm("¿Eliminar este registro permanentemente?")) return;
        
        fetch('/api/historial?id=' + id, { method: "DELETE" })
            .then(function(res) {
                if (!res.ok) throw new Error("Error");
                mostrarToast("Registro eliminado");
                loadHistory();
            })
            .catch(function() {
                mostrarToast("Error al eliminar", "error");
            });
    }

    // ==================== TOAST ====================

    function mostrarToast(msg, type) {
        if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(msg, type);
            return;
        }
        type = type || 'success';
        var toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 z-[999] px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all transform translate-y-10 opacity-0 ' + (type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 dark:bg-slate-700 dark:text-white text-white');
        toast.innerText = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(function() {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });
        setTimeout(function() {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(function() { toast.remove(); }, 300);
        }, 3000);
    }

    // ==================== RENDERIZADO CON PAGINACIÓN ====================

    function renderFeed() {
        var container = document.getElementById("historyFeedBody");
        if (!container) return;

        if (filteredHistory.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400 dark:text-slate-500"><div class="flex flex-col items-center justify-center gap-3"><i class="fa-solid fa-inbox text-4xl opacity-20"></i><p class="text-sm font-medium">No hay registros coincidentes</p></div></td></tr>';
            updatePagination();
            return;
        }

        var start = (currentPage - 1) * itemsPerPage;
        var end = start + itemsPerPage;
        var pageData = filteredHistory.slice(start, end);

        renderRows(container, pageData, true);
        updatePagination();
    }

    // ==================== RENDERIZADO PARA IMPRESIÓN ====================

    function renderAllForPrint() {
        var container = document.getElementById("historyFeedBody");
        if (!container) return;

        if (filteredHistory.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="p-10 text-center"><p>No hay registros</p></td></tr>';
            return;
        }

        renderRows(container, filteredHistory, false);
    }

    // ==================== RENDERIZAR FILAS ====================

    function renderRows(container, data, showDeleteBtn) {
        container.innerHTML = "";

        data.forEach(function(item) {
            var tr = document.createElement("tr");
            var rowClass = "hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group border-b border-slate-100 dark:border-slate-700/50 last:border-0";
            var borderLeftClass = "";
            var iconBg = "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400";
            var iconClass = "fa-circle-info";
            var title = item.type || "Sistema";
            var subhead = item.spot || "General";
            var statusCell = "";
            var typeLabel = item.type || "SISTEMA";
            var typeStr = (item.type || "").toLowerCase();

            // ========== PAGO DE CAJA (específico, va antes del genérico) ==========
            if (typeStr === 'pago_caja') {
                var sd = parseSpotData(item.spot);
                
                borderLeftClass = "border-l-4 border-l-emerald-500";
                iconBg = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
                iconClass = "fa-coins";
                title = sd.cliente || item.plate || "---";
                subhead = "Puesto " + (sd.puesto || "---") + " · " + (sd.metodo || "Efectivo");
                typeLabel = (sd.periodo || 'Pago') + " x" + (sd.cantidad || 1);

                var montoPago = Number(item.paid) || 0;
                
                // Badge de método de pago
                var metodoBadge = '';
                if (sd.metodo) {
                    var metodoColor = sd.metodo === 'Efectivo' 
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400';
                    metodoBadge = '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ' + metodoColor + '">' + sd.metodo + '</span>';
                }

                // Badge de vehículo si hay
                var vehiculoBadge = '';
                if (sd.tipo_vehiculo) {
                    vehiculoBadge = '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"><i class="fa-solid ' + getVehicleIcon(sd.tipo_vehiculo) + ' text-[8px]"></i> ' + getVehicleLabel(sd.tipo_vehiculo) + '</span>';
                }

                statusCell = '<div class="flex flex-col items-end gap-1.5">' +
                    '<span class="block font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">+ $' + montoPago.toLocaleString('es-CO') + '</span>' +
                    '<div class="flex items-center gap-1">' + metodoBadge + vehiculoBadge + '</div>' +
                    '<span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span>' +
                '</div>';
            }
            // ========== ANULACIÓN DE PAGO ==========
            else if (typeStr === 'anulacion_pago') {
                var sdAnul = parseSpotData(item.spot);

                borderLeftClass = "border-l-4 border-l-red-500";
                iconBg = "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400";
                iconClass = "fa-ban";
                title = sdAnul.cliente || item.plate || "---";
                subhead = "Anulación · Puesto " + (sdAnul.puesto || "---");
                typeLabel = "Anulación Pago";

                var montoAnul = Math.abs(Number(item.paid) || 0);
                statusCell = '<div class="flex flex-col items-end gap-1">' +
                    '<span class="block font-mono font-bold text-red-600 dark:text-red-400 text-sm line-through">- $' + montoAnul.toLocaleString('es-CO') + '</span>' +
                    '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"><i class="fa-solid fa-ban text-[8px]"></i> ANULADO</span>' +
                    '<span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span>' +
                '</div>';
            }
            // ========== INGRESO ==========
            else if (typeStr === 'ingreso') {
                borderLeftClass = "border-l-4 border-l-amber-500";
                iconBg = "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
                iconClass = getVehicleIcon(item.tipo_vehiculo);
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = getVehicleLabel(item.tipo_vehiculo) + " • Ingreso";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"><i class="fa-solid fa-arrow-right-to-bracket"></i> INGRESO</span><span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span></div>';
            }
            // ========== INGRESO VISITANTE ==========
            else if (typeStr === 'ingreso_visitante') {
                borderLeftClass = "border-l-4 border-l-orange-500";
                iconBg = "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400";
                iconClass = "fa-user-group";
                title = item.plate || "VISITANTE";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Visitante • Ingreso";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"><i class="fa-solid fa-user-group"></i> VISITANTE</span><span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span></div>';
            }
            // ========== SALIDA ==========
            else if (typeStr === 'salida') {
                borderLeftClass = "border-l-4 border-l-emerald-500";
                iconBg = "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
                iconClass = "fa-arrow-right-from-bracket";
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Salida Oficial";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"><i class="fa-solid fa-check"></i> SALIDA</span><span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.exit || item.entry || '') + '</span></div>';
            }
            // ========== SALIDA VIAJE ==========
            else if (typeStr === 'salida_viaje') {
                borderLeftClass = "border-l-4 border-l-blue-500";
                iconBg = "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
                iconClass = "fa-plane-departure";
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Salida de Viaje";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"><i class="fa-solid fa-plane-departure"></i> VIAJE</span><span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.exit || item.entry || '') + '</span></div>';
            }
            // ========== REGRESO DUEÑO ==========
            else if (typeStr === 'regreso_dueno') {
                borderLeftClass = "border-l-4 border-l-violet-500";
                iconBg = "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400";
                iconClass = "fa-rotate-left";
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Regreso de Dueño";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"><i class="fa-solid fa-rotate-left"></i> REGRESO</span><span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span></div>';
            }
            // ========== GASTO ==========
            else if (typeStr === 'gasto') {
                borderLeftClass = "border-l-4 border-l-rose-500";
                iconBg = "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400";
                iconClass = "fa-receipt";
                title = "Gasto Registrado";
                subhead = item.spot || "---";
                typeLabel = "Gasto";
                statusCell = '<div class="text-right"><span class="block font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">- $' + Math.abs(Number(item.paid || 0)).toLocaleString('es-CO') + '</span><span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span></div>';
            }
            // ========== PAGO/COBRO GENÉRICO (fallback) ==========
            else if (typeStr.includes('pago') || typeStr.includes('cobro') || typeStr.includes('renov')) {
                borderLeftClass = "border-l-4 border-l-amber-500";
                iconBg = "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
                iconClass = "fa-coins";
                title = item.plate || "---";
                subhead = getSpotText(item);
                typeLabel = "Pago / Cobro";
                var montoGen = Number(item.paid) || 0;
                statusCell = '<div class="text-right"><span class="block font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">+ $' + montoGen.toLocaleString('es-CO') + '</span><span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span></div>';
            }
            // ========== DEFAULT ==========
            else {
                borderLeftClass = "border-l-4 border-l-slate-400 dark:border-slate-600";
                iconBg = "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400";
                iconClass = "fa-circle-info";
                title = item.plate || item.type || "Sistema";
                subhead = item.spot || "";
                typeLabel = item.type || "SISTEMA";
                statusCell = '<div class="text-right">' + (Number(item.paid) > 0 ? '<span class="block font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">$' + Number(item.paid).toLocaleString('es-CO') + '</span>' : '') + '<span class="text-[10px] text-slate-400 dark:text-slate-500">' + (item.entry || '') + '</span></div>';
            }

            tr.className = rowClass + ' ' + borderLeftClass;

            var timelineBtn = '';
            var placa = item.plate || '';
            // ✅ Para pagos de caja, obtener placa del JSON del spot si no está en item.plate
            if ((!placa || placa === '---') && (typeStr === 'pago_caja' || typeStr === 'anulacion_pago')) {
                // La placa ya debería estar en item.plate, pero por si acaso
            }
            if (placa && placa !== '---' && placa !== 'SIN PLACA' && placa.length >= 5) {
                timelineBtn = '<button onclick="HistorialModule.verTimeline(\'' + placa.replace(/'/g, "\\'") + '\')" class="opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" title="Ver línea de tiempo"><i class="fa-solid fa-timeline text-xs"></i></button>';
            }

            var deleteBtn = showDeleteBtn
                ? '<button onclick="HistorialModule.deleteItem(' + item.id + ')" class="opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar registro"><i class="fa-solid fa-trash-can"></i></button>'
                : '';

            tr.innerHTML = '<td class="p-3 align-middle"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' + iconBg + '"><i class="fa-solid ' + iconClass + ' text-xs"></i></div><div class="min-w-0"><div class="font-bold text-slate-800 dark:text-white text-sm truncate">' + title + '</div><div class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider">' + typeLabel + '</div></div></div></td><td class="p-3 align-middle whitespace-nowrap"><div class="text-xs text-slate-500 dark:text-slate-400 font-medium">' + (item.date || '---') + '</div></td><td class="p-3 align-middle"><div class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title="' + subhead.replace(/"/g, '&quot;') + '">' + subhead + '</div></td><td class="p-3 align-middle">' + statusCell + '</td><td class="p-3 align-middle text-center no-print"><div class="flex items-center justify-center gap-1">' + timelineBtn + deleteBtn + '</div></td>';

            container.appendChild(tr);
        });
    }

    // ==================== PAGINACIÓN ====================

    function updatePagination() {
        var totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
        var start = filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
        var end = Math.min(currentPage * itemsPerPage, filteredHistory.length);

        var info = document.getElementById("pageInfo");
        var controls = document.getElementById("pageControls");

        if (info) info.innerText = start + '-' + end + ' de ' + filteredHistory.length;

        if (controls) {
            var isPrevDisabled = currentPage === 1 || totalPages === 0;
            var isNextDisabled = currentPage >= totalPages || totalPages === 0;
            var prevClass = isPrevDisabled ? 'opacity-50 cursor-not-allowed' : '';
            var nextClass = isNextDisabled ? 'opacity-50 cursor-not-allowed' : '';

            controls.innerHTML = '<div class="flex justify-between w-full items-center"><button onclick="HistorialModule.changePage(-1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ' + prevClass + '" ' + (isPrevDisabled ? 'disabled' : '') + '><i class="fa-solid fa-chevron-left text-xs"></i> Anterior</button><div class="text-xs font-medium text-slate-500 dark:text-slate-400">Página ' + currentPage + ' de ' + (totalPages || 1) + '</div><button onclick="HistorialModule.changePage(1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm ' + nextClass + '" ' + (isNextDisabled ? 'disabled' : '') + '>Siguiente <i class="fa-solid fa-chevron-right text-xs"></i></button></div>';
        }
    }

    function changePage(dir) {
        var totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
        if (totalPages === 0) return;
        var newPage = currentPage + dir;
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            renderFeed();
            var scrollContainer = document.getElementById("historyFeedScrollContainer");
            if (scrollContainer) scrollContainer.scrollTop = 0;
        }
    }

    // ==================== TIMELINE ====================

    function verTimeline(placa) {
        if (!placa || placa === '---' || placa === 'SIN PLACA' || placa === 'N/A' || placa.length < 5) {
            mostrarToast("No hay placa válida", "error");
            return;
        }

        placa = placa.trim();

        var existingModal = document.getElementById('modal-timeline-historial');
        if (existingModal) existingModal.remove();

        var isDark = document.documentElement.classList.contains('dark');

        var modal = document.createElement('div');
        modal.id = 'modal-timeline-historial';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;justify-content:flex-end;background:' + (isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.5)') + ';backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity 0.3s ease;';

        var panel = document.createElement('div');
        panel.style.cssText = 'width:420px;max-width:100vw;height:100vh;background:' + (isDark ? '#0f172a' : '#ffffff') + ';display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.35s cubic-bezier(0.16,1,0.3,1);box-shadow:' + (isDark ? '0 0 60px rgba(0,0,0,0.5)' : '-8px 0 40px rgba(0,0,0,0.12)') + ';';

        var header = document.createElement('div');
        header.style.cssText = 'padding:20px 24px 16px;border-bottom:1px solid ' + (isDark ? '#1e293b' : '#e2e8f0') + ';background:' + (isDark ? '#0f172a' : '#f1f5f9') + ';flex-shrink:0;';
        header.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
                '<div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(99,102,241,0.3);">' +
                    '<i class="fa-solid fa-timeline" style="color:#fff;font-size:16px;"></i>' +
                '</div>' +
                '<div>' +
                    '<p style="font-size:11px;font-weight:600;color:' + (isDark ? '#475569' : '#94a3b8') + ';text-transform:uppercase;letter-spacing:1px;margin:0 0 2px 0;">Historial del Vehículo</p>' +
                    '<p id="tl-placa" style="font-size:18px;font-weight:800;color:#6366f1;font-family:Inter,monospace;letter-spacing:1.5px;margin:0;">' + placa.toUpperCase() + '</p>' +
                '</div>' +
            '</div>' +
            '<button id="tl-close-btn" style="width:34px;height:34px;border-radius:10px;border:1px solid ' + (isDark ? '#1e293b' : '#e2e8f0') + ';background:' + (isDark ? '#1e293b' : '#ffffff') + ';color:' + (isDark ? '#475569' : '#94a3b8') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;">' +
                '<i class="fa-solid fa-xmark" style="font-size:14px;"></i>' +
            '</button>' +
        '</div>' +
        '<div id="tl-summary" style="display:flex;gap:8px;flex-wrap:wrap;"></div>';

        var body = document.createElement('div');
        body.id = 'tl-body';
        body.style.cssText = 'flex:1;overflow-y:auto;padding:24px;';
        body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">' +
            '<div style="position:relative;width:40px;height:40px;">' +
                '<div style="position:absolute;inset:0;border:3px solid ' + (isDark ? '#1e293b' : '#e2e8f0') + ';border-top-color:#6366f1;border-radius:50%;animation:tl-spin 0.8s linear infinite;"></div>' +
            '</div>' +
            '<p style="font-size:13px;color:' + (isDark ? '#475569' : '#94a3b8') + ';font-weight:500;">Consultando historial...</p>' +
        '</div>';

        var footer = document.createElement('div');
        footer.style.cssText = 'padding:14px 24px;border-top:1px solid ' + (isDark ? '#1e293b' : '#e2e8f0') + ';background:' + (isDark ? '#0f172a' : '#f8fafc') + ';display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
        footer.innerHTML = '<span id="tl-count" style="font-size:12px;font-weight:600;color:' + (isDark ? '#475569' : '#94a3b8') + ';">—</span>' +
            '<button id="tl-refresh-btn" style="font-size:12px;font-weight:600;color:#6366f1;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:6px;transition:background 0.2s;">' +
                '<i class="fa-solid fa-arrows-rotate" style="font-size:11px;"></i> Actualizar' +
            '</button>';

        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        modal.appendChild(panel);
        document.body.appendChild(modal);

        document.body.style.overflow = 'hidden';

        requestAnimationFrame(function() {
            modal.style.opacity = '1';
            panel.style.transform = 'translateX(0)';
        });

        function cerrar() {
            panel.style.transform = 'translateX(100%)';
            modal.style.opacity = '0';
            setTimeout(function() {
                if (modal.parentNode) modal.remove();
                document.body.style.overflow = '';
            }, 350);
        }

        document.getElementById('tl-close-btn').onclick = cerrar;
        document.getElementById('tl-refresh-btn').onclick = fetchTimeline;
        modal.onclick = function(e) { if (e.target === modal) cerrar(); };
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); }
        });

        function fetchTimeline() {
            document.getElementById('tl-body').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">' +
                '<div style="position:relative;width:40px;height:40px;">' +
                    '<div style="position:absolute;inset:0;border:3px solid ' + (isDark ? '#1e293b' : '#e2e8f0') + ';border-top-color:#6366f1;border-radius:50%;animation:tl-spin 0.8s linear infinite;"></div>' +
                '</div>' +
                '<p style="font-size:13px;color:' + (isDark ? '#475569' : '#94a3b8') + ';font-weight:500;">Consultando historial...</p>' +
            '</div>';
            document.getElementById('tl-summary').innerHTML = '';
            document.getElementById('tl-count').textContent = '—';

            fetch('/api/historial')
                .then(function(r) {
                    if (!r.ok) throw new Error('Error ' + r.status);
                    return r.json();
                })
                .then(function(data) {
                    var todos = Array.isArray(data) ? data : [];
                    
                    var placaLimpia = placa.trim().toUpperCase();
                    var registros = todos.filter(function(r) {
                        var p = (r.plate || r.placa || '').trim().toUpperCase();
                        return p === placaLimpia;
                    });
                    
                    renderTimeline(registros, isDark);
                })
                .catch(function(err) {
                    document.getElementById('tl-body').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;padding:20px;">' +
                        '<div style="width:52px;height:52px;border-radius:50%;background:' + (isDark ? '#450a0a' : '#fef2f2') + ';display:flex;align-items:center;justify-content:center;">' +
                            '<i class="fa-solid fa-wifi" style="font-size:20px;color:#ef4444;transform:rotate(45deg);"></i>' +
                        '</div>' +
                        '<p style="font-size:14px;font-weight:700;color:' + (isDark ? '#e2e8f0' : '#1e293b') + ';margin:0;">Sin conexión</p>' +
                        '<p style="font-size:12px;color:' + (isDark ? '#475569' : '#94a3b8') + ';text-align:center;max-width:260px;margin:0;">' + err.message + '</p>' +
                    '</div>';
                    document.getElementById('tl-count').textContent = 'Error';
                });
        }

        function renderTimeline(registros, isDark) {
            document.getElementById('tl-count').textContent = registros.length + ' registro' + (registros.length !== 1 ? 's' : '');

            var resumen = { ingresos: 0, salidas: 0, pagos: 0, gastos: 0, anulaciones: 0 };
            registros.forEach(function(r) {
                var t = (r.type || '').toLowerCase();
                if (t.includes('ingreso')) resumen.ingresos++;
                else if (t.includes('salida') || t.includes('regreso')) resumen.salidas++;
                else if (t === 'gasto') resumen.gastos++;
                else if (t === 'anulacion_pago') resumen.anulaciones++;
                else if (t.includes('pago') || t.includes('cobro') || t.includes('renov')) resumen.pagos++;
            });

            function makeChip(color, bg, icon, count, label) {
                if (count === 0) return '';
                return '<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;background:' + bg + ';">' +
                    '<i class="fa-solid ' + icon + '" style="font-size:10px;color:' + color + ';"></i>' +
                    '<span style="font-size:11px;font-weight:700;color:' + color + ';">' + count + '</span>' +
                    '<span style="font-size:10px;font-weight:500;color:' + color + '99;">' + label + '</span></div>';
            }

            document.getElementById('tl-summary').innerHTML =
                makeChip('#10b981', isDark ? '#064e3b' : '#ecfdf5', 'fa-right-to-bracket', resumen.ingresos, 'Ingresos') +
                makeChip('#6366f1', isDark ? '#312e81' : '#eef2ff', 'fa-right-from-bracket', resumen.salidas, 'Salidas') +
                makeChip('#f59e0b', isDark ? '#451a03' : '#fffbeb', 'fa-coins', resumen.pagos, 'Pagos') +
                makeChip('#ef4444', isDark ? '#450a0a' : '#fef2f2', 'fa-receipt', resumen.gastos + resumen.anulaciones, 'Gastos/Anul.');

            if (registros.length === 0) {
                document.getElementById('tl-body').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;">' +
                    '<div style="width:60px;height:60px;border-radius:50%;background:' + (isDark ? '#1e293b' : '#f1f5f9') + ';display:flex;align-items:center;justify-content:center;">' +
                        '<i class="fa-solid fa-inbox" style="font-size:24px;color:#64748b;"></i>' +
                    '</div>' +
                    '<p style="font-size:15px;font-weight:700;color:' + (isDark ? '#e2e8f0' : '#1e293b') + ';margin:0;">Sin registros</p>' +
                    '<p style="font-size:12px;color:' + (isDark ? '#475569' : '#94a3b8') + ';margin:0;">Esta placa no tiene historial aún.</p></div>';
                return;
            }

            var lineColor = isDark ? '#334155' : '#e2e8f0';
            var html = '<div style="position:relative;padding-left:32px;">';
            html += '<div style="position:absolute;left:11px;top:6px;bottom:6px;width:2px;background:' + lineColor + ';border-radius:1px;"></div>';

            registros.forEach(function(reg, i) {
                var tipo = (reg.type || '').toLowerCase();
                var color, bg, icon;

                if (tipo === 'pago_caja') {
                    color = '#10b981'; bg = isDark ? '#064e3b' : '#ecfdf5'; icon = 'fa-coins';
                } else if (tipo === 'anulacion_pago') {
                    color = '#ef4444'; bg = isDark ? '#450a0a' : '#fef2f2'; icon = 'fa-ban';
                } else if (tipo.includes('ingreso') && tipo.includes('visitante')) {
                    color = '#f59e0b'; bg = isDark ? '#451a03' : '#fffbeb'; icon = 'fa-user-group';
                } else if (tipo.includes('ingreso')) {
                    color = '#10b981'; bg = isDark ? '#064e3b' : '#ecfdf5'; icon = 'fa-right-to-bracket';
                } else if (tipo.includes('salida_viaje')) {
                    color = '#3b82f6'; bg = isDark ? '#1e3a5f' : '#eff6ff'; icon = 'fa-plane-departure';
                } else if (tipo.includes('salida')) {
                    color = '#10b981'; bg = isDark ? '#064e3b' : '#ecfdf5'; icon = 'fa-right-from-bracket';
                } else if (tipo.includes('regreso')) {
                    color = '#a855f7'; bg = isDark ? '#3b0764' : '#faf5ff'; icon = 'fa-rotate-left';
                } else if (tipo === 'gasto') {
                    color = '#ef4444'; bg = isDark ? '#450a0a' : '#fef2f2'; icon = 'fa-receipt';
                } else if (tipo.includes('pago') || tipo.includes('cobro') || tipo.includes('renov')) {
                    color = '#f59e0b'; bg = isDark ? '#451a03' : '#fffbeb'; icon = 'fa-coins';
                } else {
                    color = '#64748b'; bg = isDark ? '#1e293b' : '#f1f5f9'; icon = 'fa-circle-dot';
                }

                var fechaStr = reg.date || '';
                var horaStr = reg.entry || '';
                var monto = Number(reg.paid) || 0;

                // ✅ Parsear detalle del spot para pagos de caja
                var detalle = reg.spot || '';
                if (tipo === 'pago_caja' || tipo === 'anulacion_pago') {
                    var sd = parseSpotData(reg.spot);
                    var dParts = [];
                    if (sd.cliente) dParts.push('<strong>' + sd.cliente + '</strong>');
                    if (sd.puesto && sd.puesto !== '---') dParts.push('Puesto ' + sd.puesto);
                    if (sd.metodo) dParts.push(sd.metodo);
                    if (sd.periodo) dParts.push(sd.periodo + ' x' + (sd.cantidad || 1));
                    detalle = dParts.join(' · ');
                }

                var isLast = i === registros.length - 1;

                html += '<div style="position:relative;padding-bottom:' + (isLast ? '0' : '18px') + ';">';
                html += '<div style="position:absolute;left:-27px;top:6px;width:20px;height:20px;border-radius:50%;background:' + bg + ';border:2.5px solid ' + color + ';display:flex;align-items:center;justify-content:center;z-index:2;">';
                html += '<i class="fa-solid ' + icon + '" style="font-size:8px;color:' + color + ';"></i></div>';
                html += '<div style="background:' + bg + ';border:1px solid ' + color + '20;border-radius:12px;padding:14px 16px;transition:transform 0.15s;cursor:default;" onmouseenter="this.style.transform=\'translateX(3px)\'" onmouseleave="this.style.transform=\'none\'">';

                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">';
                html += '<span style="font-size:10px;font-weight:800;color:' + color + ';text-transform:uppercase;letter-spacing:0.8px;">' + (tipo === 'pago_caja' ? 'PAGO CAJA' : tipo === 'anulacion_pago' ? 'ANULACIÓN' : reg.type || 'SISTEMA') + '</span>';
                if (fechaStr || horaStr) {
                    html += '<span style="font-size:10px;color:' + (isDark ? '#475569' : '#94a3b8') + ';font-weight:500;">' + fechaStr + (horaStr ? ' · ' + horaStr : '') + '</span>';
                }
                html += '</div>';

                if (detalle) {
                    html += '<p style="font-size:12px;color:' + (isDark ? '#94a3b8' : '#64748b') + ';font-weight:400;margin:0 0 6px 0;">' + detalle + '</p>';
                }

                if (monto !== 0) {
                    var mColor = (tipo === 'gasto' || tipo === 'anulacion_pago') ? '#ef4444' : '#10b981';
                    var mSign = (tipo === 'gasto' || tipo === 'anulacion_pago') ? '-' : '+';
                    var mStyle = tipo === 'anulacion_pago' ? 'text-decoration:line-through;opacity:0.7;' : '';
                    html += '<span style="font-size:15px;font-weight:800;color:' + mColor + ';font-family:Inter,monospace;' + mStyle + '">' + mSign + '$' + Math.abs(monto).toLocaleString('es-CO') + '</span>';
                }

                html += '</div></div>';
            });

            html += '</div>';
            document.getElementById('tl-body').innerHTML = html;
        }

        fetchTimeline();
    }

    // ==================== INICIAR ====================

    document.addEventListener("DOMContentLoaded", function() {
        loadHistory();
    });

    // ==================== EXPONER PÚBLICO ====================
    return {
        allHistory: allHistory,
        filteredHistory: filteredHistory,
        currentPage: currentPage,
        renderFeed: renderFeed,
        renderAllForPrint: renderAllForPrint,
        applyFilters: applyFilters,
        deleteItem: deleteItem,
        changePage: changePage,
        loadHistory: loadHistory,
        verTimeline: verTimeline
    };
})();

// Atajo global para los onchange del HTML
window.applyFilters = function() { HistorialModule.applyFilters(); };