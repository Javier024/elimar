// parqueo/js/auth-manager.js

document.addEventListener('DOMContentLoaded', function() {
    var raw = sessionStorage.getItem('parkingUser');
    var rawToken = sessionStorage.getItem('parkingToken');
    var user = null;

    try {
        user = JSON.parse(raw);
        if (!user || typeof user !== 'object' || !user.rol) {
            user = null;
        }
    } catch (e) {
        user = null;
    }

    if (!user || !rawToken) {
        sessionStorage.clear();
        window.location.replace('/index.html');
        return;
    }

    loadUserInfo();
    preventBackButton();
    
    // Timer de inactividad - 2 HORAS (menos que el JWT de 8h)
    // Esto es solo por seguridad si dejan la PC desatendida
    initInactivityTimer(2 * 60 * 60 * 1000);
});

var inactivityTimeout;
var WARNING_SHOWN = false;

function initInactivityTimer(maxTime) {
    maxTime = maxTime || (2 * 60 * 60 * 1000);
    
    function resetTimer() {
        clearTimeout(inactivityTimeout);
        WARNING_SHOWN = false;
        inactivityTimeout = setTimeout(function() {
            logoutWithWarning();
        }, maxTime);
    }

    // Solo resetear con eventos reales del usuario
    var events = ['mousemove', 'keypress', 'touchstart', 'click'];
    events.forEach(function(evt) {
        document.addEventListener(evt, resetTimer, { passive: true });
    });
    
    // NO agregar 'scroll' - causaba reinicios constantes
    resetTimer();
}

function logoutWithWarning() {
    if (WARNING_SHOWN) {
        // Segunda vez: cerrar sesión
        logout();
        return;
    }
    WARNING_SHOWN = true;
    showToast('Sesión inactiva. Se cerrará en 1 minuto.', 'info');
    
    // Dar 1 minuto antes de cerrar
    setTimeout(function() {
        logout();
    }, 60 * 1000);
}

function preventBackButton() {
    window.history.pushState(null, '', window.location.href);
    window.onpopstate = function() {
        window.history.pushState(null, '', window.location.href);
        showToast('Usa el botón "Cerrar Sesión" para salir', 'info');
    };
}

function logout() {
    sessionStorage.clear();
    window.location.replace('/index.html');
}
window.logout = logout;

function loadUserInfo() {
    var raw = sessionStorage.getItem('parkingUser');
    var user = null;
    try { user = JSON.parse(raw); } catch(e) { return; }
    
    if (!user) return;

    var el = document.getElementById('sidebar-user-name');
    if (el) {
        var saludo = sessionStorage.getItem('parkingSaludo');
        if (!saludo) {
            var hora = new Date().getHours();
            saludo = 'Buenas noches';
            if (hora >= 5 && hora < 12) saludo = 'Buenos días';
            else if (hora >= 12 && hora < 19) saludo = 'Buenas tardes';
        }
        var nombre = user.nombre ? user.nombre.split(' ')[0] : (user.usuario || '');
        el.innerHTML = '<span class="text-indigo-600 font-bold">' + saludo + ',</span> ' + nombre;
    }
}

function showToast(msg, type) {
    // Remover toasts anteriores del mismo tipo
    document.querySelectorAll('.auth-toast').forEach(function(t) { t.remove(); });
    
    var toast = document.createElement('div');
    toast.className = 'auth-toast fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-2xl text-sm font-bold transition-all transform -translate-y-10 opacity-0 max-w-sm';
    
    var iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'info') iconClass = 'fa-circle-info';

    var bgClass = 'bg-emerald-500 text-white';
    if (type === 'error') bgClass = 'bg-red-500 text-white';
    if (type === 'info') bgClass = 'bg-blue-500 text-white';

    toast.classList.add(bgClass);
    toast.innerHTML = '<span class="flex items-center gap-2"><i class="fa-solid ' + iconClass + '"></i> ' + msg + '</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.remove('-translate-y-10', 'opacity-0'); });
    setTimeout(function() { 
        toast.classList.add('-translate-y-10', 'opacity-0'); 
        setTimeout(function() { toast.remove(); }, 300); 
    }, 4000);
}