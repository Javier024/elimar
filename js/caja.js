document.addEventListener("DOMContentLoaded", function () {
  let allTransactions = [];
  let filteredTransactions = [];
  let clientesCache = [];
  let puestosCache = [];
  let currentPage = 1;
  const itemsPerPage = 5;

  const PARKING = {
    nombre: "Parqueadero ELIMAR",
    nit: "901234567-8",
    direccion: "Sahagun - Córdoba",
    telefono: "3016838490"
  };

  // --- UTILIDADES ---
  function formatMoney(amount) {
    return "$" + parseFloat(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

      currentPage = 1;
      renderTable();
      initAutocomplete();
    } catch (error) {
      console.error("Error cargando datos", error);
      mostrarToast("Error al cargar datos", "error");
    }
  }

  // --- AUTOCOMPLETADO ---
  function initAutocomplete() {
    const inputCliente = document.getElementById("cajaCliente");
    const listaSugerencias = document.createElement("div");
    listaSugerencias.className = "absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-40 overflow-y-auto z-20 hidden custom-scroll";
    inputCliente.parentNode.style.position = "relative";
    inputCliente.parentNode.appendChild(listaSugerencias);

    inputCliente.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase();
      listaSugerencias.innerHTML = "";
      if (val.length < 2) {
        listaSugerencias.classList.add("hidden");
        return;
      }

      const filtered = clientesCache.filter(c => c.nombre.toLowerCase().includes(val));
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

  // --- GENERACIÓN DE PDF BLOB ---
  function crearPdfBlob(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(PARKING.nombre, 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`NIT: ${PARKING.nit} | Dir: ${PARKING.direccion}`, 105, 28, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);

    doc.setFontSize(12);
    doc.text("RECIBO DE PAGO", 20, 45);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${data.date}`, 20, 55);
    doc.text(`Hora:  ${data.time}`, 20, 62);
    doc.text(`Cliente: ${data.client}`, 20, 69);
    doc.text(`Placa:  ${data.plate}`, 20, 76);
    doc.text(`Puesto: ${data.spot}`, 20, 83);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: ${formatMoney(data.amount)}`, 190, 100, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`Método: ${data.method}`, 20, 100);

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Gracias por su visita.", 105, 130, { align: "center" });

    return doc.output('blob');
  }

  // --- ENVIAR PDF WHATSAPP (RECIBE BLOB OPCIONAL) ---
  async function enviarPdfWhatsApp(data, pdfBlob = null) {
    try {
      // Si no nos pasan el blob, lo generamos (para compatibilidad con descargas históricas)
      const blob = pdfBlob || crearPdfBlob(data);
      
      const file = new File([blob], `Factura_${data.plate}_${data.date}.pdf`, { type: "application/pdf" });

      // Verificar soporte nativo (Móvil)
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Recibo ${PARKING.nombre}`,
          text: `Hola ${data.client}, adjunto tu recibo de pago del parqueadero.`
        });
        mostrarToast("PDF enviado correctamente");
        return true; // Éxito
      } else {
        // FALLBACK PC (Descargar + Link)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Factura_${data.plate}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        const mensaje = `🅿️ *${PARKING.nombre}*\n\nHola ${data.client}, su recibo de pago por ${formatMoney(data.amount)} ha sido generado. \n\n📄 *Por favor revise el archivo PDF descargado en su dispositivo/PC.*`;
        const waUrl = `https://wa.me/57${data.phone}?text=${encodeURIComponent(mensaje)}`;
        window.open(waUrl, "_blank");
        
        mostrarToast("PDF descargado. Abriendo WhatsApp...");
        return true;
      }
    } catch (error) {
      console.error("Error al compartir:", error);
      // Si el usuario canceló el cuadro de diálogo nativo, no es un error crítico
      if (error.name !== 'AbortError') {
          mostrarToast("Error al enviar PDF", "error");
      }
      return false; // Falló o canceló
    }
  }

  // --- FILTRADO ---
  window.filtrarTabla = function() {
    const term = document.getElementById("searchInput").value.toLowerCase();
    if (!term) {
      filteredTransactions = [...allTransactions];
    } else {
      filteredTransactions = allTransactions.filter(t => 
        t.client.toLowerCase().includes(term) || 
        t.plate.toLowerCase().includes(term)
      );
    }
    currentPage = 1;
    renderTable();
  };

  // --- RENDERIZADO ---
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
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">No se encontraron registros.</td></tr>`;
    } else {
      pageData.forEach(tx => {
        let methodBadge = "";
        if (tx.method === "Efectivo") methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">EFECTIVO</span>`;
        else if (tx.method === "Tarjeta") methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">TARJETA</span>`;
        else methodBadge = `<span class="px-2 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">TRANSF.</span>`;

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group";
        
        const downloadPdfBtn = `
            <button onclick="descargarPdfDeHistorial(${tx.id})" class="text-indigo-500 hover:bg-indigo-50 p-2 rounded-lg transition-all text-xs" title="Descargar PDF">
                <i class="fa-solid fa-file-pdf"></i>
            </button>
        `;

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
          <td class="px-6 py-4 text-center" data-label="Acciones">
            <div class="flex items-center justify-center gap-2">
                ${downloadPdfBtn}
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

  // --- REGISTRAR COBRO (CORREGIDO: SHARE PRIMERO) ---
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
    if (sendWhatsapp && !celular) { mostrarToast("Ingrese el celular para enviar", "error"); return; }

    try {
      const now = new Date();
      const time = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      const date = now.toLocaleDateString("es-CO");
      
      const payload = { client, plate, spot, method, amount, time, date, phone: celular };

      // 1. GENERAR PDF INMEDIATAMENTE (Para tener el archivo listo)
      const pdfBlob = crearPdfBlob(payload);

      // 2. EJECUTAR COMPARTIR/DESCARGAR INMEDIATAMENTE (Gesto de usuario activo)
      if (sendWhatsapp) {
          await enviarPdfWhatsApp(payload, pdfBlob);
      } else {
          // Descarga directa
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Factura_${plate}.pdf`;
          a.click();
      }

      // 3. GUARDAR EN BASE DE DATOS (En segundo plano, después de la interacción del usuario)
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
        document.getElementById("formCaja").reset();
        currentPage = 1;
        loadData(); 
        mostrarToast("Cobro registrado correctamente");
      } else {
        // Nota: El usuario ya tiene el PDF, pero falló el guardado en BD.
        mostrarToast("Cobro registrado localmente, pero error en servidor", "error");
      }

    } catch (error) {
      console.error(error);
      mostrarToast("Error de conexión", "error");
    }
  }

  window.descargarPdfDeHistorial = function(id) {
      const tx = allTransactions.find(t => t.id === id);
      if(tx) {
          const blob = crearPdfBlob({
              client: tx.client,
              plate: tx.plate,
              spot: tx.spot,
              method: tx.method,
              amount: tx.amount,
              time: tx.time,
              date: tx.date
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Factura_${tx.plate}.pdf`;
          a.click();
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

  // Inicializar
  loadData();
});