if (typeof document === 'undefined') {
    console.error("Este script debe ejecutarse en un entorno de navegador");
} else {
    document.addEventListener('DOMContentLoaded', () => { initApp(); });
}

let allSpots = [];
let clientesCache = [];
let currentFilterStatus = 'todos';
let currentSpotId = null;

// --- UTILIDADES ---
function mostrarToast(mensaje, tipo = 'success') {
  if (typeof document === 'undefined') return;
  const toastExistente = document.getElementById('custom-toast');
  if (toastExistente) toastExistente.remove();
  const toast = document.createElement('div');
  toast.id = 'custom-toast';
  toast.className = `fixed top-5 right-5 z-[150] px-6 py-4 rounded-xl shadow-2xl border transform transition-all duration-300 max-w-[90%] ${tipo === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`;
  toast.innerHTML = `<span class="font-bold text-sm">${mensaje}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
  setTimeout(() => { toast.classList.add('translate-x-full', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function calcularTiempo(horaInicioUnix) {
    if (!horaInicioUnix) return "";
    const diff = new Date() - new Date(Number(horaInicioUnix) * 1000);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatHoraEntrada(timestamp) {
    if (!timestamp) return "---";
    const date = new Date(Number(timestamp) * 1000);
    const dateStr = date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
    const timeStr = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
}

function initApp() {
    cargarPuestos();
    cargarClientesCache(); 
    const searchInput = document.getElementById("searchInput");
    if(searchInput) searchInput.addEventListener("input", (e) => renderMapa(e.target.value.toLowerCase()));
}

async function cargarClientesCache() {
  try {
    const res = await fetch("/api/clientes");
    if(res.ok) clientesCache = await res.json();
    else clientesCache = [];
  } catch (e) { console.error("Error cargando clientes:", e); clientesCache = []; }
}

async function cargarPuestos() {
  try {
    const res = await fetch("/api/puestos");
    if (!res.ok) throw new Error("Error API");
    allSpots = (await res.json()).sort((a,b) => (parseInt(a.numero)||0) - (parseInt(b.numero)||0));
    const elLibres = document.getElementById('kpi-libres');
    const elOcupados = document.getElementById('kpi-ocupados');
    const elTotal = document.getElementById('kpi-total');
    if(elLibres) elLibres.innerText = allSpots.filter(s => s.estado === 'libre').length;
    if(elOcupados) elOcupados.innerText = allSpots.filter(s => s.estado === 'ocupado').length;
    if(elTotal) elTotal.innerText = allSpots.length;
    renderMapa();
  } catch (error) { console.error(error); mostrarToast("Error cargando datos", "error"); }
}

function getClientesDisponibles() {
    if (typeof document === 'undefined') return [];
    const placasOcupadas = allSpots
        .filter(s => s.estado === 'ocupado')
        .map(s => s.cliente_placa || (JSON.parse(s.llave_caracteristicas||'{}').temp_user?.placa))
        .filter(p => p);
    return clientesCache.filter(c => !placasOcupadas.includes(c.placa));
}

function getIconForType(tipo) {
    if (!tipo) return 'fa-car';
    const t = tipo.toLowerCase();
    if (t.includes('moto')) return 'fa-motorcycle';
    if (t.includes('camioneta')) return 'fa-truck-pickup';
    return 'fa-car';
}

window.filtrarMapa = (f) => {
  currentFilterStatus = f;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white', 'bg-slate-100', 'text-slate-600');
    if(btn.dataset.filter === f || (f === 'todos' && btn.innerText === 'Todos')) { 
        btn.classList.add('bg-slate-800', 'text-white'); 
        btn.classList.remove('bg-slate-100', 'text-slate-600');
    } else { 
        btn.classList.add('bg-slate-100', 'text-slate-600');
        btn.classList.remove('bg-slate-800', 'text-white');
    }
  });
  const searchInput = document.getElementById("searchInput");
  renderMapa(searchInput ? searchInput.value.toLowerCase() : "");
};

// --- RENDERIZADO ---
function renderMapa(busqueda = "") {
  const container = document.getElementById("map-container");
  if (!container) return;
  container.innerHTML = "";
  
  let datos = allSpots;
  
  if (currentFilterStatus !== 'todos') datos = datos.filter(s => s.estado === currentFilterStatus);
  if (busqueda) {
      const term = busqueda.toLowerCase().trim();
      datos = datos.filter(s => {
          if (s.numero.toLowerCase().includes(term)) return true;
          if (s.cliente_nombre && s.cliente_nombre.toLowerCase().includes(term)) return true;
          if (s.cliente_placa && s.cliente_placa.toLowerCase().includes(term)) return true;
          try {
              const meta = JSON.parse(s.llave_caracteristicas || '{}');
              if (meta.temp_user) {
                  if (meta.temp_user.nombre && meta.temp_user.nombre.toLowerCase().includes(term)) return true;
                  if (meta.temp_user.placa && meta.temp_user.placa.toLowerCase().includes(term)) return true;
              }
              if (meta.reservation) {
                  if (meta.reservation.nombre && meta.reservation.nombre.toLowerCase().includes(term)) return true;
                  if (meta.reservation.placa && meta.reservation.placa.toLowerCase().includes(term)) return true;
              }
          } catch(e) {}
          try {
              const owner = JSON.parse(s.puesto_info || '{}');
              if (owner.nombre && owner.nombre.toLowerCase().includes(term)) return true;
              if (owner.placa && owner.placa.toLowerCase().includes(term)) return true;
          } catch(e) {}
          return false;
      });
  }

  if (datos.length === 0) {
      container.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 flex flex-col items-center"><i class="fa-solid fa-map-location-dot text-4xl mb-2 opacity-20"></i><span>No se encontraron puestos</span></div>`;
      return;
  }

  // Clases base
  const cardBase = "bg-white rounded-xl border shadow-sm flex flex-col h-full transition-all duration-200 hover:shadow-md";
  const headerBase = "flex justify-between items-center mb-4";
  const badgeBase = "text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider";
  const numberBase = "text-2xl font-bold text-slate-800";
  const bodyBase = "flex-1 flex flex-col justify-center items-center text-center space-y-1";
  const footerBase = "mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2";
  const btnClass = "w-full py-2 text-xs font-bold rounded-lg transition-colors shadow-sm";

  datos.forEach(spot => {
    let meta = {}, ownerInfo = null;
    try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e){}
    try { ownerInfo = JSON.parse(spot.puesto_info || '{}'); } catch(e){}
    const isTempUser = !spot.cliente_id && meta.temp_user;
    
    let cardHTML = '';
    let borderClass = "border-slate-200";
    let badgeHTML = "";
    let badgeColor = "";
    let contentHTML = "";
    let buttonsHTML = "";

    // --- Footer de administración ---
    const adminFooter = `
        <div class="mt-2 pt-2 border-t border-slate-50 grid grid-cols-3 gap-1">
            <button onclick="limpiarPuesto(${spot.id})" class="text-[9px] text-slate-400 hover:text-red-600 py-1 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-slate-50 transition-colors">
                <i class="fa-solid fa-broom"></i> Limpiar
            </button>
            <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="text-[9px] text-slate-400 hover:text-indigo-600 py-1 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-slate-50 transition-colors">
                <i class="fa-solid fa-pen"></i> Editar
            </button>
            <button onclick="eliminarPuesto(${spot.id})" class="text-[9px] text-red-300 hover:text-red-600 py-1 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-red-50 transition-colors">
                <i class="fa-solid fa-trash"></i> Eliminar
            </button>
        </div>
    `;

    // --- 1. RESERVADO ---
    if (spot.estado === 'reservado') {
        borderClass = "border-purple-200 ring-1 ring-purple-100";
        badgeColor = "bg-purple-100 text-purple-700";
        badgeHTML = `<span class="${badgeBase} ${badgeColor}">Reservado</span>`;
        
        let resNombre = meta.reservation?.nombre || "Reserva";
        let resPlaca = meta.reservation?.placa || "---";

        contentHTML = `
            <div class="${bodyBase}">
                <div class="font-bold text-sm text-slate-800 max-w-[90%] truncate">${resNombre}</div>
                <div class="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">${resPlaca}</div>
                <div class="text-[10px] text-slate-400 mt-1">Esperando llegada</div>
            </div>
        `;

        buttonsHTML = `
            <button onclick="ocuparReserva(${spot.id})" class="${btnClass} bg-purple-600 hover:bg-purple-700 text-white">Ocupar</button>
            <button onclick="liberar(${spot.id})" class="${btnClass} bg-white text-red-600 border border-red-200 hover:bg-red-50">Cancelar</button>
        `;
    }
    // --- 2. DUEÑO FUERA ---
    else if (spot.estado === 'libre' && ownerInfo.nombre) {
        borderClass = "border-amber-200 bg-amber-50/30";
        badgeColor = "bg-amber-100 text-amber-700";
        badgeHTML = `<span class="${badgeBase} ${badgeColor}">Dueño Fuera</span>`;

        contentHTML = `
            <div class="${bodyBase}">
                <div class="text-xs text-slate-500 uppercase tracking-wide font-semibold">Propietario</div>
                <div class="font-bold text-sm text-slate-800">${ownerInfo.nombre}</div>
            </div>
        `;

        buttonsHTML = `
            <button onclick="abrirModalVisitante()" class="${btnClass} bg-amber-500 hover:bg-amber-600 text-white">Visitante</button>
            <button onclick="restaurarDueno(${spot.id})" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white">Restaurar</button>
        `;
    }
    // --- 3. LIBRE ---
    else if (spot.estado === 'libre') {
        borderClass = "border-slate-200";
        badgeHTML = `<span class="${badgeBase} bg-emerald-100 text-emerald-700">Disponible</span>`;

        contentHTML = `
            <div class="${bodyBase}">
                <div class="text-3xl font-light text-slate-300 mb-2">${spot.numero}</div>
            </div>
        `;

        buttonsHTML = `
            <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white">Asignar Cliente</button>
            <button onclick="abrirModalVisitante()" class="${btnClass} bg-amber-500 hover:bg-amber-600 text-white">Visitante</button>
            <div class="col-span-2">
                <button onclick="abrirModalReservar(${spot.id}, '${spot.numero}')" class="${btnClass} w-full bg-white text-purple-600 border border-purple-200 hover:bg-purple-50">Reservar Puesto</button>
            </div>
        `;
    }
    // --- 4. VISITANTE ---
    else if (spot.estado === 'ocupado' && isTempUser) {
        borderClass = "border-amber-300 bg-amber-50";
        badgeColor = "bg-amber-500 text-white";
        badgeHTML = `<span class="${badgeBase} ${badgeColor}">Visitante</span>`;

        const hasOwner = ownerInfo && ownerInfo.nombre;
        const entryTime = formatHoraEntrada(spot.hora_inicio);

        contentHTML = `
            <div class="${bodyBase}">
                <div class="font-bold text-sm text-slate-800 max-w-[90%] truncate">${meta.temp_user.nombre}</div>
                <div class="flex items-center gap-1">
                    <span class="font-mono text-xs bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-700">${meta.temp_user.placa}</span>
                </div>
                <div class="text-[10px] text-slate-500 font-medium mt-1">
                    <i class="fa-regular fa-clock mr-1"></i>${calcularTiempo(spot.hora_inicio)}
                </div>
                <div class="text-[10px] text-slate-400">${entryTime}</div>
                ${hasOwner ? `<div class="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 rounded mt-1 border border-indigo-100">Dueño: ${ownerInfo.nombre}</div>` : ''}
            </div>
        `;

        let btnGrid = hasOwner ? "grid-cols-3 gap-1" : "grid-cols-2 gap-2";
        buttonsHTML = `
            <div class="${footerBase} ${btnGrid}">
                <button onclick="cobrarVisitante(${spot.id})" class="${btnClass} bg-amber-600 hover:bg-amber-700 text-white">Cobrar</button>
                <button onclick="salirVisitante(${spot.id})" class="${btnClass} bg-white hover:bg-red-50 text-red-600 border border-red-200">Salir</button>
                ${hasOwner ? `<button onclick="restaurarDueno(${spot.id})" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white">Restaurar</button>` : ''}
            </div>
        `;
    }
    // --- 5. OCUPADO (Cliente/Dueño) ---
    else if (spot.estado === 'ocupado') {
        borderClass = "border-indigo-200 bg-indigo-50/50";
        const isClient = !!spot.cliente_id;
        badgeColor = isClient ? "bg-indigo-600 text-white" : "bg-slate-700 text-white";
        const badgeText = isClient ? "Cliente" : "Dueño";
        
        badgeHTML = `<span class="${badgeBase} ${badgeColor}">${badgeText}</span>`;

        const nombre = spot.cliente_nombre || ownerInfo.nombre || 'Desconocido';
        const placa = spot.cliente_placa || ownerInfo.placa || '---';
        const entryTime = formatHoraEntrada(spot.hora_inicio);

        contentHTML = `
            <div class="${bodyBase}">
                <div class="font-bold text-sm text-slate-800 max-w-[90%] truncate">${nombre}</div>
                <div class="flex items-center gap-1 mb-1">
                    <span class="font-mono text-xs bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">${placa}</span>
                    ${spot.cliente_tipo_vehiculo ? `<i class="fa-solid ${getIconForType(spot.cliente_tipo_vehiculo)} text-xs text-indigo-400"></i>` : ''}
                </div>
                <div class="text-[10px] text-slate-500 font-medium">
                    <i class="fa-regular fa-clock mr-1"></i>${calcularTiempo(spot.hora_inicio)}
                </div>
                <div class="text-[10px] text-slate-400">${entryTime}</div>
            </div>
        `;

        buttonsHTML = `
            <div class="${footerBase}">
                <button onclick="cobrar(${spot.id})" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white">Cobrar</button>
                <button onclick="salir(${spot.id})" class="${btnClass} bg-white hover:bg-red-50 text-red-600 border border-red-200">Salir</button>
            </div>
        `;
    }

    cardHTML = `
        <div class="${cardBase} ${borderClass}">
            <div class="p-4 h-full flex flex-col">
                <div class="${headerBase}">
                    ${badgeHTML}
                    <span class="${numberBase}">${spot.numero}</span>
                </div>
                ${contentHTML}
                ${buttonsHTML}
                ${adminFooter}
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// --- MODALES Y ANIMACIONES ---
function cerrarTodosLosModales() {
    const modals = ['modalCrearPuesto', 'modalAsignar', 'modalVisitante', 'modalReservar'];
    modals.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.classList.add('hidden');
            el.classList.add('opacity-0');
        }
    });
}

function animarModalEntrada(modalId, contentId) {
    if (typeof document === 'undefined') return;
    cerrarTodosLosModales();

    const modal = document.getElementById(modalId);
    const content = document.getElementById(contentId);
    if(!modal || !content) return;
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    content.classList.remove('opacity-0', 'scale-95');
    content.classList.add('scale-100');
}

function animarModalSalida(modalId, contentId, callback) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById(modalId);
    const content = document.getElementById(contentId);
    if(!modal || !content) return;
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { modal.classList.add('hidden'); if(callback) callback(); }, 200);
}

// Crear Puesto
window.abrirModalCrearPuesto = function() {
    const input = document.getElementById('inputNuevoNumero');
    if(input) input.value = '';
    animarModalEntrada('modalCrearPuesto', 'modalCrearPuestoContent');
    if(input) setTimeout(() => input.focus(), 100);
};
window.cerrarModalCrearPuesto = function() { animarModalSalida('modalCrearPuesto', 'modalCrearPuestoContent'); };
window.confirmarCrearPuesto = async function() {
    const input = document.getElementById('inputNuevoNumero');
    const numero = input ? input.value.trim() : "";
    if (!numero) return mostrarToast("Ingrese un número", "error");
    try {
        const res = await fetch("/api/puestos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero }) });
        const data = await res.json();
        if (data.success) { mostrarToast("Puesto creado"); cerrarModalCrearPuesto(); cargarPuestos(); } 
        else { mostrarToast(data.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

// --- RESERVAR ---
window.abrirModalReservar = function(id, numero) {
    currentSpotId = id;
    const title = document.getElementById('modalReservarTitle');
    if(title) title.innerText = `Reservar Puesto #${numero}`;
    document.getElementById('reservaNombre').value = '';
    document.getElementById('reservaPlaca').value = '';
    animarModalEntrada('modalReservar', 'modalReservarContent');
};
window.cerrarModalReservar = function() { animarModalSalida('modalReservar', 'modalReservarContent'); };
window.confirmarReservar = async function() {
    const nombre = document.getElementById('reservaNombre').value.trim();
    const placa = document.getElementById('reservaPlaca').value.trim();
    if (!nombre) return mostrarToast("El nombre es obligatorio", "error");
    try {
        const bodyData = { id: currentSpotId, accion: "reservar", nombre, placa };
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) });
        const data = await res.json();
        if (data.success) { cerrarModalReservar(); mostrarToast("Reserva creada"); cargarPuestos(); }
        else { mostrarToast(data.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

// --- VISITANTE ---
window.abrirModalVisitante = function() {
    const spotSelect = document.getElementById('visitanteSpotSelect');
    const clientSelect = document.getElementById('visitanteClientSelect');
    
    if(spotSelect) {
        spotSelect.innerHTML = '<option value="">Seleccionar Puesto...</option>';
        allSpots.forEach(s => {
            const owner = JSON.parse(s.puesto_info || '{}');
            if (s.estado === 'libre') {
                const opt = document.createElement("option");
                opt.value = s.id;
                opt.text = `Puesto #${s.numero} ${owner.nombre ? '(Dueño: '+owner.nombre+')' : ''}`;
                spotSelect.add(opt);
            }
        });
    }
    if(clientSelect) {
        const disponibles = getClientesDisponibles();
        clientSelect.innerHTML = '<option value="">Seleccionar Cliente (Opcional)...</option>';
        disponibles.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.text = `${c.nombre} (${c.placa})`;
            clientSelect.add(opt);
        });
    }
    const manualRadio = document.querySelector('input[name="visitanteType"][value="manual"]');
    if(manualRadio) manualRadio.checked = true;
    window.onVisitanteTypeChange();
    animarModalEntrada('modalVisitante', 'modalVisitanteContent');
};
window.cerrarModalVisitante = function() { animarModalSalida('modalVisitante', 'modalVisitanteContent'); };
window.onVisitanteTypeChange = function() {
    const type = document.querySelector('input[name="visitanteType"]:checked')?.value;
    const clientSection = document.getElementById('divVisitanteCliente');
    const manualSection = document.getElementById('divVisitanteManual');
    if(!type) return;
    if (type === 'registered') {
        clientSection?.classList.remove('hidden');
        manualSection?.classList.add('hidden');
    } else {
        clientSection?.classList.add('hidden');
        manualSection?.classList.remove('hidden');
    }
};
window.onVisitanteClientChange = function() {
    const select = document.getElementById('visitanteClientSelect');
    const clientId = select.value;
    const nameInput = document.getElementById('visitanteNombre');
    const plateInput = document.getElementById('visitantePlaca');
    if (clientId) {
        const client = clientesCache.find(c => c.id == clientId);
        if (client) {
            nameInput.value = client.nombre;
            plateInput.value = client.placa;
            nameInput.readOnly = true; plateInput.readOnly = true;
        }
    } else {
        nameInput.value = ''; plateInput.value = '';
        nameInput.readOnly = false; plateInput.readOnly = false;
    }
};
window.confirmarVisitante = async function() {
    const tipo = document.querySelector('input[name="visitanteType"]:checked')?.value;
    const spotId = document.getElementById('visitanteSpotSelect').value;
    let nombre, placa, clientId = null;

    if (!spotId) return mostrarToast("Seleccione un puesto", "error");
    if (tipo === 'registered') {
        clientId = document.getElementById('visitanteClientSelect').value;
        if (!clientId) return mostrarToast("Seleccione un cliente", "error");
    } else {
        nombre = document.getElementById('visitanteNombre').value;
        placa = document.getElementById('visitantePlaca').value;
        if (!nombre || !placa) return mostrarToast("Complete nombre y placa", "error");
    }
    try {
        const bodyData = { id: spotId, accion: "asignar_visitante", temp_name: nombre, temp_plate: placa, cliente_id: clientId };
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) });
        const data = await res.json();
        if (data.success) { cerrarModalVisitante(); mostrarToast("Ingreso registrado"); cargarPuestos(); }
        else { mostrarToast(data.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

// --- ASIGNAR CLIENTE ---
window.abrirModalAsignar = async function(id, numero) {
    currentSpotId = id;
    await cargarPuestos(); await cargarClientesCache();
    document.getElementById('modalAsignarTitle').innerText = `Asignar #${numero} (Cliente)`;
    
    const select = document.getElementById("modalClienteSelect");
    if(select) {
        select.innerHTML = '<option value="">-- Seleccione Cliente --</option>';
        const disponibles = getClientesDisponibles();
        if(disponibles.length === 0) {
             const opt = document.createElement("option");
             opt.disabled = true;
             opt.text = "No hay clientes disponibles";
             opt.value = "";
             select.add(opt);
        } else {
            disponibles.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.id; opt.text = `${c.nombre} (${c.placa})`;
                select.add(opt);
            });
        }
    }
    animarModalEntrada('modalAsignar', 'modalAsignarContent');
};
window.cerrarModal = function() { animarModalSalida('modalAsignar', 'modalAsignarContent'); };
window.confirmarAsignar = async function() {
    const clienteId = document.getElementById('modalClienteSelect').value;
    if (!clienteId) return mostrarToast("Seleccione un cliente de la lista", "error");

    const bodyData = { 
        id: currentSpotId,
        accion: "asignar_registrado",
        cliente_id: clienteId 
    };

    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) });
        const data = await res.json();
        if (data.success) { cerrarModal(); mostrarToast("Asignado correctamente"); cargarPuestos(); }
        else { mostrarToast(data.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

// --- ACCIONES ---
window.ocuparReserva = async function(id) {
    if(!confirm("¿Confirmar llegada y ocupar el puesto reservado?")) return;
    const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "ocupar_reserva" }) });
    if(res.ok) { mostrarToast("Ocupado"); cargarPuestos(); }
};
window.liberar = async function(id) {
    if(!confirm("¿Cancelar reserva y liberar puesto?")) return;
    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "salir_visitante" }) });
        if(res.ok) { mostrarToast("Liberado"); cargarPuestos(); }
    } catch(e) { mostrarToast("Error", "error"); }
};
window.eliminarPuesto = async function(id) {
    if(!confirm("¿ESTÁ SEGURO DE ELIMINAR ESTE PUESTO?")) return;
    try {
        const res = await fetch(`/api/puestos?id=${id}`, { method: "DELETE" });
        if(res.ok) { mostrarToast("Puesto eliminado"); cargarPuestos(); }
        else { const d = await res.json(); mostrarToast(d.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

// --- COBRAR (LOGICA ACTUALIZADA FORZANDO SALIDA) ---
window.cobrar = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    let monto = spot.cuota_mensual;
    const owner = JSON.parse(spot.puesto_info || '{}');
    if ((!monto || monto <= 0)) {
        const clientData = clientesCache.find(c => c.placa === (spot.cliente_placa || owner.placa));
        if (clientData) monto = clientData.cuota_mensual;
    }
    if (!monto || monto <= 0) {
        const inputMonto = prompt(`Cuota no definida. Valor:`, "0");
        if(inputMonto === null) return; monto = inputMonto;
    }
    if(!monto || monto <= 0) return alert("Monto inválido");

    const nombre = spot.cliente_nombre || owner.nombre || 'Cliente';
    const telefono = spot.cliente_telefono || owner.telefono || '';
    const plate = spot.cliente_placa || owner.placa;

    // 1. Preguntar si renueva
    const renueva = confirm(
        "¿El cliente RENUEVA el servicio por el próximo mes?\n\n" +
        "ACEPTAR (Sí): Se cobra y el cliente SE QUEDA en el puesto.\n" +
        "CANCELAR (No): Se cobra y el cliente LIBERA el puesto (se borran datos)."
    );

    // 2. Si NO renueva, forzamos la liberación del puesto AQUÍ MISMO antes de ir a caja
    if (!renueva) {
        try {
            // Llamamos a la API de salida oficial
            const res = await fetch("/api/puestos", { 
                method: "PUT", 
                headers: {"Content-Type": "application/json"}, 
                body: JSON.stringify({ id, accion: "salida_oficial" }) 
            });
            
            if (res.ok) {
                mostrarToast("Salida registrada. Procediendo al cobro.");
                // Recargamos los puestos para asegurar que la vista esté actualizada si el usuario regresa
                await cargarPuestos();
            } else {
                // Si falla la liberación, no dejamos ir a caja para evitar inconsistencias
                const errorData = await res.json();
                alert("Error al liberar el puesto: " + (errorData.error || "Desconocido"));
                return; 
            }
        } catch(e) {
            mostrarToast("Error de conexión al liberar puesto", "error");
            return;
        }
    }

    // 3. Redirigir a Caja
    // Si renueva=true, caja simplemente cobra.
    // Si renueva=false, el puesto ya está libre gracias al paso anterior, caja solo sirve de recibo.
    const url = `caja.html?plate=${plate}&spot=${spot.numero}&client=${encodeURIComponent(nombre)}&phone=${telefono}&entry=${spot.hora_inicio || Math.floor(Date.now()/1000)}&amount=${monto}&period=Mes&renew=${renueva}`;
    window.location.href = url;
};

window.cobrarVisitante = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    const meta = JSON.parse(spot.llave_caracteristicas || '{}');
    const inputMonto = prompt("Valor a cobrar:", "0");
    if(inputMonto === null) return;
    const monto = inputMonto;
    if(!monto || monto <= 0) return;
    if(!confirm(`¿Cobrar $${monto} a ${meta.temp_user.nombre}?`)) return;

    const url = `caja.html?plate=${meta.temp_user.placa}&spot=${spot.numero}&client=${encodeURIComponent(meta.temp_user.nombre)}&phone=&entry=${spot.hora_inicio || Math.floor(Date.now()/1000)}&amount=${monto}&period=Visita`;
    window.location.href = url;
};
window.salir = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    const owner = JSON.parse(spot.puesto_info || '{}');
    const nombre = spot.cliente_nombre || owner.nombre || "Cliente";
    if(!confirm(`¿REGISTRAR SALIDA?\n\nCliente: ${nombre}\n\nEl puesto quedará libre.`)) return;
    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "salida_oficial" }) });
        if (res.ok) { mostrarToast("Salida registrada."); cargarPuestos(); }
        else { mostrarToast("Error", "error"); }
    } catch(e) { mostrarToast("Error", "error"); }
};
window.salirVisitante = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    
    const meta = JSON.parse(spot.llave_caracteristicas || '{}');
    const owner = JSON.parse(spot.puesto_info || '{}');
    
    let mensaje = `¿El visitante ${meta.temp_user.nombre} se va?`;
    
    if (owner.nombre) {
        mensaje += `\n\n⚠️ ATENCIÓN: Este puesto tiene un dueño original.\n`;
        mensaje += `👤 Dueño: ${owner.nombre} (${owner.placa}).\n\n`;
        mensaje += `Si confirma "Salir", el puesto quedará LIBRE.`;
    } else {
        mensaje += `\n\nEl puesto quedará libre.`;
    }

    if(!confirm(mensaje)) return;

    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "salir_visitante" }) });
        if (res.ok) { mostrarToast("Liberado"); cargarPuestos(); }
    } catch(e) { mostrarToast("Error", "error"); }
};
window.limpiarPuesto = async function(id) {
    if(!confirm("¿LIMPIAR TODO? Se borrará el dueño guardado.")) return;
    try {
        const res = await fetch(`/api/puestos?id=${id}`, { method: "PATCH" });
        if(res.ok) { mostrarToast("Limpio"); cargarPuestos(); }
        else { mostrarToast("Error al limpiar", "error"); }
    } catch(e) { mostrarToast("Error", "error"); }
};
window.restaurarDueno = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return mostrarToast("Puesto no encontrado", "error");
    const ownerInfo = JSON.parse(spot.puesto_info || '{}');
    if(!ownerInfo.nombre) return mostrarToast("Sin dueño guardado", "error");
    if(!confirm(`¿Restaurar a ${ownerInfo.nombre}?`)) return;
    const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "restaurar_dueno" }) });
    if(res.ok) { mostrarToast("Restaurado"); cargarPuestos(); }
    else { mostrarToast("Error", "error"); }
};
window.editarNumeroPuesto = async function(id, actual) {
    const nuevo = prompt("Nuevo número:", actual);
    if(!nuevo || nuevo === actual) return;
    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "editar_numero", nuevo_numero: nuevo }) });
        const data = await res.json();
        if(data.success) { mostrarToast("Actualizado"); cargarPuestos(); }
        else { mostrarToast(data.error, "error"); }
    } catch(e) { mostrarToast("Error", "error"); }
};