let allClients = [];
let currentPage = 1;
const itemsPerPage = 8; 

document.addEventListener('DOMContentLoaded', () => {
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

    const medioPagoSelect = document.getElementById('medioPago');
    const otroContainer = document.getElementById('otroPagoContainer');
    if(medioPagoSelect && otroContainer) {
        medioPagoSelect.addEventListener('change', (e) => {
            otroContainer.classList.toggle('hidden', e.target.value !== 'Otro');
        });
    }
    
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
        if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error cargando datos</td></tr>`;
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
    const cuota_mensual = document.getElementById('cuotaMensual').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle, cuota_mensual })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');
        alert(data.message);
        e.target.reset();
        // Resetear estado del "Otro"
        document.getElementById('medioPago').value = 'Diario';
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

    const totalCountEl = document.getElementById('totalCount');
    if(totalCountEl) totalCountEl.innerText = filtered.length;
    
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    
    if (currentPage > totalPages) currentPage = totalPages;
    
    const pageInfoEl = document.getElementById('pageInfo');
    if(pageInfoEl) pageInfoEl.innerText = `Pág. ${currentPage} de ${totalPages}`;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filtered.slice(start, end);

    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    if(btnPrev) btnPrev.disabled = currentPage === 1;
    if(btnNext) btnNext.disabled = currentPage === totalPages;

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">No se encontraron clientes</td></tr>';
        return;
    }

    pageData.forEach(client => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-50 transition-colors group";
        
        // Lógica de Estado de Pago
        let estadoPagoHTML = '<span class="text-slate-400 text-xs">Sin pagos</span>';
        if (client.last_payment_date) {
            const lastPay = new Date(client.last_payment_date);
            const today = new Date();
            const diffTime = Math.abs(today - lastPay);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays <= 30) {
                estadoPagoHTML = `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-800"><i class="fa-solid fa-check mr-1"></i> Al día</span>`;
            } else {
                estadoPagoHTML = `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Deuda (${diffDays - 30}d)</span>`;
            }
        } else {
            if(client.fecha_registro) {
                 const regDate = new Date(client.fecha_registro);
                 const today = new Date();
                 const diffTime = Math.abs(today - regDate);
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                 if(diffDays > 5) {
                    estadoPagoHTML = `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Sin Historial</span>`;
                 }
            }
        }
        
        tr.innerHTML = `
            <td class="px-4 py-3">
                <div class="font-medium text-slate-800">${client.nombre}</div>
                <div class="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <i class="fa-solid fa-phone text-[10px]"></i> ${client.telefono || '---'}
                </div>
            </td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    <i class="fa-solid ${getIconForType(client.tipo_vehiculo)}"></i> ${client.tipo_vehiculo}
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
                ${estadoPagoHTML}
            </td>
            <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="openEditModal(${client.id})" class="text-slate-400 hover:text-indigo-600 transition-colors p-2"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteClient(${client.id})" class="text-slate-400 hover:text-red-600 transition-colors p-2"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function changePage(direction) {
    const totalPages = Math.ceil(allClients.length / itemsPerPage) || 1;
    
    if (direction === 'prev') {
        if (currentPage > 1) currentPage--;
    } else if (direction === 'next') {
        if (currentPage < totalPages) currentPage++;
    }
    
    const searchInput = document.getElementById("searchInput");
    renderTable(searchInput ? searchInput.value : '');
}

async function deleteClient(id) {
    if(!confirm("¿Eliminar este cliente? Esto liberará su puesto automáticamente.")) return;
    try {
        const res = await fetch('/api/clientes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        if (!res.ok) throw new Error((await res.json()).error);
        alert("Eliminado y puesto liberado");
        loadClients();
    } catch (error) { alert("Error: " + error.message); }
}

function openEditModal(id) {
    const client = allClients.find(c => c.id === id);
    if (!client) return;

    document.getElementById('editId').value = client.id;
    document.getElementById('editNombre').value = client.nombre;
    document.getElementById('editTelefono').value = client.telefono || '';
    document.getElementById('editPlaca').value = client.placa;
    document.getElementById('editVehiculo').value = client.tipo_vehiculo || 'Carro';
    document.getElementById('editCuotaMensual').value = client.cuota_mensual || 0;
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
    const cuota_mensual = document.getElementById('editCuotaMensual').value;

    if (!nombre || !placa) { alert("Nombre y placa obligatorios"); return; }

    try {
        const res = await fetch('/api/clientes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, nombre, telefono, placa, tipo, fecha_registro, medio_pago, medio_detalle, cuota_mensual })
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