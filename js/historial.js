document.addEventListener("DOMContentLoaded", function () {
  let allHistory = [], filteredHistory = [], currentPage = 1, itemsPerPage = 8
  
  // ==========================================
  // 1. CARGAR DATOS (CON PROTECCIÓN CONTRA ERRORES)
  // ==========================================
  async function loadHistory() {
    try {
      const res = await fetch("/api/historial");
      
      // Verificar que la respuesta sea correcta
      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      
      // Verificar que recibimos un array
      if (!Array.isArray(data)) {
        console.error("La API devolvió datos incorrectos:", data);
        mostrarToast("Error: Formato de datos incorrecto", "error");
        allHistory = []; // Inicializar vacío
        renderTable();
        return;
      }

      // Si todo está bien, guardamos y filtramos
      allHistory = data; 
      applyFilters(); 

    } catch (error) {
      console.error("Error crítico en loadHistory:", error);
      mostrarToast("No se pudo conectar con el servidor", "error");
      
      // IMPORTANTE: Si falla la carga, aseguramos que allHistory sea un array vacío 
      // para evitar el error "allHistory.filter is not a function"
      allHistory = [];
      renderTable();
    }
  }

  // ==========================================
  // 2. FILTROS (CON PROTECCIÓN)
  // ==========================================
  window.applyFilters = function() {
    // Seguridad: Verificar que allHistory exista
    if (!allHistory) return; 

    const startStr = document.getElementById("filterDateStart").value, 
          endStr = document.getElementById("filterDateEnd").value, 
          plateStr = document.getElementById("filterPlate").value.toLowerCase(), 
          typeVal = document.getElementById("filterType").value

    filteredHistory = allHistory.filter(item => {
      let matchDate = true, matchPlate = true, matchType = true
      if (startStr && item.date < startStr) matchDate = false
      if (endStr && item.date > endStr) matchDate = false
      if (plateStr && !item.plate.toLowerCase().includes(plateStr)) matchPlate = false
      if (typeVal !== "all" && item.type !== typeVal) matchType = false
      return matchDate && matchPlate && matchType
    })
    currentPage = 1; 
    renderTable()
  }

  // ==========================================
  // 3. DESCARGA CSV
  // ==========================================
  window.downloadReport = function() {
    if (!allHistory || allHistory.length === 0) { mostrarToast("No hay datos para descargar", "error"); return; }

    const downloadType = document.getElementById("downloadType").value
    let dataToDownload = allHistory
    if (downloadType !== "all") dataToDownload = allHistory.filter(item => item.type === downloadType)

    let csvContent = "data:text/csv;charset=utf-8,"; 
    csvContent += "ID,Fecha,Entrada,Salida,Placa,Tipo,Puesto,Pagado\n"
    
    dataToDownload.forEach(row => { 
      const rowStr = [
        row.id, 
        row.date, 
        row.entry, 
        row.exit || "En curso", 
        row.plate, 
        row.type || "-", 
        row.spot || "-", 
        row.paid || 0
      ].join(","); 
      csvContent += rowStr + "\n" 
    })

    const encodedUri = encodeURI(csvContent), link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    
    let fileName = "reporte_completo"
    if(downloadType === "Carro") fileName = "reporte_carros"; 
    if(downloadType === "Moto") fileName = "reporte_motos"; 
    if(downloadType === "Camioneta") fileName = "reporte_camionetas"
    
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
    mostrarToast("Reporte descargado")
  }

  // ==========================================
  // 4. MODAL MANUAL
  // ==========================================
  window.openModalAddHistory = function() {
    const modal = document.getElementById("modalAddHistory"); 
    modal.classList.remove("hidden")
    setTimeout(() => { 
      modal.firstElementChild.classList.remove("scale-95", "opacity-0"); 
      modal.firstElementChild.classList.add("scale-100", "opacity-100") 
    }, 10)
  }

  window.closeModalAddHistory = function() {
    const modal = document.getElementById("modalAddHistory")
    modal.firstElementChild.classList.remove("scale-100", "opacity-100"); 
    modal.firstElementChild.classList.add("scale-95", "opacity-0")
    setTimeout(() => modal.classList.add("hidden"), 200)
  }

  window.saveManualHistory = async function() {
    const plate = document.getElementById("manualPlate").value.toUpperCase(), 
          type = document.getElementById("manualType").value, 
          spot = document.getElementById("manualSpot").value
    
    if (!plate) return mostrarToast("La placa es obligatoria", "error")
    
    try {
      const res = await fetch("/api/historial", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ plate, type, spot }) 
      });
      const data = await res.json()
      
      if (data.success) { 
        closeModalAddHistory(); 
        document.getElementById("manualForm").reset(); 
        loadHistory(); 
        mostrarToast("Agregado al historial") 
      } else { 
        mostrarToast("Error al guardar", "error") 
      }
    } catch (e) { 
      mostrarToast("Error de conexión", "error") 
    }
  }

  // ==========================================
  // 5. UTILIDADES Y TOASTS
  // ==========================================
  function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div')
    toast.className = `fixed top-5 right-5 z-50 px-4 py-3 rounded shadow-lg text-sm font-bold transition-all transform translate-x-full ${tipo === 'error' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`
    toast.innerText = mensaje; 
    document.body.appendChild(toast)
    requestAnimationFrame(() => toast.classList.remove('translate-x-full'))
    setTimeout(() => { 
      toast.classList.add('translate-x-full'); 
      setTimeout(() => toast.remove(), 300); 
    }, 3000)
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

  // ==========================================
  // 6. RENDERIZADO DE TABLA
  // ==========================================
  function renderTable() {
    const tbody = document.getElementById("historyTableBody"); 
    if(!tbody) return; 
    
    // Seguridad: Si allHistory es undefined o nulo, mostramos mensaje de vacío
    if (!allHistory || allHistory.length === 0) {
         tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No hay registros disponibles.</td></tr>`;
         document.getElementById("kpiVisits").innerText = 0;
         document.getElementById("kpiRevenue").innerText = "$0";
         document.getElementById("kpiActive").innerText = 0;
         return;
    }

    const start = (currentPage - 1) * itemsPerPage, 
          end = start + itemsPerPage, 
          pageData = filteredHistory.slice(start, end)
    
    // Cálculo de KPIs en tiempo real
    let totalVisits = filteredHistory.length, 
        totalRevenue = 0, 
        activeCount = 0
    
    filteredHistory.forEach(h => { 
      // Sumamos el dinero pagado
      totalRevenue += parseFloat(h.paid || 0); 
      // Contamos los que no tienen hora de salida (Coches adentro)
      if (!h.exit) activeCount++ 
    })
    
    document.getElementById("kpiVisits").innerText = totalVisits
    document.getElementById("kpiRevenue").innerText = "$" + totalRevenue.toLocaleString()
    document.getElementById("kpiActive").innerText = activeCount

    if (pageData.length === 0) { 
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No hay registros con estos filtros.</td></tr>` 
    } else {
      pageData.forEach(item => {
        const tr = document.createElement("tr"); 
        tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
        
        const duration = calculateDuration(item.entry, item.exit);
        const statusClass = !item.exit ? "text-amber-600 font-bold" : "text-slate-600"
        
        tr.innerHTML = `
          <td class="px-6 py-4 text-sm text-slate-500 font-medium">${item.date}</td>
          <td class="px-6 py-4 text-sm font-mono text-slate-600">${item.entry}</td>
          <td class="px-6 py-4 text-sm font-mono ${statusClass}">${item.exit || "-"}</td>
          <td class="px-6 py-4 text-sm font-bold text-slate-800 font-mono tracking-wider">${item.plate}</td>
          <td class="px-6 py-4 text-sm text-slate-600">${item.type || '-'}</td>
          <td class="px-6 py-4 text-sm text-slate-600 font-mono">${duration}</td>
        `
        tbody.appendChild(tr)
      })
    }
    updatePagination()
  }

  // ==========================================
  // 7. PAGINACIÓN
  // ==========================================
  function updatePagination() {
    // Verificar que filteredHistory existe
    if(!filteredHistory) return; // Evitar error si la carga falló

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage), 
          info = document.getElementById("paginationInfo"), 
          controls = document.getElementById("paginationControls")
          
    const start = filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1, 
          end = Math.min(currentPage * itemsPerPage, filteredHistory.length)
          
    if(!info || !controls) return; // Evitar error si no existen los elementos

    info.innerText = `Mostrando ${start} a ${end} de ${filteredHistory.length} registros`
    
    controls.innerHTML = `
      <button onclick="changePage('prev')" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold ${currentPage === 1 ? 'opacity-50' : ''}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
      <span class="mx-2 text-xs text-slate-500">Pág ${currentPage} / ${totalPages || 1}</span>
      <button onclick="changePage('next')" class="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold ${currentPage === totalPages || totalPages === 0 ? 'opacity-50' : ''}" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Siguiente <i class="fa-solid fa-chevron-right ml-1"></i></button>
    `
  }

  // ==========================================
  // 8. CONTROL DEL MENÚ MÓVIL
  // ==========================================
  window.changePage = function(dir) {
    if(!filteredHistory) return;
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)
    if (dir === 'prev' && currentPage > 1) currentPage--
    if (dir === 'next' && currentPage < totalPages) currentPage++
    renderTable()
  }

  // ==========================================
  // 9. HELPER DE MENÚ
  // ==========================================
  window.toggleMenu = function() { 
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileMenuOverlay');
    if(sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full'); 
        overlay.classList.toggle('hidden'); 
    }
  }
  
  // ==========================================
  // 10. INICIALIZACIÓN
  // ==========================================
  const fechaEl = document.getElementById("fecha-actual")
  if(fechaEl) { 
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; 
    fechaEl.textContent = new Date().toLocaleDateString('es-ES', opts) 
  }

  // Iniciar carga
  loadHistory()
})