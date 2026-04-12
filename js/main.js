// Este archivo DEBE cargarse primero que los demás JS en las páginas protegidas
(function() {
    var originalFetch = window.fetch;
    
    window.fetch = async function(url, options) {
        options = options || {};

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
                window.location.replace('./index.html');
                return new Promise(function() {});
            }
        }
        
        try {
            return await originalFetch.call(this, url, options);
        } catch (error) {
            return originalFetch.call(this, url, options);
        }
    };
})();