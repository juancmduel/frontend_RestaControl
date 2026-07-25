/* =====================================================
   RestaControl — Carta visual del restaurante
   ===================================================== */

(() => {
    const state = {
        platos: [],
        productos: []
    };

    const API_BASE = window.APP_CONFIG?.API_BASE_URL
        ? String(window.APP_CONFIG.API_BASE_URL).replace(/\/+$/, '')
        : 'http://localhost:7070';

    const API_CARTA = `${API_BASE}/api/reportes/carta`;

    async function init() {
        const authenticated = await Auth.requireLogin();

        if (!authenticated) {
            return;
        }

        bindEvents();
        await loadCarta();
    }

    function bindEvents() {
        byId('btnActualizarCartaMenu')
            ?.addEventListener('click', loadCarta);

        byId('btnImprimirCarta')
            ?.addEventListener('click', () => {
                window.print();
            });
    }

    async function loadCarta() {
        setLoading();

        try {
            const params = new URLSearchParams({
                estado: 'activo',
                disponibilidad: 'disponible',
                page: '1',
                size: '500'
            });

            const response = await fetch(
                `${API_CARTA}?${params.toString()}`,
                {
                    credentials: 'include'
                }
            );

            const payload = await safeJson(response);

            if (!response.ok) {
                await handleHttpError(
                    response,
                    payload,
                    'No se pudo cargar la carta.'
                );
            }

            const rows = extractArray(payload)
                .map(normalizeItem);

            state.platos = rows.filter(
                item => item.tipo === 'plato'
            );

            state.productos = rows.filter(
                item => item.tipo === 'producto'
            );

            renderCarta();
        } catch (error) {
            console.error(
                'Error cargando la carta:',
                error
            );

            showError(
                error.message ||
                'No se pudo cargar la carta del restaurante.'
            );
        }
    }

    function renderCarta() {
        const container = byId('restaurantMenu');

        if (!container) {
            return;
        }

        const categorias = groupPlatosByCategoria(
            state.platos
        );

        const seccionesPlatos = Object.entries(categorias)
            .map(([categoria, platos]) =>
                renderSeccion(
                    categoria,
                    platos,
                    'plato'
                )
            )
            .join('');

        const seccionProductos = state.productos.length
            ? renderSeccion(
                'Bebidas y productos',
                state.productos,
                'producto'
            )
            : '';

        if (
            !seccionesPlatos &&
            !seccionProductos
        ) {
            container.innerHTML = `
                <div class="restaurant-menu-empty">
                    <i class="bi bi-journal-x"></i>

                    <h3>No hay elementos disponibles</h3>

                    <p>
                        Actualmente no existen platos o productos
                        disponibles para mostrar.
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="restaurant-menu-frame">

                <header class="restaurant-menu-header">

                    <div class="restaurant-menu-symbol">
                        <i class="bi bi-cup-hot-fill"></i>
                    </div>

                    <p class="restaurant-menu-brand">
                        RESTACONTROL
                    </p>

                    <h2>NUESTRA CARTA</h2>

                    <div class="restaurant-menu-divider">
                        <span></span>
                        <i class="bi bi-stars"></i>
                        <span></span>
                    </div>

                    <p class="restaurant-menu-subtitle">
                        Platos preparados y productos disponibles
                    </p>

                </header>

                <div class="restaurant-menu-grid">

                    ${seccionesPlatos}
                    ${seccionProductos}

                </div>

                <footer class="restaurant-menu-footer">

                    <div>
                        <i class="bi bi-clock me-1"></i>
                        Consulte al personal por nuestros horarios
                    </div>

                    <div>
                        Los precios están expresados en soles
                    </div>

                </footer>

            </div>
        `;
    }

    function renderSeccion(
        titulo,
        items,
        tipo
    ) {
        return `
            <article class="restaurant-menu-section">

                <div class="restaurant-menu-section-title">

                    <i class="bi ${
                        tipo === 'plato'
                            ? 'bi-egg-fried'
                            : 'bi-cup-straw'
                    }"></i>

                    <h3>
                        ${escapeHtml(titulo)}
                    </h3>

                </div>

                <div class="restaurant-menu-items">

                    ${items.map(renderMenuItem).join('')}

                </div>

            </article>
        `;
    }

    function renderMenuItem(item) {
        return `
            <div class="restaurant-menu-item">

                <div class="restaurant-menu-item-main">

                    <div class="restaurant-menu-item-heading">

                        <h4>
                            ${escapeHtml(item.nombre)}
                        </h4>

                        <div class="restaurant-menu-dots"></div>

                        <strong>
                            ${money(item.precio)}
                        </strong>

                    </div>

                    ${
                        item.descripcion
                            ? `
                                <p>
                                    ${escapeHtml(item.descripcion)}
                                </p>
                            `
                            : ''
                    }

                </div>

            </div>
        `;
    }

    function groupPlatosByCategoria(platos) {
        return platos.reduce(
            (result, plato) => {
                const categoria =
                    plato.categoria ||
                    'Otros platos';

                if (!result[categoria]) {
                    result[categoria] = [];
                }

                result[categoria].push(plato);

                return result;
            },
            {}
        );
    }

    function normalizeItem(raw) {
        const tipoValue = String(
            raw.tipo ||
            raw.tipoItem ||
            ''
        )
            .trim()
            .toLowerCase();

        return {
            id: raw.id || '',
            tipo: tipoValue.includes('producto')
                ? 'producto'
                : 'plato',

            nombre:
                raw.nombre ||
                raw.name ||
                'Sin nombre',

            descripcion:
                raw.descripcion ||
                raw.description ||
                '',

            categoria:
                raw.categoriaNombre ||
                raw.categoria ||
                raw.nombreCategoria ||
                (
                    tipoValue.includes('producto')
                        ? 'Bebidas y productos'
                        : 'Otros platos'
                ),

            precio: Number(
                raw.precio ??
                raw.precioVenta ??
                0
            )
        };
    }

    function setLoading() {
        const container = byId('restaurantMenu');

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="restaurant-menu-loading">

                <span class="spinner-border spinner-border-sm me-2"></span>
                Cargando carta...

            </div>
        `;
    }

    function showError(message) {
        const container = byId('restaurantMenu');

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="alert alert-danger">

                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                ${escapeHtml(message)}

            </div>
        `;
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
                'No tienes permisos para consultar la carta.'
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

    function money(value) {
        return `S/ ${Number(value || 0).toFixed(2)}`;
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

    window.CartaMenu = {
        init
    };
})();