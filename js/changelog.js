/* ── estado ── */
const State = {
    page:       1,
    totalPages: 1,
    mode:       '',
    action:     '',
    limit:      10,
    items:      [],
    lastSeen:   null   // data da última visita (localStorage), usada para marcar novidades
};

const SEEN_KEY = 'sa.changelog.lastSeen';

function readLastSeen() {
    try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
}
function writeLastSeen(value) {
    try { localStorage.setItem(SEEN_KEY, value); } catch { /* armazenamento indisponível */ }
}

/* ── datas ── */
function entryTime(entry) {
    const time = new Date(entry.timestamp).getTime();
    return Number.isNaN(time) ? 0 : time;
}

// Rótulo do dia: Hoje, Ontem ou data por extenso no idioma atual.
function dayLabel(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
    if (diff === 0) return LanguageManager.t('cl_today');
    if (diff === 1) return LanguageManager.t('cl_yesterday');
    const options = { day: 'numeric', month: 'long' };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
    return date.toLocaleDateString(LanguageManager.getLanguage(), options);
}

function dayKey(timestamp) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function timeOfDay(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(LanguageManager.getLanguage(), { hour: '2-digit', minute: '2-digit' });
}

/* ── render ── */
const ACTIONS = [
    { key: 'added',    label: 'cl_sectionAdded',    count: 'cl_added',    one: 'cl_addedOne' },
    { key: 'modified', label: 'cl_sectionModified', count: 'cl_modified', one: 'cl_modifiedOne' },
    { key: 'removed',  label: 'cl_sectionRemoved',  count: 'cl_removed',  one: 'cl_removedOne' }
];
const FIELD_ACTION_KEY = { added: 'fc_added', modified: 'fc_modified', removed: 'fc_removed' };

function changeRowHtml(change, slug) {
    const fieldChanges = change.field_changes || [];
    const fieldHtml = fieldChanges.length
        ? `<ul class="field-changes-list">${fieldChanges.map(f =>
            `<li><span class="fc-field">${Utils.escapeHtml(f.field)}</span><span class="fc-action fc-${f.action}">${LanguageManager.t(FIELD_ACTION_KEY[f.action] || 'fc_modified')}</span></li>`
          ).join('')}</ul>`
        : '';
    const idBadge = `<span class="change-id">${change.id != null ? '#' + change.id : '—'}</span>`;
    const text = `<span class="change-text">${Utils.escapeHtml(change.description || '')}</span>${fieldHtml}`;
    // Itens removidos não têm mais página para abrir.
    const body = change.id != null && change.action !== 'removed'
        ? `<button type="button" class="change-desc change-id-link" data-match-id="${change.id}" data-slug="${slug}" title="${LanguageManager.t('viewDetails') || ''}">${text}</button>`
        : `<div class="change-desc">${text}</div>`;
    return `<div class="change-item">${idBadge}${body}</div>`;
}

function entryHtml(entry, index, isNew) {
    const summary  = entry.summary || {};
    const total    = (summary.added || 0) + (summary.modified || 0) + (summary.removed || 0);
    const info     = Utils.modeLabelName(entry.mode);
    const changes  = (entry.changes || []).filter(c => !State.action || c.action === State.action);

    const counts = ACTIONS
        .filter(a => summary[a.key])
        .map(a => `<span class="change-count change-count--${a.key}"><i></i>${summary[a.key]} ${LanguageManager.t(summary[a.key] === 1 ? a.one : a.count)}</span>`)
        .join('');

    const sections = ACTIONS.map(a => {
        const rows = changes.filter(c => c.action === a.key);
        if (!rows.length) return '';
        return `<div class="changes-section">
            <div class="changes-section-title ${a.key}">${LanguageManager.t(a.label)} <span class="counter">${rows.length}</span></div>
            ${rows.map(c => changeRowHtml(c, info.slug)).join('')}
        </div>`;
    }).join('');

    const body = total === 0
        ? `<div class="no-changes-msg">${LanguageManager.t('cl_noChanges')}</div>`
        : sections || `<div class="no-changes-msg">${LanguageManager.t('cl_noChanges')}</div>`;

    return `
    <article class="sync-entry${isNew ? ' sync-entry--new' : ''}" id="entry-${index}" style="--tint: var(--mode-${info.slug})">
        <button type="button" class="sync-entry-header" aria-expanded="false" aria-controls="entry-body-${index}" data-toggle="${index}">
            <span class="sync-entry-title">
                <span class="mode-dot" aria-hidden="true"></span>
                <span class="sync-mode-name">${info.modeName}</span>
                ${isNew ? `<span class="new-marker">${LanguageManager.t('cl_new')}</span>` : ''}
            </span>
            <span class="sync-summary-pills row-wrap">${counts || `<span class="change-count"><i></i>${LanguageManager.t('cl_unchanged')}</span>`}</span>
            <span class="sync-timestamp">${timeOfDay(entry.timestamp)}</span>
            <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>
        </button>
        <div class="sync-entry-body" id="entry-body-${index}" role="region">${body}</div>
    </article>`;
}

function isNewEntry(entry) {
    return State.lastSeen !== null && entryTime(entry) > new Date(State.lastSeen).getTime();
}

function renderTimeline() {
    const content = document.getElementById('changelogContent');
    const news = document.getElementById('changelogNews');
    const items = State.items;

    if (items.length === 0) {
        content.innerHTML = `<div class="status-message"><strong>${LanguageManager.t('cl_empty')}</strong><br>${LanguageManager.t('cl_emptyMsg')}</div>`;
        news.classList.add('is-hidden');
        return;
    }

    let html = '';
    let currentDay = null;
    items.forEach((entry, index) => {
        const key = dayKey(entry.timestamp);
        if (key !== currentDay) {
            if (currentDay !== null) html += '</section>';
            html += `<section class="changelog-day"><h2 class="changelog-day-title">${dayLabel(entry.timestamp)}</h2>`;
            currentDay = key;
        }
        html += entryHtml(entry, index, isNewEntry(entry));
    });
    content.innerHTML = html + '</section>';

    // Novidades: só faz sentido na primeira página, sem filtros, e depois da primeira visita.
    const fresh = items.filter(isNewEntry).length;
    if (fresh > 0 && State.page === 1) {
        news.textContent = fresh === 1
            ? LanguageManager.t('cl_newOne')
            : LanguageManager.t('cl_newMany').replace('{n}', fresh);
        news.classList.remove('is-hidden');
    } else {
        news.classList.add('is-hidden');
    }

    // A entrada mais recente já abre aberta.
    const first = document.getElementById('entry-0');
    if (first) setEntryOpen(first, true);
}

function setEntryOpen(entryEl, open) {
    entryEl.classList.toggle('open', open);
    const header = entryEl.querySelector('.sync-entry-header');
    if (header) header.setAttribute('aria-expanded', String(open));
}

/* ── carregamento ── */
function skeletonHtml() {
    return `<div class="skeleton-row"><span class="skeleton skeleton--short"></span><span class="skeleton skeleton--line"></span></div>`.repeat(3);
}

async function loadChangelog() {
    const content = document.getElementById('changelogContent');
    content.innerHTML = skeletonHtml();
    content.setAttribute('aria-busy', 'true');

    try {
        const data = await APIService.fetchChangelog(State.page, State.limit, { mode: State.mode });

        // O filtro é enviado à API; o filtro local garante o resultado mesmo que ela o ignore.
        let items = data.data || [];
        if (State.mode) items = items.filter(entry => entry.mode === State.mode);
        State.items = items;
        State.totalPages = data.pagination?.total_pages || 1;

        renderTimeline();
        updatePagination();

        // Marca a visita: só a primeira página sem filtro representa "o que há de novo".
        if (State.page === 1 && !State.mode && items.length) {
            const newest = items.reduce((max, e) => Math.max(max, entryTime(e)), 0);
            if (newest) writeLastSeen(new Date(newest).toISOString());
        }
    } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="status-message"><strong>${LanguageManager.t('cl_error')}</strong><br>${LanguageManager.t('cl_checkUrl')}<br><small>${Utils.escapeHtml(err.message)}</small></div>`;
    } finally {
        content.removeAttribute('aria-busy');
    }
}

function updatePagination() {
    document.getElementById('pageNumber').textContent = State.page;
    document.getElementById('pageTotal').textContent = State.totalPages;
    document.getElementById('firstPage').disabled = State.page === 1;
    document.getElementById('prevPage').disabled  = State.page === 1;
    document.getElementById('nextPage').disabled  = State.page >= State.totalPages;
    document.getElementById('lastPage').disabled  = State.page >= State.totalPages;
    document.getElementById('pagination').hidden  = State.totalPages <= 1;
}

/* ── chips de filtro ── */
function bindChips(groupId, onChange) {
    const group = document.getElementById(groupId);
    group.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        group.querySelectorAll('.chip').forEach(c => {
            c.classList.toggle('active', c === chip);
            c.setAttribute('aria-pressed', String(c === chip));
        });
        onChange(chip.dataset.value);
    });
    group.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.classList.contains('active'))));
}

/* ── init ── */
window.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;
    State.lastSeen = readLastSeen();

    bindChips('modeFilter', value => { State.mode = value; State.page = 1; loadChangelog(); });
    // O filtro de ação só muda a exibição local: não precisa nova requisição.
    bindChips('actionFilter', value => { State.action = value; renderTimeline(); });

    document.getElementById('limitFilter').addEventListener('change', e => {
        State.limit = parseInt(e.target.value, 10);
        State.page  = 1;
        loadChangelog();
    });

    document.getElementById('firstPage').addEventListener('click', () => { State.page = 1; loadChangelog(); });
    document.getElementById('prevPage').addEventListener('click',  () => { State.page--; loadChangelog(); });
    document.getElementById('nextPage').addEventListener('click',  () => { State.page++; loadChangelog(); });
    document.getElementById('lastPage').addEventListener('click',  () => { State.page = State.totalPages; loadChangelog(); });

    // Delegação: abrir/fechar entrada e abrir a partida
    document.getElementById('changelogContent').addEventListener('click', e => {
        const toggle = e.target.closest('[data-toggle]');
        if (toggle) {
            const entry = document.getElementById(`entry-${toggle.dataset.toggle}`);
            setEntryOpen(entry, !entry.classList.contains('open'));
            return;
        }
        const link = e.target.closest('.change-id-link');
        if (link) MatchModal.fetchAndShow(Number(link.dataset.matchId), link.dataset.slug);
    });

    // Troca de idioma: redesenha com os dados já carregados
    document.addEventListener('languagechange', () => { if (State.items.length) renderTimeline(); });

    loadChangelog();
});
