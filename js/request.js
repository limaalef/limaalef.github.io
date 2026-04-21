/**
 * ============================================================
 *  REQUEST MODULE — Sports Archive
 *  Módulo de pedidos (carrinho → login → envio)
 *
 *  COMO REMOVER: apague request.js, request.css e as duas
 *  linhas <link>/<script> correspondentes no HTML.
 *
 *  CORREÇÃO DO HOOK:
 *  Em vez de tentar capturar window.Renderer?.render no momento
 *  do init (que pode ser undefined por corrida de execução),
 *  o módulo escuta o CustomEvent 'matchesRendered' que o
 *  Renderer já despacha ao final de cada render().
 *  Isso elimina qualquer dependência de ordem de carregamento.
 * ============================================================
 */

const RequestModule = (() => {

    // ── Config ────────────────────────────────────────────────
    const CFG = {
        apiBase:        CONFIG.REQUEST_API_BASE,
        googleClientId: CONFIG.GOOGLE_CLIENT_ID,
    };

    // ── Estado ────────────────────────────────────────────────
    let cart   = JSON.parse(localStorage.getItem('sa_cart') || '[]');
    let user   = null;
    let _panel = null;

    // ── i18n helper ───────────────────────────────────────────
    // Usa LanguageManager se disponível, caso contrário devolve
    // a chave — evita crash se o módulo carregar isolado.
    function t(key) {
        return LanguageManager ? LanguageManager.t(key) : key;
    }

    // ── Persistência ─────────────────────────────────────────
    function saveCart() {
        localStorage.setItem('sa_cart', JSON.stringify(cart));
        _renderBadge();
    }

    // ══════════════════════════════════════════════════════════
    //  API PÚBLICA
    // ══════════════════════════════════════════════════════════
    const API = {

        addItem(match) {
            const sport = CONFIG?.currentSport || 'football';
            if (cart.find(c => c.id === match.ID && c.sport === sport)) {
                Utils.showNotification(t('requestAlreadyInCart'), 'warning');
                return;
            }
            cart.push(_buildItem(match, sport));
            saveCart();
            Utils.showNotification(t('requestAdded'), 'success');
            _renderCartList();
        },

        removeItem(id, sport) {
            cart = cart.filter(c => !(String(c.id) === String(id) && c.sport === sport));
            saveCart();
            _renderCartList();
        },

        clearCart() {
            cart = [];
            saveCart();
            _renderCartList();
        },

        clearCartEndOrder() {
            cart = [];
            saveCart();
        },

        isInCart(id, sport) {
            return !!cart.find(c => c.id === id && c.sport === sport);
        },

        openPanel() {
            _ensurePanel();
            _panel.classList.add('om-open');
            // Overlay visível (fallback para browsers sem :has)
            document.getElementById('om-overlay')?.classList.add('om-visible');
            _renderCartList();
        },

        closePanel() {
            _panel?.classList.remove('om-open');
            document.getElementById('om-overlay')?.classList.remove('om-visible');
        },

        getCart()  { return [...cart]; },
        init()     { _init(); },

        // Exposto para onclick inline no HTML gerado
        openCheckout: null,
        _backToCart:  null,
    };

    // ══════════════════════════════════════════════════════════
    //  CONSTRUÇÃO DO ITEM
    // ══════════════════════════════════════════════════════════
    function _buildItem(match, sport) {
        if (sport === 'motor') {
            return {
                id:    match.ID,
                sport,
                label: `${match.Campeonato} — ${match.Fase}`,
                date:  Utils.formatMotorDateRange?.(match.DataInicio, match.DataFim) || '',
                meta:  `${(match.Eventos || []).length} ${t('requestEvents')}`,
            };
        }
        
        const home  = match.Mandante  || '?';
        const away  = match.Visitante || '?';
        const gh    = match['Gols mandante']  ?? '';
        const ga    = match['Gols visitante'] ?? '';
        const score = (gh !== '' && ga !== '') ? ` ${gh} x ${ga}` : ' x ';
        const tv    = match.Emissora || '';

        return {
            id:    match.ID,
            sport,
            label: `${home} ${score} ${away}`,
            date:  Utils.formatMatchDate?.(match.Data) || match.Data || '',
            meta:  `${match.Competição || ''} ${match.Fase ? '· ' + match.Fase : ''}`.trim(),
            station: tv,
        };
    }

    // ══════════════════════════════════════════════════════════
    //  FAB + BADGE
    // ══════════════════════════════════════════════════════════
    function _renderBadge() {
        const btn = document.getElementById('om-cart-btn');
        if (!btn) return;
        const count = cart.length;
        const badge = btn.querySelector('.om-badge');
        badge.textContent       = count;
        badge.style.display     = count ? 'flex' : 'none';
    }

    function _injectCartButton() {
        if (document.getElementById('om-cart-btn')) return;
        const btn = document.createElement('button');
        btn.id        = 'om-cart-btn';
        btn.className = 'om-cart-fab';
        btn.setAttribute('data-i18n-title', 'requestCartTitle');
        btn.title     = t('requestCartTitle');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="9"  cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span class="om-badge" style="display:none" aria-live="polite">0</span>
        `;
        btn.addEventListener('click', () => API.openPanel());
        document.body.appendChild(btn);
        _renderBadge();
    }

    // ══════════════════════════════════════════════════════════
    //  PAINEL LATERAL
    // ══════════════════════════════════════════════════════════
    function _ensurePanel() {
        if (_panel) return;

        _panel = document.createElement('div');
        _panel.id        = 'om-panel';
        _panel.className = 'om-panel';
        _panel.setAttribute('role', 'dialog');
        _panel.setAttribute('aria-modal', 'true');
        _panel.innerHTML = `
            <div class="om-panel-header">
                <h3 data-i18n="requestCart">${t('requestCart')}</h3>
                <button class="btn close-btn" id="om-panel-close" aria-label="${t('requestClose')}">×</button>
            </div>
            <div class="om-panel-body"  id="om-panel-body"></div>
            <div class="om-panel-footer" id="om-panel-footer"></div>
        `;
        document.body.appendChild(_panel);

        const overlay = document.createElement('div');
        overlay.id        = 'om-overlay';
        overlay.className = 'om-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.addEventListener('click', () => API.closePanel());
        document.body.appendChild(overlay);

        document.getElementById('om-panel-close')
            .addEventListener('click', () => API.closePanel());
    }

    // ══════════════════════════════════════════════════════════
    //  RENDER — LISTA DO CARRINHO
    // ══════════════════════════════════════════════════════════
    function _renderCartList() {
        const body   = document.getElementById('om-panel-body');
        const footer = document.getElementById('om-panel-footer');
        if (!body || !footer) return;

        if (cart.length === 0) {
            body.innerHTML = `
                <div class="om-empty">
                    <p data-i18n="requestListEmpty">${t('requestListEmpty')}</p>
                    <p class="om-hint" data-i18n="requestListHint">${t('requestListHint')}</p>
                </div>`;
            footer.innerHTML = '';
            return;
        }

        body.innerHTML = `
            <ul class="om-list" role="list">
                ${cart.map(item => `
                    <li class="om-item" data-id="${item.id}" data-sport="${item.sport}">
                        <div class="om-item-info">
                            <span class="om-item-meta">${_esc(item.meta)}</span>
                            <span class="om-item-label">${_esc(item.label)}</span>
                            <span class="om-item-date">${_esc(item.date)} - ${_esc(item.station)}</span>
                        </div>
                        <button class="om-remove-btn"
                            title="${t('requestRemove')}"
                            aria-label="${t('requestRemove')}: ${_esc(item.label)}"
                            onclick="RequestModule.removeItem('${item.id}','${item.sport}')">✕</button>
                    </li>
                `).join('')}
            </ul>`;

        footer.innerHTML = `
            <div class="om-footer-top">
                <a href="my-requests.html" class="om-my-requests-link">
                    <span data-i18n="requestMyRequests">${t('requestMyRequests')}</span>
                </a>
            </div>
            <div class="om-footer-info">
                ${cart.length} <span data-i18n="requestItemsSelected">${t('requestItemsSelected')}</span>
            </div>
            <div class="om-footer-actions">
                <button class="action-btn btn-ghost"
                    data-i18n="requestClear"
                    onclick="RequestModule.clearCart()">${t('requestClear')}</button>
                <button class="action-btn btn-primary"
                    onclick="RequestModule.openCheckout()">
                    <span data-i18n="requestSubmit">${t('requestSubmit')}</span> →
                </button>
            </div>`;
    }

    // ══════════════════════════════════════════════════════════
    //  CHECKOUT — STEP 1: LOGIN
    // ══════════════════════════════════════════════════════════
    API.openCheckout = function () {
        if (cart.length === 0) {
            Utils.showNotification(t('requestCartEmpty'), 'warning');
            return;
        }
        if (user) { _renderContactStep(); return; }
        _renderLoginStep();
    };

    function _renderLoginStep() {
        const body   = document.getElementById('om-panel-body');
        const footer = document.getElementById('om-panel-footer');

        body.innerHTML = `
            <div class="om-step">
                <div class="om-step-title">
                    1 / 2 — <span data-i18n="requestStepLogin">${t('requestStepLogin')}</span>
                </div>
                <p class="om-step-desc" data-i18n="requestLoginDesc">${t('requestLoginDesc')}</p>
                <div class="om-oauth-buttons">
                    <button class="om-oauth-btn om-google" id="om-login-google">
                        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>
                        <span data-i18n="requestLoginGoogle">${t('requestLoginGoogle')}</span>
                    </button>
                </div>
            </div>`;

        footer.innerHTML = `
            <button class="action-btn btn-ghost"
                data-i18n="requestBack"
                onclick="RequestModule._backToCart()">← ${t('requestBack')}</button>`;

        document.getElementById('om-login-google')
            .addEventListener('click', () => _loginGoogle());
    }

    // ══════════════════════════════════════════════════════════
    //  CHECKOUT — STEP 2: CONTATO
    // ══════════════════════════════════════════════════════════
    function _renderContactStep() {
        const body   = document.getElementById('om-panel-body');
        const footer = document.getElementById('om-panel-footer');

        body.innerHTML = `
            <div class="om-step">
                <div class="om-step-title">
                    2 / 2 — <span data-i18n="requestStepContact">${t('requestStepContact')}</span>
                </div>
                <div class="om-user-info">
                    <img src="${_esc(user.picture || '')}" class="om-avatar"
                         alt="${_esc(user.name)}"
                         onerror="this.style.display='none'">
                    <div>
                        <strong>${_esc(user.name)}</strong>
                        <small>${_esc(user.email)}</small>
                    </div>
                </div>
                <p class="om-step-desc" data-i18n="requestContactDesc">${t('requestContactDesc')}</p>

                <div class="om-contact-selector" role="group" aria-label="${t('requestContactChannel')}">
                    <label class="om-contact-opt" data-channel="email">
                        <input type="radio" name="om-channel" value="email">E-mail
                    </label>
                    <label class="om-contact-opt" data-channel="whatsapp">
                        <input type="radio" name="om-channel" value="whatsapp">WhatsApp
                    </label>
                    <label class="om-contact-opt" data-channel="telegram">
                        <input type="radio" name="om-channel" value="telegram">Telegram
                    </label>
                    <label class="om-contact-opt" data-channel="bluesky">
                        <input type="radio" name="om-channel" value="bluesky">Bluesky
                    </label>
                    <label class="om-contact-opt" data-channel="x">
                        <input type="radio" name="om-channel" value="x">𝕏
                    </label>
                </div>

                <div id="om-contact-input-wrap" class="om-contact-input-wrap" style="display:none">
                    <label id="om-contact-label" for="om-contact-value">${t('requestContactLabel')}</label>
                    <input id="om-contact-value" class="om-input" type="text" placeholder="">
                </div>
                <div class="om-contact-input-wrap">
                    <label for="om-notes" data-i18n="requestNotesLabel">${t('requestNotesLabel')}</label>
                    <textarea id="om-notes" class="om-input om-textarea"
                        data-i18n-placeholder="requestNotesPlaceholder"
                        placeholder="${t('requestNotesPlaceholder')}"></textarea>
                </div>
            </div>`;

        footer.innerHTML = `
            <div class="om-footer-actions">
                <button class="action-btn btn-ghost"
                    data-i18n="requestBack"
                    onclick="RequestModule._backToCart()">← ${t('requestBack')}</button>
                <button class="action-btn btn-primary" id="om-submit-btn">
                    <span data-i18n="requestSend">${t('requestSend')}</span>
                </button>
            </div>`;

        // Selecionar canal
        body.querySelectorAll('input[name="om-channel"]').forEach(radio => {
            radio.addEventListener('change', () => {
                body.querySelectorAll('.om-contact-opt').forEach(el => el.classList.remove('selected'));
                radio.closest('.om-contact-opt').classList.add('selected');
                _updateContactInput(radio.value);
            });
        });

        // E-mail selecionado por padrão
        const emailRadio = body.querySelector('input[value="email"]');
        if (emailRadio) { emailRadio.checked = true; emailRadio.dispatchEvent(new Event('change')); }

        document.getElementById('om-submit-btn')
            .addEventListener('click', _submitRequest);
    }

    function _updateContactInput(channel) {
        const wrap  = document.getElementById('om-contact-input-wrap');
        const label = document.getElementById('om-contact-label');
        const input = document.getElementById('om-contact-value');
        wrap.style.display = 'block';

        const cfg = {
            email:    { labelKey: 'requestContactEmail',     placeholder: 'nome@exemplo.com',       type: 'email' },
            whatsapp: { labelKey: 'requestContactWhatsApp',  placeholder: '+55 11 99999-9999',       type: 'tel'   },
            telegram: { labelKey: 'requestContactTelegram',  placeholder: '@usuario',                type: 'text'  },
            bluesky:  { labelKey: 'requestContactBluesky',   placeholder: '@usuario.bsky.social',    type: 'text'  },
            x:        { labelKey: 'requestContactX',         placeholder: '@usuario',                type: 'text'  },
        };
        const c = cfg[channel] || cfg.email;
        label.textContent = t(c.labelKey);
        input.placeholder = c.placeholder;
        input.type        = c.type;
        input.value       = (channel === 'email' && user?.email) ? user.email : '';
    }

    // ══════════════════════════════════════════════════════════
    //  ENVIO DO PEDIDO
    // ══════════════════════════════════════════════════════════
    async function _submitRequest() {
        const channel = document.querySelector('input[name="om-channel"]:checked')?.value;
        const contact = document.getElementById('om-contact-value')?.value?.trim();
        const notes   = document.getElementById('om-notes')?.value?.trim();

        if (!channel || !contact) {
            Utils.showNotification(t('requestFillContact'), 'warning');
            return;
        }

        const btn = document.getElementById('om-submit-btn');
        btn.disabled    = true;
        btn.textContent = t('requestSending');

        try {
            const res = await fetch(`${CFG.apiBase}/orders`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                body: JSON.stringify({
                    user:    { name: user.name, email: user.email, picture: user.picture, provider: user.provider },
                    contact: { channel, value: contact },
                    items:   cart,
                    notes:   notes || '',
                }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            _renderSuccessStep(data.orderId);
            API.clearCartEndOrder();
        } catch (err) {
            Utils.showNotification(`${t('requestError')}: ${err.message}`, 'error');
            btn.disabled    = false;
            btn.textContent = `${t('requestSend')}`;
        }
    }

    function _renderSuccessStep(requestId) {
        const body   = document.getElementById('om-panel-body');
        const footer = document.getElementById('om-panel-footer');
        body.innerHTML = `
            <div class="om-step om-success">
                <h3 data-i18n="requestSuccessTitle">${t('requestSuccessTitle')}</h3>
                <p>${t('requestSuccessId')} <strong>#${_esc(String(requestId))}</strong></p>
                <p class="om-hint" data-i18n="requestSuccessHint">${t('requestSuccessHint')}</p>
            </div>`;
        footer.innerHTML = `
            <button class="action-btn btn-primary"
                data-i18n="requestClose"
                onclick="RequestModule.closePanel()">${t('requestClose')}</button>`;
    }

    API._backToCart = function () { _renderCartList(); };

    // ══════════════════════════════════════════════════════════
    //  OAUTH — Google
    // ══════════════════════════════════════════════════════════
    async function _loginGoogle() {
        // Fallback: se GSI não carregou, usa popup OAuth redirect
        if (!window.google?.accounts?.id) { _openOAuthPopup('google'); return; }
        google.accounts.id.initialize({
            client_id:             CFG.googleClientId,
            cancel_on_tap_outside: false,
            callback: async (response) => {
                try {
                    // Troca o credential do Google pelo JWT próprio do backend (assinado com JWT_SECRET)
                    const res = await fetch(`${CFG.apiBase}/auth/verify`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ credential: response.credential }),
                    });
                    if (!res.ok) {
                        const e = await res.json().catch(() => ({}));
                        Utils.showNotification(e.error || 'Erro ao autenticar com Google', 'error');
                        return;
                    }
                    const data = await res.json();
                    const p = _decodeJwt(response.credential);
                    user = {
                        name:     p.name    || p.email,
                        email:    p.email,
                        picture:  p.picture || '',
                        provider: 'google',
                        token:    data.token,   // JWT próprio, validado pelo backend
                        isAdmin:  data.isAdmin,
                    };
                    _renderContactStep();
                } catch (err) {
                    Utils.showNotification('Erro ao autenticar com Google', 'error');
                }
            },
        });
        google.accounts.id.prompt();
    }

    // ── OAuth popup fallback (Google redirect flow) ───────────
    function _openOAuthPopup(provider) {
        const popup = window.open(
            `${CFG.apiBase}/auth/${provider}?origin=${encodeURIComponent(window.location.origin)}`,
            'oauth', 'width=500,height=600'
        );
        window.addEventListener('message', function handler(e) {
            if (!e.origin.includes('workers.dev') && e.origin !== window.location.origin) return;
            if (e.data?.type === 'oauth_success') {
                user = e.data.user; // já contém token JWT próprio (emitido no callback do worker)
                window.removeEventListener('message', handler);
                popup?.close();
                _renderContactStep();
            }
        });
    }

    // ══════════════════════════════════════════════════════════
    //  BOTÃO "+ PEDIR" NOS CARDS
    // ══════════════════════════════════════════════════════════
    function _injectRequestButtons() {
        const sport = CONFIG?.currentSport || 'football';
        document.querySelectorAll('.match-card[data-match-id]').forEach(card => {
            if (card.querySelector('.om-add-btn')) return; // já injetado

            const id     = card.dataset.matchId;
            const inCart = API.isInCart(id, sport);

            const btn = document.createElement('button');
            btn.className = `om-add-btn${inCart ? ' om-added' : ''}`;
            btn.title     = inCart ? t('requestAlreadyAdded') : t('requestAddBtn');
            btn.setAttribute('aria-label', inCart ? t('requestAlreadyAdded') : t('requestAddBtn'));
            btn.textContent = inCart ? `${t('requestAdded')}` : `${t('requestAddBtn')}`;

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const match = AppState?.matches?.find(m => String(m.ID) === String(id));
                if (!match) return;
                if (API.isInCart(match.ID, sport)) {
                    Utils.showNotification(t('requestAlreadyInCart'), 'info');
                    return;
                }
                API.addItem(match);
                btn.textContent = `${t('requestAdded')}`;
                btn.title       = t('requestAlreadyAdded');
                btn.classList.add('om-added');
            });

            card.appendChild(btn);
        });
    }

    // Atualiza estado visual dos botões sem reinjetar (ex: troca de esporte)
    function _refreshButtonStates() {
        const sport = CONFIG?.currentSport || 'football';
        document.querySelectorAll('.match-card[data-match-id] .om-add-btn').forEach(btn => {
            const card   = btn.closest('.match-card');
            const id     = card?.dataset.matchId;
            const inCart = id ? API.isInCart(id, sport) : false;
            btn.classList.toggle('om-added', inCart);
            btn.textContent = inCart ? `${t('requestAdded')}` : `+ ${t('requestAddBtn')}`;
        });
    }

    // ══════════════════════════════════════════════════════════
    //  PATCH DE MANAGERS — injeta data-match-id nos cards
    //
    //  Feito via Object.defineProperty em vez de capturar
    //  window.Renderer?.render no init, pois os objetos
    //  Renderer/CardManager podem ainda não existir nesse momento.
    //  O patch é aplicado depois do DOMContentLoaded através
    //  do evento 'matchesRendered', que Renderer.render() já
    //  dispara internamente — sem modificar managers.js.
    // ══════════════════════════════════════════════════════════
    function _patchManagers() {
        // Patch CardManager.create
        if (window.CardManager && !CardManager._rmPatched) {
            const orig = CardManager.create.bind(CardManager);
            CardManager.create = function (match) {
                const card = orig(match);
                card.dataset.matchId = match.ID;
                return card;
            };
            CardManager._rmPatched = true;
        }

        // Patch MotorCardManager.create
        if (window.MotorCardManager && !MotorCardManager._rmPatched) {
            const orig = MotorCardManager.create.bind(MotorCardManager);
            MotorCardManager.create = function (match) {
                const card = orig(match);
                card.dataset.matchId = match.ID;
                return card;
            };
            MotorCardManager._rmPatched = true;
        }
    }

    // ══════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════
    function _init() {
        _injectCartButton();
        _ensurePanel();
        _loadOAuthScripts();

        // ── HOOK PRINCIPAL ────────────────────────────────────
        // Escuta 'matchesRendered' (disparado por Renderer.render)
        // ao invés de monkey-patchar Renderer.render, que pode
        // estar undefined no momento em que _init() executa.
        document.addEventListener('matchesRendered', () => {
            _patchManagers();        // garante data-match-id nos creates futuros
            _injectRequestButtons(); // injeta nos cards já no DOM
        });

        // Garante patch assim que os managers existirem
        // (útil se DOMContentLoaded já disparou antes do evento)
        _patchManagers();

        // ESC fecha o painel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') API.closePanel();
        });

        console.info('[RequestModule] iniciado');
    }

    function _loadOAuthScripts() {
        if (!document.querySelector('script[src*="accounts.google.com"]')) {
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.async = true;
            document.head.appendChild(s);
        }

    }

    // ── Utilitários ───────────────────────────────────────────
    function _decodeJwt(token) {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        ));
    }

    function _esc(str) {
        return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    return API;
})();

// ── Exposição global ──────────────────────────────────────────
window.RequestModule = RequestModule;

// ── Auto-init ─────────────────────────────────────────────────
// Aguarda DOMContentLoaded para garantir que managers.js já
// foi avaliado pelo parser, porém sem depender de App.init().
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RequestModule.init());
} else {
    RequestModule.init();
}