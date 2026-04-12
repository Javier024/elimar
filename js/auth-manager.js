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

    initInactivityTimer();
    loadUserInfo();
    preventBackButton();
});

function preventBackButton() {
    window.history.pushState(null, '', window.location.href);
    window.onpopstate = function() {
        window.history.pushState(null, '', window.location.href);
        showToast('Para salir, usa el botón Cerrar Sesión', 'info');
    };
}

var inactivityTimeout;

function initInactivityTimer() {
    var MAX_TIME = 15 * 60 * 1000;

    function resetTimer() {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(logout, MAX_TIME);
    }

    window.addEventListener('load', resetTimer);
    document.addEventListener('mousemove', resetTimer);
    document.addEventListener('keypress', resetTimer);
    document.addEventListener('touchstart', resetTimer);
    document.addEventListener('click', resetTimer);
    document.addEventListener('scroll', resetTimer);
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
    var toast = document.createElement('div');
    var iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'info') iconClass = 'fa-circle-info';

    var bgClass = 'bg-emerald-500 text-white';
    if (type === 'error') bgClass = 'bg-red-500 text-white';
    if (type === 'info') bgClass = 'bg-blue-500 text-white';

    toast.className = 'fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-2xl text-sm font-bold transition-all transform -translate-y-10 opacity-0 ' + bgClass;
    toast.innerHTML = '<span class="flex items-center gap-2"><i class="fa-solid ' + iconClass + '"></i> ' + msg + '</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.remove('-translate-y-10', 'opacity-0'); });
    setTimeout(function() { toast.classList.add('-translate-y-10', 'opacity-0'); setTimeout(function() { toast.remove(); }, 300); }, 3000);
}