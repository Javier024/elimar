// parqueo/js/clientes.js

let allClients = [];
let currentPage = 1;
const itemsPerPage = 5;

// Se ejecuta cuando la página carga
document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema Clientes Iniciado...");
    loadClients();

    // Listener para el formulario de CREAR
    const form = document.getElementById('formCliente');
    if(form) {
        form.addEventListener('submit', handleCreateClient);
    }

    // Listener para la BÚSQUEDA
    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentPage = 1; // Volver a la página 1 al buscar
            renderTable(e.target.value);
        });
    }
});

// --- FUNCIONES DE CARGA DE DATOS ---

async function loadClients() {
    try {
        const res = await fetch('/api/clientes');
        if (!res.ok) throw new Error('Error al cargar clientes');
        const data = await res.json();
        allClients = data; // Guardar en memoria global
        renderTable();
    } catch (error) {
        console.error(error);
        // Mostrar error visualmente en la tabla
        const tbody = document.getElementById('listaClientesBody');
        if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-4">Error cargando datos: ${error.message}</td></tr>`;
    }
}

// --- FUNCIÓN PARA CREAR CLIENTE ---

async function handleCreateClient(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    // Obtener valores
    const nombre = document.getElementById('nombre').value;
    const telefono = document.getElementById('telefono').value;
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('vehiculo').value;

    // Estado de carga en el botón
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, placa, tipo })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Error desconocido');
        }

        alert(data.message);
        e.target.reset(); // Limpiar formulario
        loadClients(); // Recargar tabla

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- RENDERIZADO DE TABLA Y PAGINACIÓN ---

function renderTable(filterText = '') {
    const tbody = document.getElementById('listaClientesBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 1. Filtrar datos
    const filtered = allClients.filter(c => 
        c.nombre.toLowerCase().includes(filterText.toLowerCase()) || 
        c.placa.toLowerCase().includes(filterText.toLowerCase())
    );

    document.getElementById('totalCount').innerText = filtered.length;

    // 2. Calcular paginación
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filtered.slice(start, end);

    // 3. Actualizar controles de paginación
    document.getElementById('currentPage').innerText = currentPage;
    document.getElementById('totalPages').innerText = totalPages;
    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = currentPage === totalPages;

    // 4. Dibujar filas HTML
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-400">No se encontraron clientes</td></tr>';
        return;
    }

    pageData.forEach(client => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-50 transition-colors group";
        
        // AGREGADO: Botón de Eliminar en la tabla
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-medium text-slate-800">${client.nombre}</div>
                <div class="text-xs text-slate-400">ID: ${client.id}</div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <i class="fa-solid ${getIconForType(client.tipo_vehiculo)}"></i> ${client.tipo_vehiculo || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 font-mono text-slate-600 font-medium">${client.placa}</td>
            <td class="px-6 py-4 text-slate-500">${client.telefono || '-'}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <!-- Botón Editar -->
                    <button onclick="openEditModal(${client.id})" class="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Editar">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <!-- Botón Eliminar (NUEVO) -->
                    <button onclick="deleteClient(${client.id})" class="text-slate-400 hover:text-red-600 transition-colors p-1" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function changePage(direction) {
    currentPage += direction;
    const searchInput = document.getElementById('searchInput');
    renderTable(searchInput ? searchInput.value : '');
}

// --- LÓGICA DE ELIMINACIÓN (DESDE LA TABLA) ---

async function deleteClient(id) {
    // 1. Confirmación nativa del navegador
    if(!confirm("¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.")) {
        return;
    }

    try {
        const res = await fetch('/api/clientes', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert("Cliente eliminado correctamente");
        loadClients(); // Recargar la tabla para quitar la fila
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}

// --- LÓGICA DEL MODAL (EDICIÓN) ---

function openEditModal(id) {
    const client = allClients.find(c => c.id === id);
    if (!client) return;

    // Llenar campos del modal
    document.getElementById('editId').value = client.id;
    document.getElementById('editNombre').value = client.nombre;
    document.getElementById('editTelefono').value = client.telefono || '';
    document.getElementById('editPlaca').value = client.placa;
    document.getElementById('editVehiculo').value = client.tipo_vehiculo || 'Carro';

    // Mostrar modal con animación
    const modal = document.getElementById('modalEdit');
    const content = document.getElementById('modalContent');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('opacity-0', 'scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('modalEdit');
    const content = document.getElementById('modalContent');
    
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('opacity-0', 'scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

async function updateClient() {
    const id = document.getElementById('editId').value;
    const nombre = document.getElementById('editNombre').value;
    const telefono = document.getElementById('editTelefono').value;
    const placa = document.getElementById('editPlaca').value.toUpperCase();
    const tipo = document.getElementById('editVehiculo').value;

    if (!nombre || !placa) {
        alert("Nombre y placa son obligatorios");
        return;
    }

    try {
        const res = await fetch('/api/clientes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, telefono, placa, tipo })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert("Cliente actualizado correctamente");
        closeModal();
        loadClients();
    } catch (error) {
        alert("Error al actualizar: " + error.message);
    }
}

// Esta función se mantiene por si usas el botón eliminar DENTRO del modal
async function deleteClientFromModal() {
    const id = document.getElementById('editId').value;
    if(!confirm("¿Eliminar este cliente desde el editor?")) return;

    try {
        const res = await fetch('/api/clientes', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert("Cliente eliminado");
        closeModal();
        loadClients();
    } catch (error) {
        alert("Error al eliminar: " + error.message);
    }
}

// --- UTILIDADES ---

function getIconForType(tipo) {
    if (!tipo) return 'fa-car';
    const t = tipo.toLowerCase();
    if (t.includes('moto')) return 'fa-motorcycle';
    if (t.includes('camioneta')) return 'fa-truck-pickup';
    return 'fa-car';
}

// Función para el menú móvil
window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileMenuOverlay');
    const isClosed = sidebar.classList.contains('-translate-x-full');
    
    if (isClosed) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }
};