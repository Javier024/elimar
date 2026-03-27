let allSpots = [];
let clientesCache = [];
let currentFilterStatus = 'todos';
let puestoSeleccionado = null;

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

function calcularTiempo(horaInicioUnix) {
    if (!horaInicioUnix) return "";
    const inicio = new Date(Number(horaInicioUnix) * 1000);
    const ahora = new Date();
    const diff = ahora - inicio;
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (horas > 24) return `${Math.floor(horas/24)}d ${horas%24}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}

document.addEventListener("DOMContentLoaded", () => {
  cargarPuestos();
  cargarClientesCache();
  const searchInput = document.getElementById("searchInput");
  if(searchInput) searchInput.addEventListener("input", (e) => renderMapa(e.target.value.toLowerCase()));
});

async function cargarClientesCache() {
  try {
    const res = await fetch("/api/clientes");
    if(res.ok) {
        let todos = await res.json();
        clientesCache = todos.filter(c => !allSpots.some(s => s.cliente_id === c.id && s.estado !== 'libre'));
    }
  } catch (e) { console.error("Error cargando clientes", e); }
}

window.filtrarMapa = function(filtro) {
  currentFilterStatus = filtro;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if(btn.dataset.filter === filtro) { btn.classList.add('bg-slate-800', 'text-white', 'border-transparent'); btn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200'); }
    else { btn.classList.remove('bg-slate-800', 'text-white', 'border-transparent'); btn.classList.add('bg-white', 'text-slate-600', 'border-slate-200'); }
  });
  renderMapa(document.getElementById("searchInput").value.toLowerCase());
}

async function cargarPuestos() {
  try {
    const res = await fetch("/api/puestos");
    if (!res.ok) throw new Error("Error API");
    allSpots = await res.json();
    allSpots.sort((a, b) => { const numA = parseInt(a.numero.replace(/\D/g, '')) || 0; const numB = parseInt(b.numero.replace(/\D/g, '')) || 0; return numA - numB; });
    cargarClientesCache();
    
    const kpi = { libres: allSpots.filter(s => s.estado === 'libre').length, ocupados: allSpots.filter(s => s.estado === 'ocupado').length, total: allSpots.length };
    if(document.getElementById('kpi-libres')) document.getElementById('kpi-libres').innerText = kpi.libres;
    if(document.getElementById('kpi-ocupados')) document.getElementById('kpi-ocupados').innerText = kpi.ocupados;
    if(document.getElementById('totalCount')) document.getElementById('totalCount').innerText = kpi.total;
    
    renderMapa();
  } catch (error) { console.error(error); mostrarToast("Error cargando mapa", "error"); }
}

function renderMapa(busquedaTerm = "") {
  const container = document.getElementById("map-container");
  if(!container) return;
  container.innerHTML = "";
  let datosFiltrados = allSpots;
  if (currentFilterStatus !== 'todos') datosFiltrados = allSpots.filter(s => s.estado === currentFilterStatus);
  if (busquedaTerm) { datosFiltrados = datosFiltrados.filter(s => s.numero.toLowerCase().includes(busquedaTerm) || (s.cliente_placa && s.cliente_placa.toLowerCase().includes(busquedaTerm))); }
  if (datosFiltrados.length === 0) { container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-slate-400 py-20"><i class="fa-solid fa-car-tunnel text-4xl mb-2"></i><p class="text-lg font-medium">No se encontraron puestos.</p></div>`; return; }

  datosFiltrados.forEach(spot => {
    let cardClass = "border-slate-200 bg-white";
    let statusBadge = '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">LIBRE</span>';
    let bodyContent = '';
    let footerActions = '';
    
    let meta = {};
    try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e){}

    const isTempUser = !spot.cliente_id && meta.temp_user;
    const tieneLlave = meta.llave && meta.llave.tiene;
    
    // --- ESTADO: LIBRE ---
    if (spot.estado === 'libre') {
        cardClass = "hover:border-emerald-400 hover:shadow-emerald-100/50 hover:-translate-y-1";
        bodyContent = `
            <div class="flex items-center justify-center h-full flex-col text-slate-400">
                <i class="fa-solid fa-check text-3xl mb-2 text-emerald-200"></i>
                <span class="text-xs font-medium">Disponible</span>
            </div>
        `;
        
        // Botón Eliminar en libres + Ingreso
        footerActions = `
            <div class="grid grid-cols-2 gap-2 w-full">
                <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors">
                    <i class="fa-solid fa-car-side mr-1"></i> Ingresar
                </button>
                <button onclick="eliminarPuesto(${spot.id})" class="py-2 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 rounded-lg text-xs font-bold transition-colors">
                    <i class="fa-solid fa-trash"></i> Eliminar
                </button>
            </div>
        `;
    } 
    // --- ESTADO: OCUPADO ---
    else if (spot.estado === 'ocupado') {
        cardClass = "bg-gradient-to-br from-indigo-50 to-white border-indigo-200 hover:border-indigo-400 hover:shadow-indigo-100/50 hover:-translate-y-1";
        statusBadge = '<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-200">OCUPADO</span>';

        const nombre = isTempUser ? meta.temp_user.nombre : (spot.cliente_nombre || "Desconocido");
        const placa = isTempUser ? meta.temp_user.placa : (spot.cliente_placa || "---");
        const tiempo = calcularTiempo(spot.hora_inicio);

        bodyContent = `
            <div class="flex flex-col gap-2 w-full">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="text-sm font-bold text-slate-800 truncate max-w-[120px]" title="${nombre}">${nombre}</div>
                        <div class="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 inline-block">${placa}</div>
                        ${isTempUser ? '<span class="ml-1 text-[9px] text-amber-500 font-bold border border-amber-200 px-1 rounded">TEMP</span>' : ''}
                    </div>
                    ${tieneLlave ? '<i class="fa-solid fa-key text-amber-500 text-sm" title="Llave en custodia"></i>' : ''}
                </div>
                <div class="flex items-center gap-2 text-[10px] text-slate-500">
                    <i class="fa-regular fa-clock"></i> <span>${tiempo}</span>
                </div>
            </div>
        `;

        // Botones: Cobrar, Salir, Llave, Nocturno, Editar
        footerActions = `
            <div class="grid grid-cols-2 gap-2 w-full">
                <button onclick="cobrar(${spot.id})" class="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors flex items-center justify-center gap-1">
                    <i class="fa-solid fa-money-bill-wave"></i> Cobrar
                </button>
                <button onclick="liberar(${spot.id})" class="py-2 bg-white hover:bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-bold transition-colors">
                    Salir
                </button>
            </div>
            <div class="grid grid-cols-3 gap-1 mt-2 w-full border-t border-slate-100 pt-2">
                 <button onclick="gestionarLlave(${spot.id}, ${tieneLlave}, '${(meta.llave ? meta.llave.desc : '').replace(/'/g, "\\'")}')" class="py-1 text-[9px] text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><i class="fa-solid fa-key"></i> Llave</button>
                 <button onclick="activarNocturno(${spot.id})" class="py-1 text-[9px] text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"><i class="fa-solid fa-moon"></i> Nocturno</button>
                 <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="py-1 text-[9px] text-slate-400 hover:text-slate-600 rounded transition-colors"><i class="fa-solid fa-pen"></i> Edit</button>
            </div>
        `;
    } 
    // --- ESTADO: RESERVADO ---
    else if (spot.estado === 'reservado') {
        cardClass = "bg-gradient-to-br from-purple-50 to-white border-purple-200 hover:border-purple-400 hover:shadow-purple-100/50 hover:-translate-y-1";
        statusBadge = '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-200">RESERVADO</span>';
        
        bodyContent = `
            <div class="flex flex-col gap-1 w-full">
                 <div class="text-sm font-bold text-slate-800 truncate">${spot.cliente_nombre || '---'}</div>
                 <div class="text-[10px] text-purple-600">Esperando llegada</div>
            </div>
        `;
        footerActions = `
            <div class="grid grid-cols-2 gap-2 w-full">
                <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}', '${spot.cliente_placa}')" class="py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold shadow-sm">
                    Ocupar
                </button>
                <button onclick="liberar(${spot.id})" class="py-2 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-[10px] font-bold">
                    Cancelar
                </button>
            </div>
        `;
    }

    const cardHTML = `
        <div class="parking-card relative rounded-xl shadow-sm border ${cardClass} transition-all duration-300 flex flex-col h-full min-h-[140px] overflow-hidden">
            <div class="p-3 flex justify-between items-start bg-white/50 backdrop-blur-sm z-10">
                <div><div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Puesto</div><div class="text-xl font-bold text-slate-800">${spot.numero}</div></div>
                ${statusBadge}
            </div>
            <div class="flex-1 p-3 flex flex-col justify-center items-center">${bodyContent}</div>
            <div class="p-3 bg-white border-t border-slate-100 z-10">${footerActions}</div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// --- ACCIONES COMPLETAS ---

window.gestionarLlave = function(id, tieneActual, descActual) {
    const accion = tieneActual ? confirm("Actualmente hay una llave guardada.\n¿Desea RECUPERAR la llave (Borrar registro)?") : confirm("¿El cliente DEJA la llave en el puesto?");
    if (!accion) return; 
    let nuevaInfoLlave = null;
    if (!tieneActual) { const desc = prompt("Características de la llave (Color, tipo, marca):", ""); if (desc === null) return; nuevaInfoLlave = { tiene: true, desc: desc.trim() || "Sin descripción" }; }
    actualizarInfoLlaveAPI(id, nuevaInfoLlave);
}

async function actualizarInfoLlaveAPI(id, llaveInfo) {
    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, accion: "actualizar_llave", llave_info: llaveInfo }) });
        const data = await res.json();
        if (data.success) { mostrarToast("Llave actualizada"); cargarPuestos(); } else { mostrarToast(data.error || "Error", "error"); }
    } catch(e) { mostrarToast("Error de conexión", "error"); }
}

window.activarNocturno = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if (!spot) return;
    if (spot.estado !== 'ocupado') { mostrarToast("Solo en puestos ocupados", "error"); return; }
    if(!confirm(`¿Activar modo Nocturno en #${spot.numero}?\nEl vehículo se retira y el puesto queda libre para ingreso temporal.`)) return;
    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, accion: "activar_nocturno" }) });
        const data = await res.json();
        if(data.success) { mostrarToast("Modo Nocturno activado"); cargarPuestos(); } else { mostrarToast(data.error, "error"); }
    } catch(e) { mostrarToast("Error", "error"); }
}

window.restaurarNocturno = async function(id) {
    if(!confirm("¿Restaurar al dueño original?")) return;
    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, accion: "restaurar_nocturno" }) });
        const data = await res.json();
        if(data.success) { mostrarToast("Restaurado"); cargarPuestos(); } else { mostrarToast(data.error, "error"); }
    } catch(e) { mostrarToast("Error", "error"); }
}

// --- ELIMINAR (CORREGIDO URL) ---
window.eliminarPuesto = async function(id) {
    if(!confirm("¿Eliminar este puesto PERMANENTEMENTE?\n\nSe borrará aunque tenga un vehículo dentro.")) return;
    try {
        // IMPORTANTE: Enviamos el ID en la URL, NO en el body
        const res = await fetch(`/api/puestos?id=${id}`, { method: "DELETE" });
        if (res.ok) { mostrarToast("Eliminado"); cargarPuestos(); }
        else { const d = await res.json(); mostrarToast(d.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
}

window.editarNumeroPuesto = async function(id, numeroActual) {
    const nuevoNumero = prompt("Nuevo número:", numeroActual);
    if (!nuevoNumero || nuevoNumero === numeroActual) return;
    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, accion: "editar_numero", nuevo_numero: nuevoNumero }) });
        if (res.ok) { mostrarToast("Número actualizado"); cargarPuestos(); }
    } catch (e) { mostrarToast("Error", "error"); }
}

// --- COBRAR (USA CUOTA FIJA) ---
window.cobrar = async function(id) {
  const spot = allSpots.find(s => s.id === id);
  if(!spot) return;

  let cuotaMensual = 0;
  let nombre = "Desconocido";
  let placa = "---";
  let telefono = "";
  let meta = {};
  try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e){}
  
  if (!spot.cliente_id && meta.temp_user) {
      // Temporal
      nombre = meta.temp_user.nombre;
      placa = meta.temp_user.placa;
      cuotaMensual = prompt("Ingrese valor para el usuario temporal:", "0");
  } else {
      // Registrado -> USAR CUOTA MENSUAL
      cuotaMensual = parseFloat(spot.cliente_cuota_mensual) || 0;
      nombre = spot.cliente_nombre;
      placa = spot.cliente_placa;
      telefono = spot.cliente_telefono || "";
  }

  if (cuotaMensual <= 0) { alert("No hay cuota definida. Ingrese valor manual."); cuotaMensual = prompt("Valor a cobrar:", "0"); }
  if (!confirm(`¿Registrar pago mensual para ${nombre}?\n\nPlaca: ${placa}\nMonto: $${Number(cuotaMensual).toLocaleString('es-CO')}\n\nEl cliente SE MANTIENE en el puesto.`)) return;

  const pagoPendiente = {
      client: nombre, plate: placa, spot: spot.numero, phone: telefono, amount: cuotaMensual, method: "Efectivo", period_type: "Mes", period_quantity: 1, is_mensualidad: true
  };
  localStorage.setItem('pending_payment', JSON.stringify(pagoPendiente));
  window.location.href = "caja.html";
}

// --- LIBERAR (SALIDA) ---
window.liberar = async function(id) {
  const spot = allSpots.find(s => s.id === id);
  if(!spot) return;
  if (!confirm(`¿SALIDA DEFINITIVA del puesto #${spot.numero}?`)) return;

  let montoACobrar = 0;
  let nombre = "Salida";
  let placa = "---";
  let telefono = "";
  let meta = {};
  try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e){}

  if (!spot.cliente_id && meta.temp_user) {
      nombre = meta.temp_user.nombre;
      placa = meta.temp_user.placa;
      montoACobrar = prompt("Valor a cobrar al usuario temporal:", "0");
  } else {
      nombre = spot.cliente_nombre;
      placa = spot.cliente_placa;
      telefono = spot.cliente_telefono || "";
      // LOGICA: Usar cuota mensual
      montoACobrar = parseFloat(spot.cliente_cuota_mensual) || 0;
  }

  if(montoACobrar <= 0) montoACobrar = prompt("Ingrese monto total:", "0");
  
  const pagoPendiente = {
      client: nombre, plate: placa, spot: spot.numero, phone: telefono, amount: montoACobrar, method: "Efectivo", period_type: "Salida", period_quantity: 1, is_mensualidad: false
  };
  localStorage.setItem('pending_payment', JSON.stringify(pagoPendiente));
  window.location.href = "caja.html";
}

window.crearPuestoRapido = async function() {
  const numero = prompt("Número del nuevo puesto:");
  if (!numero) return; 
  try {
    const res = await fetch("/api/puestos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero }) });
    const data = await res.json();
    if (data.success) { mostrarToast("Creado"); cargarPuestos(); } else { mostrarToast("Error", "error"); }
  } catch (e) { mostrarToast("Error", "error"); }
}

// --- MODAL ---
window.abrirModalAsignar = function(id, numero) {
  puestoSeleccionado = allSpots.find(s => s.id === id);
  if (!puestoSeleccionado) return;
  
  document.getElementById("modalSpotNumber").innerText = "Asignar a #" + numero;
  document.getElementById("checkReserva").checked = false;
  document.getElementById("inputTypeToggle").value = "registered";
  
  const select = document.getElementById("modalClienteSelect");
  select.innerHTML = '<option value="">-- Seleccione Cliente --</option>';
  clientesCache.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.text = `${c.nombre} (${c.placa})`;
      opt.dataset.placa = c.placa; opt.dataset.nombre = c.nombre;
      select.add(opt);
  });

  toggleInputType();
  abrirModal();
}

window.cerrarModalAsignar = function() { cerrarModal(); }

window.toggleInputType = function() {
  const type = document.getElementById("inputTypeToggle").value;
  const registeredDiv = document.getElementById("registeredClientDiv");
  const manualDiv = document.getElementById("manualClientDiv");
  if (type === "registered") { registeredDiv.classList.remove("hidden"); manualDiv.classList.add("hidden"); }
  else { registeredDiv.classList.add("hidden"); manualDiv.classList.remove("hidden"); }
}

window.confirmarAsignar = async function() {
  const esReserva = document.getElementById("checkReserva").checked;
  const tipo = document.getElementById("inputTypeToggle").value;
  let clienteId = null;
  let tempName = null;
  let tempPlate = null;

  if (tipo === "registered") {
      const select = document.getElementById("modalClienteSelect");
      clienteId = select.value;
      if (!clienteId) { mostrarToast("Seleccione un cliente", "error"); return; }
  } else {
      tempName = document.getElementById("tempNameInput").value.trim();
      tempPlate = document.getElementById("tempPlateInput").value.trim().toUpperCase();
      if (!tempName || !tempPlate) { mostrarToast("Nombre y Placa requeridos", "error"); return; }
  }

  const checkKey = document.getElementById('checkKey').checked;
  let llaveInfo = null;
  if (checkKey) { llaveInfo = { tiene: true, desc: document.getElementById('modalKeyDesc').value.trim() }; }

  try {
    // Enviamos timestamp desde JS para evitar errores de tipo NUMERIC
    const body = {
        id: puestoSeleccionado.id,
        estado: esReserva ? 'reservado' : 'ocupado',
        es_reserva: esReserva,
        llave_info: llaveInfo,
        cliente_id: clienteId,
        temp_name: tempName,
        temp_plate: tempPlate,
        hora_inicio: Math.floor(Date.now() / 1000) 
    };

    const res = await fetch("/api/puestos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
        mostrarToast("Asignado correctamente");
        cerrarModal();
        cargarPuestos();
    } else {
        mostrarToast("Error", "error");
    }
  } catch (e) { mostrarToast("Error de conexión", "error"); }
}