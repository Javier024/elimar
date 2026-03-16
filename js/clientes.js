// =============================
// ESTADO GLOBAL
// =============================
let allClients = [];     // Almacena TODOS los clientes cargados
let currentPage = 1;     // Página actual
const itemsPerPage = 5;  // Clientes por página
let currentFilter = "";  // Texto de búsqueda actual

// =============================
// UTILIDADES
// =============================
function mostrarToast(mensaje, tipo = 'success') {
  const toastExistente = document.getElementById('custom-toast');
  if (toastExistente) toastExistente.remove();

  const toast = document.createElement('div');
  toast.id = 'custom-toast';
  const colores = tipo === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  const icono = tipo === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';

  toast.className = `fixed top-5 right-5 z-[60] flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border ${colores} transform transition-all duration-300 translate-x-full opacity-0`;
  toast.innerHTML = `<span class="text-lg">${icono}</span><span class="font-medium text-sm">${mensaje}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =============================
// CARGAR DATOS INICIALES
// =============================
async function cargarClientes() {
  try {
    const res = await fetch("/api/clientes");
    const clientes = await res.json();
    
    // Guardar en variable global
    allClients = clientes;
    
    // Resetear filtros y paginación
    currentFilter = "";
    document.getElementById("searchInput").value = "";
    currentPage = 1;

    // Renderizar tabla inicial
    renderizarTabla();
  } catch (error) {
    console.error("Error cargando clientes:", error);
    mostrarToast("Error al cargar la lista", "error");
  }
}

// =============================
// RENDERIZAR TABLA (Con Paginación)
// =============================
function renderizarTabla() {
  const tbody = document.getElementById("listaClientesBody");
  tbody.innerHTML = "";

  // 1. Filtrar datos
  let datosFiltrados = allClients.filter(c => {
    const term = currentFilter.toLowerCase();
    return c.nombre.toLowerCase().includes(term) || 
           c.placa.toLowerCase().includes(term) ||
           (c.telefono && c.telefono.includes(term));
  });

  // 2. Actualizar contador total
  document.getElementById("totalCount").innerText = datosFiltrados.length;

  // 3. Calcular paginación
  const totalPages = Math.ceil(datosFiltrados.length / itemsPerPage) || 1;
  
  // Asegurar que la página actual sea válida
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  // Actualizar UI de paginación
  document.getElementById("currentPage").innerText = currentPage;
  document.getElementById("totalPages").innerText = totalPages;
  document.getElementById("btnPrev").disabled = currentPage === 1;
  document.getElementById("btnNext").disabled = currentPage === totalPages;

  // 4. Cortar array para la página actual
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageData = datosFiltrados.slice(start, end);

  // 5. Dibujar filas
  if (pageData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-8 text-center text-slate-400">
          <i class="fa-regular fa-folder-open text-3xl mb-2"></i>
          <p>No se encontraron resultados.</p>
        </td>
      </tr>`;
    return;
  }

  pageData.forEach(cliente => {
    let iconoVehiculo = 'fa-car';
    let colorVehiculo = 'text-blue-600 bg-blue-50';
    
    if(cliente.tipo_vehiculo === 'Moto') {
      iconoVehiculo = 'fa-motorcycle';
      colorVehiculo = 'text-amber-600 bg-amber-50';
    } else if (cliente.tipo_vehiculo === 'Camioneta') {
      iconoVehiculo = 'fa-truck-pickup';
      colorVehiculo = 'text-purple-600 bg-purple-50';
    }

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0";
    
    tr.innerHTML = `
      <td class="px-6 py-4">
        <div class="font-medium text-slate-700">${cliente.nombre}</div>
      </td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${colorVehiculo}">
          <i class="fa-solid ${iconoVehiculo}"></i> ${cliente.tipo_vehiculo}
        </span>
      </td>
      <td class="px-6 py-4 font-mono text-slate-600 text-sm tracking-wide">${cliente.placa}</td>
      <td class="px-6 py-4 text-slate-500 text-sm">${cliente.telefono || '-'}</td>
      <td class="px-6 py-4 text-right">
        <button onclick="editarCliente(${cliente.id})" 
          class="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-2 rounded-lg transition-all mr-2" title="Editar">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="eliminarCliente(${cliente.id})" 
          class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition-all" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =============================
// EVENTOS DE BUSQUEDA Y PAGINACIÓN
// =============================
document.getElementById("searchInput").addEventListener("input", (e) => {
  currentFilter = e.target.value;
  currentPage = 1; // Volver a la página 1 al buscar
  renderizarTabla();
});

window.changePage = function(direction) {
  currentPage += direction;
  renderizarTabla();
}

// =============================
// GUARDAR CLIENTE
// =============================
window.guardarCliente = async function() {
  const nombre = document.getElementById("nombre").value;
  const telefono = document.getElementById("telefono").value;
  const placa = document.getElementById("placa").value;
  const tipo = document.getElementById("vehiculo").value;

  try {
    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, telefono, placa, tipo })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("formCliente").reset();
      cargarClientes(); // Recargar todo
      mostrarToast("Cliente registrado correctamente");
    } else {
      mostrarToast(data.error || "Error al guardar", "error");
    }
  } catch (error) {
    console.error("Error guardando cliente:", error);
    mostrarToast("Error de conexión", "error");
  }
}

// =============================
// ELIMINAR CLIENTE
// =============================
window.eliminarCliente = async function(id) {
  if (!confirm("¿Estás seguro de que deseas eliminar este cliente?")) return;

  try {
    const res = await fetch("/api/clientes?id=" + id, { method: "DELETE" });
    const data = await res.json();

    if (data.success) {
      cargarClientes(); // Recargar todo
      mostrarToast("Cliente eliminado");
    } else {
      mostrarToast("Error al eliminar", "error");
    }
  } catch (error) {
    console.error("Error eliminando:", error);
    mostrarToast("Error de conexión", "error");
  }
}

// =============================
// EDITAR CLIENTE (SOLUCIONADO)
// =============================
window.editarCliente = function(id) {
  // 1. Buscar el cliente en la lista global
  const cliente = allClients.find(c => c.id === id);
  
  if (!cliente) {
    mostrarToast("Error: Cliente no encontrado", "error");
    return;
  }

  // 2. Llenar el modal con los datos
  document.getElementById("editId").value = cliente.id;
  document.getElementById("editNombre").value = cliente.nombre;
  document.getElementById("editTelefono").value = cliente.telefono || "";
  document.getElementById("editPlaca").value = cliente.placa;
  document.getElementById("editVehiculo").value = cliente.tipo_vehiculo || "Carro";

  // 3. FORZAR APERTURA DEL MODAL (Corrección del bloqueo)
  const modal = document.getElementById("modalEdit");
  const modalContent = document.getElementById("modalContent");

  // Forzamos display flex para asegurar que se muestre
  modal.style.display = "flex";
  modal.classList.remove("hidden");
  
  // Forzamos el contenido a ser visible inmediatamente
  // Usamos requestAnimationFrame para asegurar que el navegador procese el cambio
  requestAnimationFrame(() => {
    modalContent.classList.remove("scale-95", "opacity-0");
    modalContent.classList.add("scale-100", "opacity-100");
  });
}

// =============================
// CERRAR MODAL (SOLUCIONADO)
// =============================
window.closeModal = function() {
  const modal = document.getElementById("modalEdit");
  const modalContent = document.getElementById("modalContent");

  // Animación de salida
  modalContent.classList.remove("scale-100", "opacity-100");
  modalContent.classList.add("scale-95", "opacity-0");
  
  // Esperar a la animación y luego ocultar con estilo inline
  setTimeout(() => {
    modal.style.display = "none";
    modal.classList.add("hidden");
  }, 200);
}

// =============================
// ELIMINAR DESDE MODAL
// =============================
window.deleteClientFromModal = async function() {
  const id = document.getElementById("editId").value;
  if (!confirm("¿Eliminar este cliente desde el editor?")) return;
  
  // Reutilizamos la función global eliminar
  eliminarCliente(id);
  closeModal();
}

// =============================
// ACTUALIZAR CLIENTE
// =============================
window.updateClient = async function() {
  const id = document.getElementById("editId").value;
  const nombre = document.getElementById("editNombre").value;
  const telefono = document.getElementById("editTelefono").value;
  const placa = document.getElementById("editPlaca").value;
  const tipo = document.getElementById("editVehiculo").value;

  try {
    const res = await fetch("/api/clientes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nombre, telefono, placa, tipo })
    });

    const data = await res.json();

    if (data.success) {
      closeModal();
      cargarClientes(); // Recargar todo
      mostrarToast("Cliente actualizado correctamente");
    } else {
      mostrarToast(data.error || "Error al actualizar", "error");
    }
  } catch (error) {
    console.error("Error actualizando:", error);
    mostrarToast("Error de conexión", "error");
  }
}

// Inicializar
document.addEventListener("DOMContentLoaded", cargarClientes);