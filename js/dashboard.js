document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // 1. CONFIGURACIÓN DE FECHA EN EL HEADER
    // ==========================================
    const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const fechaElement = document.getElementById('fecha-actual');
    if(fechaElement) {
        fechaElement.textContent = new Date().toLocaleDateString('es-ES', dateOptions);
    }

    // ==========================================
    // 2. CONFIGURACIÓN DE GRÁFICOS (Chart.js)
    // ==========================================
    
    // Configuración global de estilos para los gráficos
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';

    // --- Gráfico de Barras: Flujo Financiero ---
    const ctxBar = document.getElementById('ingresosGastosChart');
    if (ctxBar) {
        new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
                datasets: [
                    { 
                        label: 'Ingresos', 
                        data: [120000, 150000, 180000, 140000, 200000, 250000, 100000], 
                        backgroundColor: '#3b82f6', // Azul primary
                        borderRadius: 6, 
                        barPercentage: 0.6,
                        hoverBackgroundColor: '#2563eb'
                    },
                    { 
                        label: 'Gastos', 
                        data: [50000, 60000, 55000, 70000, 80000, 90000, 40000], 
                        backgroundColor: '#cbd5e1', // Gris suave
                        borderRadius: 6, 
                        barPercentage: 0.6,
                        hoverBackgroundColor: '#94a3b8'
                    }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { position: 'top', labels: { useBorderRadius: true, boxWidth: 8 } } 
                }, 
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        grid: { color: '#f1f5f9', borderDash: [5, 5] },
                        ticks: { callback: function(value) { return '$' + value / 1000 + 'k'; } }
                    }, 
                    x: { grid: { display: false } } 
                } 
            }
        });
    }

    // --- Gráfico Circular: Ocupación ---
    const ctxDoughnut = document.getElementById('ocupacionChart');
    if (ctxDoughnut) {
        new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: ['Ocupados', 'Libres', 'Reservados'],
                datasets: [{ 
                    data: [24, 12, 3], 
                    backgroundColor: ['#3b82f6', '#e2e8f0', '#f59e0b'], // Azul, Gris, Ambar
                    borderWidth: 0,
                    hoverOffset: 4 
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '75%', // Grosor del donut
                plugins: { 
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, pointStyle: 'circle' } } 
                } 
            }
        });
    }

    // ==========================================
    // 3. LÓGICA DE TABLA Y PAGINACIÓN
    // ==========================================
    
    // Generación de datos simulados (Mock Data)
    const movimientosData = Array.from({ length: 25 }, (_, i) => {
        const tipos = ['Carro', 'Moto', 'Camioneta'];
        const tipo = tipos[Math.floor(Math.random() * tipos.length)];
        // Generador de placas aleatorias
        const placa = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${100 + i}`;
        const estado = i % 5 === 0 ? 'Finalizado' : 'Activo';
        
        return {
            vehiculo: placa,
            tipo: tipo,
            puesto: `A-${Math.floor(Math.random() * 20) + 1}`,
            hora: `${8 + Math.floor(Math.random() * 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
            estado: estado
        };
    });

    // Estado de la paginación
    let currentPage = 1;
    const rowsPerPage = 5;

    // Referencias al DOM
    const tableBody = document.getElementById('tableBody');
    const paginationControls = document.getElementById('paginationControls');
    const startRecordSpan = document.getElementById('startRecord');
    const endRecordSpan = document.getElementById('endRecord');
    const totalRecordsSpan = document.getElementById('totalRecords');

    /**
     * Renderiza las filas de la tabla basándose en la página actual
     */
    function renderTable(page) {
        if (!tableBody) return;

        tableBody.innerHTML = '';
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedItems = movimientosData.slice(start, end);

        // Actualizar contadores
        startRecordSpan.textContent = movimientosData.length === 0 ? 0 : start + 1;
        endRecordSpan.textContent = Math.min(end, movimientosData.length);
        totalRecordsSpan.textContent = movimientosData.length;

        // Crear filas HTML
        paginatedItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition group border-b border-slate-50 last:border-0";
            
            // Lógica de colores para Tipo de Vehículo
            let tipoClass = item.tipo === 'Carro' 
                ? 'bg-blue-100 text-blue-700' 
                : (item.tipo === 'Moto' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700');
            
            // Lógica de Badge para Estado
            let estadoHtml = item.estado === 'Activo' 
                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                     <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                   </span>`
                : `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">Finalizado</span>`;

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-slate-800 group-hover:text-blue-600 transition-colors">${item.vehiculo}</td>
                <td class="px-6 py-4"><span class="px-2.5 py-1 rounded-lg text-xs font-semibold ${tipoClass}">${item.tipo}</span></td>
                <td class="px-6 py-4 text-slate-600">${item.puesto}</td>
                <td class="px-6 py-4 text-slate-500 font-mono text-xs">${item.hora}</td>
                <td class="px-6 py-4">${estadoHtml}</td>
            `;
            tableBody.appendChild(tr);
        });

        renderPagination();
    }

    /**
     * Renderiza los botones de control de paginación
     */
    function renderPagination() {
        if (!paginationControls) return;
        
        paginationControls.innerHTML = '';
        const totalPages = Math.ceil(movimientosData.length / rowsPerPage);

        // Botón Anterior
        const prevBtn = createPageBtn('<i class="fa-solid fa-chevron-left"></i>', () => {
            if (currentPage > 1) { currentPage--; renderTable(currentPage); }
        }, currentPage === 1);
        paginationControls.appendChild(prevBtn);

        // Botones Numéricos
        for (let i = 1; i <= totalPages; i++) {
            const btn = createPageBtn(i, () => { currentPage = i; renderTable(currentPage); }, false, i === currentPage);
            paginationControls.appendChild(btn);
        }

        // Botón Siguiente
        const nextBtn = createPageBtn('<i class="fa-solid fa-chevron-right"></i>', () => {
            if (currentPage < totalPages) { currentPage++; renderTable(currentPage); }
        }, currentPage === totalPages);
        paginationControls.appendChild(nextBtn);
    }

    /**
     * Helper para crear botones de paginación con estilos consistentes
     */
    function createPageBtn(text, onClick, disabled, isActive = false) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.disabled = disabled;
        btn.onclick = onClick;
        
        let classes = "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ";
        
        if (isActive) {
            classes += "bg-blue-600 text-white shadow-md shadow-blue-200";
        } else if (disabled) {
            classes += "bg-slate-100 text-slate-300 cursor-not-allowed";
        } else {
            classes += "bg-white text-slate-600 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200";
        }
        
        btn.className = classes;
        return btn;
    }

    // Inicializar tabla
    renderTable(currentPage);

});