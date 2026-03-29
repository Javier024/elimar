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

    if (!plate) return;

    // 1. Datos básicos
    document.getElementById('cajaPlaca').value = plate;
    document.getElementById('cajaPuesto').value = spot || "---";
    if (clientName) document.getElementById('cajaCliente').value = decodeURIComponent(clientName);
    if (phone) document.getElementById('cajaTelefono').value = phone;

    // 2. FECHA DE ENTRADA / DETALLE (VISUAL)
    const entryDisplay = document.getElementById('cajaFechaEntradaDisplay');
    const hiddenEntry = document.getElementById('cajaEntryTimestamp');
    
    let finalTimestamp = entryTimestamp || hiddenEntry.value || null;

    if (entryDisplay && finalTimestamp) {
        try {
            const ts = Number(finalTimestamp);
            if (!isNaN(ts)) {
                const fechaObj = new Date(ts * 1000);
                if (!isNaN(fechaObj.getTime())) {
                    const dia = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    entryDisplay.value = `Entró: ${dia} ${hora}`;
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

    // Si el campo oculto sigue vacío, usamos la NUEVA FUNCIÓN DE BÚSQUEDA
    if (!hiddenEntry.value && plate) {
        const activeSpot = findActiveSpot(plate);
        
        if (activeSpot && activeSpot.hora_inicio) {
            hiddenEntry.value = activeSpot.hora_inicio;
            const ts = Number(activeSpot.hora_inicio);
            const fechaObj = new Date(ts * 1000);
            const dia = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
            const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            entryDisplay.value = `Entró: ${dia} ${hora}`;
            
            if(document.getElementById('cajaPuesto').value === "---") {
                document.getElementById('cajaPuesto').value = activeSpot.numero;
            }
        }
    }

    // 3. MONTO A COBRAR
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

    window.history.replaceState({}, document.title, "caja.html");
    setTimeout(() => montoInput.focus(), 300);
}

// --- PRELLENAR DESDE DEUDORES ---
window.preFillFromDebtor = function(plate, nombre, telefono) {
    document.getElementById('cajaPlaca').value = plate;
    document.getElementById('cajaCliente').value = nombre;
    document.getElementById('cajaTelefono').value = telefono;
    
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
            <div class="flex items-center justify-between p-3 bg-white border border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
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
        option.setAttribute('data-plate', client.placa || ''); 
        option.setAttribute('data-medio', client.medio_pago || 'Noche');
        // Usamos tipo_vehiculo aquí también
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
    
    if (pageData.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400">No hay transacciones</td></tr>'; return; }

    pageData.forEach(tx => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";
        const fechaPago = tx.date || '---';
        const horaPago = tx.time || '';
        
        // --- LÓGICA MEJORADA PARA FECHA DE ENTRADA ---
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
                    entradaStr = `${dateObj.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'2-digit'})} ${dateObj.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
                }
            } catch(e) {
                console.error("Error fecha entrada:", e);
                entradaStr = "Error formato";
            }
        }
        
        // --- OBTENER TIPO DE VEHÍCULO ---
        // 1. Prioridad: Lo que vino en la query JOIN (cliente_tipo_vehiculo)
        // 2. Si es null, buscar en el cache local de clientes (por si acaso)
        let vehicleType = tx.cliente_tipo_vehiculo || '---';
        if (vehicleType === '---') {
             const localClient = clients.find(c => c.placa === tx.plate);
             if (localClient) vehicleType = localClient.tipo_vehiculo || '---';
        }

        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="text-sm font-medium text-slate-900">${fechaPago}</div>
                <div class="text-xs text-slate-500">${horaPago}</div>
            </td>
            <td class="px-4 py-3">
                <div class="text-xs font-bold text-indigo-600 uppercase mb-1">Entrada</div>
                <div class="text-xs text-slate-500">${entradaStr}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-slate-900">${tx.client}</div>
                <div class="text-[10px] text-slate-500 flex items-center gap-1"><i class="fa-solid fa-phone text-[10px]"></i> ${tx.phone || '---'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-2">
                        <span class="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded uppercase">${tx.plate.toUpperCase()}</span>
                        <span class="text-[10px] text-slate-400">Puesto: ${tx.spot}</span>
                    </div>
                    <span class="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100">
                        <i class="fa-solid fa-car-side"></i> ${vehicleType}
                    </span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${tx.method === 'Efectivo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}">${tx.method}</span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="text-sm font-bold text-slate-900">$${Number(tx.amount).toLocaleString('es-CO')}</div>
                <div class="text-[10px] text-slate-500">${tx.period_type || ''} x${tx.period_quantity || 1}</div>
            </td>
            <td class="px-6 py-4 text-center">
                <button onclick="printReceipt(${tx.id})" class="text-indigo-600 hover:text-indigo-800 mr-2" title="Imprimir Factura"><i class="fa-solid fa-print"></i></button>
                <button onclick="editTransaction(${tx.id})" class="text-slate-400 hover:text-slate-600 mr-2" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteTransaction(${tx.id})" class="text-red-400 hover:text-red-600" title="Anular"><i class="fa-solid fa-trash"></i></button>
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

    // CORRECCIÓN: Usar tx.cliente_tipo_vehiculo o buscar en cache
    const clientData = clients.find(c => c.placa === tx.plate);
    // Prioridad a lo que vino del backend (tx.cliente_tipo_vehiculo), si no, usar cache
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
    // CORRECCIÓN: Usar clientData.tipo_vehiculo
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

    createPDF({ 
        id: Date.now(), 
        client, 
        phone: phone, 
        plate, 
        spot, 
        amount, 
        method, 
        period_type: periodType, 
        period_quantity: periodQty, 
        date, 
        vehicleType,
        entryDate: entryDate,
        exitDate,
        dueDate,
        validatedPhone: clientData ? clientData.telefono : phone
    });
    return true; 
}

// --- FUNCIÓN PRINCIPAL DE PDF (DISEÑO ORIGINAL CORREGIDO) ---
async function createPDF(data) {
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF({ unit: 'mm', format: 'letter' }); 
    
    const pageWidth = doc.internal.pageSize.getWidth(); 
    let y = 0; 

    // --- 1. HEADER (LOGO) ---
    try {
        // Diseño original: Logo a ancho completo
        doc.addImage('/img/logo.jpg', 'JPEG', 0, 0, pageWidth, 45); 
    } catch (err) {
        console.error("Error cargando imagen banner:", err);
        // Fallback
        doc.setFillColor(20, 50, 80); 
        doc.rect(0, 0, pageWidth, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("PARQUEADERO ELIMAR", pageWidth / 2, 25, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("IMAGEN DEL PARQUEADERO", pageWidth / 2, 32, { align: 'center' });
    }

    y = 55; 
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PARQUEADERO ELIMAR", pageWidth / 2, y, { align: 'center' });

    y += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("NIT: 1044212776", pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setFontSize(10);
    doc.text("Cll 20 N° 4-81 BARRIO SAN JOSE, Sahagún, Córdoba", pageWidth / 2, y, { align: 'center' });

    y += 6;
    doc.setTextColor(100, 100, 100);
    doc.text("Tel: 3206753900 - 3206641353", pageWidth / 2, y, { align: 'center' });

    y += 10;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("RECIBO DE PAGO", pageWidth / 2, y, { align: 'center' });

    y += 12;
    const labelX = 25;
    const valueX = 60;
    const label2X = 130;
    const value2X = 160;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    doc.setFont("helvetica", "bold");
    doc.text("FECHA PAGO:", labelX, y);
    doc.setFont("helvetica", "normal");
    const dateStr = data.date ? new Date(data.date + 'T00:00:00').toLocaleDateString('es-CO') : new Date().toLocaleDateString('es-CO');
    doc.text(dateStr, valueX, y);

    doc.setFont("helvetica", "bold");
    doc.text("# RECIBO:", label2X, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.id || '---'}`, value2X, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text("CLIENTE:", labelX, y);
    doc.setFont("helvetica", "normal");
    let clientName = data.client || '---';
    if(clientName.length > 35) clientName = clientName.substring(0, 32) + '...';
    doc.text(clientName, valueX, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text("PLACA:", labelX, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${data.plate.toUpperCase() || '---'}`, valueX, y);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("VEHÍCULO:", label2X, y);
    doc.setFont("helvetica", "normal");
    // CORRECCIÓN: Ahora data.vehicleType tiene el valor correcto
    doc.text(`${data.vehicleType || '---'}`, value2X, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text("PUESTO:", labelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.spot || '---'}`, valueX, y);

    doc.setFont("helvetica", "bold");
    doc.text("PERIODO:", label2X, y);
    doc.setFont("helvetica", "normal");
    const periodInfo = `${data.period_type || 'Noche'} x ${data.period_quantity || 1}`;
    doc.text(periodInfo, value2X, y);
    
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("ENTRADA:", labelX, y);
    doc.setFont("helvetica", "normal");
    
    let entryDateText = "No disponible";
    if (data.entryDate) {
        const d = data.entryDate;
        entryDateText = `${d.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'2-digit'})} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    }
    doc.setTextColor(data.entryDate ? 0 : 150);
    doc.text(entryDateText, valueX, y);
    doc.setTextColor(0); 

    doc.setFont("helvetica", "bold");
    doc.text("SALIDA/PAGO:", label2X, y);
    doc.setFont("helvetica", "normal");
    const exitDateObj = data.date ? new Date(data.date + 'T00:00:00') : new Date();
    const exitDateText = `${exitDateObj.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'2-digit'})}`;
    doc.text(exitDateText, value2X, y);
    
    y += 12;
    doc.setDrawColor(150);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DETALLE DEL SERVICIO", 20, y);
    y += 10;

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("DESCRIPCIÓN", 22, y);
    doc.text("TIEMPO", 120, y);
    doc.text("VALOR", 170, y, { align: 'right' });
    
    y += 5;
    doc.line(20, y, pageWidth - 20, y); 
    y += 2;

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    const desc = `Servicio de Parqueadero (${data.spot || 'General'}) - ${data.period_type || 'Noche'}`;
    const splitDesc = doc.splitTextToSize(desc, 90); 
    doc.text(splitDesc, 22, y);

    const periodQty = `${data.period_quantity || 1} ${data.period_type || 'Noche'}`;
    doc.text(periodQty, 120, y + ((splitDesc.length - 1) * 4));
    
    const amountStr = `$${Number(data.amount).toLocaleString('es-CO')}`;
    doc.text(amountStr, pageWidth - 20, y + ((splitDesc.length - 1) * 4), { align: 'right' });

    y += (splitDesc.length * 5) + 12; 

    const totalBoxWidth = 90;
    const totalBoxHeight = 35;
    const totalBoxX = pageWidth - 20 - totalBoxWidth;

    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.rect(totalBoxX, y, totalBoxWidth, totalBoxHeight);

    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text("TOTAL A PAGAR:", totalBoxX + 5, y + 12);
    doc.text(`MÉTODO: ${data.method || 'Efectivo'}`, totalBoxX + 5, y + 24);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text(amountStr, totalBoxX + totalBoxWidth - 5, y + 22, { align: 'right' });

    y += totalBoxHeight + 15;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    
    const msg = "Gracias por confiar en PARQUEADERO ELIMAR. Para validar la información puede comunicarse con los números registrados en este recibo.";
    const splitMsg = doc.splitTextToSize(msg, pageWidth - 40);
    doc.text(splitMsg, pageWidth / 2, y, { align: 'center' });

    y += (splitMsg.length * 5) + 10;
    doc.setDrawColor(0);
    doc.setLineDash([2, 2], 0); 
    doc.line(10, y, pageWidth - 10, y);
    doc.setLineDash([], 0); 

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

    try {
        const res = await fetch('/api/caja', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ client, plate, spot, phone, amount, method, period_type: periodType, period_quantity: periodQty, date, entrada_timestamp }) 
        }); 
        const result = await res.json(); 
        if (!res.ok) throw new Error(result.error || 'Error al registrar');
        
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

// --- GESTIÓN ---
function editTransaction(id) {
    const tx = transactions.find(t => t.id === id); 
    if(!tx) return;
    const editId = document.getElementById('editId'); 
    const editDate = document.getElementById('editDate'); 
    const editAmount = document.getElementById('editAmount'); 
    const editClient = document.getElementById('editClient'); 
    const editPlate = document.getElementById('editPlate'); 
    const editMethod = document.getElementById('editMethod'); 
    const editPeriodType = document.getElementById('editPeriodType'); 
    const editPeriodQty = document.getElementById('editPeriodQty');
    
    if(editId) editId.value = tx.id; 
    if(editDate) editDate.value = tx.date; 
    if(editAmount) editAmount.value = tx.amount; 
    if(editClient) editClient.value = tx.client; 
    if(editPlate) editPlate.value = tx.plate; 
    if(editMethod) editMethod.value = tx.method; 
    if(editPeriodType) editPeriodType.value = tx.period_type || 'Noche'; 
    if(editPeriodQty) editPeriodQty.value = tx.period_quantity || 1;
    
    const modal = document.getElementById('modalEdit'); 
    const content = document.getElementById('modalEditContent'); 
    if(modal && content) { 
        modal.classList.remove('hidden'); 
        setTimeout(() => { 
            modal.classList.remove('opacity-0'); 
            content.classList.remove('opacity-0', 'scale-95'); 
            content.classList.add('scale-100'); 
        }, 10); 
    }
}

function closeEditModal() {
    const modal = document.getElementById('modalEdit'); 
    const content = document.getElementById('modalEditContent'); 
    if(modal && content) { 
        modal.classList.add('opacity-0'); 
        content.classList.remove('scale-100'); 
        content.classList.add('opacity-0', 'scale-95'); 
        setTimeout(() => { 
            modal.classList.add('hidden'); 
        }, 200); 
    }
}

async function saveEditTransaction() {
    const id = document.getElementById('editId').value; 
    const client = document.getElementById('editClient').value; 
    const plate = document.getElementById('editPlate').value; 
    const amount = document.getElementById('editAmount').value; 
    const method = document.getElementById('editMethod').value; 
    const periodType = document.getElementById('editPeriodType').value; 
    const periodQty = document.getElementById('editPeriodQty').value; 
    const date = document.getElementById('editDate').value;
    
    try { 
        const res = await fetch('/api/caja', { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ id, client, plate, amount, method, period_type: periodType, period_quantity: periodQty, date }) 
        }); 
        if (!res.ok) throw new Error((await res.json()).error); 
        alert("Actualizado"); 
        closeEditModal(); 
        loadData(); 
    } catch (error) { 
        alert("Error: " + error.message); 
    }
}

async function deleteTransaction(id) {
    if(!confirm("¿Anular este cobro?")) return; 
    try { 
        const res = await fetch(`/api/caja?id=${id}`, { method: 'DELETE' }); 
        if (!res.ok) throw new Error("Error al eliminar"); 
        alert("Transacción anulada"); 
        loadData(); 
    } catch (error) { 
        alert("Error: " + error.message); 
    }
}

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