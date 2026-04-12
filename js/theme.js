// parqueo/js/theme.js
(function() {
    const STORAGE_KEY = 'elimar_theme';
    
    // Obtener tema guardado o el del sistema operativo
    function getPreferredTheme() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Aplicar tema inmediatamente (antes de que renderice para evitar parpadeo)
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    // Inicializar al cargar
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);

    // Exponer función global para los botones
    window.toggleTheme = function() {
        const isDark = document.documentElement.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';
        
        applyTheme(newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);
        
        // Actualizar iconos de todos los botones que existan en la página
        updateToggleIcons(newTheme);
    };

    function updateToggleIcons(theme) {
        // Busca todos los iconos de tema y los cambia
        var iconElements = document.querySelectorAll('.theme-toggle-icon');
        iconElements.forEach(function(icon) {
            if (theme === 'dark') {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            } else {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        });
    }

    // Asegurar que el icono correcto se muestre cuando la página carga
    document.addEventListener('DOMContentLoaded', function() {
        updateToggleIcons(initialTheme);
    });
})();