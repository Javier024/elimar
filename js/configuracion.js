// parqueo/js/configuracion.js

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracion();
});

async function cargarConfiguracion() {
    try {
        const res = await fetch('/api/configuracion');
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        
        // Helper para asignar valor si existe
        const val = (id) => document.getElementById(id) ? (document.getElementById(id).value = data[id] || '') : null;

        // Generales
        val('confNombre'); val('confNit'); val('confDireccion'); val('confTelefono');

        // Particular (Antes Carro)
        val('tp_hora'); val('tp_noche'); val('tp_semana'); val('tp_quincena'); val('tp_mes');

        // Moto
        val('tm_hora'); val('tm_noche'); val('tm_semana'); val('tm_quincena'); val('tm_mes');

        // Camioneta
        val('tc_hora'); val('tc_noche'); val('tc_semana'); val('tc_quincena'); val('tc_mes');

        // Admin / Login
        val('adminNombre'); val('adminEmail'); val('adminNotif');
        val('adminUser'); 
        // No cargamos la contraseña en el input por seguridad, pero el usuario puede cambiarla

    } catch (error) {
        console.error(error);
        mostrarToast('Error cargando datos', 'error');
    }
}

async function guardarConfiguracion(e) {
    e.preventDefault();
    const btn = document.querySelector('#formConfig button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    const formData = {
        // Generales
        nombre: document.getElementById('confNombre').value,
        nit: document.getElementById('confNit').value,
        direccion: document.getElementById('confDireccion').value,
        telefono: document.getElementById('confTelefono').value,
        
        // Particular
        tarifa_particular_hora: document.getElementById('tp_hora').value,
        tarifa_particular_noche: document.getElementById('tp_noche').value,
        tarifa_particular_semana: document.getElementById('tp_semana').value,
        tarifa_particular_quincena: document.getElementById('tp_quincena').value,
        tarifa_particular_mes: document.getElementById('tp_mes').value,

        // Moto
        tarifa_moto_hora: document.getElementById('tm_hora').value,
        tarifa_moto_noche: document.getElementById('tm_noche').value,
        tarifa_moto_semana: document.getElementById('tm_semana').value,
        tarifa_moto_quincena: document.getElementById('tm_quincena').value,
        tarifa_moto_mes: document.getElementById('tm_mes').value,

        // Camioneta
        tarifa_camioneta_hora: document.getElementById('tc_hora').value,
        tarifa_camioneta_noche: document.getElementById('tc_noche').value,
        tarifa_camioneta_semana: document.getElementById('tc_semana').value,
        tarifa_camioneta_quincena: document.getElementById('tc_quincena').value,
        tarifa_camioneta_mes: document.getElementById('tc_mes').value,

        // Admin
        admin_nombre: document.getElementById('adminNombre').value,
        admin_email: document.getElementById('adminEmail').value,
        admin_notif: document.getElementById('adminNotif').value,
        admin_user: document.getElementById('adminUser').value,
        admin_pass: document.getElementById('adminPass').value // Se guarda solo si se escribe algo nuevo
    };

    try {
        const res = await fetch('/api/configuracion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();
        if(data.success) mostrarToast('Configuración actualizada correctamente');
        else mostrarToast(data.error, 'error');
    } catch (error) { mostrarToast('Error de conexión', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = originalText; }
}

function mostrarToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 z-50 px-6 py-3 rounded-lg shadow-xl text-sm font-bold transition-all transform translate-y-10 opacity-0 ${type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`;
    toast.innerHTML = `<span class="flex items-center gap-2"><i class="fa-solid ${type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> ${msg}</span>`; 
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
    setTimeout(() => { toast.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm', 'border-t-2', 'border-indigo-600');
        b.classList.add('text-slate-500', 'hover:text-slate-700', 'border-t-2', 'border-transparent');
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    
    const btn = document.getElementById('tab-' + tabName);
    btn.classList.remove('text-slate-500', 'hover:text-slate-700', 'border-t-2', 'border-transparent');
    btn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm', 'border-t-2', 'border-indigo-600');
    
    document.getElementById('content-' + tabName).classList.remove('hidden');
}