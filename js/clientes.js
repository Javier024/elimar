// parqueo/js/clientes.js

let allClients = [];
let currentPage = 1;
const itemsPerPage = 5;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema Clientes Iniciado...");
    loadClients();

    const form = document.getElementById('formCliente');
    if(form) form.addEventListener('submit', handleCreateClient);

    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentPage = 1;
            renderTable(e.target.value);
        });
    }

    // Lógica campo "Otro" en Crear
    const medioPagoSelect = document.getElementById('medioPago');
    const otroContainer = document.getElementById('otroPagoContainer');
    if(medioPagoSelect && otroContainer) {
        medioPagoSelect.addEventListener('change', (e) => {
            otroContainer.classList.toggle('hidden', e.target.value !== 'Otro');
        });
    }
    
    // Lógica campo "Otro" en Editar
    const editMedioPagoSelect = document.getElementById('editMedioPago');
    const editOtroContainer = document.getElementById('editOtroPagoContainer');
    if(editMedioPagoSelect && editOtroContainer) {
        editMedioPagoSelect.addEventListener('change', (e) => {
            editOtroContainer.classList.toggle('hidden', e.target.value !== 'Otro');
        });
    }
});

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
        if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error cargando datos: ${error.message}</td></tr>`;
    }
}

async function handleCreateClient(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const nombre = document.getElementById('nombre').value;
    const telefono = document.getElementById('telefono').value;
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('vehiculo').value;
    const fecha_registro = document.getElementById('fechaRegistro').value;
    const medio_pago = document.getElementById('medioPago').value;
    const medio_detalle = document.getElementById('otroPagoInput').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');

        alert(data.message);
        e.target.reset();
        document.getElementById('otroPagoContainer').classList.add('hidden');
        loadClients();

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function renderTable(filterText = '') {
    const tbody = document.getElementById('listaClientesBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const filtered = allClients.filter(c => 
        c.nombre.toLowerCase().includes(filterText.toLowerCase()) || 
        c.placa.toLowerCase().includes(filterText.toLowerCase())
    );

    document.getElementById('totalCount').innerText = filtered.length;
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filtered.slice(start, end);

    document.getElementById('currentPage').innerText = currentPage;
    document.getElementById('totalPages').innerText = totalPages;
    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = currentPage === totalPages;

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">No se encontraron clientes</td></tr>';
        return;
    }

    pageData.forEach(client => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-50 transition-colors group";
        
        const fechaDisplay = client.fecha_registro ? client.fecha_registro : '<span class="text-slate-300 text-xs">Sin fecha</span>';
        let badgeMedio = '';
        if(client.medio_pago) {
            let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
            if(['Mensual', 'Quincenal'].includes(client.medio_pago)) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
            if(['Diario', 'Semanal'].includes(client.medio_pago)) colorClass = 'bg-amber-50 text-amber-700 border-amber-100';
            badgeMedio = `<div class="mt-1"><span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${colorClass}">${client.medio_pago}</span></div>`;
        }
        
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="font-medium text-slate-800">${client.nombre}</div>
                <div class="text-xs text-slate-400">ID: ${client.id}</div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <i class="fa-solid ${getIconForType(client.tipo_vehiculo)}"></i> ${client.tipo_vehiculo || 'N/A'}
                </span>
                ${badgeMedio}
            </td>
            <td class="px-6 py-4 font-mono text-slate-600 font-medium">${client.placa}</td>
            <td class="px-6 py-4 text-slate-500">${client.telefono || '-'}</td>
            <td class="px-6 py-4 text-slate-500 text-xs">${fechaDisplay}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="openEditModal(${client.id})" class="text-slate-400 hover:text-indigo-600 transition-colors p-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteClient(${client.id})" class="text-slate-400 hover:text-red-600 transition-colors p-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
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

async function deleteClient(id) {
    if(!confirm("¿Estás seguro de que deseas eliminar este cliente?")) return;
    try {
        const res = await fetch('/api/clientes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        if (!res.ok) throw new Error((await res.json()).error);
        alert("Cliente eliminado");
        loadClients();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

function openEditModal(id) {
    const client = allClients.find(c => c.id === id);
    if (!client) return;

    document.getElementById('editId').value = client.id;
    document.getElementById('editNombre').value = client.nombre;
    document.getElementById('editTelefono').value = client.telefono || '';
    document.getElementById('editPlaca').value = client.placa;
    document.getElementById('editVehiculo').value = client.tipo_vehiculo || 'Carro';
    document.getElementById('editFechaRegistro').value = client.fecha_registro || '';
    
    const medio = client.medio_pago || 'Diario';
    const options = document.getElementById('editMedioPago').options;
    let found = false;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === medio) {
            document.getElementById('editMedioPago').value = medio;
            document.getElementById('editOtroPagoContainer').classList.add('hidden');
            found = true;
            break;
        }
    }
    if (!found) {
        document.getElementById('editMedioPago').value = 'Otro';
        document.getElementById('editOtroPagoInput').value = medio;
        document.getElementById('editOtroPagoContainer').classList.remove('hidden');
    }

    const modal = document.getElementById('modalEdit');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('opacity-0', 'scale-95'); content.classList.add('scale-100'); }, 10);
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
    const nombre = document.getElementById('editNombre').value;
    const telefono = document.getElementById('editTelefono').value;
    const placa = document.getElementById('editPlaca').value.toUpperCase();
    const tipo = document.getElementById('editVehiculo').value;
    const fecha_registro = document.getElementById('editFechaRegistro').value;
    const medio_pago = document.getElementById('editMedioPago').value;
    const medio_detalle = document.getElementById('editOtroPagoInput').value;

    if (!nombre || !placa) { alert("Nombre y placa son obligatorios"); return; }

    try {
        const res = await fetch('/api/clientes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle })
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