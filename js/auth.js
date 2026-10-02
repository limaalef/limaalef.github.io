/* ============================================================
   AUTH — sessão única para as três áreas do site:
     • Auth.site  → visitante logado (pedidos)      rq_token / rq_user
     • Auth.admin → administrador                   adm_token / adm_user
   As chaves ficam separadas de propósito (áreas segregadas), mas o
   código de login, expiração e requisições autenticadas é o mesmo.
   A AUTORIZAÇÃO real é sempre do servidor; o cliente só esconde telas.
   ============================================================ */
const Auth = (() => {
    const t = key => (typeof LanguageManager !== 'undefined' ? LanguageManager.t(key) : key);

    function notify(message, type = 'error') {
        if (typeof Utils !== 'undefined' && Utils.showNotification) Utils.showNotification(message, type);
        else console[type === 'error' ? 'error' : 'log'](message);
    }

    // Decodifica o payload de um JWT respeitando UTF-8 (nomes com acento).
    function decodeJwt(token) {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        ));
    }

    function readStorage(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function writeStorage(key, value) { try { localStorage.setItem(key, value); } catch { /* indisponível */ } }
    function removeStorage(key) { try { localStorage.removeItem(key); } catch { /* indisponível */ } }

    function create({ tokenKey, userKey, requireAdmin = false }) {
        let token = null;
        let user = null;

        const session = {
            get token() { return token; },
            get user() { return user; },
            get isLoggedIn() { return !!token; },

            save(newToken, newUser) {
                token = newToken;
                user = newUser;
                writeStorage(tokenKey, newToken);
                writeStorage(userKey, JSON.stringify(newUser));
            },

            clear() {
                token = null;
                user = null;
                removeStorage(tokenKey);
                removeStorage(userKey);
            },

            // Restaura do storage; descarta token inválido ou expirado.
            restore() {
                const stored = readStorage(tokenKey);
                if (!stored) return false;
                try {
                    const p = decodeJwt(stored);
                    if (p.exp && p.exp < Math.floor(Date.now() / 1000)) { session.clear(); return false; }
                    const storedUser = readStorage(userKey);
                    token = stored;
                    user = storedUser
                        ? JSON.parse(storedUser)
                        : { name: p.name || p.email, email: p.email, picture: p.picture || '' };
                    return true;
                } catch {
                    session.clear();
                    return false;
                }
            },

            // Login com Google Identity Services. Chama onSuccess(user) ou onError(mensagem).
            login({ onSuccess, onError } = {}) {
                const fail = message => (onError ? onError(message) : notify(message, 'error'));

                if (!window.google?.accounts?.id) { fail(t('requestGSINotLoaded')); return; }

                google.accounts.id.initialize({
                    client_id: CONFIG.GOOGLE_CLIENT_ID,
                    cancel_on_tap_outside: false,
                    auto_select: false,
                    callback: async response => {
                        try {
                            const res = await fetch(`${CONFIG.REQUEST_API_BASE}/auth/verify`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ credential: response.credential }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) { fail(data.error || t('requestLoginError')); return; }
                            if (requireAdmin && !data.isAdmin) { fail(data.error || t('authDenied')); return; }

                            const p = decodeJwt(response.credential);
                            // isAdmin vem do servidor e fica na sessão só para decidir o que MOSTRAR;
                            // quem autoriza cada operação é sempre o servidor.
                            const profile = { name: p.name || p.email, email: p.email, picture: p.picture || '', isAdmin: !!data.isAdmin };
                            session.save(data.token, profile);
                            onSuccess?.(profile, data);
                        } catch {
                            fail(t('requestLoginError'));
                        }
                    },
                });
                google.accounts.id.prompt();
            },

            logout(onDone) {
                session.clear();
                onDone?.();
            },

            // fetch autenticado. 401 (e 403 no admin) encerram a sessão de forma única.
            async fetch(url, options = {}, { onExpired } = {}) {
                const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
                const res = await fetch(url, { ...options, headers });
                if (res.status === 401 || (requireAdmin && res.status === 403)) {
                    session.clear();
                    notify(t('authSessionExpired'), 'error');
                    (onExpired || (() => location.reload()))();
                }
                return res;
            },
        };
        return session;
    }

    const site  = create({ tokenKey: 'rq_token',  userKey: 'rq_user' });
    const admin = create({ tokenKey: 'adm_token', userKey: 'adm_user', requireAdmin: true });

    // Sessão com permissão de administrador, venha ela do login do admin ou do login do site
    // (a resposta do servidor marca isAdmin). Retorna null se não houver.
    function adminSession() {
        if (admin.restore()) return admin;
        if (site.restore() && site.user?.isAdmin) return site;
        return null;
    }

    return { decodeJwt, create, site, admin, adminSession };
})();
