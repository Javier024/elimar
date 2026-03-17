document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. CARGAR CONFIGURACIÓN (DESDE DB)
    // ==========================================
    async function loadConfig() {
        try {
            const res = await fetch("/api/configuracion");
            const data = await res.json();

            // Si la API devuelve datos (no es null), llenamos los campos
            if (data) {
                
                // --- SECCIÓN GENERAL ---
                document.getElementById('confNombre').value = data.nombre || '';
                document.getElementById('confNit').value = data.nit || '';
                document.getElementById('confDireccion').value = data.direccion || '';
                document.getElementById('confTelefono').value = data.telefono || '';

                // --- SECCIÓN TARIFAS CARROS ---
                document.getElementById('tarifaCarroHora').value = data.tarifa_carro_hora || 5000;
                document.getElementById('tarifaCarroNoche').value = data.tarifa_carro_noche || 12000;
                document.getElementById('tarifaCarroSemana').value = data.tarifa_carro_semana || 40000;
                document.getElementById('tarifaCarroQuincenal').value = data.tarifa_carro_quincena || 75000;
                document.getElementById('tarifaCarroMensual').value = data.tarifa_carro_mes || 140000;

                // --- SECCIÓN TARIFAS MOTOS ---
                document.getElementById('tarifaMotoHora').value = data.tarifa_moto_hora || 2500;
                document.getElementById('tarifaMotoNoche').value = data.tarifa_moto_noche || 6000;
                document.getElementById('tarifaMotoSemana').value = data.tarifa_moto_semana || 20000;
                document.getElementById('tarifaMotoQuincenal').value = data.tarifa_moto_quincena || 35000;
                document.getElementById('tarifaMotoMensual').value = data.tarifa_moto_mes || 65000;

                // --- SECCIÓN TARIFAS BICIS ---
                document.getElementById('tarifaBiciHora').value = data.tarifa_bici_hora || 1000;
                document.getElementById('tarifaBiciNoche').value = data.tarifa_bici_noche || 2000;
                document.getElementById('tarifaBiciSemana').value = data.tarifa_bici_semana || 8000;
                document.getElementById('tarifaBiciQuincenal').value = data.tarifa_bici_quincena || 15000;
                document.getElementById('tarifaBiciMensual').value = data.tarifa_bici_mes || 25000;

                // --- SECCIÓN PERFIL ADMIN ---
                document.getElementById('perfNombre').value = data.admin_nombre || 'Admin';
                document.getElementById('perfEmail').value = data.admin_email || '';
                document.getElementById('perfNotif').checked = (data.admin_notif === 1);
            }
        } catch (error) {
            console.error("Error cargando configuración", error);
            mostrarToast("Error al cargar configuración", "error");
        }
    }

    // ==========================================
    // 2. GUARDAR CONFIGURACIÓN (ENVIAR A DB)
    // ==========================================
    window.guardarTodo = async function() {
        const btn = document.querySelector('button[onclick="guardarTodo()"]');
        
        // Efecto visual de "Cargando"
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...`;

        try {
            // Recopilamos TODOS los datos de los inputs en un solo objeto
            const configData = {
                // General
                nombre: document.getElementById('confNombre').value,
                nit: document.getElementById('confNit').value,
                direccion: document.getElementById('confDireccion').value,
                telefono: document.getElementById('confTelefono').value,
                
                // Carros
                tarifa_carro_hora: document.getElementById('tarifaCarroHora').value,
                tarifa_carro_noche: document.getElementById('tarifaCarroNoche').value,
                tarifa_carro_semana: document.getElementById('tarifaCarroSemana').value,
                tarifa_carro_quincena: document.getElementById('tarifaCarroQuincenal').value,
                tarifa_carro_mes: document.getElementById('tarifaCarroMensual').value,
                
                // Motos
                tarifa_moto_hora: document.getElementById('tarifaMotoHora').value,
                tarifa_moto_noche: document.getElementById('tarifaMotoNoche').value,
                tarifa_moto_semana: document.getElementById('tarifaMotoSemana').value,
                tarifa_moto_quincena: document.getElementById('tarifaMotoQuincenal').value,
                tarifa_moto_mes: document.getElementById('tarifaMotoMensual').value,
                
                // Bicis
                tarifa_bici_hora: document.getElementById('tarifaBiciHora').value,
                tarifa_bici_noche: document.getElementById('tarifaBiciNoche').value,
                tarifa_bici_semana: document.getElementById('tarifaBiciSemana').value,
                tarifa_bici_quincena: document.getElementById('tarifaBiciQuincenal').value,
                tarifa_bici_mes: document.getElementById('tarifaBiciMensual').value,
                
                // Admin
                admin_nombre: document.getElementById('perfNombre').value,
                admin_email: document.getElementById('perfEmail').value,
                admin_notif: document.getElementById('perfNotif').checked
            };

            // Enviamos al API
            const res = await fetch("/api/configuracion", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(configData)
            });

            const result = await res.json();

            if (result.success) {
                mostrarToast("Configuración guardada en el sistema", "success");
                
                // Feedback visual de éxito en el botón
                btn.innerHTML = `<i class="fa-solid fa-check"></i> Guardado`;
                btn.classList.replace('bg-indigo-600', 'bg-emerald-600');
            } else {
                throw new Error("Error en respuesta");
            }

        } catch (error) {
            console.error(error);
            mostrarToast("Error al guardar cambios", "error");
            btn.innerHTML = originalHTML; // Restaurar texto si falla
        } finally {
            // Restaurar botón después de 2 segundos
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                btn.classList.replace('bg-emerald-600', 'bg-indigo-600');
            }, 2000);
        }
    };

    // ==========================================
    // 3. LÓGICA DE PESTAÑAS (TABS)
    // ==========================================
    window.switchTab = function(tabName) {
        // Nombres de las pestañas
        const tabs = ['general', 'tarifas', 'perfil'];

        tabs.forEach(t => {
            const el = document.getElementById('content-' + t);
            const btn = document.getElementById('tab-' + t);
            
            // Ocultar contenido y quitar estilo activo
            if (el) { 
                el.classList.add('hidden-tab'); 
                el.classList.remove('visible-tab'); 
            }
            if (btn) btn.classList.remove('active');
        });

        // Mostrar la pestaña seleccionada
        const activeContent = document.getElementById('content-' + tabName);
        const activeBtn = document.getElementById('tab-' + tabName);

        if (activeContent) {
            activeContent.classList.remove('hidden-tab');
            activeContent.classList.add('visible-tab');
        }
        if (activeBtn) activeBtn.classList.add('active');
    };

    // ==========================================
    // 4. UTILIDADES (TOASTS Y MENU)
    // ==========================================
    
    // Mostrar notificación flotante
    function mostrarToast(mensaje, tipo = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        // Colores según tipo
        const bgClass = tipo === 'success' ? 'bg-emerald-600' : 'bg-red-600';
        const icon = tipo === 'success' ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
        
        toast.className = `${bgClass} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 transform transition-all duration-500 translate-x-10 opacity-0`;
        toast.innerHTML = `${icon} <span class="font-medium text-sm tracking-wide">${mensaje}</span>`;
        
        container.appendChild(toast);
        
        // Animación de entrada
        requestAnimationFrame(() => toast.classList.remove('translate-x-10', 'opacity-0'));
        
        // Desaparecer después de 3 segundos
        setTimeout(() => { 
            toast.classList.add('translate-x-10', 'opacity-0'); 
            setTimeout(() => toast.remove(), 500); 
        }, 3000);
    }

    // Toggle menú móvil
    window.toggleMenu = function() {
        document.getElementById('mobileMenu').classList.toggle('hidden');
    }

    // ==========================================
    // 5. INICIALIZACIÓN
    // ==========================================
    
    // Poner fecha actual en el header
    const fechaEl = document.getElementById('fecha-actual');
    if(fechaEl) {
        fechaEl.textContent = new Date().toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // Cargar datos de la DB al iniciar
    loadConfig();
});