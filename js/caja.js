document.addEventListener("DOMContentLoaded", function () {
  let allTransactions = []
  let currentPage = 1
  const itemsPerPage = 5
  let clientesCache = []; // Caché de clientes para búsqueda rápida

  const PARKING = {
    nombre: "Parqueadero ELIMAR",
    nit: "901234567-8",
    direccion: "Sahagun - Córdoba",
    telefono: "3016838490"
  }

  function formatMoney(amount) {
    return "$" + parseFloat(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
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

  async function loadTransactions() {
    try {
      const res = await fetch("/api/caja");
      allTransactions = await res.json();
      currentPage = 1;
      renderTable();
    } catch (error) {
      console.error("Error cargando caja", error);
      mostrarToast("Error al cargar historial", "error");
    }
  }

  // Cargar clientes para el autocompletado
  async function loadClientsForSearch() {
      try {
          const res = await fetch("/api/clientes");
          clientesCache = await res.json();
      } catch(e) { console.error(e); }
  }

  function generarFactura(data) {
    return `
🅿️ *${PARKING.nombre}*
NIT: ${PARKING.nit}

📍 ${PARKING.direccion}
☎️ ${PARKING.telefono}

----------------------------
🧾 *RECIBO DE PAGO*

👤 Cliente: ${data.client}
🚗 Placa: ${data.plate}
🅿️ Puesto: ${data.spot}

💳 Método: ${data.method}
💰 Valor: ${formatMoney(data.amount)}

🕓 Hora: ${data.time}
📅 Fecha: ${data.date}

----------------------------
🙏 Gracias por preferirnos
`;
  }

  // Lógica de búsqueda de clientes en el input de nombre
  const inputCliente = document.getElementById("cajaCliente");
  const listaSugerencias = document.createElement("div");
  listaSugerencias.className = "absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto z-20 hidden custom-scroll";
  inputCliente.parentNode.style.position = "relative";
  inputCliente.parentNode.appendChild(listaSugerencias);

  inputCliente.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase();
      listaSugerencias.innerHTML = "";
      if(val.length < 2) { listaSugerencias.classList.add("hidden"); return; }

      const filtered = clientesCache.filter(c => c.nombre.toLowerCase().includes(val));
      if(filtered.length > 0) {
          filtered.forEach(c => {
              const div = document.createElement("div");
              div.className = "p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 flex justify-between transition-colors";
              div.innerHTML = `<span class="font-medium text-sm text-slate-700">${c.nombre}</span> <span class="text-xs text-slate-500 font-mono">${c.placa}</span>`;
              div.onclick = () => {
                  document.getElementById("cajaCliente").value = c.nombre;
                  document.getElementById("cajaPlaca").value = c.placa;
                  // Opcional: si supiéramos el puesto actual del cliente, podríamos llenarlo
                  // document.getElementById("cajaPuesto").value = c.puesto_actual; 
                  listaSugerencias.classList.add("hidden");
              };
              listaSugerencias.appendChild(div);
          });
          listaSugerencias.classList.remove("hidden");
      } else {
          listaSugerencias.classList.add("hidden");
      }
  });

  function renderTable() {
    const tbody = document.getElementById("listaCajaBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const sorted = [...allTransactions].sort((a, b) => b.id - a.id);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = sorted.slice(start, end);

    let totalIncome = 0, cashIncome = 0, cardIncome = 0;
    allTransactions.forEach(tx => {
      const amount = parseFloat(tx.amount);
      totalIncome += amount;
      if (tx.method === "Efectivo") cashIncome += amount;
      else cardIncome += amount;
    });

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val };
    set("kpiTotal", formatMoney(totalIncome));
    set("kpiCash", formatMoney(cashIncome));
    set("kpiCard", formatMoney(cardIncome));
    set("kpiCount", allTransactions.length);

    if (pageData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No hay registros hoy.</td></tr>`;
    } else {
      pageData.forEach(tx => {
        let methodBadge = "";
        if (tx.method === "Efectivo") methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">EFECTIVO</span>`;
        else if (tx.method === "Tarjeta") methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">TARJETA</span>`;
        else methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">TRANSF.</span>`;

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group";
        tr.innerHTML = `
          <td class="px-6 py-4 text-xs text-slate-500 font-mono" data-label="Hora">${tx.time}</td>
          <td class="px-6 py-4 font-medium text-slate-700" data-label="Cliente">${tx.client}</td>
          <td class="px-6 py-4 text-sm text-slate-600" data-label="Vehículo">
            <div class="flex flex-col">
              <span class="font-mono font-bold">${tx.plate}</span>
              <span class="text-xs text-slate-400">Puesto: ${tx.spot}</span>
            </div>
          </td>
          <td class="px-6 py-4" data-label="Método">${methodBadge}</td>
          <td class="px-6 py-4 text-right font-bold text-slate-800" data-label="Valor">${formatMoney(tx.amount)}</td>
          <td class="px-6 py-4 text-right" data-label="Acciones">
            <button onclick="deleteTransaction(${tx.id})" class="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all text-xs" title="Anular">Anular</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
    updatePaginationControls(allTransactions.length);
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
    if (btnPrev.disabled) btnPrev.classList.add("opacity-50", "cursor-not-allowed");
    else btnPrev.classList.remove("opacity-50", "cursor-not-allowed");
    if (btnNext.disabled) btnNext.classList.add("opacity-50", "cursor-not-allowed");
    else btnNext.classList.remove("opacity-50", "cursor-not-allowed");
  }

  window.changePage = function(direction) {
    const totalPages = Math.ceil(allTransactions.length / itemsPerPage);
    if (direction === 'prev' && currentPage > 1) currentPage--;
    else if (direction === 'next' && currentPage < totalPages) currentPage++;
    renderTable();
  }

  window.registrarCobro = async function(e) {
    if (e) e.preventDefault();
    const client = document.getElementById("cajaCliente").value;
    const plate = document.getElementById("cajaPlaca").value.toUpperCase();
    const spot = document.getElementById("cajaPuesto").value;
    const amount = document.getElementById("cajaMonto").value;
    const method = document.getElementById("cajaMetodo").value;
    const celular = document.getElementById("cajaCelular").value;
    const sendWhatsapp = document.getElementById("cajaSendWhatsapp").checked;

    if (!amount || amount <= 0) { mostrarToast("Ingrese un monto válido", "error"); return; }

    try {
      const now = new Date();
      const time = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      const date = now.toLocaleDateString("es-CO");

      const res = await fetch("/api/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: client || "Cliente General",
          plate: plate || "---",
          spot: spot || "---",
          phone: celular || "",
          amount,
          method
        })
      });

      const data = await res.json();

      if (data.success) {
        const factura = generarFactura({ client, plate, spot, method, amount, time, date });

        if (sendWhatsapp && celular) {
          const url = `https://wa.me/57${celular}?text=${encodeURIComponent(factura)}`;
          window.open(url, "_blank");
        }

        document.getElementById("formCaja").reset();
        currentPage = 1;
        loadTransactions();
        mostrarToast("Cobro registrado exitosamente");
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
      if(data.success) { loadTransactions(); mostrarToast("Transacción anulada"); }
    } catch (e) { mostrarToast("Error al anular", "error"); }
  }

  const fechaElement = document.getElementById("fecha-actual");
  if (fechaElement) {
    fechaElement.textContent = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  // Inicializar
  loadTransactions();
  loadClientsForSearch();
})