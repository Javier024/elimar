// =============================================
// 1. VERIFICAR SESIÓN (ejecución inmediata)
// =============================================
(function () {
    var raw = sessionStorage.getItem('parkingUser');
    var token = sessionStorage.getItem('parkingToken');
    var user = null;

       try {
        user = JSON.parse(raw);
        if (!user || typeof user !== 'object' || !user.rol) {
            user = null;
        }
    } catch (e) {
        user = null;
    }

    // Si hay sesión válida, redirigir
    if (user && token) {
        window.location.replace('dashboard.html');
        return;
    }

    // Si no hay sesión, limpiar basura y mostrar login
    sessionStorage.removeItem('parkingUser');
    sessionStorage.removeItem('parkingToken');
    sessionStorage.removeItem('parkingSaludo');
})();


// =============================================
// 2. TABS (sin animaciones, sin pseudo-elementos)
// =============================================
function cambiarTab(cual) {
    var secLogin = document.getElementById('seccion-login');
    var secRecover = document.getElementById('seccion-recover');
    var btnLogin = document.getElementById('tab-login');
    var btnRecover = document.getElementById('tab-recover');

    // Ocultar ambas secciones
    secLogin.className = 'tab-content';
    secRecover.className = 'tab-content';

    if (cual === 'login') {
        secLogin.className = 'tab-content active';
        btnLogin.className = 'pb-3 text-sm font-bold text-slate-900 border-b-2 border-slate-900';
        btnRecover.className = 'pb-3 text-sm font-semibold text-slate-400 border-b-2 border-transparent';
    } else {
        secRecover.className = 'tab-content active';
        btnRecover.className = 'pb-3 text-sm font-bold text-slate-900 border-b-2 border-slate-900';
        btnLogin.className = 'pb-3 text-sm font-semibold text-slate-400 border-b-2 border-transparent';
    }
}


// =============================================
// 3. LOGIN
// =============================================
document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('formLogin');
    if (form) {
        form.addEventListener('submit', hacerLogin);
    }
});

async function hacerLogin(e) {
    e.preventDefault();

    var btn = document.getElementById('btnLogin');
    var textoOriginal = btn.innerHTML;
    var usuario = document.getElementById('campoUser').value.trim();
    var clave = document.getElementById('campoPass').value;

    if (!usuario || !clave) {
        toast('Ingresa usuario y contraseña', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...';

    try {
        var res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: usuario, pass: clave })
        });

        if (!res.ok) throw new Error('Error ' + res.status);

        var data = await res.json();

        if (data.success) {
            sessionStorage.setItem('parkingUser', JSON.stringify(data.user));
            sessionStorage.setItem('parkingToken', data.token);

            var h = new Date().getHours();
            var saludo = h >= 5 && h < 12 ? 'Buenos días' : h >= 12 && h < 19 ? 'Buenas tardes' : 'Buenas noches';
            sessionStorage.setItem('parkingSaludo', saludo);

            toast('¡Bienvenido!', 'ok');
            setTimeout(function () {
                window.location.replace('dashboard.html');
            }, 800);
        } else {
            toast(data.message || 'Credenciales incorrectas', 'error');
        }
    } catch (err) {
        console.error(err);
        toast('Error de conexión con el servidor', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
}


// =============================================
// 4. RECUPERAR
// =============================================
async function recuperarClave() {
    var usuario = document.getElementById('campoRecoverUser').value.trim();
    var btn = document.getElementById('btnRecover');

    if (!usuario) {
        toast('Ingresa tu usuario', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';

    try {
        var res = await fetch('/api/auth?action=recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: usuario, method: 'email' })
        });

        if (!res.ok) throw new Error('Error ' + res.status);

        var data = await res.json();
        toast(data.success ? 'Revisa tu correo electrónico' : (data.message || 'No se pudo procesar'), data.success ? 'ok' : 'error');
    } catch (err) {
        console.error(err);
        toast('Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-envelope"></i><span>Enviar Contraseña por Correo</span>';
    }
}


// =============================================
// 5. TOAST
// =============================================
function toast(msg, tipo) {
    // Eliminar anteriores
    var viejos = document.querySelectorAll('.toast-msg');
    for (var i = 0; i < viejos.length; i++) viejos[i].remove();

    var el = document.createElement('div');
    el.className = 'toast-msg';
    el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;padding:12px 24px;border-radius:8px;color:#fff;font-size:14px;font-weight:600;font-family:Inter,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.3);transform:translateY(-20px);opacity:0;transition:all 0.3s ease;background:' + (tipo === 'error' ? '#ef4444' : '#10b981');
    el.textContent = msg;
    document.body.appendChild(el);

    setTimeout(function () {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
    }, 10);

    setTimeout(function () {
        el.style.transform = 'translateY(-20px)';
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 300);
    }, 3000);
}