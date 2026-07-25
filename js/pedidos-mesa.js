/* =====================================================
   RestaControl — Reporte de Consumos por Mesa
   ===================================================== */

(() => {
    const state = {
        page: 1,
        size: 10,
        total: 0,
        rows: [],
        mesas: []
    };

    const API_BASE = window.APP_CONFIG?.API_BASE_URL
        ? String(window.APP_CONFIG.API_BASE_URL).replace(/\/+$/, '')
        : 'http://localhost:7070';

    const API_REPORTE = `${API_BASE}/api/reportes/consumos-mesa`;
    const API_MESAS = `${API_BASE}/api/mesas`;

    async function init() {
        const authenticated = await Auth.requireLogin();

        if (!authenticated) {
            return;
        }

        bindEvents();
        setDefaultDates();

        await loadMesas();
        await loadConsumos();
    }

    function bindEvents() {
        byId('btnBuscarConsumos')
            ?.addEventListener('click', () => {
                state.page = 1;
                loadConsumos();
            });

        byId('btnLimpiarFiltrosConsumos')
            ?.addEventListener('click', limpiarFiltros);

        byId('btnExportarConsumos')
            ?.addEventListener('click', exportarExcel);

        byId('btnPrevConsumos')
            ?.addEventListener('click', event => {
                event.preventDefault();

                if (state.page <= 1) {
                    return;
                }

                state.page -= 1;
                loadConsumos();
            });

        byId('btnNextConsumos')
            ?.addEventListener('click', event => {
                event.preventDefault();

                if (state.page >= getTotalPages()) {
                    return;
                }

                state.page += 1;
                loadConsumos();
            });

        byId('busquedaConsumos')
            ?.addEventListener('keydown', event => {
                if (event.key !== 'Enter') {
                    return;
                }

                event.preventDefault();
                state.page = 1;
                loadConsumos();
            });

        byId('consumosMesaBody')
            ?.addEventListener('click', event => {
                const button = event.target.closest(
                    '[data-action="view"][data-id]'
                );

                if (!button) {
                    return;
                }

                openDetalle(button.dataset.id);
            });
    }

    function setDefaultDates() {
        const hasta = new Date();
        const desde = new Date();

        desde.setDate(hasta.getDate() - 7);

        setValue(
            'filtroFechaDesde',
            formatDateInput(desde)
        );

        setValue(
            'filtroFechaHasta',
            formatDateInput(hasta)
        );
    }

    async function loadMesas() {
        try {
            const response = await fetch(
                `${API_MESAS}?activo=true&page=1&size=200`,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {
                await handleHttpError(
                    response,
                    payload,
                    'No se pudieron cargar las mesas.'
                );
            }

            state.mesas = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];

            renderMesaOptions();
        } catch (error) {
            console.error('Error cargando mesas:', error);
            state.mesas = [];
            renderMesaOptions();
        }
    }

    function renderMesaOptions() {
        const select = byId('filtroMesaConsumo');

        if (!select) {
            return;
        }

        const options = state.mesas.map(mesa => `
            <option value="${escapeHtmlAttr(mesa.id)}">
                ${escapeHtml(mesa.codigo || 'Mesa')}
            </option>
        `).join('');

        select.innerHTML = `
            <option value="">Todas las mesas</option>
            ${options}
        `;
    }

    function buildParams(includePagination = true) {
        const params = new URLSearchParams();

        const fechaDesde = getValue('filtroFechaDesde');
        const fechaHasta = getValue('filtroFechaHasta');
        const idMesa = getValue('filtroMesaConsumo');
        const estado = getValue('filtroEstadoConsumo');
        const search = getValue('busquedaConsumos');

        if (fechaDesde) {
            params.set('fechaDesde', fechaDesde);
        }

        if (fechaHasta) {
            params.set('fechaHasta', fechaHasta);
        }

        if (idMesa) {
            params.set('idMesa', idMesa);
        }

        if (estado) {
            params.set('estado', estado);
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

    async function loadConsumos() {
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
                    'No se pudo cargar el reporte de consumos.'
                );
            }

            state.rows = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];

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
                'Error cargando consumos por mesa:',
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

    function renderTable() {
        const tbody = byId('consumosMesaBody');

        if (!tbody) {
            return;
        }

        if (!state.rows.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11"
                        class="text-center text-muted py-4">
                        No existen consumos para los filtros seleccionados.
                    </td>
                </tr>
            `;

            setText(
                'consumosMesaCount',
                'Mostrando 0 registros'
            );

            return;
        }

        tbody.innerHTML = state.rows.map(row => `
            <tr>
                <td>
                    ${escapeHtml(
                        formatDateTime(
                            row.fechaCierre ||
                            row.fechaApertura
                        )
                    )}
                </td>

                <td>
                    <span class="record-id">
                        ${escapeHtml(
                            row.codigoAtencion ||
                            row.idAtencion ||
                            '-'
                        )}
                    </span>
                </td>

                <td>
                    ${escapeHtml(row.mesaCodigo || '-')}
                </td>

                <td>
                    ${escapeHtml(row.clienteNombre || '-')}
                </td>

                <td>
                    ${escapeHtml(row.mozoNombre || '-')}
                </td>

                <td class="text-center">
                    ${Number(row.cantidadItems || 0)}
                </td>

                <td class="text-end">
                    ${money(row.subtotal)}
                </td>

                <td class="text-end">
                    ${money(row.propina)}
                </td>

                <td class="text-end fw-semibold">
                    ${money(row.total)}
                </td>

                <td>
                    ${renderEstadoBadge(
                        row.estadoPago ||
                        row.estadoAtencion
                    )}
                </td>

                <td class="text-end">
                    <button
                        type="button"
                        class="btn-tbl"
                        title="Ver detalle"
                        data-action="view"
                        data-id="${escapeHtmlAttr(row.idAtencion)}">

                        <i class="bi bi-eye text-info"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        setText(
            'consumosMesaCount',
            `Mostrando ${state.rows.length} de ${state.total} registros`
        );
    }

    function renderSummary(summary) {
        const atenciones = Number(
            summary.atenciones ?? state.total ?? 0
        );

        const totalConsumido = Number(
            summary.totalConsumido ?? 0
        );

        const ticketPromedio = Number(
            summary.ticketPromedio ??
            (
                atenciones > 0
                    ? totalConsumido / atenciones
                    : 0
            )
        );

        setText(
            'kpiAtenciones',
            String(atenciones)
        );

        setText(
            'kpiTotalConsumido',
            money(totalConsumido)
        );

        setText(
            'kpiTicketPromedio',
            money(ticketPromedio)
        );

        setText(
            'kpiMesaMayorConsumo',
            summary.mesaMayorConsumo || '-'
        );

        setText(
            'kpiMesaMayorConsumoMonto',
            summary.mesaMayorConsumo
                ? money(summary.mesaMayorConsumoMonto)
                : 'Sin datos'
        );
    }

    async function openDetalle(idAtencion) {
        if (!idAtencion) {
            return;
        }

        try {
            const response = await fetch(
                `${API_REPORTE}/${encodeURIComponent(idAtencion)}`,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {
                await handleHttpError(
                    response,
                    payload,
                    'No se pudo obtener el detalle del consumo.'
                );
            }

            const data = payload?.data || payload;

            renderDetalleModal(data);
        } catch (error) {
            window.alert(
                error.message ||
                'No se pudo abrir el detalle.'
            );
        }
    }

    function renderDetalleModal(data) {
        setText(
            'modalConsumoTitulo',
            data.codigoAtencion ||
            data.idAtencion ||
            '-'
        );

        setHtml(
            'modalConsumoEstadoBadge',
            renderEstadoBadge(
                data.estadoPago ||
                data.estadoAtencion
            )
        );

        setHtml(
            'modalConsumoAtencionInfo',
            `
                <div class="detail-row">
                    <span class="detail-lbl">Mesa</span>
                    <span class="detail-val">
                        ${escapeHtml(data.mesaCodigo || '-')}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-lbl">Mozo</span>
                    <span class="detail-val">
                        ${escapeHtml(data.mozoNombre || '-')}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-lbl">Apertura</span>
                    <span class="detail-val">
                        ${escapeHtml(formatDateTime(data.fechaApertura))}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-lbl">Cierre</span>
                    <span class="detail-val">
                        ${escapeHtml(formatDateTime(data.fechaCierre))}
                    </span>
                </div>
            `
        );

        setHtml(
            'modalConsumoClienteInfo',
            `
                <div class="detail-row">
                    <span class="detail-lbl">Nombre</span>
                    <span class="detail-val">
                        ${escapeHtml(data.clienteNombre || '-')}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-lbl">Documento</span>
                    <span class="detail-val">
                        ${escapeHtml(data.clienteDocumento || '-')}
                    </span>
                </div>
            `
        );

        setHtml(
            'modalConsumoTotales',
            `
                <div class="detail-row">
                    <span class="detail-lbl">Subtotal</span>
                    <span class="detail-val">
                        ${money(data.subtotal)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-lbl">Propina</span>
                    <span class="detail-val">
                        ${money(data.propina)}
                    </span>
                </div>

                <div class="detail-row">
                    <span class="detail-lbl">Total</span>
                    <span class="detail-val fw-bold">
                        ${money(data.total)}
                    </span>
                </div>
            `
        );

        const items = Array.isArray(data.items)
            ? data.items
            : [];

        const tbody = byId('modalConsumoDetalleBody');

        if (tbody) {
            tbody.innerHTML = items.length
                ? items.map(item => `
                    <tr>
                        <td>
                            ${escapeHtml(item.nombreItem || '-')}
                        </td>

                        <td>
                            ${escapeHtml(item.tipoItem || '-')}
                        </td>

                        <td class="text-center">
                            ${Number(item.cantidad || 0)}
                        </td>

                        <td class="text-end">
                            ${money(item.precioUnitario)}
                        </td>

                        <td class="text-end">
                            ${money(item.descuento)}
                        </td>

                        <td class="text-end fw-semibold">
                            ${money(item.subtotal)}
                        </td>
                    </tr>
                `).join('')
                : `
                    <tr>
                        <td colspan="6"
                            class="text-center text-muted py-4">
                            No hay productos registrados.
                        </td>
                    </tr>
                `;
        }

        setText(
            'modalConsumoTotal',
            money(data.total)
        );

        setText(
            'modalConsumoObservaciones',
            data.observaciones ||
            'Sin observaciones.'
        );

        const modal = byId('modalConsumoMesa');

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
            anchor.download = 'consumos_por_mesa.xlsx';

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
        setDefaultDates();
        setValue('filtroMesaConsumo', '');
        setValue('filtroEstadoConsumo', '');
        setValue('busquedaConsumos', '');

        state.page = 1;
        loadConsumos();
    }

    function renderPagination() {
        const totalPages = getTotalPages();
        const currentPage = totalPages === 0
            ? 0
            : state.page;

        setText(
            'lblPaginaConsumos',
            totalPages === 0
                ? '-'
                : `${currentPage} / ${totalPages}`
        );

        byId('liPrevConsumos')
            ?.classList.toggle(
                'disabled',
                currentPage <= 1
            );

        byId('liNextConsumos')
            ?.classList.toggle(
                'disabled',
                totalPages === 0 ||
                currentPage >= totalPages
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

    function setLoading() {
        const tbody = byId('consumosMesaBody');

        if (!tbody) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="11"
                    class="text-center text-muted py-4">

                    <span class="spinner-border spinner-border-sm me-2">
                    </span>

                    Cargando consumos...
                </td>
            </tr>
        `;
    }

    function showTableError(message) {
        const tbody = byId('consumosMesaBody');

        if (!tbody) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td colspan="11"
                    class="text-center text-danger py-4">

                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;

        setText(
            'consumosMesaCount',
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

    async function safeJson(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    function renderEstadoBadge(value) {
        const estado = String(value || '')
            .trim()
            .toLowerCase();

        if (
            estado.includes('pagad') ||
            estado.includes('cerrad')
        ) {
            return `
                <span class="badge-pill bp-success">
                    Pagada
                </span>
            `;
        }

        if (estado.includes('cancel')) {
            return `
                <span class="badge-pill bp-danger">
                    Cancelada
                </span>
            `;
        }

        return `
            <span class="badge-pill bp-warning">
                En curso
            </span>
        `;
    }

    function formatDateInput(date) {
        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, '0');
        const day = String(
            date.getDate()
        ).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    function formatDateTime(value) {
        if (!value) {
            return '-';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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

    window.ReporteConsumosMesa = {
        init
    };
})();