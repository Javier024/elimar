// =============================
// VARIABLES
// =============================
let allSpots = [];
let allClients = [];
let currentPage = 1;
const itemsPerPage = 5;

// =============================
// UTILIDADES
// =============================
function mostrarToast(mensaje, tipo = 'success') {
  const toastExistente = document.getElementById('custom-toast');
  if (toastExistente) toastExistente.remove();

  const toast = document.createElement('div');
  toast.id = 'custom-toast';
  
  const colores = tipo === 'error' 
    ? 'bg-red-50 text-red-800 border-red-200' 
    : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  
  const icono = tipo === 'error' 
    ? '<i class="fa-solid fa-circle-exclamation"></i>' 
    : '<i class="fa-solid fa-circle-check"></i>';

  toast.className = `fixed top-5 right-5 z-[60] flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border ${colores} transform transition-all duration-300 translate-x-full opacity-0 max-w-sm`;
  toast.innerHTML = `<span class="text-lg shrink-0">${icono}</span><span class="font-medium text-sm">${mensaje}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Convertir Timestamp numérico a HH:MM:SS
function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second:'2-digit' });
}

// =============================
// INICIO
// =============================
document.addEventListener("DOMContentLoaded", () => {
  cargarPuestos();
  cargarClientesParaSelect();
});

// =============================
// CARGAR DATOS
// =============================
async function cargarPuestos() {
  try {
    const res = await fetch("/api/puestos");
    if (!res.ok) throw new Error("Error al cargar puestos");
    allSpots = await res.json();
    allSpots.sort((a, b) => a.id - b.id); // Orden lógico
    currentPage = 1;
    renderTable();
  } catch (error) {
    console.error(error);
    mostrarToast("Error cargando puestos", "error");
  }
}

async function cargarClientesParaSelect() {
  try {
    const res = await fetch("/api/clientes");
    allClients = await res.json();
  } catch (error) {
    console.error("Error cargando clientes", error);
  }
}

// =============================
// RENDER TABLA
// =============================
function renderTable() {
  const tbody = document.getElementById("tableBody");
  const countSpan = document.getElementById("totalCount");
  tbody.innerHTML = "";

  if (allSpots.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">No hay puestos registrados.</td></tr>`;
    countSpan.innerText = "0";
    updatePaginationControls();
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = allSpots.slice(startIndex, endIndex);

  countSpan.innerText = allSpots.length;

  pageData.forEach(spot => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group";

    const isOcupado = spot.estado === 'ocupado';
    
    // DISEÑO ESPECÍFICO PARQUEADERO
    // Libre: Verde brillante, Ocupado: Rojo intenso
    const statusClass = isOcupado 
      ? 'bg-rose-100 text-rose-700 border-rose-200' 
      : 'bg-emerald-100 text-emerald-700 border-emerald-200';
    
    const statusIcon = isOcupado ? 'fa-car-side' : 'fa-square-check';

    // Info del Cliente
    let clienteDisplay = '-';
    let iconoVehiculo = '';
    
    if (isOcupado) {
      const nombre = spot.cliente_nombre || 'Desconocido';
      const placa = spot.cliente_placa || '';
      const tipo = spot.cliente_tipo || 'Carro';
      
      // Icono según el tipo del cliente
      if(tipo === 'Moto') iconoVehiculo = '<i class="fa-solid fa-motorcycle text-xs mr-1 opacity-70"></i>';
      else if(tipo === 'Camioneta') iconoVehiculo = '<i class="fa-solid fa-truck-pickup text-xs mr-1 opacity-70"></i>';
      else iconoVehiculo = '<i class="fa-solid fa-car text-xs mr-1 opacity-70"></i>';

      clienteDisplay = `
        <div class="flex flex-col">
          <span class="font-medium text-slate-700">${iconoVehiculo} ${nombre}</span>
          <span class="text-[10px] text-slate-400 font-mono">${placa}</span>
        </div>
      `;
    }

    // Hora (formateada desde numérico)
    const horaDisplay = formatTime(spot.hora_inicio);

    // Botones
    const actionBtn = isOcupado
      ? `<button onclick="liberarPuesto(${spot.id})" class="text-amber-600 hover:text-amber-700 hover:bg-amber-50 p-2 rounded-lg transition-all border border-transparent hover:border-amber-100" title="Liberar / Cobrar"><i class="fa-solid fa-file-invoice-dollar"></i></button>`
      : `<button onclick="abrirModalOcupar(${spot.id})" class="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-2 rounded-lg transition-all border border-transparent hover:border-emerald-100" title="Asignar Vehículo"><i class="fa-solid fa-key"></i></button>`;

    tr.innerHTML = `
      <td class="px-6 py-4 font-mono text-slate-500 font-bold tracking-widest" data-label="Puesto">
        #${spot.numero}
      </td>
      <td class="px-6 py-4" data-label="Estado">
        <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${statusClass} shadow-sm">
          <i class="fa-solid ${statusIcon}"></i> ${spot.estado}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-slate-600" data-label="Cliente">
        ${clienteDisplay}
      </td>
      <td class="px-6 py-4 text-sm font-mono text-slate-500" data-label="Entrada">
        <span class="bg-slate-100 px-2 py-1 rounded text-slate-600">${horaDisplay}</span>
      </td>
      <td class="px-6 py-4 text-right" data-label="Acciones">
        <div class="flex items-center justify-end gap-2">
          ${actionBtn}
          <button onclick="eliminarPuesto(${spot.id})" class="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all" title="Eliminar Puesto"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationControls();
}

// =============================
// PAGINACIÓN
// =============================
function updatePaginationControls() {
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const pageInfo = document.getElementById("pageInfo");
  const totalPages = Math.ceil(allSpots.length / itemsPerPage);

  pageInfo.innerText = `Página ${currentPage} de ${totalPages || 1}`;
  btnPrev.disabled = currentPage === 1;
  btnNext.disabled = currentPage === totalPages || totalPages === 0;

  if (btnPrev.disabled) btnPrev.classList.add("opacity-50", "cursor-not-allowed");
  else btnPrev.classList.remove("opacity-50", "cursor-not-allowed");

  if (btnNext.disabled) btnNext.classList.add("opacity-50", "cursor-not-allowed");
  else btnNext.classList.remove("opacity-50", "cursor-not-allowed");
}

window.changePage = function(direction) {
  const totalPages = Math.ceil(allSpots.length / itemsPerPage);
  if (direction === 'prev' && currentPage > 1) currentPage--;
  else if (direction === 'next' && currentPage < totalPages) currentPage++;
  renderTable();
};

// =============================
// ACCIONES CRUD
// =============================
window.crearPuesto = async function() {
  const numero = document.getElementById("numeroPuesto").value.trim();
  if (!numero) return mostrarToast("Ingrese un número", "error");

  try {
    const res = await fetch("/api/puestos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero })
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById("numeroPuesto").value = "";
      cargarPuestos();
      mostrarToast("Puesto agregado al mapa");
    } else {
      mostrarToast(data.error, "error");
    }
  } catch (error) {
    mostrarToast("Error de conexión", "error");
  }
}

let puestoAOcuparId = null;

window.abrirModalOcupar = function(id) {
  puestoAOcuparId = id;
  const select = document.getElementById("clienteSelect");
  select.innerHTML = '<option value="">-- Seleccione cliente --</option>';
  
  allClients.forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.text = `${c.nombre} - ${c.placa} (${c.tipo_vehiculo})`;
    select.appendChild(option);
  });

  const modal = document.getElementById("modalOcupar");
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.firstElementChild.classList.remove("scale-95", "opacity-0");
    modal.firstElementChild.classList.add("scale-100", "opacity-100");
  }, 10);
}

window.confirmarOcupar = async function() {
  const clienteId = document.getElementById("clienteSelect").value;
  if (!clienteId) return mostrarToast("Seleccione cliente", "error");

  try {
    const res = await fetch("/api/puestos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puestoAOcuparId, cliente_id: clienteId })
    });

    const data = await res.json();
    if (data.success) {
      cerrarModalOcupar();
      cargarPuestos();
      mostrarToast("Vehículo estacionado");
    }
  } catch (e) { mostrarToast("Error", "error"); }
}

window.cerrarModalOcupar = function() {
  const modal = document.getElementById("modalOcupar");
  modal.firstElementChild.classList.remove("scale-100", "opacity-100");
  modal.firstElementChild.classList.add("scale-95", "opacity-0");
  setTimeout(() => modal.classList.add("hidden"), 200);
}

window.liberarPuesto = async function(id) {
  if (!confirm("¿Liberar puesto?")) return;
  try {
    await fetch("/api/puestos?id=" + id, { method: "PATCH" });
    cargarPuestos();
    mostrarToast("Puesto liberado");
  } catch (e) { mostrarToast("Error", "error"); }
}

window.eliminarPuesto = async function(id) {
  if (!confirm("¿Eliminar puesto?")) return;
  try {
    await fetch("/api/puestos?id=" + id, { method: "DELETE" });
    
    const totalPages = Math.ceil(allSpots.length / itemsPerPage);
    if (currentPage === totalPages && (allSpots.length - 1) % itemsPerPage === 0 && currentPage > 1) {
      currentPage--;
    }
    cargarPuestos();
    mostrarToast("Puesto eliminado");
  } catch (e) { mostrarToast("Error", "error"); }
}

window.toggleMenu = function() {
  document.getElementById('mobileMenu').classList.toggle('hidden');
}