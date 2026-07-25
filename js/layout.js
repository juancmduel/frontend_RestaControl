/* =====================================================
   RestaControl — Layout Module
   Maneja:
   - Sidebar compartido
   - Usuario autenticado
   - Fecha
   - Menú activo
   - Permisos visuales por rol
   - Protección básica de páginas en frontend
   ===================================================== */

const Layout = (() => {

    /*
     * Roles registrados en el sistema:
     *
     * ADMINISTRADOR
     * RECEPCION
     * MOZO
     * COCINERO
     * CAJERO
     */

    const PAGE_PERMISSIONS = {
        // Página disponible para todos los usuarios autenticados
        dashboard: null,

        // Mantenimientos exclusivos del administrador
        categorias: ['ADMINISTRADOR'],
        platos: ['ADMINISTRADOR'],
        productos: ['ADMINISTRADOR'],
        usuarios: ['ADMINISTRADOR'],

        // Recepción
        clientes: ['ADMINISTRADOR', 'RECEPCION'],
        mesas: ['ADMINISTRADOR', 'RECEPCION'],
        reservas: ['ADMINISTRADOR', 'RECEPCION'],

        // Atención y pedidos
        listaMesas: ['ADMINISTRADOR', 'MOZO'],
        pedidosMesa: ['ADMINISTRADOR', 'MOZO'],
        detallePedidos: [
            'ADMINISTRADOR',
            'MOZO',
            'COCINERO'
        ],

        // Cocina
        cocina: ['ADMINISTRADOR', 'COCINERO'],

        // Reportes
        reporteVentas: ['ADMINISTRADOR', 'CAJERO'],
        reporteCaja: ['ADMINISTRADOR', 'CAJERO'],

        reporteReservas: [
            'ADMINISTRADOR',
            'RECEPCION'
        ],

        reportePlatosConsumidos: [
            'ADMINISTRADOR',
            'CAJERO',
            'COCINERO'
        ]
    };

    const SIDEBAR_FALLBACK_HTML = `
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<aside class="sidebar" id="sidebar">

    <div class="sidebar-brand">
        <i class="bi bi-cup-hot-fill brand-icon"></i>

        <div>
            <div class="brand-name">RestaControl</div>
            <div class="brand-sub">Panel Administrativo</div>
        </div>
    </div>

    <ul class="sidebar-nav">

        <li>
            <a
                class="nav-link"
                href="dashboard.html"
                data-page="dashboard"
            >
                <i class="bi bi-speedometer2"></i>
                <span>Dashboard</span>
            </a>
        </li>

        <li class="nav-section">Maestras</li>

        <li>
            <a
                class="nav-link"
                href="categorias.html"
                data-page="categorias"
            >
                <i class="bi bi-tags"></i>
                <span>Categorías</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="platos.html"
                data-page="platos"
            >
                <i class="bi bi-egg-fried"></i>
                <span>Platos</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="productos.html"
                data-page="productos"
            >
                <i class="bi bi-bag"></i>
                <span>Productos</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="clientes.html"
                data-page="clientes"
            >
                <i class="bi bi-people"></i>
                <span>Clientes</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="usuarios.html"
                data-page="usuarios"
            >
                <i class="bi bi-person-badge"></i>
                <span>Usuarios</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="mesas.html"
                data-page="mesas"
            >
                <i class="bi bi-grid-3x3-gap"></i>
                <span>Mesas</span>
            </a>
        </li>

        <li class="nav-section">Servicio</li>

        <li>
            <a
                class="nav-link"
                href="lista-mesas.html"
                data-page="listaMesas"
            >
                <i class="bi bi-grid"></i>
                <span>Lista-Mesas</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="reservas.html"
                data-page="reservas"
            >
                <i class="bi bi-calendar-check"></i>
                <span>Reservas</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="cocina.html"
                data-page="cocina"
            >
                <i class="bi bi-fire"></i>
                <span>Cocina</span>
            </a>
        </li>

        <li class="nav-section">Reportes</li>

        <li>
            <a
                class="nav-link"
                href="pedidos-mesa.html"
                data-page="pedidosMesa"
            >
                <i class="bi bi-grid"></i>
                <span>Pedidos por Mesa</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="reporte-ventas.html"
                data-page="reporteVentas"
            >
                <i class="bi bi-graph-up-arrow"></i>
                <span>Ventas</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="reporte-reservas.html"
                data-page="reporteReservas"
            >
                <i class="bi bi-calendar2-check"></i>
                <span>Reservas</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="reporte-platos.html"
                data-page="reportePlatosConsumidos"
            >
                <i class="bi bi-egg-fried"></i>
                <span>Platos consumidos</span>
            </a>
        </li>

        <li>
            <a
                class="nav-link"
                href="reporte-caja.html"
                data-page="reporteCaja"
            >
                <i class="bi bi-cash-stack"></i>
                <span>Caja</span>
            </a>
        </li>

        <li>
            <a
                class="sidebar-link"
                href="reporte-carta.html"
                data-page="reporteCarta"
            >
                <i class="bi bi-list-check"></i>
                <span>Carta</span>
            </a>s
        </li>

    </ul>

    <div class="sidebar-footer">
        <div class="sidebar-user">

            <div class="user-avatar">
                <i class="bi bi-person-fill"></i>
            </div>

            <div class="user-info">
                <div
                    class="user-name"
                    id="sidebarUserName"
                >
                    Usuario
                </div>

                <div
                    class="user-role"
                    id="sidebarUserRole"
                >
                </div>
            </div>

            <button
                class="btn btn-icon"
                type="button"
                onclick="Auth.logout()"
                title="Cerrar sesión"
            >
                <i
                    class="bi bi-box-arrow-right"
                    style="color:#b8c2d4;"
                ></i>
            </button>

        </div>
    </div>

</aside>
`;

    async function loadSharedSidebar(
        mountId = 'sidebarMount',
        partialPath = './partials/sidebar.html'
    ) {
        const mount = document.getElementById(mountId);

        if (!mount) {
            return;
        }

        try {
            const response = await fetch(partialPath);

            if (!response.ok) {
                throw new Error(
                    `No se pudo cargar el sidebar (${response.status})`
                );
            }

            mount.innerHTML = await response.text();
            initCambioMiPassword();

        } catch (error) {
            console.error(
                'Error cargando sidebar compartido:',
                error
            );

            mount.innerHTML = SIDEBAR_FALLBACK_HTML;
            initCambioMiPassword();
        }
    }

    function init(pageKey) {
        const session = Auth.getSession();

        if (!session) {
            redirectToLogin();
            return false;
        }

        /*
         * Primero validamos si el usuario puede entrar a
         * la página actual.
         */
        if (!_canAccessPage(pageKey)) {
            _redirectUnauthorized();
            return false;
        }

        _setUser();
        _applyRolePermissions();
        _setActiveLink(pageKey);
        _bindSidebarToggle();
        _setDate();

        return true;
    }

    function _setUser() {
        const session = Auth.getSession();

        if (!session) {
            return;
        }

        const nombreCompleto =
            session.nombreCompleto
            || session.username
            || 'Usuario';

        const rol =
            session.rol
            || _getRoleFromAuthorities(session.roles)
            || 'Usuario';

        /*
         * Parte inferior:
         * solamente mostramos el nombre.
         */
        _setText(
            'sidebarUserName',
            nombreCompleto
        );

        const sidebarRole =
            document.getElementById('sidebarUserRole');

        if (sidebarRole) {
            sidebarRole.textContent = '';
            sidebarRole.style.display = 'none';
        }

        /*
         * Parte superior:
         * nombre completo y rol.
         */
        _setText(
            'headerUserName',
            nombreCompleto
        );

        _setText(
            'headerUserRole',
            rol
        );

        /*
         * Compatibilidad con otros IDs que puedan existir
         * en algunas páginas.
         */
        _setText(
            'topbarUserName',
            nombreCompleto
        );

        _setText(
            'topbarUserRole',
            rol
        );

        _setText(
            'userName',
            nombreCompleto
        );

        _setText(
            'userRole',
            rol
        );
    }

    function _applyRolePermissions() {
        document
            .querySelectorAll(
                '.sidebar-nav .nav-link[data-page]'
            )
            .forEach(link => {
                const pageKey = link.dataset.page;

                if (_canAccessPage(pageKey)) {
                    return;
                }

                const listItem = link.closest('li');

                if (listItem) {
                    listItem.style.display = 'none';
                }
            });

        /*
         * Oculta los títulos "Maestras", "Servicio" o
         * "Reportes" cuando todos sus enlaces quedaron
         * ocultos.
         */
        _hideEmptySections();
    }

    function _canAccessPage(pageKey) {
        if (!pageKey) {
            return true;
        }

        const requiredRoles =
            PAGE_PERMISSIONS[pageKey];

        /*
         * null significa que cualquier usuario autenticado
         * puede ingresar.
         */
        if (requiredRoles === null) {
            return true;
        }

        /*
         * Si la página todavía no está registrada en el mapa,
         * se permite temporalmente para no romper módulos.
         */
        if (!Array.isArray(requiredRoles)) {
            return true;
        }

        return requiredRoles.some(role =>
            Auth.hasRole(role)
        );
    }

    function _hideEmptySections() {
        const navigation =
            document.querySelector('.sidebar-nav');

        if (!navigation) {
            return;
        }

        const children =
            Array.from(navigation.children);

        children.forEach((element, index) => {
            if (
                !element.classList.contains('nav-section')
            ) {
                return;
            }

            let hasVisibleLink = false;

            for (
                let nextIndex = index + 1;
                nextIndex < children.length;
                nextIndex += 1
            ) {
                const nextElement =
                    children[nextIndex];

                if (
                    nextElement.classList.contains(
                        'nav-section'
                    )
                ) {
                    break;
                }

                const link =
                    nextElement.querySelector('.nav-link');

                if (
                    link
                    && nextElement.style.display !== 'none'
                ) {
                    hasVisibleLink = true;
                    break;
                }
            }

            element.style.display =
                hasVisibleLink
                    ? ''
                    : 'none';
        });
    }

    function _redirectUnauthorized() {
        window.alert(
            'No tienes permisos para acceder a esta página.'
        );

        const normalizedPath =
            window.location.pathname.replace(/\\/g, '/');

        const inPages =
            normalizedPath.includes('/pages/');

        window.location.href = inPages
            ? 'dashboard.html'
            : 'pages/dashboard.html';
    }

    function redirectToLogin() {
        const normalizedPath =
            window.location.pathname.replace(/\\/g, '/');

        const inPages =
            normalizedPath.includes('/pages/');

        window.location.href = inPages
            ? '../index.html'
            : 'index.html';
    }

    function _getRoleFromAuthorities(roles) {
        if (
            !Array.isArray(roles)
            || roles.length === 0
        ) {
            return null;
        }

        const role = roles.find(
            item => String(item).startsWith('ROLE_')
        );

        if (!role) {
            return null;
        }

        return String(role)
            .replace(/^ROLE_/, '')
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(
                /\b\w/g,
                letter => letter.toUpperCase()
            );
    }

    function _setActiveLink(pageKey) {
        document
            .querySelectorAll(
                '.sidebar-nav .nav-link'
            )
            .forEach(link => {
                link.classList.toggle(
                    'active',
                    link.dataset.page === pageKey
                );
            });
    }

    function _bindSidebarToggle() {
        const toggle =
            document.getElementById('sidebarToggle');

        const sidebar =
            document.getElementById('sidebar');

        const overlay =
            document.getElementById('sidebarOverlay');

        if (!toggle || !sidebar) {
            return;
        }

        /*
         * Evita registrar el evento más de una vez.
         */
        if (toggle.dataset.bound === 'true') {
            return;
        }

        toggle.dataset.bound = 'true';

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-open');

            if (overlay) {
                overlay.classList.toggle('active');
            }
        });

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove(
                    'sidebar-open'
                );

                overlay.classList.remove('active');
            });
        }
    }


    function initCambioMiPassword() {
        const btnAbrir = document.getElementById('btnCambiarMiPassword');
        const btnGuardar = document.getElementById('btnGuardarMiPassword');
        const modalElement = document.getElementById('modalMiPassword');

        if (!btnAbrir || !btnGuardar || !modalElement) {
            return;
        }

        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

        btnAbrir.addEventListener('click', () => {
            document.getElementById('formMiPassword')?.reset();
            modal.show();
        });

        btnGuardar.addEventListener('click', async () => {
            const passwordActual = String(
                document.getElementById('miPasswordActual')?.value || ''
            );

            const nuevaPassword = String(
                document.getElementById('miNuevaPassword')?.value || ''
            );

            const confirmacion = String(
                document.getElementById('miConfirmarPassword')?.value || ''
            );

            if (!passwordActual || !nuevaPassword || !confirmacion) {
                alert('Completa todos los campos.');
                return;
            }

            if (nuevaPassword.length < 6) {
                alert('La nueva contraseña debe tener al menos 6 caracteres.');
                return;
            }

            if (nuevaPassword !== confirmacion) {
                alert('Las nuevas contraseñas no coinciden.');
                return;
            }

            const originalHtml = btnGuardar.innerHTML;

            try {
                btnGuardar.disabled = true;
                btnGuardar.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-1"></span>
                    Actualizando...
                `;

                const apiBase = (
                    window.APP_CONFIG?.API_BASE_URL
                    || 'http://localhost:7070'
                ).replace(/\/+$/, '');

                const response = await fetch(
                    `${apiBase}/api/auth/me/password`,
                    {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            passwordActual,
                            nuevaPassword
                        })
                    }
                );

                let data = null;

                try {
                    data = await response.json();
                } catch {
                    data = null;
                }

                if (!response.ok) {
                    throw new Error(
                        data?.message
                        || 'No se pudo actualizar la contraseña.'
                    );
                }

                modal.hide();

                alert(
                    data?.message
                    || 'Contraseña actualizada correctamente.'
                );

            } catch (error) {
                alert(
                    error.message
                    || 'No se pudo actualizar la contraseña.'
                );

            } finally {
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = originalHtml;
            }
        });
    }

    function _setDate() {
        const element =
            document.getElementById('topbarDate');

        if (!element) {
            return;
        }

        element.textContent =
            new Date().toLocaleDateString(
                'es-PE',
                {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }
            );
    }

    function _setText(id, text) {
        const element =
            document.getElementById(id);

        if (!element) {
            return;
        }

        element.textContent =
            text === null || text === undefined
                ? ''
                : String(text);
    }

    return {
        init,
        loadSharedSidebar,
        canAccessPage: _canAccessPage
    };
})();