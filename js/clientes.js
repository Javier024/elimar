let allClients = [];
let currentPage = 1;
const itemsPerPage = 8; 

document.addEventListener('DOMContentLoaded', () => {
    loadClients();
    setupEventListeners();
});

function setupEventListeners() {
    // Formulario Crear
    const form = document.getElementById('formCliente');
    if(form) form.addEventListener('submit', handleCreateClient);

    // Buscador
    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentPage = 1; // Resetear a página 1 al buscar
            renderTable(e.target.value);
        });
    }

    // Lógica "Otro" pago en Crear
    const medioPagoSelect = document.getElementById('medioPago');
    const otroContainer = document.getElementById('otroPagoContainer');
    if(medioPagoSelect && otroContainer) {
        medioPagoSelect.addEventListener('change', (e) => {
            toggleOtroPago(e.target.value, otroContainer, 'otroPagoInput');
        });
    }
    
    // Lógica "Otro" pago en Editar
    const editMedioPagoSelect = document.getElementById('editMedioPago');
    const editOtroContainer = document.getElementById('editOtroPagoContainer');
    if(editMedioPagoSelect && editOtroContainer) {
        editMedioPagoSelect.addEventListener('change', (e) => {
            toggleOtroPago(e.target.value, editOtroContainer, 'editOtroPagoInput');
        });
    }
}

function toggleOtroPago(value, container, inputId) {
    const isOtro = value === 'Otro';
    container.classList.toggle('hidden', !isOtro);
    if (isOtro) document.getElementById(inputId).focus();
}

async function loadClients() {
    try {
        const res = await fetch('/api/clientes');
        if (!res.ok) throw new Error('Error al cargar clientes');
        const data = await res.json();
        allClients = data;
        renderTable();
    } catch (error) {
        console.error(error);
        const tbody = document.getElementById('listaClientesBody');
        if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error cargando datos</td></tr>`;
    }
}

async function handleCreateClient(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const formData = {
        nombre: document.getElementById('nombre').value,
        telefono: document.getElementById('telefono').value,
        placa: document.getElementById('placa').value.toUpperCase(),
        tipo: document.getElementById('vehiculo').value,
        fecha_registro: document.getElementById('fechaRegistro').value,
        medio_pago: document.getElementById('medioPago').value,
        medio_detalle: document.getElementById('otroPagoInput').value,
        cuota_mensual: document.getElementById('cuotaMensual').value
    };

    setButtonLoading(btn, true);

    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');
        alert(data.message);
        e.target.reset();
        // Resetear visibilidad "Otro"
        document.getElementById('medioPago').value = 'Diario';
        document.getElementById('otroPagoContainer').classList.add('hidden');
        loadClients();
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        setButtonLoading(btn, false, originalText);
    }
}

function setButtonLoading(btn, isLoading, originalText = '') {
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...' : originalText;
}

// Helper para generar HTML del estado de pago
function getPaymentStatusHTML(client) {
    if (client.last_payment_date) {
        const lastPay = new Date(client.last_payment_date);
        const today = new Date();
        // Diferencia en días
        const diffDays = Math.ceil(Math.abs(today - lastPay) / (1000 * 60 * 60 * 24)); 
        
        if (diffDays <= 30) {
            return `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800"><i class="fa-solid fa-check mr-1"></i> Al día</span>`;
        } else {
            return `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Deuda (${diffDays - 30}d)</span>`;
        }
    } else {
        if(client.fecha_registro) {
             const regDate = new Date(client.fecha_registro);
             const diffDays = Math.ceil(Math.abs(new Date() - regDate) / (1000 * 60 * 60 * 24));
             if(diffDays > 5) {
                return `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Sin Historial</span>`;
             }
        }
    }
    return '<span class="text-slate-400 text-xs">Sin pagos</span>';
}

// Helper para fila de tabla
function createClientRow(client) {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 border-b border-slate-50 transition-colors group";
    
    const iconClass = getIconForType(client.tipo_vehiculo);

    tr.innerHTML = `
        <td class="px-4 py-3">
            <div class="font-medium text-slate-800">${client.nombre}</div>
            <div class="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <i class="fa-solid fa-phone text-[10px]"></i> ${client.telefono || '---'}
            </div>
        </td>
        <td class="px-4 py-3">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                <i class="fa-solid ${iconClass}"></i> ${client.tipo_vehiculo}
            </span>
            <div class="text-[10px] text-slate-400 mt-1 uppercase font-bold">${client.medio_pago}</div>
        </td>
        <td class="px-4 py-3 font-mono text-slate-600 font-medium">${client.placa}</td>
        
        <td class="px-4 py-3">
            <div class="text-[10px] text-slate-500 flex items-center gap-1 mb-1">
                <i class="fa-regular fa-calendar"></i> ${client.fecha_registro || '---'}
            </div>
            <div class="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <i class="fa-solid fa-money-bill"></i> $${Number(client.cuota_mensual || 0).toLocaleString('es-CO')}
            </div>
        </td>

        <td class="px-4 py-3">
            ${getPaymentStatusHTML(client)}
        </td>
        <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-2">
                <button onclick="openEditModal(${client.id})" class="text-slate-400 hover:text-indigo-600 transition-colors p-2" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="deleteClient(${client.id})" class="text-slate-400 hover:text-red-600 transition-colors p-2" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
        </td>
    `;
    return tr;
}

function renderTable(filterText = '') {
    const tbody = document.getElementById('listaClientesBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    // 1. Filtrar datos
    const filtered = allClients.filter(c => 
        c.nombre.toLowerCase().includes(filterText.toLowerCase()) || 
        c.placa.toLowerCase().includes(filterText.toLowerCase())
    );

    // 2. Actualizar contadores
    const totalCountEl = document.getElementById('totalCount');
    if(totalCountEl) totalCountEl.innerText = filtered.length;
    
    // 3. Calcular paginación basado en los datos FILTRADOS
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    const pageInfoEl = document.getElementById('pageInfo');
    if(pageInfoEl) pageInfoEl.innerText = `Pág. ${currentPage} de ${totalPages}`;
    
    // 4. Obtener datos de la página actual
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filtered.slice(start, end);

    // 5. Controlar botones
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    if(btnPrev) btnPrev.disabled = currentPage === 1;
    if(btnNext) btnNext.disabled = currentPage === totalPages;

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">No se encontraron clientes</td></tr>';
        return;
    }

    // 6. Renderizar filas
    const fragment = document.createDocumentFragment();
    pageData.forEach(client => {
        fragment.appendChild(createClientRow(client));
    });
    tbody.appendChild(fragment);
}

function changePage(direction) {
    const searchInput = document.getElementById("searchInput");
    const filterText = searchInput ? searchInput.value : '';
    
    // Recalcular total pages basado en el filtro actual para saber si podemos avanzar
    const filtered = allClients.filter(c => 
        c.nombre.toLowerCase().includes(filterText.toLowerCase()) || 
        c.placa.toLowerCase().includes(filterText.toLowerCase())
    );
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    } else if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
    }
    
    renderTable(filterText);
}

async function deleteClient(id) {
    if(!confirm("¿Está seguro de eliminar este cliente?")) return;
    try {
        const res = await fetch('/api/clientes', { 
            method: 'DELETE', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ id }) 
        });
        if (!res.ok) throw new Error((await res.json()).error);
        // alert("Eliminado"); // Opcional: el usuario ve la lista actualizar
        loadClients();
    } catch (error) { alert("Error: " + error.message); }
}

function openEditModal(id) {
    const client = allClients.find(c => c.id === id);
    if (!client) return;

    // Llenar campos
    document.getElementById('editId').value = client.id;
    document.getElementById('editNombre').value = client.nombre;
    document.getElementById('editTelefono').value = client.telefono || '';
    document.getElementById('editPlaca').value = client.placa;
    document.getElementById('editVehiculo').value = client.tipo_vehiculo || 'Carro';
    document.getElementById('editCuotaMensual').value = client.cuota_mensual || 0;
    document.getElementById('editFechaRegistro').value = client.fecha_registro || '';
    
    // Lógica medio pago
    const medio = client.medio_pago || 'Diario';
    const select = document.getElementById('editMedioPago');
    const options = select.options;
    let found = false;
    
    // Buscar si existe en las opciones fijas
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === medio) {
            select.value = medio;
            document.getElementById('editOtroPagoContainer').classList.add('hidden');
            found = true;
            break;
        }
    }
    // Si no es estándar, poner en "Otro"
    if (!found) {
        select.value = 'Otro';
        document.getElementById('editOtroPagoInput').value = medio;
        document.getElementById('editOtroPagoContainer').classList.remove('hidden');
    }

    // Mostrar Modal
    const modal = document.getElementById('modalEdit');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');
    // Pequeño timeout para permitir la transición CSS
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
    setTimeout(() => { modal.classList.add('hidden'); }, 200);
}

async function updateClient() {
    const id = document.getElementById('editId').value;
    const formData = {
        id: id,
        nombre: document.getElementById('editNombre').value,
        telefono: document.getElementById('editTelefono').value,
        placa: document.getElementById('editPlaca').value.toUpperCase(),
        tipo: document.getElementById('editVehiculo').value,
        fecha_registro: document.getElementById('editFechaRegistro').value,
        medio_pago: document.getElementById('editMedioPago').value,
        medio_detalle: document.getElementById('editOtroPagoInput').value,
        cuota_mensual: document.getElementById('editCuotaMensual').value
    };

    if (!formData.nombre || !formData.placa) { alert("Nombre y placa obligatorios"); return; }

    try {
        const res = await fetch('/api/clientes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error((await res.json()).error);
        alert("Actualizado");
        closeModal();
        loadClients();
    } catch (error) { alert("Error: " + error.message); }
}

async function deleteClientFromModal() {
    const id = document.getElementById('editId').value;
    if(!confirm("¿Eliminar este cliente?")) return;
    try {
        const res = await fetch('/api/clientes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        if (!res.ok) throw new Error((await res.json()).error);
        alert("Eliminado");
        closeModal();
        loadClients();
    } catch (error) { alert("Error: " + error.message); }
}

function getIconForType(tipo) {
    if (!tipo) return 'fa-car';
    const t = tipo.toLowerCase();
    if (t.includes('moto')) return 'fa-motorcycle';
    if (t.includes('camioneta')) return 'fa-truck-pickup';
    return 'fa-car';
}

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileMenuOverlay');
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden');
    }
};