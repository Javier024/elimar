document.addEventListener('DOMContentLoaded', () => {

    // 1. FUNCIÓN TOGGLE PASSWORD (Ver/Ocultar)
    window.togglePassword = function() {
        const passInput = document.getElementById('pass');
        const eyeIcon = document.getElementById('eyeIcon');
        const type = passInput.getAttribute('type');
        const isPassword = type === 'password';

        if (isPassword) {
            passInput.setAttribute('type', 'text');
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            passInput.setAttribute('type', 'password');
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    };

    // 2. FUNCIÓN LOGIN (Ahora consulta el backend)
    window.login = async function() {

        const user = document.getElementById('user').value.trim();
        const pass = document.getElementById('pass').value;

        const errorMensaje = document.getElementById('errorMensaje');
        const btn = document.getElementById('btnLogin');

        const originalText = btn.innerHTML;

        try {

            // Animación de carga
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...';

            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: user,
                    password: pass
                })
            });

            const data = await response.json();

            if (data.success) {

                // Guardar sesión
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userName', data.user);

                // Redirigir al dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 600);

            } else {

                // Mostrar error
                errorMensaje.classList.remove('hidden');

                setTimeout(() => {
                    errorMensaje.classList.add('hidden');
                }, 2000);

                btn.innerHTML = originalText;

            }

        } catch (error) {

            console.error("Error login:", error);

            errorMensaje.classList.remove('hidden');

            setTimeout(() => {
                errorMensaje.classList.add('hidden');
            }, 2000);

            btn.innerHTML = originalText;

        }
    };

    // 3. PROTECCIÓN DE RUTAS
    function checkSession() {

        const isLogged = localStorage.getItem('isLoggedIn');
        const currentPath = window.location.pathname;

        if (currentPath.includes('dashboard.html')) {

            if (!isLogged) {
                window.location.href = 'index.html';
            }

        }

        if (currentPath.includes('index.html') && isLogged) {
            window.location.href = 'dashboard.html';
        }

    }

    checkSession();

});