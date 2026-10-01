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
    REQUEST_API_BASE:  'https://api-archive.limaalef.com',
    PAYMENTS_API_BASE: 'https://api-archive.limaalef.com',
    GOOGLE_CLIENT_ID:  '879308026481-pl1bc6q5vrdng493omm4i40nddavgt6a.apps.googleusercontent.com',
    CHANGELOG_URL:     'https://api-archive.limaalef.com/changelog',
    CONTEXT_API_URL:   'https://api.limaalef.com/archive/matches?', 
    IMAGE_CONTENT_URL: 'https://img.limaalef.com/',
    DEFAULT_ITEMS_PER_PAGE: 200,
    currentSport: 'football',
};

// ── Navegação inferior (modo webapp / celular) ─────────────────────────────
const AppNav = {
    ICONS: {
        home:       '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
        collection: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
        requests:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/></svg>'
    },
    ITEMS: [
        { id: 'home',       href: 'index.html',       key: 'navHome',       pages: ['index'] },
        { id: 'collection', href: 'collection.html',  key: 'navCollection', pages: ['collection', 'detail', 'match', 'watch', 'event', 'storage', 'changelog'] },
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
        nav.innerHTML = this.ITEMS.map(item => {
            const active = item.pages.includes(page);
            return `<a href="${item.href}" class="bottom-nav-item${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>
                ${this.ICONS[item.id]}<span data-i18n="${item.key}"></span></a>`;
        }).join('');
        document.body.appendChild(nav);
        document.body.classList.add('has-bottom-nav');
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

CONFIG._setupHeader = function (container, isMobile) {
    const logo = document.getElementById('logo-header-svg');
    const requestBtn = document.getElementById('headerRequestBtn');

    if (container.dataset.reqbtn === 'false') requestBtn.hidden = true;

    if ((isMobile || container.dataset.forced === 'true') && container.dataset.back === 'true') {
        document.getElementById('page-title').textContent = container.dataset.title || '';

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

    // Ações extras
    const actions = container.dataset.actions;
    if (actions) {
        document.getElementById('header-actions').insertAdjacentHTML('afterbegin', actions);
    }
};
