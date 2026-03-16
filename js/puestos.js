let allSpots = [];
let clientesCache = [];
let currentFilterStatus = 'todos'; 
let puestoSeleccionado = null;

// --- UTILIDADES ---
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

// --- HELPERS DE FECHA ---
function formatearFecha(isoStr) {
  if(!isoStr) return '';
  return new Date(isoStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function formatearFechaHora(isoStr) {
  if(!isoStr) return '';
  const fecha = new Date(isoStr);
  return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' ' + 
         fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// --- INICIO ---
document.addEventListener("DOMContentLoaded", () => {
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
    clientesCache = await res.json();
  } catch (e) { console.error("Error cargando clientes", e); }
}

// --- FILTROS ---
window.filtrarMapa = function(filtro) {
  currentFilterStatus = filtro;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if(btn.dataset.filter === filtro) {
      btn.classList.add('bg-slate-800', 'text-white');
      btn.classList.remove('bg-white', 'text-slate-600', 'border');
    } else {
      btn.classList.remove('bg-slate-800', 'text-white');
      btn.classList.add('bg-white', 'text-slate-600', 'border');
    }
  });
  renderMapa();
}

// --- DATA ---
async function cargarPuestos() {
  try {
    const res = await fetch("/api/puestos");
    if (!res.ok) throw new Error("Error API");
    allSpots = await res.json();
    
    allSpots.sort((a, b) => {
      const numA = parseInt(a.numero.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.numero.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
    
    const kpi = {
      libres: allSpots.filter(s => s.estado === 'libre').length,
      ocupados: allSpots.filter(s => s.estado === 'ocupado').length,
      reservados: allSpots.filter(s => s.estado === 'reservado').length,
      total: allSpots.length
    };
    
    if(document.getElementById('kpi-libres')) document.getElementById('kpi-libres').innerText = kpi.libres;
    if(document.getElementById('kpi-ocupados')) document.getElementById('kpi-ocupados').innerText = kpi.ocupados;
    if(document.getElementById('kpi-reservados')) document.getElementById('kpi-reservados').innerText = kpi.reservados;
    if(document.getElementById('totalCount')) document.getElementById('totalCount').innerText = kpi.total;

    renderMapa();
  } catch (error) { 
    console.error(error); 
    mostrarToast("Error cargando mapa", "error"); 
  }
}

// --- RENDERIZADO ---
function renderMapa(busquedaTerm = "") {
  const container = document.getElementById("map-container");
  if(!container) return;
  container.innerHTML = "";

  let datosFiltrados = allSpots;

  if (currentFilterStatus !== 'todos') {
    datosFiltrados = allSpots.filter(s => s.estado === currentFilterStatus);
  }

  if (busquedaTerm) {
    datosFiltrados = datosFiltrados.filter(s => 
      s.numero.toLowerCase().includes(busquedaTerm) || 
      (s.cliente_placa && s.cliente_placa.toLowerCase().includes(busquedaTerm))
    );
  }

  if (datosFiltrados.length === 0) {
    container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-slate-400 py-20"><i class="fa-solid fa-car-tunnel text-4xl mb-2"></i><p class="text-lg font-medium">No se encontraron puestos.</p></div>`;
    return;
  }

  datosFiltrados.forEach(spot => {
    // DETECTAR AUSENCIA
    let esAusencia = false;
    let infoAusencia = null;
    let hayPasajero = false;

    if (spot.llave_caracteristicas) {
      try {
        const parsed = JSON.parse(spot.llave_caracteristicas);
        if (parsed.tipo === 'ausencia') {
          esAusencia = true;
          infoAusencia = parsed;
          if(spot.estado === 'ocupado') hayPasajero = true; 
        }
      } catch(e) {}
    }

    let colorClass = "parking-card libre"; 
    let btnAction = '';
    let infoCliente = '<span class="text-slate-400 text-xs font-medium">Disponible</span>';
    
    // Botón de editar (siempre visible arriba derecha)
    const btnEditar = `<button onclick="event.stopPropagation(); editarPuesto(${spot.id}, '${spot.numero}')" class="absolute top-2 right-2 text-slate-400 hover:text-indigo-600 p-1.5 rounded-full hover:bg-white transition-colors z-10" title="Editar Puesto"><i class="fa-solid fa-pen-to-square text-sm"></i></button>`;

    if (esAusencia) {
      colorClass = "parking-card ausencia"; 
      infoCliente = `<div class="text-amber-600 font-bold text-xs"><i class="fa-regular fa-clock"></i> Ausencia</div><div class="text-[10px] text-slate-500">Regresa: ${formatearFecha(infoAusencia.fecha_regreso)}</div>`;
      if (hayPasajero) {
         infoCliente += `<div class="mt-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200 inline-block"><i class="fa-solid fa-user-secret"></i> Ocupado por Pasajero</div>`;
      }
      btnAction = `<button onclick="event.stopPropagation(); abrirModalEntrada(${spot.id}, true)" class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-xs shadow-sm">Asignar Pasajero</button>`;
    } else if (spot.estado === 'ocupado') {
      colorClass = "parking-card ocupado";
      
      // FECHA DE REGISTRO VISUAL
      const fechaRegistro = spot.fecha_registro ? formatearFechaHora(spot.fecha_registro) : '';
      
      infoCliente = `
        <div class="font-bold text-slate-700 text-sm truncate">${spot.cliente_nombre}</div>
        <div class="text-[10px] font-mono text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded inline-block border border-slate-200">${spot.cliente_placa || '---'}</div>
        ${fechaRegistro ? `<div class="text-[9px] text-slate-400 mt-1.5 flex items-center gap-1"><i class="fa-regular fa-calendar-check"></i> Entrada: ${fechaRegistro}</div>` : ''}
      `;
      btnAction = `<button onclick="event.stopPropagation(); abrirModalSalida(${spot.id}, ${spot.cliente_id})" class="w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded font-bold text-xs backdrop-blur-sm">Salir / Ausencia</button>`;
    } else if (spot.estado === 'reservado') {
      colorClass = "parking-card reservado";
      infoCliente = `<div class="font-bold text-slate-700 text-sm truncate">Reservado</div><div class="text-[10px] font-mono text-slate-500 uppercase">${spot.cliente_placa || '---'}</div>`;
      btnAction = `<button onclick="event.stopPropagation(); abrirModalEntrada(${spot.id}, false)" class="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded font-bold text-xs shadow-sm">Ingresar</button>`;
    } else {
      btnAction = `<button onclick="event.stopPropagation(); abrirModalEntrada(${spot.id}, false)" class="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-xs shadow-sm">Ingresar</button>`;
    }

    const card = document.createElement("div");
    card.className = colorClass;
    card.innerHTML = `
      <div class="relative flex-1 flex flex-col justify-between p-4">
        ${btnEditar}
        <div class="flex justify-between items-start">
          <div>
            <span class="text-xs font-bold uppercase text-slate-400 tracking-wider">Puesto</span>
            <h3 class="text-2xl font-bold text-slate-700">${spot.numero}</h3>
          </div>
          <div class="text-2xl opacity-40">
             ${esAusencia ? '<i class="fa-solid fa-clock text-amber-500"></i>' : (spot.estado === 'ocupado' ? '<i class="fa-solid fa-car-side"></i>' : '<i class="fa-solid fa-check"></i>')}
          </div>
        </div>
        <div class="mt-2 border-t border-slate-100 pt-2">${infoCliente}</div>
      </div>
      <div class="p-2 pt-0 mt-auto">${btnAction}</div>
    `;
    
    card.onclick = () => { if(!esAusencia && spot.estado === 'libre') abrirModalEntrada(spot.id, false); };
    container.appendChild(card);
  });
}

// --- FUNCIONES DE GESTIÓN (Editar / Eliminar) ---

window.editarPuesto = function(id, numeroActual) {
  const nuevoNumero = prompt("Editar número de puesto:", numeroActual);
  if (!nuevoNumero || nuevoNumero === numeroActual) return;
  
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "editar_numero", nuevo_numero: nuevoNumero })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      mostrarToast("Puesto actualizado");
      cargarPuestos();
    } else {
      alert("Error: " + (data.error || "Desconocido"));
    }
  })
  .catch(e => mostrarToast("Error de conexión", "error"));
};

window.eliminarPuesto = function(id) {
  if (!confirm("¿Estás seguro de ELIMINAR este puesto?\n\nEsta acción borrará el puesto y no se puede deshacer.")) return;
  
  fetch(`/api/puestos?id=${id}`, { method: "DELETE" })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      mostrarToast("Puesto eliminado");
      cargarPuestos();
    } else {
      mostrarToast("Error al eliminar", "error");
    }
  })
  .catch(e => mostrarToast("Error de conexión", "error"));
};

// --- MODALES Y ASIGNACIÓN ---

window.abrirModalEntrada = function(id, esPasajero) {
  puestoSeleccionado = allSpots.find(s => s.id === id);
  if(!puestoSeleccionado) return;

  document.getElementById("modalSpotNumber").innerText = esPasajero ? "Asignar Pasajero" : "Puesto #" + puestoSeleccionado.numero;
  document.getElementById("modalNombre").value = '';
  document.getElementById("modalPlaca").value = '';
  document.getElementById("modalTipo").value = 'Carro';

  const modal = document.getElementById("modalAsignar");
  const content = document.getElementById("modalContent");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => {
    content.classList.remove("scale-95", "opacity-0");
    content.classList.add("scale-100", "opacity-100");
  }, 10);
}

window.filtrarClientesModal = function() {
  const query = document.getElementById("modalNombre").value.toLowerCase();
  const lista = document.getElementById("listaResultadosClientes");
  lista.innerHTML = '';
  
  if (query.length < 1) { lista.classList.add('hidden'); return; }

  const filtrados = clientesCache.filter(c => c.nombre.toLowerCase().includes(query) || c.placa.toLowerCase().includes(query));
  
  if (filtrados.length > 0) {
    filtrados.forEach(c => {
      const div = document.createElement("div");
      div.className = "p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 flex justify-between";
      div.innerHTML = `<span class="font-medium text-sm">${c.nombre}</span> <span class="text-xs text-slate-500">${c.placa}</span>`;
      div.onclick = () => seleccionarClienteModal(c);
      lista.appendChild(div);
    });
    lista.classList.remove('hidden');
  } else {
    lista.classList.add('hidden');
  }
}

window.seleccionarClienteModal = function(cliente) {
  document.getElementById("modalNombre").value = cliente.nombre;
  document.getElementById("modalPlaca").value = cliente.placa;
  document.getElementById("modalTipo").value = cliente.tipo_vehiculo;
  document.getElementById("listaResultadosClientes").classList.add('hidden');
}

window.abrirModalSalida = function(id, clienteId) {
  if (!confirm("¿El cliente se va por varios días? (Ausencia Temporal)\n\nSi solo se va definitivamente, cancele y use la opción del menú.")) return;
  
  const fecha = prompt("Fecha de regreso (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
  if (!fecha) return;

  procesarSalidaTemporal(id, fecha);
}

window.liberarPuesto = async function(id) {
  if (!confirm("¿Dar salida definitiva y liberar puesto?")) return;
  try {
    const res = await fetch("/api/puestos?id=" + id, { method: "PATCH" });
    if (res.ok) {
      mostrarToast("Puesto liberado");
      cargarPuestos();
    }
  } catch (e) { mostrarToast("Error", "error"); }
}

async function procesarSalidaTemporal(id, fecha) {
  try {
    const res = await fetch("/api/puestos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id,
        accion: "salida_temporal",
        fecha_regreso: fecha
      })
    });
    const data = await res.json();
    if (data.success) {
      mostrarToast("Ausencia activada. Puesto libre.");
      cargarPuestos();
    } else {
      mostrarToast("Error: " + (data.error || "Desconocido"), "error");
    }
  } catch (e) {
    console.error(e);
    mostrarToast("Error de conexión", "error");
  }
}

window.confirmarAsignar = async function() {
  const nombre = document.getElementById("modalNombre").value.trim();
  const placa = document.getElementById("modalPlaca").value.trim().toUpperCase();
  const tipo = document.getElementById("modalTipo").value;
  
  if (!nombre || !placa) {
    mostrarToast("Nombre y Placa son obligatorios", "error");
    return;
  }

  try {
    // 1. Crear/Buscar Cliente
    const resCliente = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, placa, tipo_vehiculo: tipo })
    });
    const dataCliente = await resCliente.json();

    let clienteId = dataCliente.id; 
    if (!clienteId) {
       const clientes = await (await fetch("/api/clientes")).json();
       const encontrado = clientes.find(c => c.placa === placa);
       if(encontrado) clienteId = encontrado.id;
    }

    if (!clienteId) return mostrarToast("Error obteniendo ID cliente", "error");

    // --- PERSISTENCIA DE AUSENCIA ---
    let llavePayload = null;

    if (puestoSeleccionado.llave_caracteristicas) {
      try {
        const infoActual = JSON.parse(puestoSeleccionado.llave_caracteristicas);
        // Si hay ausencia activa, la mantenemos en la llave para no borrarla
        if (infoActual.tipo === 'ausencia') {
          llavePayload = puestoSeleccionado.llave_caracteristicas; 
        }
      } catch(e) {}
    }

    // 2. Asignar Puesto
    const resPuesto = await fetch("/api/puestos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id: puestoSeleccionado.id, 
        cliente_id: clienteId, 
        estado: 'ocupado',
        llave: llavePayload
      })
    });

    if (resPuesto.ok) {
      mostrarToast("Vehículo asignado");
      cerrarModalAsignar();
      cargarPuestos();
    } else {
      mostrarToast("Error asignando puesto", "error");
    }
  } catch (e) {
    console.error(e);
    mostrarToast("Error de conexión", "error");
  }
}

window.cerrarModalAsignar = function() {
  const modal = document.getElementById("modalAsignar");
  const content = document.getElementById("modalContent");
  content.classList.add("scale-95", "opacity-0");
  content.classList.remove("scale-100", "opacity-100");
  setTimeout(() => { modal.classList.add("hidden"); modal.classList.remove("flex"); }, 200);
}

window.crearPuestoRapido = async function() {
  const numero = prompt("Número del nuevo puesto:");
  if (!numero) return; 
  try {
    const res = await fetch("/api/puestos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero }) });
    const data = await res.json();
    if (data.success) {
      mostrarToast("Puesto creado");
      cargarPuestos();
    } else {
      mostrarToast("Error: " + (data.error || "Desconocido"), "error");
    }
  } catch (e) { mostrarToast("Error", "error"); }
}

// --- REGRESOS ---
window.gestionarRegresos = function() {
  const puestosAusencia = allSpots.filter(s => {
    if (!s.llave_caracteristicas) return false;
    try { return JSON.parse(s.llave_caracteristicas).tipo === 'ausencia'; } catch(e) { return false; }
  });

  if (puestosAusencia.length === 0) return alert("No hay ausencias activas.");

  let msg = "Seleccione ID de puesto para REGRESO:\n\n";
  puestosAusencia.forEach(p => {
    const info = JSON.parse(p.llave_caracteristicas);
    msg += `${p.id}. Puesto #${p.numero} (Regresa: ${info.fecha_regreso})\n`;
  });
  
  const sel = prompt(msg);
  if (sel) procesarRegreso(sel);
}

async function procesarRegreso(puestoId) {
  if(!confirm("¿Restaurar cliente dueño y desalojar pasajero?")) return;
  
  const spot = allSpots.find(s => s.id == puestoId);
  if(!spot) return;
  const info = JSON.parse(spot.llave_caracteristicas);
  const clienteOriginalId = info.cliente_id_original;

  try {
    const res = await fetch("/api/puestos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: puestoId,
        cliente_id: clienteOriginalId,
        estado: 'ocupado',
        llave: null 
      })
    });

    if (res.ok) {
      mostrarToast("Cliente restaurado correctamente");
      cargarPuestos();
    }
  } catch (e) { mostrarToast("Error en regreso", "error"); }
}