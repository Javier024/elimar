// Este archivo DEBE cargarse primero que los demás JS en las páginas protegidas
(function() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(url, options = {}) {
        // Si es petición a nuestra API y NO es el login
        if (url.startsWith('/api/') && !url.includes('/api/auth')) {
            const token = sessionStorage.getItem('parkingToken');
            
            if (token) {
                options.headers = {
                    ...options.headers,
                    'x-session-token': token
                };
            } else {
                // Si no hay token, redirigir al login inmediatamente
                window.location.replace('../index.html');
                return new Promise(() => {}); // Detener la petición
            }
        }
        return originalFetch.call(this, url, options);
    };
})();