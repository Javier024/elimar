document.addEventListener("DOMContentLoaded", function () {
  let allHistory = [], filteredHistory = [], currentPage = 1, itemsPerPage = 8;

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

  window.applyFilters = function() {
    const startStr = document.getElementById("filterDateStart").value, 
          endStr = document.getElementById("filterDateEnd").value, 
          searchStr = document.getElementById("filterSearch").value.toLowerCase(), 
          typeVal = document.getElementById("filterType").value;

    filteredHistory = allHistory.filter(item => {
      if (startStr && item.date < startStr) return false;
      if (endStr && item.date > endStr) return false;
      if (typeVal !== "all" && item.type !== typeVal) return false;
      
      const text = (item.plate || "") + " " + (item.spot || "");
      if (searchStr && !text.toLowerCase().includes(searchStr)) return false;
      
      return true;
    });
    
    currentPage = 1; 
    renderFeed();
  }

  window.deleteItem = async function(id) {
      if(!confirm("¿Eliminar este registro?")) return;
      try {
          await fetch(`/api/historial?id=${id}`, { method: "DELETE" });
          mostrarToast("Eliminado");
          loadHistory();
      } catch(e) { mostrarToast("Error", "error"); }
  }

  function mostrarToast(msg, type='success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all transform translate-y-10 opacity-0 ${type==='error'?'bg-red-600 text-white':'bg-slate-800 text-white'}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(()=>toast.classList.remove('translate-y-10','opacity-0'));
    setTimeout(()=>{ toast.classList.add('translate-y-10','opacity-0'); setTimeout(()=>toast.remove(),300); }, 3000);
  }

  function formatMoney(amount) {
      if(!amount) return "-";
      const val = parseFloat(amount);
      return (val < 0 ? "-$" : "$") + Math.abs(val).toLocaleString('es-CO');
  }

  function renderFeed() {
    const container = document.getElementById("historyFeed"); 
    if(!container) return; 
    
    if (filteredHistory.length === 0) {
         container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-slate-400"><i class="fa-solid fa-folder-open text-5xl mb-4 opacity-20"></i><p class="text-sm font-medium">No hay movimientos registrados</p></div>`;
         return;
    }

    const start = (currentPage - 1) * itemsPerPage, end = start + itemsPerPage, pageData = filteredHistory.slice(start, end);
    
    container.innerHTML = "";

    pageData.forEach(item => {
        const el = document.createElement("div");
        
        let cardStyle = "border-slate-200 bg-white";
        let iconBg = "bg-slate-100 text-slate-500";
        let iconClass = "fa-circle-info";
        let title = item.type;
        let subhead = item.spot || "Sistema";
        let detailRight = "";
        let borderLeft = "border-l-4 border-l-slate-300";

        const typeStr = (item.type || "").toLowerCase();

        // Lógica Vehículos
        if (typeStr.includes('carro') || typeStr.includes('particular') || typeStr.includes('moto') || typeStr.includes('camioneta') || typeStr.includes('suv') || typeStr.includes('cobrador')) {
            borderLeft = item.exit ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"; 
            cardStyle = item.exit ? "bg-white" : "bg-amber-50/30"; 
            
            if (typeStr.includes('moto')) iconClass = "fa-motorcycle";
            else if (typeStr.includes('camioneta') || typeStr.includes('suv')) iconClass = "fa-truck-pickup";
            else iconClass = "fa-car-side";
            
            iconBg = item.exit ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600";
            
            title = item.plate || "Sin Placa";
            subhead = item.type; // Muestra el tipo tal cual (Carro, Moto, etc)
            
            // Hora visualizada directamente (formato 24h)
            const timeBadge = item.exit 
                ? `<span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Salida: ${item.exit}</span>`
                : `<span class="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 flex items-center gap-1 animate-pulse"><i class="fa-solid fa-circle text-[8px]"></i> En curso</span>`;
            
            detailRight = `
                <div class="flex flex-col items-end gap-1">
                    ${timeBadge}
                    <span class="text-xs text-slate-400">Entrada: ${item.entry}</span>
                    ${item.paid > 0 ? `<span class="text-[10px] font-bold text-emerald-600">Pagó: $${item.paid}</span>` : ''}
                </div>
            `;
        }
        // Lógica Caja
        else if (typeStr === 'caja') {
            borderLeft = "border-l-4 border-l-indigo-500";
            iconBg = "bg-indigo-100 text-indigo-600";
            iconClass = "fa-money-bill-trend-up";
            title = "Ingreso de Caja";
            subhead = item.spot; 
            detailRight = `<span class="font-mono font-bold text-indigo-600 text-lg">+ $${item.paid || 0}</span>`;
        }
        // Lógica Gastos
        else if (typeStr === 'gasto') {
            borderLeft = "border-l-4 border-l-rose-500";
            iconBg = "bg-rose-100 text-rose-600";
            iconClass = "fa-receipt";
            title = "Gasto Registrado";
            subhead = item.spot; 
            detailRight = `<span class="font-mono font-bold text-rose-600 text-lg">- $${Math.abs(item.paid || 0)}</span>`;
        }
        // Lógica Cliente
        else if (typeStr === 'cliente') {
            borderLeft = "border-l-4 border-l-cyan-500";
            iconBg = "bg-cyan-100 text-cyan-600";
            iconClass = "fa-user-plus";
            title = "Nuevo Cliente";
            subhead = item.spot;
            detailRight = `<span class="text-xs text-slate-400">Registro</span>`;
        }
        // Lógica Puesto
        else if (typeStr === 'puesto') {
            borderLeft = "border-l-4 border-l-purple-500";
            iconBg = "bg-purple-100 text-purple-600";
            iconClass = "fa-map-location-dot";
            title = "Gestión Puesto";
            subhead = item.spot;
            detailRight = `<span class="text-xs text-slate-400">Admin</span>`;
        }

        el.className = `group relative p-4 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${cardStyle} ${borderLeft} flex items-center justify-between gap-4`;
        
        el.innerHTML = `
            <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center shadow-sm ${iconBg}">
                    <i class="fa-solid ${iconClass} text-lg"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="font-bold text-slate-800 truncate">${title}</h4>
                    </div>
                    <div class="flex items-center gap-2 text-xs text-slate-500 truncate">
                        <span class="font-medium text-slate-400">${item.date}</span>
                        <span class="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>${subhead}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-end justify-between gap-1 shrink-0">
                ${detailRight}
                <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 mt-2">
                    <button onclick="deleteItem(${item.id})" class="text-slate-300 hover:text-red-500 transition-colors p-1" title="Eliminar">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(el);
    });
    updatePagination();
  }

  function updatePagination() {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const start = filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredHistory.length);
    
    const info = document.getElementById("pageInfo");
    const controls = document.getElementById("pageControls");
    
    if(info) info.innerText = `${start}-${end} de ${filteredHistory.length}`;
    if(controls) {
        controls.innerHTML = `
            <button onclick="changePage(-1)" class="p-2 rounded-lg bg-white border hover:bg-slate-50 ${currentPage===1?'opacity-50 cursor-not-allowed':''}" ${currentPage===1?'disabled':''}><i class="fa-solid fa-chevron-left"></i></button>
            <button onclick="changePage(1)" class="p-2 rounded-lg bg-white border hover:bg-slate-50 ${currentPage>=totalPages?'opacity-50 cursor-not-allowed':''}" ${currentPage>=totalPages?'disabled':''}><i class="fa-solid fa-chevron-right"></i></button>
        `;
    }
  }

  window.changePage = function(dir) {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    if ((dir === -1 && currentPage > 1) || (dir === 1 && currentPage < totalPages)) {
        currentPage += dir;
        renderFeed();
    }
  }

  loadHistory();
});