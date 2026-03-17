let allSpots = [];
let clientesCache = [];
let currentFilterStatus = 'todos'; // Estado inicial: ver todo
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

// --- INICIO ---
document.addEventListener("DOMContentLoaded", () => {
  cargarPuestos();
  cargarClientesCache();
  
  const searchInput = document.getElementById("searchInput");
  if(searchInput) {
    searchInput.addEventListener("input", (e) => renderMapa(e.target.value.toLowerCase()));
  }
});

async function cargarClientesCache() {
  try {
    const res = await fetch("/api/clientes");
    if(res.ok) {
      clientesCache = await res.json();
    }
  } catch (e) { console.error("Error cargando clientes", e); }
}

// --- LÓGICA DE FILTROS (NUEVO) ---
window.filtrarMapa = function(filtro) {
  currentFilterStatus = filtro; // 1. Actualizar estado global
  
  // 2. Actualizar estilos de los botones
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if(btn.dataset.filter === filtro) {
      btn.classList.add('bg-slate-800', 'text-white'); // Activo (Oscuro)
      btn.classList.remove('bg-white', 'text-slate-600', 'border');
    } else {
      btn.classList.remove('bg-slate-800', 'text-white'); // Inactivo (Claro)
      btn.classList.add('bg-white', 'text-slate-600', 'border');
    }
  });
  
  // 3. Redibujar mapa con el nuevo filtro
  renderMapa(document.getElementById("searchInput").value.toLowerCase());
}

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
      total: allSpots.length
    };
    
    if(document.getElementById('kpi-libres')) document.getElementById('kpi-libres').innerText = kpi.libres;
    if(document.getElementById('kpi-ocupados')) document.getElementById('kpi-ocupados').innerText = kpi.ocupados;
    if(document.getElementById('totalCount')) document.getElementById('totalCount').innerText = kpi.total;

    renderMapa();
  } catch (error) { 
    console.error(error); 
    mostrarToast("Error cargando mapa", "error"); 
  }
}

// --- RENDERIZADO CON FILTROS ---
function renderMapa(busquedaTerm = "") {
  const container = document.getElementById("map-container");
  if(!container) return;
  container.innerHTML = "";

  // 1. Empezamos con todos los puestos
  let datosFiltrados = allSpots;

  // 2. Aplicar filtro de ESTADO (Botones)
  if (currentFilterStatus !== 'todos') {
    datosFiltrados = allSpots.filter(s => s.estado === currentFilterStatus);
  }

  // 3. Aplicar filtro de BÚSQUEDA (Input de texto)
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
    // Determinar estilo según estado
    let colorClass = "parking-card libre"; 
    let infoCliente = '<span class="text-slate-400 text-xs font-medium">Disponible</span>';
    let accionHTML = '';
    
    if (spot.estado === 'ocupado') {
      colorClass = "parking-card ocupado";
      infoCliente = `
        <div class="font-bold text-slate-700 text-sm truncate">${spot.cliente_nombre}</div>
        <div class="text-[10px] font-mono text-slate-500 uppercase bg-indigo-50 px-1.5 py-0.5 rounded inline-block border border-indigo-100 text-indigo-700">${spot.cliente_placa || '---'}</div>
      `;
      accionHTML = `<button onclick="liberarPuesto(${spot.id})" class="w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded font-bold text-xs backdrop-blur-sm border border-white/30">Liberar / Salir</button>`;
    } else if (spot.estado === 'reservado') {
      colorClass = "parking-card reservado";
      infoCliente = `<div class="font-bold text-slate-700 text-sm truncate">Reservado</div>`;
      accionHTML = `<button class="w-full py-2 bg-purple-100 text-purple-700 rounded font-bold text-xs">Ocupar Reserva</button>`;
    } else {
      accionHTML = `<button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-xs shadow-sm">Asignar Vehículo</button>`;
    }

    const card = document.createElement("div");
    card.className = `bg-white rounded-xl shadow-sm p-0 flex flex-col h-full ${colorClass}`;
    card.innerHTML = `
      <div class="relative flex-1 flex flex-col justify-between p-4">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Puesto</span>
            <h3 class="text-2xl font-bold text-slate-700">${spot.numero}</h3>
          </div>
          <div class="text-2xl opacity-20">
             ${spot.estado === 'ocupado' ? '<i class="fa-solid fa-car-side text-indigo-500"></i>' : (spot.estado === 'reservado' ? '<i class="fa-solid fa-lock text-purple-500"></i>' : '<i class="fa-solid fa-check text-emerald-500"></i>')}
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-100/50">${infoCliente}</div>
      </div>
      <div class="p-2 pt-0 mt-auto">${accionHTML}</div>
    `;
    
    container.appendChild(card);
  });
}

// --- MODAL ---
window.abrirModalAsignar = function(id, numero) {
  puestoSeleccionado = allSpots.find(s => s.id === id);
  document.getElementById("modalNombre").value = '';
  document.getElementById("modalPlaca").value = '';
  document.getElementById("modalTipo").value = '';
  document.getElementById("listaResultadosClientes").classList.add('hidden');
  document.getElementById("modalSpotNumber").innerText = "Asignar a Puesto #" + numero;

  const modal = document.getElementById("modalAsignar");
  const content = document.getElementById("modalContent");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  
  setTimeout(() => {
    content.classList.remove("scale-95", "opacity-0");
    content.classList.add("scale-100", "opacity-100");
  }, 10);
}

window.buscarClienteModal = function() {
  const query = document.getElementById("modalNombre").value.toLowerCase();
  const lista = document.getElementById("listaResultadosClientes");
  lista.innerHTML = '';
  
  if (query.length < 2) { lista.classList.add('hidden'); return; }

  const filtrados = clientesCache.filter(c => 
    c.nombre.toLowerCase().includes(query) || 
    c.placa.toLowerCase().includes(query)
  );
  
  if (filtrados.length > 0) {
    filtrados.forEach(c => {
      const div = document.createElement("div");
      div.className = "p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 flex justify-between transition-colors";
      div.innerHTML = `<span class="font-medium text-sm text-slate-700">${c.nombre}</span> <span class="text-xs text-slate-500 font-mono">${c.placa}</span>`;
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
  document.getElementById("modalTipo").value = cliente.tipo_vehiculo || 'Carro';
  document.getElementById("listaResultadosClientes").classList.add('hidden');
  puestoSeleccionado.clienteData = cliente;
}

window.cerrarModalAsignar = function() {
  const modal = document.getElementById("modalAsignar");
  const content = document.getElementById("modalContent");
  content.classList.add("scale-95", "opacity-0");
  content.classList.remove("scale-100", "opacity-100");
  setTimeout(() => { modal.classList.add("hidden"); modal.classList.remove("flex"); }, 200);
}

window.confirmarAsignar = async function() {
  const nombreInput = document.getElementById("modalNombre").value.trim();
  const placa = document.getElementById("modalPlaca").value;
  
  if (!nombreInput || !placa) {
    mostrarToast("Debe seleccionar o ingresar un cliente", "error");
    return;
  }

  try {
    let clienteId = null;

    if (puestoSeleccionado.clienteData) {
      clienteId = puestoSeleccionado.clienteData.id;
    } else {
      const resCliente = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nombre: nombreInput, 
          placa: placa, 
          tipo: document.getElementById("modalTipo").value || 'Carro',
          telefono: '' 
        })
      });
      const dataCliente = await resCliente.json();
      if (dataCliente.success && dataCliente.id) {
        clienteId = dataCliente.id;
      } else {
        const todosClientes = await fetch("/api/clientes").then(r => r.json());
        const nuevo = todosClientes.find(c => c.placa === placa);
        if(nuevo) clienteId = nuevo.id;
      }
    }

    if (!clienteId) {
      mostrarToast("Error: No se pudo identificar al cliente", "error");
      return;
    }

    const resPuesto = await fetch("/api/puestos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id: puestoSeleccionado.id, 
        cliente_id: clienteId, 
        estado: 'ocupado'
      })
    });

    if (resPuesto.ok) {
      mostrarToast("Vehículo asignado correctamente");
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

window.liberarPuesto = async function(id) {
  if (!confirm("¿Confirmar salida y liberar puesto?")) return;
  try {
    const res = await fetch("/api/puestos?id=" + id, { method: "PATCH" });
    if (res.ok) {
      mostrarToast("Puesto liberado");
      cargarPuestos();
    }
  } catch (e) { mostrarToast("Error al liberar", "error"); }
}

window.crearPuestoRapido = async function() {
  const numero = prompt("Número del nuevo puesto:");
  if (!numero) return; 
  
  try {
    const res = await fetch("/api/puestos", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ numero }) 
    });
    const data = await res.json();
    if (data.success) {
      mostrarToast("Puesto creado");
      cargarPuestos();
    } else {
      mostrarToast("Error: " + (data.error || "Desconocido"), "error");
    }
  } catch (e) { mostrarToast("Error", "error"); }
}