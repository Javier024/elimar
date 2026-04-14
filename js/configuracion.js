var activeTextarea = null;

document.addEventListener('DOMContentLoaded', function() {
    // Rastrear qué textarea está activo para insertar variables
    document.querySelectorAll('textarea').forEach(function(ta) {
        ta.addEventListener('focus', function() { activeTextarea = ta.id; });
    });
    cargarConfiguracion();
});

// Función para insertar variables haciendo clic
window.insertVar = function(text) {
    if (!activeTextarea) activeTextarea = 'wa_msg_ingreso'; // Por defecto la primera
    var ta = document.getElementById(activeTextarea);
    if (ta) {
        var start = ta.selectionStart;
        var end = ta.selectionEnd;
        var textBefore = ta.value.substring(0, start);
        var textAfter = ta.value.substring(end);
        ta.value = textBefore + text + textAfter;
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + text.length;
    }
};

async function cargarConfiguracion() {
    try {
        const res = await fetch('/api/configuracion');
        if (!res.ok) throw new Error('Error de servidor: ' + res.status);
        const data = await res.json();
        
        var ids = ['confNombre', 'confNit', 'confDireccion', 'confTelefono', 
                   'tp_hora', 'tp_noche', 'tp_semana', 'tp_quincena', 'tp_mes', 
                   'tm_hora', 'tm_noche', 'tm_semana', 'tm_quincena', 'tm_mes', 
                   'tc_hora', 'tc_noche', 'tc_semana', 'tc_quincena', 'tc_mes', 
                   'adminNombre', 'adminEmail', 'adminNotif', 'adminUser', 'wa_numero'];
        
        ids.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = data[id] || '';
        });

        // Cargar mensajes de WhatsApp desde el JSON
        var waMensajes = {};
        try {
            waMensajes = JSON.parse(data.wa_mensajes || '{}');
        } catch(e) {
            waMensajes = {};
        }

        document.getElementById('wa_msg_ingreso').value = waMensajes.ingreso || '🔔 *{{nombre_parqueadero}}*\n\nVehículo ingresado:\nPlaca: *{{placa}}*\nPuesto: #{{puesto}}\nFecha: {{fecha}}';
        document.getElementById('wa_msg_salida').value = waMensajes.salida || '🚗 *{{nombre_parqueadero}}*\n\nSalida registrada:\nPlaca: *{{placa}}*\nPuesto: #{{puesto}}\nTiempo: {{tiempo}}';
        document.getElementById('wa_msg_cobro').value = waMensajes.cobro || '💰 *Recibo de Pago - {{nombre_parqueadero}}*\n\nCliente: {{cliente}}\nPlaca: *{{placa}}*\nMonto: *${{monto}}*\nFecha: {{fecha}}';

        // NUEVO: Actualizar el nombre del parqueadero en la barra lateral dinámicamente
        if (data.nombre) {
            var brandEl = document.getElementById('sidebar-brand-name');
            if (brandEl) {
                var nameParts = data.nombre.trim().split(/\s+/);
                if (nameParts.length > 1) {
                    var html = nameParts[0] + ' ' + nameParts.slice(1).map(function(w) { 
                        return '<span class="text-indigo-600 dark:text-indigo-400">' + w.toUpperCase() + '</span>'; 
                    }).join(' ');
                    brandEl.innerHTML = html;
                } else {
                    brandEl.innerHTML = '<span class="text-indigo-600 dark:text-indigo-400">' + nameParts[0].toUpperCase() + '</span>';
                }
            }
            // Actualizar el título de la pestaña del navegador
            document.title = 'Configuración | ' + data.nombre;
        }

    } catch (error) {
        console.error(error);
        mostrarToast('Error cargando datos de configuración', 'error');
    }
}

async function guardarConfiguracion(e) {
    e.preventDefault();
    const btn = document.querySelector('#formConfig button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    const formData = {
        nombre: document.getElementById('confNombre').value,
        nit: document.getElementById('confNit').value,
        direccion: document.getElementById('confDireccion').value,
        telefono: document.getElementById('confTelefono').value,
        tarifa_particular_hora: document.getElementById('tp_hora').value,
        tarifa_particular_noche: document.getElementById('tp_noche').value,
        tarifa_particular_semana: document.getElementById('tp_semana').value,
        tarifa_particular_quincena: document.getElementById('tp_quincena').value,
        tarifa_particular_mes: document.getElementById('tp_mes').value,
        tarifa_moto_hora: document.getElementById('tm_hora').value,
        tarifa_moto_noche: document.getElementById('tm_noche').value,
        tarifa_moto_semana: document.getElementById('tm_semana').value,
        tarifa_moto_quincena: document.getElementById('tm_quincena').value,
        tarifa_moto_mes: document.getElementById('tm_mes').value,
        tarifa_camioneta_hora: document.getElementById('tc_hora').value,
        tarifa_camioneta_noche: document.getElementById('tc_noche').value,
        tarifa_camioneta_semana: document.getElementById('tc_semana').value,
        tarifa_camioneta_quincena: document.getElementById('tc_quincena').value,
        tarifa_camioneta_mes: document.getElementById('tc_mes').value,
        admin_nombre: document.getElementById('adminNombre').value,
        admin_email: document.getElementById('adminEmail').value,
        admin_notif: document.getElementById('adminNotif').value,
        admin_user: document.getElementById('adminUser').value,
        admin_pass: document.getElementById('adminPass').value,
        wa_numero: document.getElementById('wa_numero').value,
        // NUEVO: Empaquetar los mensajes de WhatsApp en un string JSON
        wa_mensajes: JSON.stringify({
            ingreso: document.getElementById('wa_msg_ingreso').value,
            salida: document.getElementById('wa_msg_salida').value,
            cobro: document.getElementById('wa_msg_cobro').value
        })
    };

    try {
        const res = await fetch('/api/configuracion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        if(data.success) {
            mostrarToast('Configuración actualizada correctamente');
            // Refrescar la UI del nombre sin recargar toda la página
            if (formData.nombre) {
                var brandEl = document.getElementById('sidebar-brand-name');
                if (brandEl) {
                    var nameParts = formData.nombre.trim().split(/\s+/);
                    if (nameParts.length > 1) {
                        var html = nameParts[0] + ' ' + nameParts.slice(1).map(function(w) { 
                            return '<span class="text-indigo-600 dark:text-indigo-400">' + w.toUpperCase() + '</span>'; 
                        }).join(' ');
                        brandEl.innerHTML = html;
                    } else {
                        brandEl.innerHTML = '<span class="text-indigo-600 dark:text-indigo-400">' + nameParts[0].toUpperCase() + '</span>';
                    }
                }
                document.title = 'Configuración | ' + formData.nombre;
            }
        }
        else mostrarToast(data.error, 'error');
    } catch (error) { 
        mostrarToast('Error de conexión', 'error'); 
    } finally { 
        btn.disabled = false; 
        btn.innerHTML = originalText; 
    }
}

async function descargarBackup() {
    if (!confirm("¿Generar y descargar la copia de seguridad completa del sistema?")) return;

    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

    try {
        const res = await fetch('/api/configuracion?action=backup');
        if (!res.ok) throw new Error("Error en la petición");
        
        const data = await res.json();
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
        a.download = 'BACKUP_Elimar_' + fecha + '_' + hora + '.json';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        mostrarToast('Backup descargado (' + data.resumen.total_historial + ' registros en historial)');
    } catch (error) {
        console.error(error);
        mostrarToast('Error al generar el backup', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function formatearSistema() {
    if (!confirm("⚠️ ¿Estás SEGURO de que quieres FORMATEAR TODO el sistema?")) return;
    if (!confirm("📉 Esta acción ELIMINARÁ:\n- Todos los clientes\n- Todo el historial\n- Todos los gastos\n- Las tarifas y configuración\n\nEsta acción NO se puede deshacer. ¿Continuar?")) return;

    const pass = prompt("🔒 Escribe tu contraseña de administrador para confirmar:");
    if (!pass) return;

    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Formateando...';

    try {
        const res = await fetch('/api/configuracion?action=format', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm_pass: pass })
        });

        const data = await res.json();

        if (res.status === 401) {
            mostrarToast("Contraseña incorrecta. Acción cancelada.", "error");
        } else if (data.success) {
            mostrarToast("Sistema formateado. Cerrando sesión...", "success");
            setTimeout(function() {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
            }, 2000);
        } else {
            mostrarToast(data.error || "Error desconocido", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Error de conexión', 'error');
    } finally {
        if (!data || !data.success) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

function mostrarToast(msg, type) {
    type = type || 'success';
    var toast = document.createElement('div');
    if (type === 'error') {
        toast.className = 'fixed bottom-5 right-5 z-50 px-6 py-3 rounded-lg shadow-xl text-sm font-bold transition-all transform translate-y-10 opacity-0 bg-red-600 text-white';
    } else {
        toast.className = 'fixed bottom-5 right-5 z-50 px-6 py-3 rounded-lg shadow-xl text-sm font-bold transition-all transform translate-y-10 opacity-0 bg-slate-800 dark:bg-slate-700 dark:text-white text-white';
    }
    toast.innerHTML = '<span class="flex items-center gap-2"><i class="fa-solid ' + (type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check') + '"></i> ' + msg + '</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(function() {
        toast.classList.remove('translate-y-10', 'opacity-0');
    });
    setTimeout(function() {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.remove('border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400');
        btn.classList.add('border-transparent', 'text-slate-500', 'dark:text-slate-400');
    });
    
    var activeBtn = document.getElementById('tab-' + tabName);
    if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-slate-500', 'dark:text-slate-400');
        activeBtn.classList.add('border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400');
    }

    document.querySelectorAll('.tab-content').forEach(function(content) {
        content.classList.add('hidden');
    });
    
    var activeContent = document.getElementById('content-' + tabName);
    if (activeContent) activeContent.classList.remove('hidden');

    var wrapper = document.getElementById('btnGuardarWrapper');
    if (wrapper) {
        wrapper.style.display = (tabName === 'sistema') ? 'none' : 'flex';
    }
}