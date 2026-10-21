/* =============================================
   storage.js — Armazenamento por disco
   Fonte: API /storage/disks. A listagem do conteúdo de cada disco
   fica em detail.html?type=storage&q=<nome do disco>.
   ============================================= */

// Entradas da planilha que não são hardware: vão para "Nuvem e outros locais"
const PSEUDO_DISKS = {
    'nuvem':       'sdCloud',
    'local':       'sdLocal',
    'para baixar': 'sdQueue',
};

// Situação do disco (a cor só aparece na bolinha, como nas demais telas)
const DISK_STATES = {
    over:    { label: 'sdStateOver',    kind: 'error'   },
    full:    { label: 'sdStateFull',    kind: 'off'     },
    near:    { label: 'sdStateNear',    kind: 'waiting' },
    ok:      { label: 'sdStateOk',      kind: 'success' },
    unknown: { label: 'sdStateUnknown', kind: 'off'     },
};

const SortFns = {
    free:    (a, b) => b.freeGB - a.freeGB,
    pct:     (a, b) => b.pct - a.pct,
    total:   (a, b) => b.totalGB - a.totalGB,
    archive: (a, b) => b.archiveGB - a.archiveGB,
    name:    (a, b) => a.name.localeCompare(b.name, LanguageManager.getLanguage(), { numeric: true }),
};

const StorageState = { all: [], disks: [], others: [], updatedAt: null, filter: 'all', sort: 'free', query: '' };

// ─── Helpers ─────────────────────────────────────
const sdEsc = Utils.escapeHtml.bind(Utils);
const sdNorm = Utils.normalizeSearch.bind(Utils);
const t = (key, vars = {}) => Object.entries(vars).reduce((txt, [k, v]) => txt.replace(`{${k}}`, v), LanguageManager.t(key));
const nf = (v, d = 1) => v.toLocaleString(LanguageManager.getLanguage(), { minimumFractionDigits: d, maximumFractionDigits: d });

function formatGB(gb) {
    if (gb === null || gb === undefined || isNaN(gb)) return '—';
    return gb >= 1024 ? `${nf(gb / 1024)} TB` : `${nf(gb)} GB`;
}

// ─── Carregamento ────────────────────────────────
async function loadDisks() {
    const res = await fetch(`${CONFIG.REQUEST_API_BASE}/storage/disks`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // A API devolve { data: [ [ { summary, disks } ], { registros, espaco } ] }
    const payload = Array.isArray(json.data?.[0]) ? json.data[0][0] : json.data;
    if (!payload || !Array.isArray(payload.disks)) throw new Error('Resposta inesperada da API');
    return payload;
}

// A API devolve free_gb = 0 e used_pct acima de 100%: o que vale é capacidade, arquivo e total usado.
function normalizeDisk(d) {
    const totalGB   = d.total_gb || 0;
    const usedGB    = d.used_gb  || 0;
    const archiveGB = Math.min(d.archive_gb || 0, usedGB);
    const otherGB   = Math.max(usedGB - archiveGB, 0);
    const knownTotal = totalGB > 0;
    const pct       = knownTotal ? (usedGB / totalGB) * 100 : 0;
    const freeGB    = knownTotal ? Math.max(totalGB - usedGB, 0) : 0;
    const key = !knownTotal ? 'unknown' : pct > 100 ? 'over' : pct >= 98 ? 'full' : pct >= 90 ? 'near' : 'ok';
    const pseudo = PSEUDO_DISKS[sdNorm(d.name)];
    return {
        ...d, totalGB, usedGB, archiveGB, otherGB, freeGB, pct, knownTotal, state: key,
        physical: !pseudo && d.brand !== null,
        kindLabel: pseudo ? t(pseudo) : null,
        search: sdNorm([d.name, d.brand, d.model, d.serial, d.disk_type, d.format].filter(Boolean).join(' ')),
    };
}

// ─── Resumo geral (só discos físicos) ────────────
function renderSummary() {
    const disks = StorageState.disks;
    const cap = disks.reduce((a, d) => a + d.totalGB, 0);
    // Disco acima da capacidade entra limitado a 100% para a soma fechar: arquivo + outros + livre = capacidade
    let archive = 0, other = 0, free = 0;
    disks.forEach(d => {
        const scale = d.usedGB > d.totalGB && d.usedGB > 0 ? d.totalGB / d.usedGB : 1;
        archive += d.archiveGB * scale;
        other   += d.otherGB * scale;
        free    += d.freeGB;
    });
    const used = archive + other;
    const over = disks.filter(d => d.state === 'over').length;
    const pctOf = v => cap > 0 ? (v / cap) * 100 : 0;

    document.getElementById('sdSummary').innerHTML = `
        <div class="stat-tile-grid">
            ${statTile(disks.length, t('sdTilePhysical'))}
            ${statTile(formatGB(cap), t('sdTileCapacity'))}
            ${statTile(formatGB(used), `${t('sdTileUsed')} · ${nf(pctOf(used), 0)}%`)}
            ${statTile(formatGB(free), `${t('sdTileFree')} · ${nf(pctOf(free), 0)}%`, true)}
        </div>
        <div class="usage-bar usage-bar--large" role="img" aria-label="${t('sdSpaceAria')}">
            <span class="usage-bar-segment usage-bar-segment--archive" style="width:${pctOf(archive)}%"></span>
            <span class="usage-bar-segment usage-bar-segment--other"   style="width:${pctOf(other)}%"></span>
        </div>
        <div class="usage-legend">
            <span><i class="usage-legend-key usage-legend-key--archive"></i>${t('sdLegendArchive')} <b>${formatGB(archive)}</b></span>
            <span><i class="usage-legend-key usage-legend-key--other"></i>${t('sdLegendOther')} <b>${formatGB(other)}</b></span>
            <span><i class="usage-legend-key usage-legend-key--free"></i>${t('sdTileFree')} <b>${formatGB(free)}</b></span>
        </div>
        ${over ? `<p class="sd-note">${t(over === 1 ? 'sdOverNoteOne' : 'sdOverNoteMany', { n: over })}</p>` : ''}`;

    if (StorageState.updatedAt) {
        const d = new Date(StorageState.updatedAt);
        if (!isNaN(d)) document.getElementById('sdUpdated').textContent =
            t('sdUpdated') + ' ' + Utils.formatDateTime(d);
    }
}

// ─── Filtros ─────────────────────────────────────
function renderChips() {
    const count = k => StorageState.disks.filter(d => d.state === k).length;
    const chips = [
        ['all',  t('sdChipAll'),  StorageState.disks.length],
        ['ok',   t('sdChipOk'),   count('ok')],
        ['near', t('sdChipNear'), count('near')],
        ['full', t('sdChipFull'), count('full')],
        ['over', t('sdChipOver'), count('over')],
    ].filter(([k, , n]) => k === 'all' || n > 0);
    if (!chips.some(([k]) => k === StorageState.filter)) StorageState.filter = 'all';
    document.getElementById('sdChips').innerHTML = chips.map(([k, label, n]) =>
        `<button type="button" class="chip ${StorageState.filter === k ? 'active' : ''}" data-filter="${k}">${label} <span>${n}</span></button>`).join('');
}

function visibleDisks() {
    const { disks, filter, query, sort } = StorageState;
    const q = sdNorm(query.trim());
    return disks
        .filter(d => (filter === 'all' || d.state === filter) && (!q || d.search.includes(q)))
        .sort(SortFns[sort] || SortFns.free);
}

// ─── Linha de disco ──────────────────────────────
const diskHref = d => `detail.html?type=storage&q=${encodeURIComponent(d.name)}`;

// Linha enxuta: só o que responde "quanto tem sobrando". Dados técnicos ficam na ficha (modal).
function diskRow(d, idx) {
    const denom = Math.max(d.totalGB, d.usedGB) || 1;
    const aW = (d.archiveGB / denom) * 100, oW = (d.otherGB / denom) * 100;
    const st = DISK_STATES[d.state];
    const pctTxt = d.knownTotal ? `${nf(d.pct, d.pct > 100 ? 0 : 1)}%` : '—';

    return `
    <button type="button" class="sd-row" data-disk="${idx}" aria-haspopup="dialog">
        <div class="sd-id">
            <div class="sd-name">${sdEsc(d.name)}</div>
            ${d.kindLabel ? `<div class="sd-sub">${sdEsc(d.kindLabel)}</div>` : ''}
        </div>
        <div class="sd-usage">
            ${d.knownTotal ? `
            <div class="usage-bar" role="img" aria-label="${t('sdUsedAria', { pct: pctTxt })}">
                <span class="usage-bar-segment usage-bar-segment--archive" style="width:${aW}%"></span>
                <span class="usage-bar-segment usage-bar-segment--other"   style="width:${oW}%"></span>
            </div>` : '<div class="usage-bar usage-bar--empty"></div>'}
            <div class="usage-legend usage-legend--small">
                ${d.archiveGB > 0 || d.otherGB === 0 ? `<span><i class="usage-legend-key usage-legend-key--archive"></i>${t('sdArchiveShort')} ${formatGB(d.archiveGB)}</span>` : ''}
                ${d.otherGB > 0 ? `<span><i class="usage-legend-key usage-legend-key--other"></i>${t('sdOtherShort')} ${formatGB(d.otherGB)}</span>` : ''}
            </div>
        </div>
        <div class="sd-num"><strong>${formatGB(d.usedGB)}</strong><span>${d.knownTotal ? t('sdOf') + ' ' + formatGB(d.totalGB) : t('sdUsedPl')}</span></div>
        <div class="sd-num"><strong>${d.knownTotal ? formatGB(d.freeGB) : '—'}</strong><span>${t('sdFreePl')}</span></div>
        <div class="sd-state">${pill(st.kind, t(st.label))}<span class="sd-pct">${pctTxt}</span></div>
        <span class="sd-go" aria-hidden="true">${icon('chevron-right', 16)}</span>
    </button>`;
}

function renderList() {
    const list = document.getElementById('sdList');
    const rows = visibleDisks();
    document.getElementById('sdDiskCount').textContent = rows.length === StorageState.disks.length ? '' : `${rows.length} ${t('sdOf')} ${StorageState.disks.length}`;
    list.innerHTML = rows.length
        ? `<div class="sd-head" aria-hidden="true"><span>${t('sdColDisk')}</span><span>${t('sdColUse')}</span><span>${t('sdColUsed')}</span><span>${t('sdColFree')}</span><span>${t('sdColState')}</span><span></span></div>` + rows.map(d => diskRow(d, StorageState.all.indexOf(d))).join('')
        : `<div class="status-message">${t('sdNone')}</div>`;
}

function renderOthers() {
    const sec = document.getElementById('sdOthersSection');
    sec.hidden = !StorageState.others.length;
    document.getElementById('sdOthers').innerHTML = StorageState.others.map(d => diskRow(d, StorageState.all.indexOf(d))).join('');
}

// ─── Ficha técnica (modal) ───────────────────────
function openDiskModal(d, opener) {
    const st = DISK_STATES[d.state];
    const denom = Math.max(d.totalGB, d.usedGB) || 1;
    const kv = (k, v) => v === null || v === undefined || v === '' || v === '-' ? '' :
        keyValueRow(k, sdEsc(v));
    const pctTxt = d.knownTotal ? `${nf(d.pct, d.pct > 100 ? 0 : 1)}%` : '—';
    document.getElementById('sdModalBody').innerHTML = `
        <div class="sd-modal-head">
            <h3 id="sdModalTitle">${sdEsc(d.name)}</h3>
            ${pill(st.kind, t(st.label))}
        </div>
        ${d.knownTotal ? `
        <div class="usage-bar usage-bar--large">
            <span class="usage-bar-segment usage-bar-segment--archive" style="width:${(d.archiveGB / denom) * 100}%"></span>
            <span class="usage-bar-segment usage-bar-segment--other"   style="width:${(d.otherGB / denom) * 100}%"></span>
        </div>` : ''}
        <div class="sd-modal-sec">
            <h4>${t('sdSpace')}</h4>
            ${kv(t('sdCapacity'), d.knownTotal ? formatGB(d.totalGB) : null)}
            ${kv(t('sdColUsed'), `${formatGB(d.usedGB)}${d.knownTotal ? ' · ' + pctTxt : ''}`)}
            ${kv(t('sdLegendArchive'), formatGB(d.archiveGB))}
            ${kv(t('sdLegendOther'), formatGB(d.otherGB))}
            ${kv(t('sdTileFree'), d.knownTotal ? formatGB(d.freeGB) : null)}
        </div>
        <div class="sd-modal-sec">
            <h4>${t('sdFeatures')}</h4>
            ${kv(t('sdBrand'), d.brand)}${kv(t('sdModel'), d.model)}${kv(t('sdType'), d.disk_type)}${kv(t('sdFormat'), d.format)}
            ${kv(t('sdInterface'), d.interface)}${kv(t('sdSerial'), d.serial)}${kv(t('sdPurchase'), d.purchase_year)}
            ${kv(t('sdStatus'), d.status)}${kv(t('sdDescription'), d.kindLabel)}
        </div>
        ${d.notes ? `<div class="sd-modal-sec"><h4>${t('sdNotes')}</h4><p class="sd-modal-notes">${sdEsc(d.notes)}</p></div>` : ''}
        <a class="button button--solid button--block" href="${diskHref(d)}">${t('sdViewContent')} ${icon('chevron-right', 16)}</a>`;
    const m = document.getElementById('sdModal');
    m.hidden = false;
    document.body.classList.add('sd-lock');
    m._opener = opener;
    document.getElementById('sdModalClose').focus();
}
function closeDiskModal() {
    const m = document.getElementById('sdModal');
    if (m.hidden) return;
    m.hidden = true;
    document.body.classList.remove('sd-lock');
    m._opener?.focus();
}

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;
    const summaryEl = document.getElementById('sdSummary');
    try {
        const payload = await loadDisks();
        const all = payload.disks.filter(d => d.name).map(normalizeDisk);
        StorageState.all       = all;
        StorageState.disks     = all.filter(d => d.physical);
        StorageState.others    = all.filter(d => !d.physical).sort(SortFns.total);
        StorageState.updatedAt = payload.updated_at || null;
        renderSummary(); renderChips(); renderList(); renderOthers();
        document.addEventListener('languagechange', () => {
            StorageState.others.concat(StorageState.disks).forEach(d => { const p = PSEUDO_DISKS[sdNorm(d.name)]; d.kindLabel = p ? t(p) : null; });
            renderSummary(); renderChips(); renderList(); renderOthers();
        });
    } catch (err) {
        console.warn('Storage:', err);
        summaryEl.innerHTML = `<div class="sd-error">
            <p>${t('sdLoadError', { msg: sdEsc(err.message) })}</p>
            <button type="button" class="button" onclick="location.reload()">${t('sdRetry')}</button></div>`;
        document.getElementById('sdList').innerHTML = '';
        return;
    }

    const openFromList = e => {
        const row = e.target.closest('.sd-row'); if (!row) return;
        openDiskModal(StorageState.all[+row.dataset.disk], row);
    };
    document.getElementById('sdList').addEventListener('click', openFromList);
    document.getElementById('sdOthers').addEventListener('click', openFromList);
    document.getElementById('sdModalClose').addEventListener('click', closeDiskModal);
    document.getElementById('sdModal').addEventListener('click', e => { if (e.target.id === 'sdModal') closeDiskModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDiskModal(); });

    document.getElementById('sdChips').addEventListener('click', e => {
        const b = e.target.closest('.chip'); if (!b) return;
        StorageState.filter = b.dataset.filter; renderChips(); renderList();
    });
    document.getElementById('sdSort').addEventListener('change', e => { StorageState.sort = e.target.value; renderList(); });
    let searchTimer;
    document.getElementById('sdSearch').addEventListener('input', e => {
        clearTimeout(searchTimer); searchTimer = setTimeout(() => { StorageState.query = e.target.value; renderList(); }, 150);
    });
});
