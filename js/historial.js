// parqueo/js/historial.js

document.addEventListener("DOMContentLoaded", function () {
  let allHistory = [], filteredHistory = [], currentPage = 1, itemsPerPage = 10;

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

  async function loadHistory() {
    try {
      const res = await fetch("/api/historial");
      if (!res.ok) throw new Error("Error API");
      const data = await res.json();
      allHistory = Array.isArray(data) ? data : [];
      applyFilters();
    } catch (error) {
      console.error(error);
      mostrarToast("Error cargando historial", "error");
    }
  }

  // ==================== FILTROS ====================

  window.applyFilters = function() {
    const startStr = document.getElementById("filterDateStart").value,
          endStr = document.getElementById("filterDateEnd").value,
          searchStr = document.getElementById("filterSearch").value.toLowerCase(),
          typeVal = document.getElementById("filterType").value;

    filteredHistory = allHistory.filter(function(item) {
      // Filtro de fechas
      if (startStr && item.date < startStr) return false;
      if (endStr && item.date > endStr) return false;

      // Filtro de tipo/categoría
      if (typeVal !== "all") {
        const itemTypeLower = (item.type || "").toLowerCase();
        const vehicleType = (item.tipo_vehiculo || "").toLowerCase();
        let match = false;

        switch(typeVal) {
          case 'ingreso':
            match = itemTypeLower === 'ingreso';
            break;
          case 'ingreso_visitante':
            match = itemTypeLower === 'ingreso_visitante';
            break;
          case 'salida':
            match = itemTypeLower === 'salida' || itemTypeLower === 'salida_viaje';
            break;
          case 'regreso_dueno':
            match = itemTypeLower === 'regreso_dueno';
            break;
          case 'GASTO':
            match = itemTypeLower === 'gasto';
            break;
          case 'vehiculo_carro':
            match = vehicleType.includes('carro') || vehicleType.includes('particular');
            break;
          case 'vehiculo_moto':
            match = vehicleType.includes('moto');
            break;
          case 'vehiculo_camioneta':
            match = vehicleType.includes('camioneta') || vehicleType.includes('suv');
            break;
          default:
            match = itemTypeLower.includes(typeVal.toLowerCase());
        }

        if (!match) return false;
      }

      // Buscador general
      if (searchStr) {
        const searchText = [
          item.plate || "",
          item.spot || "",
          item.type || "",
          item.tipo_vehiculo || "",
          item.entry || "",
          item.exit || ""
        ].join(" ").toLowerCase();

        if (!searchText.includes(searchStr)) return false;
      }

      return true;
    });

    currentPage = 1;
    renderFeed();
  };

  // ==================== ELIMINAR ====================

  window.deleteItem = async function(id) {
    if (!confirm("¿Eliminar este registro permanentemente?")) return;
    try {
      await fetch('/api/historial?id=' + id, { method: "DELETE" });
      mostrarToast("Registro eliminado correctamente");
      loadHistory();
    } catch (e) {
      mostrarToast("Error al eliminar", "error");
    }
  };

  // ==================== TOAST ====================

  function mostrarToast(msg, type) {
    type = type || 'success';
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all transform translate-y-10 opacity-0 ' + (type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white');
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

  // ==================== RENDERIZADO ====================

  function renderFeed() {
    const container = document.getElementById("historyFeedBody");
    if (!container) return;

    if (filteredHistory.length === 0) {
      container.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400"><div class="flex flex-col items-center justify-center gap-3"><i class="fa-solid fa-inbox text-4xl opacity-20"></i><p class="text-sm font-medium">No hay registros coincidentes</p></div></td></tr>';
      updatePagination();
      return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredHistory.slice(start, end);

    container.innerHTML = "";

    pageData.forEach(function(item) {
      const tr = document.createElement("tr");

      let rowClass = "hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0";
      let borderLeftClass = "";
      let iconBg = "bg-slate-100 text-slate-500";
      let iconClass = "fa-circle-info";
      let title = item.type || "Sistema";
      let subhead = item.spot || "General";
      let statusCell = "";
      let typeLabel = item.type || "SISTEMA";

      const typeStr = (item.type || "").toLowerCase();

      // ========== INGRESO DE CLIENTE REGISTRADO ==========
      if (typeStr === 'ingreso') {
        borderLeftClass = "border-l-4 border-l-amber-500";
        iconBg = "bg-amber-100 text-amber-600";
        iconClass = getVehicleIcon(item.tipo_vehiculo);
        title = item.plate || "SIN PLACA";
        subhead = "Puesto " + (item.spot || "---");
        typeLabel = getVehicleLabel(item.tipo_vehiculo) + " • Ingreso";

        statusCell = '<div class="flex flex-col items-end gap-1">' +
          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">' +
          '<i class="fa-solid fa-arrow-right-to-bracket"></i> INGRESO</span>' +
          '<span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span>' +
          '</div>';
      }
      // ========== INGRESO DE VISITANTE ==========
      else if (typeStr === 'ingreso_visitante') {
        borderLeftClass = "border-l-4 border-l-orange-500";
        iconBg = "bg-orange-100 text-orange-600";
        iconClass = "fa-user-group";
        title = item.plate || "VISITANTE";
        subhead = "Puesto " + (item.spot || "---");
        typeLabel = "Visitante • Ingreso";

        statusCell = '<div class="flex flex-col items-end gap-1">' +
          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-100 text-orange-700">' +
          '<i class="fa-solid fa-user-group"></i> VISITANTE</span>' +
          '<span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span>' +
          '</div>';
      }
      // ========== SALIDA OFICIAL ==========
      else if (typeStr === 'salida') {
        borderLeftClass = "border-l-4 border-l-emerald-500";
        iconBg = "bg-emerald-100 text-emerald-600";
        iconClass = "fa-arrow-right-from-bracket";
        title = item.plate || "SIN PLACA";
        subhead = "Puesto " + (item.spot || "---");
        typeLabel = "Salida Oficial";

        statusCell = '<div class="flex flex-col items-end gap-1">' +
          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">' +
          '<i class="fa-solid fa-check"></i> SALIDA</span>' +
          '<span class="text-[10px] text-slate-400">' + (item.exit || item.entry || '') + '</span>' +
          '</div>';
      }
      // ========== SALIDA DE VIAJE ==========
      else if (typeStr === 'salida_viaje') {
        borderLeftClass = "border-l-4 border-l-blue-500";
        iconBg = "bg-blue-100 text-blue-600";
        iconClass = "fa-plane-departure";
        title = item.plate || "SIN PLACA";
        subhead = "Puesto " + (item.spot || "---");
        typeLabel = "Salida de Viaje";

        statusCell = '<div class="flex flex-col items-end gap-1">' +
          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">' +
          '<i class="fa-solid fa-plane-departure"></i> VIAJE</span>' +
          '<span class="text-[10px] text-slate-400">' + (item.exit || item.entry || '') + '</span>' +
          '</div>';
      }
      // ========== REGRESO DE DUEÑO ==========
      else if (typeStr === 'regreso_dueno') {
        borderLeftClass = "border-l-4 border-l-violet-500";
        iconBg = "bg-violet-100 text-violet-600";
        iconClass = "fa-rotate-left";
        title = item.plate || "SIN PLACA";
        subhead = "Puesto " + (item.spot || "---");
        typeLabel = "Regreso de Dueño";

        statusCell = '<div class="flex flex-col items-end gap-1">' +
          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-100 text-violet-700">' +
          '<i class="fa-solid fa-rotate-left"></i> REGRESO</span>' +
          '<span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span>' +
          '</div>';
      }
      // ========== GASTO ==========
      else if (typeStr === 'gasto') {
        borderLeftClass = "border-l-4 border-l-rose-500";
        iconBg = "bg-rose-100 text-rose-600";
        iconClass = "fa-receipt";
        title = "Gasto Registrado";
        subhead = item.spot || "---";
        typeLabel = "Gasto";

        statusCell = '<div class="text-right">' +
          '<span class="block font-mono font-bold text-rose-600 text-sm">- $' + Math.abs(Number(item.paid || 0)).toLocaleString('es-CO') + '</span>' +
          '<span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span>' +
          '</div>';
      }
      // ========== OTRO / SISTEMA ==========
      else {
        borderLeftClass = "border-l-4 border-l-slate-400";
        iconBg = "bg-slate-100 text-slate-500";
        iconClass = "fa-circle-info";
        title = item.plate || item.type || "Sistema";
        subhead = item.spot || "";
        typeLabel = item.type || "SISTEMA";

        statusCell = '<div class="text-right">' +
          (Number(item.paid) > 0 ? '<span class="block font-mono font-bold text-indigo-600 text-sm">$' + Number(item.paid).toLocaleString('es-CO') + '</span>' : '') +
          '<span class="text-[10px] text-slate-400">' + (item.entry || '') + '</span>' +
          '</div>';
      }

      tr.className = rowClass + ' ' + borderLeftClass;

      // Botón eliminar (visible al hover)
      const deleteBtn = '<button onclick="deleteItem(' + item.id + ')" class="opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar registro"><i class="fa-solid fa-trash-can"></i></button>';

      tr.innerHTML = '<td class="p-3 align-middle">' +
        '<div class="flex items-center gap-3">' +
          '<div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' + iconBg + '">' +
            '<i class="fa-solid ' + iconClass + ' text-xs"></i>' +
          '</div>' +
          '<div class="min-w-0">' +
            '<div class="font-bold text-slate-800 text-sm truncate">' + title + '</div>' +
            '<div class="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">' + typeLabel + '</div>' +
          '</div>' +
        '</div>' +
      '</td>' +
      '<td class="p-3 align-middle whitespace-nowrap">' +
        '<div class="text-xs text-slate-500 font-medium">' + (item.date || '---') + '</div>' +
      '</td>' +
      '<td class="p-3 align-middle">' +
        '<div class="text-xs font-medium text-slate-700 truncate max-w-[150px]" title="' + subhead + '">' + subhead + '</div>' +
      '</td>' +
      '<td class="p-3 align-middle">' + statusCell + '</td>' +
      '<td class="p-3 align-middle text-center">' + deleteBtn + '</td>';

      container.appendChild(tr);
    });

    updatePagination();
  }

  // ==================== PAGINACIÓN ====================

  function updatePagination() {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const start = filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredHistory.length);

    const info = document.getElementById("pageInfo");
    const controls = document.getElementById("pageControls");

    if (info) info.innerText = start + '-' + end + ' de ' + filteredHistory.length;

    if (controls) {
      const isPrevDisabled = currentPage === 1 || totalPages === 0;
      const isNextDisabled = currentPage >= totalPages || totalPages === 0;
      const prevClass = isPrevDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : '';
      const nextClass = isNextDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : '';
      const prevDisabled = isPrevDisabled ? 'disabled' : '';
      const nextDisabled = isNextDisabled ? 'disabled' : '';

      controls.innerHTML = '<div class="flex justify-between w-full items-center">' +
        '<button onclick="changePage(-1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm ' + prevClass + '" ' + prevDisabled + '>' +
          '<i class="fa-solid fa-chevron-left text-xs"></i> Anterior' +
        '</button>' +
        '<div class="text-xs font-medium text-slate-400">Página ' + currentPage + ' de ' + (totalPages || 1) + '</div>' +
        '<button onclick="changePage(1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm ' + nextClass + '" ' + nextDisabled + '>' +
          'Siguiente <i class="fa-solid fa-chevron-right text-xs"></i>' +
        '</button>' +
      '</div>';
    }
  }

  window.changePage = function(dir) {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    if (totalPages === 0) return;

    const newPage = currentPage + dir;
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage = newPage;
      renderFeed();
      const scrollContainer = document.getElementById("historyFeedScrollContainer");
      if (scrollContainer) scrollContainer.scrollTop = 0;
    }
  };

  // ==================== INICIO ====================

  loadHistory();
});