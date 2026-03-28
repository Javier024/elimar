let allSpots = [];
let clientesCache = [];
let currentFilterStatus = 'todos';
let currentSpotId = null;
let isNocturnoMode = false;

// --- UTILIDADES ---
function mostrarToast(mensaje, tipo = 'success') {
  const toastExistente = document.getElementById('custom-toast');
  if (toastExistente) toastExistente.remove();
  const toast = document.createElement('div');
  toast.id = 'custom-toast';
  toast.className = `fixed top-5 right-5 z-[90] px-6 py-4 rounded-xl shadow-xl border transform transition-all duration-300 ${tipo === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`;
  toast.innerHTML = `<span class="font-medium text-sm">${mensaje}</span>`;
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

function calcularDetallesTiempo(horaInicioUnix) {
    if (!horaInicioUnix) return "Sin tiempo registrado";
    const diffMs = new Date() - new Date(Number(horaInicioUnix) * 1000);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let res = "";
    if (days > 0) res += `${days} día(s), `;
    if (hours > 0) res += `${hours} hora(s) y `;
    res += `${minutes} minuto(s).`;
    return res;
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
  cargarPuestos();
  cargarClientesCache(); 
  
  const searchInput = document.getElementById("searchInput");
  if(searchInput) {
      searchInput.addEventListener("input", (e) => {
          renderMapa(e.target.value.toLowerCase());
      });
  }
});

async function cargarClientesCache() {
  try {
    const res = await fetch("/api/clientes");
    if(res.ok) clientesCache = await res.json();
  } catch (e) { console.error(e); }
}

async function cargarPuestos() {
  try {
    const res = await fetch("/api/puestos");
    if (!res.ok) throw new Error("Error API");
    allSpots = (await res.json()).sort((a,b) => {
        const numA = parseInt(a.numero) || 0;
        const numB = parseInt(b.numero) || 0;
        return numA - numB;
    });
    
    const elLibres = document.getElementById('kpi-libres');
    const elOcupados = document.getElementById('kpi-ocupados');
    const elTotal = document.getElementById('kpi-total');
    
    if(elLibres) elLibres.innerText = allSpots.filter(s => s.estado === 'libre').length;
    if(elOcupados) elOcupados.innerText = allSpots.filter(s => s.estado === 'ocupado').length;
    if(elTotal) elTotal.innerText = allSpots.length;
    
    renderMapa();
  } catch (error) { 
    console.error(error); 
    mostrarToast("Error cargando datos", "error"); 
  }
}

window.filtrarMapa = (f) => {
  currentFilterStatus = f;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white', 'bg-slate-100', 'text-slate-600');
    if(btn.dataset.filter === f || (f === 'todos' && btn.innerText === 'Todos')) { 
        btn.classList.remove('bg-slate-100', 'text-slate-600');
        btn.classList.add('bg-slate-800', 'text-white'); 
    } else { 
        btn.classList.remove('bg-slate-800', 'text-white');
        btn.classList.add('bg-slate-100', 'text-slate-600'); 
    }
  });
  const searchInput = document.getElementById("searchInput");
  renderMapa(searchInput ? searchInput.value.toLowerCase() : "");
};

// --- RENDERIZADO ---
function renderMapa(busqueda = "") {
  const container = document.getElementById("map-container");
  if(!container) return;
  container.innerHTML = "";
  
  let datos = allSpots;
  if (currentFilterStatus !== 'todos') datos = datos.filter(s => s.estado === currentFilterStatus);
  if (busqueda) datos = datos.filter(s => s.numero.toLowerCase().includes(busqueda) || (s.cliente_placa && s.cliente_placa.toLowerCase().includes(busqueda)));

  if (datos.length === 0) {
      container.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400 flex flex-col items-center"><i class="fa-solid fa-map-location-dot text-4xl mb-2 opacity-20"></i><span>No se encontraron puestos</span></div>`;
      return;
  }

  datos.forEach(spot => {
    let meta = {}, ownerInfo = null;
    try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e){}
    try { ownerInfo = JSON.parse(spot.puesto_info || '{}'); } catch(e){}

    const isTempUser = !spot.cliente_id && meta.temp_user;
    const tieneLlave = meta.llave && meta.llave.tiene;
    const descLlave = meta.llave ? meta.llave.desc : "";
    
    let cardHTML = '';
    let borderClass = "border-slate-200";
    let bgClass = "bg-white";
    let badgeHTML = "";
    let footerActions = `
        <div class="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
            <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="text-[10px] text-slate-500 hover:text-slate-800 text-left">Editar N°</button>
            <button onclick="eliminarPuesto(${spot.id})" class="text-[10px] text-red-400 hover:text-red-600 text-right font-bold underline">Eliminar</button>
        </div>
    `;

    // --- 0. RESERVADO ---
    if (spot.estado === 'reservado') {
        borderClass = "border-purple-200"; bgClass = "bg-purple-50";
        badgeHTML = `<span class="bg-purple-200 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">RESERVADO</span>`;
        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-4 flex flex-col justify-between relative min-h-[160px] hover:shadow-md transition-shadow group">
                <div class="flex justify-between items-start">${badgeHTML}<span class="text-xl font-bold text-slate-700">${spot.numero}</span></div>
                <div class="my-2"><div class="text-sm font-bold text-slate-800 truncate">${spot.cliente_nombre || 'Reserva'}</div>${tieneLlave ? '<div class="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><i class="fa-solid fa-key"></i> Llave: '+descLlave+'</div>' : ''}</div>
                <div class="grid grid-cols-2 gap-2 mt-auto">
                    <button onclick="ocuparReserva(${spot.id})" class="bg-purple-600 hover:bg-purple-700 text-white py-1.5 rounded text-xs font-bold shadow-sm transition-colors">Ocupar</button>
                    <button onclick="liberar(${spot.id})" class="bg-white hover:bg-red-50 text-red-600 border border-red-200 py-1.5 rounded text-xs font-bold transition-colors">Cancelar</button>
                </div>
                ${footerActions}
            </div>`;
    }
    // --- 1. LIBRE (Dueño Fuera) ---
    else if (spot.estado === 'libre' && ownerInfo.nombre) {
        borderClass = "border-amber-200"; bgClass = "bg-amber-50";
        badgeHTML = `<span class="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">DUEÑO FUERA</span>`;
        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-4 flex flex-col justify-between relative min-h-[160px] hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start">${badgeHTML}<span class="text-xl font-bold text-slate-700">${spot.numero}</span></div>
                <div class="my-2 flex-1 flex flex-col justify-center"><div class="text-xs text-amber-700 font-medium text-center">Propietario:</div><div class="text-sm font-bold text-slate-800 truncate text-center">${ownerInfo.nombre}</div></div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button onclick="abrirModalNocturno()" class="bg-amber-500 hover:bg-amber-600 text-white py-1.5 rounded text-xs font-bold shadow-sm transition-colors">Nocturno</button>
                    <button onclick="restaurarDueno(${spot.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded text-xs font-bold shadow-sm transition-colors">Restaurar</button>
                </div>
                ${footerActions}
            </div>`;
    }
    // --- 2. LIBRE (Totalmente) ---
    else if (spot.estado === 'libre') {
        cardHTML = `
            <div class="${borderClass} ${bgClass} hover:border-emerald-400 rounded-xl p-4 flex flex-col items-center justify-between relative min-h-[160px] transition-all group">
                <div class="text-3xl font-bold mb-2 text-slate-600 group-hover:text-emerald-600 transition-colors">${spot.numero}</div>
                <div class="text-xs mb-4 text-slate-400">Disponible</div>
                <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="bg-emerald-600 hover:bg-emerald-700 text-white w-full py-2 rounded-lg text-xs font-bold shadow transition-colors">Asignar</button>
                ${footerActions}
            </div>`;
    }
    // --- 3. OCUPADO (Nocturno) ---
    else if (spot.estado === 'ocupado' && isTempUser) {
        borderClass = "border-amber-300"; bgClass = "bg-amber-100";
        badgeHTML = `<span class="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">NOCTURNO</span>`;
        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-4 flex flex-col justify-between relative min-h-[160px] shadow-sm border-2">
                <div class="flex justify-between items-start">${badgeHTML}<span class="text-xl font-bold text-slate-700">${spot.numero}</span></div>
                <div class="my-2">
                    <div class="font-bold text-sm text-slate-800 truncate">${meta.temp_user.nombre}</div>
                    <div class="font-mono text-[10px] bg-white px-1.5 inline-block rounded border border-slate-200 w-max mt-1">${meta.temp_user.placa}</div>
                    <div class="text-[10px] text-slate-500 mt-2 flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${calcularTiempo(spot.hora_inicio)}</div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="cobrarNocturno(${spot.id})" class="bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded text-[10px] font-bold transition-colors">Cobrar</button>
                    <button onclick="salirNocturno(${spot.id})" class="bg-white hover:bg-red-50 text-red-600 border border-red-200 py-1.5 rounded text-[10px] font-bold transition-colors">Salir</button>
                </div>
                <button onclick="limpiarPuesto(${spot.id})" class="mt-1 text-[10px] text-slate-400 hover:text-red-600 underline w-full">Limpiar Datos</button>
                ${footerActions}
            </div>`;
    }
    // --- 4. OCUPADO (Oficial) ---
    else if (spot.estado === 'ocupado') {
        borderClass = "border-indigo-200"; bgClass = "bg-indigo-50";
        badgeHTML = `<span class="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">OFICIAL</span>`;
        cardHTML = `
            <div class="${borderClass} ${bgClass} rounded-xl p-4 flex flex-col justify-between relative min-h-[160px] shadow-sm">
                <div class="flex justify-between items-start">${badgeHTML}<span class="text-xl font-bold text-slate-700">${spot.numero}</span></div>
                <div class="my-2">
                    <div class="font-bold text-sm text-slate-800 truncate">${spot.cliente_nombre || 'Desconocido'}</div>
                    <div class="font-mono text-[10px] bg-white px-1.5 inline-block rounded border border-slate-200 w-max mt-1">${spot.cliente_placa || '---'}</div>
                    <div class="text-[10px] text-slate-500 mt-2 flex items-center gap-1"><i class="fa-regular fa-clock"></i> ${calcularTiempo(spot.hora_inicio)}</div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="cobrar(${spot.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded text-[10px] font-bold transition-colors">Cobrar</button>
                    <button onclick="salir(${spot.id})" class="bg-white hover:bg-red-50 text-red-600 border border-red-200 py-1.5 rounded text-[10px] font-bold transition-colors">Salir</button>
                </div>
                <button onclick="limpiarPuesto(${spot.id})" class="mt-1 text-[10px] text-slate-400 hover:text-red-600 underline w-full">Limpiar Datos</button>
                ${footerActions}
            </div>`;
    }
    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// --- MODALES ---
function animarModalEntrada(modalId, contentId) {
    const modal = document.getElementById(modalId);
    const content = document.getElementById(contentId);
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    content.classList.remove('opacity-0', 'scale-95');
    content.classList.add('scale-100');
}

function animarModalSalida(modalId, contentId, callback) {
    const modal = document.getElementById(modalId);
    const content = document.getElementById(contentId);
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { 
        modal.classList.add('hidden'); 
        if(callback) callback();
    }, 200);
}

window.abrirModalCrearPuesto = function() {
    document.getElementById('inputNuevoNumero').value = '';
    animarModalEntrada('modalCrearPuesto', 'modalCrearPuestoContent');
    setTimeout(() => document.getElementById('inputNuevoNumero').focus(), 100);
};

window.cerrarModalCrearPuesto = function() {
    animarModalSalida('modalCrearPuesto', 'modalCrearPuestoContent');
};

window.confirmarCrearPuesto = async function() {
    const numero = document.getElementById('inputNuevoNumero').value.trim();
    if (!numero) return mostrarToast("Ingrese un número", "error");

    try {
        const res = await fetch("/api/puestos", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ numero }) 
        });
        const data = await res.json();
        if (data.success) { 
            mostrarToast("Puesto creado"); 
            cerrarModalCrearPuesto();
            cargarPuestos(); 
        } else { 
            mostrarToast(data.error || "Error", "error"); 
        }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

window.abrirModalNocturno = function() {
    const spotSelect = document.getElementById('nocturnoSpotSelect');
    const clientSelect = document.getElementById('nocturnoClientSelect');
    
    if(spotSelect) spotSelect.innerHTML = '<option value="">Seleccionar Puesto...</option>';
    if(clientSelect) clientSelect.innerHTML = '<option value="">Seleccionar Cliente (Opcional)...</option>';
    document.getElementById('nocturnoNombre').value = '';
    document.getElementById('nocturnoPlaca').value = '';
    
    if(spotSelect) {
        allSpots.forEach(s => {
            const owner = JSON.parse(s.puesto_info || '{}');
            if (s.estado === 'libre') {
                const opt = document.createElement("option");
                opt.value = s.id;
                opt.text = `${s.numero} ${owner.nombre ? '(Dueño: '+owner.nombre+')' : ''}`;
                spotSelect.add(opt);
            }
        });
    }

    if(clientSelect) {
        clientesCache.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.text = `${c.nombre} (${c.placa})`;
            clientSelect.add(opt);
        });
    }

    animarModalEntrada('modalNocturno', 'modalNocturnoContent');
};

window.cerrarModalNocturno = function() {
    animarModalSalida('modalNocturno', 'modalNocturnoContent');
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
            nameInput.readOnly = true;
            plateInput.readOnly = true;
        }
    } else {
        nameInput.value = '';
        plateInput.value = '';
        nameInput.readOnly = false;
        plateInput.readOnly = false;
    }
};

window.confirmarNocturno = async function() {
    const nombre = document.getElementById('nocturnoNombre').value;
    const placa = document.getElementById('nocturnoPlaca').value;
    const spotId = document.getElementById('nocturnoSpotSelect').value;
    const clientId = document.getElementById('nocturnoClientSelect').value;

    if (!nombre || !placa || !spotId) {
        alert("Complete todos los campos");
        return;
    }

    try {
        const res = await fetch("/api/puestos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                accion: "asignar_nocturno",
                temp_name: nombre,
                temp_plate: placa,
                spot_id_selected: spotId,
                cliente_id: clientId || null
            })
        });
        const data = await res.json();
        if (data.success) {
            cerrarModalNocturno();
            mostrarToast("Nocturno ingresado");
            cargarPuestos();
        } else {
            mostrarToast(data.error || "Error", "error");
        }
    } catch (e) {
        console.error(e);
        mostrarToast("Error de conexión", "error");
    }
};

window.abrirModalAsignar = async function(id, numero) {
    currentSpotId = id;
    await cargarClientesCache();

    document.getElementById('modalAsignarTitle').innerText = `Asignar #${numero}`;
    document.getElementById('divRegistered').classList.remove('hidden');
    document.getElementById('divManual').classList.add('hidden');
    document.querySelector('input[name="clientType"][value="registered"]').checked = true;
    
    const select = document.getElementById("modalClienteSelect");
    if(select) {
        select.innerHTML = '<option value="">-- Seleccione Cliente --</option>';
        clientesCache.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.text = `${c.nombre} (${c.placa})`;
            select.add(opt);
        });
    }
    animarModalEntrada('modalAsignar', 'modalAsignarContent');
};

window.cerrarModal = function() {
    animarModalSalida('modalAsignar', 'modalAsignarContent');
};

window.toggleModalInputs = function() {
    const type = document.querySelector('input[name="clientType"]:checked')?.value || 'manual';
    if (type === 'registered') {
        document.getElementById('divRegistered').classList.remove('hidden');
        document.getElementById('divManual').classList.add('hidden');
    } else {
        document.getElementById('divRegistered').classList.add('hidden');
        document.getElementById('divManual').classList.remove('hidden');
    }
};

window.toggleKeyInput = function() {
    const checked = document.getElementById('checkLlave').checked;
    const div = document.getElementById('keyDescDiv');
    if(checked) div.classList.remove('hidden');
    else div.classList.add('hidden');
};

window.confirmarAsignar = async function() {
    const type = document.querySelector('input[name="clientType"]:checked')?.value || 'manual';
    let bodyData = { id: currentSpotId };
    
    const checkLlave = document.getElementById('checkLlave');
    if(checkLlave && checkLlave.checked) {
        const descInput = document.getElementById('inputKeyDesc');
        const desc = descInput ? descInput.value.trim() : "Sin descripción";
        bodyData.llave_info = { tiene: true, desc: desc };
    }

    if (type === 'registered') {
        const select = document.getElementById('modalClienteSelect');
        const clienteId = select ? select.value : null;
        if (!clienteId) return mostrarToast("Seleccione un cliente", "error");
        bodyData.accion = "asignar_registrado";
        bodyData.cliente_id = clienteId;
    } else {
        const inputNombre = document.getElementById('inputNombre');
        const inputPlaca = document.getElementById('inputPlaca');
        const nombre = inputNombre ? inputNombre.value.trim() : "";
        const placa = inputPlaca ? inputPlaca.value.trim().toUpperCase() : "";
        if (!nombre || !placa) return mostrarToast("Complete los datos", "error");
        bodyData.accion = "asignar_nocturno";
        bodyData.temp_name = nombre;
        bodyData.temp_plate = placa;
    }

    try {
        const res = await fetch("/api/puestos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyData)
        });
        const data = await res.json();
        if (data.success) {
            cerrarModal();
            mostrarToast("Asignado");
            cargarPuestos();
        } else {
            mostrarToast(data.error || "Error", "error");
        }
    } catch (e) {
        console.error(e);
        mostrarToast("Error de conexión", "error");
    }
};

// --- ACCIONES ---

window.ocuparReserva = async function(id) {
    if(!confirm("¿Confirmar llegada y ocupar?")) return;
    const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "ocupar_reserva" }) });
    if(res.ok) { mostrarToast("Ocupado"); cargarPuestos(); }
};

// FUNCIÓN ELIMINAR PUESTO (Recuperada y Agregada)
window.eliminarPuesto = async function(id) {
    if(!confirm("¿ESTÁ SEGURO DE ELIMINAR ESTE PUESTO?\n\nEsta acción borrará el puesto definitivamente, esté o no ocupado.")) return;
    try {
        const res = await fetch(`/api/puestos?id=${id}`, { method: "DELETE" });
        if(res.ok) { 
            mostrarToast("Puesto eliminado"); 
            cargarPuestos(); 
        } else { 
            const data = await res.json();
            mostrarToast(data.error || "Error al eliminar", "error"); 
        }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
};

window.cobrar = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    
    let monto = spot.cuota_mensual;
    if (!monto || monto <= 0) {
        const clientData = clientesCache.find(c => c.placa === spot.cliente_placa);
        if (clientData) monto = clientData.cuota_mensual;
    }

    if (!monto || monto <= 0) {
        const inputMonto = prompt(`Cuota no definida. Valor:`, "0");
        if(inputMonto === null) return;
        monto = inputMonto;
    }
    if(!monto || monto <= 0) { alert("Monto inválido"); return; }

    const nombreEncoded = encodeURIComponent(spot.cliente_nombre || 'Cliente');
    const telefono = spot.cliente_telefono || '';
    const plate = spot.cliente_placa;
    const spotNum = spot.numero;
    const entry = spot.hora_inicio || Math.floor(Date.now()/1000);
    
    const url = `caja.html?plate=${plate}&spot=${spotNum}&client=${nombreEncoded}&phone=${telefono}&entry=${entry}&amount=${monto}&period=Mes`;
    
    window.location.href = url;
};

window.cobrarNocturno = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    const meta = JSON.parse(spot.llave_caracteristicas || '{}');
    
    const inputMonto = prompt("Valor a cobrar al nocturno:", "0");
    if(inputMonto === null) return;
    const monto = inputMonto;
    if(!monto || monto <= 0) return;

    if(!confirm(`¿Cobrar $${monto} a ${meta.temp_user.nombre}?`)) return;

    const nombreEncoded = encodeURIComponent(meta.temp_user.nombre);
    const plate = meta.temp_user.placa;
    const spotNum = spot.numero;
    const entry = spot.hora_inicio || Math.floor(Date.now()/1000);

    const url = `caja.html?plate=${plate}&spot=${spotNum}&client=${nombreEncoded}&phone=&entry=${entry}&amount=${monto}&period=Noche`;
    
    window.location.href = url;
};

window.salir = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if(!spot) return;
    const tiempoDetallado = calcularDetallesTiempo(spot.hora_inicio);
    
    if(!confirm(`¿REGISTRAR SALIDA Y GUARDAR DUEÑO?\n\nCliente: ${spot.cliente_nombre}\nTiempo: ${tiempoDetallado}\n\nEl puesto quedará libre.`)) return;

    try {
        const res = await fetch("/api/puestos", { 
            method: "PUT", 
            headers: {"Content-Type": "application/json"}, 
            body: JSON.stringify({ id, accion: "salida_oficial" }) 
        });
        if (res.ok) {
            mostrarToast("Salida registrada.");
            cargarPuestos();
        } else {
            mostrarToast("Error", "error");
        }
    } catch(e) { mostrarToast("Error", "error"); }
};

window.salirNocturno = async function(id) {
    if(!confirm("¿Salir del parqueo?")) return;
    try {
        const res = await fetch("/api/puestos", { 
            method: "PUT", 
            headers: {"Content-Type": "application/json"}, 
            body: JSON.stringify({ id, accion: "salida_nocturno" }) 
        });
        if (res.ok) {
            mostrarToast("Liberado");
            cargarPuestos();
        }
    } catch(e) { mostrarToast("Error", "error"); }
};

window.limpiarPuesto = async function(id) {
    if(!confirm("¿LIMPIAR TODO? Se borrará el dueño guardado.")) return;
    try {
        const res = await fetch(`/api/puestos?id=${id}`, { method: "PATCH" });
        if(res.ok) { 
            mostrarToast("Limpio"); 
            cargarPuestos(); 
        } else {
            mostrarToast("Error al limpiar", "error");
        }
    } catch(e) { mostrarToast("Error", "error"); }
};

window.restaurarDueno = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    const owner = JSON.parse(spot.puesto_info || '{}');
    if(!owner.nombre) return mostrarToast("Sin dueño", "error");
    if(!confirm(`¿Restaurar a ${owner.nombre}?`)) return;

    const res = await fetch("/api/puestos", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ id, accion: "restaurar_dueno" }) });
    if(res.ok) { mostrarToast("Restaurado"); cargarPuestos(); }
};

window.editarNumeroPuesto = async function(id, actual) {
    const nuevo = prompt("Nuevo número:", actual);
    if(!nuevo || nuevo === actual) return;
    alert("Función pendiente en API");
};