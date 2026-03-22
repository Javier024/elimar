function showTab(tabId) {
    document.querySelectorAll('.auth-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
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
            showToast('¡Bienvenido al sistema!', 'success');
            setTimeout(() => {
                // RUTA CORREGIDA DIRECTA A LA RAÍZ
                window.location.href = 'dashboard.html';
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

async function handleRecover(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    const user = document.getElementById('recoverUser').value;

    if (!user) {
        showToast('Ingresa tu usuario', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    try {
        const res = await fetch('/api/auth?action=recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user })
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
            showToast(data.message || 'Error al procesar', 'error');
        }
    } catch (error) {
        showToast('Error de conexión', 'error');
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