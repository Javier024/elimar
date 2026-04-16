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
    
    checkUrlParamsAndFillData();

    if (deudoresRes.ok) {
        const deudoresData = await deudoresRes.json();
        renderDeudoresList(deudoresData.rows);
    } else {
        const container = document.getElementById('deudoresList');
        if(container) container.innerHTML = '<div class="text-center text-slate-400 text-xs py-2 font-medium">Error cargando deudores</div>';
    }

    renderTable();
    updateKPIs();

  } catch (error) {
    console.error("Error cargando datos de caja:", error);
    const tbody = document.getElementById('listaCajaBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 py-4">Error al cargar datos</td></tr>';
  }
}

// --- FUNCIÓN AYUDANTE: BUSCAR PUESTO ACTIVO ---
function findActiveSpot(plateToFind) {
    if (!plateToFind) return null;
    return spots.find(s => {
        if (s.estado !== 'ocupado') return false;
        if (s.cliente_placa === plateToFind) return true;
        if (s.puesto_info) {
            try {
                const info = JSON.parse(s.puesto_info);
                if (info.placa && info.placa === plateToFind) return true;
            } catch (e) { console.error("Error parseando puesto_info:", e); }
        }
        return false;
    });
}

// --- FUNCIÓN CLAVE: LLENAR DATOS DESDE PUESTOS ---
function checkUrlParamsAndFillData() {
    const params = new URLSearchParams(window.location.search);
    
    const plate = params.get('plate');
    const spot = params.get('spot');
    let clientName = params.get('client');
    const phone = params.get('phone');
    let entryTimestamp = params.get('entry'); 
    const amountParam = params.get('amount');
    const periodParam = params.get('period');
    const renewParam = params.get('renew');

    if (!plate) return;

    document.getElementById('cajaPlaca').value = plate;
    document.getElementById('cajaPuesto').value = spot || "---";
    if (clientName) document.getElementById('cajaCliente').value = decodeURIComponent(clientName);
    if (phone) document.getElementById('cajaTelefono').value = phone;

    const entryDisplay = document.getElementById('cajaFechaEntradaDisplay');
    const hiddenEntry = document.getElementById('cajaEntryTimestamp');
    
    let finalTimestamp = null;

    if (entryTimestamp) {
        finalTimestamp = entryTimestamp;
    } else if (hiddenEntry.value) {
        finalTimestamp = hiddenEntry.value;
    }

    if (!finalTimestamp && plate) {
        const activeSpot = findActiveSpot(plate);
        if (activeSpot && activeSpot.hora_inicio) {
            finalTimestamp = activeSpot.hora_inicio;
        }
    }

    if (entryDisplay && finalTimestamp) {
        try {
            const ts = Number(finalTimestamp);
            if (!isNaN(ts)) {
                const fechaObj = new Date(ts * 1000);
                if (!isNaN(fechaObj.getTime())) {
                    const dia = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    entryDisplay.value = `Entró: ${dia} ${hora}`;
                    hiddenEntry.value = finalTimestamp;
                } else {
                    entryDisplay.value = "Fecha inválida";
                }
            } else {
                entryDisplay.value = "Formato inválido";
            }
        } catch(e) {
            entryDisplay.value = "Error de fecha";
            console.error(e);
        }
    } else if (entryDisplay) {
        entryDisplay.value = "Sin registro";
    }

    const montoInput = document.getElementById('cajaMonto');
    const periodSelect = document.getElementById('cajaPeriodType');
    let montoFinal = 0;

    if (amountParam && parseFloat(amountParam) > 0) {
        montoFinal = amountParam;
    } else {
        const clientData = clients.find(c => c.placa === plate);
        if (clientData && clientData.cuota_mensual > 0) {
            montoFinal = clientData.cuota_mensual;
        }
    }
    montoInput.value = montoFinal;

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

    const submitBtn = document.querySelector('form button[type="submit"]');
    
    if (renewParam === 'false') {
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-money-bill-wave mr-2"></i> Registrar Pago Final (Salida)';
            submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            submitBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        }
    } else {
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-money-bill-wave mr-2"></i> Registrar Pago (Renovación)';
            submitBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            submitBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        }
        if (periodSelect) {
            periodSelect.disabled = false;
        }
    }

    window.history.replaceState({}, document.title, "caja.html");
    setTimeout(() => montoInput.focus(), 300);
}

// --- PRELLENAR DESDE DEUDORES ---
window.preFillFromDebtor = function(plate, nombre, telefono) {
    document.getElementById('cajaPlaca').value = plate;
    document.getElementById('cajaCliente').value = nombre;
    document.getElementById('cajaTelefono').value = telefono;
    
    const submitBtn = document.querySelector('form button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-money-bill-wave mr-2"></i> Registrar Cobro';
        submitBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        submitBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    }
    const periodSelect = document.getElementById('cajaPeriodType');
    if (periodSelect) periodSelect.disabled = false;

    const activeSpot = findActiveSpot(plate);
    const hiddenEntry = document.getElementById('cajaEntryTimestamp');
    
    if (activeSpot) {
        document.getElementById('cajaPuesto').value = activeSpot.numero;
        if (hiddenEntry && !hiddenEntry.value) hiddenEntry.value = activeSpot.hora_inicio;
        
        if (activeSpot.hora_inicio) {
             const ts = Number(activeSpot.hora_inicio);
             const fechaObj = new Date(ts * 1000);
             const dia = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
             const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
             document.getElementById('cajaFechaEntradaDisplay').value = `Entró: ${dia} ${hora}`;
        }
    } else {
        document.getElementById('cajaPuesto').value = "---";
        document.getElementById('cajaFechaEntradaDisplay').value = "Sin registro";
    }

    document.querySelector('.sticky.top-4')?.scrollIntoView({ behavior: 'smooth' });
    
    const clientData = clients.find(c => c.placa === plate);
    if (clientData) {
        document.getElementById('cajaMonto').value = clientData.cuota_mensual || 0;
    }
    setTimeout(() => document.getElementById('cajaMonto')?.focus(), 500);
};

// --- RENDERIZAR LISTA DE DEUDORES ---
// --- RENDERIZAR LISTA DE DEUDORES ---
function renderDeudoresList(deudores) {
    const container = document.getElementById('deudoresList');
    if(!container) return;

    if (!deudores || deudores.length === 0) {
        container.innerHTML = '<div class="text-center text-emerald-600 dark:text-emerald-400 text-xs py-2 font-medium">¡Todos al día! 🎉</div>';
        return;
    }

    let html = '';
    deudores.forEach(d => {
        const phoneClean = d.telefono ? d.telefono.replace(/\D/g, '') : '';
        const whatsappMsg = generarMensajeDeudorWhatsApp(d.nombre, d.placa, d.cuota_mensual, d.medio_pago);
        const whatsappLink = phoneClean ? `https://wa.me/57${phoneClean}?text=${encodeURIComponent(whatsappMsg)}` : '#';
        
        html += `
            <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600/50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div class="flex-1">
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-200">${d.nombre}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">${d.placa}</p>
                </div>
                <div class="flex items-center gap-2">
                    <a href="${whatsappLink}" target="_blank" class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full transition-colors" title="Enviar WhatsApp">
                        <i class="fa-brands fa-whatsapp text-lg"></i>
                    </a>
                    <button onclick="preFillFromDebtor('${d.placa}', '${d.nombre.replace(/'/g, "\\'")}', '${d.telefono || ''}')" class="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors" title="Ir a Cobrar">
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
        option.setAttribute('data-plate', client.placa || ''); 
        option.setAttribute('data-medio', client.medio_pago || 'Noche');
        option.setAttribute('data-vehiculo', client.tipo_vehiculo || 'Carro'); 
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
                const hiddenEntry = document.getElementById('cajaEntryTimestamp');

                if(phoneInput) phoneInput.value = phone;
                if(plateInput) plateInput.value = plate;
                
                const activeSpot = findActiveSpot(plate);
                
                if (activeSpot) {
                    if(spotInput) spotInput.value = activeSpot.numero;
                    if (dateDisplay && activeSpot.hora_inicio) {
                        const ts = Number(activeSpot.hora_inicio);
                        const fechaObj = new Date(ts * 1000);
                        const dia = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                        const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        dateDisplay.value = `Entró: ${dia} ${hora}`;
                    }
                    if(hiddenEntry && !hiddenEntry.value) hiddenEntry.value = activeSpot.hora_inicio;
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
    
    if (pageData.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400 dark:text-slate-500">No hay transacciones</td></tr>'; return; }

    pageData.forEach(tx => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700/50 transition-colors";
        const fechaPago = tx.date || '---';
        const horaPago = tx.time || '';
        
        let entradaStr = "No disponible";
        let tsToUse = null;

        if (tx.entrada_timestamp) {
            tsToUse = Number(tx.entrada_timestamp);
        } else {
            const activeSpot = findActiveSpot(tx.plate);
            if (activeSpot && activeSpot.hora_inicio) {
                tsToUse = Number(activeSpot.hora_inicio);
            }
        }

        if (tsToUse && !isNaN(tsToUse)) {
            try {
                const dateObj = new Date(tsToUse * 1000);
                if (!isNaN(dateObj.getTime())) {
                    entradaStr = `${dateObj.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'2-digit'})} ${dateObj.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}`;
                }
            } catch(e) {
                console.error("Error fecha entrada:", e);
                entradaStr = "Error formato";
            }
        }
        
        let vehicleType = tx.cliente_tipo_vehiculo || '---';
        if (vehicleType === '---') {
             const localClient = clients.find(c => c.placa === tx.plate);
             if (localClient) vehicleType = localClient.tipo_vehiculo || '---';
        }

        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="text-sm font-medium text-slate-900 dark:text-slate-200">${fechaPago}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">${horaPago}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Entrada</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">${entradaStr}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-slate-900 dark:text-slate-200">${tx.client}</div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><i class="fa-solid fa-phone text-[10px]"></i> ${tx.phone || '---'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <span class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded uppercase">${tx.plate.toUpperCase()}</span>
                        <span class="text-[10px] text-slate-400 dark:text-slate-500">Puesto: ${tx.spot}</span>
                    </div>
                    <span class="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 w-fit px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                        <i class="fa-solid fa-car-side"></i> ${vehicleType}
                    </span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${tx.method === 'Efectivo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}">${tx.method}</span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="text-sm font-bold text-slate-900 dark:text-slate-200">$${Number(tx.amount).toLocaleString('es-CO')}</div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400">${tx.period_type || ''} x${tx.period_quantity || 1}</div>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="printReceipt(${tx.id})" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 mr-2" title="Imprimir Factura"><i class="fa-solid fa-print"></i></button>
                <button onclick="editTransaction(${tx.id})" class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mr-2" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteTransaction(${tx.id})" class="text-red-400 hover:text-red-600 dark:hover:text-red-400" title="Anular"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    if(btnPrev) btnPrev.disabled = currentPage === 1;
    if(btnNext) btnNext.disabled = currentPage === totalPages;
}

function changePage(direction) {
    const filtered = transactions.filter(t => {
        const searchVal = document.getElementById('searchInput')?.value || '';
        return t.client.toLowerCase().includes(searchVal.toLowerCase()) || t.plate.toLowerCase().includes(searchVal.toLowerCase());
    });
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    } else if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
    }
    renderTable(document.getElementById('searchInput')?.value || '');
}

// --- FACTURACIÓN ---

async function printReceipt(id) {
    const tx = transactions.find(t => t.id === id);
    if(!tx) return;

    const clientData = clients.find(c => c.placa === tx.plate);
    const vehicleType = tx.cliente_tipo_vehiculo || (clientData ? clientData.tipo_vehiculo : 'Carro'); 

    let entryDate = null;
    let tsToUse = null;

    if (tx.entrada_timestamp) {
        tsToUse = Number(tx.entrada_timestamp);
    } else {
        const activeSpot = findActiveSpot(tx.plate);
        if (activeSpot && activeSpot.hora_inicio) {
            tsToUse = Number(activeSpot.hora_inicio);
        }
    }

    if (tsToUse && !isNaN(tsToUse)) {
        entryDate = new Date(tsToUse * 1000);
    }

    const exitDate = new Date(); 
    const dueDate = new Date(tx.date || exitDate);
    const period = tx.period_type || 'Noche';
    const qty = tx.period_quantity || 1;
    
    if (period === 'Noche' || period === 'Dias') dueDate.setDate(dueDate.getDate() + qty);
    else if (period === 'Semana') dueDate.setDate(dueDate.getDate() + (qty * 7));
    else if (period === 'Mes') dueDate.setMonth(dueDate.getMonth() + qty);
    else dueDate.setDate(dueDate.getDate() + 15);

    const enrichedData = {
        ...tx,
        vehicleType: vehicleType,
        entryDate: entryDate,
        exitDate: exitDate,
        dueDate: dueDate,
        validatedPhone: clientData ? clientData.telefono : tx.phone
    };

    createPDF(enrichedData);
}

async function generarFacturaDesdeFormulario() {
    const client = document.getElementById('cajaCliente').value;
    const plate = document.getElementById('cajaPlaca').value;
    const amount = document.getElementById('cajaMonto').value;
    const method = document.getElementById('cajaMetodo').value;
    const periodType = document.getElementById('cajaPeriodType').value;
    const periodQty = document.getElementById('cajaPeriodQty').value;
    const date = document.getElementById('cajaDate').value;
    const spot = document.getElementById('cajaPuesto').value;
    const phone = document.getElementById('cajaTelefono').value;
    const entryTimestampVal = document.getElementById('cajaEntryTimestamp').value;

    if (!client || !amount) { alert("Complete los datos básicos para generar la factura."); return false; }
    
    const clientData = clients.find(c => c.placa === plate);
    const vehicleType = clientData ? (clientData.tipo_vehiculo || 'Carro') : 'Carro';
    
    let entryDate = null;
    if (entryTimestampVal) {
        const ts = Number(entryTimestampVal);
        if (!isNaN(ts)) {
            entryDate = new Date(ts * 1000);
        } else {
            const d = new Date(entryTimestampVal);
            if (!isNaN(d.getTime())) {
                entryDate = d;
            }
        }
    } else {
        const activeSpot = findActiveSpot(plate);
        if (activeSpot && activeSpot.hora_inicio) {
            entryDate = new Date(Number(activeSpot.hora_inicio) * 1000);
        }
    }

    const exitDate = new Date(); 
    const dueDate = new Date(date);
    if (periodType === 'Noche' || periodType === 'Dias') dueDate.setDate(dueDate.getDate() + parseInt(periodQty));
    else if (periodType === 'Semana') dueDate.setDate(dueDate.getDate() + (parseInt(periodQty) * 7));
    else if (periodType === 'Mes') dueDate.setMonth(dueDate.getMonth() + parseInt(periodQty));
    
    let finalPeriodType = periodType;
    if(periodType === 'Cierre') finalPeriodType = 'Cierre de Cuenta';

    createPDF({ 
        id: Date.now(), 
        client, 
        phone: phone, 
        plate, 
        spot, 
        amount, 
        method, 
        period_type: finalPeriodType, 
        period_quantity: periodQty, 
        date, 
        vehicleType,
        entryDate: entryDate,
        exitDate: exitDate,
        dueDate: dueDate,
        validatedPhone: clientData ? clientData.telefono : phone
    });
    return true; 
}

// --- FUNCIÓN PRINCIPAL DE PDF ---
async function createPDF(data) {
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF({ unit: 'mm', format: 'letter' }); 
    
    const pageWidth = doc.internal.pageSize.getWidth(); 
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin; 

    const logoW = 80;
    const logoH = 32;
    const logoX = margin;
    const logoY = margin;
    const maxFade = 8; 

    try {
        doc.addImage('/img/logo.jpg', 'JPEG', logoX, logoY, logoW, logoH); 
    } catch (err) {
        console.error("Error cargando imagen banner:", err);
        doc.setFillColor(20, 50, 80);
        doc.roundedRect(logoX, logoY, logoW, logoH, 4, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("ELIMAR", logoX + logoW / 2, logoY + logoH / 2 + 5, { align: 'center' });
    }

    const fadeSteps = 18;
    for (let i = 0; i < fadeSteps; i++) {
        const progress = (i + 1) / fadeSteps;
        const inset = progress * maxFade;
        const alpha = 0.2 * (1 - progress);
        
        try {
            const gs = new doc.GState({ opacity: alpha });
            doc.setGState(gs);
            doc.setFillColor(255, 255, 255);
            doc.rect(logoX, logoY, logoW, inset, 'F');
            doc.rect(logoX, logoY + logoH - inset, logoW, inset, 'F');
            doc.rect(logoX, logoY, inset, logoH, 'F');
            doc.rect(logoX + logoW - inset, logoY, inset, logoH, 'F');
        } catch(e) {
            console.error("Error con GState:", e);
        }
    }
    
    try {
        doc.setGState(new doc.GState({ opacity: 1 }));
    } catch(e) {}

    const textBlockX = logoX + logoW + 12;
    const textBlockTopY = logoY + 5;

    doc.setTextColor(20, 50, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PARQUEADERO ELIMAR", textBlockX, textBlockTopY);

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.text("NIT: 1044212776", textBlockX, textBlockTopY + 7);
    doc.text("Cll 20 N° 4-81 Barrio San José", textBlockX, textBlockTopY + 12);
    doc.text("Sahagún, Córdoba", textBlockX, textBlockTopY + 17);
    doc.text("Tel: 3206753900 - 3206641353", textBlockX, textBlockTopY + 22);
    doc.setTextColor(30, 120, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Abierto 24/7", textBlockX, textBlockTopY + 28);

    y = logoY + logoH + 8;
    doc.setDrawColor(20, 50, 80);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(20, 50, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RECIBO DE PAGO", pageWidth / 2, y + 8, { align: 'center' });
    y += 18;

    const now = new Date();
    const col1X = margin;
    const col2X = pageWidth / 2 + 5;
    const valOffset = 42;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("FECHA PAGO", col1X, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const dateObj = data.date ? new Date(data.date + 'T12:00:00') : now;
    const dateStr = dateObj.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'numeric'});
    const timeStr = now.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    doc.text(`${dateStr}  ${timeStr}`, col1X + valOffset, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("# RECIBO", col1X, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(`${data.id || '---'}`, col1X + valOffset, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("CLIENTE", col1X, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    let clientName = data.client || '---';
    if(clientName.length > 30) clientName = clientName.substring(0, 27) + '...';
    doc.text(clientName, col1X + valOffset, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("TELÉFONO", col1X, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(data.validatedPhone || data.phone || '---', col1X + valOffset, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("ENTRADA", col1X, y);
    doc.setFont("helvetica", "normal");
    let entryDateText = "No disponible";
    if (data.entryDate) {
        const d = data.entryDate;
        entryDateText = `${d.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'numeric'})}  ${d.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}`;
    }
    doc.setTextColor(data.entryDate ? 30 : 160);
    doc.text(entryDateText, col1X + valOffset, y);

    let col2Y = y - 28;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("PLACA", col2X, col2Y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 50, 80);
    doc.setFontSize(14);
    doc.text(`${(data.plate || '---').toUpperCase()}`, col2X + valOffset, col2Y);
    doc.setFontSize(10);

    col2Y += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("VEHÍCULO", col2X, col2Y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(`${data.vehicleType || '---'}`, col2X + valOffset, col2Y);

    col2Y += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("PUESTO", col2X, col2Y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(`${data.spot || '---'}`, col2X + valOffset, col2Y);

    col2Y += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("PERIODO", col2X, col2Y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(`${data.period_type || 'Noche'} x ${data.period_quantity || 1}`, col2X + valOffset, col2Y);

    col2Y += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 120, 120);
    doc.text("SALIDA/PAGO", col2X, col2Y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const exitDateStr = `${now.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'numeric'})}  ${now.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}`;
    doc.text(exitDateStr, col2X + valOffset, col2Y);

    y += 12;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setTextColor(20, 50, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DETALLE DEL SERVICIO", margin, y);
    y += 8;

    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y - 3, contentWidth, 7, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPCIÓN", margin + 3, y + 1);
    doc.text("TIEMPO", margin + contentWidth - 60, y + 1);
    doc.text("VALOR", margin + contentWidth - 5, y + 1, { align: 'right' });
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const desc = `Servicio de Parqueadero (${data.spot || 'General'}) - ${data.period_type || 'Noche'}`;
    const splitDesc = doc.splitTextToSize(desc, contentWidth - 65); 
    doc.text(splitDesc, margin + 3, y);

    const periodQtyText = `${data.period_quantity || 1} ${data.period_type || 'Noche'}`;
    doc.text(periodQtyText, margin + contentWidth - 58, y + ((splitDesc.length - 1) * 4));
    
    const amountStr = `$${Number(data.amount).toLocaleString('es-CO')}`;
    doc.setFont("helvetica", "bold");
    doc.text(amountStr, margin + contentWidth - 5, y + ((splitDesc.length - 1) * 4), { align: 'right' });

    y += (splitDesc.length * 4.5) + 15;

    const totalBoxWidth = contentWidth;
    const totalBoxHeight = 22;
    const totalBoxX = margin;

    doc.setFillColor(20, 50, 80);
    doc.roundedRect(totalBoxX, y, totalBoxWidth, totalBoxHeight, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setTextColor(200, 220, 240);
    doc.setFont("helvetica", "normal");
    doc.text("TOTAL A PAGAR", totalBoxX + 8, y + 9);
    doc.text(`MÉTODO: ${data.method || 'Efectivo'}`, totalBoxX + 8, y + 16);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(amountStr, totalBoxX + totalBoxWidth - 8, y + 15, { align: 'right' });

    y += totalBoxHeight + 15;

    doc.setDrawColor(150, 150, 150);
    doc.setLineDash([3, 3], 0); 
    doc.line(margin + 10, y, pageWidth - margin - 10, y);
    doc.setLineDash([], 0);
    y += 8;

    const centerX = pageWidth / 2;
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.setFont("helvetica", "normal");

    const footerLines = [
        "Parqueadero EliMar · NIT: 1044212776 · Sahagún, Córdoba",
        "Cll 20 N° 4-81 Barrio San José · Tel: 3206753900 - 3206641353",
        "Este documento certifica el pago realizado, cualquier inquietud no dude en comunicarse con nosotros."
    ];

    footerLines.forEach(line => {
        doc.text(line, centerX, y, { align: 'center' });
        y += 4;
    });

    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin + 20, y, pageWidth - margin - 20, y);
    y += 5;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    const msg = "¡Gracias por preferirnos! Su satisfacción es nuestra prioridad.";
    const splitMsg = doc.splitTextToSize(msg, contentWidth - 20);
    doc.text(splitMsg, centerX, y, { align: 'center' });

    y += (splitMsg.length * 4) + 8;

    doc.setFontSize(6);
    doc.setTextColor(200, 200, 200);
    doc.text("© " + new Date().getFullYear() + " Parqueadero EliMar. Todos los derechos reservados.", centerX, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
}

// --- FORMULARIO ---
async function handleCustomPeriod(e) {
    const typeSelect = document.getElementById('cajaPeriodType');
    if (typeSelect.value === 'Otro') { 
        const customVal = document.getElementById('cajaPeriodCustom').value; 
        if (!customVal.trim()) { 
            e.preventDefault(); 
            alert('Concepto personalizado requerido'); 
            return false; 
        } 
        typeSelect.value = customVal; 
    }
    
    const checkFactura = document.getElementById('checkFactura');
    if (checkFactura && checkFactura.checked) { 
        const facturaGenerada = await generarFacturaDesdeFormulario(); 
        if (!facturaGenerada) return; 
    }
    registrarCobro(e);
}

// --- REGISTRAR COBRO ---
async function registrarCobro(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); 
    const originalText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    
    const client = document.getElementById('cajaCliente').value;
    const plate = document.getElementById('cajaPlaca').value;
    const spot = document.getElementById('cajaPuesto').value;
    const phone = document.getElementById('cajaTelefono').value;
    const amount = document.getElementById('cajaMonto').value;
    const method = document.getElementById('cajaMetodo').value;
    const periodType = document.getElementById('cajaPeriodType').value;
    const periodQty = document.getElementById('cajaPeriodQty').value;
    const date = document.getElementById('cajaDate').value;
    
    let entrada_timestamp = document.getElementById('cajaEntryTimestamp').value;
    
    if (!entrada_timestamp && plate) {
        const activeSpot = findActiveSpot(plate);
        if (activeSpot && activeSpot.hora_inicio) {
            entrada_timestamp = activeSpot.hora_inicio;
            document.getElementById('cajaEntryTimestamp').value = entrada_timestamp;
        }
    }

    let isRenewal = true;
    if (periodType === 'Cierre') {
        isRenewal = false;
    }

    try {
        const res = await fetch('/api/caja', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                client, 
                plate, 
                spot, 
                phone, 
                amount, 
                method, 
                period_type: periodType, 
                period_quantity: periodQty, 
                date, 
                entrada_timestamp,
                renew: isRenewal 
            }) 
        }); 
        const result = await res.json(); 
        if (!res.ok) throw new Error(result.error || 'Error al registrar');

        try {
            const horaAhora = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            const clientData = clients.find(c => c.placa === plate);
            const tipoVehiculo = clientData ? (clientData.tipo_vehiculo || '') : '';

            const detalleSpot = [
                client ? ('c:' + client) : '',
                spot && spot !== '---' ? ('p:' + spot) : '',
                method ? ('m:' + method) : '',
                periodType ? ('t:' + periodType) : '',
                periodQty ? ('n:' + periodQty) : '',
                tipoVehiculo ? ('v:' + tipoVehiculo) : ''
            ].filter(Boolean).join('|');

            const historialRes = await fetch('/api/historial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plate: (plate || '---').trim(),
                    type: 'pago_caja',
                    spot: detalleSpot,
                    entry: horaAhora,
                    date: date,
                    paid: parseFloat(amount) || 0,
                    exit: null
                })
            });

            if (!historialRes.ok) {
                const errData = await historialRes.json().catch(() => ({}));
                console.warn("Historial no guardado:", errData.detalle || errData.error || historialRes.status);
            }
        } catch (histErr) {
            console.warn("Error secundario guardando en historial (el cobro ya quedó registrado):", histErr);
        }
        
        alert("Cobro registrado con éxito"); 
        e.target.reset(); 
        document.getElementById('cajaDate').valueAsDate = new Date(); 
        loadData(); 
    } catch (error) { 
        alert("Error: " + error.message); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = originalText; 
    }
}

// ============================================
// --- EDITAR TRANSACCIÓN (FUNCIONES AGREGADAS) ---
// ============================================

async function editTransaction(id) {
    // Buscar en la lista local primero
    let tx = transactions.find(t => t.id === id);
    
    // Si no está, hacer fetch a la API
    if (!tx) {
        try {
            const res = await fetch(`/api/caja?id=${id}`);
            if (!res.ok) throw new Error('No encontrado');
            tx = await res.json();
        } catch (error) {
            alert('Error al cargar transacción: ' + error.message);
            return;
        }
    }
    
    // Llenar campos del modal
    document.getElementById('editId').value = tx.id;
    document.getElementById('editDate').value = tx.date || '';
    document.getElementById('editAmount').value = tx.amount || 0;
    document.getElementById('editClient').value = tx.client || '';
    document.getElementById('editPlate').value = tx.plate || '';
    document.getElementById('editMethod').value = tx.method || 'Efectivo';
    document.getElementById('editPeriodType').value = tx.period_type || 'Noche';
    document.getElementById('editPeriodQty').value = tx.period_quantity || 1;
    
    // Mostrar modal con animación
    const modal = document.getElementById('modalEdit');
    const content = document.getElementById('modalEditContent');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Timeout para permitir que el DOM se actualice antes de animar
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeEditModal() {
    const modal = document.getElementById('modalEdit');
    const content = document.getElementById('modalEditContent');
    
    // Animación de salida
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    modal.classList.add('opacity-0');
    
    // Esperar a que termine la animación para ocultar
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
        // Resetear estado para próxima apertura
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95', 'opacity-0');
    }, 200);
}

async function saveEditTransaction() {
    const id = document.getElementById('editId').value;
    const date = document.getElementById('editDate').value;
    const amount = document.getElementById('editAmount').value;
    const client = document.getElementById('editClient').value;
    const plate = document.getElementById('editPlate').value;
    const method = document.getElementById('editMethod').value;
    const periodType = document.getElementById('editPeriodType').value;
    const periodQty = document.getElementById('editPeriodQty').value;
    
    // Validaciones
    if (!client || client.trim() === '') {
        alert('El nombre del cliente es requerido');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        alert('El monto debe ser mayor a 0');
        return;
    }
    
    // Deshabilitar botón mientras guarda
    const saveBtn = document.querySelector('#modalEdit button[onclick="saveEditTransaction()"]');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Guardando...';
    
    try {
        const res = await fetch('/api/caja', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                client: client.trim(),
                plate: plate.toUpperCase(),
                amount: parseFloat(amount),
                method,
                period_type: periodType,
                period_quantity: parseInt(periodQty) || 1,
                date
            })
        });
        
        const result = await res.json();
        
        if (!res.ok) {
            throw new Error(result.error || 'Error al actualizar');
        }
        
        alert('Transacción actualizada correctamente');
        closeEditModal();
        loadData(); // Recargar datos
        
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Restaurar botón
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

// ============================================
// --- ELIMINAR TRANSACCIÓN ---
// ============================================

async function deleteTransaction(id) {
    if(!confirm("¿Anular este cobro?")) return; 

    const tx = transactions.find(t => t.id === id);

    try { 
        const res = await fetch(`/api/caja?id=${id}`, { method: 'DELETE' }); 
        if (!res.ok) throw new Error("Error al eliminar"); 
        
        // Registrar anulación en historial
        if (tx) {
            try {
                const horaAhora = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                const fechaHoy = new Date().toISOString().split("T")[0];

                const detalleSpot = [
                    tx.client ? ('c:' + tx.client) : '',
                    tx.spot && tx.spot !== '---' ? ('p:' + tx.spot) : '',
                    tx.method ? ('m:' + tx.method) : '',
                    tx.period_type ? ('t:' + tx.period_type) : '',
                    tx.period_quantity ? ('n:' + tx.period_quantity) : ''
                ].filter(Boolean).join('|');

                const anulRes = await fetch('/api/historial', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plate: (tx.plate || '---').trim(),
                        type: 'anulacion_pago',
                        spot: detalleSpot,
                        entry: horaAhora,
                        date: fechaHoy,
                        paid: -(parseFloat(tx.amount) || 0),
                        exit: null
                    })
                });

                if (!anulRes.ok) {
                    const errData = await anulRes.json().catch(() => ({}));
                    console.warn("Anulación en historial no guardada:", errData.detalle || errData.error || anulRes.status);
                }
            } catch (anulErr) {
                console.warn("Error guardando anulación en historial:", anulErr);
            }
        }

        alert("Transacción anulada"); 
        loadData(); 
    } catch (error) { 
        alert("Error: " + error.message); 
    }
}

// --- ACTUALIZAR KPIs ---
function updateKPIs() {
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0); 
    const cash = transactions.filter(t => t.method === 'Efectivo').reduce((sum, t) => sum + Number(t.amount), 0); 
    const card = transactions.filter(t => t.method !== 'Efectivo').reduce((sum, t) => sum + Number(t.amount), 0);
    
    const elTotal = document.getElementById('kpiTotal'); 
    const elCash = document.getElementById('kpiCash'); 
    const elCard = document.getElementById('kpiCard'); 
    const elCount = document.getElementById('kpiCount');
    
    if(elTotal) elTotal.innerText = `$${total.toLocaleString('es-CO')}`; 
    if(elCash) elCash.innerText = `$${cash.toLocaleString('es-CO')}`; 
    if(elCard) elCard.innerText = `$${card.toLocaleString('es-CO')}`; 
    if(elCount) elCount.innerText = transactions.length;
}
