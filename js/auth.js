const Auth = (() => {
    const SESSION_KEY = 'rc_sess';

    window.APP_CONFIG = window.APP_CONFIG || {
        API_BASE_URL: 'http://localhost:7070'
    };

    const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
    const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;
    const ME_URL = `${API_BASE_URL}/api/auth/me`;
    const LOGOUT_URL = `${API_BASE_URL}/api/auth/logout`;

    async function login(username, password) {
        try {
            const response = await fetch(LOGIN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    username: username.trim(),
                    password
                })
            });

            const data = await readJson(response);

            if (!response.ok || !data?.success) {
                clearLocalSession();

                return {
                    success: false,
                    message: data?.message || 'Usuario o contraseña incorrectos.'
                };
            }

            const session = {
                username: data.username,
                nombreCompleto: data.nombreCompleto,
                rol: data.rol,
                roles: Array.isArray(data.roles) ? data.roles : [],
                at: Date.now()
            };

            saveLocalSession(session);

            return {
                success: true,
                username: session.username,
                nombreCompleto: session.nombreCompleto,
                rol: session.rol,
                roles: session.roles
            };

        } catch (error) {
            clearLocalSession();

            console.error('Error en login:', error);

            return {
                success: false,
                message: `No se pudo conectar con el backend (${API_BASE_URL}).`
            };
        }
    }

    async function getAuthenticatedUser() {
        try {
            const response = await fetch(ME_URL, {
                method: 'GET',
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'include'
            });

            const data = await readJson(response);

            if (!response.ok || !data?.success) {
                clearLocalSession();
                return null;
            }

            const session = {
                username: data.username,
                nombreCompleto: data.nombreCompleto,
                rol: data.rol,
                roles: Array.isArray(data.roles) ? data.roles : [],
                at: Date.now()
            };

            saveLocalSession(session);

            return session;

        } catch (error) {
            console.error('Error consultando la sesión:', error);
            clearLocalSession();
            return null;
        }
    }

    async function logout() {
        try {
            await fetch(LOGOUT_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error cerrando sesión:', error);
        } finally {
            clearLocalSession();
            redirectToLogin();
        }
    }

    function getSession() {
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY));
        } catch {
            return null;
        }
    }

    function isLoggedIn() {
        return getSession() !== null;
    }

    async function requireLogin() {
        const authenticatedUser = await getAuthenticatedUser();

        if (!authenticatedUser) {
            redirectToLogin();
            return false;
        }

        return true;
    }

    function hasRole(role) {
        const session = getSession();

        if (!session || !Array.isArray(session.roles)) {
            return false;
        }

        const normalizedRole = role.startsWith('ROLE_')
            ? role.toUpperCase()
            : `ROLE_${role.toUpperCase()}`;

        return session.roles.includes(normalizedRole);
    }

    function saveLocalSession(session) {
        sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify(session)
        );
    }

    function clearLocalSession() {
        sessionStorage.removeItem(SESSION_KEY);
    }

    function redirectToLogin() {
        const normalizedPath =
            window.location.pathname.replace(/\\/g, '/');

        const inPages = normalizedPath.includes('/pages/');

        window.location.href = inPages
            ? '../index.html'
            : 'index.html';
    }

    async function readJson(response) {
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    return {
        login,
        logout,
        getSession,
        getAuthenticatedUser,
        isLoggedIn,
        requireLogin,
        hasRole
    };
})();