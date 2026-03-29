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
        const url = new URL(CONFIG.CHANGELOG_URL);
        url.searchParams.set('page', '1');
        url.searchParams.set('limit', '10');

        const resp = await fetch(url.toString());
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data.success) throw new Error('API error');

        renderRecentChanges(data.data || []);
    } catch (err) {
        container.innerHTML = `<div class="section-state"><div class="icon">❌</div><p>${LanguageManager.t('errorChanges')}</p></div>`;
        console.error('Changelog fetch error:', err);
    }
}

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
    });

    applyI18n();
    loadRecentChanges();
});
