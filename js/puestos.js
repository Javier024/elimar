document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

var allSpots = [];
var clientesCache = [];
var currentFilterStatus = 'todos';
var currentSpotId = null;
var cobroData = null;
var formularioSpot = null;
var configData = {};

function mostrarToast(mensaje, tipo) {
  if (typeof document === 'undefined') return;
  tipo = tipo || 'success';
  var toastExistente = document.getElementById('custom-toast');
  if (toastExistente) toastExistente.remove();
  var toast = document.createElement('div');
  toast.id = 'custom-toast';
  toast.className = 'fixed top-5 right-5 z-[150] px-6 py-4 rounded-xl shadow-2xl border transform transition-all duration-300 max-w-[90%] flex items-center gap-3 ';
  if (tipo === 'error') { toast.className += 'bg-red-50 text-red-800 border-red-200'; }
  else if (tipo === 'warning') { toast.className += 'bg-amber-50 text-amber-800 border-amber-200'; }
  else { toast.className += 'bg-emerald-50 text-emerald-800 border-emerald-200'; }
  var icon = tipo === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i>' : tipo === 'warning' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
  toast.innerHTML = icon + ' <span class="font-bold text-sm">' + mensaje + '</span>';
  document.body.appendChild(toast);
  requestAnimationFrame(function() { toast.classList.remove('translate-x-full', 'opacity-0'); });
  setTimeout(function() { toast.classList.add('translate-x-full', 'opacity-0'); setTimeout(function() { toast.remove(); }, 300); }, 3000);
}

function toggleModal(modalId, show) {
  var modal = document.getElementById(modalId);
  if (!modal) return;
  var content = modal.querySelector('[id$="Content"]');
  if (!content) content = modal.children[0];
  if (show) {
    modal.classList.remove('hidden'); modal.classList.add('flex');
    requestAnimationFrame(function() { modal.classList.remove('opacity-0'); if (content) { content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); } });
  } else {
    modal.classList.add('opacity-0');
    if (content) { content.classList.add('scale-95', 'opacity-0'); content.classList.remove('scale-100', 'opacity-100'); }
    setTimeout(function() { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 200);
  }
}

window.toggleKeyInput = function(checkboxId, containerId) {
  var checked = document.getElementById(checkboxId).checked;
  var container = document.getElementById(containerId);
  if (checked) { container.classList.remove('hidden'); var inp = container.querySelector('input'); if (inp) setTimeout(function() { inp.focus(); }, 50); }
  else { container.classList.add('hidden'); var inp = container.querySelector('input'); if (inp) inp.value = ''; }
};

window.getKeyInfo = function(checkboxId, inputId) {
  var tiene = document.getElementById(checkboxId).checked;
  var desc = '';
  if (tiene) { desc = document.getElementById(inputId).value.trim() || 'Sin descripción'; }
  return { tiene: tiene, desc: desc };
};

window.resetKeyInput = function(checkboxId, inputId, containerId) {
  document.getElementById(checkboxId).checked = false;
  document.getElementById(inputId).value = '';
  document.getElementById(containerId).classList.add('hidden');
};

function getLlaveFromMeta(meta) {
  if (!meta) return {};
  if (meta.llave) return meta.llave;
  return {};
}

function calcularCobroDiario(horaInicioUnix, tipoVehiculo) {
  if (!horaInicioUnix) return { dias: 0, tarifa: 0, tipoLabel: 'Carro', total: 0 };
  var diff = Math.floor(Date.now() / 1000) - Number(horaInicioUnix);
  var totalDias = Math.floor(diff / 86400);
  if (totalDias < 1) totalDias = 1;
  var tarifaCarro = (configData && configData.tarifa_particular_noche) || 8000;
  var tarifaMoto = (configData && configData.tarifa_moto_noche) || 5000;
  var tarifaCamioneta = (configData && configData.tarifa_camioneta_noche) || 10000;
  var tarifa = tarifaCarro, tipoLabel = 'Carro';
  if (tipoVehiculo && tipoVehiculo.toLowerCase().includes('moto')) { tarifa = tarifaMoto; tipoLabel = 'Moto'; }
  if (tipoVehiculo && tipoVehiculo.toLowerCase().includes('camioneta')) { tarifa = tarifaCamioneta; tipoLabel = 'Camioneta'; }
  return { dias: totalDias, tarifa: tarifa, tipoLabel: tipoLabel, total: totalDias * tarifa };
}

function calcularTiempo(horaInicioUnix) {
  if (!horaInicioUnix) return "";
  var diff = new Date() - new Date(Number(horaInicioUnix) * 1000);
  var totalDias = Math.floor(diff / 86400000);
  var totalSemanas = Math.floor(totalDias / 7);
  var totalMeses = Math.floor(totalDias / 30);
  if (totalMeses >= 1) { var d = totalDias - (totalMeses * 30); if (d > 0 && totalMeses < 12) return totalMeses + ' mes' + (totalMeses > 1 ? 'es' : '') + ' ' + d + 'd'; return totalMeses + ' mes' + (totalMeses > 1 ? 'es' : ''); }
  if (totalSemanas >= 1) { var d = totalDias - (totalSemanas * 7); if (d > 0) return totalSemanas + ' sem ' + d + 'd'; return totalSemanas + ' semana' + (totalSemanas > 1 ? 's' : ''); }
  if (totalDias >= 1) return totalDias + ' día' + (totalDias > 1 ? 's' : '');
  var h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function formatHoraEntrada(timestamp) {
  if (!timestamp) return "---";
  var date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function calcularDiasFuera(fechaSalidaUnix) {
  if (!fechaSalidaUnix) return 0;
  return Math.max(0, Math.floor((Math.floor(Date.now() / 1000) - Number(fechaSalidaUnix)) / 86400));
}

function formatDiasFuera(fechaSalidaUnix) {
  var dias = calcularDiasFuera(fechaSalidaUnix);
  if (dias === 0) return 'Hoy'; if (dias === 1) return '1 día'; return dias + ' días';
}

function getIconForType(tipo) {
  if (!tipo) return 'fa-car'; var t = tipo.toLowerCase();
  if (t.includes('moto')) return 'fa-motorcycle'; if (t.includes('camioneta')) return 'fa-truck-pickup'; return 'fa-car';
}

function calcularVencimiento(fechaPagoStr, cuotaMensual) {
  if (!fechaPagoStr || !cuotaMensual || Number(cuotaMensual) <= 0) return null;
  var fechaPago = new Date(fechaPagoStr);
  if (isNaN(fechaPago.getTime())) return null;
  var fechaVencimiento = new Date(fechaPago);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0); fechaVencimiento.setHours(0, 0, 0, 0);
  var diffDias = Math.floor((hoy - fechaVencimiento) / 86400000);
  return { fechaPago: fechaPago, fechaVencimiento: fechaVencimiento, vencido: diffDias > 0, diasVencido: diffDias > 0 ? diffDias : 0, diasParaVencer: diffDias <= 0 ? Math.abs(diffDias) : 0 };
}

function formatFechaCorta(date) {
  if (!date || isNaN(date.getTime())) return '---';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function contarLlavesEntregadas() {
  var count = 0;
  allSpots.forEach(function(s) {
    if (s.estado !== 'ocupado' && s.estado !== 'reservado') return;
    try { var meta = JSON.parse(s.llave_caracteristicas || '{}'); if (meta.llave && meta.llave.tiene) count++; } catch(e) {}
  });
  return count;
}

function cargarConfiguracion() {
  fetch('/api/configuracion')
    .then(function(res) { if (res.ok) return res.json(); return {}; })
    .then(function(data) { configData = data || {}; window.configData = configData; })
    .catch(function() { configData = {}; window.configData = {}; });
}

/* ===== INGRESO EXPRESS ===== */
window.abrirIngresoExpress = function() {
  document.getElementById('expressPlaca').value = '';
  document.getElementById('expressResultado').innerHTML = '';
  document.getElementById('expressResultado').classList.add('hidden');
  toggleModal('modalIngresoExpress', true);
  setTimeout(function() { document.getElementById('expressPlaca').focus(); }, 150);
};

window.cerrarIngresoExpress = function() { toggleModal('modalIngresoExpress', false); };

window.buscarExpressPlaca = function() {
  var placa = document.getElementById('expressPlaca').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  var resDiv = document.getElementById('expressResultado');
  if (placa.length < 4) { resDiv.innerHTML = '<div class="text-xs text-slate-400 text-center py-2">Mínimo 4 caracteres</div>'; resDiv.classList.remove('hidden'); return; }
  resDiv.innerHTML = '<div class="text-center py-3 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Buscando...</div>'; resDiv.classList.remove('hidden');
  setTimeout(function() {
    var enPuesto = null;
    allSpots.forEach(function(s) {
      if (s.estado !== 'ocupado') return;
      if (s.cliente_placa && s.cliente_placa.trim().toUpperCase() === placa) { enPuesto = s; return; }
      try { var m = JSON.parse(s.llave_caracteristicas || '{}'); if (m.temp_user && m.temp_user.placa && m.temp_user.placa.toUpperCase() === placa) enPuesto = s; } catch(e) {}
    });
    if (enPuesto) {
      resDiv.innerHTML = '<div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800/50 text-center space-y-1"><i class="fa-solid fa-car text-red-400 text-xl"></i><p class="text-sm font-bold text-red-700 dark:text-red-300">Ya está en puesto</p><p class="text-2xl font-black text-red-800 dark:text-red-200">#' + enPuesto.numero + '</p></div>';
      return;
    }
    var cliente = clientesCache.find(function(c) { return c.placa && c.placa.trim().toUpperCase() === placa; });
    var libres = allSpots.filter(function(s) { return s.estado === 'libre'; });
    if (libres.length === 0) {
      resDiv.innerHTML = '<div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800/50 text-center"><i class="fa-solid fa-ban text-red-400 text-xl"></i><p class="text-sm font-bold text-red-700 dark:text-red-300">No hay puestos libres</p></div>';
      return;
    }
    if (cliente) {
      var vencInfo = '';
      if (Number(cliente.cuota_mensual) > 0) {
        var pagoFecha = null;
        allSpots.forEach(function(s) { if (s.cliente_placa && s.cliente_placa.trim().toUpperCase() === placa && s.ultimo_pago_fecha) pagoFecha = s.ultimo_pago_fecha; });
        var venc = calcularVencimiento(pagoFecha, cliente.cuota_mensual);
        if (!pagoFecha) vencInfo = '<div class="text-[10px] text-red-500 font-bold mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Sin pago registrado</div>';
        else if (venc && venc.vencido) vencInfo = '<div class="text-[10px] text-red-500 font-bold mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Vencido ' + venc.diasVencido + ' días</div>';
      }
      var spotsOpts = libres.map(function(s) { var owner = {}; try { owner = JSON.parse(s.puesto_info || '{}'); } catch(e) {} var label = owner.nombre ? '#' + s.numero + ' (Dueño: ' + owner.nombre + ')' : '#' + s.numero; return '<option value="' + s.id + '">' + label + '</option>'; }).join('');
      resDiv.innerHTML = '<div class="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/50 space-y-3"><div class="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase"><i class="fa-solid fa-user-check"></i> Cliente Registrado</div><div class="text-sm"><span class="text-slate-500 dark:text-slate-400 text-xs block">Nombre</span><span class="font-bold text-slate-800 dark:text-white">' + cliente.nombre + '</span></div><div class="text-sm"><span class="text-slate-500 dark:text-slate-400 text-xs block">Teléfono</span><span class="font-bold text-slate-800 dark:text-white">' + (cliente.telefono || '---') + '</span></div><div class="text-sm"><span class="text-slate-500 dark:text-slate-400 text-xs block">Vehículo</span><span class="font-bold text-slate-800 dark:text-white">' + (cliente.tipo_vehiculo || 'Carro') + '</span></div>' + vencInfo + '<div class="pt-2 border-t border-indigo-100 dark:border-indigo-800/50"><label class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Asignar a puesto</label><select id="expressSpotSelect" class="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500">' + spotsOpts + '</select></div><button onclick="confirmarExpressAsignar(\'' + cliente.id + '\')" class="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-check"></i> Asignar</button></div>';
    } else {
      var spotsOpts2 = libres.map(function(s) { var owner = {}; try { owner = JSON.parse(s.puesto_info || '{}'); } catch(e) {} var label = owner.nombre ? '#' + s.numero + ' (Dueño: ' + owner.nombre + ')' : '#' + s.numero; return '<option value="' + s.id + '">' + label + '</option>'; }).join('');
      resDiv.innerHTML = '<div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/50 space-y-3"><div class="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase"><i class="fa-solid fa-user-group"></i> Visitante Nuevo</div><div><label class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nombre</label><input id="expressVisitNombre" class="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500" placeholder="Nombre del visitante"></div><div><label class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tipo vehículo</label><select id="expressVisitTipo" class="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"><option value="Carro">Carro</option><option value="Camioneta">Camioneta</option><option value="Moto">Moto</option></select></div><div class="pt-2 border-t border-amber-100 dark:border-amber-800/50"><label class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Asignar a puesto</label><select id="expressSpotSelect2" class="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500">' + spotsOpts2 + '</select></div><button onclick="confirmarExpressVisitante(\'' + placa + '\')" class="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-check"></i> Registrar Visitante</button></div>';
      setTimeout(function() { var ni = document.getElementById('expressVisitNombre'); if (ni) ni.focus(); }, 100);
    }
  }, 200);
};

window.confirmarExpressAsignar = function(clienteId) {
  var spotId = document.getElementById('expressSpotSelect').value;
  if (!spotId) return mostrarToast("Seleccione puesto", "error");
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: spotId, accion: "asignar_registrado", cliente_id: clienteId }) }).then(function(r) { return r.json(); }).then(function(data) { if (data.success) { cerrarIngresoExpress(); mostrarToast("Cliente asignado"); cargarPuestos(); } else mostrarToast(data.error || "Error", "error"); }).catch(function() { mostrarToast("Error", "error"); });
};

window.confirmarExpressVisitante = function(placa) {
  var spotId = document.getElementById('expressSpotSelect2').value;
  var nombre = document.getElementById('expressVisitNombre').value.trim();
  var tipo = document.getElementById('expressVisitTipo').value;
  if (!spotId) return mostrarToast("Seleccione puesto", "error");
  if (!nombre) return mostrarToast("Nombre requerido", "error");
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: spotId, accion: "asignar_visitante", temp_name: nombre, temp_plate: placa, tipo_vehiculo: tipo }) }).then(function(r) { return r.json(); }).then(function(data) { if (data.success) { cerrarIngresoExpress(); mostrarToast("Visitante registrado"); cargarPuestos(); } else mostrarToast(data.error || "Error", "error"); }).catch(function() { mostrarToast("Error", "error"); });
};

/* ===== INIT ===== */
function initApp() {
  cargarConfiguracion();
  cargarPuestos();
  cargarClientesCache();
  var searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", function(e) { renderMapa(e.target.value.toLowerCase()); });
  setInterval(function() { document.querySelectorAll('[data-fecha-salida]').forEach(function(el) { var ts = el.getAttribute('data-fecha-salida'); if (ts) el.innerText = formatDiasFuera(ts); }); }, 60000);
}

function cargarClientesCache() {
  fetch("/api/clientes").then(function(res) { return res.ok ? res.json() : []; }).then(function(data) { clientesCache = data.map(function(c) { if (c.placa) c.placa = c.placa.trim(); return c; }); }).catch(function() { clientesCache = []; });
}

function cargarPuestos() {
  fetch("/api/puestos").then(function(res) { if (!res.ok) throw new Error("Error API"); return res.json(); }).then(function(data) {
    allSpots = data.sort(function(a, b) { return (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0); });
    var elLibres = document.getElementById('kpi-libres'), elOcupados = document.getElementById('kpi-ocupados'), elTotal = document.getElementById('kpi-total'), elLlaves = document.getElementById('kpi-llaves');
    if (elLibres) elLibres.innerText = allSpots.filter(function(s) { return s.estado === 'libre'; }).length;
    if (elOcupados) elOcupados.innerText = allSpots.filter(function(s) { return s.estado === 'ocupado'; }).length;
    if (elTotal) elTotal.innerText = allSpots.length;
    if (elLlaves) { var llaves = contarLlavesEntregadas(); elLlaves.innerText = llaves; if (llaves > 0) { elLlaves.parentElement.classList.remove('border-slate-200', 'dark:border-slate-700'); elLlaves.parentElement.classList.add('border-amber-300', 'dark:border-amber-700'); } else { elLlaves.parentElement.classList.remove('border-amber-300', 'dark:border-amber-700'); elLlaves.parentElement.classList.add('border-slate-200', 'dark:border-slate-700'); } }
    renderMapa();
  }).catch(function() { mostrarToast("Error cargando datos", "error"); });
}

window.filtrarMapa = function(f) {
  currentFilterStatus = f;
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    var filter = btn.dataset.filter;
    if (filter === f) {
      if (filter === 'vencidos') { btn.className = 'filter-btn px-4 py-2 rounded-lg text-xs font-bold transition-colors bg-red-600 text-white border border-red-600'; }
      else { btn.className = 'filter-btn px-4 py-2 rounded-lg text-xs font-bold transition-colors bg-slate-800 text-white dark:bg-slate-700 dark:text-white'; }
    } else {
      if (filter === 'vencidos') { btn.className = 'filter-btn px-4 py-2 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/50 transition-colors'; }
      else { btn.className = 'filter-btn px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors'; }
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
  if (currentFilterStatus === 'vencidos') {
    datos = datos.filter(function(s) {
      if (s.estado !== 'ocupado' || !s.cliente_id) return false;
      var cuota = s.cuota_mensual || 0;
      if (!cuota) return false;
      if (!s.ultimo_pago_fecha) return true;
      var venc = calcularVencimiento(s.ultimo_pago_fecha, cuota);
      return venc && venc.vencido;
    });
  } else if (currentFilterStatus !== 'todos') {
    datos = datos.filter(function(s) { return s.estado === currentFilterStatus; });
  }
  if (busqueda) {
    var term = busqueda.toLowerCase().trim();
    datos = datos.filter(function(s) {
      if (s.numero.toLowerCase().includes(term)) return true;
      if (s.cliente_nombre && s.cliente_nombre.toLowerCase().includes(term)) return true;
      if (s.cliente_placa && s.cliente_placa.toLowerCase().includes(term)) return true;
      try { var meta = JSON.parse(s.llave_caracteristicas || '{}'); if (meta.temp_user) { if (meta.temp_user.nombre && meta.temp_user.nombre.toLowerCase().includes(term)) return true; if (meta.temp_user.placa && meta.temp_user.placa.toLowerCase().includes(term)) return true; } if (meta.reservation) { if (meta.reservation.nombre && meta.reservation.nombre.toLowerCase().includes(term)) return true; if (meta.reservation.placa && meta.reservation.placa.toLowerCase().includes(term)) return true; } } catch (e) {}
      try { var owner = JSON.parse(s.puesto_info || '{}'); if (owner.nombre && owner.nombre.toLowerCase().includes(term)) return true; if (owner.placa && owner.placa.toLowerCase().includes(term)) return true; } catch (e) {}
      return false;
    });
  }
  if (datos.length === 0) { container.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400"><i class="fa-solid fa-ghost text-4xl mb-3 opacity-30"></i><p class="text-sm">No se encontraron puestos</p></div>'; return; }
  var fragment = document.createDocumentFragment();
  datos.forEach(function(spot) { var div = document.createElement('div'); div.innerHTML = getSlotHTML(spot); fragment.appendChild(div.firstElementChild); });
  container.appendChild(fragment);
}

function getSlotHTML(s) {
  var meta = {}, ownerInfo = null;
  try { meta = JSON.parse(s.llave_caracteristicas || '{}'); } catch (e) {}
  try { ownerInfo = JSON.parse(s.puesto_info || '{}'); } catch (e) {}
  var isTempUser = !s.cliente_id && meta.temp_user;
  var hasOwner = ownerInfo && ownerInfo.nombre;
  var bgColor = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700/50';
  var textColor = 'text-emerald-700 dark:text-emerald-300';
  var placaText = '', smallIcon = '';
  if (s.estado === 'reservado') {
    bgColor = 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700/50'; textColor = 'text-purple-700 dark:text-purple-300';
    smallIcon = '<i class="fa-solid fa-bookmark text-[9px] absolute top-1.5 left-2 opacity-60"></i>';
  } else if (s.estado === 'ocupado' && isTempUser) {
    bgColor = 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50'; textColor = 'text-amber-700 dark:text-amber-300';
    placaText = (meta.temp_user.placa || '').toUpperCase(); smallIcon = '<i class="fa-solid ' + getIconForType(meta.temp_user.tipo_vehiculo || '') + ' text-[9px] absolute top-1.5 left-2 opacity-60"></i>';
  } else if (s.estado === 'ocupado') {
    var tieneCuota = Number(s.cuota_mensual) > 0;
    if (tieneCuota) {
      var venc = calcularVencimiento(s.ultimo_pago_fecha, s.cuota_mensual);
      if (venc && venc.vencido) { bgColor = 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700/50'; textColor = 'text-red-700 dark:text-red-300'; }
      else if (venc && venc.diasParaVencer <= 5) { bgColor = 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50'; textColor = 'text-amber-700 dark:text-amber-300'; }
      else if (!s.ultimo_pago_fecha) { bgColor = 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-700/30 border-dashed'; textColor = 'text-red-600 dark:text-red-400'; }
      else { bgColor = 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700/50'; textColor = 'text-indigo-700 dark:text-indigo-300'; }
    } else { bgColor = 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700/50'; textColor = 'text-indigo-700 dark:text-indigo-300'; }
    placaText = (s.cliente_placa || '').toUpperCase(); smallIcon = '<i class="fa-solid ' + getIconForType(s.cliente_tipo_vehiculo) + ' text-[9px] absolute top-1.5 left-2 opacity-60"></i>';
  } else if (s.estado === 'libre' && hasOwner) {
    bgColor = 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-300/60 dark:border-amber-700/30 border-dashed'; textColor = 'text-amber-600 dark:text-amber-400';
    smallIcon = '<i class="fa-solid fa-plane-departure text-[9px] absolute top-1.5 left-2 opacity-50"></i>';
  }
  var llaveHTML = '';
  var llaveInfo = getLlaveFromMeta(meta);
  if (llaveInfo.tiene) { llaveHTML = '<div class="text-[9px] text-amber-500 truncate px-1 text-center leading-tight flex items-center justify-center gap-0.5 mt-0.5" title="Llave: ' + (llaveInfo.desc || 'Sí') + '"><i class="fa-solid fa-key"></i></div>'; }
  var vencHTML = '';
  if (s.estado === 'ocupado' && !isTempUser && Number(s.cuota_mensual) > 0) {
    var vencCard = calcularVencimiento(s.ultimo_pago_fecha, s.cuota_mensual);
    if (vencCard && vencCard.vencido) { vencHTML = '<div class="text-[9px] text-red-500 truncate px-1 text-center leading-tight flex items-center justify-center gap-0.5 mt-0.5" title="Vencido hace ' + vencCard.diasVencido + ' días"><i class="fa-solid fa-clock"></i> +' + vencCard.diasVencido + 'd</div>'; }
    else if (vencCard && vencCard.diasParaVencer <= 5 && vencCard.diasParaVencer > 0) { vencHTML = '<div class="text-[9px] text-amber-500 truncate px-1 text-center leading-tight flex items-center justify-center gap-0.5 mt-0.5" title="Vence en ' + vencCard.diasParaVencer + ' días"><i class="fa-solid fa-clock"></i> ' + vencCard.diasParaVencer + 'd</div>'; }
    else if (!s.ultimo_pago_fecha) { vencHTML = '<div class="text-[9px] text-red-400 truncate px-1 text-center leading-tight flex items-center justify-center gap-0.5 mt-0.5" title="Sin pago registrado"><i class="fa-solid fa-exclamation"></i></div>'; }
  }
  var placaHTML = placaText ? '<div class="text-[10px] sm:text-[11px] font-mono font-bold ' + textColor + ' truncate px-1 text-center leading-tight">' + placaText + '</div>' : '';
  return '<div class="group relative ' + bgColor + ' border-2 rounded-xl p-2 sm:p-3 flex flex-col items-center justify-center min-h-[80px] sm:min-h-[95px] cursor-pointer hover:shadow-lg hover:scale-[1.03] transition-all duration-200 select-none" onclick="abrirFormularioPuesto(' + s.id + ')">' +
    '<button onclick="event.stopPropagation(); eliminarPuesto(' + s.id + ')" class="absolute -top-1.5 -right-1.5 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 text-white rounded-full text-[9px] sm:text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-red-600 hover:scale-110 z-20"><i class="fa-solid fa-xmark"></i></button>' +
    smallIcon + '<div class="text-lg sm:text-xl font-black ' + textColor + ' mt-1">' + s.numero + '</div>' + placaHTML + llaveHTML + vencHTML + '</div>';
}

/* ═══════════════════════════════════════════════════════════
   FORMULARIO DEL PUESTO
   ═══════════════════════════════════════════════════════════ */
window.abrirFormularioPuesto = function(id) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;
  var meta = {}, ownerInfo = null;
  try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch (e) {}
  try { ownerInfo = JSON.parse(spot.puesto_info || '{}'); } catch (e) {}
  var isTempUser = !spot.cliente_id && meta.temp_user;
  var hasOwner = ownerInfo && ownerInfo.nombre;
  var llaveInfo = getLlaveFromMeta(meta);
  formularioSpot = spot;
  formularioSpot._isTempUser = isTempUser;
  formularioSpot._hasOwner = hasOwner;
  formularioSpot._meta = meta;
  formularioSpot._ownerInfo = ownerInfo;
  formularioSpot._llaveInfo = llaveInfo;
  document.getElementById('formPuestoNumero').innerText = '#' + spot.numero;
  ['formSeccionLibre','formSeccionOcupado','formSeccionVisitante','formSeccionReservado','formSeccionDuenoFuera','formSeccionCobroDiario','formSeccionDuenoEnVisitante','formSeccionVencimiento'].forEach(function(sid) { var el = document.getElementById(sid); if (el) el.classList.add('hidden'); });
  var accionesDiv = document.getElementById('formAcciones');
  accionesDiv.innerHTML = '';
  var badgeEl = document.getElementById('formEstadoBadge');
  var editarBtn = document.getElementById('formBtnEditar');

  if (spot.estado === 'libre' && !hasOwner) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">DISPONIBLE</span>';
    editarBtn.classList.remove('hidden');
    document.getElementById('formSeccionLibre').classList.remove('hidden');
    accionesDiv.innerHTML =
      '<button onclick="formAsignarCliente()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-user-plus"></i> Asignar Cliente</button>' +
      '<button onclick="formIngresarVisitante()" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-user-group"></i> Visitante</button>' +
      '<button onclick="formReservar()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-bookmark"></i> Reservar</button>';
  }

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

  else if (spot.estado === 'ocupado' && !isTempUser) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">OCUPADO</span>';
    editarBtn.classList.add('hidden');
    document.getElementById('formOcupadoNombre').innerText = spot.cliente_nombre || '---';
    document.getElementById('formOcupadoPlaca').innerText = (spot.cliente_placa || '---').toUpperCase();
    document.getElementById('formOcupadoTelefono').innerText = spot.cliente_telefono || '---';
    document.getElementById('formOcupadoTipo').innerText = spot.cliente_tipo_vehiculo || 'Carro';
    document.getElementById('formOcupadoEntrada').innerText = formatHoraEntrada(spot.hora_inicio);
    document.getElementById('formOcupadoTiempo').innerText = calcularTiempo(spot.hora_inicio);
    if (llaveInfo.tiene) { document.getElementById('formOcupadoLlaveDesc').innerText = llaveInfo.desc || 'Sí'; document.getElementById('formOcupadoLlave').classList.remove('hidden'); }
    else { document.getElementById('formOcupadoLlave').classList.add('hidden'); }

    var cuota = spot.cuota_mensual || 0;
    if (!cuota) { var cd = clientesCache.find(function(x) { return x.placa === (spot.cliente_placa || '').trim(); }); if (cd) cuota = cd.cuota_mensual || 0; }

    if (cuota > 0) {
      document.getElementById('formOcupadoCuota').innerText = '$' + Number(cuota).toLocaleString('es-CO') + ' /mes';
      document.getElementById('formSeccionCobroDiario').classList.add('hidden');
      var vencSeccion = document.getElementById('formSeccionVencimiento');
      var venc = calcularVencimiento(spot.ultimo_pago_fecha, cuota);
      if (venc) {
        document.getElementById('formVencFechaPago').innerText = formatFechaCorta(venc.fechaPago);
        document.getElementById('formVencFechaLimite').innerText = formatFechaCorta(venc.fechaVencimiento);
        document.getElementById('formVencUltimoMonto').innerText = '$' + Number(spot.ultimo_pago_monto || 0).toLocaleString('es-CO');
        if (venc.vencido) { document.getElementById('formVencEstado').innerHTML = '<span class="text-red-600 dark:text-red-400 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>VENCIDO ' + venc.diasVencido + ' día(s)</span>'; }
        else if (venc.diasParaVencer === 0) { document.getElementById('formVencEstado').innerHTML = '<span class="text-amber-600 dark:text-amber-400 font-bold"><i class="fa-solid fa-clock mr-1"></i>VENCE HOY</span>'; }
        else if (venc.diasParaVencer <= 5) { document.getElementById('formVencEstado').innerHTML = '<span class="text-amber-600 dark:text-amber-400 font-bold"><i class="fa-solid fa-clock mr-1"></i>Vence en ' + venc.diasParaVencer + ' día(s)</span>'; }
        else { document.getElementById('formVencEstado').innerHTML = '<span class="text-emerald-600 dark:text-emerald-400 font-bold"><i class="fa-solid fa-check-circle mr-1"></i>AL DÍA — Vence en ' + venc.diasParaVencer + ' días</span>'; }
        vencSeccion.classList.remove('hidden');
      } else if (!spot.ultimo_pago_fecha) {
        document.getElementById('formVencFechaPago').innerText = '---';
        document.getElementById('formVencFechaLimite').innerText = '---';
        document.getElementById('formVencUltimoMonto').innerText = '---';
        document.getElementById('formVencEstado').innerHTML = '<span class="text-red-500 dark:text-red-400 font-bold"><i class="fa-solid fa-question-circle mr-1"></i>SIN PAGO REGISTRADO</span>';
        vencSeccion.classList.remove('hidden');
      } else { vencSeccion.classList.add('hidden'); }
    } else {
      document.getElementById('formOcupadoCuota').innerText = 'Sin cuota → Cobro por días';
      var calc = calcularCobroDiario(spot.hora_inicio, spot.cliente_tipo_vehiculo);
      document.getElementById('formCobroDias').innerText = calc.dias;
      document.getElementById('formCobroTarifa').innerText = '$' + calc.tarifa.toLocaleString('es-CO') + '/día (' + calc.tipoLabel + ')';
      document.getElementById('formCobroTotal').innerText = '$' + calc.total.toLocaleString('es-CO');
      document.getElementById('formSeccionCobroDiario').classList.remove('hidden');
    }
    document.getElementById('formSeccionOcupado').classList.remove('hidden');

    accionesDiv.innerHTML =
      '<button onclick="formCobrar()" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</button>' +
      '<button onclick="formSalirViaje()" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-plane-departure"></i> Viaje</button>' +
      '<button onclick="formLimpiar()" class="w-full bg-white hover:bg-red-50 text-red-500 border-2 border-red-200 dark:border-red-800/50 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-eraser"></i> Limpiar Datos</button>';
  }

  else if (spot.estado === 'ocupado' && isTempUser && !hasOwner) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">VISITANTE</span>';
    editarBtn.classList.add('hidden');
    document.getElementById('formVisitNombre').innerText = meta.temp_user.nombre || '---';
    document.getElementById('formVisitPlaca').innerText = (meta.temp_user.placa || '---').toUpperCase();
    document.getElementById('formVisitTelefono').innerText = meta.temp_user.telefono || '---';
    document.getElementById('formVisitTipo').innerText = meta.temp_user.tipo_vehiculo || 'Carro';
    document.getElementById('formVisitEntrada').innerText = formatHoraEntrada(spot.hora_inicio);
    document.getElementById('formVisitTiempo').innerText = calcularTiempo(spot.hora_inicio);
    if (llaveInfo.tiene) { document.getElementById('formVisitLlaveDesc').innerText = llaveInfo.desc || 'Sí'; document.getElementById('formVisitLlave').classList.remove('hidden'); }
    else { document.getElementById('formVisitLlave').classList.add('hidden'); }
    var vCalc = calcularCobroDiario(spot.hora_inicio, meta.temp_user.tipo_vehiculo);
    document.getElementById('formCobroDias').innerText = vCalc.dias;
    document.getElementById('formCobroTarifa').innerText = '$' + vCalc.tarifa.toLocaleString('es-CO') + '/día (' + vCalc.tipoLabel + ')';
    document.getElementById('formCobroTotal').innerText = '$' + vCalc.total.toLocaleString('es-CO');
    document.getElementById('formSeccionCobroDiario').classList.remove('hidden');
    document.getElementById('formSeccionVisitante').classList.remove('hidden');

    accionesDiv.innerHTML =
      '<button onclick="formCobrar()" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</button>' +
      '<button onclick="formSalirVisitante()" class="flex-1 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 dark:border-red-800 py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">Sin Cobro</button>' +
      '<button onclick="formLimpiar()" class="w-full bg-white hover:bg-red-50 text-red-500 border-2 border-red-200 dark:border-red-800/50 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-eraser"></i> Limpiar Datos</button>';
  }

  else if (spot.estado === 'ocupado' && isTempUser && hasOwner) {
    badgeEl.innerHTML = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">VISITANTE</span>';
    editarBtn.classList.add('hidden');
    document.getElementById('formVisitNombre').innerText = meta.temp_user.nombre || '---';
    document.getElementById('formVisitPlaca').innerText = (meta.temp_user.placa || '---').toUpperCase();
    document.getElementById('formVisitTelefono').innerText = meta.temp_user.telefono || '---';
    document.getElementById('formVisitTipo').innerText = meta.temp_user.tipo_vehiculo || 'Carro';
    document.getElementById('formVisitEntrada').innerText = formatHoraEntrada(spot.hora_inicio);
    document.getElementById('formVisitTiempo').innerText = calcularTiempo(spot.hora_inicio);
    if (llaveInfo.tiene) { document.getElementById('formVisitLlaveDesc').innerText = llaveInfo.desc || 'Sí'; document.getElementById('formVisitLlave').classList.remove('hidden'); }
    else { document.getElementById('formVisitLlave').classList.add('hidden'); }
    var vCalc2 = calcularCobroDiario(spot.hora_inicio, meta.temp_user.tipo_vehiculo);
    document.getElementById('formCobroDias').innerText = vCalc2.dias;
    document.getElementById('formCobroTarifa').innerText = '$' + vCalc2.tarifa.toLocaleString('es-CO') + '/día (' + vCalc2.tipoLabel + ')';
    document.getElementById('formCobroTotal').innerText = '$' + vCalc2.total.toLocaleString('es-CO');
    document.getElementById('formSeccionCobroDiario').classList.remove('hidden');
    document.getElementById('formSeccionVisitante').classList.remove('hidden');
    document.getElementById('formDuenoVisitNombre').innerText = ownerInfo.nombre;
    var dfEl2 = document.getElementById('formDuenoVisitDias');
    dfEl2.innerText = formatDiasFuera(ownerInfo.fecha_salida);
    if (ownerInfo.fecha_salida) dfEl2.setAttribute('data-fecha-salida', ownerInfo.fecha_salida);
    document.getElementById('formSeccionDuenoEnVisitante').classList.remove('hidden');

    accionesDiv.innerHTML =
      '<button onclick="formCobrar()" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30"><i class="fa-solid fa-money-bill-wave"></i> Cobrar</button>' +
      '<button onclick="formSalirVisitante()" class="flex-1 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 dark:border-red-800 py-3.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">Sin Cobro</button>' +
      '<button onclick="formRestaurarDueno()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"><i class="fa-solid fa-rotate-left"></i> Restaurar Dueño</button>' +
      '<button onclick="formLimpiar()" class="w-full bg-white hover:bg-red-50 text-red-500 border-2 border-red-200 dark:border-red-800/50 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"><i class="fa-solid fa-eraser"></i> Limpiar Datos</button>';
  }

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

/* ═══════════════════════════════════════════════════════════
   ACCIONES DEL FORMULARIO
   ═══════════════════════════════════════════════════════════ */

window.cerrarFormulario = function() { toggleModal('modalFormularioPuesto', false); formularioSpot = null; };

window.formEditarNumero = function() {
  if (!formularioSpot) return;
  var n = prompt("Nuevo número para puesto #" + formularioSpot.numero + ":", formularioSpot.numero);
  if (!n || n === formularioSpot.numero) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: formularioSpot.id, accion: "editar_numero", nuevo_numero: n }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { cerrarFormulario(); mostrarToast("Actualizado"); cargarPuestos(); } else mostrarToast(data.error, "error"); }).catch(function() { mostrarToast("Error", "error"); });
};

window.formAsignarCliente = function() { var id = formularioSpot.id, num = formularioSpot.numero; cerrarFormulario(); setTimeout(function() { abrirModalAsignar(id, num); }, 250); };
window.formIngresarVisitante = function() { cerrarFormulario(); setTimeout(function() { abrirModalVisitante(); }, 250); };
window.formReservar = function() { var id = formularioSpot.id, num = formularioSpot.numero; cerrarFormulario(); setTimeout(function() { abrirModalReservar(id, num); }, 250); };

window.formCobrar = function() {
  var spot = formularioSpot;
  if (!spot) return;
  var type = spot._isTempUser ? 'visitante' : 'cliente';
  cerrarFormulario();
  setTimeout(function() { abrirModalCobro(spot.id, type); }, 250);
};

window.formSalirViaje = function() {
  var s = formularioSpot;
  if (!confirm('¿SALIDA DE VIAJE?\n\n' + (s.cliente_nombre || 'Sin nombre') + '\n\nEl puesto quedará guardado con sus datos.\nPodrá ingresar un visitante temporalmente.')) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id, accion: "salida_viaje" }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { cerrarFormulario(); mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error, "error"); }).catch(function() { mostrarToast("Error", "error"); });
};

window.formSalirVisitante = function() {
  if (!confirm("¿Dar salida al visitante sin cobro?")) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: formularioSpot.id, accion: "salir_visitante" }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { cerrarFormulario(); cargarPuestos(); mostrarToast(data.message); } else mostrarToast(data.error, "error"); }).catch(function() { mostrarToast("Error", "error"); });
};

window.formRestaurarDueno = function() {
  var spot = formularioSpot;
  var ownerInfo = spot._ownerInfo;
  if (!ownerInfo || !ownerInfo.nombre) return mostrarToast("Sin dueño guardado", "error");
  var diasTexto = calcularDiasFuera(ownerInfo.fecha_salida) === 0 ? 'Hoy mismo' : calcularDiasFuera(ownerInfo.fecha_salida) + ' día(s)';
  var hayVisitante = spot.estado === 'ocupado' && spot._isTempUser;
  var adv = hayVisitante ? '\n\n⚠️ HAY UN VISITANTE EN EL PUESTO.\nSerá desplazado automáticamente.' : '';
  if (!confirm('¿RESTAURAR a ' + ownerInfo.nombre + '?\n\nPlaca: ' + (ownerInfo.placa || '---') + '\nFuera: ' + diasTexto + adv)) return;
  function doRestore() {
    fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: spot.id, accion: "restaurar_dueno" }) })
      .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { cerrarFormulario(); mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error, "error"); }).catch(function() { mostrarToast("Error", "error"); });
  }
  if (hayVisitante) { fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: spot.id, accion: "salir_visitante" }) }).then(function() { doRestore(); }); }
  else { doRestore(); }
};

window.formOcuparReserva = function() { var id = formularioSpot.id; cerrarFormulario(); setTimeout(function() { ocuparReserva(id); }, 250); };
window.formCancelarReserva = function() { if (!confirm("¿Cancelar reserva?")) return; fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: formularioSpot.id, accion: "salir_visitante" }) }).then(function() { cerrarFormulario(); cargarPuestos(); mostrarToast("Reserva cancelada"); }).catch(function() { mostrarToast("Error", "error"); }); };

window.formLimpiar = function() {
  if (!formularioSpot) return;
  if (!confirm("¿LIMPIAR el puesto #" + formularioSpot.numero + "?\n\nSe eliminarán TODOS los datos del cliente/visitante.\nEl puesto quedará LIBRE sin registrar salida ni cobro.")) return;
  fetch('/api/puestos?id=' + formularioSpot.id, { method: "PATCH" })
    .then(function() { cerrarFormulario(); cargarPuestos(); mostrarToast("Puesto limpiado correctamente"); })
    .catch(function() { mostrarToast("Error al limpiar", "error"); });
};

/* ═══════════════════════════════════════════════════════════
   MODAL COBRO — 3 opciones claras
   ═══════════════════════════════════════════════════════════ */
window.abrirModalCobro = function(id, type) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;
  var monto = 0, nombre = "Visitante", placa = "---", tel = "", tipoVehiculo = 'Carro';
  document.getElementById('cobroDiarioInfo').classList.add('hidden');
  document.getElementById('cobroLlaveInfo').classList.add('hidden');

  if (type === 'cliente') {
    monto = spot.cuota_mensual || 0;
    if (!monto) { var cd = clientesCache.find(function(x) { return x.placa === (spot.cliente_placa || '').trim(); }); if (cd) monto = cd.cuota_mensual || 0; }
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

  var llaveCobro = {};
  try { llaveCobro = JSON.parse(spot.llave_caracteristicas || '{}').llave || {}; } catch(e) {}
  if (llaveCobro.tiene) { document.getElementById('cobroLlaveDesc').innerText = llaveCobro.desc || 'Sí'; document.getElementById('cobroLlaveInfo').classList.remove('hidden'); }
  else { document.getElementById('cobroLlaveInfo').classList.add('hidden'); }

  cobroData = { id: id, type: type, nombre: nombre, telefono: tel, placa: placa, hora_inicio: spot.hora_inicio, monto: monto, numero: spot.numero };
  document.getElementById('cobroNombre').innerText = nombre;
  document.getElementById('cobroPlaca').innerText = placa;
  document.getElementById('cobroPuesto').innerText = '#' + spot.numero;
  document.getElementById('cobroTiempo').innerText = calcularTiempo(spot.hora_inicio);
  document.getElementById('cobroMonto').value = monto;

  var btnRenovar = document.getElementById('btnRenovar');
  if (type === 'cliente') {
    var tieneCuota = Number(spot.cuota_mensual) > 0;
    if (!tieneCuota) { var cd2 = clientesCache.find(function(x) { return x.placa === (spot.cliente_placa || '').trim(); }); if (cd2) tieneCuota = Number(cd2.cuota_mensual) > 0; }
    if (tieneCuota) { btnRenovar.classList.remove('hidden'); btnRenovar.style.display = 'flex'; }
    else { btnRenovar.classList.add('hidden'); btnRenovar.style.display = 'none'; }
  } else {
    btnRenovar.classList.add('hidden');
    btnRenovar.style.display = 'none';
  }

  document.getElementById('btnCobroMismoDia').classList.remove('hidden');
  document.getElementById('btnCobroMismoDia').style.display = 'flex';
  document.getElementById('btnSalir').classList.remove('hidden');
  document.getElementById('btnSalir').style.display = 'flex';

  var title = document.getElementById('tituloModalCobro');
  title.innerText = type === 'cliente' ? "Gestión de Cobro" : "Cobro Visitante";

  toggleModal('modalCobroSalida', true);
  setTimeout(function() { document.getElementById('cobroMonto').focus(); }, 100);
};

/* --- OPCIÓN 1: RENOVAR MENSUALIDAD ---
   Solo registra el pago. El vehículo SE QUEDA. */
window.procesarRenovar = function() {
  var a = document.getElementById('cobroMonto').value;
  if (!a || Number(a) <= 0) return mostrarToast("Ingrese un monto válido", "error");
  var p = new URLSearchParams({
    plate: cobroData.placa, spot: cobroData.numero, client: cobroData.nombre,
    phone: cobroData.telefono, entry: cobroData.hora_inicio, amount: a,
    period: 'Mes', renew: 'true'
  });
  window.location.href = 'caja.html?' + p.toString();
};

/* --- OPCIÓN 2: COBRAR ---
   Registra el pago. El vehículo SE QUEDA. */
window.procesarCobroMismoDia = function() {
  var a = document.getElementById('cobroMonto').value;
  if (!a || Number(a) <= 0) return mostrarToast("Ingrese un monto válido", "error");
  var period = cobroData.type === 'cliente' ? 'Pago' : 'Pago Visita';
  var p = new URLSearchParams({
    plate: cobroData.placa, spot: cobroData.numero, client: cobroData.nombre,
    phone: cobroData.telefono, entry: cobroData.hora_inicio, amount: a,
    period: period, renew: 'false'
  });
  window.location.href = 'caja.html?' + p.toString();
};

/* --- OPCIÓN 3: COBRAR Y LIBERAR ---
   NO libera el puesto aquí. Pasa el control a caja.
   Caja mostrará confirmación y liberará DESPUÉS del pago. */
window.procesarSalirYCobro = function() {
  var a = document.getElementById('cobroMonto').value;
  if (!a || Number(a) <= 0) return mostrarToast("Ingrese un monto válido", "error");

  // Guardar datos del puesto para que caja pueda liberar después
  sessionStorage.setItem('liberarPuestoId', String(cobroData.id));
  sessionStorage.setItem('liberarPuestoNum', String(cobroData.numero));
  sessionStorage.setItem('liberarAccion', cobroData.type === 'cliente' ? 'salida_oficial' : 'salir_visitante');

  mostrarToast("Confirme el cobro en caja para liberar", "warning");

  var period = cobroData.type === 'cliente' ? 'Salida' : 'Visita';
  var p = new URLSearchParams({
    plate: cobroData.placa, spot: cobroData.numero, client: cobroData.nombre,
    phone: cobroData.telefono, entry: cobroData.hora_inicio, amount: a,
    period: period, renew: 'false', liberar: 'true'
  });

  setTimeout(function() {
    window.location.href = 'caja.html?' + p.toString();
  }, 600);
};

/* ═══════════════════════════════════════════════════════════
   MODALES SECUNDARIOS
   ═══════════════════════════════════════════════════════════ */

window.abrirModalCrearPuesto = function() {
  document.getElementById('inputCantidadPuestos').value = '';
  document.getElementById('inputNumeroManual').value = '';
  cambiarTabCrear('cantidad');
  toggleModal('modalCrearPuesto', true);
  setTimeout(function() { document.getElementById('inputCantidadPuestos').focus(); }, 100);
};
window.cerrarModalCrearPuesto = function() { toggleModal('modalCrearPuesto', false); };
window.cambiarTabCrear = function(tab) {
  var tC = document.getElementById('tabCrearCantidad'), tM = document.getElementById('tabCrearManual'), dC = document.getElementById('divCrearCantidad'), dM = document.getElementById('divCrearManual');
  if (tab === 'cantidad') { tC.classList.add('bg-slate-800', 'text-white'); tC.classList.remove('text-slate-600', 'dark:text-slate-400'); tM.classList.remove('bg-slate-800', 'text-white'); tM.classList.add('text-slate-600', 'dark:text-slate-400'); dC.classList.remove('hidden'); dM.classList.add('hidden'); }
  else { tM.classList.add('bg-slate-800', 'text-white'); tM.classList.remove('text-slate-600', 'dark:text-slate-400'); tC.classList.remove('bg-slate-800', 'text-white'); tC.classList.add('text-slate-600', 'dark:text-slate-400'); dM.classList.remove('hidden'); dC.classList.add('hidden'); setTimeout(function() { document.getElementById('inputNumeroManual').focus(); }, 50); }
};
window.confirmarCrearPuesto = function() {
  var dC = document.getElementById('divCrearCantidad');
  if (!dC.classList.contains('hidden')) {
    var c = parseInt(document.getElementById('inputCantidadPuestos').value);
    if (!c || c < 1) return mostrarToast("Ingrese una cantidad válida", "error");
    if (c > 500) return mostrarToast("Máximo 500 puestos", "error");
    fetch("/api/puestos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cantidad: c }) }).then(function(r) { return r.json(); }).then(function(data) { if (data.success) { toggleModal('modalCrearPuesto', false); mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error || "Error", "error"); }).catch(function() { mostrarToast("Error", "error"); });
  } else {
    var n = document.getElementById('inputNumeroManual').value.trim();
    if (!n) return mostrarToast("Ingrese un número", "error");
    if (isNaN(n)) return mostrarToast("Ingrese solo números", "error");
    fetch("/api/puestos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero: n }) }).then(function(r) { return r.json(); }).then(function(data) { if (data.success) { toggleModal('modalCrearPuesto', false); mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error || "Error", "error"); }).catch(function() { mostrarToast("Error", "error"); });
  }
};

window.abrirModalAsignar = function(id, num) {
  var select = document.getElementById('modalClienteSelect');
  select.innerHTML = '<option value="">-- Seleccione Cliente --</option>';
  var available = clientesCache.filter(function(c) { return !allSpots.some(function(s) { return (s.cliente_placa || '').trim() === c.placa && s.estado === 'ocupado'; }); });
  if (available.length === 0) { var opt = document.createElement("option"); opt.disabled = true; opt.text = "No hay clientes disponibles"; select.add(opt); }
  else { available.forEach(function(c) { var o = document.createElement("option"); o.value = c.id; o.text = c.nombre + ' (' + c.placa + ')'; select.add(o); }); }
  document.getElementById('modalAsignarTitle').innerText = 'Asignar #' + num;
  document.getElementById('spotIdOculto').value = id;
  resetKeyInput('asignarLlaveCheck', 'asignarLlaveDesc', 'asignarLlaveContainer');
  toggleModal('modalAsignar', true);
};
window.cerrarModal = function() { toggleModal('modalAsignar', false); };
window.confirmarAsignar = function() {
  var cid = document.getElementById('modalClienteSelect').value, sid = document.getElementById('spotIdOculto').value;
  if (!cid) return alert("Seleccione un cliente");
  var llaveInfo = getKeyInfo('asignarLlaveCheck', 'asignarLlaveDesc');
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sid, accion: "asignar_registrado", cliente_id: cid, llave_info: llaveInfo }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { toggleModal('modalAsignar', false); mostrarToast("Asignado"); cargarPuestos(); } else alert("Error: " + (data.error || "Desconocido")); }).catch(function() { alert("Error de conexión"); });
};

window.abrirModalVisitante = function() {
  var sSelect = document.getElementById('visitanteSpotSelect'), cSelect = document.getElementById('visitanteClientSelect');
  if (sSelect) { sSelect.innerHTML = '<option value="">-- Seleccione Puesto --</option>'; allSpots.filter(function(s) { return s.estado === 'libre'; }).forEach(function(s) { var owner = {}; try { owner = JSON.parse(s.puesto_info || '{}'); } catch(e) {} var text = owner.nombre ? 'Puesto #' + s.numero + ' (Dueño: ' + owner.nombre + ')' : 'Puesto #' + s.numero; sSelect.add(new Option(text, s.id)); }); }
  cSelect.innerHTML = '<option value="">-- Opcional: Cliente Registrado --</option>';
  clientesCache.filter(function(c) { return !allSpots.some(function(s) { return (s.cliente_placa || '').trim() === c.placa && s.estado === 'ocupado'; }); }).forEach(function(c) { cSelect.add(new Option(c.nombre + ' (' + c.placa + ')', c.id)); });
  var manualRadio = document.querySelector('input[name="visitanteType"][value="manual"]');
  if (manualRadio) manualRadio.checked = true;
  document.getElementById('visitanteNombre').value = ''; document.getElementById('visitantePlaca').value = '';
  document.getElementById('visitanteNombre').readOnly = false; document.getElementById('visitantePlaca').readOnly = false;
  document.getElementById('visitanteTipoVehiculo').value = 'Carro'; document.getElementById('visitanteTipoVehiculo').disabled = false;
  window.onVisitanteTypeChange();
  resetKeyInput('visitanteLlaveCheck', 'visitanteLlaveDesc', 'visitanteLlaveContainer');
  toggleModal('modalVisitante', true);
};
window.cerrarModalVisitante = function() { toggleModal('modalVisitante', false); };
window.onVisitanteTypeChange = function() {
  var tr = document.querySelector('input[name="visitanteType"]:checked'), dm = document.getElementById('divVisitanteManual'), dc = document.getElementById('divVisitanteCliente');
  if (tr && tr.value === 'registered') { if (dm) dm.classList.add('hidden'); if (dc) dc.classList.remove('hidden'); }
  else { if (dm) dm.classList.remove('hidden'); if (dc) dc.classList.add('hidden'); }
};
window.onVisitanteClientChange = function() {
  var cid = document.getElementById('visitanteClientSelect').value, ni = document.getElementById('visitanteNombre'), pi = document.getElementById('visitantePlaca'), ts = document.getElementById('visitanteTipoVehiculo');
  if (cid) { var c = clientesCache.find(function(x) { return x.id == cid; }); if (c) { ni.value = c.nombre; pi.value = c.placa; ni.readOnly = true; pi.readOnly = true; ts.value = c.tipo_vehiculo || 'Carro'; ts.disabled = true; } }
  else { ni.value = ''; pi.value = ''; ni.readOnly = false; pi.readOnly = false; ts.value = 'Carro'; ts.disabled = false; }
};
window.confirmarVisitante = function() {
  var sid = document.getElementById('visitanteSpotSelect').value, tr = document.querySelector('input[name="visitanteType"]:checked'), nombre = document.getElementById('visitanteNombre').value.trim(), placa = document.getElementById('visitantePlaca').value.trim().toUpperCase(), tipoVeh = document.getElementById('visitanteTipoVehiculo').value, cid = null;
  if (tr && tr.value === 'registered') { cid = document.getElementById('visitanteClientSelect').value; var c = clientesCache.find(function(x) { return x.id == cid; }); if (c) { nombre = c.nombre; placa = c.placa.trim().toUpperCase(); tipoVeh = c.tipo_vehiculo || 'Carro'; } }
  if (!sid || !nombre || !placa) return alert("Complete los datos");
  var llaveInfo = getKeyInfo('visitanteLlaveCheck', 'visitanteLlaveDesc');
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sid, accion: "asignar_visitante", temp_name: nombre, temp_plate: placa, tipo_vehiculo: tipoVeh, cliente_id: cid, llave_info: llaveInfo }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { toggleModal('modalVisitante', false); mostrarToast("Visitante registrado"); cargarPuestos(); } else alert("Error: " + (data.error || "Desconocido")); }).catch(function() { alert("Error de conexión"); });
};

window.abrirModalReservar = function(id, num) {
  document.getElementById('reservaId').value = id;
  document.getElementById('reservaTitle').innerText = 'Reservar Puesto #' + num;
  document.getElementById('reservaNombre').value = '';
  document.getElementById('reservaPlaca').value = '';
  toggleModal('modalReservar', true);
};
window.cerrarModalReservar = function() { toggleModal('modalReservar', false); };
window.confirmarReservar = function() {
  var id = document.getElementById('reservaId').value, nombre = document.getElementById('reservaNombre').value.trim(), placa = document.getElementById('reservaPlaca').value.trim().toUpperCase();
  if (!nombre) return alert("Nombre requerido");
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "reservar", nombre: nombre, placa: placa }) })
    .then(function() { toggleModal('modalReservar', false); cargarPuestos(); mostrarToast("Reserva creada"); }).catch(function() { mostrarToast("Error", "error"); });
};

window.ocuparReserva = function(id) {
  var spot = allSpots.find(function(s) { return s.id === id; });
  if (!spot) return;
  var meta = {}; try { meta = JSON.parse(spot.llave_caracteristicas || '{}'); } catch(e) {}
  var rN = (meta.reservation && meta.reservation.nombre) ? meta.reservation.nombre : '', rP = (meta.reservation && meta.reservation.placa) ? meta.reservation.placa.trim().toUpperCase() : '';
  document.getElementById('ocuparReservaInfo').innerHTML = '<div class="text-sm text-purple-700">Reserva: <strong>' + rN + '</strong>' + (rP ? ' — <span class="font-mono font-bold">' + rP + '</span>' : '') + '</div>';
  var select = document.getElementById('ocuparReservaClienteSelect');
  select.innerHTML = '<option value="">-- Sin cliente registrado --</option>';
  var available = clientesCache.filter(function(c) { return !allSpots.some(function(s) { return (s.cliente_placa || '').trim() === c.placa && s.estado === 'ocupado'; }); });
  var defOpt = '';
  available.forEach(function(c) { select.add(new Option(c.nombre + ' (' + c.placa + ')', c.id)); if (rP && c.placa.toUpperCase() === rP.toUpperCase()) defOpt = c.id; });
  if (defOpt) select.value = defOpt;
  document.getElementById('ocuparReservaId').value = id;
  resetKeyInput('reservaLlaveCheck', 'reservaLlaveDesc', 'reservaLlaveContainer');
  toggleModal('modalOcuparReserva', true);
};
window.confirmarOcuparReserva = function() {
  var id = document.getElementById('ocuparReservaId').value, clientId = document.getElementById('ocuparReservaClienteSelect').value;
  var llaveInfo = getKeyInfo('reservaLlaveCheck', 'reservaLlaveDesc');
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "ocupar_reserva", cliente_id: clientId || null, llave_info: llaveInfo }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { toggleModal('modalOcuparReserva', false); mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error || "Error", "error"); }).catch(function() { mostrarToast("Error", "error"); });
};
window.cerrarModalOcuparReserva = function() { toggleModal('modalOcuparReserva', false); };

/* ═══════════════════════════════════════════════════════════
   ACCIONES RÁPIDAS
   ═══════════════════════════════════════════════════════════ */
window.liberar = function(id) { if (!confirm("¿Cancelar reserva?")) return; fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salir_visitante" }) }).then(function() { cargarPuestos(); mostrarToast("Reserva cancelada"); }).catch(function() { mostrarToast("Error", "error"); }); };
window.salirVisitante = function(id) { if (!confirm("¿Dar salida al visitante sin cobro?")) return; fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salir_visitante" }) }).then(function() { cargarPuestos(); mostrarToast("Visitante salió"); }).catch(function() { mostrarToast("Error", "error"); }); };
window.salirViaje = function(id) {
  var s = allSpots.find(function(x) { return x.id === id; });
  if (!s) return;
  if (!confirm('¿SALIDA DE VIAJE?\n\n' + (s.cliente_nombre || 'Sin nombre') + '\n\nEl puesto quedará guardado.')) return;
  fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salida_viaje" }) })
    .then(function(r) { return r.json(); }).then(function(data) { if (data.success) { mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error, "error"); }).catch(function() { mostrarToast("Error", "error"); });
};
window.restaurarDueno = function(id) {
  var spot = allSpots.find(function(x) { return x.id === id; });
  if (!spot) return mostrarToast("No encontrado", "error");
  var oi = {}; try { oi = JSON.parse(spot.puesto_info || '{}'); } catch(e) {}
  if (!oi.nombre) return mostrarToast("Sin dueño guardado", "error");
  var df = calcularDiasFuera(oi.fecha_salida), hv = spot.estado === 'ocupado' && !spot.cliente_id, adv = hv ? '\n\n⚠️ HAY VISITANTE. Será desplazado.' : '';
  if (!confirm('¿RESTAURAR a ' + oi.nombre + '?\nFuera: ' + (df === 0 ? 'Hoy' : df + ' día(s)') + adv)) return;
  function dr() { fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "restaurar_dueno" }) }).then(function(r) { return r.json(); }).then(function(data) { if (data.success) { mostrarToast(data.message); cargarPuestos(); } else mostrarToast(data.error, "error"); }).catch(function() { mostrarToast("Error", "error"); }); }
  if (hv) { fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "salir_visitante" }) }).then(function() { dr(); }); }
  else { dr(); }
};
window.limpiarPuesto = function(id) { if (!confirm("¿LIMPIAR TODO?")) return; fetch('/api/puestos?id=' + id, { method: "PATCH" }).then(function() { cargarPuestos(); mostrarToast("Puesto limpiado"); }).catch(function() { mostrarToast("Error", "error"); }); };
window.eliminarPuesto = function(id) { if (!confirm("¿ELIMINAR ESTE PUESTO?\nEsta acción no se puede deshacer.")) return; fetch('/api/puestos?id=' + id, { method: "DELETE" }).then(function(r) { return r.json(); }).then(function(data) { mostrarToast("Eliminado"); cargarPuestos(); }).catch(function() { mostrarToast("Error", "error"); }); };
window.editarNumeroPuesto = function(id, num) { var n = prompt("Nuevo número:", num); if (!n || n === num) return; fetch("/api/puestos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, accion: "editar_numero", nuevo_numero: n }) }).then(function(r) { return r.json(); }).then(function(data) { if (data.success) { mostrarToast("Actualizado"); cargarPuestos(); } else mostrarToast(data.error, "error"); }).catch(function() { mostrarToast("Error", "error"); }); };

window.toggleMenu = function() {
  var sidebar = document.getElementById('sidebar'), overlay = document.getElementById('mobileMenuOverlay');
  if (sidebar.classList.contains('-translate-x-full')) { sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); }
  else { sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden'); }
};