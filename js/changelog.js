/* ── render ── */
function renderEntry(entry, index) {
    const s = entry.summary || {};
    const added     = s.added     || 0;
    const modified  = s.modified  || 0;
    const removed   = s.removed   || 0;

    const {mode, slug, modeName} = Utils.modeLabelName(entry.mode);

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
                    `<li><span class="fc-field">${Utils.escapeHtml(f.field)}</span><span class="fc-action fc-${f.action}">${LanguageManager.t(fcKey[f.action] || 'fc_modified')}</span></li>`
                  ).join('')}</ul>`
                : '';
            const idBadge = `<span class="change-id">${c.id != null ? '#' + c.id : '—'}</span>`;
            const descContent = c.id != null && c.action !== 'removed'
                ? `<span class="change-desc change-id-link"
                       title="${LanguageManager.t('viewDetails') || 'Ver detalhes'}"
                       onclick="MatchModal.fetchAndShow(${c.id}, '${slug}')">
                       ${Utils.escapeHtml(c.description || '')}
                       ${fieldHtml}
                   </span>`
                : `<span class="change-desc">${Utils.escapeHtml(c.description || '')}${fieldHtml}</span>`;
            return `
            <div class="change-item">
                ${idBadge}
                ${descContent}
            </div>`;
        }).join('');
        return `<div class="changes-section">
            <div class="changes-section-title ${cssClass}">${label}</div>
            ${rows}
        </div>`;
    }

    const bodyContent = (added + modified + removed) === 0
        ? `<div class="no-changes-msg">${LanguageManager.t('cl_noChanges')}</div>`
        : sectionHtml('added',    `${LanguageManager.t('cl_sectionAdded')}`,    'added')
        + sectionHtml('modified', `${LanguageManager.t('cl_sectionModified')}`, 'modified')
        + sectionHtml('removed',  `${LanguageManager.t('cl_sectionRemoved')}`,  'removed');

    return `
    <div class="sync-entry" id="entry-${index}">
        <div class="sync-entry-header" onclick="toggleEntry(${index})">
            <div class="sync-entry-left">
                <span class="sync-mode-badge mode-${mode}">${modeName}</span>
                
                <div class="sync-summary-pills">${pillsHtml || `<span class="pill pill-unchanged">0</span>`}</div>
            </div>
            <div class="sync-entry-right">
                <span class="sync-timestamp">${Utils.formatDateTime(entry.timestamp)}</span>
                <span class="expand-icon">▼</span>
            </div>
        </div>
        <div class="sync-entry-body">${bodyContent}</div>
    </div>`;
}

function toggleEntry(index) {
    const el = document.getElementById(`entry-${index}`);
    if (el) el.classList.toggle('open');
}

/* ── fetch & render ── */
async function loadChangelog() {
    const content = document.getElementById('changelogContent');

    content.innerHTML = `<div class="state-box"><h2>${LanguageManager.t('cl_loading')}</h2><p>${LanguageManager.t('cl_wait')}</p></div>`;

    try {
        const page = State.page
        const limit = State.limit
        const data = await APIService.fetchChangelog(page, limit);

        const items = data.data || [];
        State.totalPages = data.pagination?.total_pages || 1;

        if (items.length === 0) {
            content.innerHTML = Utils.sectionStateHtml('📭', `<h2>${LanguageManager.t('cl_empty')}</h2><p>${LanguageManager.t('cl_emptyMsg')}</p>`);
            return;
        }

        content.innerHTML = items.map((entry, i) => renderEntry(entry, i)).join('');
        updatePagination();

    } catch (err) {
        console.error(err)
        content.innerHTML = Utils.sectionStateHtml('❌', `<h2>${LanguageManager.t('cl_error')}</h2><p>${LanguageManager.t('cl_checkUrl')}</p><p style="font-size:.85em;margin-top:8px;color:var(--error-color)">${Utils.escapeHtml(err.message)}</p>`);
    }
}

function updatePagination() {
    const pag = document.getElementById('pagination');

    document.getElementById('pageNumber').textContent = State.page;
    document.getElementById('pageTotal').textContent = State.totalPages;
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
    limit:      10
};

/* ── init ── */
window.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;

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