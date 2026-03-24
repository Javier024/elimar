// parqueo/js/auth-manager.js
// Este script controla la sesión, el tiempo de inactividad y la navegación

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    initInactivityTimer();
    preventBackButton();
    loadUserInfo();
});

// 1. VERIFICAR SESIÓN (Auth Guard)
// Si el usuario intenta entrar sin loguearse, lo saca inmediatamente.
function checkSession() {
    const user = JSON.parse(sessionStorage.getItem('parkingUser'));
    if (!user) {
        // Usamos replace para que esta página no quede en el historial
        window.location.replace('index.html');
    }
}

// 2. TEMPORIZADOR DE INACTIVIDAD
// Cierra sesión después de 15 minutos sin mover el mouse o tocar la pantalla
let inactivityTimeout;

function initInactivityTimer() {
    const MAX_INACTIVE_TIME = 15 * 60 * 1000; // 15 minutos en milisegundos
    
    const resetTimer = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(logout, MAX_INACTIVE_TIME);
    };

    // Eventos que reinician el contador
    window.onload = resetTimer;
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    document.ontouchstart = resetTimer; // Móvil
    document.onclick = resetTimer;
    document.onscroll = resetTimer;
}

// 3. FUNCIÓN DE CIERRE DE SESIÓN (GLOBAL)
// Limpia la sesión y redirige al login
function logout() {
    sessionStorage.removeItem('parkingUser');
    window.location.replace('index.html');
}
// Hacemos la función accesible globalmente para los botones HTML
window.logout = logout;

// 4. PREVENCIÓN DEL BOTÓN ATRÁS
// Evita que el navegador vuelva a la página de login una vez dentro
function preventBackButton() {
    // Empujamos un estado falso al historial
    window.history.pushState(null, "", window.location.href);

    window.onpopstate = function() {
        const user = JSON.parse(sessionStorage.getItem('parkingUser'));
        if (!user) {
            window.location.replace('index.html');
        } else {
            // Si hay sesión, lo mantenemos en la página actual
            window.history.pushState(null, "", window.location.href);
        }
    };
}

// 5. CARGAR INFO DE USUARIO (Opcional)
// Muestra el nombre del usuario en el sidebar si existe el elemento
function loadUserInfo() {
    const user = JSON.parse(sessionStorage.getItem('parkingUser'));
    if(user) {
        const userDisplay = document.getElementById('sidebar-user-name');
        if(userDisplay) userDisplay.innerText = user.nombre;
    }
}