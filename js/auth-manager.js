// parqueo/js/auth-manager.js

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('parkingUser'));

    // 1. VERIFICACIÓN DE SESIÓN (Auth Guard)
    // Si estamos en una página protegida y NO hay usuario, salimos al login.
    if (!user) {
        // Usamos replace para que esta página no quede en el historial
        window.location.replace('../index.html');
        return; // Detenemos la ejecución del resto del script
    }

    // 2. SI HAY USUARIO, INICIALIZAMOS PROTECCIONES
    initInactivityTimer();
    loadUserInfo();
    preventBackButton(); // <--- ACTIVAMOS EL BLOQUEO DEL BOTÓN ATRÁS
});

// 3. FUNCIÓN DE BLOQUEO DE BOTÓN ATRÁS
function preventBackButton() {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function () {
        window.history.pushState(null, "", window.location.href);
        showToast("Para salir, usa el botón 'Cerrar Sesión'", "info");
    };
}

// 4. TEMPORIZADOR DE INACTIVIDAD
let inactivityTimeout;

function initInactivityTimer() {
    const MAX_INACTIVE_TIME = 15 * 60 * 1000; 
    
    const resetTimer = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(logout, MAX_INACTIVE_TIME);
    };

    window.onload = resetTimer;
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    document.ontouchstart = resetTimer;
    document.onclick = resetTimer;
    document.onscroll = resetTimer;
}

// 5. FUNCIÓN DE CIERRE DE SESIÓN
function logout() {
    sessionStorage.removeItem('parkingUser');
    sessionStorage.removeItem('parkingToken'); // <-- NUEVO: Limpiar token de seguridad
    window.location.replace('../index.html');
}
window.logout = logout;

// 6. CARGAR INFO DE USUARIO (Y SALUDO)
function loadUserInfo() {
    const user = JSON.parse(sessionStorage.getItem('parkingUser'));
    if(user) {
        const userDisplay = document.getElementById('sidebar-user-name');
        if(userDisplay) {
            // Intentamos usar el saludo pre-calculado o calculamos uno nuevo
            const saludoGuardado = sessionStorage.getItem('parkingSaludo');
            
            if(saludoGuardado) {
                userDisplay.innerHTML = `<span class="text-indigo-600 font-bold">${saludoGuardado},</span> ${user.nombre.split(' ')[0]}`;
            } else {
                // Fallback por si entraste directo sin pasar por login.js (ej: refrescar)
                const hora = new Date().getHours();
                let saludo = "Buenas noches";
                if (hora >= 5 && hora < 12) saludo = "Buenos días";
                else if (hora >= 12 && hora < 19) saludo = "Buenas tardes";
                
                userDisplay.innerHTML = `<span class="text-indigo-600 font-bold">${saludo},</span> ${user.nombre.split(' ')[0]}`;
            }
        }
    }
}

// 7. Función Toast (Auxiliar)
function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    if (type === 'info') iconClass = 'fa-info-circle';

    toast.className = `fixed top-5 right-5 z-50 px-6 py-3 rounded-lg shadow-2xl text-sm font-bold transition-all transform -translate-y-10 opacity-0 ${type === 'error' ? 'bg-red-500 text-white' : (type === 'info' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white')}`;
    toast.innerHTML = `<span class="flex items-center gap-2"><i class="fa-solid ${iconClass}"></i> ${msg}</span>`; 
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('-translate-y-10', 'opacity-0'));
    setTimeout(() => { toast.classList.add('-translate-y-10', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}