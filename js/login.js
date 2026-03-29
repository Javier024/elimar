// Verificar si ya hay sesión al cargar el login
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('parkingUser'));
    if (user) {
        // Si ya está logueado, lo mandamos al dashboard
        window.location.replace('dashboard.html');
    }
});

function showTab(tabId) {
    document.querySelectorAll('.auth-content').forEach(el => {
        el.classList.add('hidden-tab');
        el.classList.add('hidden');
    });

    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('hidden-tab');
        target.classList.remove('hidden');
    }

    const btnLogin = document.getElementById('tab-login');
    const btnRecover = document.getElementById('tab-recover');

    if (tabId === 'login-section') {
        btnLogin.classList.add('text-slate-900', 'border-slate-900', 'font-bold');
        btnLogin.classList.remove('text-slate-400', 'border-transparent');
        
        btnRecover.classList.remove('text-slate-900', 'border-slate-900', 'font-bold');
        btnRecover.classList.add('text-slate-400', 'border-transparent');
    } else {
        btnRecover.classList.add('text-slate-900', 'border-slate-900', 'font-bold');
        btnRecover.classList.remove('text-slate-400', 'border-transparent');
        
        btnLogin.classList.remove('text-slate-900', 'border-slate-900', 'font-bold');
        btnLogin.classList.add('text-slate-400', 'border-transparent');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;

    if (!user || !pass) {
        showToast('Ingresa usuario y contraseña', 'error');
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
            sessionStorage.setItem('parkingUser', JSON.stringify(data.user));
            prepararSaludo(data.user);
            showToast('¡Bienvenido!', 'success');
            setTimeout(() => {
                window.location.replace('dashboard.html'); 
            }, 1000);
        } else {
            showToast(data.message || 'Error de acceso', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function prepararSaludo(usuario) {
    const hora = new Date().getHours();
    let saludo = "Buenas noches";
    if (hora >= 5 && hora < 12) saludo = "Buenos días";
    else if (hora >= 12 && hora < 19) saludo = "Buenas tardes";
    sessionStorage.setItem('parkingSaludo', `${saludo}`);
}

async function handleRecoverMethod(method) {
    const user = document.getElementById('recoverUser').value;
    
    if (!user) {
        showToast('Ingresa tu usuario', 'error');
        return;
    }

    showToast('Procesando...', 'success');

    try {
        const res = await fetch('/api/auth?action=recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, method })
        });

        const data = await res.json();

        if (data.success) {
            // LÓGICA DE WHATSAPP ELIMINADA
            
            // LÓGICA DE EMAIL MANTENIDA
            if (method === 'email') {
                showToast('Revisa tu correo electrónico', 'success');
            }
        } else {
            showToast(data.message || 'No se pudo procesar', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error de conexión', 'error');
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