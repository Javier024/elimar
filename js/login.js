// parqueo/js/login.js

// Función para cambiar entre Login y Recuperar
function showTab(tabId) {
    // 1. Ocultar todos los contenidos
    document.querySelectorAll('.auth-content').forEach(el => {
        el.classList.add('hidden-tab'); // Usamos la clase específica de tu HTML
        el.classList.add('hidden');     // Y la clase hidden de Tailwind por seguridad
    });

    // 2. Mostrar el contenido deseado
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('hidden-tab');
        target.classList.remove('hidden');
    }

    // 3. Actualizar estilo de los botones (pestañas)
    const btnLogin = document.getElementById('tab-login');
    const btnRecover = document.getElementById('tab-recover');

    if (tabId === 'login-section') {
        // Estilo Activo para Login
        btnLogin.classList.remove('text-slate-400', 'border-transparent');
        btnLogin.classList.add('text-slate-900', 'border-slate-900', 'font-bold');
        
        // Estilo Inactivo para Recuperar
        btnRecover.classList.add('text-slate-400', 'border-transparent');
        btnRecover.classList.remove('text-slate-900', 'border-slate-900', 'font-bold');
    } else {
        // Estilo Activo para Recuperar
        btnRecover.classList.remove('text-slate-400', 'border-transparent');
        btnRecover.classList.add('text-slate-900', 'border-slate-900', 'font-bold');

        // Estilo Inactivo para Login
        btnLogin.classList.add('text-slate-400', 'border-transparent');
        btnLogin.classList.remove('text-slate-900', 'border-slate-900', 'font-bold');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;

    if (!user || !pass) {
        showToast('Por favor ingresa usuario y contraseña', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...';

    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass })
        });

        const data = await res.json();

        if (data.success) {
            // Login Correcto
            sessionStorage.setItem('parkingUser', JSON.stringify(data.user));
            showToast('¡Bienvenido al sistema!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html'; 
            }, 1000);
        } else {
            // Login Incorrecto
            showToast(data.message || 'Usuario o contraseña incorrectos', 'error');
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        showToast('Error de conexión con el servidor', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleRecover(e) {
    e.preventDefault();
    e.preventDefault(); // Doble prevent por seguridad

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const user = document.getElementById('recoverUser').value;

    if (!user || user.trim() === "") {
        showToast('Debes ingresar un usuario para recuperar', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    try {
        console.log("Intentando recuperar para usuario:", user);

        const res = await fetch('/api/auth?action=recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: user.trim() })
        });

        const data = await res.json();

        if (data.success) {
            if(data.whatsappUrl) {
                showToast('Abriendo WhatsApp...', 'success');
                setTimeout(() => window.open(data.whatsappUrl, '_blank'), 1000);
            } else {
                showToast(data.hint || 'No se pudo generar enlace', 'error');
            }
        } else {
            showToast(data.message || 'Error al procesar la solicitud', 'error');
        }
    } catch (error) {
        console.error("Error en recover:", error);
        showToast('Error de conexión con el servidor', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-2xl text-sm font-bold transition-all transform -translate-y-10 opacity-0 ${type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`;
    toast.innerHTML = `<span class="flex items-center gap-2"><i class="fa-solid ${type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> ${msg}</span>`; 
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('-translate-y-10', 'opacity-0'));
    setTimeout(() => { toast.classList.add('-translate-y-10', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}