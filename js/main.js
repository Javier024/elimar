// parqueo/js/main.js - REEMPLAZAR COMPLETO
(function() {
    var originalFetch = window.fetch;
    
    window.fetch = async function(url, options) {
        options = options || {};

        // No interceptar auth
        if (typeof url === 'string' && url.indexOf('/api/auth') === 0) {
            return originalFetch.call(this, url, options);
        }

        if (typeof url === 'string' && url.indexOf('/api/') === 0) {
            var token = sessionStorage.getItem('parkingToken');
            
            if (token) {
                options.headers = Object.assign({}, options.headers, {
                    'x-session-token': token
                });
            } else {
                // CORREGIDO: Detectar la profundidad para redirigir correctamente
                var path = window.location.pathname;
                var rootIndex = path.indexOf('/pages/');
                var redirectPath = rootIndex >= 0 ? '/pages/' : '/';
                window.location.replace(redirectPath + 'index.html');
                return new Promise(function() {});
            }
        }
        
        try {
            const response = await originalFetch.call(this, url, options);
            
            // NUEVO: Si la respuesta es 401, redirigir al login
            if (response.status === 401) {
                sessionStorage.removeItem('parkingUser');
                sessionStorage.removeItem('parkingToken');
                var path = window.location.pathname;
                var rootIndex = path.indexOf('/pages/');
                var redirectPath = rootIndex >= 0 ? '/pages/' : '/';
                window.location.replace(redirectPath + 'index.html');
                return new Promise(function() {});
            }
            
            return response;
        } catch (error) {
            return originalFetch.call(this, url, options);
        }
    };
})();