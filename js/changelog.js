/* ── helpers ── */
function modeLabel(mode) {
    const map = {
        football:   { icon: '⚽', key: 'modeFootball' },
        multisport: { icon: '🏀', key: 'modeMultisport' },
        motorsport: { icon: '🏎️', key: 'modeMotorsport' }
    };
    const m = map[mode];
    if (m) return LanguageManager.t(m.key);
    return `📁 ${mode}`;
}

function formatTimestamp(ts) {
    if (!ts) return '';
    try {
        const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ts; }
}

function modeClass(mode) {
    return { football: 'mode-football', multisport: 'mode-multisport', motorsport: 'mode-motorsport' }[mode] || 'mode-motorsport';
}

/* ── render ── */
function renderEntry(entry, index) {
    const s = entry.summary || {};
    const added     = s.added     || 0;
    const modified  = s.modified  || 0;
    const removed   = s.removed   || 0;

    const pillsHtml = [
        added     ? `<span class="pill pill-added">+${added} ${LanguageManager.t('cl_added')}</span>`         : '',
        modified  ? `<span class="pill pill-modified">✏ ${modified} ${LanguageManager.t('cl_modified')}</span>` : '',
        removed   ? `<span class="pill pill-removed">−${removed} ${LanguageManager.t('cl_removed')}</span>`   : ''
    ].filter(Boolean).join('');

    // Group changes by action (respecting optional action filter)
    const changes = (entry.changes || []).filter(c => !State.action || c.action === State.action);

    const byAction = { added: [], modified: [], removed: [] };
    changes.forEach(c => { if (byAction[c.action]) byAction[c.action].push(c); });

    function sectionHtml(action, label, cssClass) {
        if (!byAction[action].length) return '';
        const fcKey = { added: 'fc_added', modified: 'fc_modified', removed: 'fc_removed' };
        const rows = byAction[action].map(c => {
            const fieldChanges = c.field_changes || [];
            const fieldHtml = fieldChanges.length
                ? `<ul class="field-changes-list">${fieldChanges.map(f =>
                    `<li><span class="fc-field">${escapeHtml(f.field)}</span><span class="fc-action fc-${f.action}">${LanguageManager.t(fcKey[f.action] || 'fc_modified')}</span></li>`
                  ).join('')}</ul>`
                : '';
            return `
            <div class="change-item">
                <span class="change-id">#${c.id ?? '—'}</span>
                <span class="change-desc">
                    ${escapeHtml(c.description || '')}
                    ${fieldHtml}
                </span>
            </div>`;
        }).join('');
        return `<div class="changes-section">
            <div class="changes-section-title ${cssClass}">${label}</div>
            ${rows}
        </div>`;
    }

    const bodyContent = (added + modified + removed) === 0
        ? `<div class="no-changes-msg">${LanguageManager.t('cl_noChanges')}</div>`
        : sectionHtml('added',    `✅ ${LanguageManager.t('cl_sectionAdded')}`,    'added')
        + sectionHtml('modified', `✏️ ${LanguageManager.t('cl_sectionModified')}`, 'modified')
        + sectionHtml('removed',  `🗑️ ${LanguageManager.t('cl_sectionRemoved')}`,  'removed');

    return `
    <div class="sync-entry" id="entry-${index}">
        <div class="sync-entry-header" onclick="toggleEntry(${index})">
            <div class="sync-entry-left">
                <span class="sync-mode-badge ${modeClass(entry.mode)}">${modeLabel(entry.mode)}</span>
                <span class="sync-timestamp">${formatTimestamp(entry.timestamp)}</span>
                <div class="sync-summary-pills">${pillsHtml || `<span class="pill pill-unchanged">0</span>`}</div>
            </div>
            <span class="expand-icon">▼</span>
        </div>
        <div class="sync-entry-body">${bodyContent}</div>
    </div>`;
}

function toggleEntry(index) {
    const el = document.getElementById(`entry-${index}`);
    if (el) el.classList.toggle('open');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ── fetch & render ── */
async function loadChangelog() {
    const content = document.getElementById('changelogContent');

    content.innerHTML = `<div class="state-box"><div class="icon">⏳</div><h2>${LanguageManager.t('cl_loading')}</h2><p>${LanguageManager.t('cl_wait')}</p></div>`;

    try {
        const url = new URL(CONFIG.CHANGELOG_URL);
        url.searchParams.set('page', State.page);
        url.searchParams.set('limit', State.limit);
        if (State.mode) url.searchParams.set('mode', State.mode);

        const resp = await fetch(url.toString());
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        if (!data.success) throw new Error('API retornou erro');

        const items = data.data || [];
        State.totalPages = data.pagination?.total_pages || 1;

        if (items.length === 0) {
            content.innerHTML = `<div class="state-box"><div class="icon">📭</div><h2>${LanguageManager.t('cl_empty')}</h2><p>${LanguageManager.t('cl_emptyMsg')}</p></div>`;
            document.getElementById('pagination').style.display = 'none';
            return;
        }

        content.innerHTML = items.map((entry, i) => renderEntry(entry, i)).join('');
        updatePagination();

    } catch (err) {
        content.innerHTML = `<div class="state-box"><div class="icon">❌</div><h2>${LanguageManager.t('cl_error')}</h2><p>${LanguageManager.t('cl_checkUrl')}</p><p style="font-size:.85em;margin-top:8px;color:var(--error-color)">${escapeHtml(err.message)}</p></div>`;
        document.getElementById('pagination').style.display = 'none';
    }
}

function updatePagination() {
    const pag = document.getElementById('pagination');
    pag.style.display = State.totalPages > 1 ? 'flex' : 'none';

    document.getElementById('pageInfo').textContent =
        `${LanguageManager.t('cl_pageWord')} ${State.page} ${LanguageManager.t('cl_ofWord')} ${State.totalPages}`;
    document.getElementById('firstPage').disabled = State.page === 1;
    document.getElementById('prevPage').disabled  = State.page === 1;
    document.getElementById('nextPage').disabled  = State.page === State.totalPages;
    document.getElementById('lastPage').disabled  = State.page === State.totalPages;
}

/* ── state ── */
const State = {
    page:       1,
    totalPages: 1,
    mode:       '',
    action:     '',
    limit:      50
};

/* ── init ── */
window.addEventListener('DOMContentLoaded', () => {
    LanguageManager.init();

    document.getElementById('modeFilter').addEventListener('change', e => {
        State.mode = e.target.value;
        State.page = 1;
        loadChangelog();
    });

    document.getElementById('actionFilter').addEventListener('change', e => {
        State.action = e.target.value;
        loadChangelog();
    });

    document.getElementById('limitFilter').addEventListener('change', e => {
        State.limit = parseInt(e.target.value);
        State.page  = 1;
        loadChangelog();
    });

    document.getElementById('firstPage').addEventListener('click', () => { State.page = 1; loadChangelog(); });
    document.getElementById('prevPage').addEventListener('click',  () => { State.page--; loadChangelog(); });
    document.getElementById('nextPage').addEventListener('click',  () => { State.page++; loadChangelog(); });
    document.getElementById('lastPage').addEventListener('click',  () => { State.page = State.totalPages; loadChangelog(); });

    loadChangelog();
});
