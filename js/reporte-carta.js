/* =====================================================
   RestaControl — Reporte de Carta
   Platos y productos
   ===================================================== */

(() => {
    const state = {
        page: 1,
        size: 10,
        total: 0,
        rows: [],
        categorias: []
    };

    const API_BASE = window.APP_CONFIG?.API_BASE_URL
        ? String(window.APP_CONFIG.API_BASE_URL).replace(/\/+$/, '')
        : 'http://localhost:7070';

    const API_REPORTE = `${API_BASE}/api/reportes/carta`;
    const API_CATEGORIAS = `${API_BASE}/api/categorias`;

    async function init() {
        const authenticated = await Auth.requireLogin();

        if (!authenticated) {
            return;
        }

        bindEvents();

        await loadCategorias();
        await loadCarta();
    }

    function bindEvents() {
        byId('btnBuscarCarta')
            ?.addEventListener('click', () => {
                state.page = 1;
                loadCarta();
            });

        byId('btnLimpiarCarta')
            ?.addEventListener('click', limpiarFiltros);

        byId('btnExportarCarta')
            ?.addEventListener('click', exportarExcel);

        byId('btnPrevCarta')
            ?.addEventListener('click', event => {
                event.preventDefault();

                if (state.page <= 1) {
                    return;
                }

                state.page -= 1;
                loadCarta();
            });

        byId('btnNextCarta')
            ?.addEventListener('click', event => {
                event.preventDefault();

                if (state.page >= getTotalPages()) {
                    return;
                }

                state.page += 1;
                loadCarta();
            });

        byId('busquedaCarta')
            ?.addEventListener('keydown', event => {
                if (event.key !== 'Enter') {
                    return;
                }

                event.preventDefault();

                state.page = 1;
                loadCarta();
            });

        byId('reporteCartaBody')
            ?.addEventListener('click', event => {
                const button = event.target.closest(
                    '[data-action="view"][data-id][data-tipo]'
                );

                if (!button) {
                    return;
                }

                openDetalle(
                    button.dataset.tipo,
                    button.dataset.id
                );
            });
    }

    async function loadCategorias() {
        try {
            const response = await fetch(
                `${API_CATEGORIAS}?activo=true&page=1&size=200`,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {
                await handleHttpError(
                    response,
                    payload,
                    'No se pudieron cargar las categorías.'
                );
            }

            state.categorias = extractArray(payload);

            renderCategorias();
        } catch (error) {
            console.error(
                'Error cargando categorías:',
                error
            );

            state.categorias = [];
            renderCategorias();
        }
    }

    function renderCategorias() {
        const select = byId('filtroCartaCategoria');

        if (!select) {
            return;
        }

        const options = state.categorias
            .map(categoria => `
                <option value="${escapeHtmlAttr(categoria.id)}">
                    ${escapeHtml(categoria.nombre || categoria.name || 'Categoría')}
                </option>
            `)
            .join('');

        select.innerHTML = `
            <option value="">Todas</option>
            ${options}
        `;
    }

    function buildParams(includePagination = true) {
        const params = new URLSearchParams();

        const tipo = getValue('filtroCartaTipo');
        const idCategoria = getValue('filtroCartaCategoria');
        const estado = getValue('filtroCartaEstado');
        const disponibilidad = getValue(
            'filtroCartaDisponibilidad'
        );
        const search = getValue('busquedaCarta');

        if (tipo) {
            params.set('tipo', tipo);
        }

        if (idCategoria) {
            params.set('idCategoria', idCategoria);
        }

        if (estado) {
            params.set('estado', estado);
        }

        if (disponibilidad) {
            params.set(
                'disponibilidad',
                disponibilidad
            );
        }

        if (search) {
            params.set('search', search);
        }

        if (includePagination) {
            params.set('page', String(state.page));
            params.set('size', String(state.size));
        }

        return params;
    }

    async function loadCarta() {
        setLoading();

        try {
            const params = buildParams();

            const response = await fetch(
                `${API_REPORTE}?${params.toString()}`,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {
                await handleHttpError(
                    response,
                    payload,
                    'No se pudo cargar el reporte de carta.'
                );
            }

            state.rows = extractArray(payload).map(
                normalizeCartaItem
            );

            state.total = Number(
                payload?.total ?? state.rows.length
            );

            if (Number(payload?.page) > 0) {
                state.page = Number(payload.page);
            }

            if (Number(payload?.size) > 0) {
                state.size = Number(payload.size);
            }

            renderTable();
            renderSummary(payload?.summary || {});
            renderPagination();
        } catch (error) {
            console.error(
                'Error cargando reporte de carta:',
                error
            );

            state.rows = [];
            state.total = 0;

            showTableError(
                error.message ||
                'No se pudo cargar el reporte.'
            );

            renderSummary({});
            renderPagination();
        }
    }

    function normalizeCartaItem(raw) {
        const tipo = normalizeTipo(
            raw.tipo ||
            raw.tipoItem ||
            raw.tipo_item
        );

        const stockValue =
            raw.stockActual ??
            raw.stock ??
            raw.cantidadStock ??
            null;

        return {
            id: raw.id || raw.idItem || '',
            tipo,
            codigo:
                raw.codigo ||
                raw.code ||
                '-',
            nombre:
                raw.nombre ||
                raw.name ||
                'Sin nombre',
            categoria:
                raw.categoriaNombre ||
                raw.categoria ||
                raw.nombreCategoria ||
                'Sin categoría',
            precio: Number(
                raw.precioVenta ??
                raw.precio ??
                raw.price ??
                0
            ),
            stock:
                stockValue === null
                    ? null
                    : Number(stockValue),
            unidad:
                raw.unidadMedida ||
                raw.unidad ||
                raw.unidadNombre ||
                '-',
            disponible: normalizeBoolean(
                raw.disponible ??
                raw.conStock ??
                raw.availability
            ),
            activo: normalizeBoolean(
                raw.activo ??
                raw.active
            ),
            descripcion:
                raw.descripcion ||
                raw.description ||
                ''
        };
    }

    function renderTable() {
        const tbody = byId('reporteCartaBody');

        if (!tbody) {
            return;
        }

        if (!state.rows.length) {
            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="9"
                        class="text-center text-muted py-4">

                        No existen registros para los filtros seleccionados.

                    </td>
                </tr>
            `;

            setText(
                'reporteCartaCount',
                'Mostrando 0 registros'
            );

            return;
        }

        tbody.innerHTML = state.rows
            .map(row => `
                <tr>

                    <td>
                        ${tipoBadge(row.tipo)}
                    </td>

                    <td>
                        <span class="record-id">
                            ${escapeHtml(row.codigo)}
                        </span>
                    </td>

                    <td>
                        <div class="fw-semibold">
                            ${escapeHtml(row.nombre)}
                        </div>
                    </td>

                    <td>
                        ${escapeHtml(row.categoria)}
                    </td>

                    <td class="text-end fw-semibold">
                        ${money(row.precio)}
                    </td>

                    <td class="text-center">
                        ${renderStock(row)}
                    </td>

                    <td>
                        ${disponibilidadBadge(row.disponible)}
                    </td>

                    <td>
                        ${estadoBadge(row.activo)}
                    </td>

                    <td class="text-end">

                        <button
                            type="button"
                            class="btn-tbl"
                            title="Ver detalle"
                            data-action="view"
                            data-tipo="${escapeHtmlAttr(row.tipo)}"
                            data-id="${escapeHtmlAttr(row.id)}">

                            <i class="bi bi-eye text-info"></i>

                        </button>

                    </td>

                </tr>
            `)
            .join('');

        setText(
            'reporteCartaCount',
            `Mostrando ${state.rows.length} de ${state.total} registros`
        );
    }

    function renderSummary(summary) {
        const total = Number(
            summary.total ??
            summary.totalCarta ??
            state.total ??
            0
        );

        const platos = Number(
            summary.platos ??
            state.rows.filter(
                item => item.tipo === 'plato'
            ).length
        );

        const productos = Number(
            summary.productos ??
            state.rows.filter(
                item => item.tipo === 'producto'
            ).length
        );

        const disponibles = Number(
            summary.disponibles ??
            state.rows.filter(
                item => item.disponible && item.activo
            ).length
        );

        setText('kpiCartaTotal', String(total));
        setText('kpiCartaPlatos', String(platos));
        setText('kpiCartaProductos', String(productos));
        setText('kpiCartaDisponibles', String(disponibles));
    }

    async function openDetalle(tipo, id) {
        if (!tipo || !id) {
            return;
        }

        try {
            const response = await fetch(
                `${API_REPORTE}/${encodeURIComponent(tipo)}/${encodeURIComponent(id)}`,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {
                await handleHttpError(
                    response,
                    payload,
                    'No se pudo obtener el detalle.'
                );
            }

            const data = normalizeCartaItem(
                payload?.data || payload
            );

            renderDetalle(data);
        } catch (error) {
            window.alert(
                error.message ||
                'No se pudo abrir el detalle.'
            );
        }
    }

    function renderDetalle(data) {
        setText(
            'modalCartaTipo',
            data.tipo === 'plato'
                ? 'Plato'
                : 'Producto'
        );

        setText('modalCartaNombre', data.nombre);
        setText('modalCartaCodigo', data.codigo);
        setText('modalCartaCategoria', data.categoria);
        setText('modalCartaPrecio', money(data.precio));

        setText(
            'modalCartaStock',
            data.stock === null
                ? 'No aplica'
                : `${data.stock}`
        );

        setText('modalCartaUnidad', data.unidad);

        setText(
            'modalCartaDisponibilidad',
            data.disponible
                ? 'Disponible'
                : 'No disponible'
        );

        setText(
            'modalCartaDescripcion',
            data.descripcion ||
            'Sin descripción.'
        );

        setHtml(
            'modalCartaEstado',
            estadoBadge(data.activo)
        );

        setHtml(
            'modalCartaIcon',
            data.tipo === 'plato'
                ? '<i class="bi bi-egg-fried"></i>'
                : '<i class="bi bi-box-seam"></i>'
        );

        const modal = byId('modalCartaDetalle');

        if (
            modal &&
            typeof bootstrap !== 'undefined'
        ) {
            bootstrap.Modal
                .getOrCreateInstance(modal)
                .show();
        }
    }

    async function exportarExcel() {
        const params = buildParams(false);

        try {
            const response = await fetch(
                `${API_REPORTE}/exportar-excel?${params.toString()}`,
                {
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                const payload = await safeJson(response);

                await handleHttpError(
                    response,
                    payload,
                    'No se pudo exportar el reporte.'
                );
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = 'reporte_carta.xlsx';

            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();

            URL.revokeObjectURL(url);
        } catch (error) {
            window.alert(
                error.message ||
                'No se pudo exportar el reporte.'
            );
        }
    }

    function limpiarFiltros() {
        setValue('filtroCartaTipo', '');
        setValue('filtroCartaCategoria', '');
        setValue('filtroCartaEstado', '');
        setValue('filtroCartaDisponibilidad', '');
        setValue('busquedaCarta', '');

        state.page = 1;

        loadCarta();
    }

    function renderPagination() {
        const totalPages = getTotalPages();

        setText(
            'lblPaginaCarta',
            totalPages === 0
                ? '-'
                : `${state.page} / ${totalPages}`
        );

        byId('liPrevCarta')
            ?.classList.toggle(
                'disabled',
                state.page <= 1
            );

        byId('liNextCarta')
            ?.classList.toggle(
                'disabled',
                totalPages === 0 ||
                state.page >= totalPages
            );
    }

    function getTotalPages() {
        if (!state.total || !state.size) {
            return 0;
        }

        return Math.ceil(
            state.total / state.size
        );
    }

    function renderStock(row) {
        if (row.tipo === 'plato' && row.stock === null) {
            return `
                <span class="text-muted">
                    No aplica
                </span>
            `;
        }

        const cssClass = Number(row.stock) > 0
            ? 'text-success'
            : 'text-danger';

        return `
            <span class="fw-semibold ${cssClass}">
                ${Number(row.stock || 0)}
            </span>
        `;
    }

    function tipoBadge(tipo) {
        if (tipo === 'plato') {
            return `
                <span class="badge-pill carta-badge-plato">
                    <i class="bi bi-egg-fried"></i>
                    Plato
                </span>
            `;
        }

        return `
            <span class="badge-pill carta-badge-producto">
                <i class="bi bi-box-seam"></i>
                Producto
            </span>
        `;
    }

    function disponibilidadBadge(disponible) {
        if (disponible) {
            return `
                <span class="badge-pill bp-success">
                    Disponible
                </span>
            `;
        }

        return `
            <span class="badge-pill bp-danger">
                No disponible
            </span>
        `;
    }

    function estadoBadge(activo) {
        if (activo) {
            return `
                <span class="badge-pill bp-info">
                    Activo
                </span>
            `;
        }

        return `
            <span class="badge-pill bp-gray">
                Inactivo
            </span>
        `;
    }

    function setLoading() {
        const tbody = byId('reporteCartaBody');

        if (!tbody) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="text-center text-muted py-4">

                    <span
                        class="spinner-border spinner-border-sm me-2">
                    </span>

                    Cargando carta...

                </td>
            </tr>
        `;
    }

    function showTableError(message) {
        const tbody = byId('reporteCartaBody');

        if (!tbody) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="text-center text-danger py-4">

                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    ${escapeHtml(message)}

                </td>
            </tr>
        `;

        setText(
            'reporteCartaCount',
            'No se pudo cargar el reporte'
        );
    }

    async function handleHttpError(
        response,
        payload,
        defaultMessage
    ) {
        if (response.status === 401) {
            setTimeout(
                () => Auth.logout(),
                700
            );

            throw new Error(
                'Tu sesión ha expirado.'
            );
        }

        if (response.status === 403) {
            throw new Error(
                payload?.message ||
                'No tienes permisos para consultar este reporte.'
            );
        }

        throw new Error(
            payload?.message ||
            defaultMessage
        );
    }

    function extractArray(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (Array.isArray(payload?.data)) {
            return payload.data;
        }

        if (Array.isArray(payload?.content)) {
            return payload.content;
        }

        if (Array.isArray(payload?.data?.content)) {
            return payload.data.content;
        }

        return [];
    }

    async function safeJson(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    function normalizeTipo(value) {
        const tipo = String(value || '')
            .trim()
            .toLowerCase();

        return tipo.includes('producto')
            ? 'producto'
            : 'plato';
    }

    function normalizeBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }

        const normalized = String(value || '')
            .trim()
            .toLowerCase();

        return [
            'true',
            '1',
            'si',
            'sí',
            'activo',
            'disponible'
        ].includes(normalized);
    }

    function money(value) {
        return `S/ ${Number(value || 0).toFixed(2)}`;
    }

    function getValue(id) {
        return String(
            byId(id)?.value || ''
        ).trim();
    }

    function setValue(id, value) {
        const element = byId(id);

        if (element) {
            element.value = value;
        }
    }

    function setText(id, value) {
        const element = byId(id);

        if (element) {
            element.textContent = value;
        }
    }

    function setHtml(id, value) {
        const element = byId(id);

        if (element) {
            element.innerHTML = value;
        }
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeHtmlAttr(value) {
        return escapeHtml(value)
            .replace(/`/g, '&#096;');
    }

    window.ReporteCarta = {
        init
    };
})();