// parqueo/js/historial.js

// ==================== MÓDULO GLOBAL ====================
window.HistorialModule = (function() {
    var allHistory = [];
    var filteredHistory = [];
    var currentPage = 1;
    var itemsPerPage = 10;

    // ==================== FETCH CON AUTENTICACIÓN ====================

    function getToken() {
        // Intentar múltiples claves comunes donde se guarda el token
        return localStorage.getItem('auth_token') 
            || localStorage.getItem('token')
            || localStorage.getItem('jwt')
            || sessionStorage.getItem('auth_token')
            || sessionStorage.getItem('token')
            || '';
    }

    function fetchAuth(url, options) {
        options = options || {};
        options.headers = options.headers || {};
        var token = getToken();
        if (token) {
            options.headers['Authorization'] = 'Bearer ' + token;
        }
        // Si es GET no necesita Content-Type
        if (!options.method || options.method === 'GET') {
            delete options.headers['Content-Type'];
        } else {
            if (!options.headers['Content-Type']) {
                options.headers['Content-Type'] = 'application/json';
            }
        }
        return fetch(url, options);
    }

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

    // ==================== CARGA DE DATOS ====================

    function loadHistory() {
        fetchAuth("/api/historial")
            .then(function(res) {
                if (res.status === 401) {
                    // Token inválido o expirado
                    mostrarToast("Sesión expirada, inicia sesión de nuevo", "error");
                    setTimeout(function() {
                        if (typeof logout === 'function') logout();
                        else window.location.href = '/login.html';
                    }, 1500);
                    throw new Error("No autorizado");
                }
                if (!res.ok) throw new Error("Error API: " + res.status);
                return res.json();
            })
            .then(function(data) {
                allHistory = Array.isArray(data) ? data : [];
                // Ordenar por fecha DESC, luego hora DESC
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

        filteredHistory = allHistory.filter(function(item) {
            if (startStr && item.date < startStr) return false;
            if (endStr && item.date > endStr) return false;

            if (typeVal !== "all") {
                var itemTypeLower = (item.type || "").toLowerCase();
                var vehicleType = (item.tipo_vehiculo || "").toLowerCase();
                var match = false;

                switch(typeVal) {
                    case 'ingreso': match = itemTypeLower === 'ingreso'; break;
                    case 'ingreso_visitante': match = itemTypeLower === 'ingreso_visitante'; break;
                    case 'salida': match = itemTypeLower === 'salida' || itemTypeLower === 'salida_viaje'; break;
                    case 'regreso_dueno': match = itemTypeLower === 'regreso_dueno'; break;
                    case 'GASTO': match = itemTypeLower === 'gasto'; break;
                    case 'vehiculo_carro': match = vehicleType.includes('carro') || vehicleType.includes('particular'); break;
                    case 'vehiculo_moto': match = vehicleType.includes('moto'); break;
                    case 'vehiculo_camioneta': match = vehicleType.includes('camioneta') || vehicleType.includes('suv'); break;
                    default: match = itemTypeLower.includes(typeVal.toLowerCase());
                }
                if (!match) return false;
            }

            if (searchStr) {
                var searchText = [
                    item.plate || "", item.spot || "", item.type || "",
                    item.tipo_vehiculo || "", item.entry || "", item.exit || ""
                ].join(" ").toLowerCase();
                if (!searchText.includes(searchStr)) return false;
            }

            return true;
        });

        currentPage = 1;
        renderFeed();
    }

    // ==================== ELIMINAR ====================

    function deleteItem(id) {
        if (!confirm("¿Eliminar este registro permanentemente?")) return;
        fetchAuth('/api/historial?id=' + id, { method: "DELETE" })
            .then(function(res) {
                if (!res.ok) throw new Error("Error");
                mostrarToast("Registro eliminado correctamente");
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
        toast.className = 'fixed bottom-4 right-4 z-[999] px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all transform translate-y-10 opacity-0 ' + (type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white');
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
            container.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400"><div class="flex flex-col items-center justify-center gap-3"><i class="fa-solid fa-inbox text-4xl opacity-20"></i><p class="text-sm font-medium">No hay registros coincidentes</p></div></td></tr>';
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
            var rowClass = "hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0";
            var borderLeftClass = "";
            var iconBg = "bg-slate-100 text-slate-500";
            var iconClass = "fa-circle-info";
            var title = item.type || "Sistema";
            var subhead = item.spot || "General";
            var statusCell = "";
            var typeLabel = item.type || "SISTEMA";
            var typeStr = (item.type || "").toLowerCase();

            if (typeStr === 'ingreso') {
                borderLeftClass = "border-l-4 border-l-amber-500";
                iconBg = "bg-amber-100 text-amber-600";
                iconClass = getVehicleIcon(item.tipo_vehiculo);
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = getVehicleLabel(item.tipo_vehiculo) + " • Ingreso";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700"><i class="fa-solid fa-arrow-right-to-bracket"></i> INGRESO</span><span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span></div>';
            }
            else if (typeStr === 'ingreso_visitante') {
                borderLeftClass = "border-l-4 border-l-orange-500";
                iconBg = "bg-orange-100 text-orange-600";
                iconClass = "fa-user-group";
                title = item.plate || "VISITANTE";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Visitante • Ingreso";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-700"><i class="fa-solid fa-user-group"></i> VISITANTE</span><span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span></div>';
            }
            else if (typeStr === 'salida') {
                borderLeftClass = "border-l-4 border-l-emerald-500";
                iconBg = "bg-emerald-100 text-emerald-600";
                iconClass = "fa-arrow-right-from-bracket";
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Salida Oficial";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700"><i class="fa-solid fa-check"></i> SALIDA</span><span class="text-[10px] text-slate-400">' + (item.exit || item.entry || '') + '</span></div>';
            }
            else if (typeStr === 'salida_viaje') {
                borderLeftClass = "border-l-4 border-l-blue-500";
                iconBg = "bg-blue-100 text-blue-600";
                iconClass = "fa-plane-departure";
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Salida de Viaje";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700"><i class="fa-solid fa-plane-departure"></i> VIAJE</span><span class="text-[10px] text-slate-400">' + (item.exit || item.entry || '') + '</span></div>';
            }
            else if (typeStr === 'regreso_dueno') {
                borderLeftClass = "border-l-4 border-l-violet-500";
                iconBg = "bg-violet-100 text-violet-600";
                iconClass = "fa-rotate-left";
                title = item.plate || "SIN PLACA";
                subhead = "Puesto " + (item.spot || "---");
                typeLabel = "Regreso de Dueño";
                statusCell = '<div class="flex flex-col items-end gap-1"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-100 text-violet-700"><i class="fa-solid fa-rotate-left"></i> REGRESO</span><span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span></div>';
            }
            else if (typeStr === 'gasto') {
                borderLeftClass = "border-l-4 border-l-rose-500";
                iconBg = "bg-rose-100 text-rose-600";
                iconClass = "fa-receipt";
                title = "Gasto Registrado";
                subhead = item.spot || "---";
                typeLabel = "Gasto";
                statusCell = '<div class="text-right"><span class="block font-mono font-bold text-rose-600 text-sm">- $' + Math.abs(Number(item.paid || 0)).toLocaleString('es-CO') + '</span><span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span></div>';
            }
            else {
                borderLeftClass = "border-l-4 border-l-slate-400";
                iconBg = "bg-slate-100 text-slate-500";
                iconClass = "fa-circle-info";
                title = item.plate || item.type || "Sistema";
                subhead = item.spot || "";
                typeLabel = item.type || "SISTEMA";
                statusCell = '<div class="text-right">' + (Number(item.paid) > 0 ? '<span class="block font-mono font-bold text-indigo-600 text-sm">$' + Number(item.paid).toLocaleString('es-CO') + '</span>' : '') + '<span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span></div>';
            }

            tr.className = rowClass + ' ' + borderLeftClass;

            var deleteBtn = showDeleteBtn
                ? '<button onclick="HistorialModule.deleteItem(' + item.id + ')" class="opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar registro"><i class="fa-solid fa-trash-can"></i></button>'
                : '';

            tr.innerHTML = '<td class="p-3 align-middle"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' + iconBg + '"><i class="fa-solid ' + iconClass + ' text-xs"></i></div><div class="min-w-0"><div class="font-bold text-slate-800 text-sm truncate">' + title + '</div><div class="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">' + typeLabel + '</div></div></div></td><td class="p-3 align-middle whitespace-nowrap"><div class="text-xs text-slate-500 font-medium">' + (item.date || '---') + '</div></td><td class="p-3 align-middle"><div class="text-xs font-medium text-slate-700 truncate max-w-[150px]" title="' + subhead + '">' + subhead + '</div></td><td class="p-3 align-middle">' + statusCell + '</td><td class="p-3 align-middle text-center no-print">' + deleteBtn + '</td>';

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
            var prevClass = isPrevDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : '';
            var nextClass = isNextDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : '';

            controls.innerHTML = '<div class="flex justify-between w-full items-center"><button onclick="HistorialModule.changePage(-1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm ' + prevClass + '" ' + (isPrevDisabled ? 'disabled' : '') + '><i class="fa-solid fa-chevron-left text-xs"></i> Anterior</button><div class="text-xs font-medium text-slate-400">Página ' + currentPage + ' de ' + (totalPages || 1) + '</div><button onclick="HistorialModule.changePage(1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm ' + nextClass + '" ' + (isNextDisabled ? 'disabled' : '') + '>Siguiente <i class="fa-solid fa-chevron-right text-xs"></i></button></div>';
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
        loadHistory: loadHistory
    };
})();

// Atajo global para los onchange del HTML
window.applyFilters = function() { HistorialModule.applyFilters(); };