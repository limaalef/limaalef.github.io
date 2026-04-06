/* ── helpers ── */
function formatTimestamp(ts) {
    if (!ts) return '';
    try {
        const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ts.slice(0, 16).replace('T', ' '); }
}

function modeLabel(mode) {
    const map = { football: 'modeFootball', multisport: 'modeMultisport', motorsport: 'modeMotorsport' };
    return LanguageManager.t(map[mode] ?? 'modeFootball');
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── render the 3 most recent sync groups ── */
function renderRecentChanges(entries) {
    const groups = entries.slice(0, 3);
    const container = document.getElementById('recentChanges');

    if (groups.length === 0) {
        container.innerHTML = `<div class="section-state"><div class="icon">📭</div><p>${LanguageManager.t('noChanges')}</p></div>`;
        return;
    }

    container.innerHTML = groups.map(entry => {
        const s = entry.summary || {};
        const added    = s.added    || 0;
        const modified = s.modified || 0;
        const removed  = s.removed  || 0;

        const pills = [
            added    ? `<span class="pill pill-added">+${added} ${LanguageManager.t('cl_added')}</span>`         : '',
            modified ? `<span class="pill pill-modified">✏ ${modified} ${LanguageManager.t('cl_modified')}</span>` : '',
            removed  ? `<span class="pill pill-removed">−${removed} ${LanguageManager.t('cl_removed')}</span>`   : '',
        ].filter(Boolean).join('');

        const changes = entry.changes || [];
        const MAX_SHOWN = 3;
        const shown    = changes.slice(0, MAX_SHOWN);
        const overflow = changes.length - MAX_SHOWN;

        const itemsHtml = shown.map(c => `
            <div class="cl-group-item">
                <div class="cl-dot ${c.action}"></div>
                <span class="cl-item-desc">${escapeHtml(c.description || 'ID ' + c.id)}</span>
                <span class="cl-item-badge ${c.action}">${LanguageManager.t('action' + c.action.charAt(0).toUpperCase() + c.action.slice(1))}</span>
            </div>`).join('');

        const overflowHtml = overflow > 0
            ? `<div class="cl-group-overflow">+ ${overflow} ${LanguageManager.t('overflowSuffix')}</div>`
            : '';

        return `
        <div class="cl-group">
            <div class="cl-group-header">
                <div class="cl-group-pills">${pills || '<span class="pill pill-unchanged">0</span>'}</div>
                <span class="cl-group-ts">${formatTimestamp(entry.timestamp)}</span>
            </div>
            <div class="cl-group-items">
                ${itemsHtml}
                ${overflowHtml}
            </div>
        </div>`;
    }).join('');
}

/* ── fetch changelog, no filters, grab latest entries ── */
async function loadRecentChanges() {
    const container = document.getElementById('recentChanges');
    try {
        const page = '1'
        const limit = '3'
        const data = await APIService.fetchChangelog(page, limit);

        renderRecentChanges(data.data || []);
    } catch (err) {
        container.innerHTML = `<div class="section-state"><div class="icon">❌</div><p>${LanguageManager.t('errorChanges')}</p></div>`;
        console.error('Changelog fetch error:', err);
    }
}

async function todayDate(data) {
    const [year, month, day] = (data.filters.search).split('-');
    const date = new Date(year, month - 1, day); // mês começa em 0

    const result = date.toLocaleDateString(navigator.language, {
        day: 'numeric',
        month: 'long'
    });

    document.getElementById('today-date').textContent = `${result}`;
}

/* ── Today in History ── */
const TodayInHistory = {
    items: [],

    async load() {
        const container = document.getElementById('todayHistory');
        try {
            const data = await APIService.fetchTodayInHistory();
            todayDate(data)
            this.items = APIService.transformData(data);
            this.render();
            
        } catch (err) {
            container.innerHTML = `<div class="section-state"><div class="icon">❌</div><p>${LanguageManager.t('errorChanges')}</p></div>`;
            console.error('TodayInHistory error:', err);
        }
    },

    _cardHtml(item) {
        const id   = item.ID;
        const year = Utils.parseDate(item.Data)?.getFullYear() || (item.Data || '').slice(0, 4) || '?';

        const gh = item['Gols mandante']  ?? '';
        const ga = item['Gols visitante'] ?? '';
        const homeWinner = gh !== '' && ga !== '' && Number(gh) > Number(ga);
        const awayWinner = gh !== '' && ga !== '' && Number(ga) > Number(gh);
        const scoreHtml  = gh !== '' && ga !== ''
            ? `<span class="tih-score ${homeWinner ? 'winner' : ''}">${gh}</span>
               <span class="tih-score-sep">–</span>
               <span class="tih-score ${awayWinner ? 'winner' : ''}">${ga}</span>`
            : `<span class="tih-score-sep">vs</span>`;

        const comp     = escapeHtml(item.Competição || '');
        const fase     = escapeHtml(item.Fase       || '');
        const home     = escapeHtml(item.Mandante   || '?');
        const away     = escapeHtml(item.Visitante  || '?');
        const homeLogo = item['Logo mandante']  ? `<img src="${item['Logo mandante']}"  class="tih-team-logo" onerror="this.style.display='none'">` : '';
        const awayLogo = item['Logo visitante'] ? `<img src="${item['Logo visitante']}" class="tih-team-logo" onerror="this.style.display='none'">` : '';

        return `
        <div class="tih-card" onclick="TodayModal.show(${id}, 'football')">
            <div class="tih-card-top">
                <span class="tih-card-year">${year}</span>
                <span class="tih-card-comp">${LanguageManager.translateText(comp)}${fase ? ` · ${LanguageManager.translateText(fase)}` : ''}</span>
            </div>
            <div class="tih-card-match">
                <div class="tih-team ${homeWinner ? 'winner' : ''}">
                    ${homeLogo}
                    <span class="tih-team-name">${home}</span>
                </div>
                <div class="tih-card-score">${scoreHtml}</div>
                <div class="tih-team away ${awayWinner ? 'winner' : ''}">
                    ${awayLogo}
                    <span class="tih-team-name">${away}</span>
                </div>
            </div>
        </div>`;
    },

    render() {
        const container  = document.getElementById('todayHistory');
        const pagination = document.getElementById('tihPagination');

        if (this.items.length === 0) {
            container.innerHTML = `<div class="section-state"><div class="icon">📭</div><p>${LanguageManager.t('noChanges')}</p></div>`;
            pagination.style.display = 'none';
            return;
        }

        // Renderiza todos os cards — o CSS cuida do scroll snap
        container.innerHTML = `<div class="tih-grid" id="tihGrid">${this.items.map(i => this._cardHtml(i)).join('')}</div>`;

        pagination.style.display = this.items.length > 1 ? 'flex' : 'none';
        this._updateNav();

        // Atualiza indicador de página ao scrollar
        const grid = document.getElementById('tihGrid');
        grid.addEventListener('scroll', () => this._onScroll(), { passive: true });
    },

    // Seta avança/volta pela largura visível do grid (um "viewport" de cards)
    prev() {
        const grid = document.getElementById('tihGrid');
        if (!grid) return;
        grid.scrollBy({ left: -grid.clientWidth, behavior: 'smooth' });
    },

    next() {
        const grid = document.getElementById('tihGrid');
        if (!grid) return;
        grid.scrollBy({ left: grid.clientWidth, behavior: 'smooth' });
    },

    _onScroll() {
        this._updateNav();
        this._updatePageInfo();
    },

    _updateNav() {
        const grid = document.getElementById('tihGrid');
        if (!grid) return;
        const atStart = grid.scrollLeft <= 4;
        const atEnd   = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 4;
        document.getElementById('tihPrev').disabled = atStart;
        document.getElementById('tihNext').disabled = atEnd;
    },

    _updatePageInfo() {
        const grid = document.getElementById('tihGrid');
        if (!grid) return;
        // Estima página atual baseado na posição de scroll
        const cardW  = grid.querySelector('.tih-card')?.offsetWidth || 1;
        const gap    = 10;
        const perPage = Math.max(1, Math.round(grid.clientWidth / (cardW + gap)));
        const current = Math.round(grid.scrollLeft / (cardW + gap) / perPage) + 1;
        const total   = Math.ceil(this.items.length / perPage);
    },
};

const TodayModal = {
    show(id, sport) {
        MatchModal.fetchAndShow(id, sport);
    },
    close() {
        document.getElementById('modal').classList.remove('active');
    }
};

/* ── apply i18n to static elements ── */
function applyI18n() {
    const ids = [
        'sectionChangesTitle', 'seeAllLink',
        'sectionHDTitle', 'sectionDataTitle',
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = LanguageManager.t(id);
    });
    document.querySelectorAll('.coming-soon-body p').forEach(el => {
        el.textContent = LanguageManager.t('comingSoon');
    });
}

/* ── init ── */
window.addEventListener('DOMContentLoaded', () => {
    LanguageManager.init();

    document.getElementById('langToggle').addEventListener('click', () => {
        const newLang = LanguageManager.currentLang === 'pt-BR' ? 'en' : 'pt-BR';
        LanguageManager.setLanguage(newLang, false);
        applyI18n();
        loadRecentChanges();
        TodayInHistory.load();
    });

    document.getElementById('tihPrev').addEventListener('click', () => TodayInHistory.prev());
    document.getElementById('tihNext').addEventListener('click', () => TodayInHistory.next());

    applyI18n();
    loadRecentChanges();
    TodayInHistory.load();
});