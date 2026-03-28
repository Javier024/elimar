// --- ESTADO DE LA APLICACIÓN ---
let transactions = [];
let spots = [];
let clients = [];
let currentPage = 1;
const itemsPerPage = 8;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById("cajaDate");
    if(dateInput) dateInput.valueAsDate = new Date();

    const clientInput = document.getElementById('cajaCliente');
    if(clientInput) {
        clientInput.addEventListener('input', (e) => handleClientSearch(e.target.value));
    }

    loadData();
});

// --- CARGA DE DATOS ---
async function loadData() {
    try {
        const [transRes, spotsRes, clientsRes, deudoresRes] = await Promise.all([
            fetch('/api/caja'),
            fetch('/api/puestos'),
            fetch('/api/clientes'),
            fetch('/api/caja?deudores=true&page=1')
        ]);

        if (!transRes.ok) throw new Error("Error cargando transacciones");
        if (!spotsRes.ok) throw new Error("Error cargando puestos");
        
        transactions = await transRes.json();
        spots = await spotsRes.json();
        clients = await clientsRes.json();
        
        // Ejecutamos después de cargar clientes
        checkUrlParamsAndFillData();

        if (deudoresRes.ok) {
            const deudoresData = await deudoresRes.json();
            renderDeudoresList(deudoresData.rows);
        } else {
            const container = document.getElementById('deudoresList');
            if(container) container.innerHTML = '<div class="text-center text-slate-400 text-xs">Error cargando deudores</div>';
        }

        renderTable();
        updateKPIs();

    } catch (error) {
        console.error("Error cargando datos de caja:", error);
        const tbody = document.getElementById('listaCajaBody');
        if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar datos</td></tr>';
    }
}

// --- FUNCIÓN CLAVE: LLENAR DATOS DESDE PUESTOS (MEJORADA) ---
function checkUrlParamsAndFillData() {
    const params = new URLSearchParams(window.location.search);
    
    const plate = params.get('plate');
    const spot = params.get('spot');
    let clientName = params.get('client');
    const phone = params.get('phone');
    const entryTimestamp = params.get('entry');
    const amountParam = params.get('amount');
    const periodParam = params.get('period');

    if (!plate) return;

    // 1. Datos básicos
    document.getElementById('cajaPlaca').value = plate;
    document.getElementById('cajaPuesto').value = spot || "---";
    if (clientName) document.getElementById('cajaCliente').value = decodeURIComponent(clientName);
    if (phone) document.getElementById('cajaTelefono').value = phone;

    // 2. FECHA DE ENTRADA / DETALLE (Corregido y robusto)
    const entryDisplay = document.getElementById('cajaFechaEntradaDisplay');
    if (entryTimestamp && entryDisplay) {
        try {
            let fechaObj;
            // Intentar parsear como timestamp unix (segundos)
            if (!isNaN(entryTimestamp) && entryTimestamp > 10000000000) {
                 fechaObj = new Date(Number(entryTimestamp) * 1000);
            } else {
                // Intentar parsear como string ISO o similar
                fechaObj = new Date(entryTimestamp);
            }

            if (!isNaN(fechaObj.getTime())) {
                const dia = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                entryDisplay.value = `Entró: ${dia} - ${hora}`;
            } else {
                entryDisplay.value = "Fecha inválida";
            }
        } catch(e) {
            entryDisplay.value = "Error de fecha";
            console.error(e);
        }
    } else if (entryDisplay) {
        entryDisplay.value = "Sin registro";
    }

    // 3. MONTO A COBRAR (Prioridad: URL > BD > Vacío)
    const montoInput = document.getElementById('cajaMonto');
    const periodSelect = document.getElementById('cajaPeriodType');
    let montoFinal = 0;

    // Si la URL trae un monto válido, úsalo
    if (amountParam && parseFloat(amountParam) > 0) {
        montoFinal = amountParam;
    } else {
        // Sino, buscar en el caché de clientes (Failsafe)
        const clientData = clients.find(c => c.placa === plate);
        if (clientData && clientData.cuota_mensual > 0) {
            montoFinal = clientData.cuota_mensual;
        }
    }

    montoInput.value = montoFinal;

    // 4. PERIODO
    if (periodSelect) {
        if (periodParam) {
            periodSelect.value = periodParam;
        } else {
            const clientData = clients.find(c => c.placa === plate);
            if (clientData) {
                const medio = (clientData.medio_pago || '').toLowerCase();
                if (medio.includes('mensual')) periodSelect.value = 'Mes';
                else if (medio.includes('semanal')) periodSelect.value = 'Semana';
                else periodSelect.value = 'Noche';
            } else {
                periodSelect.value = 'Noche';
            }
        }
    }

    // Limpiar URL y Enfocar
    window.history.replaceState({}, document.title, "caja.html");
    setTimeout(() => montoInput.focus(), 300);
}

// --- PRELLENAR DESDE DEUDORES ---
window.preFillFromDebtor = function(plate, nombre, telefono) {
    document.getElementById('cajaPlaca').value = plate;
    document.getElementById('cajaCliente').value = nombre;
    document.getElementById('cajaTelefono').value = telefono;
    
    const activeSpot = spots.find(s => s.cliente_placa === plate && s.estado === 'ocupado');
    if (activeSpot) {
        document.getElementById('cajaPuesto').value = activeSpot.numero;
        if (activeSpot.hora_inicio) {
             const dateObj = new Date(Number(activeSpot.hora_inicio) * 1000);
             const dia = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
             const hora = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
             document.getElementById('cajaFechaEntradaDisplay').value = `Entró: ${dia} - ${hora}`;
        }
    } else {
        document.getElementById('cajaPuesto').value = "---";
    }

    document.querySelector('.sticky.top-4').scrollIntoView({ behavior: 'smooth' });
    
    const clientData = clients.find(c => c.placa === plate);
    if (clientData) {
        document.getElementById('cajaMonto').value = clientData.cuota_mensual || 0;
    }
    setTimeout(() => document.getElementById('cajaMonto').focus(), 500);
};

// --- RENDERIZAR LISTA DE DEUDORES ---
function renderDeudoresList(deudores) {
    const container = document.getElementById('deudoresList');
    if(!container) return;

    if (!deudores || deudores.length === 0) {
        container.innerHTML = '<div class="text-center text-emerald-600 text-xs py-2 font-medium">¡Todos al día! 🎉</div>';
        return;
    }

    let html = '';
    deudores.forEach(d => {
        const phoneClean = d.telefono ? d.telefono.replace(/\D/g, '') : '';
        const whatsappLink = phoneClean ? `https://wa.me/57${phoneClean}?text=Hola ${d.nombre}, te recordamos que tienes el servicio del parqueadero pendiente de este mes.` : '#';
        
        html += `
            <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div class="flex-1">
                    <p class="text-sm font-bold text-slate-800">${d.nombre}</p>
                    <p class="text-xs text-slate-500 font-mono">${d.placa}</p>
                </div>
                <div class="flex items-center gap-2">
                    <a href="${whatsappLink}" target="_blank" class="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors" title="Enviar WhatsApp">
                        <i class="fa-brands fa-whatsapp text-lg"></i>
                    </a>
                    <button onclick="preFillFromDebtor('${d.placa}', '${d.nombre.replace(/'/g, "\\'")}', '${d.telefono || ''}')" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Ir a Cobrar">
                        <i class="fa-solid fa-money-bill-wave"></i>
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// --- AUTOCOMPLETADO ---
function handleClientSearch(query) {
    const input = document.getElementById('cajaCliente');
    const datalist = document.getElementById('clientListDatalist');
    if(!datalist) return;
    datalist.innerHTML = ''; 
    if (query.length < 2) return;

    const filtered = clients.filter(c => c.nombre.toLowerCase().includes(query.toLowerCase()) || c.placa.toLowerCase().includes(query.toLowerCase()));
    filtered.forEach(client => {
        const option = document.createElement('option');
        option.value = client.nombre; 
        option.setAttribute('data-id', client.id);
        option.setAttribute('data-phone', client.telefono || '');
        option.setAttribute('data-plate', client.placa);
        option.setAttribute('data-medio', client.medio_pago || 'Noche');
        datalist.appendChild(option);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const clientInput = document.getElementById('cajaCliente');
    if(clientInput) {
        clientInput.addEventListener('change', function(e) {
            const datalist = document.getElementById('clientListDatalist');
            if(!datalist) return;
            const selectedOption = datalist.querySelector(`option[value="${e.target.value}"]`);
            if (selectedOption) {
                const phone = selectedOption.getAttribute('data-phone');
                const plate = selectedOption.getAttribute('data-plate');
                const medio = selectedOption.getAttribute('data-medio');
                const phoneInput = document.getElementById('cajaTelefono');
                const plateInput = document.getElementById('cajaPlaca');
                const spotInput = document.getElementById('cajaPuesto');
                const dateDisplay = document.getElementById('cajaFechaEntradaDisplay');
                const periodSelect = document.getElementById('cajaPeriodType');
                const montoInput = document.getElementById('cajaMonto');

                if(phoneInput) phoneInput.value = phone;
                if(plateInput) plateInput.value = plate;
                
                const activeSpot = spots.find(s => s.cliente_placa === plate && s.estado === 'ocupado');
                if (activeSpot) {
                    if(spotInput) spotInput.value = activeSpot.numero;
                    if (dateDisplay && activeSpot.hora_inicio) {
                        const dateObj = new Date(Number(activeSpot.hora_inicio) * 1000);
                        const dia = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
                        const hora = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        dateDisplay.value = `Entró: ${dia} - ${hora}`;
                    }
                } else {
                    if(spotInput) spotInput.value = "---";
                    if(dateDisplay) dateDisplay.value = "No registrado en puesto";
                }

                const clientData = clients.find(c => c.placa === plate);
                if (clientData) {
                    if(montoInput) montoInput.value = clientData.cuota_mensual || 0;
                    if (periodSelect) {
                        const periodMap = { 'Diario': 'Noche', 'Semanal': 'Semana', 'Quincenal': 'Semana', 'Mensual': 'Mes' };
                        if (periodMap[medio]) periodSelect.value = periodMap[medio];
                    }
                }
            }
        });
    }
});

// --- RENDERIZADO TABLA ---
function renderTable(filterText = '') {
    const tbody = document.getElementById('listaCajaBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const filtered = transactions.filter(t => t.client.toLowerCase().includes(filterText.toLowerCase()) || t.plate.toLowerCase().includes(filterText.toLowerCase()));
    const pageInfo = document.getElementById('pageInfo');
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    if(pageInfo) pageInfo.innerText = `Página ${currentPage} de ${totalPages}`;
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filtered.slice(start, start + itemsPerPage);
    if (pageData.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">No hay transacciones</td></tr>'; return; }

    pageData.forEach(tx => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";
        const fechaPago = tx.date || '---';
        const horaPago = tx.time || '';
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-slate-900">${fechaPago}</div><div class="text-xs text-slate-500">${horaPago}</div></td>
            <td class="px-6 py-4"><div class="text-sm font-medium text-slate-900">${tx.client}</div><div class="text-[10px] text-slate-500 flex items-center gap-1"><i class="fa-solid fa-phone text-[10px]"></i> ${tx.phone || '---'}</div></td>
            <td class="px-6 py-4"><div class="flex items-center gap-2"><span class="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded uppercase">${tx.plate}</span><span class="text-[10px] text-slate-400">Puesto: ${tx.spot}</span></div></td>
            <td class="px-6 py-4"><span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${tx.method === 'Efectivo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}">${tx.method}</span></td>
            <td class="px-6 py-4 text-right"><div class="text-sm font-bold text-slate-900">$${Number(tx.amount).toLocaleString('es-CO')}</div><div class="text-[10px] text-slate-500">${tx.period_type || ''} x${tx.period_quantity || 1}</div></td>
            <td class="px-6 py-4 text-center">
                <button onclick="printReceipt(${tx.id})" class="text-indigo-600 hover:text-indigo-800 mr-2" title="Imprimir Factura"><i class="fa-solid fa-print"></i></button>
                <button onclick="editTransaction(${tx.id})" class="text-slate-400 hover:text-slate-600 mr-2" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteTransaction(${tx.id})" class="text-red-400 hover:text-red-600" title="Anular"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- PDF ---
async function generarFacturaDesdeFormulario() {
    const client = document.getElementById('cajaCliente').value;
    const plate = document.getElementById('cajaPlaca').value;
    const amount = document.getElementById('cajaMonto').value;
    const method = document.getElementById('cajaMetodo').value;
    const periodType = document.getElementById('cajaPeriodType').value;
    const periodQty = document.getElementById('cajaPeriodQty').value;
    const date = document.getElementById('cajaDate').value;
    const spot = document.getElementById('cajaPuesto').value;

    if (!client || !amount) { alert("Complete los datos básicos para generar la factura."); return false; }
    createPDF({ id: Date.now(), client, phone: document.getElementById('cajaTelefono').value, plate, spot, amount, method, period_type: periodType, period_quantity: periodQty, date });
    return true; 
}

function createPDF(data) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFillColor(99, 102, 241); doc.rect(0, 0, 210, 40, 'F'); 
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("PARQUEADERO ELIMAR", 20, 15);
    doc.setFontSize(10); doc.text("NIT: 900.123.456-7", 20, 25); doc.text("Factura de Servicios", 150, 25, { align: 'right' });
    doc.setTextColor(30, 41, 59); doc.setFontSize(12); doc.text("Cliente:", 20, 50);
    doc.setFont("helvetica", "bold"); doc.text(data.client, 55, 50); doc.setFont("helvetica", "normal");
    doc.text("Teléfono:", 20, 58); doc.text(data.phone || "---", 55, 58); doc.text("Placa:", 20, 66); doc.text(data.plate, 55, 66);
    doc.text("Fecha de Pago:", 120, 58); doc.text(data.date, 155, 58);
    doc.setDrawColor(200); doc.line(20, 75, 190, 75);
    let y = 85; doc.setFontSize(10);
    doc.text("Descripción", 25, y); doc.text("Cant.", 110, y); doc.text("Valor Unit.", 130, y, { align: 'right' }); doc.text("Total", 170, y, { align: 'right' });
    y += 7; doc.setFillColor(248, 250, 252); doc.rect(20, y, 170, 10, 'F');
    doc.setTextColor(0, 0, 0); const desc = `Cobro Mensual / Parqueadero ${data.spot ? '- Puesto '+data.spot : ''}`;
    doc.text(desc, 25, y + 6); doc.text("1", 115, y + 6); doc.text(`$${Number(data.amount).toLocaleString('es-CO')}`, 170, y + 6, { align: 'right' });
    y += 20; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`TOTAL A PAGAR: $${Number(data.amount).toLocaleString('es-CO')}`, 170, y, { align: 'right' }); doc.setFont("helvetica", "normal");
    y += 20; doc.setDrawColor(200); doc.line(20, y, 190, y);
    y += 10; doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.text("Información de Contacto:", 20, y);
    doc.setTextColor(30, 41, 59); doc.text("Celular: 3206641353", 20, y + 5); doc.text("Fijo: 3206753900", 20, y + 10);
    doc.text("Gracias por su preferencia.", 20, y + 20, { align: 'center' });
    doc.save(`Factura_${data.plate}_${data.date}.pdf`);
}

// --- FORMULARIO ---
async function handleCustomPeriod(e) {
    const typeSelect = document.getElementById('cajaPeriodType');
    if (typeSelect.value === 'Otro') { const customVal = document.getElementById('cajaPeriodCustom').value; if (!customVal.trim()) { e.preventDefault(); alert('Concepto personalizado requerido'); return false; } typeSelect.value = customVal; }
    const checkFactura = document.getElementById('checkFactura');
    if (checkFactura && checkFactura.checked) { const facturaGenerada = await generarFacturaDesdeFormulario(); if (!facturaGenerada) return; }
    registrarCobro(e);
}

async function registrarCobro(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); const originalText = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    const client = document.getElementById('cajaCliente').value;
    const plate = document.getElementById('cajaPlaca').value;
    const spot = document.getElementById('cajaPuesto').value;
    const phone = document.getElementById('cajaTelefono').value;
    const amount = document.getElementById('cajaMonto').value;
    const method = document.getElementById('cajaMetodo').value;
    const periodType = document.getElementById('cajaPeriodType').value;
    const periodQty = document.getElementById('cajaPeriodQty').value;
    const date = document.getElementById('cajaDate').value;

    try {
        const res = await fetch('/api/caja', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client, plate, spot, phone, amount, method, period_type: periodType, period_quantity: periodQty, date }) });
        const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Error al registrar');
        alert("Cobro registrado con éxito"); e.target.reset(); document.getElementById('cajaDate').valueAsDate = new Date(); loadData(); 
    } catch (error) { alert("Error: " + error.message); } finally { btn.disabled = false; btn.innerHTML = originalText; }
}

// --- GESTIÓN ---
function editTransaction(id) {
    const tx = transactions.find(t => t.id === id); if(!tx) return;
    const editId = document.getElementById('editId'); const editDate = document.getElementById('editDate'); const editAmount = document.getElementById('editAmount'); const editClient = document.getElementById('editClient'); const editPlate = document.getElementById('editPlate'); const editMethod = document.getElementById('editMethod'); const editPeriodType = document.getElementById('editPeriodType'); const editPeriodQty = document.getElementById('editPeriodQty');
    if(editId) editId.value = tx.id; if(editDate) editDate.value = tx.date; if(editAmount) editAmount.value = tx.amount; if(editClient) editClient.value = tx.client; if(editPlate) editPlate.value = tx.plate; if(editMethod) editMethod.value = tx.method; if(editPeriodType) editPeriodType.value = tx.period_type || 'Noche'; if(editPeriodQty) editPeriodQty.value = tx.period_quantity || 1;
    const modal = document.getElementById('modalEdit'); const content = document.getElementById('modalEditContent'); if(modal && content) { modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('opacity-0', 'scale-95'); content.classList.add('scale-100'); }, 10); }
}
function closeEditModal() {
    const modal = document.getElementById('modalEdit'); const content = document.getElementById('modalEditContent'); if(modal && content) { modal.classList.add('opacity-0'); content.classList.remove('scale-100'); content.classList.add('opacity-0', 'scale-95'); setTimeout(() => { modal.classList.add('hidden'); }, 200); }
}
async function saveEditTransaction() {
    const id = document.getElementById('editId').value; const client = document.getElementById('editClient').value; const plate = document.getElementById('editPlate').value; const amount = document.getElementById('editAmount').value; const method = document.getElementById('editMethod').value; const periodType = document.getElementById('editPeriodType').value; const periodQty = document.getElementById('editPeriodQty').value; const date = document.getElementById('editDate').value;
    try { const res = await fetch('/api/caja', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, client, plate, amount, method, period_type: periodType, period_quantity: periodQty, date }) }); if (!res.ok) throw new Error((await res.json()).error); alert("Actualizado"); closeEditModal(); loadData(); } catch (error) { alert("Error: " + error.message); }
}
async function deleteTransaction(id) {
    if(!confirm("¿Anular este cobro?")) return; try { const res = await fetch(`/api/caja?id=${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error("Error al eliminar"); alert("Transacción anulada"); loadData(); } catch (error) { alert("Error: " + error.message); }
}
function updateKPIs() {
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0); const cash = transactions.filter(t => t.method === 'Efectivo').reduce((sum, t) => sum + Number(t.amount), 0); const card = transactions.filter(t => t.method !== 'Efectivo').reduce((sum, t) => sum + Number(t.amount), 0);
    const elTotal = document.getElementById('kpiTotal'); const elCash = document.getElementById('kpiCash'); const elCard = document.getElementById('kpiCard'); const elCount = document.getElementById('kpiCount');
    if(elTotal) elTotal.innerText = `$${total.toLocaleString('es-CO')}`; if(elCash) elCash.innerText = `$${cash.toLocaleString('es-CO')}`; if(elCard) elCard.innerText = `$${card.toLocaleString('es-CO')}`; if(elCount) elCount.innerText = transactions.length;
}
function printReceipt(id) {
    const tx = transactions.find(t => t.id === id); if(tx) createPDF(tx);
} 