// Este archivo DEBE cargarse primero que los demás JS en las páginas protegidas
(function() {
    var originalFetch = window.fetch;
    
    window.fetch = async function(url, options) {
        options = options || {};

        // Solo inyectar token en peticiones a la API que NO sean auth
        if (typeof url === 'string' && url.indexOf('/api/') === 0 && url.indexOf('/api/auth') === -1) {
            var token = sessionStorage.getItem('parkingToken');
            
            if (token) {
                options.headers = Object.assign({}, options.headers, {
                    'x-session-token': token
                });
            } else {
                // CORREGIDO: ruta ./index.html (no ../index.html)
                window.location.replace('./index.html');
                return new Promise(function() {}); // Detener la petición
            }
        }
        return originalFetch.call(this, url, options);
    };
})();