document.addEventListener("DOMContentLoaded", function () {
  let allHistory = [], filteredHistory = [], currentPage = 1, itemsPerPage = 10
  
  // ==========================================
  // 1. CARGAR DATOS
  // ==========================================
  async function loadHistory() {
    try {
      const res = await fetch("/api/historial");
      if (!res.ok) throw new Error("Error en API");
      const data = await res.json();
      
      if (!Array.isArray(data)) {
          allHistory = [];
      } else {
          allHistory = data; 
      }
      applyFilters(); 
    } catch (error) {
      console.error("Error:", error);
      mostrarToast("Error cargando historial", "error");
      allHistory = [];
      renderTable();
    }
  }

  // ==========================================
  // 2. FILTROS
  // ==========================================
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
      // Filtrar por placa O por descripción (spot) para que busque gastos también
      const searchableText = (item.plate || "") + " " + (item.spot || "");
      if (plateStr && !searchableText.toLowerCase().includes(plateStr)) matchPlate = false
      
      if (typeVal !== "all" && item.type !== typeVal) matchType = false
      return matchDate && matchPlate && matchType
    })
    currentPage = 1; 
    renderTable()
  }

  // ==========================================
  // 3. LIMPIEZA DE HISTORIAL
  // ==========================================
  window.openCleanModal = function() {
      const modal = document.getElementById("modalCleanHistory");
      modal.classList.remove("hidden");
      setTimeout(() => modal.classList.remove("opacity-0"), 10);
  }

  window.closeCleanModal = function() {
      const modal = document.getElementById("modalCleanHistory");
      modal.classList.add("opacity-0");
      setTimeout(() => modal.classList.add("hidden"), 200);
  }

  window.cleanHistoryRange = async function() {
      const from = document.getElementById("cleanDateFrom").value;
      const to = document.getElementById("cleanDateTo").value;

      if (!from || !to) {
          mostrarToast("Seleccione ambas fechas", "error");
          return;
      }
      
      if (!confirm(`¿Estás seguro de BORRAR todo el historial entre ${from} y ${to}? Esta acción no se puede deshacer.`)) return;

      try {
          const res = await fetch(`/api/historial?fromDate=${from}&toDate=${to}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
              mostrarToast("Historial limpiado correctamente");
              closeCleanModal();
              loadHistory();
          } else {
              mostrarToast(data.error || "Error al limpiar", "error");
          }
      } catch(e) {
          mostrarToast("Error de conexión", "error");
      }
  }

  // ==========================================
  // 4. DESCARGA CSV
  // ==========================================
  window.downloadReport = function() {
    if (!allHistory || allHistory.length === 0) { mostrarToast("No hay datos", "error"); return; }
    const downloadType = document.getElementById("downloadType").value
    let dataToDownload = allHistory
    if (downloadType !== "all") dataToDownload = allHistory.filter(item => item.type === downloadType)

    let csvContent = "data:text/csv;charset=utf-8,"; 
    csvContent += "ID,Fecha,Hora,Salida,Placa/Ref,Tipo,Descripcion/Spot,Valor\n" // Cabecera ajustada
    
    dataToDownload.forEach(row => { 
      const rowStr = [
        row.id, 
        row.date, 
        row.entry, 
        row.exit || "", 
        row.plate, 
        row.type, 
        (row.spot || "").replace(/,/g, " "), // Limpiar comas
        row.paid || 0
      ].join(","); 
      csvContent += rowStr + "\n" 
    })

    const encodedUri = encodeURI(csvContent), link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `historial_completo_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link); 
    mostrarToast("Reporte descargado")
  }

  // ==========================================
  // 5. UTILIDADES
  // ==========================================
  function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div')
    toast.className = `fixed top-5 right-5 z-50 px-4 py-3 rounded shadow-lg text-sm font-bold transition-all transform translate-x-full ${tipo === 'error' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`
    toast.innerText = mensaje; 
    document.body.appendChild(toast)
    requestAnimationFrame(() => toast.classList.remove('translate-x-full'))
    setTimeout(() => { toast.classList.add('translate-x-full'); setTimeout(() => toast.remove(), 300); }, 3000)
  }

  // ==========================================
  // 6. RENDERIZADO INTELIGENTE
  // ==========================================
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
        // Si es GASTO, restamos; si es CAJA, sumamos; si es AUTO, sumamos pagado
        const val = parseFloat(h.paid || 0);
        if(h.type === 'GASTO') totalRevenue -= val; // Gasto = Salida de dinero
        else totalRevenue += val; // Caja/Pagado = Entrada

        if (!h.exit && (h.type === 'Carro' || h.type === 'Moto' || h.type === 'Camioneta')) activeCount++; 
    });
    updateKPIs(totalVisits, totalRevenue, activeCount);

    if (pageData.length === 0) { 
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No hay registros con estos filtros.</td></tr>` 
    } else {
      pageData.forEach(item => {
        const tr = document.createElement("tr"); 
        tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0";
        
        // Lógica de visualización según el tipo
        let col1 = item.date;
        let col2 = item.entry; // Hora acción
        let col3 = "-"; // Salida
        let col4 = item.plate; // Placa
        let col5 = item.type; // Tipo
        let col6 = item.paid ? "$" + item.paid : "-"; // Valor

        // Si es VEHÍCULO
        if (['Carro', 'Moto', 'Camioneta'].includes(item.type)) {
            const duration = calculateDuration(item.entry, item.exit);
            col3 = item.exit || `<span class="text-amber-600 font-bold">En curso</span>`;
            col6 = duration;
            if (item.paid > 0) {
                col6 += `<br><span class="text-emerald-600 font-bold text-xs">Pagado: $${item.paid}</span>`;
            }
        } 
        // Si es GASTO
        else if (item.type === 'GASTO') {
            col1 = item.date; // Fecha
            col2 = `<span class="text-red-600 font-bold">-</span>`; // Sin hora entrada
            col3 = `<span class="text-red-600 font-bold">-</span>`; // Sin salida
            col4 = "N/A"; // Sin placa
            col5 = `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">GASTO</span>`;
            col6 = `<span class="text-red-600 font-bold">-$${item.paid}</span><br><span class="text-xs text-slate-500">${item.spot}</span>`;
        }
        // Si es CAJA
        else if (item.type === 'CAJA') {
            col1 = item.date;
            col2 = item.entry;
            col3 = "-";
            col4 = "---";
            col5 = `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">COBRO</span>`;
            col6 = `<span class="text-emerald-600 font-bold">+$${item.paid}</span><br><span class="text-xs text-slate-500">${item.spot}</span>`;
        }
        // Si es CLIENTE
        else if (item.type === 'CLIENTE') {
            col1 = item.date;
            col2 = item.entry;
            col3 = "-";
            col4 = "N/A";
            col5 = `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">CLIENTE</span>`;
            col6 = `<span class="text-slate-600">Registro</span><br><span class="text-xs text-slate-500">${item.spot}</span>`;
        }

        tr.innerHTML = `
          <td class="px-6 py-4 text-sm text-slate-500 font-medium">${col1}</td>
          <td class="px-6 py-4 text-sm font-mono text-slate-600">${col2}</td>
          <td class="px-6 py-4 text-sm font-mono">${col3}</td>
          <td class="px-6 py-4 text-sm font-bold text-slate-800 font-mono tracking-wider">${col4}</td>
          <td class="px-6 py-4 text-sm text-slate-600">${col5}</td>
          <td class="px-6 py-4 text-sm text-slate-600 text-right">${col6}</td>
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