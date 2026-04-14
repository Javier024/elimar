document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

var allSpots = [];
var clientesCache = [];
var currentFilterStatus = 'todos';
var currentSpotId = null;
var cobroData = null;
var formularioSpot = null;

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

// ✅ COBRO POR DÍAS
function calcularCobroDiario(horaInicioUnix, tipoVehiculo) {
  if (!horaInicioUnix) return { dias: 0, tarifa: 0, tipoLabel: 'Carro', total: 0 };
  var diff = Math.floor(Date.now() / 1000) - Number(horaInicioUnix);
  var totalDias = Math.floor(diff / 86400);
  if (totalDias < 1) totalDias = 1;
  var tarifa = 5000;
  var tipoLabel = 'Carro/Camioneta';
  if (tipoVehiculo && tipoVehiculo.toLowerCase().includes('moto')) {
    tarifa = 3000;
    tipoLabel = 'Moto';
  }
  return { dias: totalDias, tarifa: tarifa, tipoLabel: tipoLabel, total: totalDias * tarifa };
}

function calcularTiempo(horaInicioUnix) {
  if (!horaInicioUnix) return "";
  var diff = new Date() - new Date(Number(horaInicioUnix) * 1000);
  var totalDias = Math.floor(diff / 86400000);
  var totalSemanas = Math.floor(totalDias / 7);
  var totalMeses = Math.floor(totalDias / 30);
  if (totalMeses >= 1) {
    var diasRestMes = totalDias - (totalMeses * 30);
    if (diasRestMes > 0 && totalMeses < 12) return totalMeses + ' mes' + (totalMeses > 1 ? 'es' : '') + ' ' + diasRestMes + 'd';
    return totalMeses + ' mes' + (totalMeses > 1 ? 'es' : '');
  }
  if (totalSemanas >= 1) {
    var diasRestSem = totalDias - (totalSemanas * 7);
    if (diasRestSem > 0) return totalSemanas + ' sem ' + diasRestSem + 'd';
    return totalSemanas + ' semana' + (totalSemanas > 1 ? 's' : '');
  }
  if (totalDias >= 1) return totalDias + ' día' + (totalDias > 1 ? 's' : '');
  var h = Math.floor(diff / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function formatHoraEntrada(timestamp) {
  if (!timestamp) return "---";
  var date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function calcularDiasFuera(fechaSalidaUnix) {
  if (!fechaSalidaUnix) return 0;
  return Math.max(0, Math.floor(Math.floor(Date.now() / 1000) - Number(fechaSalidaUnix) / 1));
}

function formatDiasFuera(fechaSalidaUnix) {
  var dias = calcularDiasFuera(fechaSalidaUnix);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return '1 día';
  return dias + ' días';
}

function getIconForType(tipo) {
  if (!tipo) return 'fa-car';
  var t = tipo.toLowerCase();
  if (t.includes('moto')) return 'fa-motorcycle';
  if (t.includes('camioneta')) return 'fa-truck-pickup';
  return 'fa-car';
}

function initApp() {
  cargarPuestos();
  cargarClientesCache();
  var searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", function(e) { renderMapa(e.target.value.toLowerCase()); });
  setInterval(function() {
    document.querySelectorAll('[data-fecha-salida]').forEach(function(el) {
      var ts = el.getAttribute('data-fecha-salida');
      if (ts) el.innerText = formatDiasFuera(ts);
    });
  }, 60000);
}

function cargarClientesCache() {
  fetch("/api/clientes").then(function(res) { return res.ok ? res.json() : []; }).then(function(data) {
    clientesCache = data.map(function(c) { if (c.placa) c.placa = c.placa.trim(); return c; });
  }).catch(function() { clientesCache = []; });
}

function cargarPuestos() {
  fetch("/api/puestos").then(function(res) { if (!res.ok) throw new Error("Error API"); return res.json(); }).then(function(data) {
    allSpots = data.sort(function(a, b) { return (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0); });
    var elLibres = document.getElementById('kpi-libres');
    var elOcupados = document.getElementById('kpi-ocupados');
    var elTotal = document.getElementById('kpi-total');
    if (elLibres) elLibres.innerText = allSpots.filter(function(s) { return s.estado === 'libre'; }).length;
    if (elOcupados) elOcupados.innerText = allSpots.filter(function(s) { return s.estado === 'ocupado'; }).length;
    if (elTotal) elTotal.innerText = allSpots.length;
    renderMapa();
  }).catch(function() { mostrarToast("Error cargando datos", "error"); });
}

// ═══════════════════════════════════════
// FILTROS
// ═══════════════════════════════════════
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

// ═══════════════════════════════════════
// RENDER MAPA - CASILLAS COMPACTAS
// ═══════════════════════════════════════
function renderMapa(busqueda) {
  var container = document.getElementById("map-container");
  if (!container) return;
  container.innerHTML = "";
  busqueda = busqueda || "";
  var datos = allSpots;
  if (currentFilterStatus !== 'todos') datos = datos.filter(function(s) { return s.estado === currentFilterStatus; });
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
    var div = document.createElement('div');
    div.innerHTML = getSlotHTML(spot);
    fragment.appendChild(div.firstElementChild);
  });
  container.appendChild(fragment);
}

function getSlotHTML(s) {
  var meta = {};
  var ownerInfo = null;
  try { meta = JSON.parse(s.llave_caracteristicas || '{}'); } catch (e) {}
  try { ownerInfo = JSON.parse(s.puesto_info || '{}'); } catch (e) {}

  var isTempUser = !s.cliente_id && meta.temp_user;
  var hasOwner = ownerInfo && ownerInfo.nombre;

  var bgColor = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700/50';
  var textColor = 'text-emerald-700 dark:text-emerald-300';
  var placaText = '';
  var smallIcon = '';

  if (s.estado === 'reservado') {
    bgColor = 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700/50';
    textColor = 'text-purple-700 dark:text-purple-300';
    smallIcon = '<i class="fa-solid fa-bookmark text-[9px] absolute top-1.5 left-2 opacity-60"></i>';
  } else if (s.estado === 'ocupado' && isTempUser) {
    bgColor = 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50';
    textColor = 'text-amber-700 dark:text-amber-300';
    placaText = (meta.temp_user.placa || '').toUpperCase();
    var tv = meta.temp_user.tipo_vehiculo || '';
    smallIcon = '<i class="fa-solid ' + getIconForType(tv) + ' text-[9px] absolute top-1.5 left-2 opacity-60"></i>';
  } else if (s.estado === 'ocupado') {
    bgColor = 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700/50';
    textColor = 'text-indigo-700 dark:text-indigo-300';
    placaText = (s.cliente_placa || '').toUpperCase();
    smallIcon = '<i class="fa-solid ' + getIconForType(s.cliente_tipo_vehiculo) + ' text-[9px] absolute top-1.5 left-2 opacity-60"></i>';
  } else if (s.estado === 'libre' && hasOwner) {
    bgColor = 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-300/60 dark:border-amber-700/30 border-dashed';
    textColor = 'text-amber-600 dark:text-amber-400';
    smallIcon = '<i class="fa-solid fa-plane-departure text-[9px] absolute top-1.5 left-2 opacity-50"></i>';
  }

  var placaHTML = placaText
    ? '<div class="text-[10px] sm:text-[11px] font-mono font-bold ' + textColor + ' truncate px-1 text-center leading-tight">' + placaText + '</div>'
    : '';

  return '<div class="group relative ' + bgColor + ' border-2 rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center min-h-[80px] sm:min-h-[95px] cursor-pointer hover:shadow-lg hover:scale-[1.03] transition-all duration-200 select-none" onclick="abrirFormularioPuesto(' + s.id + ')">' +
    '<button onclick="event.stopPropagation(); eliminarPuesto(' + s.id + ')" class="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 text-white rounded-full text-[9px] sm:text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-red-600 hover:scale-110 z-20"><i class="fa-solid fa-xmark"></i></button>' +
    smallIcon +
    '<div class="text-lg sm:text-xl font-black ' + textColor + ' mt-1">' + s.numero + '</div>' +
    placaHTML +
    '</div>';
}

// ═══════════════════════════════════════
// FORMULARIO DEL PUESTO
// ═══════════════════════════════════════
window.abrirFormularioPuesto = function(id) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;

  var meta = {};
  var ownerInfo = null;
  try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch (e) {}
  try { ownerInfo = JSON.parse(spot.puesto_info || '{}'); } catch (e) {}

  var isTempUser = !spot.cliente_id && meta.temp_user;
  var hasOwner = ownerInfo && ownerInfo.nombre;

  formularioSpot = spot;
  formularioSpot._isTempUser = isTempUser;
  formularioSpot._hasOwner = hasOwner;
  formularioSpot._meta = meta;
  formularioSpot._ownerInfo = ownerInfo;

  // Header
  document.getElementById('formPuestoNumero').innerText = '#' + spot.numero;

  // Ocultar todas las secciones
  ['formSeccionLibre','formSeccionOcupado','formSeccionVisitante','formSeccionReservado','formSeccionDuenoFuera','formSeccionCobroDiario','formSeccionDuenoEnVisitante'].forEach(function(sid) {
    var el = document.getElementById(sid);
    if (el) el.classList.add('hidden');
  });

  var accionesDiv = document.getElementById('formAcciones');
  accionesDiv.innerHTML = '';
  var badgeEl = document.getElementById('formEstadoBadge');
  var editarBtn = document.getElementById('formBtnEditar');

  // ─── LIBRE PURO ───
  if (spot.estado === 'libre' && !hasOwner) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">DISPONIBLE</span>';
    editarBtn.classList.remove('hidden');
    document.getElementById('formSeccionLibre').classList.remove('hidden');
    accionesDiv.innerHTML =
      '<button onclick="formAsignarCliente()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-user-plus"></i> Asignar Cliente</button>' +
      '<button onclick="formIngresarVisitante()" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-user-group"></i> Visitante</button>' +
      '<button onclick="formReservar()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-bookmark"></i> Reservar</button>';
  }
  // ─── LIBRE CON DUEÑO FUERA ───
  else if (spot.estado === 'libre' && hasOwner) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">DUEÑO FUERA</span>';
    editarBtn.classList.remove('hidden');

    document.getElementById('formDuenoNombre').innerText = ownerInfo.nombre;
    document.getElementById('formDuenoPlaca').innerText = ownerInfo.placa || '---';
    document.getElementById('formDuenoTelefono').innerText = ownerInfo.telefono || '---';
    var dfEl = document.getElementById('formDuenoDias');
    dfEl.innerText = formatDiasFuera(ownerInfo.fecha_salida);
    if (ownerInfo.fecha_salida) dfEl.setAttribute('data-fecha-salida', ownerInfo.fecha_salida);

    document.getElementById('formSeccionDuenoFuera').classList.remove('hidden');
    accionesDiv.innerHTML =
      '<button onclick="formIngresarVisitante()" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-user-group"></i> Ingresar Visitante</button>' +
      '<button onclick="formRestaurarDueno()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-rotate-left"></i> Restaurar Dueño</button>';
  }
  // ─── OCUPADO CLIENTE ───
  else if (spot.estado === 'ocupado' && !isTempUser) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">OCUPADO</span>';
    editarBtn.classList.add('hidden');

    document.getElementById('formOcupadoNombre').innerText = spot.cliente_nombre || '---';
    document.getElementById('formOcupadoPlaca').innerText = (spot.cliente_placa || '---').toUpperCase();
    document.getElementById('formOcupadoTelefono').innerText = spot.cliente_telefono || '---';
    document.getElementById('formOcupadoTipo').innerText = spot.cliente_tipo_vehiculo || 'Carro';
    document.getElementById('formOcupadoEntrada').innerText = formatHoraEntrada(spot.hora_inicio);
    document.getElementById('formOcupadoTiempo').innerText = calcularTiempo(spot.hora_inicio);

    var cuota = spot.cuota_mensual || 0;
    if (!cuota) {
      var cd = clientesCache.find(function(x) { return x.placa === (spot.cliente_placa || '').trim(); });
      if (cd) cuota = cd.cuota_mensual || 0;
    }

    if (cuota > 0) {
      document.getElementById('formOcupadoCuota').innerText = '$' + Number(cuota).toLocaleString('es-CO') + ' /mes';
      document.getElementById('formSeccionCobroDiario').classList.add('hidden');
    } else {
      document.getElementById('formOcupadoCuota').innerText = 'Sin cuota → Cobro por días';
      var calc = calcularCobroDiario(spot.hora_inicio, spot.cliente_tipo_vehiculo);
      document.getElementById('formCobroDias').innerText = calc.dias;
      document.getElementById('formCobroTarifa').innerText = '$' + calc.tarifa.toLocaleString('es-CO') + '/día (' + calc.tipoLabel + ')';
      document.getElementById('formCobroTotal').innerText = '$' + calc.total.toLocaleString('es-CO');
      document.getElementById('formSeccionCobroDiario').classList.remove('hidden');
    }

    document.getElementById('formSeccionOcupado').classList.remove('hidden');

    var btns = '<button onclick="formCobrarSalida(\'cliente\')" class="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-money-bill-wave"></i> Cobrar Salida</button>';
    btns += '<button onclick="formSalirViaje()" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-plane-departure"></i> Salir de Viaje</button>';
    if (cuota > 0) {
      btns += '<button onclick="formRenovarMes()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-rotate"></i> Renovar Mes</button>';
    }
    accionesDiv.innerHTML = btns;
  }
  // ─── OCUPADO VISITANTE ───
  else if (spot.estado === 'ocupado' && isTempUser) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">VISITANTE</span>';
    editarBtn.classList.add('hidden');

    document.getElementById('formVisitNombre').innerText = meta.temp_user.nombre || '---';
    document.getElementById('formVisitPlaca').innerText = (meta.temp_user.placa || '---').toUpperCase();
    document.getElementById('formVisitTelefono').innerText = meta.temp_user.telefono || '---';
    document.getElementById('formVisitTipo').innerText = meta.temp_user.tipo_vehiculo || 'Carro';
    document.getElementById('formVisitEntrada').innerText = formatHoraEntrada(spot.hora_inicio);
    document.getElementById('formVisitTiempo').innerText = calcularTiempo(spot.hora_inicio);

    var vCalc = calcularCobroDiario(spot.hora_inicio, meta.temp_user.tipo_vehiculo);
    document.getElementById('formCobroDias').innerText = vCalc.dias;
    document.getElementById('formCobroTarifa').innerText = '$' + vCalc.tarifa.toLocaleString('es-CO') + '/día (' + vCalc.tipoLabel + ')';
    document.getElementById('formCobroTotal').innerText = '$' + vCalc.total.toLocaleString('es-CO');
    document.getElementById('formSeccionCobroDiario').classList.remove('hidden');

    document.getElementById('formSeccionVisitante').classList.remove('hidden');

    if (hasOwner) {
      document.getElementById('formDuenoVisitNombre').innerText = ownerInfo.nombre;
      var dfEl2 = document.getElementById('formDuenoVisitDias');
      dfEl2.innerText = formatDiasFuera(ownerInfo.fecha_salida);
      if (ownerInfo.fecha_salida) dfEl2.setAttribute('data-fecha-salida', ownerInfo.fecha_salida);
      document.getElementById('formSeccionDuenoEnVisitante').classList.remove('hidden');
      accionesDiv.innerHTML =
        '<button onclick="formCobrarSalida(\'visitante\')" class="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</button>' +
        '<button onclick="formSalirVisitante()" class="flex-1 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">Salir sin Cobro</button>' +
        '<button onclick="formRestaurarDueno()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-rotate-left"></i> Restaurar Dueño</button>';
    } else {
      accionesDiv.innerHTML =
        '<button onclick="formCobrarSalida(\'visitante\')" class="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</button>' +
        '<button onclick="formSalirVisitante()" class="flex-1 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">Salir sin Cobro</button>';
    }
  }
  // ─── RESERVADO ───
  else if (spot.estado === 'reservado') {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">RESERVADO</span>';
    editarBtn.classList.remove('hidden');

    document.getElementById('formReservaNombre').innerText = (meta.reservation && meta.reservation.nombre) || '---';
    document.getElementById('formReservaPlaca').innerText = (meta.reservation && meta.reservation.placa) ? meta.reservation.placa.toUpperCase() : '---';
    document.getElementById('formSeccionReservado').classList.remove('hidden');
    accionesDiv.innerHTML =
      '<button onclick="formOcuparReserva()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-user-check"></i> Ocupar Reserva</button>' +
      '<button onclick="formCancelarReserva()" class="flex-1 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">Cancelar</button>';
  }

  toggleModal('modalFormularioPuesto', true);
};

window.cerrarFormulario = function() {
  toggleModal('modalFormularioPuesto', false);
  formularioSpot = null;
};

window.formEditarNumero = function() {
  if (!formularioSpot) return;
  var n = prompt("Nuevo número para puesto #" + formularioSpot.numero + ":", formularioSpot.numero);
  if (!n || n === formularioSpot.numero) return;
  fetch("/api/puestos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: formularioSpot.id, accion: "editar_numero", nuevo_numero: n })
  }).then(function(res) { return res.json(); }).then(function(data) {
    if (data.success) { cerrarFormulario(); mostrarToast("Actualizado"); cargarPuestos(); }
    else mostrarToast(data.error, "error");
  }).catch(function() { mostrarToast("Error", "error"); });
};

// ─── Acciones desde formulario ───
window.formAsignarCliente = function() {
  var id = formularioSpot.id, num = formularioSpot.numero;
  cerrarFormulario();
  setTimeout(function() { abrirModalAsignar(id, num); }, 250);
};
window.formIngresarVisitante = function() {
  cerrarFormulario();
  setTimeout(function() { abrirModalVisitante(); }, 250);
};
window.formReservar = function() {
  var id = formularioSpot.id, num = formularioSpot.numero;
  cerrarFormulario();
  setTimeout(function() { abrirModalReservar(id, num); }, 250);
};

window.formCobrarSalida = function(type) {
  var id = formularioSpot.id;
  cerrarFormulario();
  setTimeout(function() { abrirModalCobro(id, type); }, 250);
};

window.formSalirViaje = function() {
  var s = formularioSpot;
  if (!confirm('¿SALIDA DE VIAJE?\n\n' + (s.cliente_nombre || 'Sin nombre') + '\n\nEl puesto quedará guardado con sus datos.\nPodrá ingresar un visitante temporalmente.')) return;
  fetch("/api/puestos", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: s.id, accion: "salida_viaje" })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) { cerrarFormulario(); mostrarToast(data.message); cargarPuestos(); }
    else mostrarToast(data.error || "Error", "error");
  }).catch(function() { mostrarToast("Error", "error"); });
};

window.formRenovarMes = function() {
  var s = formularioSpot;
  var monto = s.cuota_mensual || 0;
  if (!monto) {
    var cd = clientesCache.find(function(x) { return x.placa === (s.cliente_placa || '').trim(); });
    if (cd) monto = cd.cuota_mensual || 0;
  }
  if (!monto || monto <= 0) return mostrarToast("Sin cuota mensual configurada", "error");
  var params = new URLSearchParams({ plate: s.cliente_placa || '', spot: s.numero, client: s.cliente_nombre || '', phone: s.cliente_telefono || '', entry: s.hora_inicio, amount: monto, period: 'Mes', renew: 'true' });
  window.location.href = 'caja.html?' + params.toString();
};

window.formSalirVisitante = function() {
  if (!confirm("¿Dar salida al visitante sin cobro?")) return;
  fetch("/api/puestos", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: formularioSpot.id, accion: "salir_visitante" })
  }).then(function() { cerrarFormulario(); cargarPuestos(); mostrarToast("Visitante salió"); }).catch(function() { mostrarToast("Error", "error"); });
};

window.formRestaurarDueno = function() {
  var spot = formularioSpot;
  var ownerInfo = spot._ownerInfo;
  if (!ownerInfo || !ownerInfo.nombre) return mostrarToast("Sin dueño guardado", "error");
  var diasFuera = calcularDiasFuera(ownerInfo.fecha_salida);
  var diasTexto = diasFuera === 0 ? 'Hoy mismo' : diasFuera + ' día(s)';
  var hayVisitante = spot.estado === 'ocupado' && spot._isTempUser;
  var adv = hayVisitante ? '\n\n⚠️ HAY UN VISITANTE EN EL PUESTO.\nSerá desplazado automáticamente.' : '';
  if (!confirm('¿RESTAURAR a ' + ownerInfo.nombre + '?\n\nPlaca: ' + (ownerInfo.placa || '---') + '\nFuera: ' + diasTexto + adv)) return;

  function doRestore() {
    fetch("/api/puestos", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: spot.id, accion: "restaurar_dueno" })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.success) { cerrarFormulario(); mostrarToast(data.message); cargarPuestos(); }
      else mostrarToast(data.error, "error");
    }).catch(function() { mostrarToast("Error", "error"); });
  }

  if (hayVisitante) {
    fetch("/api/puestos", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: spot.id, accion: "salir_visitante" })
    }).then(function() { doRestore(); });
  } else { doRestore(); }
};

window.formOcuparReserva = function() {
  var id = formularioSpot.id;
  cerrarFormulario();
  setTimeout(function() { ocuparReserva(id); }, 250);
};

window.formCancelarReserva = function() {
  if (!confirm("¿Cancelar reserva?")) return;
  fetch("/api/puestos", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: formularioSpot.id, accion: "salir_visitante" })
  }).then(function() { cerrarFormulario(); cargarPuestos(); mostrarToast("Reserva cancelada"); }).catch(function() { mostrarToast("Error", "error"); });
};

// ═══════════════════════════════════════
// CREAR PUESTOS MASIVOS
// ═══════════════════════════════════════
window.abrirModalCrearPuesto = function() {
  document.getElementById('inputCantidadPuestos').value = '';
  toggleModal('modalCrearPuesto', true);
  setTimeout(function() { document.getElementById('inputCantidadPuestos').focus(); }, 100);
};
window.cerrarModalCrearPuesto = function() {
  toggleModal('modalCrearPuesto', false);
};
window.confirmarCrearPuesto = function() {
  var cantidad = parseInt(document.getElementById('inputCantidadPuestos').value);
  if (!cantidad || cantidad < 1) return mostrarToast("Ingrese una cantidad válida", "error");
  if (cantidad > 500) return mostrarToast("Máximo 500 puestos por operación", "error");

  fetch("/api/puestos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cantidad: cantidad })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) {
      toggleModal('modalCrearPuesto', false);
      mostrarToast(data.message);
      cargarPuestos();
    } else {
      mostrarToast(data.error || "Error al crear", "error");
    }
  }).catch(function() { mostrarToast("Error de conexión", "error"); });
};

// ═══════════════════════════════════════
// MODAL COBRO (modificado con cobro por días)
// ═══════════════════════════════════════
window.abrirModalCobro = function(id, type) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;

  var monto = 0;
  var nombre = "Visitante";
  var placa = "---";
  var tel = "";
  var tipoVehiculo = 'Carro';

  // Ocultar sección de cobro diario por defecto
  document.getElementById('cobroDiarioInfo').classList.add('hidden');

  if (type === 'cliente') {
    monto = spot.cuota_mensual || 0;
    if (!monto) {
      var clientData = clientesCache.find(function(x) { return x.placa === (spot.cliente_placa || '').trim(); });
      if (clientData) monto = clientData.cuota_mensual || 0;
    }
    nombre = spot.cliente_nombre || 'Cliente';
    placa = (spot.cliente_placa || '---').trim();
    tel = spot.cliente_telefono || '';
    tipoVehiculo = spot.cliente_tipo_vehiculo || 'Carro';

    if (!monto) {
      var calc = calcularCobroDiario(spot.hora_inicio, tipoVehiculo);
      monto = calc.total;
      document.getElementById('cobroDiarioInfo').classList.remove('hidden');
      document.getElementById('cobroDiarioTipo').innerText = calc.tipoLabel;
      document.getElementById('cobroDiarioDias').innerText = calc.dias;
      document.getElementById('cobroDiarioTarifa').innerText = '$' + calc.tarifa.toLocaleString('es-CO');
      document.getElementById('cobroDiarioTotal').innerText = '$' + calc.total.toLocaleString('es-CO');
    }
  } else {
    var m = {};
    try { m = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e) {}
    nombre = (m.temp_user && m.temp_user.nombre) ? m.temp_user.nombre : 'Visitante';
    placa = (m.temp_user && m.temp_user.placa) ? m.temp_user.placa.trim() : '---';
    tipoVehiculo = (m.temp_user && m.temp_user.tipo_vehiculo) ? m.temp_user.tipo_vehiculo : 'Carro';

    var vCalc = calcularCobroDiario(spot.hora_inicio, tipoVehiculo);
    monto = vCalc.total;
    document.getElementById('cobroDiarioInfo').classList.remove('hidden');
    document.getElementById('cobroDiarioTipo').innerText = vCalc.tipoLabel;
    document.getElementById('cobroDiarioDias').innerText = vCalc.dias;
    document.getElementById('cobroDiarioTarifa').innerText = '$' + vCalc.tarifa.toLocaleString('es-CO');
    document.getElementById('cobroDiarioTotal').innerText = '$' + vCalc.total.toLocaleString('es-CO');
  }

  cobroData = { id: id, type: type, nombre: nombre, telefono: tel, placa: placa, hora_inicio: spot.hora_inicio, monto: monto, numero: spot.numero };

  document.getElementById('cobroNombre').innerText = nombre;
  document.getElementById('cobroPlaca').innerText = placa;
  document.getElementById('cobroPuesto').innerText = '#' + spot.numero;
  document.getElementById('cobroTiempo').innerText = calcularTiempo(spot.hora_inicio);
  document.getElementById('cobroMonto').value = monto;

  var btnRenovar = document.getElementById('btnRenovar');
  var btnSalir = document.getElementById('btnSalir');
  var title = document.getElementById('tituloModalCobro');

  if (type === 'cliente') {
    var tieneCuota = (spot.cuota_mensual > 0) || (clientesCache.find(function(x) { return x.placa === (spot.cliente_placa || '').trim(); }) || {}).cuota_mensual > 0;
    if (tieneCuota) {
      btnRenovar.classList.remove('hidden');
      btnRenovar.style.display = 'flex';
    } else {
      btnRenovar.classList.add('hidden');
      btnRenovar.style.display = 'none';
    }
    btnSalir.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Salir y Cobrar';
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
  var params = new URLSearchParams({ plate: cobroData.placa, spot: cobroData.numero, client: cobroData.nombre, phone: cobroData.telefono, entry: cobroData.hora_inicio, amount: amount, period: 'Mes', renew: 'true' });
  window.location.href = 'caja.html?' + params.toString();
};

window.procesarSalirYCobro = function() {
  var amount = document.getElementById('cobroMonto').value;
  if (!amount || amount <= 0) return alert("Ingrese un monto válido");
  var action = cobroData.type === 'cliente' ? 'salida_oficial' : 'salir_visitante';
  fetch("/api/puestos", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: cobroData.id, accion: action })
  }).then(function(r) { return r.json(); }).then(function(data) {
    mostrarToast("Liberando puesto...");
    var params = new URLSearchParams({ plate: cobroData.placa, spot: cobroData.numero, client: cobroData.nombre, phone: cobroData.telefono, entry: cobroData.hora_inicio, amount: amount, period: cobroData.type === 'cliente' ? 'Mes' : 'Visita', renew: 'false' });
    window.location.href = 'caja.html?' + params.toString();
  }).catch(function() { alert("Error de conexión"); });
};

// ═══════════════════════════════════════
// ASIGNAR CLIENTE
// ═══════════════════════════════════════
window.abrirModalAsignar = function(id, num) {
  var select = document.getElementById('modalClienteSelect');
  select.innerHTML = '<option value="">-- Seleccione Cliente --</option>';
  var available = clientesCache.filter(function(c) {
    return !allSpots.some(function(s) { return (s.cliente_placa || '').trim() === c.placa && s.estado === 'ocupado'; });
  });
  if (available.length === 0) {
    var opt = document.createElement("option"); opt.disabled = true; opt.text = "No hay clientes disponibles"; select.add(opt);
  } else {
    available.forEach(function(c) { var o = document.createElement("option"); o.value = c.id; o.text = c.nombre + ' (' + c.placa + ')'; select.add(o); });
  }
  document.getElementById('modalAsignarTitle').innerText = 'Asignar #' + num;
  document.getElementById('spotIdOculto').value = id;
  toggleModal('modalAsignar', true);
};
window.cerrarModal = function() { toggleModal('modalAsignar', false); };
window.confirmarAsignar = function() {
  var cid = document.getElementById('modalClienteSelect').value;
  var sid = document.getElementById('spotIdOculto').value;
  if (!cid) return alert("Seleccione un cliente");
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sid, accion: "asignar_registrado", cliente_id: cid }) })
  .then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) { toggleModal('modalAsignar', false); mostrarToast("Asignado"); cargarPuestos(); }
    else alert("Error: " + (data.error || "Desconocido"));
  }).catch(function() { alert("Error de conexión"); });
};

// ═══════════════════════════════════════
// VISITANTE (con tipo_vehiculo)
// ═══════════════════════════════════════
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
    return !allSpots.some(function(s) { return (s.cliente_placa || '').trim() === c.placa && s.estado === 'ocupado'; });
  }).forEach(function(c) { cSelect.add(new Option(c.nombre + ' (' + c.placa + ')', c.id)); });

  var manualRadio = document.querySelector('input[name="visitanteType"][value="manual"]');
  if (manualRadio) manualRadio.checked = true;
  document.getElementById('visitanteNombre').value = '';
  document.getElementById('visitantePlaca').value = '';
  document.getElementById('visitanteNombre').readOnly = false;
  document.getElementById('visitantePlaca').readOnly = false;
  document.getElementById('visitanteTipoVehiculo').value = 'Carro';
  document.getElementById('visitanteTipoVehiculo').disabled = false;
  window.onVisitanteTypeChange();

  toggleModal('modalVisitante', true);
};
window.cerrarModalVisitante = function() { toggleModal('modalVisitante', false); };
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
  var tipoSelect = document.getElementById('visitanteTipoVehiculo');
  if (cid) {
    var c = clientesCache.find(function(x) { return x.id == cid; });
    if (c) {
      nameInput.value = c.nombre; plateInput.value = c.placa;
      nameInput.readOnly = true; plateInput.readOnly = true;
      tipoSelect.value = c.tipo_vehiculo || 'Carro';
      tipoSelect.disabled = true;
    }
  } else {
    nameInput.value = ''; plateInput.value = '';
    nameInput.readOnly = false; plateInput.readOnly = false;
    tipoSelect.value = 'Carro'; tipoSelect.disabled = false;
  }
};
window.confirmarVisitante = function() {
  var sid = document.getElementById('visitanteSpotSelect').value;
  var typeRadio = document.querySelector('input[name="visitanteType"]:checked');
  var nombre = document.getElementById('visitanteNombre').value.trim();
  var placa = document.getElementById('visitantePlaca').value.trim().toUpperCase();
  var tipoVeh = document.getElementById('visitanteTipoVehiculo').value;
  var cid = null;

  if (typeRadio && typeRadio.value === 'registered') {
    cid = document.getElementById('visitanteClientSelect').value;
    var c = clientesCache.find(function(x) { return x.id == cid; });
    if (c) { nombre = c.nombre; placa = c.placa.trim().toUpperCase(); tipoVeh = c.tipo_vehiculo || 'Carro'; }
  }
  if (!sid || !nombre || !placa) return alert("Complete los datos");

  fetch("/api/puestos", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: sid, accion: "asignar_visitante", temp_name: nombre, temp_plate: placa, tipo_vehiculo: tipoVeh, cliente_id: cid })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) { toggleModal('modalVisitante', false); mostrarToast("Visitante registrado"); cargarPuestos(); }
    else alert("Error: " + (data.error || "Desconocido"));
  }).catch(function() { alert("Error de conexión"); });
};

// ═══════════════════════════════════════
// RESERVAR
// ═══════════════════════════════════════
window.abrirModalReservar = function(id, num) {
  document.getElementById('reservaId').value = id;
  document.getElementById('reservaTitle').innerText = 'Reservar Puesto #' + num;
  document.getElementById('reservaNombre').value = '';
  document.getElementById('reservaPlaca').value = '';
  toggleModal('modalReservar', true);
};
window.cerrarModalReservar = function() { toggleModal('modalReservar', false); };
window.confirmarReservar = function() {
  var id = document.getElementById('reservaId').value;
  var nombre = document.getElementById('reservaNombre').value.trim();
  var placa = document.getElementById('reservaPlaca').value.trim().toUpperCase();
  if (!nombre) return alert("Nombre requerido");
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "reservar", nombre: nombre, placa: placa }) })
  .then(function() { toggleModal('modalReservar', false); cargarPuestos(); mostrarToast("Reserva creada"); })
  .catch(function() { mostrarToast("Error", "error"); });
};

// ═══════════════════════════════════════
// OCUPAR RESERVA
// ═══════════════════════════════════════
window.ocuparReserva = function(id) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;
  var meta = {};
  try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e) {}
  var rNombre = (meta.reservation && meta.reservation.nombre) ? meta.reservation.nombre : '';
  var rPlaca = (meta.reservation && meta.reservation.placa) ? meta.reservation.placa.trim().toUpperCase() : '';
  document.getElementById('ocuparReservaInfo').innerHTML = '<div class="text-sm text-purple-700">Reserva: <strong>' + rNombre + '</strong>' + (rPlaca ? ' — <span class="font-mono font-bold">' + rPlaca + '</span>' : '') + '</div>';
  var select = document.getElementById('ocuparReservaClienteSelect');
  select.innerHTML = '<option value="">-- Sin cliente registrado --</option>';
  var available = clientesCache.filter(function(c) { return !allSpots.some(function(s) { return (s.cliente_placa || '').trim() === c.placa && s.estado === 'ocupado'; }); });
  var defOpt = '';
  available.forEach(function(c) {
    select.add(new Option(c.nombre + ' (' + c.placa + ')', c.id));
    if (rPlaca && c.placa.toUpperCase() === rPlaca.toUpperCase()) defOpt = c.id;
  });
  if (defOpt) select.value = defOpt;
  document.getElementById('ocuparReservaId').value = id;
  toggleModal('modalOcuparReserva', true);
};
window.confirmarOcuparReserva = function() {
  var id = document.getElementById('ocuparReservaId').value;
  var clientId = document.getElementById('ocuparReservaClienteSelect').value;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "ocupar_reserva", cliente_id: clientId || null }) })
  .then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) { toggleModal('modalOcuparReserva', false); mostrarToast(data.message); cargarPuestos(); }
    else mostrarToast(data.error || "Error", "error");
  }).catch(function() { mostrarToast("Error", "error"); });
};
window.cerrarModalOcuparReserva = function() { toggleModal('modalOcuparReserva', false); };

// ═══════════════════════════════════════
// ACCIONES RAPIDAS (mantenidas para compatibilidad)
// ═══════════════════════════════════════
window.liberar = function(id) {
  if (!confirm("¿Cancelar reserva?")) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salir_visitante" }) })
  .then(function() { cargarPuestos(); mostrarToast("Reserva cancelada"); }).catch(function() { mostrarToast("Error", "error"); });
};
window.salirVisitante = function(id) {
  if (!confirm("¿Dar salida al visitante sin cobro?")) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salir_visitante" }) })
  .then(function() { cargarPuestos(); mostrarToast("Visitante salió"); }).catch(function() { mostrarToast("Error", "error"); });
};
window.salirViaje = function(id) {
  var s = allSpots.find(function(x) { return x.id === id; });
  if (!s) return;
  if (!confirm('¿SALIDA DE VIAJE?\n\n' + (s.cliente_nombre || 'Sin nombre') + '\n\nEl puesto quedará guardado.')) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salida_viaje" }) })
  .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error, "error"); })
  .catch(function() { mostrarToast("Error", "error"); });
};
window.restaurarDueno = function(id) {
  var spot = allSpots.find(function(x) { return x.id === id; });
  if (!spot) return mostrarToast("No encontrado", "error");
  var ownerInfo = {};
  try { ownerInfo = JSON.parse(spot.puesto_info || '{}'); } catch(e) {}
  if (!ownerInfo.nombre) return mostrarToast("Sin dueño guardado", "error");
  var diasFuera = calcularDiasFuera(ownerInfo.fecha_salida);
  var hayVisitante = spot.estado === 'ocupado' && !spot.cliente_id;
  var adv = hayVisitante ? '\n\n⚠️ HAY VISITANTE. Será desplazado.' : '';
  if (!confirm('¿RESTAURAR a ' + ownerInfo.nombre + '?\nFuera: ' + (diasFuera === 0 ? 'Hoy' : diasFuera + ' día(s)') + adv)) return;
  function doRestore() {
    fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "restaurar_dueno" }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error, "error"); })
    .catch(function() { mostrarToast("Error", "error"); });
  }
  if (hayVisitante) { fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salir_visitante" }) }).then(function() { doRestore(); }); }
  else { doRestore(); }
};
window.limpiarPuesto = function(id) {
  if (!confirm("¿LIMPIAR TODO?")) return;
  fetch('/api/puestos?id=' + id, { method: "PATCH" }).then(function() { cargarPuestos(); mostrarToast("Puesto limpiado"); }).catch(function() { mostrarToast("Error", "error"); });
};
window.eliminarPuesto = function(id) {
  if (!confirm("¿ELIMINAR ESTE PUESTO?\nEsta acción no se puede deshacer.")) return;
  fetch('/api/puestos?id=' + id, { method: "DELETE" }).then(function(r) { return r.json(); }).then(function(data) { mostrarToast("Eliminado"); cargarPuestos(); }).catch(function() { mostrarToast("Error", "error"); });
};
window.editarNumeroPuesto = function(id, num) {
  var n = prompt("Nuevo número:", num);
  if (!n || n === num) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "editar_numero", nuevo_numero: n }) })
  .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { mostrarToast("Actualizado"); cargarPuestos(); } else mostrarToast(data.error, "error"); })
  .catch(function() { mostrarToast("Error", "error"); });
};

// ═══════════════════════════════════════
// MENU MOVIL
// ═══════════════════════════════════════
window.toggleMenu = function() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('mobileMenuOverlay');
  if (sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden');
  }
};