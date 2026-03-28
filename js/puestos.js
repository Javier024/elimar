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

// ACTUALIZADO: Ahora SIEMPRE muestra Fecha (DD/MM/YY) y Hora (HH:MM)
function formatHoraEntrada(timestamp) {
    if (!timestamp) return "---";
    const date = new Date(Number(timestamp) * 1000);
    
    // Formato de fecha: 21/10/23
    const dateStr = date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
    
    // Formato de hora: 14:30
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

// --- RENDERIZADO MEJORADO ---
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

  const btnClass = "whitespace-normal break-words leading-tight text-[10px] font-bold py-1.5 rounded transition-colors shadow-sm w-full";

  datos.forEach(spot => {
    let meta = {}, ownerInfo = null;
    try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e){}
    try { ownerInfo = JSON.parse(spot.puesto_info || '{}'); } catch(e){}
    const isTempUser = !spot.cliente_id && meta.temp_user;
    let cardHTML = '';
    let borderClass = "border-slate-200";
    let bgClass = "bg-white";
    let badgeHTML = "";
    let footerActions = `
        <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
            <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="text-[10px] text-slate-500 hover:text-slate-800 text-left truncate">Editar N°</button>
            <button onclick="eliminarPuesto(${spot.id})" class="text-[10px] text-red-400 hover:text-red-600 text-right font-bold underline truncate">Eliminar</button>
        </div>
    `;

    // RESERVADO
    if (spot.estado === 'reservado') {
        borderClass = "border-purple-200"; bgClass = "bg-purple-50";
        badgeHTML = `<span class="bg-purple-200 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">RESERVADO</span>`;
        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-3 flex flex-col justify-between relative min-h-[150px] shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-2">${badgeHTML}<span class="text-lg font-bold text-slate-700">${spot.numero}</span></div>
                <div class="mb-2"><div class="text-xs font-bold text-slate-800 truncate">${spot.cliente_nombre || 'Reserva'}</div></div>
                <div class="grid grid-cols-2 gap-2 mt-auto">
                    <button onclick="ocuparReserva(${spot.id})" class="${btnClass} bg-purple-600 hover:bg-purple-700 text-white">Ocupar</button>
                    <button onclick="liberar(${spot.id})" class="${btnClass} bg-white hover:bg-red-50 text-red-600 border border-red-200">Cancelar</button>
                </div>
                ${footerActions}
            </div>`;
    } else if (spot.estado === 'libre' && ownerInfo.nombre) {
        borderClass = "border-amber-200"; bgClass = "bg-amber-50";
        badgeHTML = `<span class="bg-amber-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">DUEÑO FUERA</span>`;
        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-3 flex flex-col justify-between relative min-h-[150px] shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-2">${badgeHTML}<span class="text-lg font-bold text-slate-700">${spot.numero}</span></div>
                <div class="mb-2 flex-1 flex flex-col justify-center"><div class="text-[10px] text-amber-700 font-medium text-center">Propietario:</div><div class="text-sm font-bold text-slate-800 truncate text-center">${ownerInfo.nombre}</div></div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button onclick="abrirModalNocturno()" class="${btnClass} bg-amber-500 hover:bg-amber-600 text-white">Nocturno</button>
                    <button onclick="restaurarDueno(${spot.id})" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white">Restaurar</button>
                </div>
                ${footerActions}
            </div>`;
    } else if (spot.estado === 'libre') {
        cardHTML = `
            <div class="${borderClass} ${bgClass} hover:border-emerald-400 rounded-xl p-3 flex flex-col items-center justify-between relative min-h-[150px] transition-all group">
                <div class="text-2xl font-bold mb-2 text-slate-600 group-hover:text-emerald-600 transition-colors">${spot.numero}</div>
                <div class="text-[11px] mb-3 text-slate-400">Disponible</div>
                <div class="grid grid-cols-1 gap-2 w-full">
                    <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white shadow">Asignar Oficial</button>
                    <button onclick="abrirModalNocturno()" class="${btnClass} bg-amber-500 hover:bg-amber-600 text-white shadow">Ingreso Nocturno</button>
                </div>
                ${footerActions}
            </div>`;
    } else if (spot.estado === 'ocupado' && isTempUser) {
        // --- NOCTURNO ---
        borderClass = "border-amber-300"; bgClass = "bg-amber-100";
        badgeHTML = `<span class="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">NOCTURNO</span>`;
        
        const hasOwner = ownerInfo && ownerInfo.nombre;
        const gridClass = hasOwner ? "grid grid-cols-3 gap-1" : "grid grid-cols-2 gap-2";

        let buttonsHTML = `
            <button onclick="cobrarNocturno(${spot.id})" class="${btnClass} bg-amber-600 hover:bg-amber-700 text-white">Cobrar</button>
            <button onclick="salirNocturno(${spot.id})" class="${btnClass} bg-white hover:bg-red-50 text-red-600 border border-red-200">Salir</button>
        `;

        if (hasOwner) {
            buttonsHTML += `<button onclick="restaurarDueno(${spot.id})" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">Restaurar</button>`;
        }

        const entryTime = formatHoraEntrada(spot.hora_inicio);

        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-3 flex flex-col justify-between relative min-h-[150px] shadow-sm border-2">
                <div class="flex justify-between items-start mb-2">${badgeHTML}<span class="text-lg font-bold text-slate-700">${spot.numero}</span></div>
                <div class="mb-2">
                    <div class="font-bold text-xs text-slate-800 truncate">${meta.temp_user.nombre}</div>
                    <div class="font-mono text-[10px] bg-white px-1.5 inline-block rounded border border-slate-200 w-max mt-1">${meta.temp_user.placa}</div>
                    
                    <!-- BLOQUE DE TIEMPO ACTUALIZADO -->
                    <div class="mt-2 space-y-1">
                        <div class="flex justify-between items-center text-[10px]">
                            <div class="text-slate-500"><i class="fa-regular fa-clock"></i> ${calcularTiempo(spot.hora_inicio)}</div>
                        </div>
                        <div class="font-bold text-slate-700 bg-white px-1.5 rounded border border-slate-200 text-center">
                            Entró: ${entryTime}
                        </div>
                    </div>

                    ${hasOwner ? `<div class="text-[9px] text-indigo-700 mt-1 font-semibold bg-indigo-100 inline-block px-1 rounded truncate w-full">Dueño: ${ownerInfo.nombre}</div>` : ''}
                </div>
                <div class="${gridClass} mt-2">
                    ${buttonsHTML}
                </div>
                <button onclick="limpiarPuesto(${spot.id})" class="mt-1 text-[10px] text-slate-400 hover:text-red-600 underline w-full">Limpiar Datos</button>
                ${footerActions}
            </div>`;
    } else if (spot.estado === 'ocupado') {
        // OFICIAL O DUEÑO RESTITUIDO
        borderClass = "border-indigo-200"; bgClass = "bg-indigo-50";
        const nombre = spot.cliente_nombre || ownerInfo.nombre || 'Desconocido';
        const placa = spot.cliente_placa || ownerInfo.placa || '---';
        const badgeColor = spot.cliente_id ? "bg-indigo-600" : "bg-indigo-800";
        const badgeText = spot.cliente_id ? "OFICIAL" : "DUEÑO";
        
        badgeHTML = `<span class="${badgeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">${badgeText}</span>`;

        const entryTime = formatHoraEntrada(spot.hora_inicio);

        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-3 flex flex-col justify-between relative min-h-[150px] shadow-sm">
                <div class="flex justify-between items-start mb-2">${badgeHTML}<span class="text-lg font-bold text-slate-700">${spot.numero}</span></div>
                <div class="mb-2">
                    <div class="font-bold text-xs text-slate-800 truncate">${nombre}</div>
                    <div class="font-mono text-[10px] bg-white px-1.5 inline-block rounded border border-slate-200 w-max mt-1">${placa}</div>
                    
                    <!-- BLOQUE DE TIEMPO ACTUALIZADO -->
                    <div class="mt-2 space-y-1">
                        <div class="flex justify-between items-center text-[10px]">
                            <div class="text-slate-500"><i class="fa-regular fa-clock"></i> ${calcularTiempo(spot.hora_inicio)}</div>
                        </div>
                        <div class="font-bold text-indigo-700 bg-white px-1.5 rounded border border-indigo-200 text-center">
                            Entró: ${entryTime}
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button onclick="cobrar(${spot.id})" class="${btnClass} bg-indigo-600 hover:bg-indigo-700 text-white">Cobrar</button>
                    <button onclick="salir(${spot.id})" class="${btnClass} bg-white hover:bg-red-50 text-red-600 border border-red-200">Salir</button>
                </div>
                <button onclick="limpiarPuesto(${spot.id})" class="mt-1 text-[10px] text-slate-400 hover:text-red-600 underline w-full">Limpiar</button>
                ${footerActions}
            </div>`;
    }
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// --- MODALES ---
function animarModalEntrada(modalId, contentId) {
    if (typeof document === 'undefined') return;
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

// --- NOCTURNO ---
window.abrirModalNocturno = function() {
    const spotSelect = document.getElementById('nocturnoSpotSelect');
    const clientSelect = document.getElementById('nocturnoClientSelect');
    
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
    const manualRadio = document.querySelector('input[name="nocturnoType"][value="manual"]');
    if(manualRadio) manualRadio.checked = true;
    window.onNocturnoTypeChange();
    animarModalEntrada('modalNocturno', 'modalNocturnoContent');
};
window.cerrarModalNocturno = function() { animarModalSalida('modalNocturno', 'modalNocturnoContent'); };
window.onNocturnoTypeChange = function() {
    const type = document.querySelector('input[name="nocturnoType"]:checked')?.value;
    const clientSection = document.getElementById('divNocturnoCliente');
    const manualSection = document.getElementById('divNocturnoManual');
    if(!type) return;
    if (type === 'registered') {
        clientSection?.classList.remove('hidden');
        manualSection?.classList.add('hidden');
    } else {
        clientSection?.classList.add('hidden');
        manualSection?.classList.remove('hidden');
    }
};
window.onNocturnoClientChange = function() {
    const select = document.getElementById('nocturnoClientSelect');
    const clientId = select.value;
    const nameInput = document.getElementById('nocturnoNombre');
    const plateInput = document.getElementById('nocturnoPlaca');
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
window.confirmarNocturno = async function() {
    const tipo = document.querySelector('input[name="nocturnoType"]:checked')?.value;
    const spotId = document.getElementById('nocturnoSpotSelect').value;
    let nombre, placa, clientId = null;

    if (!spotId) return mostrarToast("Seleccione un puesto", "error");
    if (tipo === 'registered') {
        clientId = document.getElementById('nocturnoClientSelect').value;
        if (!clientId) return mostrarToast("Seleccione un cliente", "error");
    } else {
        nombre = document.getElementById('nocturnoNombre').value;
        placa = document.getElementById('nocturnoPlaca').value;
        if (!nombre || !placa) return mostrarToast("Complete nombre y placa", "error");
    }
    try {
        const bodyData = { id: spotId, accion: "asignar_nocturno", temp_name: nombre, temp_plate: placa, cliente_id: clientId };
        const res = await fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) });
        const data = await res.json();
        if (data.success) { cerrarModalNocturno(); mostrarToast("Ingreso registrado"); cargarPuestos(); }
        else { mostrarToast(data.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

// --- ASIGNAR ---
window.abrirModalAsignar = async function(id, numero) {
    currentSpotId = id;
    await cargarPuestos(); await cargarClientesCache();
    document.getElementById('modalAsignarTitle').innerText = `Asignar #${numero} (Oficial)`;
    
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
    if(!confirm("¿Confirmar llegada y ocupar?")) return;
    const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "ocupar_reserva" }) });
    if(res.ok) { mostrarToast("Ocupado"); cargarPuestos(); }
};
window.eliminarPuesto = async function(id) {
    if(!confirm("¿ESTÁ SEGURO DE ELIMINAR ESTE PUESTO?")) return;
    try {
        const res = await fetch(`/api/puestos?id=${id}`, { method: "DELETE" });
        if(res.ok) { mostrarToast("Puesto eliminado"); cargarPuestos(); }
        else { const d = await res.json(); mostrarToast(d.error || "Error", "error"); }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};
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
    const url = `caja.html?plate=${plate}&spot=${spot.numero}&client=${encodeURIComponent(nombre)}&phone=${telefono}&entry=${spot.hora_inicio || Math.floor(Date.now()/1000)}&amount=${monto}&period=Mes`;
    window.location.href = url;
};
window.cobrarNocturno = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    const meta = JSON.parse(spot.llave_caracteristicas || '{}');
    const inputMonto = prompt("Valor a cobrar:", "0");
    if(inputMonto === null) return;
    const monto = inputMonto;
    if(!monto || monto <= 0) return;
    if(!confirm(`¿Cobrar $${monto} a ${meta.temp_user.nombre}?`)) return;

    const url = `caja.html?plate=${meta.temp_user.placa}&spot=${spot.numero}&client=${encodeURIComponent(meta.temp_user.nombre)}&phone=&entry=${spot.hora_inicio || Math.floor(Date.now()/1000)}&amount=${monto}&period=Noche`;
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
window.salirNocturno = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    
    const meta = JSON.parse(spot.llave_caracteristicas || '{}');
    const owner = JSON.parse(spot.puesto_info || '{}');
    
    let mensaje = `¿El cliente nocturno ${meta.temp_user.nombre} se va?`;
    
    if (owner.nombre) {
        mensaje += `\n\n⚠️ ATENCIÓN: Este puesto tiene un dueño original.\n`;
        mensaje += `👤 Dueño: ${owner.nombre} (${owner.placa}).\n\n`;
        mensaje += `Si confirma "Salir", el puesto quedará LIBRE (el dueño no regresa automáticamente).`;
    } else {
        mensaje += `\n\nEl puesto quedará libre.`;
    }

    if(!confirm(mensaje)) return;

    try {
        const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "salir_nocturno" }) });
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