// parqueo/js/historial.js

document.addEventListener("DOMContentLoaded", function () {
  let allHistory = [], filteredHistory = [], currentPage = 1, itemsPerPage = 10; 

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
      // Filtro de fechas (comparando strings YYYY-MM-DD funciona directamente)
      if (startStr && item.date < startStr) return false;
      if (endStr && item.date > endStr) return false;
      
      // Filtro de tipo
      if (typeVal !== "all") {
          // Búsqueda parcial o exacta dependiendo del valor
          if(typeVal === 'CAJA' && item.type !== 'caja') return false;
          else if(typeVal === 'GASTO' && item.type !== 'gasto') return false;
          else if(typeVal === 'CLIENTE' && item.type !== 'cliente') return false;
          else if(typeVal === 'PUESTO' && item.type !== 'puesto') return false;
          // Para vehículos buscamos si la palabra clave está en el tipo
          else if (['Carro', 'Moto', 'Camioneta'].includes(typeVal)) {
              if (!item.type.toLowerCase().includes(typeVal.toLowerCase())) return false;
          }
      }
      
      // Buscador general (placa o puesto/descripción)
      const text = (item.plate || "") + " " + (item.spot || "");
      if (searchStr && !text.toLowerCase().includes(searchStr)) return false;
      
      return true;
    });
    
    currentPage = 1; 
    renderFeed();
  }

  window.deleteItem = async function(id) {
      if(!confirm("¿Eliminar este registro permanentemente?")) return;
      try {
          await fetch(`/api/historial?id=${id}`, { method: "DELETE" });
          mostrarToast("Registro eliminado correctamente");
          loadHistory();
      } catch (e) { mostrarToast("Error al eliminar", "error"); }
  }

  function mostrarToast(msg, type='success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all transform translate-y-10 opacity-0 ${type==='error'?'bg-red-600 text-white':'bg-slate-800 text-white'}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(()=>toast.classList.remove('translate-y-10','opacity-0'));
    setTimeout(()=>{ toast.classList.add('translate-y-10','opacity-0'); setTimeout(()=>toast.remove(),300); }, 3000);
  }

  function renderFeed() {
    const container = document.getElementById("historyFeedBody"); 
    if(!container) return; 
    
    if (filteredHistory.length === 0) {
         container.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-slate-400"><div class="flex flex-col items-center justify-center gap-3"><i class="fa-solid fa-inbox text-4xl opacity-20"></i><p class="text-sm font-medium">No hay registros coincidentes</p></div></td></tr>`;
         updatePagination();
         return;
    }

    const start = (currentPage - 1) * itemsPerPage, end = start + itemsPerPage, pageData = filteredHistory.slice(start, end);
    
    container.innerHTML = "";

    pageData.forEach(item => {
        const tr = document.createElement("tr");
        
        // Clases base
        let rowClass = "hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0";
        let borderLeftClass = "";
        let iconBg = "bg-slate-100 text-slate-500";
        let iconClass = "fa-circle-info";
        let title = item.type;
        let subhead = item.spot || "General";
        let statusCell = "";

        const typeStr = (item.type || "").toLowerCase();

        // --- Lógica de Visualización según Tipo ---

        // 1. Vehículos (Carro, Moto, etc.)
        if (typeStr.includes('carro') || typeStr.includes('particular') || typeStr.includes('moto') || typeStr.includes('camioneta') || typeStr.includes('suv') || typeStr.includes('cobrador')) {
            borderLeftClass = item.exit ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"; 
            
            if (typeStr.includes('moto')) iconClass = "fa-motorcycle";
            else if (typeStr.includes('camioneta') || typeStr.includes('suv')) iconClass = "fa-truck-pickup";
            else iconClass = "fa-car-side";
            
            iconBg = item.exit ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600";
            
            title = item.plate || "SIN PLACA";
            subhead = item.type; 
            
            // Estado (Salida o En Curso)
            if (item.exit) {
                statusCell = `
                    <div class="flex flex-col items-end gap-1">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                            <i class="fa-solid fa-check"></i> ${item.exit}
                        </span>
                        <span class="text-[10px] text-slate-400">Ent: ${item.entry}</span>
                    </div>
                `;
            } else {
                statusCell = `
                    <div class="flex flex-col items-end gap-1">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 animate-pulse">
                            <i class="fa-solid fa-circle text-[6px]"></i> EN CURSO
                        </span>
                        <span class="text-[10px] text-slate-400">Ent: ${item.entry}</span>
                    </div>
                `;
            }
        }
        // 2. Caja / Ingresos
        else if (typeStr === 'caja') {
            borderLeftClass = "border-l-4 border-l-indigo-500";
            iconBg = "bg-indigo-100 text-indigo-600";
            iconClass = "fa-money-bill-wave";
            title = "Ingreso de Caja";
            subhead = item.spot; 
            statusCell = `
                <div class="text-right">
                    <span class="block font-mono font-bold text-indigo-600 text-sm">+ $${Number(item.paid || 0).toLocaleString('es-CO')}</span>
                    <span class="text-[10px] text-slate-400">${item.entry}</span>
                </div>`;
        }
        // 3. Gastos
        else if (typeStr === 'gasto') {
            borderLeftClass = "border-l-4 border-l-rose-500";
            iconBg = "bg-rose-100 text-rose-600";
            iconClass = "fa-receipt";
            title = "Gasto Registrado";
            subhead = item.spot; 
            statusCell = `
                <div class="text-right">
                    <span class="block font-mono font-bold text-rose-600 text-sm">- $${Math.abs(Number(item.paid || 0)).toLocaleString('es-CO')}</span>
                    <span class="text-[10px] text-slate-400">${item.entry}</span>
                </div>`;
        }
        // 4. Cliente
        else if (typeStr === 'cliente') {
            borderLeftClass = "border-l-4 border-l-cyan-500";
            iconBg = "bg-cyan-100 text-cyan-600";
            iconClass = "fa-user-plus";
            title = "Nuevo Cliente";
            subhead = item.spot;
            statusCell = `<span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">REGISTRO</span>`;
        }
        // 5. Puesto
        else if (typeStr === 'puesto') {
            borderLeftClass = "border-l-4 border-l-purple-500";
            iconBg = "bg-purple-100 text-purple-600";
            iconClass = "fa-map-pin";
            title = "Gestión Puesto";
            subhead = item.spot;
            statusCell = `<span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">ADMIN</span>`;
        }

        tr.className = `${rowClass} ${borderLeftClass}`;
        
        // Botón de eliminar (Hover)
        const deleteBtn = `
            <button onclick="deleteItem(${item.id})" class="opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Eliminar registro">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        // Renderizado de Fila
        tr.innerHTML = `
            <td class="p-3 align-middle">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}">
                        <i class="fa-solid ${iconClass} text-xs"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="font-bold text-slate-800 text-sm truncate">${title}</div>
                        <div class="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">${item.type}</div>
                    </div>
                </div>
            </td>
            <td class="p-3 align-middle whitespace-nowrap">
                <div class="text-xs text-slate-500 font-medium">${item.date}</div>
            </td>
            <td class="p-3 align-middle">
                <div class="text-xs font-medium text-slate-700 truncate max-w-[150px]" title="${subhead}">${subhead}</div>
            </td>
            <td class="p-3 align-middle">
                ${statusCell}
            </td>
            <td class="p-3 align-middle text-center">
                ${deleteBtn}
            </td>
        `;
        container.appendChild(tr);
    });
    updatePagination();
  }

  function updatePagination() {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    // Calcular rango visible
    const start = filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, filteredHistory.length);
    
    const info = document.getElementById("pageInfo");
    const controls = document.getElementById("pageControls");
    
    if(info) info.innerText = `${start}-${end} de ${filteredHistory.length}`;
    
    if(controls) {
        const isPrevDisabled = currentPage === 1 || totalPages === 0;
        const isNextDisabled = currentPage >= totalPages || totalPages === 0;

        // ESTILO SEPARADO (Justify-between)
        controls.innerHTML = `
            <div class="flex justify-between w-full items-center">
                <button onclick="changePage(-1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm ${isPrevDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}" ${isPrevDisabled ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left text-xs"></i> Anterior
                </button>
                
                <div class="text-xs font-medium text-slate-400">
                    Página ${currentPage} de ${totalPages || 1}
                </div>

                <button onclick="changePage(1)" class="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm ${isNextDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}" ${isNextDisabled ? 'disabled' : ''}>
                    Siguiente <i class="fa-solid fa-chevron-right text-xs"></i>
                </button>
            </div>
        `;
    }
  }

  window.changePage = function(dir) {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    if (totalPages === 0) return;

    const newPage = currentPage + dir;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderFeed();
        // Scroll al inicio de la tabla
        const scrollContainer = document.getElementById("historyFeedScrollContainer");
        if(scrollContainer) scrollContainer.scrollTop = 0;
    }
  }

  loadHistory();
});