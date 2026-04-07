document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

var allSpots = [];
var clientesCache = [];
var currentFilterStatus = 'todos';
var currentSpotId = null;
var cobroData = null;

function mostrarToast(mensaje, tipo) {
  if (typeof document === 'undefined') return;
  tipo = tipo || 'success';
  var toastExistente = document.getElementById('custom-toast');
  if (toastExistente) toastExistente.remove();
  var toast = document.createElement('div');
  toast.id = 'custom-toast';
  toast.className = 'fixed top-5 right-5 z-[150] px-6 py-4 rounded-xl shadow-2xl border transform transition-all duration-300 max-w-[90%] flex items-center gap-3 ';
  if (tipo === 'error') {
    toast.className += 'bg-red-50 text-red-800 border-red-200';
  } else {
    toast.className += 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  var icon = tipo === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
  toast.innerHTML = icon + ' <span class="font-bold text-sm">' + mensaje + '</span>';
  document.body.appendChild(toast);
  requestAnimationFrame(function() {
    toast.classList.remove('translate-x-full', 'opacity-0');
  });
  setTimeout(function() {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

function toggleModal(modalId, show) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  
  var content = modal.querySelector('[id$="Content"]');
  if (!content) content = modal.children[0];
  
  if (show) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    requestAnimationFrame(function() {
      modal.classList.remove('opacity-0');
      if (content) {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
      }
    });
  } else {
    modal.classList.add('opacity-0');
    if (content) {
      content.classList.add('scale-95', 'opacity-0');
      content.classList.remove('scale-100', 'opacity-100');
    }
    setTimeout(function() {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 200);
  }
}

function calcularTiempo(horaInicioUnix) {
  if (!horaInicioUnix) return "";
  var diff = new Date() - new Date(Number(horaInicioUnix) * 1000);
  var h = Math.floor(diff / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function formatHoraEntrada(timestamp) {
  if (!timestamp) return "---";
  var date = new Date(Number(timestamp) * 1000);
  var dateStr = date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
  var timeStr = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return dateStr + ' ' + timeStr;
}

function calcularDiasFuera(fechaSalidaUnix) {
  if (!fechaSalidaUnix) return 0;
  var diff = Math.floor(Date.now() / 1000) - Number(fechaSalidaUnix);
  return Math.max(0, Math.floor(diff / 86400));
}

function formatDiasFuera(fechaSalidaUnix) {
  var dias = calcularDiasFuera(fechaSalidaUnix);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return '1 día';
  return dias + ' días';
}

function initApp() {
  cargarPuestos();
  cargarClientesCache();
  var searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", function(e) {
    renderMapa(e.target.value.toLowerCase());
  });

  // Actualizar contadores de días cada 60 segundos
  setInterval(function() {
    document.querySelectorAll('[data-fecha-salida]').forEach(function(el) {
      var ts = el.getAttribute('data-fecha-salida');
      if (ts) {
        el.innerText = formatDiasFuera(ts);
      }
    });
  }, 60000);
}

function cargarClientesCache() {
  fetch("/api/clientes")
    .then(function(res) {
      if (res.ok) return res.json();
      return [];
    })
    .then(function(data) {
      clientesCache = data;
    })
    .catch(function(e) {
      console.error("Error cargando clientes:", e);
      clientesCache = [];
    });
}

function cargarPuestos() {
  fetch("/api/puestos")
    .then(function(res) {
      if (!res.ok) throw new Error("Error API");
      return res.json();
    })
    .then(function(data) {
      allSpots = data.sort(function(a, b) {
        return (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0);
      });

      var elLibres = document.getElementById('kpi-libres');
      var elOcupados = document.getElementById('kpi-ocupados');
      var elTotal = document.getElementById('kpi-total');
      if (elLibres) elLibres.innerText = allSpots.filter(function(s) { return s.estado === 'libre'; }).length;
      if (elOcupados) elOcupados.innerText = allSpots.filter(function(s) { return s.estado === 'ocupado'; }).length;
      if (elTotal) elTotal.innerText = allSpots.length;

      renderMapa();
    })
    .catch(function(error) {
      console.error(error);
      mostrarToast("Error cargando datos", "error");
    });
}

function getIconForType(tipo) {
  if (!tipo) return 'fa-car';
  var t = tipo.toLowerCase();
  if (t.includes('moto')) return 'fa-motorcycle';
  if (t.includes('camioneta')) return 'fa-truck-pickup';
  return 'fa-car';
}

window.filtrarMapa = function(f) {
  currentFilterStatus = f;
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    var isTarget = (f === 'todos' && btn.innerText === 'Todos') || btn.dataset.filter === f;
    if (isTarget) {
      btn.classList.add('bg-slate-800', 'text-white');
      btn.classList.remove('bg-white', 'text-slate-600', 'hover:bg-slate-50');
    } else {
      btn.classList.remove('bg-slate-800', 'text-white');
      btn.classList.add('bg-white', 'text-slate-600', 'hover:bg-slate-50');
    }
  });
  var searchInput = document.getElementById("searchInput");
  renderMapa(searchInput ? searchInput.value.toLowerCase() : "");
};

function renderMapa(busqueda) {
  var container = document.getElementById("map-container");
  if (!container) return;
  container.innerHTML = "";

  busqueda = busqueda || "";
  var datos = allSpots;
  if (currentFilterStatus !== 'todos') {
    datos = datos.filter(function(s) { return s.estado === currentFilterStatus; });
  }

  if (busqueda) {
    var term = busqueda.toLowerCase().trim();
    datos = datos.filter(function(s) {
      if (s.numero.toLowerCase().includes(term)) return true;
      if (s.cliente_nombre && s.cliente_nombre.toLowerCase().includes(term)) return true;
      if (s.cliente_placa && s.cliente_placa.toLowerCase().includes(term)) return true;
      try {
        var meta = JSON.parse(s.llave_caracteristicas || '{}');
        if (meta.temp_user) {
          if (meta.temp_user.nombre && meta.temp_user.nombre.toLowerCase().includes(term)) return true;
          if (meta.temp_user.placa && meta.temp_user.placa.toLowerCase().includes(term)) return true;
        }
        if (meta.reservation) {
          if (meta.reservation.nombre && meta.reservation.nombre.toLowerCase().includes(term)) return true;
          if (meta.reservation.placa && meta.reservation.placa.toLowerCase().includes(term)) return true;
        }
      } catch (e) {}
      try {
        var owner = JSON.parse(s.puesto_info || '{}');
        if (owner.nombre && owner.nombre.toLowerCase().includes(term)) return true;
        if (owner.placa && owner.placa.toLowerCase().includes(term)) return true;
      } catch (e) {}
      return false;
    });
  }

  if (datos.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400"><i class="fa-solid fa-ghost text-4xl mb-3 opacity-30"></i><p class="text-sm">No se encontraron puestos</p></div>';
    return;
  }

  var fragment = document.createDocumentFragment();
  datos.forEach(function(spot) {
    var card = document.createElement('div');
    card.className = "group relative bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full";
    card.innerHTML = getCardHTML(spot);
    fragment.appendChild(card);
  });
  container.appendChild(fragment);
}

function getCardHTML(s) {
  var meta = {};
  var ownerInfo = null;
  try { meta = JSON.parse(s.llave_caracteristicas || '{}'); } catch (e) {}
  try { ownerInfo = JSON.parse(s.puesto_info || '{}'); } catch (e) {}

  var isTempUser = !s.cliente_id && meta.temp_user;
  var hasOwner = ownerInfo && ownerInfo.nombre;
  var cardBase = "bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full";
  var borderClass = "border-slate-200";
  var headerHTML = "";
  var bodyHTML = "";
  var actionsHTML = "";

  // === RESERVADO ===
  if (s.estado === 'reservado') {
    borderClass = "border-l-4 border-l-purple-500";
    headerHTML = '<div class="bg-purple-50 px-4 py-2 flex justify-between items-center border-b border-purple-100"><span class="text-xs font-bold text-purple-700 uppercase tracking-wider">Reservado</span><span class="font-bold text-slate-700 text-lg">' + s.numero + '</span></div>';
    bodyHTML = '<div class="p-5 flex-1 flex flex-col items-center justify-center text-center space-y-2"><div class="font-bold text-slate-800">' + (meta.reservation && meta.reservation.nombre ? meta.reservation.nombre : '---') + '</div><div class="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">' + (meta.reservation && meta.reservation.placa ? meta.reservation.placa : '---') + '</div></div>';
    actionsHTML = '<div class="grid grid-cols-2 gap-px bg-slate-100 border-t border-slate-100"><button onclick="ocuparReserva(' + s.id + ')" class="bg-white py-3 text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors">Ocupar</button><button onclick="liberar(' + s.id + ')" class="bg-white py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button></div>';
  }
  // === DUEÑO FUERA (Libre con datos guardados) ===
  else if (s.estado === 'libre' && hasOwner) {
    borderClass = "border-l-4 border-l-amber-400";
    var diasTexto = formatDiasFuera(ownerInfo.fecha_salida);
    var diasDataAttr = ownerInfo.fecha_salida ? ' data-fecha-salida="' + ownerInfo.fecha_salida + '"' : '';
    
    headerHTML = '<div class="bg-amber-50 px-4 py-2 flex justify-between items-center border-b border-amber-100"><span class="text-xs font-bold text-amber-700 uppercase tracking-wider">Dueño Fuera</span><span class="font-bold text-slate-700 text-lg">' + s.numero + '</span></div>';
    bodyHTML = '<div class="p-5 flex-1 flex flex-col items-center justify-center text-center space-y-1">' +
      '<div class="text-xs text-slate-400 uppercase font-semibold">Propietario</div>' +
      '<div class="font-bold text-slate-800">' + ownerInfo.nombre + '</div>' +
      '<div class="text-xs text-slate-500 font-mono">' + (ownerInfo.placa || '') + '</div>' +
      '<div class="mt-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold"' + diasDataAttr + '><i class="fa-solid fa-calendar-days mr-1"></i>Fuera: ' + diasTexto + '</div>' +
      '</div>';
    actionsHTML = '<div class="grid grid-cols-2 gap-px bg-slate-100 border-t border-slate-100">' +
      '<button onclick="abrirModalVisitante()" class="bg-white py-3 text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors"><i class="fa-solid fa-user-plus mr-1"></i>Visitante</button>' +
      '<button onclick="restaurarDueno(' + s.id + ')" class="bg-white py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"><i class="fa-solid fa-rotate mr-1"></i>Restaurar</button>' +
      '</div>';
  }
  // === LIBRE (Sin dueño guardado) ===
  else if (s.estado === 'libre') {
    borderClass = "border-l-4 border-l-emerald-500";
    headerHTML = '<div class="bg-emerald-50 px-4 py-2 flex justify-between items-center border-b border-emerald-100"><span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Disponible</span><span class="font-bold text-slate-700 text-2xl">' + s.numero + '</span></div>';
    bodyHTML = '<div class="p-6 flex-1 flex flex-col items-center justify-center opacity-20"><i class="fa-solid fa-square-parking text-5xl text-slate-800"></i></div>';
    actionsHTML = '<div class="grid grid-cols-1 gap-2">' +
      '<button onclick="abrirModalAsignar(' + s.id + ', \'' + s.numero + '\')" class="bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-user-plus mr-1"></i> Asignar Cliente</button>' +
      '<button onclick="abrirModalVisitante()" class="bg-amber-500 hover:bg-amber-600 text-white py-2.5 text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-user-plus mr-1"></i> Visitante</button>' +
      '<button onclick="abrirModalReservar(' + s.id + ', \'' + s.numero + '\')" class="bg-purple-600 hover:bg-purple-700 text-white py-2.5 text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-bookmark mr-1"></i> Reservar</button>' +
      '</div>';
  }
  // === VISITANTE (Ocupado sin cliente_id) ===
  else if (s.estado === 'ocupado' && isTempUser) {
    borderClass = "border-l-4 border-l-amber-500";
    var nombre = meta.temp_user.nombre;
    var placa = meta.temp_user.placa;
    var entryTime = formatHoraEntrada(s.hora_inicio);

    // Info del dueño si existe
    var ownerLineHTML = '';
    if (hasOwner) {
      var diasTextoVisitante = formatDiasFuera(ownerInfo.fecha_salida);
      ownerLineHTML = '<div class="mt-2 pt-2 border-t border-slate-100">' +
        '<div class="text-[10px] text-indigo-500 font-semibold"><i class="fa-solid fa-user-shield mr-1"></i>Dueño: ' + ownerInfo.nombre + '</div>' +
        '<div class="text-[10px] text-amber-600" data-fecha-salida="' + (ownerInfo.fecha_salida || '') + '"><i class="fa-solid fa-calendar-days mr-1"></i>Fuera: ' + diasTextoVisitante + '</div>' +
        '</div>';
    }

    headerHTML = '<div class="bg-slate-50 px-4 py-2 flex justify-between items-center border-b border-slate-100"><span class="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-wider">Visitante</span><span class="font-bold text-slate-700 text-lg">' + s.numero + '</span></div>';
    bodyHTML = '<div class="p-5 flex-1 flex flex-col space-y-2">' +
      '<div class="font-bold text-slate-800 truncate text-sm" title="' + nombre + '">' + nombre + '</div>' +
      '<div class="flex items-center gap-1"><span class="font-mono text-xs bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-700">' + placa + '</span></div>' +
      '<div class="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1"><i class="fa-regular fa-clock mr-1"></i> ' + calcularTiempo(s.hora_inicio) + '</div>' +
      '<div class="text-[10px] text-slate-400">' + entryTime + '</div>' +
      ownerLineHTML +
      '</div>';

    // Botones: si hay dueño, agregar Restaurar
    if (hasOwner) {
      actionsHTML = '<div class="grid grid-cols-3 gap-1">' +
        '<button onclick="abrirModalCobro(' + s.id + ', \'visitante\')" class="bg-amber-600 hover:bg-amber-700 text-white py-3 text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5"><i class="fa-solid fa-money-bill-wave"></i>Cobrar</button>' +
        '<button onclick="salirVisitante(' + s.id + ')" class="bg-white hover:bg-red-50 text-red-600 border border-red-200 py-3 text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5">Salir</button>' +
        '<button onclick="restaurarDueno(' + s.id + ')" class="bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-xs font-bold transition-colors flex flex-col items-center justify-center gap-0.5"><i class="fa-solid fa-rotate"></i>Rest.</button>' +
        '</div>';
    } else {
      actionsHTML = '<div class="grid grid-cols-2 gap-2">' +
        '<button onclick="abrirModalCobro(' + s.id + ', \'visitante\')" class="bg-amber-600 hover:bg-amber-700 text-white py-3 text-xs font-bold transition-colors flex flex items-center justify-center gap-1"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</button>' +
        '<button onclick="salirVisitante(' + s.id + ')" class="bg-white hover:bg-red-50 text-red-600 border border-red-200 py-3 text-xs font-bold transition-colors">Salir</button>' +
        '</div>';
    }
  }
  // === CLIENTE OCUPADO ===
  else if (s.estado === 'ocupado') {
    borderClass = "border-l-4 border-l-indigo-500";
    var isClient = !!s.cliente_id;
    var badgeColor = isClient ? "bg-indigo-600 text-white" : "bg-slate-700 text-white";
    var badgeText = isClient ? "Cliente" : "Dueño";
    var nombre2 = s.cliente_nombre || 'Desconocido';
    var placa2 = s.cliente_placa || '---';
    var entryTime2 = formatHoraEntrada(s.hora_inicio);
    var tipoVeh = s.cliente_tipo_vehiculo || '';
    var iconVeh = tipoVeh ? '<i class="fa-solid ' + getIconForType(tipoVeh) + ' text-slate-400 text-sm"></i>' : '';

    headerHTML = '<div class="bg-slate-50 px-4 py-2 flex justify-between items-center border-b border-slate-100"><span class="text-xs font-bold ' + badgeColor + ' px-2 py-0.5 rounded uppercase tracking-wider">' + badgeText + '</span><span class="font-bold text-slate-700 text-lg">' + s.numero + '</span></div>';
    bodyHTML = '<div class="p-5 flex-1 flex flex-col space-y-2">' +
      '<div class="font-bold text-slate-800 truncate text-sm" title="' + nombre2 + '">' + nombre2 + '</div>' +
      '<div class="flex items-center justify-between mb-1"><span class="font-mono text-xs bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">' + placa2 + '</span>' + iconVeh + '</div>' +
      '<div class="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1"><i class="fa-regular fa-clock mr-1"></i> ' + calcularTiempo(s.hora_inicio) + '</div>' +
      '<div class="text-[10px] text-slate-400">' + entryTime2 + '</div>' +
      '</div>';
    actionsHTML = '<div class="grid grid-cols-2 gap-px bg-slate-100 border-t border-slate-100">' +
      '<button onclick="abrirModalCobro(' + s.id + ', \'cliente\')" class="bg-slate-800 hover:bg-slate-900 text-white py-3 text-xs font-bold transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</button>' +
      '<button onclick="salirViaje(' + s.id + ')" class="bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1"><i class="fa-solid fa-plane-departure"></i> Salir</button>' +
      '</div>' +
      '<div class="mt-2 pt-2 border-t border-slate-50 grid grid-cols-3 gap-1">' +
      '<button onclick="limpiarPuesto(' + s.id + ')" class="text-[9px] text-slate-400 hover:text-red-600 py-1 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-slate-50 transition-colors" title="Limpiar datos"><i class="fa-solid fa-broom"></i> Limpiar</button>' +
      '<button onclick="editarNumeroPuesto(' + s.id + ', \'' + s.numero + '\')" class="text-[9px] text-slate-400 hover:text-indigo-600 py-1 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-slate-50 transition-colors" title="Editar número"><i class="fa-solid fa-pen"></i> Editar</button>' +
      '<button onclick="eliminarPuesto(' + s.id + ')" class="text-[9px] text-red-300 hover:text-red-600 py-1 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-red-50 transition-colors" title="Eliminar puesto"><i class="fa-solid fa-trash"></i> Eliminar</button>' +
      '</div>';
  }

  return '<div class="' + cardBase + ' ' + borderClass + '"><div class="p-4 h-full flex flex-col">' + headerHTML + bodyHTML + actionsHTML + '</div></div>';
}

// --- CREAR PUESTO ---
window.abrirModalCrearPuesto = function() {
  document.getElementById('inputNuevoNumero').value = '';
  toggleModal('modalCrearPuesto', true);
  setTimeout(function() { document.getElementById('inputNuevoNumero').focus(); }, 100);
};

window.cerrarModalCrearPuesto = function() {
  toggleModal('modalCrearPuesto', false);
};

window.confirmarCrearPuesto = function() {
  var numero = document.getElementById('inputNuevoNumero').value.trim();
  if (!numero) return mostrarToast("Ingrese un número", "error");

  fetch("/api/puestos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numero: numero })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      toggleModal('modalCrearPuesto', false);
      mostrarToast("Puesto creado");
      cargarPuestos();
    } else {
      mostrarToast(data.error || "Error al crear", "error");
    }
  })
  .catch(function(e) {
    console.error(e);
    mostrarToast("Error de conexión", "error");
  });
};

// --- MODALES ---
window.cerrarModal = function() {
  toggleModal('modalAsignar', false);
};

window.cerrarModalReservar = function() {
  toggleModal('modalReservar', false);
};

// --- COBRO ---
window.abrirModalCobro = function(id, type) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;

  var monto = 0;
  var nombre = "Visitante";
  var placa = "---";
  var tel = "";

  if (type === 'cliente') {
    monto = spot.cuota_mensual || 0;
    if (!monto) {
      var clientData = clientesCache.find(function(x) { return x.placa === spot.cliente_placa; });
      if (clientData) monto = clientData.cuota_mensual || 0;
    }
    nombre = spot.cliente_nombre || 'Cliente';
    placa = spot.cliente_placa;
    tel = spot.cliente_telefono || '';
  } else {
    var m = {};
    try { m = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e) {}
    nombre = (m.temp_user && m.temp_user.nombre) ? m.temp_user.nombre : 'Visitante';
    placa = (m.temp_user && m.temp_user.placa) ? m.temp_user.placa : '---';
    monto = 0;
  }

  cobroData = {
    id: id,
    type: type,
    nombre: nombre,
    telefono: tel,
    placa: placa,
    hora_inicio: spot.hora_inicio,
    monto: monto,
    numero: spot.numero
  };

  document.getElementById('cobroNombre').innerText = nombre;
  document.getElementById('cobroPlaca').innerText = placa;
  document.getElementById('cobroPuesto').innerText = '#' + spot.numero;
  document.getElementById('cobroTiempo').innerText = calcularTiempo(spot.hora_inicio);
  document.getElementById('cobroMonto').value = monto;

  var btnRenovar = document.getElementById('btnRenovar');
  var btnSalir = document.getElementById('btnSalir');
  var title = document.getElementById('tituloModalCobro');

  if (type === 'cliente') {
    btnRenovar.classList.remove('hidden');
    btnRenovar.style.display = 'flex';
    btnSalir.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Salir y Cobrar (Definitivo)';
    title.innerText = "Gestión de Cobro";
  } else {
    btnRenovar.classList.add('hidden');
    btnRenovar.style.display = 'none';
    btnSalir.innerHTML = '<i class="fa-solid fa-receipt"></i> Cobrar Salida';
    title.innerText = "Cobro Visitante";
  }

  toggleModal('modalCobroSalida', true);
  setTimeout(function() { document.getElementById('cobroMonto').focus(); }, 100);
};

window.procesarRenovar = function() {
  var amount = document.getElementById('cobroMonto').value;
  if (!amount || amount <= 0) return alert("Ingrese un monto válido");

  var params = new URLSearchParams({
    plate: cobroData.placa,
    spot: cobroData.numero,
    client: cobroData.nombre,
    phone: cobroData.telefono,
    entry: cobroData.hora_inicio,
    amount: amount,
    period: 'Mes',
    renew: 'true'
  });
  window.location.href = 'caja.html?' + params.toString();
};

window.procesarSalirYCobro = function() {
  var amount = document.getElementById('cobroMonto').value;
  if (!amount || amount <= 0) return alert("Ingrese un monto válido");

  // Esta acción limpia TODO el puesto (salida definitiva)
  var action = cobroData.type === 'cliente' ? 'salida_oficial' : 'salir_visitante';

  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: cobroData.id, accion: action })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    mostrarToast("Liberando puesto...");
    var params = new URLSearchParams({
      plate: cobroData.placa,
      spot: cobroData.numero,
      client: cobroData.nombre,
      phone: cobroData.telefono,
      entry: cobroData.hora_inicio,
      amount: amount,
      period: cobroData.type === 'cliente' ? 'Mes' : 'Visita',
      renew: 'false'
    });
    window.location.href = 'caja.html?' + params.toString();
  })
  .catch(function() {
    alert("Error de conexión");
  });
};

// --- ASIGNAR ---
window.abrirModalAsignar = function(id, num) {
  var select = document.getElementById('modalClienteSelect');
  select.innerHTML = '<option value="">-- Seleccione Cliente --</option>';

  var available = clientesCache.filter(function(c) {
    return !allSpots.some(function(s) { return s.cliente_placa === c.placa && s.estado === 'ocupado'; });
  });
  if (available.length === 0) {
    var opt = document.createElement("option");
    opt.disabled = true;
    opt.text = "No hay clientes disponibles";
    select.add(opt);
  } else {
    available.forEach(function(c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.text = c.nombre + ' (' + c.placa + ')';
      select.add(opt);
    });
  }

  document.getElementById('modalAsignarTitle').innerText = 'Asignar #' + num;
  document.getElementById('spotIdOculto').value = id;
  toggleModal('modalAsignar', true);
};

window.confirmarAsignar = function() {
  var cid = document.getElementById('modalClienteSelect').value;
  var sid = document.getElementById('spotIdOculto').value;
  if (!cid) return alert("Seleccione un cliente de la lista");

  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: sid, accion: "asignar_registrado", cliente_id: cid })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      toggleModal('modalAsignar', false);
      mostrarToast("Asignado correctamente");
      cargarPuestos();
    } else {
      alert("Error al asignar: " + (data.error || "Desconocido"));
    }
  })
  .catch(function(e) {
    console.error(e);
    alert("Error de conexión");
  });
};

// --- VISITANTE ---
window.abrirModalVisitante = function() {
  var sSelect = document.getElementById('visitanteSpotSelect');
  var cSelect = document.getElementById('visitanteClientSelect');

  if (sSelect) {
    sSelect.innerHTML = '<option value="">-- Seleccione Puesto --</option>';
    allSpots.filter(function(s) { return s.estado === 'libre'; }).forEach(function(s) {
      var owner = {};
      try { owner = JSON.parse(s.puesto_info || '{}'); } catch(e) {}
      var text = owner.nombre ? 'Puesto #' + s.numero + ' (Dueño: ' + owner.nombre + ')' : 'Puesto #' + s.numero;
      sSelect.add(new Option(text, s.id));
    });
  }

  cSelect.innerHTML = '<option value="">-- Opcional: Cliente Registrado --</option>';
  clientesCache.filter(function(c) {
    return !allSpots.some(function(s) { return s.cliente_placa === c.placa && s.estado === 'ocupado'; });
  }).forEach(function(c) {
    cSelect.add(new Option(c.nombre + ' (' + c.placa + ')', c.id));
  });

  var manualRadio = document.querySelector('input[name="visitanteType"][value="manual"]');
  if (manualRadio) manualRadio.checked = true;
  window.onVisitanteTypeChange();

  toggleModal('modalVisitante', true);
};

window.cerrarModalVisitante = function() {
  toggleModal('modalVisitante', false);
};

window.onVisitanteTypeChange = function() {
  var typeRadio = document.querySelector('input[name="visitanteType"]:checked');
  var divManual = document.getElementById('divVisitanteManual');
  var divCliente = document.getElementById('divVisitanteCliente');
  
  if (typeRadio && typeRadio.value === 'registered') {
    if (divManual) divManual.classList.add('hidden');
    if (divCliente) divCliente.classList.remove('hidden');
  } else {
    if (divManual) divManual.classList.remove('hidden');
    if (divCliente) divCliente.classList.add('hidden');
  }
};

window.onVisitanteClientChange = function() {
  var cid = document.getElementById('visitanteClientSelect').value;
  var nameInput = document.getElementById('visitanteNombre');
  var plateInput = document.getElementById('visitantePlaca');
  
  if (cid) {
    var c = clientesCache.find(function(x) { return x.id == cid; });
    if (c) {
      nameInput.value = c.nombre;
      plateInput.value = c.placa;
      nameInput.readOnly = true;
      plateInput.readOnly = true;
    }
  } else {
    nameInput.value = '';
    plateInput.value = '';
    nameInput.readOnly = false;
    plateInput.readOnly = false;
  }
};

window.confirmarVisitante = function() {
  var sid = document.getElementById('visitanteSpotSelect').value;
  var typeRadio = document.querySelector('input[name="visitanteType"]:checked');
  var nombre = document.getElementById('visitanteNombre').value;
  var placa = document.getElementById('visitantePlaca').value;
  var cid = null;

  if (typeRadio && typeRadio.value === 'registered') {
    cid = document.getElementById('visitanteClientSelect').value;
    var c = clientesCache.find(function(x) { return x.id == cid; });
    if (c) {
      nombre = c.nombre;
      placa = c.placa;
    }
  }

  if (!sid || !nombre || !placa) return alert("Complete los datos");

  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: sid, accion: "asignar_visitante", temp_name: nombre, temp_plate: placa, cliente_id: cid })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      toggleModal('modalVisitante', false);
      mostrarToast("Visitante registrado");
      cargarPuestos();
    } else {
      alert("Error al registrar: " + (data.error || "Desconocido"));
    }
  })
  .catch(function(e) {
    console.error(e);
    alert("Error de conexión");
  });
};

// --- RESERVAR ---
window.abrirModalReservar = function(id, num) {
  document.getElementById('reservaId').value = id;
  document.getElementById('reservaTitle').innerText = 'Reservar Puesto #' + num;
  document.getElementById('reservaNombre').value = '';
  document.getElementById('reservaPlaca').value = '';
  toggleModal('modalReservar', true);
};

window.confirmarReservar = function() {
  var id = document.getElementById('reservaId').value;
  var nombre = document.getElementById('reservaNombre').value;
  var placa = document.getElementById('reservaPlaca').value;
  if (!nombre) return alert("Nombre requerido");

  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "reservar", nombre: nombre, placa: placa })
  })
  .then(function() {
    toggleModal('modalReservar', false);
    cargarPuestos();
    mostrarToast("Reserva creada");
  })
  .catch(function(e) {
    mostrarToast("Error al reservar", "error");
  });
};

// --- OCUPAR RESERVA (Con selector de clientes) ---
window.ocuparReserva = function(id) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;
  
  var meta = {};
  try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e) {}
  var reservaNombre = (meta.reservation && meta.reservation.nombre) ? meta.reservation.nombre : '';
  var reservaPlaca = (meta.reservation && meta.reservation.placa) ? meta.reservation.placa : '';
  
  document.getElementById('ocuparReservaInfo').innerHTML = 
    '<div class="text-sm text-purple-700">Reserva a nombre de: <strong>' + reservaNombre + '</strong>' +
    (reservaPlaca ? ' — Placa: <span class="font-mono font-bold">' + reservaPlaca + '</span>' : '') + '</div>';
  
  var select = document.getElementById('ocuparReservaClienteSelect');
  select.innerHTML = '<option value="">-- Ocupar sin cliente registrado --</option>';
  
  var available = clientesCache.filter(function(c) {
    return !allSpots.some(function(s) { return s.cliente_placa === c.placa && s.estado === 'ocupado'; });
  });
  
  var defaultOption = '';
  available.forEach(function(c) {
    var opt = new Option(c.nombre + ' (' + c.placa + ')', c.id);
    select.add(opt);
    if (reservaPlaca && c.placa.toUpperCase() === reservaPlaca.toUpperCase()) {
      defaultOption = c.id;
    }
  });
  
  if (defaultOption) select.value = defaultOption;
  
  document.getElementById('ocuparReservaId').value = id;
  toggleModal('modalOcuparReserva', true);
};

window.confirmarOcuparReserva = function() {
  var id = document.getElementById('ocuparReservaId').value;
  var clientId = document.getElementById('ocuparReservaClienteSelect').value;
  
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "ocupar_reserva", cliente_id: clientId || null })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      toggleModal('modalOcuparReserva', false);
      mostrarToast(data.message);
      cargarPuestos();
    } else {
      mostrarToast(data.error || "Error", "error");
    }
  })
  .catch(function() {
    mostrarToast("Error de conexión", "error");
  });
};

window.cerrarModalOcuparReserva = function() {
  toggleModal('modalOcuparReserva', false);
};

// --- SALIDA DE VIAJE (Guarda dueño, deja libre para visitante) ---
window.salirViaje = function(id) {
  var s = allSpots.find(function(x) { return x.id === id; });
  if (!s) return;
  
  var n = s.cliente_nombre || 'Sin nombre';
  
  if (!confirm('¿SALIDA DE VIAJE?\n\n' + n + '\n\nEl puesto quedará guardado con sus datos.\nPodrá ingresar un visitante temporalmente.\nAl regresar el dueño, use "Restaurar".')) return;
  
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "salida_viaje" })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      mostrarToast(data.message);
      cargarPuestos();
    } else {
      mostrarToast(data.error || "Error", "error");
    }
  })
  .catch(function() {
    mostrarToast("Error", "error");
  });
};

// --- RESTAURAR DUEÑO (Con info de días fuera) ---
window.restaurarDueno = function(id) {
  var spot = allSpots.find(function(x) { return x.id === id; });
  if (!spot) return mostrarToast("Puesto no encontrado", "error");
  
  var ownerInfo = {};
  try { ownerInfo = JSON.parse(spot.puesto_info || '{}'); } catch(e) {}
  if (!ownerInfo.nombre) return mostrarToast("Sin dueño guardado", "error");
  
  var diasFuera = calcularDiasFuera(ownerInfo.fecha_salida);
  var diasTexto = diasFuera === 0 ? 'Hoy mismo' : diasFuera + ' día(s)';
  
  // Verificar si hay visitante actualmente
  var hayVisitante = spot.estado === 'ocupado' && !spot.cliente_id;
  var advertencia = hayVisitante ? '\n\n⚠️ HAY UN VISITANTE EN EL PUESTO.\nSerá desplazado automáticamente.' : '';
  
  if (!confirm('¿RESTAURAR a ' + ownerInfo.nombre + '?\n\n' +
    'Placa: ' + (ownerInfo.placa || '---') + '\n' +
    'Tiempo fuera: ' + diasTexto + advertencia)) return;
  
  // Si hay visitante, liberarlo primero
  if (hayVisitante) {
    fetch("/api/puestos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, accion: "salir_visitante" })
    }).then(function() {
      ejecutarRestaurar(id);
    });
  } else {
    ejecutarRestaurar(id);
  }
};

function ejecutarRestaurar(id) {
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "restaurar_dueno" })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      mostrarToast(data.message);
      cargarPuestos();
    } else {
      mostrarToast(data.error, "error");
    }
  })
  .catch(function() {
    mostrarToast("Error", "error");
  });
}

// --- ACCIONES RAPIDAS ---
window.liberar = function(id) {
  if (!confirm("¿Cancelar reserva?")) return;
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "salir_visitante" })
  }).then(function() {
    cargarPuestos();
    mostrarToast("Reserva cancelada");
  }).catch(function() {
    mostrarToast("Error", "error");
  });
};

window.salirVisitante = function(id) {
  if (!confirm("¿Dar salida al visitante sin cobro?")) return;
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "salir_visitante" })
  }).then(function() {
    cargarPuestos();
    mostrarToast("Visitante salió");
  }).catch(function() {
    mostrarToast("Error", "error");
  });
};

window.limpiarPuesto = function(id) {
  if (!confirm("¿LIMPIAR TODO?\nSe borrará el dueño guardado y todo residuo.")) return;
  fetch('/api/puestos?id=' + id, { method: "PATCH" }).then(function() {
    cargarPuestos();
    mostrarToast("Puesto limpiado");
  }).catch(function() {
    mostrarToast("Error", "error");
  });
};

window.eliminarPuesto = function(id) {
  if (!confirm("¿ELIMINAR ESTE PUESTO?\nEsta acción no se puede deshacer.")) return;
  fetch('/api/puestos?id=' + id, { method: "DELETE" })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    mostrarToast("Eliminado");
    cargarPuestos();
  }).catch(function() {
    mostrarToast("Error de conexión", "error");
  });
};

window.editarNumeroPuesto = function(id, num) {
  var n = prompt("Nuevo número:", num);
  if (!n || n === num) return;
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id, accion: "editar_numero", nuevo_numero: n })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      mostrarToast("Actualizado");
      cargarPuestos();
    } else {
      mostrarToast(data.error, "error");
    }
  })
  .catch(function() {
    mostrarToast("Error", "error");
  });
};

// --- MENU MOVIL ---
window.toggleMenu = function() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('mobileMenuOverlay');
  if (sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
};