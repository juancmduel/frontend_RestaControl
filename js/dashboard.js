/* =====================================================
   RestaControl — Dashboard Page Logic
   Carga métricas desde la base de datos local y opcionalmente desde backend API.
   ===================================================== */

(() => {
    const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL
        ? String(window.APP_CONFIG.API_BASE_URL).replace(/\/+$/, '')
        : null;

    async function init() {
        const authenticated = await Auth.requireLogin();

        if (!authenticated) {
            return;
        }

        await render();
    }

    async function render() {
        try {
            const data = await loadDashboardData();

            renderStats(data);
            renderReservas(data.reservas?.rows || []);
            renderAtenciones(data.atenciones?.rows || []);
        } catch (error) {
            console.error(
                'No se pudo renderizar el dashboard:',
                error
            );
            renderError();
        }
    }

    async function loadDashboardData() {
        const dashboardFromApi = await fetchDashboardFromApi();

        if (!dashboardFromApi) {
            throw new Error(
                'No se pudieron cargar los datos del dashboard desde el backend.'
            );
        }

        return dashboardFromApi;
    }

    async function fetchDashboardFromApi() {
        if (!apiBaseUrl) {
            return null;
        }

        try {
            const response = await fetch(
                `${apiBaseUrl}/api/dashboard`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json'
                    },
                    credentials: 'include'
                }
            );

            const payload = await response.json();

            if (!response.ok) {
                console.error(
                    'Error consultando dashboard:',
                    response.status,
                    payload
                );
                return null;
            }

            const dashboardData = payload?.data ?? payload;

            if (!dashboardData || typeof dashboardData !== 'object') {
                console.warn(
                    'Respuesta de dashboard backend inválida.',
                    payload
                );
                return null;
            }

            return dashboardData;

        } catch (error) {
            console.error(
                'Error cargando dashboard desde backend:',
                error
            );
            return null;
        }
    }

    function renderError() {
        const message = 'No se pudo cargar la información. Verifica que el backend esté activo e inicia sesión nuevamente.';
        [
            'dashCategoriasActivas', 'dashPlatosDisponibles', 'dashMesasActivas',
            'dashReservasVigentes', 'dashAtencionesEnCurso', 'dashPedidosRegistrados'
        ].forEach((id) => setText(id, '-'));
        [
            'dashCategoriasNote', 'dashPlatosNote', 'dashMesasNote',
            'dashReservasNote', 'dashAtencionesNote', 'dashPedidosNote'
        ].forEach((id) => setText(id, 'Sin datos'));
        ['dashReservasBody', 'dashAtencionesBody'].forEach((id) => {
            const container = byId(id);
            if (container) {
                container.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">' + message + '</td></tr>';
            }
        });
    }

    function renderStats(data) {
        setText('dashCategoriasActivas', String(data.categorias.active));
        setText('dashCategoriasNote', `de ${data.categorias.total} registradas`);

        setText('dashPlatosDisponibles', String(data.platos.available));
        setText('dashPlatosNote', `de ${data.platos.total} en carta`);

        setText('dashMesasActivas', String(data.mesas.active));
        setText('dashMesasNote', `de ${data.mesas.total} configuradas`);

        setText('dashReservasVigentes', String(data.reservas.active));
        setText('dashReservasNote', `${data.reservas.confirmed} confirmadas`);

        setText('dashAtencionesEnCurso', String(data.atenciones.inProgress));
        setText('dashAtencionesNote', `${data.atenciones.closedToday} cerradas hoy`);

        setText('dashPedidosRegistrados', String(data.pedidos.total));
        setText('dashPedidosNote', `${data.pedidos.items} ítems en detalle`);
    }

    function renderReservas(rows) {
        const container = byId('dashReservasBody');
        if (!container) return;
        if (!rows.length) {
            container.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay reservas vigentes.</td></tr>';
            return;
        }

        container.innerHTML = rows.map((row, idx) => {
            const displayIndex = (row && (row.index !== undefined && row.index !== null)) ? row.index : (idx + 1);
            return `
            <tr>
                <td><span class="record-id">#${displayIndex}</span></td>
                <td><span class="fw-semibold">${escapeHtml(row.cliente)}</span></td>
                <td>${escapeHtml(row.mesa)}</td>
                <td>${escapeHtml(row.fechaHora)}</td>
                <td>${escapeHtml(String(row.personas))}</td>
                <td>${renderBadge(row.estado)}</td>
            </tr>
        `;
        }).join('');
    }

    function renderAtenciones(rows) {
        const container = byId('dashAtencionesBody');
        if (!container) return;
        if (!rows.length) {
            container.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay atenciones para mostrar.</td></tr>';
            return;
        }

        container.innerHTML = rows.map((row, idx) => {
            const displayIndex = (row && (row.index !== undefined && row.index !== null)) ? row.index : (idx + 1);
            return `
            <tr>
                <td><span class="record-id">#${displayIndex}</span></td>
                <td>${escapeHtml(row.cliente)}</td>
                <td>${escapeHtml(row.mesa)}</td>
                <td>${escapeHtml(row.mozo)}</td>
                <td>${renderBadge(row.estado)}</td>
                <td>${renderBadge(row.pago, true)}</td>
            </tr>
        `;
        }).join('');
    }

    function renderBadge(value, isPago = false) {
        const raw = String(value || '').replace(/_/g, ' ').toLowerCase();
        let klass = 'bp-secondary';
        if (isPago) {
            if (raw.includes('pag')) klass = 'bp-success';
            else if (raw.includes('pend')) klass = 'bp-warning';
            else if (raw.includes('cancel')) klass = 'bp-danger';
        } else {
            if (raw.includes('en curso')) klass = 'bp-info';
            else if (raw.includes('confirmada') || raw.includes('pagada')) klass = 'bp-success';
            else if (raw.includes('pend')) klass = 'bp-warning';
            else if (raw.includes('cerr')) klass = 'bp-gray';
            else if (raw.includes('cancel')) klass = 'bp-danger';
        }
        const label = String(value || '').replace(/_/g, ' ');
        return `<span class="badge-pill ${klass}">${escapeHtml(label)}</span>`;
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDateTime(isoValue) {
        if (!isoValue) return '-';
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) return String(isoValue);
        return date.toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, text) {
        const el = byId(id);
        if (el) el.textContent = text;
    }

    window.Dashboard = { init };
})();
