// parqueo/js/caja.js

document.addEventListener("DOMContentLoaded", function () {
  let allTransactions = [];
  let filteredTransactions = [];
  let deudoresList = [];
  let clientesCache = [];
  let puestosCache = [];
  let currentPage = 1;
  let deudoresPage = 1;
  const itemsPerPage = 5;

  const PARKING = {
    nombre: "Parqueadero ELIMAR",
    nit: "901234567-8",
    direccion: "Sahagun - Córdoba",
    telefono: "3016838490"
  };

  // --- UTILIDADES ---
  function formatMoney(amount) {
    return "$ " + parseFloat(amount || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Convierte "$ 1.000" a 1000
  function parseMoney(value) {
    if(!value) return 0;
    return parseFloat(value.toString().replace(/\./g, '').replace(/,/g, '').replace(/\$/g, '').trim()) || 0;
  }

  function mostrarToast(mensaje, tipo = 'success') {
    const toastExistente = document.getElementById('custom-toast');
    if (toastExistente) toastExistente.remove();
    const toast = document.createElement('div');
    toast.id = 'custom-toast';
    const colores = tipo === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
    const icono = tipo === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
    toast.className = `fixed top-5 right-5 z-[60] flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border ${colores} transform transition-all duration-300 translate-x-full opacity-0 max-w-sm`;
    toast.innerHTML = `<span class="text-lg shrink-0">${icono}</span><span class="font-medium text-sm">${mensaje}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // --- CARGA DE DATOS ---
  async function loadData() {
    try {
      const resCaja = await fetch("/api/caja");
      allTransactions = await resCaja.json();
      filteredTransactions = [...allTransactions];

      const resClientes = await fetch("/api/clientes");
      clientesCache = await resClientes.json();

      const resPuestos = await fetch("/api/puestos");
      puestosCache = await resPuestos.json();

      await loadDeudores(1);
      currentPage = 1;
      renderTable();
      initAutocomplete();
    } catch (error) {
      console.error("Error cargando datos", error);
      mostrarToast("Error al cargar datos", "error");
    }
  }

  // --- CÁLCULO DE COBRO SUGERIDO ---
  function calcularSugerencia(cliente) {
    const inputMonto = document.getElementById("cajaMonto");
    const infoDiv = document.getElementById("cajaInfo");
    
    if (!cliente) {
        infoDiv.innerHTML = "";
        return;
    }

    // Buscar último pago de este cliente
    const pagos = allTransactions.filter(t => t.plate === cliente.placa).sort((a, b) => new Date(b.date) - new Date(a.date));
    const ultimoPago = pagos.length > 0 ? pagos[0] : null;
    
    let textoHTML = "";
    let montoSugerido = 0;

    if (ultimoPago) {
        const fechaUltimo = new Date(ultimoPago.date);
        const hoy = new Date();
        const diffTime = Math.abs(hoy - fechaUltimo);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        textoHTML += `<div class="text-xs text-slate-500 mb-1">Último pago: ${ultimoPago.date} (Hace ${diffDays} días)</div>`;
        
        // Lógica simple: si pasó más de 30 días, sugerir mensual. Si es diario, días * tarifa.
        // Asumimos cuota_mensual como base.
        const cuota = cliente.cuota_mensual || 0;
        
        if (cliente.medio_pago === 'Diario') {
            montoSugerido = diffDays * (cuota / 30); // Estimado diario
            textoHTML += `<div class="text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100">Sugerencia: ${diffDays} días x $${Math.round(cuota/30)} ≈ ${formatMoney(montoSugerido)}</div>`;
        } else if (cliente.medio_pago === 'Mensual' && diffDays > 28) {
            montoSugerido = cuota;
            textoHTML += `<div class="text-xs font-bold text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">Vencido (Mes cumplido). Sugerencia: ${formatMoney(montoSugerido)}</div>`;
        } else {
            textoHTML += `<div class="text-xs text-slate-400">Al día. Sugerencia: ${formatMoney(cuota)}</div>`;
            montoSugerido = cuota;
        }
    } else {
        textoHTML += `<div class="text-xs text-rose-500 font-bold bg-rose-50 p-2 rounded border border-rose-100">¡Primer pago! Sugerencia: ${formatMoney(cliente.cuota_mensual || 0)}</div>`;
        montoSugerido = cliente.cuota_mensual || 0;
    }

    infoDiv.innerHTML = textoHTML;
    inputMonto.value = montoSugerido > 0 ? Math.round(montoSugerido) : "";
    // Disparar evento input para formatear
    inputMonto.dispatchEvent(new Event('input'));
  }

  // --- AUTOCOMPLETADO ---
  function initAutocomplete() {
    const inputCliente = document.getElementById("cajaCliente");
    const containerCalendario = document.getElementById("calendarSection");
    
    if (!inputCliente) return; 
    const listaSugerencias = document.createElement("div");
    listaSugerencias.className = "absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto z-20 hidden custom-scroll";
    inputCliente.parentNode.style.position = "relative";
    inputCliente.parentNode.appendChild(listaSugerencias);

    // LISTENER PARA FORMATEO DE MONEDA
    const inputMonto = document.getElementById("cajaMonto");
    inputMonto.addEventListener('input', function(e) {
        let value = e.target.value;
        // Permitir solo números
        let cleanValue = value.replace(/\D/g, '');
        if (cleanValue === '') {
            e.target.value = '';
            return;
        }
        // Formatear con puntos
        let formatted = parseInt(cleanValue, 10).toLocaleString('es-CO');
        e.target.value = formatted;
    });

    inputCliente.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase();
      listaSugerencias.innerHTML = "";
      if(val.length === 0) containerCalendario.classList.add('hidden');
      if (val.length < 2) { listaSugerencias.classList.add("hidden"); return; }

      const filtered = clientesCache.filter(c => c.nombre && c.nombre.toLowerCase().includes(val));
      if (filtered.length > 0) {
        filtered.forEach(c => {
          const div = document.createElement("div");
          div.className = "p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 flex justify-between transition-colors";
          div.innerHTML = `<span class="font-medium text-sm text-slate-700">${c.nombre}</span> <span class="text-xs text-slate-500 font-mono">${c.placa}</span>`;
          div.onclick = () => {
            document.getElementById("cajaCliente").value = c.nombre;
            document.getElementById("cajaPlaca").value = c.placa;
            document.getElementById("cajaCelular").value = c.telefono || "";
            
            const puestoOcupado = puestosCache.find(p => p.cliente_id === c.id && p.estado === 'ocupado');
            if (puestoOcupado) {
                document.getElementById("cajaPuesto").value = puestoOcupado.numero;
            } else {
                document.getElementById("cajaPuesto").value = "";
            }

            calcularSugerencia(c); // Calcular deuda automáticamente

            if (c.medio_pago === 'Diario') {
                containerCalendario.classList.remove('hidden');
                renderCalendario(c.id, c.placa);
            } else {
                containerCalendario.classList.add('hidden');
            }

            listaSugerencias.classList.add("hidden");
          };
          listaSugerencias.appendChild(div);
        });
        listaSugerencias.classList.remove("hidden");
      } else {
        listaSugerencias.classList.add("hidden");
      }
    });

    document.addEventListener("click", (e) => {
      if (!inputCliente.contains(e.target) && !listaSugerencias.contains(e.target)) {
        listaSugerencias.classList.add("hidden");
      }
    });
  }

  // --- CALENDARIO (ACTUALIZADO) ---
  function renderCalendario(clienteId, placa) {
      const container = document.getElementById("calendarContainer");
      if(!container) return;
      container.innerHTML = "";
      container.style.display = "grid";

      const hoy = new Date();
      const year = hoy.getFullYear();
      const month = hoy.getMonth(); 
      const diasEnMes = new Date(year, month + 1, 0).getDate();

      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      container.innerHTML = `<div class="col-span-7 text-center font-bold text-slate-700 mb-2">${monthNames[month]} ${year}</div>`;

      const diasSemana = ["L", "M", "M", "J", "V", "S", "D"];
      diasSemana.forEach(d => container.innerHTML += `<div class="text-center text-xs font-bold text-slate-400 uppercase">${d}</div>`);

      let primerDia = new Date(year, month, 1).getDay(); 
      if (primerDia === 0) primerDia = 7; 
      primerDia -= 1; 

      for(let i=0; i<primerDia; i++) container.innerHTML += `<div></div>`;

      for(let d=1; d<=diasEnMes; d++) {
          const fechaStr = `${year}-${String(month+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          
          const pagado = allTransactions.find(t => t.plate === placa && t.date === fechaStr);
          
          let clases = "h-8 w-8 flex items-center justify-center rounded-full text-xs font-bold cursor-pointer transition-colors hover:opacity-80 ";
          if (pagado) clases += "bg-green-500 text-white shadow-md shadow-green-200";
          else clases += "bg-slate-100 text-slate-400 hover:bg-slate-200";

          if (d === hoy.getDate()) clases += " ring-2 ring-indigo-500 ring-offset-1";

          container.innerHTML += `<div class="${clases}" onclick="toggleDiaCalendario('${fechaStr}', ${clienteId}, '${placa}')">${d}</div>`;
      }
  }

  window.toggleDiaCalendario = async function(diaStr, clienteId, placa) {
      const existe = allTransactions.find(t => t.plate === placa && t.date === diaStr);
      const cliente = clientesCache.find(c => c.id === clienteId);
      
      try {
          if (existe) {
              if(!confirm("¿Anular el pago de este día?")) return;
              await fetch("/api/caja?id=" + existe.id, { method: "DELETE" });
              mostrarToast("Pago anulado", "success");
          } else {
              if(!cliente) return;
              await fetch("/api/caja", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                      client: cliente.nombre,
                      plate: cliente.placa,
                      spot: "---", 
                      phone: cliente.telefono,
                      amount: cliente.cuota_mensual || 0, // Usa cuota mensual
                      method: "Efectivo",
                      period_type: "Dias",
                      period_quantity: 1,
                      date: diaStr
                  })
              });
              mostrarToast("Día marcado como pagado", "success");
          }
          loadData(); 
      } catch(e) {
          console.error(e);
          mostrarToast("Error actualizando día", "error");
      }
  }

  // --- DEUDORES ---
  async function loadDeudores(page) {
      try {
          const res = await fetch(`/api/caja?deudores=true&page=${page}`);
          const data = await res.json();
          
          if (!data || !Array.isArray(data.rows)) {
              renderDeudores(0, 1, 1); return;
          }
          deudoresList = data.rows;
          renderDeudores(data.total, data.totalPages, data.page);
      } catch(e) { 
          console.error("Error cargando deudores:", e); 
          renderDeudores(0, 1, 1);
      }
  }

  function renderDeudores(total, totalPages, currentPage) {
      const container = document.getElementById("deudoresList");
      const paginationContainer = document.getElementById("deudoresPagination");
      if(!container || !paginationContainer) return;
      
      container.innerHTML = "";
      if (deudoresList.length === 0) {
          container.innerHTML = `<div class="text-center text-sm text-green-600 py-4 font-medium"><i class="fa-solid fa-check-circle"></i> ¡Al día! No hay deudores este mes.</div>`;
          paginationContainer.innerHTML = "";
          return;
      }

      deudoresList.forEach(cliente => {
          const div = document.createElement("div");
          div.className = "flex items-center justify-between p-3 mb-2 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors";
          div.innerHTML = `
              <div class="flex flex-col">
                  <span class="font-bold text-slate-800 text-sm">${cliente.nombre}</span>
                  <span class="text-xs text-red-600 font-mono">${cliente.placa}</span>
              </div>
              ${cliente.telefono ? `
                <button onclick="enviarRecordatorio('${cliente.nombre}', '${cliente.telefono}')" class="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors">
                    <i class="fa-brands fa-whatsapp"></i> Recordar
                </button>
              ` : '<span class="text-xs text-slate-400">Sin celular</span>'}
          `;
          container.appendChild(div);
      });

      paginationContainer.innerHTML = `
        <div class="flex justify-between items-center mt-2 text-xs text-slate-500">
            <span>Total: ${total} Deudores</span>
            <div class="flex gap-2">
                <button onclick="changeDeudoresPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="px-2 py-1 border rounded hover:bg-slate-100 disabled:opacity-50"><i class="fa-solid fa-chevron-left"></i></button>
                <span>Pág ${currentPage} de ${totalPages || 1}</span>
                <button onclick="changeDeudoresPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} class="px-2 py-1 border rounded hover:bg-slate-100 disabled:opacity-50"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
        </div>
      `;
  }

  window.changeDeudoresPage = function(page) {
      if(page < 1) return;
      deudoresPage = page;
      loadDeudores(page);
  }

  function getSaludo() {
      const hora = new Date().getHours();
      if (hora >= 5 && hora < 12) return "Buenos días";
      if (hora >= 12 && hora < 18) return "Buenas tardes";
      return "Buenas noches";
  }

  window.enviarRecordatorio = function(nombre, telefono) {
      const saludo = getSaludo();
      const mensaje = `¡${saludo}! 👋 ${nombre}.\n\nEsperamos que estés teniendo un excelente día. 🌟\n\nTe saluda el equipo de *${PARKING.nombre}* 🚗. Queremos recordarte amablemente que, hasta el momento, no tenemos registrado el pago de la mensualidad de este mes. 📅\n\nQuedamos atentos a tu amable colaboración para mantener tu servicio al día. ¡Muchas gracias! 💰✨`;
      const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
  }

  // --- FILTRADO ---
  window.filtrarTabla = function() {
    const term = document.getElementById("searchInput").value.toLowerCase();
    if (!term) {
      filteredTransactions = [...allTransactions];
    } else {
      filteredTransactions = allTransactions.filter(t => 
        t.client && t.client.toLowerCase().includes(term) || 
        t.plate && t.plate.toLowerCase().includes(term)
      );
    }
    currentPage = 1;
    renderTable();
  };

  // --- RENDERIZADO TABLA ---
  function renderTable() {
    const tbody = document.getElementById("listaCajaBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredTransactions.slice(start, end);

    let totalIncome = 0, cashIncome = 0, cardIncome = 0;
    allTransactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      if(!isNaN(amount)) {
        totalIncome += amount;
        if (tx.method === "Efectivo") cashIncome += amount;
        else cardIncome += amount;
      }
    });

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val };
    set("kpiTotal", formatMoney(totalIncome));
    set("kpiCash", formatMoney(cashIncome));
    set("kpiCard", formatMoney(cardIncome));
    set("kpiCount", allTransactions.length);

    if (pageData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No se encontraron registros.</td></tr>`;
    } else {
      pageData.forEach(tx => {
        let fechaDisplay = "N/A";
        try {
            fechaDisplay = new Date(tx.date + 'T00:00:00').toLocaleDateString('es-CO');
        } catch(e) { console.warn(e); }
        
        let periodoTexto = "1 Noche";
        if(tx.period_type === 'Mes') periodoTexto = "1 Mes";
        else if(tx.period_type === 'Semana') periodoTexto = "1 Semana";
        else if(tx.period_type === 'Dias') periodoTexto = `${tx.period_quantity || 1} Días`;
        else if(tx.period_type === 'Noche') periodoTexto = `${tx.period_quantity || 1} Noche(s)`;

        let methodBadge = "";
        if (tx.method === "Efectivo") methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">EFECTIVO</span>`;
        else if (tx.method === "Tarjeta") methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">TARJETA</span>`;
        else methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">TRANSF.</span>`;

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group";
        
        tr.innerHTML = `
          <td class="px-6 py-4 text-xs text-slate-500 font-mono" data-label="Fecha">${fechaDisplay}</td>
          <td class="px-6 py-4 font-medium text-slate-700" data-label="Cliente">${tx.client}</td>
          <td class="px-6 py-4 text-sm text-slate-600" data-label="Vehículo">
            <div class="flex flex-col">
              <span class="font-mono font-bold">${tx.plate}</span>
              <span class="text-xs text-slate-400">Puesto: ${tx.spot} | ${periodoTexto}</span>
            </div>
          </td>
          <td class="px-6 py-4" data-label="Método">${methodBadge}</td>
          <td class="px-6 py-4 text-right font-bold text-slate-800" data-label="Valor">${formatMoney(tx.amount)}</td>
          <td class="px-6 py-4 text-center" data-label="Acciones">
             <div class="flex items-center justify-center gap-2">
                <button onclick="openEditModal(${tx.id})" class="text-indigo-500 hover:bg-indigo-50 p-2 rounded-lg transition-all text-xs" title="Editar Fecha/Datos"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteTransaction(${tx.id})" class="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all text-xs" title="Anular"><i class="fa-solid fa-trash"></i></button>
             </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    updatePaginationControls(filteredTransactions.length);
  }

  function updatePaginationControls(totalItems) {
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const pageInfo = document.getElementById("pageInfo");
    if(!btnPrev || !btnNext) return;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    pageInfo.innerText = `Página ${currentPage} de ${totalPages || 1}`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages || totalPages === 0;
    
    [btnPrev, btnNext].forEach(btn => {
        if(btn.disabled) btn.classList.add("opacity-50", "cursor-not-allowed");
        else btn.classList.remove("opacity-50", "cursor-not-allowed");
    });
  }

  window.changePage = function(direction) {
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    if (direction === 'prev' && currentPage > 1) currentPage--;
    else if (direction === 'next' && currentPage < totalPages) currentPage++;
    renderTable();
  }

  // --- REGISTRAR COBRO ---
  window.registrarCobro = async function(e) {
    if (e) e.preventDefault();
    const client = document.getElementById("cajaCliente").value;
    const plate = document.getElementById("cajaPlaca").value.toUpperCase();
    const spot = document.getElementById("cajaPuesto").value;
    // Parseamos el monto formateado
    const amount = parseMoney(document.getElementById("cajaMonto").value);
    const method = document.getElementById("cajaMetodo").value;
    const celular = document.getElementById("cajaCelular").value;
    const periodType = document.getElementById("cajaPeriodType").value;
    const periodQty = document.getElementById("cajaPeriodQty").value;
    const date = document.getElementById("cajaDate").value; 

    if (!amount || amount <= 0) { mostrarToast("Ingrese un monto válido", "error"); return; }

    try {
      const res = await fetch("/api/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: client || "Cliente General",
          plate: plate || "---",
          spot: spot || "---",
          phone: celular || "",
          amount,
          method,
          period_type: periodType,
          period_quantity: periodQty,
          date
        })
      });

      const data = await res.json();

      if (data.success) {
        document.getElementById("formCaja").reset();
        document.getElementById("cajaPeriodQty").value = 1;
        document.getElementById("cajaDate").valueAsDate = new Date();
        document.getElementById("calendarSection").classList.add('hidden');
        document.getElementById("cajaInfo").innerHTML = "";
        currentPage = 1;
        loadData(); 
        mostrarToast("Cobro registrado correctamente");
      } else {
        mostrarToast("Error al registrar", "error");
      }
    } catch (error) {
      console.error(error);
      mostrarToast("Error de conexión", "error");
    }
  }

  window.deleteTransaction = async function(id) {
    if (!confirm("¿Anular esta transacción?")) return;
    try {
      const res = await fetch("/api/caja?id=" + id, { method: "DELETE" });
      const data = await res.json();
      if(data.success) { 
          loadData(); 
          mostrarToast("Transacción anulada"); 
      } else {
          mostrarToast(data.error || "Error", "error");
      }
    } catch (e) { mostrarToast("Error al anular", "error"); }
  }

  // --- EDITAR TRANSACCIÓN ---
  window.openEditModal = async function(id) {
      const tx = allTransactions.find(t => t.id === id);
      if(!tx) return;

      document.getElementById("editId").value = tx.id;
      document.getElementById("editClient").value = tx.client;
      document.getElementById("editPlate").value = tx.plate;
      document.getElementById("editAmount").value = tx.amount; // El input de edición es tipo number, no necesita formato visual al cargar
      document.getElementById("editMethod").value = tx.method;
      document.getElementById("editPeriodType").value = tx.period_type;
      document.getElementById("editPeriodQty").value = tx.period_quantity;
      document.getElementById("editDate").value = tx.date;

      const modal = document.getElementById("modalEdit");
      const content = document.getElementById("modalEditContent");
      modal.classList.remove("hidden");
      setTimeout(() => {
          modal.classList.remove("opacity-0");
          content.classList.remove("scale-95", "opacity-0");
      }, 10);
  }

  window.closeEditModal = function() {
      const modal = document.getElementById("modalEdit");
      const content = document.getElementById("modalEditContent");
      modal.classList.add("opacity-0");
      content.classList.add("scale-95", "opacity-0");
      setTimeout(() => { modal.classList.add("hidden"); }, 200);
  }

  window.saveEditTransaction = async function() {
      const id = document.getElementById("editId").value;
      const client = document.getElementById("editClient").value;
      const plate = document.getElementById("editPlate").value.toUpperCase();
      const amount = document.getElementById("editAmount").value;
      const method = document.getElementById("editMethod").value;
      const periodType = document.getElementById("editPeriodType").value;
      const periodQty = document.getElementById("editPeriodQty").value;
      const date = document.getElementById("editDate").value;

      if(!amount || amount <= 0) { mostrarToast("Monto inválido", "error"); return; }

      try {
          const res = await fetch("/api/caja", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, client, plate, spot: "---", phone: "", amount, method, period_type: periodType, period_quantity: periodQty, date })
          });
          const data = await res.json();
          if(data.success) {
              closeEditModal();
              loadData();
              mostrarToast("Transacción actualizada");
          } else {
              mostrarToast(data.error || "Error", "error");
          }
      } catch(e) {
          mostrarToast("Error de conexión", "error");
      }
  }

  // Inicializar
  loadData();
});