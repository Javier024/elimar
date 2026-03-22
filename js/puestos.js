let allSpots = [];
let clientesCache = [];
let currentFilterStatus = 'todos';
let puestoSeleccionado = null;

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

function calcularVencimiento(fechaInicioStr, medioPago) {
    if (!fechaInicioStr || !medioPago) return { dias: null, alerta: 'text-slate-400', texto: 'Sin info' };
    const inicio = new Date(fechaInicioStr);
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    let diasPago = 0;
    const pago = medioPago.toLowerCase();
    if (pago === 'diario') diasPago = 1;
    else if (pago === 'semanal') diasPago = 7;
    else if (pago === 'quincenal') diasPago = 15;
    else if (pago === 'mensual') diasPago = 30;
    else return { dias: null, alerta: 'text-slate-400', texto: 'Otro' };
    const fechaFin = new Date(inicio);
    fechaFin.setDate(fechaFin.getDate() + diasPago);
    const diffTime = fechaFin - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays < 0) {
        return { dias: diffDays, alerta: 'text-red-600 bg-red-50 border border-red-200', texto: `Vencido hace ${Math.abs(diffDays)} días` };
    } else if (diffDays === 0) {
        return { dias: 0, alerta: 'text-amber-600 bg-amber-50 border border-amber-200', texto: 'Vence Hoy' };
    } else if (diffDays <= 3) {
        return { dias: diffDays, alerta: 'text-amber-600 bg-amber-50 border border-amber-200', texto: `Vence en ${diffDays} días` };
    } else {
        return { dias: diffDays, alerta: 'text-emerald-600 bg-emerald-50 border border-emerald-200', texto: `Vence en ${diffDays} días` };
    }
}

document.addEventListener("DOMContentLoaded", () => {
  cargarPuestos();
  cargarClientesCache();
  const searchInput = document.getElementById("searchInput");
  if(searchInput) searchInput.addEventListener("input", (e) => renderMapa(e.target.value.toLowerCase()));
});

async function cargarClientesCache() {
  try {
    const res = await fetch("/api/clientes");
    if(res.ok) clientesCache = await res.json();
  } catch (e) { console.error("Error cargando clientes", e); }
}

window.filtrarMapa = function(filtro) {
  currentFilterStatus = filtro;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if(btn.dataset.filter === filtro) {
      btn.classList.add('bg-slate-800', 'text-white');
      btn.classList.remove('bg-white', 'text-slate-600', 'border');
    } else {
      btn.classList.remove('bg-slate-800', 'text-white');
      btn.classList.add('bg-white', 'text-slate-600', 'border');
    }
  });
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
      reservados: allSpots.filter(s => s.estado === 'reservado').length,
      total: allSpots.length
    };
    if(document.getElementById('kpi-libres')) document.getElementById('kpi-libres').innerText = kpi.libres;
    if(document.getElementById('kpi-ocupados')) document.getElementById('kpi-ocupados').innerText = kpi.ocupados;
    if(document.getElementById('totalCount')) document.getElementById('totalCount').innerText = kpi.total;
    renderMapa();
  } catch (error) { console.error(error); mostrarToast("Error cargando mapa", "error"); }
}

function renderMapa(busquedaTerm = "") {
  const container = document.getElementById("map-container");
  if(!container) return;
  container.innerHTML = "";

  let datosFiltrados = allSpots;
  if (currentFilterStatus !== 'todos') datosFiltrados = allSpots.filter(s => s.estado === currentFilterStatus);
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
    let colorClass = "parking-card libre"; 
    let infoCliente = '<span class="text-slate-400 text-xs font-medium">Disponible</span>';
    let accionesHTML = '';
    let badgeExtra = '';
    
    let meta = {};
    try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e){}
    let puestoInfo = {};
    try { puestoInfo = JSON.parse(spot.puesto_info || '{}'); } catch(e){}

    const esNocturno = meta.tipo === 'nocturno';
    const tieneLlave = meta.llave && meta.llave.tiene === true;
    
    let duenoOriginalNombre = puestoInfo.nombre || '';
    let diasFuera = 0;

    if (esNocturno && meta.fecha_inicio_nocturno) {
        const inicioNocturno = new Date(meta.fecha_inicio_nocturno);
        const ahora = new Date();
        const diff = ahora - inicioNocturno;
        diasFuera = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        badgeExtra = `<span class="absolute top-2 right-2 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 z-10"><i class="fa-solid fa-moon"></i> NOCTURNO</span>`;
    }

    if (tieneLlave) {
        badgeExtra += `<span class="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 z-10 flex items-center gap-1 shadow-sm"><i class="fa-solid fa-key"></i> LLAVE</span>`;
    }

    // --- ESTADO OCUPADO ---
    if (spot.estado === 'ocupado') {
      colorClass = esNocturno ? "parking-card ocupado border-amber-300" : "parking-card ocupado";
      let nombreActual = spot.cliente_nombre;
      let placaActual = spot.cliente_placa;
      
      if (esNocturno) {
          nombreActual = "Usuario Temporal";
          placaActual = "---";
      }

      let subInfo = `<div class="text-[10px] font-mono text-slate-500 uppercase bg-indigo-50 px-1.5 py-0.5 rounded inline-block border border-indigo-100 text-indigo-700">${placaActual || '---'}</div>`;
      
      let fechaHTML = '';
      let vencimientoHTML = '';
      let fechaInicioPuesto = null;
      if (spot.hora_inicio && !isNaN(spot.hora_inicio)) fechaInicioPuesto = new Date(Number(spot.hora_inicio) * 1000);

      let fechaReg = esNocturno ? puestoInfo.fecha_registro : spot.cliente_fecha_registro;
      let medioPag = esNocturno ? puestoInfo.medio_pago : spot.cliente_medio_pago;

      if (fechaInicioPuesto) {
         const fFormat = fechaInicioPuesto.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
         fechaHTML = `<div class="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><i class="fa-regular fa-calendar"></i> Ingreso: ${fFormat}</div>`;
      }

      if (fechaReg && medioPag) {
          const venc = calcularVencimiento(fechaReg, medioPag);
          vencimientoHTML = `<div class="mt-1 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${venc.alerta}"><i class="fa-solid fa-clock"></i> ${venc.texto}</div>`;
      }

      let llaveInfoHTML = '';
      if (tieneLlave) llaveInfoHTML = `<div class="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1 border border-amber-100 flex items-center gap-1"><i class="fa-solid fa-key"></i> ${meta.llave.desc || 'Sin descripción'}</div>`;

      if (esNocturno) {
          infoCliente = `
            <div class="text-amber-600 text-[10px] font-bold mb-0.5"><i class="fa-solid fa-user-clock"></i> USUARIO TEMPORAL</div>
            <div class="font-bold text-slate-700 text-sm truncate">${nombreActual}</div>
            ${subInfo}
            ${fechaHTML}
            ${llaveInfoHTML}
            ${diasFuera > 0 ? `<div class="mt-1 text-[9px] text-amber-600 font-bold bg-amber-100 px-1 py-0.5 rounded inline-block">Dueño fuera: ${diasFuera} días</div>` : ''}
            <div class="mt-1 text-[9px] text-slate-400 italic">Dueño real: ${duenoOriginalNombre}</div>
            ${vencimientoHTML}
          `;
          accionesHTML = `
            <div class="flex gap-2 mt-2">
                <button onclick="liberarPuesto(${spot.id})" class="flex-1 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold text-xs border border-amber-200">Salir Temp.</button>
                <button onclick="restaurarNocturno(${spot.id})" class="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs shadow-sm">Restaurar</button>
            </div>
          `;
      } else {
          infoCliente = `
            <div class="font-bold text-slate-700 text-sm truncate">${nombreActual}</div>
            ${subInfo}
            ${fechaHTML}
            ${llaveInfoHTML}
            ${vencimientoHTML}
          `;
          accionesHTML = `
            <div class="flex gap-2 mt-2">
                <button onclick="liberarPuesto(${spot.id})" class="flex-1 py-2 bg-white/80 hover:bg-white text-indigo-700 rounded font-bold text-xs border border-indigo-100 shadow-sm">Liberar</button>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2">
                 <button onclick="activarNocturno(${spot.id})" class="py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-semibold"><i class="fa-solid fa-moon"></i> Nocturno</button>
                 <button onclick="gestionarLlave(${spot.id}, ${tieneLlave}, '${(meta.llave ? meta.llave.desc : '').replace(/'/g, "\\'")}')" class="py-1.5 ${tieneLlave ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'} hover:opacity-80 rounded text-[10px] font-semibold border border-transparent"><i class="fa-solid fa-key"></i> Llave</button>
                 <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="py-1.5 text-slate-400 hover:text-indigo-600 text-[10px]"><i class="fa-solid fa-pen"></i> Editar</button>
            </div>
          `;
      }
    } 
    // --- ESTADO RESERVADO ---
    else if (spot.estado === 'reservado') {
      colorClass = "parking-card reservado";
      let fechaRegistroHTML = '';
      if (spot.hora_inicio && !isNaN(spot.hora_inicio)) {
          const fechaObj = new Date(Number(spot.hora_inicio) * 1000);
          const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
          fechaRegistroHTML = `<div class="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><i class="fa-regular fa-calendar"></i> ${fechaFormateada}</div>`;
      }
      infoCliente = `<div class="font-bold text-slate-700 text-sm truncate">Reservado</div><div class="text-[10px] text-purple-600">${spot.cliente_nombre || '---'}</div>${fechaRegistroHTML}`;
      accionesHTML = `
        <div class="flex gap-2 mt-2">
            <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}', '${spot.cliente_placa}')" class="flex-1 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded font-bold text-xs">Ocupar</button>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
             <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="text-slate-400 hover:text-indigo-600 text-xs"><i class="fa-solid fa-pen"></i> Editar</button>
             <button onclick="liberarPuesto(${spot.id})" class="text-slate-400 hover:text-red-500 text-xs"><i class="fa-solid fa-ban"></i> Cancelar</button>
        </div>
      `;
    } 
    // --- ESTADO LIBRE ---
    else {
        if (esNocturno) {
            colorClass = "parking-card libre border-amber-200 bg-amber-50/30";
            let vencimientoHTML = '';
            if (puestoInfo.fecha_registro && puestoInfo.medio_pago) {
                const venc = calcularVencimiento(puestoInfo.fecha_registro, puestoInfo.medio_pago);
                vencimientoHTML = `<div class="mt-1 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${venc.alerta}"><i class="fa-solid fa-clock"></i> ${venc.texto}</div>`;
            }

            // NUEVA LÓGICA: Mostrar último usuario temporal
            let lastTempHTML = '';
            if (puestoInfo.last_temp_user) {
                lastTempHTML = `
                <div class="mt-2 pt-2 border-t border-slate-200 border-dashed">
                    <div class="text-[9px] text-slate-400 uppercase font-bold tracking-wide">Último Temporal</div>
                    <div class="text-[10px] text-slate-600 font-medium truncate">${puestoInfo.last_temp_user.nombre}</div>
                    <div class="text-[9px] text-slate-500 font-mono">${puestoInfo.last_temp_user.placa}</div>
                </div>`;
            }

            infoCliente = `
                <div class="font-bold text-amber-800 text-sm truncate"><i class="fa-solid fa-moon"></i> Libre (Nocturno)</div>
                <div class="text-[10px] text-amber-600">Reservado para: ${duenoOriginalNombre}</div>
                ${diasFuera > 0 ? `<div class="mt-1 text-[9px] text-amber-600 font-bold bg-amber-100 px-1 py-0.5 rounded inline-block">Fuera: ${diasFuera} días</div>` : ''}
                ${vencimientoHTML}
                ${lastTempHTML}
            `;
            accionesHTML = `
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="py-2 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-xs shadow-sm">Asignar Temp.</button>
                    <button onclick="restaurarNocturno(${spot.id})" class="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-xs shadow-sm">Restaurar</button>
                </div>
                <div class="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                     <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="text-slate-400 hover:text-indigo-600 text-xs"><i class="fa-solid fa-pen"></i> Editar</button>
                     <button onclick="eliminarPuesto(${spot.id})" class="text-slate-400 hover:text-red-500 text-xs"><i class="fa-solid fa-trash"></i> Eliminar</button>
                </div>
            `;
        } else {
            accionesHTML = `
            <div class="grid grid-cols-2 gap-2 mt-2">
                <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-xs shadow-sm">Ingreso</button>
                <button onclick="abrirModalAsignar(${spot.id}, '${spot.numero}')" class="py-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-bold text-xs shadow-sm">Reservar</button>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                 <button onclick="editarNumeroPuesto(${spot.id}, '${spot.numero}')" class="text-slate-400 hover:text-indigo-600 text-xs"><i class="fa-solid fa-pen"></i> Editar</button>
                 <button onclick="eliminarPuesto(${spot.id})" class="text-slate-400 hover:text-red-500 text-xs"><i class="fa-solid fa-trash"></i> Eliminar</button>
            </div>
          `;
        }
    }

    const card = document.createElement("div");
    card.className = `bg-white rounded-xl shadow-sm p-0 flex flex-col h-full ${colorClass}`;
    card.innerHTML = `
      <div class="relative flex-1 flex flex-col justify-between p-4">
        ${badgeExtra}
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Puesto</span>
            <h3 class="text-2xl font-bold text-slate-700">${spot.numero}</h3>
          </div>
          <div class="text-2xl opacity-20">
             ${spot.estado === 'ocupado' ? '<i class="fa-solid fa-car-side text-indigo-500"></i>' : (spot.estado === 'reservado' ? '<i class="fa-solid fa-clock text-purple-500"></i>' : '<i class="fa-solid fa-check text-emerald-500"></i>')}
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-100/50">${infoCliente}</div>
      </div>
      <div class="p-3 pt-0 mt-auto bg-white/50 rounded-b-xl">${accionesHTML}</div>
    `;
    container.appendChild(card);
  });
}

window.gestionarLlave = function(id, tieneActual, descActual) {
    const accion = tieneActual 
        ? confirm("Actualmente hay una llave guardada.\n¿Desea RECUPERAR la llave (Borrar registro)?") 
        : confirm("¿El cliente DEJA la llave en el puesto?");
    if (!accion) return; 
    let nuevaInfoLlave = null;
    if (!tieneActual) {
        const desc = prompt("Características de la llave (Color, tipo, marca):", "");
        if (desc === null) return; 
        nuevaInfoLlave = { tiene: true, desc: desc.trim() || "Sin descripción" };
    }
    actualizarInfoLlaveAPI(id, nuevaInfoLlave);
}

async function actualizarInfoLlaveAPI(id, llaveInfo) {
    try {
        const res = await fetch("/api/puestos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, accion: "actualizar_llave", llave_info: llaveInfo })
        });
        const data = await res.json();
        if (data.success) {
            mostrarToast("Información de llave actualizada");
            cargarPuestos();
        } else {
            mostrarToast(data.error || "Error", "error");
        }
    } catch(e) { mostrarToast("Error de conexión", "error"); }
}

window.activarNocturno = async function(id) {
    const spot = allSpots.find(s => s.id === id);
    if (!spot) {
        mostrarToast("Error: No se encontró el puesto", "error");
        return;
    }
    if (spot.estado !== 'ocupado') {
        mostrarToast(`Error: El puesto debe estar OCUPADO para activar nocturno. Actual: ${spot.estado}`, "error");
        return;
    }
    if(!confirm(`¿Activar modo Nocturno en el Puesto ${spot.numero}?\n\nEl dueño (${spot.cliente_nombre}) se guardará y el puesto quedará LIBRE para ingresos temporales.`)) return;
    try {
        console.log("Enviando solicitud nocturno para ID:", id);
        const res = await fetch("/api/puestos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, accion: "activar_nocturno" })
        });
        const data = await res.json();
        if(data.success) {
            mostrarToast("Modo Nocturno activado");
            cargarPuestos();
        } else {
            mostrarToast(data.error || "Error", "error");
            console.error("Error servidor:", data);
        }
    } catch(e) { 
        console.error("Error red:", e);
        mostrarToast("Error de conexión", "error"); 
    }
}

window.restaurarNocturno = async function(id) {
    if(!confirm("¿Restaurar al dueño original?")) return;
    try {
        const res = await fetch("/api/puestos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, accion: "restaurar_nocturno" })
        });
        const data = await res.json();
        if(data.success) {
            mostrarToast("Puesto restaurado");
            cargarPuestos();
        } else {
            mostrarToast(data.error || "Error", "error");
        }
    } catch(e) { mostrarToast("Error de conexión", "error"); }
}

window.eliminarPuesto = async function(id) {
    if(!confirm("¿Eliminar puesto permanentemente?")) return;
    try {
        const res = await fetch("/api/puestos", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            mostrarToast("Puesto eliminado");
            cargarPuestos();
        } else {
            mostrarToast(data.error || "Error al eliminar", "error");
        }
    } catch (e) { console.error(e); mostrarToast("Error de conexión", "error"); }
}

window.editarNumeroPuesto = async function(id, numeroActual) {
    const nuevoNumero = prompt("Nuevo número:", numeroActual);
    if (!nuevoNumero || nuevoNumero === numeroActual) return;
    try {
        const res = await fetch("/api/puestos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, accion: "editar_numero", nuevo_numero: nuevoNumero })
        });
        const data = await res.json();
        if(data.success) {
            mostrarToast("Número actualizado");
            cargarPuestos();
        } else {
            mostrarToast(data.error || "Error al editar", "error");
        }
    } catch (e) { mostrarToast("Error de conexión", "error"); }
}

window.liberarPuesto = async function(id) {
  if (!confirm("¿Liberar puesto?")) return;
  try {
    const res = await fetch("/api/puestos?id=" + id, { method: "PATCH" });
    if (res.ok) {
      mostrarToast("Puesto liberado");
      cargarPuestos();
    } else {
        const err = await res.json();
        mostrarToast(err.error || "Error al liberar", "error");
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

window.abrirModalAsignar = function(id, numero, placaReserva = null) {
  const isReserveMode = event && event.target && event.target.innerText.includes('Reservar');
  puestoSeleccionado = allSpots.find(s => s.id === id);
  if (!puestoSeleccionado) {
      mostrarToast("Error: No se pudo identificar el puesto", "error");
      return;
  }
  document.getElementById("modalNombre").value = '';
  document.getElementById("modalPlaca").value = '';
  document.getElementById("modalTipo").value = '';
  document.getElementById("listaResultadosClientes").classList.add('hidden');
  document.getElementById("modalSpotNumber").innerText = isReserveMode ? "Reservar Puesto #" + numero : "Asignar a Puesto #" + numero;
  document.getElementById('checkKey').checked = false;
  document.getElementById('modalKeyDesc').value = '';
  document.getElementById('keyDetailsDiv').classList.add('hidden');
  const checkReserva = document.getElementById("checkReserva");
  if(checkReserva) checkReserva.checked = isReserveMode || (placaReserva !== null);
  if(placaReserva && puestoSeleccionado.cliente_nombre) {
      document.getElementById("modalNombre").value = puestoSeleccionado.cliente_nombre;
      document.getElementById("modalPlaca").value = placaReserva;
  }
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
  const esReserva = document.getElementById("checkReserva").checked;
  const checkKey = document.getElementById('checkKey').checked;
  let llaveInfo = null;
  if (checkKey) {
      llaveInfo = { tiene: true, desc: document.getElementById('modalKeyDesc').value.trim() };
  }
  if (!puestoSeleccionado || !puestoSeleccionado.id) {
      mostrarToast("Error: Información del puesto perdida. Por favor intente de nuevo.", "error");
      cerrarModalAsignar();
      return;
  }
  if (!nombreInput || !placa) {
    mostrarToast("Debe seleccionar o ingresar un cliente", "error");
    return;
  }
  const placaEnUso = allSpots.find(s => 
    s.cliente_placa === placa && 
    s.estado !== 'libre' && 
    s.id !== puestoSeleccionado.id
  );
  if (placaEnUso) {
    mostrarToast(`Error: La placa ${placa} ya está en el puesto ${placaEnUso.numero}`, "error");
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
        estado: esReserva ? 'reservado' : 'ocupado',
        es_reserva: esReserva,
        llave_info: llaveInfo 
      })
    });
    const dataPuesto = await resPuesto.json();
    if (resPuesto.ok) {
      mostrarToast(esReserva ? "Reserva creada correctamente" : "Vehículo asignado correctamente");
      cerrarModalAsignar();
      cargarPuestos();
    } else {
      console.error("Error API:", dataPuesto);
      mostrarToast(dataPuesto.error || "Error asignando puesto", "error");
    }
  } catch (e) {
    console.error("Error Frontend:", e);
    mostrarToast("Error de conexión", "error");
  }
}