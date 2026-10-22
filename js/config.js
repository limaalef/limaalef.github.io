const CONFIG = {
    API_URLS: {
        football: 'https://api-archive.limaalef.com/v2/matches/football/?',
        multisport: 'https://api-archive.limaalef.com/v2/matches/multisport/?',
        allsports: 'https://api-archive.limaalef.com/v2/matches/all/?',
        motor: 'https://api-archive.limaalef.com/v2/motorsport/?',
        carnaval: 'https://api.limaalef.com/archive/matches?type=carnaval'
    },
    CF_API_URLS: {
        football: 'https://api-archive.limaalef.com/v2/matches/football/',
        multisport: 'https://api-archive.limaalef.com/v2/matches/multisport/',
        motor: 'https://api-archive.limaalef.com/v2/motorsport/',
        carnaval: 'https://api-archive.limaalef.com/matches/carnaval'
    },
    // Edição administrativa do matchdata (match-edit.html). Exige "Authorization: Bearer <token da sessão admin>".
    ADMIN_API_BASE:    'https://api-archive.limaalef.com/v2/admin',

    HOME_BROWSE_API_BASE: 'https://api-archive.limaalef.com/browse',
    BANNERS_API_BASE:  'https://api-archive.limaalef.com/banners',
    REQUEST_API_BASE:  'https://api-archive.limaalef.com',
    PAYMENTS_API_BASE: 'https://api-archive.limaalef.com',
    GOOGLE_CLIENT_ID:  '879308026481-pl1bc6q5vrdng493omm4i40nddavgt6a.apps.googleusercontent.com',
    CHANGELOG_URL:     'https://api-archive.limaalef.com/changelog',
    CONTEXT_API_URL:   'https://api.limaalef.com/archive/matches?', 
    IMAGE_CONTENT_URL: 'https://img.limaalef.com/',
    DEFAULT_ITEMS_PER_PAGE: 52,
    currentSport: 'football',
};

// ── Navegação inferior (modo webapp / celular) ─────────────────────────────
const AppNav = {
    ICONS: {
        home:       '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
        collection: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
        requests:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/></svg>',
        about:      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6h.01"/></svg>'
    },
    ITEMS: [
        { id: 'home',       href: 'index.html',       key: 'navHome',       pages: ['index'] },
        { id: 'about',      href: 'about.html',       key: 'navAbout',      pages: ['about'] },
        { id: 'collection', href: 'collection.html',  key: 'navCollection', pages: ['collection', 'detail', 'match', 'match-edit', 'watch', 'event', 'storage', 'changelog'] },
        { id: 'requests',   href: 'my-requests.html', key: 'myrequests',    pages: ['my-requests', 'request-detail'] }
    ],

    currentPage() {
        const name = location.pathname.split('/').pop().replace(/\.html$/, '');
        return name || 'index';
    },

    mount() {
        // A administração tem navegação própria (sidebar) e fica segregada do site.
        if (document.body.classList.contains('page-admin') || document.querySelector('.bottom-nav')) return;
        const page = this.currentPage();
        const nav = document.createElement('nav');
        nav.className = 'bottom-nav';
        nav.setAttribute('aria-label', 'Principal');
        // Acervo fica sempre no centro; os demais se distribuem no espaço de cada lado
        const link = item => {
            const active = item.pages.includes(page);
            return `<a href="${item.href}" data-nav="${item.id}" class="bottom-nav-item${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>
                ${this.ICONS[item.id]}<span data-i18n="${item.key}"></span></a>`;
        };
        const mid = this.ITEMS.findIndex(i => i.id === 'collection');
        nav.innerHTML = `<div class="bottom-nav-side bottom-nav-side--start">${this.ITEMS.slice(0, mid).map(link).join('')}</div>`
            + link(this.ITEMS[mid])
            + `<div class="bottom-nav-side bottom-nav-side--end">${this.ITEMS.slice(mid + 1).map(link).join('')}</div>`;
        document.body.appendChild(nav);
        document.body.classList.add('has-bottom-nav');
        // O módulo de pedidos (request.js) insere o carrinho nesta barra, como faz com o botão flutuante
        document.dispatchEvent(new CustomEvent('bottomnavmounted'));
    }
};

// ── Service worker (cache do "shell" para uso como webapp) ──────────────────
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW não registrado:', err));
    });
}

// Promise criada imediatamente — não depende de ordem de scripts
window._headerPromise = new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', async () => {
        const isMobile = window.matchMedia('(max-width: 496px)').matches;
        const container = document.getElementById('header');

        if (!isMobile) {
            fetch('/components/footer.html')
                .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
                .then(html => {
                    const footer = document.getElementById('footer');
                    if (!footer) return;
                    footer.innerHTML = html;
                    LanguageManager.updateAllTexts(false);
                    document.getElementById('currentYear').textContent = `2025-${new Date().getFullYear()}`;
                })
                .catch(err => console.warn('Footer não carregado:', err));
        }

        try {
            const res = await fetch('/components/header.html');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            container.innerHTML = await res.text();
            CONFIG._setupHeader(container, isMobile);
        } catch (err) {
            // Falha no carregamento não pode travar a inicialização da página.
            console.error('Header não carregado:', err);
            container.innerHTML = `<div class="header"><div class="container"><div class="header-content">
                <a class="logo-section" href="index.html"><h2 class="page-title">Sports Archive</h2></a></div></div></div>`;
        } finally {
            AppNav.mount();
            LanguageManager.updateAllTexts(false);
            resolve(); // sinaliza que o header está pronto
        }
    });
});

// Título do header. Aceita { key } (chave de translation.js, traduzida e atualizada ao trocar de idioma)
// ou { text } (texto fixo, ex.: o ID do pedido). Pode ser chamado antes do header carregar.
//   HTML:  <div class="header-frame" id="header" data-title-key="requestMyRequests" ...>
//   JS:    CONFIG.setHeaderTitle({ key: 'requestMyRequests' })  /  CONFIG.setHeaderTitle({ text: order.id })
CONFIG.setHeaderTitle = function ({ key, text } = {}) {
    const el = document.getElementById('page-title');
    if (!el) { CONFIG._pendingTitle = { key, text }; return; }
    if (key) {
        el.setAttribute('data-i18n', key);          // updateAllTexts() retraduz a cada troca de idioma
        el.textContent = LanguageManager.t(key);
    } else {
        el.removeAttribute('data-i18n');
        el.textContent = text || '';
    }
};

CONFIG._setupHeader = function (container, isMobile) {
    const logo = document.getElementById('logo-header-svg');
    const requestBtn = document.getElementById('headerRequestBtn');

    if (container.dataset.reqbtn === 'false') requestBtn.hidden = true;

    if ((isMobile || container.dataset.forced === 'true') && container.dataset.back === 'true') {
        CONFIG.setHeaderTitle(CONFIG._pendingTitle || (container.dataset.titleKey
            ? { key: container.dataset.titleKey }
            : { text: container.dataset.title }));

        document.getElementById('headerTitle').hidden = false;
        if (container.dataset.admin === 'true') {
            document.getElementById('headerTitleAdmin').hidden = false;
        }
        logo.style.display = 'none';
    }

    // Botão voltar
    if (isMobile && container.dataset.back === 'true') {
        const backBtn = document.createElement('a');
        backBtn.href = 'index.html';
        backBtn.className = 'btn back-btn';
        backBtn.setAttribute('aria-label', 'Voltar');
        backBtn.onclick = e => {
            e.preventDefault();
            history.length > 1 ? history.back() : location.href = 'index.html';
        };
        backBtn.innerHTML = `<span class="button-text">‹</span>`;
        document.getElementById('logo-header').prepend(backBtn);
    }

    CONFIG._setupHeaderUser(container).catch(err => console.warn('Menu de usuário não carregado:', err));

    // Ações extras
    const actions = container.dataset.actions;
    if (actions) {
        document.getElementById('header-actions').insertAdjacentHTML('afterbegin', actions);
    }
};

// ── Menu do usuário logado (padrão de avatar + menu no header) ─────────────
// A administração tem sessão e navegação próprias, então não recebe este menu.
CONFIG._setupHeaderUser = async function (container) {
    if (container.dataset.admin === 'true') return;
    const slot = document.getElementById('header-user');
    const requestBtn = document.getElementById('headerRequestBtn');
    if (!slot) return;

    if (typeof Auth === 'undefined') {
        await new Promise(resolve => {
            const s = document.createElement('script');
            s.src = '/js/auth.js'; s.onload = resolve; s.onerror = resolve;
            document.head.appendChild(s);
        });
    }
    if (typeof Auth === 'undefined') return;

    const esc = v => Utils.escapeHtml(v);
    const tr = k => LanguageManager.t(k);

    let closeTimer = null;
    function setOpen(open) {
        clearTimeout(closeTimer);
        const pop = slot.querySelector('.hu-pop');
        const trigger = slot.querySelector('.hu-trigger');
        if (!pop || !trigger) return;
        pop.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
    }
    const close = () => setOpen(false);
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

    function render() {
        const session = Auth.site;
        const logged = session.restore();
        slot.hidden = !logged;
        if (requestBtn) requestBtn.hidden = logged || container.dataset.reqbtn === 'false';
        if (!logged) { slot.innerHTML = ''; return; }

        const name = session.user?.name || session.user?.email || '';
        const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
        const pic = session.user?.picture;
        slot.innerHTML = `
            <button type="button" class="hu-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(name)}">
                <span class="hu-avatar-wrap">
                    <span class="hu-avatar">${esc(initials)}</span>
                    ${pic ? `<img class="hu-avatar hu-avatar-img" src="${esc(pic)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
                </span>
                <span class="hu-label">${esc(name)}</span>
            </button>
            <div class="hu-pop" hidden>
                <div class="hu-menu" role="menu">
                    <div class="hu-name">${esc(name)}</div>
                    <a role="menuitem" class="hu-item" href="my-requests.html">${tr('myrequests')}</a>
                    <button type="button" role="menuitem" class="hu-item hu-logout">${tr('requestLogout')}</button>
                </div>
            </div>`;

        const trigger = slot.querySelector('.hu-trigger');
        trigger.addEventListener('click', e => {
            e.stopPropagation();
            setOpen(slot.querySelector('.hu-pop').hidden);
        });
        slot.querySelector('.hu-logout').addEventListener('click', () => session.logout(() => location.reload()));
    }

    // Mouse: abre ao passar o cursor (pequeno atraso ao sair para não fechar sem querer). Toque: só por clique.
    slot.addEventListener('mouseenter', () => { if (canHover.matches) setOpen(true); });
    slot.addEventListener('mouseleave', () => {
        if (!canHover.matches) return;
        clearTimeout(closeTimer);
        closeTimer = setTimeout(close, 180);
    });
    slot.addEventListener('focusout', e => { if (!slot.contains(e.relatedTarget)) close(); });

    document.addEventListener('click', e => { if (!slot.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.addEventListener('authchange', render);
    document.addEventListener('languagechange', render);
    render();
};
