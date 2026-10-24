/* =====================================================
   RestaControl — Reporte de Reservas y Atención
   ===================================================== */

(() => {
    const state = {
        chart: null,
        // Filtros elegidos por el usuario (valores iniciales = los "selected" del HTML)
        periodo: '7d',
        estado: 'todos',
        // Último reporte que llegó del backend, para volver a dibujar sin pedirlo otra vez
        data: null
    };

    // Texto que se muestra en los títulos según el periodo elegido
    const PERIODOS = {
        '1d': 'hoy',
        '7d': 'últimos 7 días',
        '30d': 'últimos 30 días'
    };

    // Estados que se pueden filtrar. La "key" es el nombre del campo
    // que manda el backend en cada día del history.
    const ESTADOS = [
        { key: 'confirmadas', label: 'Confirmadas', color: 'rgba(34,197,94,0.85)' },
        { key: 'pendientes', label: 'Pendientes', color: 'rgba(245,158,11,0.85)' },
        { key: 'canceladas', label: 'Canceladas', color: 'rgba(239,68,68,0.85)' }
    ];

    const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL
        ? String(window.APP_CONFIG.API_BASE_URL).replace(/\/+$/, '')
        : '';

    async function init() {
        bindFiltros();
        await cargarReporte();
    }

    // Escucha los cambios de los dos select del HTML
    function bindFiltros() {
        const filtroPeriodo = document.getElementById('filtroPeriodo');
        const filtroEstado = document.getElementById('filtroEstado');

        // El periodo cambia el rango de fechas, así que hay que pedir el reporte otra vez al backend
        filtroPeriodo?.addEventListener('change', async (event) => {
            state.periodo = event.target.value;
            await cargarReporte();
        });

        // El estado no necesita backend: los datos de cada estado ya llegaron, solo cambiamos qué se muestra
        filtroEstado?.addEventListener('change', (event) => {
            state.estado = event.target.value;
            renderVista();
        });
    }

    // Pide el reporte con el periodo actual y dibuja todo
    async function cargarReporte() {
        try {
            showLoading();

            const data = await loadReportData();
            state.data = data;

            renderSummary(data);
            renderTitulos();
            renderVista();
        } catch (error) {
            console.error('Error cargando el reporte de reservas:', error);
            renderError();
        }
    }

    // Dibuja la tabla y el gráfico con los datos guardados y el filtro de estado
    function renderVista() {
        const history = state.data ? state.data.history : [];

        renderTable(history);
        renderChart(history);
    }

    // Devuelve los estados que hay que mostrar según el filtro
    function getEstadosVisibles() {
        if (state.estado === 'todos') {
            return ESTADOS;
        }

        return ESTADOS.filter((estado) => estado.key === state.estado);
    }

    // Cambia los títulos para que digan el periodo elegido
    function renderTitulos() {
        setText('resTotalLabel', `Reservas totales (${state.periodo})`);
        setText('chartTitle', `Reservas por estado (${PERIODOS[state.periodo] || state.periodo})`);
    }

    async function loadReportData() {
        /*
         * Primero intenta obtener los datos reales del backend.
         */
        const backendData = await fetchFromApi();

        if (backendData) {
            return normalize(backendData);
        }

        /*
         * Este fallback puede mantenerse mientras desarrollas.
         * En producción podrías eliminarlo para no ocultar errores.
         */
        console.warn(
            'No se pudo consultar el backend. Se usarán datos locales.'
        );

        return normalize(buildFallback());
    }

    async function fetchFromApi() {
        const url =
            `${apiBaseUrl}/api/reportes/reservas?periodo=${encodeURIComponent(state.periodo)}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json'
                },

                /*
                 * Déjalo si el backend utiliza cookies o sesión.
                 */
                credentials: 'include'
            });

            if (!response.ok) {
                console.error(
                    `Error HTTP ${response.status} consultando ${url}`
                );

                return null;
            }

            const payload = await response.json();

            if (!payload?.success || !payload?.data) {
                console.error(
                    'Respuesta inválida del backend:',
                    payload
                );

                return null;
            }

            return payload.data;
        } catch (error) {
            console.error(
                'Error de conexión con el reporte de reservas:',
                error
            );

            return null;
        }
    }

    function normalize(raw = {}) {
        const totales = raw.totales || {};

        return {
            totales: {
                totalReservas: toNumber(totales.totalReservas),
                confirmadas: toNumber(totales.confirmadas),
                pendientes: toNumber(totales.pendientes),
                canceladas: toNumber(totales.canceladas),
                atencionesEnCurso: toNumber(
                    totales.atencionesEnCurso
                ),
                avgTiempoMin: toNumber(totales.avgTiempoMin)
            },

            history: Array.isArray(raw.history)
                ? raw.history.map((item) => ({
                    label: item.label || '',
                    confirmadas: toNumber(item.confirmadas),
                    pendientes: toNumber(item.pendientes),
                    canceladas: toNumber(item.canceladas),
                    atenciones: toNumber(item.atenciones)
                }))
                : []
        };
    }

    function buildFallback() {
        /*
         * Validamos que DB exista antes de usarlo.
         */
        if (!window.DB || typeof DB.getAll !== 'function') {
            return {
                totales: {},
                history: []
            };
        }

        const reservas = DB.getAll('reservas') || [];
        const atenciones = DB.getAll('atenciones') || [];
        const today = new Date();

        const lastDays = Array.from(
            { length: 7 },
            (_, index) => {
                const date = new Date(today);

                date.setDate(
                    today.getDate() - (6 - index)
                );

                return date;
            }
        );

        function getLabel(date) {
            const days = [
                'Dom',
                'Lun',
                'Mar',
                'Mié',
                'Jue',
                'Vie',
                'Sáb'
            ];

            return `${days[date.getDay()]} ${date.getDate()}`;
        }

        const history = lastDays.map((day) => {
            const start = new Date(day);
            start.setHours(0, 0, 0, 0);

            const end = new Date(day);
            end.setHours(23, 59, 59, 999);

            const dayReservations = reservas.filter(
                (reservation) => {
                    if (!reservation.fecha_hora) {
                        return false;
                    }

                    const reservationDate =
                        new Date(reservation.fecha_hora);

                    return (
                        reservationDate >= start &&
                        reservationDate <= end
                    );
                }
            );

            const confirmadas = dayReservations.filter(
                (reservation) =>
                    normalizeText(reservation.estado) ===
                    'confirmada'
            ).length;

            const pendientes = dayReservations.filter(
                (reservation) =>
                    normalizeText(reservation.estado) ===
                    'pendiente'
            ).length;

            const canceladas = dayReservations.filter(
                (reservation) =>
                    normalizeText(reservation.estado) ===
                    'cancelada'
            ).length;

            const dayAtenciones = atenciones.filter(
                (atencion) => {
                    if (!atencion.apertura_en) {
                        return false;
                    }

                    const openingDate =
                        new Date(atencion.apertura_en);

                    return (
                        openingDate >= start &&
                        openingDate <= end
                    );
                }
            );

            return {
                label: getLabel(day),
                confirmadas,
                pendientes,
                canceladas,
                atenciones: dayAtenciones.length
            };
        });

        const totales = {
            totalReservas: reservas.length,

            confirmadas: reservas.filter(
                (reservation) =>
                    normalizeText(reservation.estado) ===
                    'confirmada'
            ).length,

            pendientes: reservas.filter(
                (reservation) =>
                    normalizeText(reservation.estado) ===
                    'pendiente'
            ).length,

            canceladas: reservas.filter(
                (reservation) =>
                    normalizeText(reservation.estado) ===
                    'cancelada'
            ).length,

            atencionesEnCurso: atenciones.filter(
                (atencion) =>
                    normalizeText(atencion.estado).includes(
                        'en curso'
                    )
            ).length,

            avgTiempoMin: averageAtencionTimeMin(atenciones)
        };

        return {
            totales,
            history
        };
    }

    function averageAtencionTimeMin(atenciones) {
        const cerradas = atenciones.filter(
            (atencion) =>
                atencion.cierre_en &&
                atencion.apertura_en
        );

        if (!cerradas.length) {
            return 0;
        }

        const minutos = cerradas
            .map((atencion) => {
                const apertura =
                    new Date(atencion.apertura_en);

                const cierre =
                    new Date(atencion.cierre_en);

                return (cierre - apertura) / 60000;
            })
            .filter(
                (value) =>
                    Number.isFinite(value) &&
                    value >= 0
            );

        if (!minutos.length) {
            return 0;
        }

        const promedio =
            minutos.reduce(
                (sum, value) => sum + value,
                0
            ) / minutos.length;

        return Math.round(promedio);
    }

    function renderSummary(data) {
        const totals = data.totales;

        setText(
            'resTotal',
            totals.totalReservas
        );

        setText(
            'resConfirmadas',
            totals.confirmadas
        );

        setText(
            'atencionesCurso',
            totals.atencionesEnCurso
        );

        setText(
            'avgTiempo',
            totals.avgTiempoMin
        );

        /*
         * Aprovechamos las notas existentes del HTML para
         * mostrar pendientes y canceladas.
         */
        setText(
            'resTotalNote',
            `Pendientes: ${totals.pendientes} · ` +
            `Canceladas: ${totals.canceladas}`
        );

        setText(
            'resConfirmadasNote',
            'Reservas confirmadas en el periodo'
        );

        setText(
            'atencionesCursoNote',
            'Atenciones actualmente sin cerrar'
        );

        setText(
            'avgTiempoNote',
            'Promedio de atenciones cerradas'
        );
    }

    function renderTable(history) {
        const head =
            document.getElementById(
                'resumenReservasHead'
            );

        const body =
            document.getElementById(
                'resumenReservasBody'
            );

        if (!body) {
            return;
        }

        const estados = getEstadosVisibles();

        // La cabecera cambia según el filtro: Día + estados visibles + Atenciones
        if (head) {
            head.innerHTML = `
                <tr>
                    <th>Día</th>
                    ${estados.map((estado) => `<th>${estado.label}</th>`).join('')}
                    <th>Atenciones</th>
                </tr>
            `;
        }

        // Día + estados + Atenciones, para que el mensaje ocupe toda la fila
        const totalColumnas = estados.length + 2;

        if (!history.length) {
            body.innerHTML = `
                <tr>
                    <td
                        colspan="${totalColumnas}"
                        class="text-center text-muted py-4"
                    >
                        No hay información para mostrar.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = history
            .map((item) => `
                <tr>
                    <td>
                        ${escapeHtml(item.label)}
                    </td>

                    ${estados.map((estado) => `<td>${item[estado.key]}</td>`).join('')}

                    <td>
                        ${item.atenciones}
                    </td>
                </tr>
            `)
            .join('');
    }

    function renderChart(history) {
        const canvas =
            document.getElementById('reservasChart');

        const noData =
            document.getElementById(
                'reservasChartNoData'
            );

        if (!canvas) {
            return;
        }

        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }

        const estados = getEstadosVisibles();

        // Hay datos si algún día tiene valor en un estado visible o en atenciones
        const hasData =
            history.length > 0 &&
            history.some(
                (item) =>
                    estados.some((estado) => item[estado.key] > 0) ||
                    item.atenciones > 0
            );

        if (!hasData) {
            canvas.style.display = 'none';

            if (noData) {
                noData.style.display = 'flex';
            }

            return;
        }

        canvas.style.display = 'block';

        if (noData) {
            noData.style.display = 'none';
        }

        const context = canvas.getContext('2d');

        state.chart = new Chart(context, {
            type: 'bar',

            data: {
                labels: history.map(
                    (item) => item.label
                ),

                // Una barra por cada estado visible, más la de atenciones
                datasets: [
                    ...estados.map((estado) => ({
                        label: estado.label,
                        data: history.map(
                            (item) => item[estado.key]
                        ),
                        backgroundColor: estado.color
                    })),
                    {
                        label: 'Atenciones',
                        data: history.map(
                            (item) => item.atenciones
                        ),
                        backgroundColor:
                            'rgba(13,202,240,0.85)'
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    mode: 'index',
                    intersect: false
                },

                plugins: {
                    legend: {
                        position: 'top'
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function showLoading() {
        setText('resTotal', '...');
        setText('resConfirmadas', '...');
        setText('atencionesCurso', '...');
        setText('avgTiempo', '...');
    }

    function renderError() {
        setText('resTotal', '0');
        setText('resConfirmadas', '0');
        setText('atencionesCurso', '0');
        setText('avgTiempo', '0');

        setText(
            'resTotalNote',
            'No se pudo cargar el reporte'
        );

        setText(
            'resConfirmadasNote',
            'Verifica la conexión con el backend'
        );

        renderTable([]);
        renderChart([]);
    }

    function toNumber(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    function normalizeText(value) {
        return String(value || '')
            .trim()
            .toLowerCase();
    }

    function escapeHtml(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function setText(id, text) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = String(text);
        }
    }

    window.ReporteReservas = {
        init
    };
})();