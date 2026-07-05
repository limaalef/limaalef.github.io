/* =============================================
   storage.js — Página de Storage Management
   Combina dados reais dos discos (API /storage/disks)
   com os jogos agregados por Local (CF_API_URLS)
   ============================================= */

const VOLUME_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

const COMP_COLORS = {
    'copa do mundo': '#ef4444',
    'world cup':     '#ef4444',
    'champions':     '#3b82f6',
    'libertadores':  '#7c3aed',
    'brasileirão':   '#10b981',
    'brasileiro':    '#10b981',
    'paulistão':     '#10b981',
    'premier':       '#3b82f6',
};

// Nomes de "discos" que são apenas categorias da planilha, não hardware real
const PSEUDO_DISKS = new Set(['local', 'nuvem', 'para baixar', 'desconhecido']);

// ─── Estado ─────────────────────────────────────
const StorageState = {
    allMatches:       [],
    volumes:          [],
    diskSummary:      null,
    cloud:            null,
    currentVolume:    null,
    filteredMatches:  [],
    currentPage:      1,
    itemsPerPage:     20,
    totalPages:       1,
    activeYearFilter: 'all',
    activeQualFilter: 'all',
    searchQuery:      '',
    disksMeta:        [],
};

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;
    await Promise.all([loadDisks(), loadAllMatches()]);
    buildVolumes();
    buildOverview();
    bindOverviewEvents();
    bindDetailEvents();
});

// ─── Carregamento ────────────────────────────────

async function loadDisks() {
    try {
        const res  = await fetch(`${CONFIG.REQUEST_API_BASE}/storage/disks`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Estrutura da API: { success, data: [[{ summary, disks }], { registros, espaco }] }
        const payload = Array.isArray(json.data?.[0])
            ? json.data[0][0]       // formato aninhado vindo do sync script
            : json.data;            // formato direto { summary, disks }

        StorageState.diskSummary = payload?.summary || null;

        // Filtra pseudo-discos (Nuvem, Local, PARA BAIXAR) e discos sem hardware definido
        StorageState.disksMeta = (payload?.disks || []).filter(d =>
            d.name &&
            !PSEUDO_DISKS.has(d.name.toLowerCase()) &&
            d.brand !== null   // sem marca = entrada de planilha, não hardware
        );
    } catch (err) {
        console.warn('Dados de discos não disponíveis:', err);
        StorageState.disksMeta = [];
    }
}

async function loadAllMatches() {
    try {
        const data    = APIService.fetchMatches(1, 200);
        const matches = APIService.transformData(data, 'football');
        StorageState.allMatches = matches;
    } catch (err) {
        console.error('Erro ao carregar jogos:', err);
        document.getElementById('storageStats').innerHTML =
            `<div class="section-state"><p>Erro ao carregar dados.</p></div>`;
    }
}

// ─── Normaliza um disco da API ───────────────────
function normalizeDisk(disk) {
    const totalGB = disk.total_gb || 0;
    const usedGB  = disk.used_gb  || 0;

    // Recalcula free no cliente — API retorna free_gb: 0 quando planilha não preenchida
    const knownTotal = totalGB > 0;
    const freeGB  = knownTotal ? Math.max(totalGB - usedGB, 0) : null;
    const pct     = knownTotal ? Math.min(Math.round((usedGB / totalGB) * 100), 100) : null;
    const rawPct  = knownTotal ? Math.round((usedGB / totalGB) * 100) : null; // pode passar 100

    return {
        ...disk,
        totalGB,
        usedGB,
        otherGB:    disk.other_gb    || 0,
        archiveGB:  disk.archive_gb  || 0,
        freeGB,
        pct:        pct ?? 0,
        rawPct,
        knownTotal,
        level: !knownTotal    ? 'ok'
             : rawPct >= 100  ? 'critical'
             : rawPct >= 85   ? 'critical'
             : rawPct >= 70   ? 'warning'
             : 'ok',
    };
}

// ─── Monta volumes fundindo discos reais + jogos ─
function buildVolumes() {
    const { allMatches, disksMeta } = StorageState;

    const matchesByLocal = {};
    let cloudCount = 0, cloudGB = 0;

    allMatches.forEach(m => {
        const loc = m.Local || 'Desconhecido';
        if (!matchesByLocal[loc]) matchesByLocal[loc] = [];
        matchesByLocal[loc].push(m);
        if (m.Nuvem) { cloudCount++; cloudGB += parseSizeGB(m.Tamanho); }
    });

    if (disksMeta.length) {
        StorageState.volumes = disksMeta
            .map((raw, idx) => {
                const disk    = normalizeDisk(raw);
                const matches = matchesByLocal[disk.name] || [];
                const archiveGB = matches.reduce((a, m) => a + parseSizeGB(m.Tamanho), 0);
                const archivePct = disk.knownTotal && disk.totalGB > 0
                    ? Math.round((archiveGB / disk.totalGB) * 100) : 0;

                return {
                    ...disk,
                    archiveGB,
                    archivePct,
                    matches,
                    color: VOLUME_COLORS[idx % VOLUME_COLORS.length],
                };
            })
            .sort((a, b) => b.usedGB - a.usedGB);
    } else {
        // Fallback sem API de discos
        StorageState.volumes = Object.entries(matchesByLocal)
            .filter(([name]) => !PSEUDO_DISKS.has(name.toLowerCase()))
            .map(([name, items], idx) => {
                const usedGB  = items.reduce((a, m) => a + parseSizeGB(m.Tamanho), 0);
                const totalGB = estimateTotalCapacity(usedGB);
                const freeGB  = totalGB - usedGB;
                const pct     = Math.round((usedGB / totalGB) * 100);
                return {
                    name, matches: items,
                    color: VOLUME_COLORS[idx % VOLUME_COLORS.length],
                    model: '—', brand: '—', disk_type: '—',
                    usedGB, archiveGB: usedGB, otherGB: 0,
                    totalGB, freeGB, pct, rawPct: pct, archivePct: pct,
                    knownTotal: true,
                    level: pct >= 85 ? 'critical' : pct >= 70 ? 'warning' : 'ok',
                };
            })
            .sort((a, b) => b.usedGB - a.usedGB);
    }

    const totalGB = allMatches.reduce((a, m) => a + parseSizeGB(m.Tamanho), 0);
    StorageState.cloud = {
        syncedCount: cloudCount,
        syncedGB:    cloudGB,
        totalCount:  allMatches.length,
        totalGB,
    };
}

// ─── Overview ────────────────────────────────────
function buildOverview() {
    const { volumes, cloud, allMatches, disksMeta, diskSummary } = StorageState;
    if (!volumes.length) return;

    // Usa summary da API quando disponível — mais preciso
    const totalUsedGB = diskSummary?.total_used
        ?? volumes.reduce((a, v) => a + v.usedGB, 0);
    const totalCapGB  = diskSummary?.total_capacity
        ?? volumes.reduce((a, v) => a + v.totalGB, 0);
    const totalFreeGB = diskSummary
        ? Math.max(diskSummary.total_capacity - diskSummary.total_used, 0)
        : volumes.reduce((a, v) => a + (v.freeGB ?? 0), 0);

    const totalDuration = allMatches.reduce((a, m) => a + parseDuration(m.Duração), 0);
    const cloudPct      = cloud?.totalCount
        ? Math.round((cloud.syncedCount / cloud.totalCount) * 100) : 0;

    document.getElementById('statTotalSize').textContent     = formatGB(totalUsedGB);
    document.getElementById('statTotalGames').textContent    = allMatches.length.toLocaleString('pt-BR');
    document.getElementById('statTotalDuration').textContent = formatHours(totalDuration);
    document.getElementById('statCloudCoverage').textContent = `${cloudPct}%`;
    document.getElementById('totalCapacityLabel').textContent =
        `${formatGB(totalCapGB)} total · ${formatGB(totalFreeGB)} livres`;

    // Alertas
    const overDisks  = volumes.filter(v => v.rawPct !== null && v.rawPct >= 100);
    const critVols   = volumes.filter(v => v.level === 'critical' && v.rawPct < 100);
    const alertEl    = document.getElementById('storageAlert');
    const alerts     = [];

    if (overDisks.length) {
        alerts.push(`<div class="storage-alert home-section">
            <span class="alert-icon">🔴</span>
            <span><strong>${overDisks.map(v => v.name).join(', ')}</strong>
            ${overDisks.length > 1 ? 'estão' : 'está'} com uso acima de 100% —
            verifique a planilha ou mova arquivos.</span>
        </div>`);
    }
    if (critVols.length) {
        alerts.push(`<div class="storage-alert home-section">
            <span class="alert-icon">⚠️</span>
            <span><strong>${critVols[0].name}</strong> está com ${critVols[0].pct}% de uso —
            apenas ${formatGB(critVols[0].freeGB)} livres.</span>
        </div>`);
    }
    alertEl.innerHTML = alerts.join('');

    // Barra de distribuição
    const bar    = document.getElementById('distBar');
    const legend = document.getElementById('distLegend');
    bar.innerHTML = legend.innerHTML = '';
    volumes.forEach(v => {
        const widthPct = totalCapGB > 0
            ? (v.usedGB / totalCapGB * 100).toFixed(1) : 0;
        const seg = document.createElement('div');
        seg.className = 'storage-dist-seg';
        seg.style.cssText = `width:${widthPct}%;background:${v.color}`;
        bar.appendChild(seg);

        const li = document.createElement('span');
        li.className = 'storage-dist-leg-item';
        li.innerHTML = `<span class="storage-dist-leg-dot" style="background:${v.color}"></span>${v.name}`;
        li.addEventListener('click', () => openVolumeDetail(v));
        legend.appendChild(li);
    });

    // Cards de volume
    const volList = document.getElementById('volumeList');
    volList.innerHTML = '';
    volumes.forEach(v => volList.appendChild(buildVolumeCard(v)));

    renderCloudCard();
}

function buildVolumeCard(vol) {
    const modelLine = [vol.brand, vol.model, vol.disk_type, vol.format]
        .filter(Boolean).join(' · ') || '—';
    const interfaceLine  = vol.interface ? ` · ${vol.interface}` : '';
    const yearLine       = vol.purchase_year ? `Comprado em ${vol.purchase_year}` : '';

    // Exibe % com aviso se > 100
    const pctDisplay = vol.rawPct !== null
        ? (vol.rawPct > 100 ? `${vol.rawPct}% ⚠` : `${vol.pct}%`)
        : '—';

    // Barra e meta de uso
    const barWidth   = vol.knownTotal ? `${Math.min(vol.pct, 100)}%` : '0%';
    const usedLine   = vol.knownTotal
        ? `${formatGB(vol.usedGB)} usados de ${formatGB(vol.totalGB)}`
        : `${formatGB(vol.usedGB)} (capacidade não informada)`;
    const freeLine   = vol.freeGB !== null
        ? `${formatGB(vol.freeGB)} livres`
        : '—';

    const card = document.createElement('div');
    card.className = `volume-card ${vol.level}`;
    card.innerHTML = `
        <div class="volume-card-header">
            <div>
                <div class="volume-card-name">
                    <span class="vol-icon">💾</span> ${vol.name}
                    ${vol.status && vol.status !== 'Ativo'
                        ? `<span class="vol-status-badge">${vol.status}</span>` : ''}
                </div>
                <div class="volume-card-model">${modelLine}${interfaceLine}</div>
                ${yearLine ? `<div class="volume-card-year">${yearLine}</div>` : ''}
            </div>
            <div class="volume-pct ${vol.level}">${pctDisplay}</div>
        </div>
        <div class="volume-bar-wrap">
            <div class="volume-bar-bg">
                <div class="volume-bar-fill ${vol.level}" style="width:${barWidth}"></div>
            </div>
            <div class="volume-bar-meta">
                <span>${usedLine}</span>
                <span class="free-label ${vol.level}">${freeLine}</span>
            </div>
            ${vol.otherGB > 0 ? `
            <div class="volume-bar-breakdown">
                <span>📁 Archive: ${formatGB(vol.archive_gb)}</span>
                <span>📦 Outros: ${formatGB(vol.other_gb)}</span>
            </div>` : ''}
        </div>
        ${vol.notes ? `<div class="volume-card-notes">📝 ${vol.notes}</div>` : ''}
        <div class="volume-card-actions">
            <button class="volume-action-btn" data-vol="${vol.name}" style="display:none;">Ver jogos</button>
        </div>
    `;
    card.querySelector('[data-vol]').addEventListener('click', e => {
        e.stopPropagation();
        openVolumeDetail(vol);
    });
    return card;
}

function renderCloudCard() {
    const cloud = StorageState.cloud;
    if (!cloud) return;
    const pct = cloud.totalGB > 0
        ? Math.round((cloud.syncedGB / cloud.totalGB) * 100) : 0;

    document.getElementById('cloudCard').innerHTML = `
        <div class="cloud-volume-card">
            <div class="cloud-volume-header">
                <div class="cloud-volume-name">☁️ Cloud</div>
                <span class="cloud-status-badge">Online</span>
            </div>
            <div class="volume-bar-wrap">
                <div class="volume-bar-bg">
                    <div class="volume-bar-fill ok" style="width:${pct}%"></div>
                </div>
                <div class="volume-bar-meta">
                    <span>${formatGB(cloud.syncedGB)} espelhados</span>
                    <span>${pct}% do acervo</span>
                </div>
            </div>
            <div class="cloud-volume-detail">
                <div class="vol-det-item">
                    <div class="vol-det-label">Jogos espelhados</div>
                    <div class="vol-det-val">${cloud.syncedCount.toLocaleString('pt-BR')}</div>
                </div>
                <div class="vol-det-item">
                    <div class="vol-det-label">Total no acervo</div>
                    <div class="vol-det-val">${cloud.totalCount.toLocaleString('pt-BR')}</div>
                </div>
                <div class="vol-det-item">
                    <div class="vol-det-label">Cobertura</div>
                    <div class="vol-det-val">${pct}%</div>
                </div>
                <div class="vol-det-item">
                    <div class="vol-det-label">Status</div>
                    <div class="vol-det-val" style="color:var(--success-color)">Online</div>
                </div>
            </div>
        </div>
    `;
}

// ─── Detalhe do volume ───────────────────────────
function openVolumeDetail(vol) {
    StorageState.currentVolume    = vol;
    StorageState.currentPage      = 1;
    StorageState.activeYearFilter = 'all';
    StorageState.activeQualFilter = 'all';
    StorageState.searchQuery      = '';

    document.getElementById('storageOverview').style.display = 'none';
    document.getElementById('storageDetail').style.display   = 'block';
    document.getElementById('volumeSearch').value = '';

    const modelLine = [vol.brand, vol.model].filter(Boolean).join(' ') || '—';
    const metaItems = [
        vol.disk_type     ? `<span class="vol-meta-badge">${vol.disk_type}</span>`         : '',
        vol.format        ? `<span class="vol-meta-badge">${vol.format}</span>`            : '',
        vol.interface     ? `<span class="vol-meta-badge">${vol.interface}</span>`         : '',
        vol.purchase_year ? `<span class="vol-meta-badge">🗓 ${vol.purchase_year}</span>`  : '',
        vol.serial        ? `<span class="vol-meta-badge serial">S/N: ${vol.serial}</span>`: '',
    ].join('');

    document.getElementById('volumeHero').innerHTML = `
        <div class="volume-hero-icon">💾</div>
        <div class="volume-hero-info">
            <div class="volume-hero-name">${vol.name}</div>
            <div class="volume-hero-model">${modelLine}</div>
            ${metaItems ? `<div class="volume-hero-meta">${metaItems}</div>` : ''}
            ${vol.notes ? `<div class="volume-hero-notes">📝 ${vol.notes}</div>` : ''}
        </div>
    `;

    const pctDisplay = vol.rawPct !== null
        ? (vol.rawPct > 100 ? `${vol.rawPct}% ⚠` : `${vol.pct}%`) : '—';
    const barWidth   = vol.knownTotal ? `${Math.min(vol.pct, 100)}%` : '0%';
    const freeLine   = vol.freeGB !== null ? `· ${formatGB(vol.freeGB)} livres` : '';

    document.getElementById('volumeBarWrap').innerHTML = `
        <div class="storage-bar-bg">
            <div class="storage-bar-fill ${vol.level}" style="width:${barWidth}"></div>
        </div>
        <div class="storage-bar-meta">
            <span class="${vol.level !== 'ok' ? vol.level : ''}"
                  style="font-weight:500">${pctDisplay} usado</span>
            <span>${formatGB(vol.usedGB)} / ${vol.knownTotal ? formatGB(vol.totalGB) : '?'} ${freeLine}</span>
        </div>
        ${vol.otherGB > 0 ? `
        <div class="volume-bar-breakdown">
            <span>📁 Archive: ${formatGB(vol.archiveGB)} (${vol.archivePct}%)</span>
            <span>📦 Outros: ${formatGB(vol.otherGB)}</span>
        </div>` : ''}
    `;

    buildYearFilter(vol.matches);
    applyFiltersAndRender();
}

function buildYearFilter(matches) {
    const years = [...new Set(matches.map(m => {
        const d = Utils.parseDate(m.Data);
        return d ? d.getFullYear() : null;
    }).filter(Boolean))].sort((a, b) => b - a);

    const bar = document.getElementById('volumeYearFilter');
    bar.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'year-btn active';
    allBtn.textContent = 'Todos';
    allBtn.dataset.year = 'all';
    bar.appendChild(allBtn);

    years.forEach(y => {
        const btn = document.createElement('button');
        btn.className = 'year-btn';
        btn.textContent = y;
        btn.dataset.year = y;
        bar.appendChild(btn);
    });

    bar.addEventListener('click', e => {
        const btn = e.target.closest('.year-btn');
        if (!btn) return;
        bar.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        StorageState.activeYearFilter = btn.dataset.year;
        StorageState.currentPage = 1;
        applyFiltersAndRender();
    });
}

function applyFiltersAndRender() {
    const { currentVolume, activeYearFilter, activeQualFilter, searchQuery, itemsPerPage } = StorageState;
    if (!currentVolume) return;

    let filtered = currentVolume.matches;

    if (activeYearFilter !== 'all') {
        filtered = filtered.filter(m => {
            const d = Utils.parseDate(m.Data);
            return d && d.getFullYear().toString() === activeYearFilter;
        });
    }

    if (activeQualFilter === '4k') {
        filtered = filtered.filter(m => /2160|4k/i.test(m.Qualidade || ''));
    } else if (activeQualFilter === '1080') {
        filtered = filtered.filter(m => /1080/i.test(m.Qualidade || ''));
    } else if (activeQualFilter === 'no-cloud') {
        filtered = filtered.filter(m => !m.Nuvem);
    }

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(m =>
            (m.Mandante   || '').toLowerCase().includes(q) ||
            (m.Visitante  || '').toLowerCase().includes(q) ||
            (m.Competição || '').toLowerCase().includes(q)
        );
    }

    filtered.sort((a, b) => {
        const da = Utils.parseDate(a.Data), db = Utils.parseDate(b.Data);
        return (db || 0) - (da || 0);
    });

    StorageState.filteredMatches = filtered;
    StorageState.totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    StorageState.currentPage = Math.min(StorageState.currentPage, StorageState.totalPages);

    renderVolumeGames();
    updateVolumePagination();
}

function renderVolumeGames() {
    const { filteredMatches, currentPage, itemsPerPage } = StorageState;
    const container = document.getElementById('volumeGames');

    if (!filteredMatches.length) {
        container.innerHTML = `<div class="section-state"><p>Nenhum jogo encontrado.</p></div>`;
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const page  = filteredMatches.slice(start, start + itemsPerPage);
    container.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'matches-list';
    page.forEach(m => list.appendChild(buildStorageGameCard(m)));
    container.appendChild(list);
}

function buildStorageGameCard(match) {
    const homeGoals = parseFloat(match['Gols mandante']);
    const awayGoals = parseFloat(match['Gols visitante']);
    const hasScore  = !isNaN(homeGoals) && !isNaN(awayGoals);
    const homeWin   = hasScore && homeGoals > awayGoals;
    const awayWin   = hasScore && awayGoals > homeGoals;
    const color     = compColor(match.Competição);
    const synced    = !!match.Nuvem;

    const card = document.createElement('div');
    card.className = 'storage-game-card';
    card.addEventListener('click', () => MatchModal.fetchAndShow(match.ID, 'football'));
    card.innerHTML = `
        <div class="storage-game-comp">
            <span class="storage-comp-dot" style="background:${color}"></span>
            ${match.Competição || ''}
            ${match.Fase ? `· <span>${match.Fase}</span>` : ''}
        </div>
        <div class="storage-game-teams">
            <div class="storage-team-home">
                ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" class="storage-team-logo" onerror="this.style.display='none'" alt="">` : ''}
                <span class="storage-team-name ${homeWin ? 'winner' : awayWin ? 'loser' : ''}">${match.Mandante || '—'}</span>
            </div>
            <div class="storage-score-center">
                <span class="sc-val ${homeWin ? 'winner' : awayWin ? 'loser' : ''}">${hasScore ? Math.round(homeGoals) : '—'}</span>
                <span class="sc-sep">×</span>
                <span class="sc-val ${awayWin ? 'winner' : homeWin ? 'loser' : ''}">${hasScore ? Math.round(awayGoals) : '—'}</span>
            </div>
            <div class="storage-team-away">
                <span class="storage-team-name ${awayWin ? 'winner' : homeWin ? 'loser' : ''}">${match.Visitante || '—'}</span>
                ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" class="storage-team-logo" onerror="this.style.display='none'" alt="">` : ''}
            </div>
        </div>
        <div class="storage-game-footer">
            ${match['Logo emissora'] ? `<img src="${match['Logo emissora']}" class="broadcaster-logo" style="height:18px" onerror="this.style.display='none'" alt="">` : ''}
            ${match.Qualidade ? `<span class="tech-badge">${match.Qualidade}</span>` : ''}
            ${match['Formato de áudio'] ? `<span class="tech-badge">${match['Formato de áudio']}</span>` : ''}
            <span class="cloud-indicator ${synced ? 'synced' : 'unsynced'}" title="${synced ? 'Backup em cloud' : 'Sem backup'}"></span>
            <span class="storage-game-size">${match.Tamanho || ''}</span>
        </div>
    `;
    return card;
}

function updateVolumePagination() {
    const { currentPage, totalPages } = StorageState;
    document.getElementById('volPageNum').textContent   = currentPage;
    document.getElementById('volPageTotal').textContent = totalPages;
    document.getElementById('volFirstPage').disabled = currentPage === 1;
    document.getElementById('volPrevPage').disabled  = currentPage === 1;
    document.getElementById('volNextPage').disabled  = currentPage === totalPages;
    document.getElementById('volLastPage').disabled  = currentPage === totalPages;
}

// ─── Eventos ─────────────────────────────────────
function bindOverviewEvents() {}

function bindDetailEvents() {
    document.getElementById('backToOverview').addEventListener('click', () => {
        document.getElementById('storageDetail').style.display   = 'none';
        document.getElementById('storageOverview').style.display = 'block';
        StorageState.currentVolume = null;
    });

    document.getElementById('volFirstPage').addEventListener('click', () => { StorageState.currentPage = 1; applyFiltersAndRender(); });
    document.getElementById('volPrevPage').addEventListener('click',  () => { if (StorageState.currentPage > 1) { StorageState.currentPage--; applyFiltersAndRender(); } });
    document.getElementById('volNextPage').addEventListener('click',  () => { if (StorageState.currentPage < StorageState.totalPages) { StorageState.currentPage++; applyFiltersAndRender(); } });
    document.getElementById('volLastPage').addEventListener('click',  () => { StorageState.currentPage = StorageState.totalPages; applyFiltersAndRender(); });

    let searchTimer;
    document.getElementById('volumeSearch').addEventListener('input', e => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            StorageState.searchQuery = e.target.value;
            StorageState.currentPage = 1;
            applyFiltersAndRender();
        }, 300);
    });

    document.getElementById('storageQuickFilters').addEventListener('click', e => {
        const btn = e.target.closest('.storage-filter-btn');
        if (!btn) return;
        document.querySelectorAll('.storage-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        StorageState.activeQualFilter = btn.dataset.filter;
        StorageState.currentPage = 1;
        applyFiltersAndRender();
    });
}

// ─── Helpers ─────────────────────────────────────
function parseSizeGB(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(',', '.'));
    if (isNaN(n)) return 0;
    if (/tb/i.test(str)) return n * 1024;
    if (/mb/i.test(str)) return n / 1024;
    return n;
}

function estimateTotalCapacity(usedGB) {
    const tbs = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32];
    const usedTB = usedGB / 1024;
    for (const t of tbs) { if (usedTB <= t * 0.98) return t * 1024; }
    return usedGB * 1.15;
}

function compColor(competition) {
    if (!competition) return 'var(--text-tertiary)';
    const lc = competition.toLowerCase();
    for (const [key, val] of Object.entries(COMP_COLORS)) {
        if (lc.includes(key)) return val;
    }
    return 'var(--accent-color)';
}

function formatGB(gb) {
    if (gb === null || gb === undefined || isNaN(gb)) return '—';
    if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
    return `${gb.toFixed(1)} GB`;
}

function formatHours(minutes) {
    const h = Math.round(minutes / 60);
    return h >= 1000 ? `${(h / 1000).toFixed(1)}k h` : `${h}h`;
}

function parseDuration(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function topCompetition(matches) {
    const count = {};
    matches.forEach(m => { const k = m.Competição || 'Outros'; count[k] = (count[k] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0]?.split(' ').slice(0, 3).join(' ') || '—';
}

function topQuality(matches) {
    const count = {};
    matches.forEach(m => { const k = m.Qualidade || '—'; count[k] = (count[k] || 0) + 1; });
    return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
}