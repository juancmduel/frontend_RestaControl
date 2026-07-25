/* =====================================================
   RestaControl — Productos Page Logic (API)
   Productos sin preparación en cocina
   ===================================================== */

(() => {

    const state = {
        search: '',
        filtroEstado: '',
        page: 1,
        size: 10,
        total: 0,
        productos: [],
        unidades: []
    };

    const API_BASE =
        window.APP_CONFIG?.API_BASE_URL ||
        'http://localhost:7070';

    const API_PROD = `${API_BASE}/api/productos`;
    const API_UNIDADES = `${API_PROD}/unidades`;

    document.addEventListener('DOMContentLoaded', init);

    async function init() {

        const authenticated = await Auth.requireLogin();

        if (!authenticated) {
            return;
        }

        bindEvents();

        await loadUnidades();
        await loadProductos();
    }

    /* =====================================================
       EVENTOS
       ===================================================== */

    function bindEvents() {

        byId('busquedaProductos')
            ?.addEventListener('input', (event) => {

                state.search =
                    String(event.target.value || '').trim();

                state.page = 1;

                loadProductos();
            });

        byId('filtroEstadoProducto')
            ?.addEventListener('change', (event) => {

                state.filtroEstado =
                    String(event.target.value || '');

                state.page = 1;

                loadProductos();
            });

        byId('btnActualizarProductos')
            ?.addEventListener(
                'click',
                () => loadProductos()
            );

        byId('btnNuevoProducto')
            ?.addEventListener(
                'click',
                () => openForm()
            );

        byId('btnGuardarProducto')
            ?.addEventListener(
                'click',
                onGuardarProducto
            );

        byId('btnConfirmarStock')
            ?.addEventListener(
                'click',
                onConfirmarStock
            );

        byId('btnPrevProductos')
            ?.addEventListener('click', (event) => {

                event.preventDefault();

                if (
                    state.page <= 1 ||
                    getTotalPages() === 0
                ) {
                    return;
                }

                state.page -= 1;

                loadProductos();
            });

        byId('btnNextProductos')
            ?.addEventListener('click', (event) => {

                event.preventDefault();

                if (
                    state.page >= getTotalPages() ||
                    getTotalPages() === 0
                ) {
                    return;
                }

                state.page += 1;

                loadProductos();
            });

        byId('productosTableBody')
            ?.addEventListener(
                'click',
                async (event) => {

                    const button =
                        event.target.closest('[data-action]');

                    if (!button) {
                        return;
                    }

                    const id =
                        String(button.dataset.id || '').trim();

                    const action =
                        String(button.dataset.action || '').trim();

                    if (!id || !action) {
                        return;
                    }

                    if (action === 'editar') {
                        await openForm(id);
                    }

                    if (action === 'stock') {
                        await openStock(id);
                    }

                    if (action === 'toggle') {
                        await toggleActivo(
                            id,
                            button.dataset.activo === 'true'
                        );
                    }
                }
            );
    }

    /* =====================================================
       UNIDADES
       ===================================================== */

    async function loadUnidades() {

        const select = byId('productoUnidad');

        try {

            const response = await fetch(
                API_UNIDADES,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {

                await handleHttpError(
                    response,
                    payload,
                    'No se pudo cargar unidades.'
                );

                return;
            }

            const raw = Array.isArray(payload)
                ? payload
                : (
                    Array.isArray(payload?.data)
                        ? payload.data
                        : []
                );

            const normalized = raw
                .map(normalizeUnidad)
                .filter(
                    (item) =>
                        item &&
                        item.value
                );

            if (!normalized.length) {
                throw new Error(
                    'No se recibieron unidades.'
                );
            }

            state.unidades = normalized;

            if (select) {

                select.innerHTML =
                    state.unidades
                        .map(
                            (unidad) => `
                                <option value="${escapeHtmlAttr(unidad.value)}">
                                    ${escapeHtml(unidad.label)}
                                </option>
                            `
                        )
                        .join('');
            }

        } catch (error) {

            /*
             * Si el endpoint no responde,
             * conserva las opciones del HTML.
             */

            if (!select) {
                return;
            }

            state.unidades =
                Array.from(select.options)
                    .map((option) => ({
                        value:
                            String(option.value || '').trim(),

                        label:
                            String(
                                option.textContent || ''
                            ).trim()
                            ||
                            String(
                                option.value || ''
                            ).trim()
                    }))
                    .filter(
                        (unidad) => unidad.value
                    );

            console.warn(
                'No se cargaron las unidades desde la API:',
                error
            );
        }
    }

    function normalizeUnidad(item) {

        if (!item && item !== 0) {
            return null;
        }

        if (typeof item === 'string') {

            const value = item.trim();

            if (!value) {
                return null;
            }

            return {
                value,
                label: value
            };
        }

        if (typeof item !== 'object') {
            return null;
        }

        const value =
            String(
                item.value ??
                item.codigo ??
                item.id ??
                ''
            ).trim();

        const label =
            String(
                item.label ??
                item.nombre ??
                item.descripcion ??
                value
            ).trim();

        if (!value) {
            return null;
        }

        return {
            value,
            label: label || value
        };
    }

    /* =====================================================
       LISTAR PRODUCTOS
       ===================================================== */

    async function loadProductos() {

        const params = new URLSearchParams({
            page: String(state.page),
            size: String(state.size)
        });

        if (state.search) {
            params.set('search', state.search);
        }

        if (state.filtroEstado === 'activo') {
            params.set('activo', 'true');
        }

        if (state.filtroEstado === 'inactivo') {
            params.set('activo', 'false');
        }

        setTableLoading(true);

        try {

            const response = await fetch(
                `${API_PROD}?${params.toString()}`,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {

                await handleHttpError(
                    response,
                    payload,
                    'No se pudo listar productos.'
                );

                return;
            }

            const data = Array.isArray(payload)
                ? payload
                : (
                    Array.isArray(payload?.data)
                        ? payload.data
                        : []
                );

            state.productos =
                state.filtroEstado === 'sinstock'
                    ? data.filter(
                        (producto) =>
                            Number(producto.stock || 0) === 0
                    )
                    : data;

            state.total =
                state.filtroEstado === 'sinstock'
                    ? state.productos.length
                    : Number(
                        payload?.total ??
                        state.productos.length
                    );

            if (
                typeof payload?.size === 'number' &&
                payload.size > 0
            ) {
                state.size = payload.size;
            }

            if (typeof payload?.page === 'number') {

                state.page =
                    payload.page <= 0
                        ? 1
                        : payload.page;
            }

            renderKPIs(state.productos);
            renderTable();

        } catch (error) {

            state.productos = [];
            state.total = 0;

            renderKPIs([]);
            renderTable();

            showToast(
                error.message ||
                'Error cargando productos.',
                'danger'
            );

        } finally {

            setTableLoading(false);
        }
    }

    /* =====================================================
       INDICADORES
       ===================================================== */

    function renderKPIs(items) {

        setText(
            'kpiTotalProductos',
            String(items.length)
        );

        setText(
            'kpiDisponibles',
            String(
                items.filter(
                    (producto) =>
                        toBool(producto.activo) &&
                        Number(producto.stock || 0) > 0
                ).length
            )
        );

        setText(
            'kpiStockBajo',
            String(
                items.filter(
                    (producto) => {

                        const stock =
                            Number(producto.stock || 0);

                        return (
                            toBool(producto.activo) &&
                            stock > 0 &&
                            stock <= 5
                        );
                    }
                ).length
            )
        );

        setText(
            'kpiSinStock',
            String(
                items.filter(
                    (producto) =>
                        Number(producto.stock || 0) === 0
                ).length
            )
        );
    }

    /* =====================================================
       TABLA
       ===================================================== */

    function renderTable() {

        const tbody = byId('productosTableBody');

        if (!tbody) {
            return;
        }

        if (!state.productos.length) {

            tbody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="text-center text-muted py-4"
                    >
                        No hay productos para mostrar.
                    </td>
                </tr>
            `;

            setText(
                'productosCount',
                'Mostrando 0 productos'
            );

            renderPagination();

            return;
        }

        tbody.innerHTML =
            state.productos
                .map((producto, index) => {

                    const rowNum =
                        (
                            (state.page - 1) *
                            state.size
                        )
                        +
                        index
                        +
                        1;

                    const stock =
                        Number(producto.stock || 0);

                    const activo =
                        toBool(producto.activo);

                    const stockBadge =
                        stock === 0
                            ? `
                                <span class="badge bg-danger">
                                    ${stock}
                                </span>
                            `
                            : stock <= 5
                                ? `
                                    <span class="badge bg-warning text-dark">
                                        ${stock}
                                    </span>
                                `
                                : `
                                    <span class="badge bg-success">
                                        ${stock}
                                    </span>
                                `;

                    const estadoBadge =
                        activo
                            ? `
                                <span class="badge-pill bp-success">
                                    Activo
                                </span>
                            `
                            : `
                                <span class="badge-pill bp-gray">
                                    Inactivo
                                </span>
                            `;

                    return `
                        <tr>

                            <td>
                                <span class="record-id">
                                    #${rowNum}
                                </span>
                            </td>

                            <td>
                                <div class="fw-semibold">
                                    ${escapeHtml(
                                        producto.nombre || '-'
                                    )}
                                </div>
                            </td>

                            <td>
                                <small class="text-muted">
                                    ${escapeHtml(
                                        producto.descripcion || '-'
                                    )}
                                </small>
                            </td>

                            <td class="fw-semibold">
                                S/ ${Number(
                                    producto.precio || 0
                                ).toFixed(2)}
                            </td>

                            <td class="text-center">
                                ${stockBadge}
                            </td>

                            <td>
                                <span class="badge-pill bp-gray">
                                    ${escapeHtml(
                                        getUnidadLabel(
                                            producto.unidad || 'unidad'
                                        )
                                    )}
                                </span>
                            </td>

                            <td>
                                ${estadoBadge}
                            </td>

                            <td class="text-end">

                                <div
                                    class="d-flex gap-1 justify-content-end"
                                >

                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-secondary"
                                        title="Ajustar stock"
                                        data-action="stock"
                                        data-id="${escapeHtmlAttr(producto.id)}"
                                    >
                                        <i class="bi bi-boxes"></i>
                                    </button>

                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-primary"
                                        title="Editar"
                                        data-action="editar"
                                        data-id="${escapeHtmlAttr(producto.id)}"
                                    >
                                        <i class="bi bi-pencil"></i>
                                    </button>

                                    <button
                                        type="button"
                                        class="btn btn-sm ${
                                            activo
                                                ? 'btn-outline-warning'
                                                : 'btn-outline-success'
                                        }"
                                        title="${
                                            activo
                                                ? 'Desactivar'
                                                : 'Activar'
                                        }"
                                        data-action="toggle"
                                        data-id="${escapeHtmlAttr(producto.id)}"
                                        data-activo="${String(activo)}"
                                    >
                                        <i
                                            class="bi ${
                                                activo
                                                    ? 'bi-pause-circle'
                                                    : 'bi-play-circle'
                                            }"
                                        ></i>
                                    </button>

                                </div>

                            </td>

                        </tr>
                    `;
                })
                .join('');

        setText(
            'productosCount',
            `Mostrando ${state.productos.length} de ${state.total} productos`
        );

        renderPagination();
    }

    /* =====================================================
       PAGINACIÓN
       ===================================================== */

    function renderPagination() {

        const totalPages = getTotalPages();

        const current =
            totalPages === 0
                ? 0
                : state.page;

        setText(
            'lblPaginaProductos',
            totalPages === 0
                ? '-'
                : `${current} / ${totalPages}`
        );

        byId('liPrevProductos')
            ?.classList.toggle(
                'disabled',
                current <= 1
            );

        byId('liNextProductos')
            ?.classList.toggle(
                'disabled',
                totalPages === 0 ||
                current >= totalPages
            );
    }

    function getTotalPages() {

        if (
            !state.total ||
            !state.size ||
            state.total <= 0 ||
            state.size <= 0
        ) {
            return 0;
        }

        return Math.ceil(
            state.total / state.size
        );
    }

    /* =====================================================
       NUEVO / EDITAR
       ===================================================== */

    async function openForm(id = null) {

        byId('formProducto')
            ?.classList.remove('was-validated');

        if (!id) {

            setTextHtml(
                'modalProductoLabel',
                `
                    <i class="bi bi-bag me-2"></i>
                    Nuevo Producto
                `
            );

            setValue('productoId', '');
            setValue('productoNombre', '');
            setValue('productoDescripcion', '');
            setValue('productoPrecio', '');
            setValue('productoStock', '0');
            setValue('productoStockMinimo', '0');

            setValue(
                'productoUnidad',
                state.unidades[0]?.value ||
                'unidad'
            );

            setValue(
                'productoActivo',
                'true'
            );

            showModal('modalProducto');

            return;
        }

        const producto =
            await getProductoById(id);

        if (!producto) {
            return;
        }

        setTextHtml(
            'modalProductoLabel',
            `
                <i class="bi bi-pencil me-2"></i>
                Editar Producto
            `
        );

        setValue(
            'productoId',
            String(producto.id)
        );

        setValue(
            'productoNombre',
            producto.nombre || ''
        );

        setValue(
            'productoDescripcion',
            producto.descripcion || ''
        );

        setValue(
            'productoPrecio',
            String(producto.precio ?? '0')
        );

        setValue(
            'productoStock',
            String(producto.stock ?? '0')
        );

        setValue(
            'productoStockMinimo',
            String(producto.stockMinimo ?? '0')
        );

        setValue(
            'productoUnidad',
            producto.unidad || 'unidad'
        );

        setValue(
            'productoActivo',
            String(toBool(producto.activo))
        );

        showModal('modalProducto');
    }

    async function onGuardarProducto() {

        const form =
            byId('formProducto');

        form?.classList.add('was-validated');

        if (
            form &&
            !form.checkValidity()
        ) {
            return;
        }

        const id =
            String(
                byId('productoId')?.value || ''
            ).trim();

        const nombre =
            String(
                byId('productoNombre')?.value || ''
            ).trim();

        const descripcion =
            String(
                byId('productoDescripcion')?.value || ''
            ).trim();

        const precio =
            Number(
                byId('productoPrecio')?.value || 0
            );

        const stock =
            Number(
                byId('productoStock')?.value || 0
            );

        const stockMinimo =
            Number(
                byId('productoStockMinimo')?.value || 0
            );

        const unidad =
            String(
                byId('productoUnidad')?.value ||
                'unidad'
            ).trim();

        const activo =
            String(
                byId('productoActivo')?.value ||
                'true'
            ) === 'true';

        if (
            !nombre ||
            Number.isNaN(precio) ||
            precio < 0 ||
            Number.isNaN(stock) ||
            stock < 0 ||
            Number.isNaN(stockMinimo) ||
            stockMinimo < 0
        ) {

            showToast(
                'Completa los campos requeridos correctamente.',
                'danger'
            );

            return;
        }

        const body = {
            nombre,
            descripcion,
            precio:
                Math.round(precio * 100) / 100,
            stock:
                Math.floor(stock),
            stockMinimo:
                Math.floor(stockMinimo),
            unidad,
            activo
        };

        const isEdit = Boolean(id);

        const url =
            isEdit
                ? `${API_PROD}/${encodeURIComponent(id)}`
                : API_PROD;

        try {

            setButtonLoading(
                'btnGuardarProducto',
                true,
                'Guardando...'
            );

            const response = await fetch(
                url,
                {
                    method:
                        isEdit
                            ? 'PUT'
                            : 'POST',

                    credentials: 'include',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(body)
                }
            );

            const payload =
                await safeJson(response);

            if (!response.ok) {

                await handleHttpError(
                    response,
                    payload,
                    'No se pudo guardar el producto.'
                );

                return;
            }

            hideModal('modalProducto');

            await loadProductos();

            showToast(
                payload?.message ||
                (
                    isEdit
                        ? 'Producto actualizado.'
                        : 'Producto creado.'
                ),
                'success'
            );

        } catch (error) {

            showToast(
                error.message ||
                'No se pudo guardar el producto.',
                'danger'
            );

        } finally {

            setButtonLoading(
                'btnGuardarProducto',
                false
            );
        }
    }

    /* =====================================================
       STOCK
       ===================================================== */

    async function openStock(id) {

        const producto =
            await getProductoById(id);

        if (!producto) {
            return;
        }

        setValue(
            'stockProductoId',
            String(producto.id)
        );

        setValue(
            'nuevoStock',
            String(producto.stock ?? '0')
        );

        setTextHtml(
            'modalStockTitle',
            `
                <i class="bi bi-boxes me-2"></i>
                Stock: ${escapeHtml(
                    producto.nombre || 'Producto'
                )}
            `
        );

        showModal('modalStock');
    }

    async function onConfirmarStock() {

        const id =
            String(
                byId('stockProductoId')?.value || ''
            ).trim();

        const nuevoStock =
            Number(
                byId('nuevoStock')?.value || -1
            );

        if (
            !id ||
            Number.isNaN(nuevoStock) ||
            nuevoStock < 0
        ) {

            showToast(
                'Stock inválido.',
                'danger'
            );

            return;
        }

        const productoActual =
            await getProductoById(id);

        if (!productoActual) {
            return;
        }

        const body = {
            nombre:
                productoActual.nombre,

            descripcion:
                productoActual.descripcion || '',

            precio:
                Number(
                    productoActual.precio || 0
                ),

            stock:
                Math.floor(nuevoStock),

            stockMinimo:
                Number(
                    productoActual.stockMinimo || 0
                ),

            unidad:
                productoActual.unidad || 'unidad',

            activo:
                toBool(productoActual.activo)
        };

        try {

            setButtonLoading(
                'btnConfirmarStock',
                true,
                'Actualizando...'
            );

            const response = await fetch(
                `${API_PROD}/${encodeURIComponent(id)}`,
                {
                    method: 'PUT',

                    credentials: 'include',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(body)
                }
            );

            const payload =
                await safeJson(response);

            if (!response.ok) {

                await handleHttpError(
                    response,
                    payload,
                    'No se pudo actualizar stock.'
                );

                return;
            }

            hideModal('modalStock');

            await loadProductos();

            showToast(
                payload?.message ||
                'Stock actualizado.',
                'success'
            );

        } catch (error) {

            showToast(
                error.message ||
                'No se pudo actualizar stock.',
                'danger'
            );

        } finally {

            setButtonLoading(
                'btnConfirmarStock',
                false
            );
        }
    }

    /* =====================================================
       ACTIVAR / INACTIVAR
       ===================================================== */

    async function toggleActivo(
        id,
        activoActual
    ) {

        try {

            const response = await fetch(
                `${API_PROD}/${encodeURIComponent(id)}/estado`,
                {
                    method: 'PATCH',

                    credentials: 'include',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({
                            activo: !activoActual
                        })
                }
            );

            const payload =
                await safeJson(response);

            if (!response.ok) {

                await handleHttpError(
                    response,
                    payload,
                    'No se pudo cambiar el estado del producto.'
                );

                return;
            }

            await loadProductos();

            showToast(
                payload?.message ||
                'Estado actualizado.',
                'success'
            );

        } catch (error) {

            showToast(
                error.message ||
                'No se pudo cambiar estado del producto.',
                'danger'
            );
        }
    }

    /* =====================================================
       OBTENER UNO
       ===================================================== */

    async function getProductoById(id) {

        const local =
            state.productos.find(
                (producto) =>
                    String(producto.id) ===
                    String(id)
            );

        if (local) {
            return local;
        }

        try {

            const response = await fetch(
                `${API_PROD}/${encodeURIComponent(id)}`,
                {
                    credentials: 'include'
                }
            );

            const payload =
                await safeJson(response);

            if (!response.ok) {

                await handleHttpError(
                    response,
                    payload,
                    'No se pudo obtener producto.'
                );

                return null;
            }

            return payload?.data || payload;

        } catch (error) {

            showToast(
                error.message ||
                'No se pudo obtener producto.',
                'danger'
            );

            return null;
        }
    }

    /* =====================================================
       MANEJO HTTP
       ===================================================== */

    async function handleHttpError(
        response,
        payload,
        defaultMessage
    ) {

        if (response.status === 401) {

            showToast(
                'Tu sesión ha expirado. Inicia sesión nuevamente.',
                'danger'
            );

            setTimeout(
                () => Auth.logout(),
                700
            );

            throw new Error(
                'Sesión expirada.'
            );
        }

        if (response.status === 403) {

            throw new Error(
                payload?.message ||
                'No tienes permisos para realizar esta operación.'
            );
        }

        throw new Error(
            payload?.message ||
            defaultMessage
        );
    }

    /* =====================================================
       HELPERS DE INTERFAZ
       ===================================================== */

    function setTableLoading(loading) {

        const tbody =
            byId('productosTableBody');

        if (
            !tbody ||
            !loading
        ) {
            return;
        }

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="text-center text-muted py-4"
                >
                    <div
                        class="spinner-border spinner-border-sm me-2"
                        role="status"
                    ></div>

                    Cargando...
                </td>
            </tr>
        `;
    }

    function setButtonLoading(
        id,
        loading,
        loadingText = 'Procesando...'
    ) {

        const button = byId(id);

        if (!button) {
            return;
        }

        if (loading) {

            button.dataset.originalHtml =
                button.innerHTML;

            button.disabled = true;

            button.innerHTML = `
                <span
                    class="spinner-border spinner-border-sm me-1"
                    role="status"
                ></span>

                ${escapeHtml(loadingText)}
            `;

            return;
        }

        button.disabled = false;

        if (button.dataset.originalHtml) {

            button.innerHTML =
                button.dataset.originalHtml;

            delete button.dataset.originalHtml;
        }
    }

    function showToast(
        message,
        variant = 'success'
    ) {

        if (
            typeof bootstrap === 'undefined'
        ) {

            window.alert(message);

            return;
        }

        const container =
            ensureToastContainer();

        const icon =
            variant === 'danger'
                ? 'bi-exclamation-triangle-fill'
                : 'bi-check-circle-fill';

        const wrapper =
            document.createElement('div');

        wrapper.className =
            `toast align-items-center text-bg-${variant} border-0`;

        wrapper.setAttribute(
            'role',
            'alert'
        );

        wrapper.setAttribute(
            'aria-live',
            'assertive'
        );

        wrapper.setAttribute(
            'aria-atomic',
            'true'
        );

        wrapper.innerHTML = `
            <div class="d-flex">

                <div class="toast-body">
                    <i class="bi ${icon} me-2"></i>
                    ${escapeHtml(message)}
                </div>

                <button
                    type="button"
                    class="btn-close btn-close-white me-2 m-auto"
                    data-bs-dismiss="toast"
                    aria-label="Cerrar"
                ></button>

            </div>
        `;

        container.appendChild(wrapper);

        const toast =
            bootstrap.Toast.getOrCreateInstance(
                wrapper,
                {
                    delay: 2600
                }
            );

        toast.show();

        wrapper.addEventListener(
            'hidden.bs.toast',
            () => wrapper.remove()
        );
    }

    function ensureToastContainer() {

        let container =
            byId('productosToastContainer');

        if (container) {
            return container;
        }

        container =
            document.createElement('div');

        container.id =
            'productosToastContainer';

        container.className =
            'toast-container position-fixed top-0 end-0 p-3';

        container.style.zIndex =
            '1100';

        document.body.appendChild(
            container
        );

        return container;
    }

    async function safeJson(response) {

        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    function toBool(value) {

        if (
            typeof value === 'boolean'
        ) {
            return value;
        }

        if (
            typeof value === 'string'
        ) {
            return value.toLowerCase() === 'true';
        }

        return Boolean(value);
    }

    function getUnidadLabel(value) {

        const key =
            String(value || '').trim();

        if (!key) {
            return '-';
        }

        const found =
            state.unidades.find(
                (unidad) =>
                    unidad.value === key
            );

        return found?.label || key;
    }

    function showModal(id) {

        const element = byId(id);

        if (
            !element ||
            typeof bootstrap === 'undefined'
        ) {
            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(element)
            .show();
    }

    function hideModal(id) {

        const element = byId(id);

        if (
            !element ||
            typeof bootstrap === 'undefined'
        ) {
            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(element)
            .hide();
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, text) {

        const element = byId(id);

        if (element) {
            element.textContent = text;
        }
    }

    function setTextHtml(id, html) {

        const element = byId(id);

        if (element) {
            element.innerHTML = html;
        }
    }

    function setValue(id, value) {

        const element = byId(id);

        if (element) {
            element.value = value;
        }
    }

    function escapeHtml(text) {

        return String(text || '')
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

})();