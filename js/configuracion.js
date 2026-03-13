document.addEventListener('DOMContentLoaded', function() {
    
    // CLAVE PARA ALMACENAMIENTO
    const STORAGE_KEY = 'parking_sys_config';

    // ==========================================
    // 1. GESTIÓN DE DATOS (CARGAR Y GUARDAR)
    // ==========================================

    // Configuración por defecto
    const defaultConfig = {
        nombre: 'PARKING SYS',
        nit: '900.123.456-7',
        direccion: 'Calle 123 # 45-67, Bogotá',
        telefono: '+57 300 123 4567',
        // moneda: '$', // Eliminado por solicitud
        tarifaCarro: 5000,
        tarifaMoto: 2500,
        tarifaBici: 1000,
        perfNombre: 'Administrador Principal',
        perfEmail: 'admin@parkingsys.com',
        perfNotif: false
    };

    // Cargar configuración al inicio
    function loadConfig() {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const config = saved || defaultConfig;

        // General
        document.getElementById('confNombre').value = config.nombre;
        document.getElementById('confNit').value = config.nit;
        document.getElementById('confDireccion').value = config.direccion;
        document.getElementById('confTelefono').value = config.telefono;

        // Tarifas
        document.getElementById('tarifaCarro').value = config.tarifaCarro;
        document.getElementById('tarifaMoto').value = config.tarifaMoto;
        document.getElementById('tarifaBici').value = config.tarifaBici;

        // Perfil
        document.getElementById('perfNombre').value = config.perfNombre;
        document.getElementById('perfEmail').value = config.perfEmail;
        document.getElementById('perfNotif').checked = config.perfNotif;
    }

    // ==========================================
    // 2. FUNCIONES DE INTERFAZ (TABS Y UI)
    // ==========================================

    window.switchTab = function(tabName) {
        // Ocultar contenidos
        ['general', 'tarifas', 'perfil'].forEach(t => {
            const el = document.getElementById('content-' + t);
            const btn = document.getElementById('tab-' + t);
            
            if (el) el.classList.add('hidden-tab');
            if (el) el.classList.remove('visible-tab');
            if (btn) btn.classList.remove('active');
        });

        // Mostrar seleccionado
        const activeContent = document.getElementById('content-' + tabName);
        const activeBtn = document.getElementById('tab-' + tabName);

        if (activeContent) {
            activeContent.classList.remove('hidden-tab');
            activeContent.classList.add('visible-tab');
        }
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    };

    window.guardarTodo = function() {
        // Recopilar datos del formulario
        const newConfig = {
            nombre: document.getElementById('confNombre').value,
            nit: document.getElementById('confNit').value,
            direccion: document.getElementById('confDireccion').value,
            telefono: document.getElementById('confTelefono').value,
            tarifaCarro: document.getElementById('tarifaCarro').value,
            tarifaMoto: document.getElementById('tarifaMoto').value,
            tarifaBici: document.getElementById('tarifaBici').value,
            perfNombre: document.getElementById('perfNombre').value,
            perfEmail: document.getElementById('perfEmail').value,
            perfNotif: document.getElementById('perfNotif').checked
        };

        // Guardar en LocalStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));

        // Feedback Visual
        showToast("Configuración guardada correctamente", "success");
        
        const btn = document.querySelector('button[onclick="guardarTodo()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Guardado`;
        btn.classList.replace('bg-blue-600', 'bg-emerald-600');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.replace('bg-emerald-600', 'bg-blue-600');
        }, 2000);
    };

    window.showToast = function(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const bgClass = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
        const icon = type === 'success' ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';

        toast.className = `${bgClass} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 transform transition-all duration-500 translate-x-10 opacity-0`;
        toast.innerHTML = `${icon} <span class="font-medium text-sm tracking-wide">${message}</span>`;

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.remove('translate-x-10', 'opacity-0'));
        setTimeout(() => {
            toast.classList.add('translate-x-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    // ==========================================
    // 3. INICIALIZACIÓN
    // ==========================================

    // Cargar datos guardados
    loadConfig();

    // Fecha (Agregado para consistencia)
    const fechaElement = document.getElementById('fecha-actual');
    if (fechaElement) {
        fechaElement.textContent = new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }
});