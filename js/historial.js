document.addEventListener("DOMContentLoaded", function () {
  let allHistory = [], filteredHistory = [], currentPage = 1, itemsPerPage = 10
  
  // 1. CARGAR DATOS
  async function loadHistory() {
    try {
      const res = await fetch("/api/historial");
      if (!res.ok) throw new Error("Error en API");
      const data = await res.json();
      allHistory = Array.isArray(data) ? data : [];
      applyFilters(); 
    } catch (error) {
      console.error("Error:", error);
      mostrarToast("Error cargando historial", "error");
      allHistory = [];
      renderTable();
    }
  }

  // 2. FILTROS
  window.applyFilters = function() {
    if (!allHistory) return; 
    const startStr = document.getElementById("filterDateStart").value, 
          endStr = document.getElementById("filterDateEnd").value, 
          plateStr = document.getElementById("filterPlate").value.toLowerCase(), 
          typeVal = document.getElementById("filterType").value

    filteredHistory = allHistory.filter(item => {
      let matchDate = true, matchPlate = true, matchType = true
      if (startStr && item.date < startStr) matchDate = false
      if (endStr && item.date > endStr) matchDate = false
      
      // CORRECCIÓN: Buscamos también en la columna 'spot' (Puesto)
      const searchableText = (item.plate || "") + " " + (item.spot || "");
      if (plateStr && !searchableText.toLowerCase().includes(plateStr)) matchPlate = false
      
      // CORRECCIÓN: Filtro estricto por categoría
      if (typeVal !== "all" && item.type !== typeVal) matchType = false
      return matchDate && matchPlate && matchType
    })
    currentPage = 1; 
    renderTable()
  }

  // 3. MODALES Y LIMPIEZA
  window.openCleanModal = function() {
      const modal = document.getElementById("modalCleanHistory");
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => {
          modal.classList.remove('opacity-0', 'scale-95');
          modal.classList.add('opacity-100', 'scale-100');
      }, 10);
  }

  window.closeCleanModal = function() {
      const modal = document.getElementById("modalCleanHistory");
      modal.classList.remove('opacity-100', 'scale-100');
      modal.classList.add('opacity-0', 'scale-95');
      setTimeout(() => {
          modal.classList.add('hidden');
          modal.classList.remove('flex');
      }, 200);
  }

  window.cleanHistoryRange = async function() {
      const from = document.getElementById("cleanDateFrom").value;
      const to = document.getElementById("cleanDateTo").value;
      const type = document.getElementById("cleanType").value;

      // CORRECCIÓN: Permitir borrar todo si se selecciona "Todo"
      if (!from && !to && type !== 'all') {
          mostrarToast("Seleccione fechas O la opción 'Todas las Categorías'", "error");
          return;
      }
      
      let confirmMsg = "¿Estás seguro de BORRAR registros?";
      if (type !== 'all') confirmMsg += ` de la categoría: ${type.toUpperCase()}`;
      if (from && to) confirmMsg += ` entre ${from} y ${to}`;
      if (!from && !to) confirmMsg += " de TODA LA BASE DE DATOS.";
      confirmMsg += "? Esta acción no se puede deshacer.";

      if (!confirm(confirmMsg)) return;

      try {
          const params = new URLSearchParams();
          if (from) params.append("fromDate", from);
          if (to) params.append("toDate", to);
          if (type && type !== 'all') params.append("type", type);

          const res = await fetch(`/api/historial?${params.toString()}`, { method: "DELETE" });
          const data = await res.json();
          
          if (data.success) {
              mostrarToast("Historial limpiado correctamente");
              closeCleanModal();
              loadHistory();
          } else {
              mostrarToast(data.error || "Error al limpiar", "error");
          }
      } catch(e) {
          console.error(e);
          mostrarToast("Error de conexión", "error");
      }
  }

  // 4. DESCARGA CSV
  window.downloadReport = function() {
    if (!allHistory || allHistory.length === 0) { mostrarToast("No hay datos", "error"); return; }
    
    const downloadType = document.getElementById("downloadType").value
    let dataToDownload = allHistory
    if (downloadType !== "all") dataToDownload = allHistory.filter(item => item.type === downloadType)

    let csvContent = "ID,Fecha,Hora,Salida,Placa/Referencia,Tipo,Descripcion,Valor\r\n"; 
    
    dataToDownload.forEach(row => { 
      const escapeCsv = (val) => {
          if (!val) return "";
          return '"' + String(val).replace(/"/g, '""') + '"';
      };

      const rowStr = [
        row.id, row.date, row.entry, row.exit || "", row.plate, row.type, row.spot || "", row.paid || 0
      ].map(escapeCsv).join(","); 
      
      csvContent += rowStr + "\r\n"; 
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_${downloadType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarToast("Reporte CSV generado y descargado");
  }

  // 5. UTILIDADES
  function mostrarToast(menido, tipo = 'success') {
    const toast = document.createElement('div')
    toast.className = `fixed top-5 right-5 z-50 px-4 py-3 rounded shadow-lg text-sm font-bold transition-all transform translate-x-full ${tipo === 'error' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`
    toast.innerText = mensaje; 
    document.body.appendChild(toast)
    requestAnimationFrame(() => toast.classList.remove('translate-x-full'))
    setTimeout(() => { toast.classList.add('translate-x-full'); setTimeout(() => toast.remove(), 300); }, 3000)
  }

  // 6. RENDERIZADO (ACTUALIZADO)
  function renderTable() {
    const tbody = document.getElementById("historyTableBody"); 
    if(!tbody) return; 
    
    if (!allHistory || allHistory.length === 0) {
         tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No hay registros disponibles.</td></tr>`;
         updateKPIs(0, 0, 0);
         return;
    }

    const start = (currentPage - 1) * itemsPerPage, 
          end = start + itemsPerPage, 
          pageData = filteredHistory.slice(start, end)
    
    // KPIs
    let totalVisits = 0, totalRevenue = 0, activeCount = 0;
    filteredHistory.forEach(h => { 
        totalVisits++;
        const val = parseFloat(h.paid || 0);
        if(h.type === 'GASTO') totalRevenue -= val; 
        else totalRevenue += val; 
        // Incluimos los nuevos tipos de vehículos en la cuenta de activos
        if (!h.exit && ['Carro Particular', 'Motocicleta', 'Camioneta/SUV'].includes(h.type)) activeCount++; 
    });
    updateKPIs(totalVisits, totalRevenue, activeCount);

    if (pageData.length === 0) { 
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No hay registros con estos filtros.</td></tr>` 
    } else {
      pageData.forEach(item => {
        const tr = document.createElement("tr"); 
        tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0";
        
        let displayDate = item.date;
        let displayEntry = item.entry; 
        let displayExit = "-"; 
        let displayPlate = item.plate; 
        let displayType = item.type; 
        let displayDetail = item.paid ? "$" + item.paid : "-"; 

        // --- LÓGICA VISUAL ---
        
        // 1. VEHÍCULOS (ACTUALIZADO)
        if (['Carro Particular', 'Motocicleta', 'Colaborador', 'Camioneta/SUV', 'Carro', 'Moto', 'Camioneta'].includes(item.type)) {
            const duration = calculateDuration(item.entry, item.exit);
            displayExit = item.exit || `<span class="text-amber-600 font-bold">En curso</span>`;
            displayDetail = duration;
            if (item.paid > 0) displayDetail += `<br><span class="text-emerald-600 font-bold text-xs">Pagado: $${item.paid}</span>`;
            
            // Colores y Badge para los tipos específicos
            let badgeColor = "bg-slate-100 text-slate-600";
            let badgeText = item.type.toUpperCase();
            
            if(item.type === 'Carro Particular') { badgeColor = "bg-blue-100 text-blue-700"; }
            else if(item.type === 'Motocicleta') { badgeColor = "bg-orange-100 text-orange-700"; badgeText = "MOTOCICLETA"; }
            else if (item.type === 'Camioneta/SUV') { badgeColor = "bg-purple-100 text-purple-700"; badgeText = "CAMIONETA/SUV"; }
            else if (item.type === 'Colaborador') { badgeColor = "bg-teal-100 text-teal-700"; }
            
            displayType = `<span class="${badgeColor} px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-opacity-20 border-current">${badgeText}</span>`;
        } 
        // 2. GASTOS
        else if (item.type === 'GASTO') {
            displayType = `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Gasto</span>`;
            displayDetail = `<span class="text-red-600 font-bold">-$${item.paid}</span><br><span class="text-xs text-slate-500 truncate max-w-[150px]" title="${item.spot}">${item.spot}</span>`;
            displayPlate = "N/A";
        }
        // 3. CAJA (Cobros)
        else if (item.type === 'CAJA') {
            displayType = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Cobro</span>`;
            // CORRECCIÓN: Si es CAJA, placa es "---", y el detalle va en la columna Descripción.
            displayPlate = "---";
            displayDetail = `<span class="text-emerald-600 font-bold">+$${item.paid}</span><br><span class="text-xs text-slate-500 truncate max-w-[150px]">${item.spot}</span>`;
        }
        // 4. CLIENTE (Creación/Edición)
        else if (item.type === 'CLIENTE') {
            displayType = `<span class="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Cliente</span>`;
            displayDetail = `<span class="text-slate-600 text-xs">Registro</span><br><span class="text-xs text-slate-500 truncate max-w-[150px]">${item.spot}</span>`;
            displayPlate = "N/A";
        }
        // 5. PUESTO (Administrativo)
        else if (item.type === 'PUESTO') {
            displayType = `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Puesto</span>`;
            displayDetail = `<span class="text-slate-600 text-xs">Acción Admin</span><br><span class="text-xs text-slate-500 truncate max-w-[150px]">${item.spot}</span>`;
            displayPlate = "---";
        }
        // 6. OTROS
        else {
             displayType = `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${item.type}</span>`;
             displayDetail = item.spot || "-";
             displayPlate = item.plate || "---";
        }

        tr.innerHTML = `
          <td class="px-4 py-3 text-sm text-slate-500 font-medium whitespace-nowrap">${displayDate}</td>
          <td class="px-4 py-3 text-sm font-mono text-slate-600">${displayEntry}</td>
          <td class="px-4 py-3 text-sm font-mono">${displayExit}</td>
          <td class="px-4 py-3 text-sm font-bold text-slate-800 font-mono tracking-wider">${displayPlate}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${displayType}</td>
          <td class="px-4 py-3 text-sm text-slate-600 text-right">${displayDetail}</td>
        `;
        tbody.appendChild(tr)
      })
    }
    updatePagination()
  }

  function updateKPIs(count, revenue, active) {
    document.getElementById("kpiVisits").innerText = count;
    const sign = revenue < 0 ? "" : "$";
    const colorClass = revenue < 0 ? "text-red-600" : "text-emerald-600";
    const kpiRev = document.getElementById("kpiRevenue");
    kpiRev.innerText = sign + Math.abs(revenue).toLocaleString();
    kpiRev.className = `text-xl font-bold font-mono block mt-1 ${colorClass}`;
    document.getElementById("kpiActive").innerText = active;
  }

  function calculateDuration(entry, exit) {
    if (!entry) return "-"
    if (!exit) return "En curso"
    const [h1, m1] = entry.split(':').map(Number), [h2, m2] = exit.split(':').map(Number)
    let diffM = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (diffM < 0) diffM += 24 * 60
    const hours = Math.floor(diffM / 60), mins = diffM % 60
    return `${hours}h ${mins}m`
  }

  function updatePagination() {
    if(!filteredHistory) return;
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage), 
          info = document.getElementById("paginationInfo"), 
          controls = document.getElementById("paginationControls")
          
    const start = filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1, 
          end = Math.min(currentPage * itemsPerPage, filteredHistory.length)
          
    if(!info || !controls) return;
    info.innerText = `Mostrando ${start} a ${end} de ${filteredHistory.length} registros`
    
    controls.innerHTML = `
      <button onclick="changePage('prev')" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold ${currentPage === 1 ? 'opacity-50' : ''}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
      <span class="mx-2 text-xs text-slate-500">Pág ${currentPage} / ${totalPages || 1}</span>
      <button onclick="changePage('next')" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold ${currentPage === totalPages || totalPages === 0 ? 'opacity-50' : ''}" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Siguiente <i class="fa-solid fa-chevron-right ml-1"></i></button>
    `
  }

  window.changePage = function(dir) {
    if(!filteredHistory) return;
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)
    if (dir === 'prev' && currentPage > 1) currentPage--
    if (dir === 'next' && currentPage < totalPages) currentPage++
    renderTable()
  }

  window.toggleMenu = function() { 
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileMenuOverlay');
    if(sidebar && overlay) { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); }
  }
  
  const fechaEl = document.getElementById("fecha-actual")
  if(fechaEl) { 
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; 
    fechaEl.textContent = new Date().toLocaleDateString('es-ES', opts) 
  }

  loadHistory()
})