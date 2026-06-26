/* =============================================
   match-enriched.js
   Página de detalhe completo de uma partida.
   URL: match-enriched.html?id=5599&sport=football
   ============================================= */

// Tags pré-definidas (detectadas no campo Obs)
const TAG_RULES = [
    { pattern: /recorde|record/i,        label: 'Recorde histórico', cls: 'record'   },
    { pattern: /hat.trick|hat trick/i,   label: 'Hat-trick',         cls: 'scorer'   },
    { pattern: /prorrogação|aet/i,       label: 'Prorrogação',       cls: 'default'  },
    { pattern: /pênaltis|penalties/i,    label: 'Pênaltis',          cls: 'default'  },
    { pattern: /despedida/i,             label: 'Despedida',         cls: 'historic' },
    { pattern: /estreia/i,               label: 'Estreia',           cls: 'historic' },
    { pattern: /final/i,                 label: 'Final',             cls: 'record'   },
    { pattern: /artilheiro/i,            label: 'Artilheiro',        cls: 'scorer'   },
    { pattern: /virada/i,                label: 'Virada',            cls: 'historic' },
    { pattern: /goleada/i,               label: 'Goleada',           cls: 'default'  },
];

// Mapa de chaves de estatística → label PT
const STATS_LABELS = {
    ballPossession:     'Posse de bola (%)',
    goalFinish:         'Finalizações no gol',
    wrongFinish:        'Finalizações para fora',
    blockedFinish:      'Finalizações bloqueadas',
    ballOnThePost:      'Na trave',
    cornerKick:         'Escanteios',
    foulMade:           'Faltas',
    offSide:            'Impedimentos',
    yellowCardReceived: 'Cartões amarelos',
    redCardReceived:    'Cartões vermelhos',
    tackle:             'Desarmes',
    defense:            'Defesas do goleiro',
    totalPasses:        'Passes totais',
    rightPasses:        'Passes certos',
    wrongPasses:        'Passes errados',
    penaltyReceived:    'Pênaltis sofridos',
};

const STATS_ORDER = [
    'ballPossession', 'goalFinish', 'wrongFinish', 'blockedFinish',
    'ballOnThePost', 'cornerKick', 'foulMade', 'offSide',
    'yellowCardReceived', 'redCardReceived', 'tackle', 'defense',
    'totalPasses', 'rightPasses', 'wrongPasses', 'penaltyReceived',
];

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;

    const params = new URLSearchParams(location.search);
    const id    = params.get('id');
    const sport = params.get('sport') || 'football';

    if (!id) { showError(); return; }

    try {
        const data = await APIService.fetchById(id, sport);
        if (!data?.data?.length) throw new Error('Sem dados');

        const raw   = data.data[0];
        const match = APIService.transformData({ data: [raw] }, sport)[0];

        renderMatch(match, sport, raw);
        hideLoading();
        showContent();

    } catch (err) {
        console.error('Erro ao carregar partida:', err);
        showError();
    }
});

// ─── Render principal ────────────────────────────
function renderMatch(match, sport, raw) {
    renderHero(match);
    renderImages(match);
    renderTvInfo(match, 'meTvInfo');
    renderTechInfo(match, 'meTechInfo');
    renderStorage(match, 'meStorageBadges');
    renderObsAndTags(match);

    APIService.fetchEnrichment(match.ID, sport).then(detail => {
        if (!detail) {
            document.getElementById('meBody').style.display = 'block';
            return;
        }
        document.getElementById('modalBody').style.display = 'block';

        renderMatchInfo(detail);
        renderLastResults(detail.last_results, detail.homeTeam?.name, detail.awayTeam?.name);
        renderStatistics(detail.statistics, detail);
        renderLineups(detail.homeTeam, detail.awayTeam);
    });
}

// ─── Hero ────────────────────────────────────────
function renderHero(match) {
    const { homeGoals, awayGoals } = Utils.parseWinner(match['Gols mandante'], match['Gols visitante']);
    const hasScore  = homeGoals !== null && awayGoals !== null;

    const compLogoSlug = (match.Competição || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    const year    = Utils.parseDate(match.Data)?.getFullYear() || '';
    const compLogo = match.Competição ? `competition_logos/${compLogoSlug}_${year}.png` : '';
    const dateStr  = Utils.formatMatchDate(match.Data);

    document.getElementById('meHero').innerHTML = `
        <div class="score-overlay">
            <div class="logo-title-header">
                ${compLogo ? `<img src="${compLogo}" class="comp-logo" onerror="this.style.display='none'" alt="">` : ''}
                <h2 id="modalTitle">
                    <div class="section-title modal-title-competition">${LanguageManager.t(match.Competição) || ''}</div>
                    <div class="modal-title-phase">${LanguageManager.translateText(match.Fase)}</div>
                </h2>
            </div>

            <!-- Desktop -->
            <div class="score-desktop">
                <span class="score-team-name">${LanguageManager.t(match.Mandante) || ''}</span>
                ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" class="score-team-logo" onerror="this.style.display='none'" alt="">` : ''}
                <span class="score-value-modal">${hasScore ? homeGoals : ''} × ${hasScore ? awayGoals : ''}</span>
                ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" class="score-team-logo" onerror="this.style.display='none'" alt="">` : ''}
                <span class="score-team-name">${LanguageManager.t(match.Visitante) || '—'}</span>
            </div>

            <!-- Mobile -->
            <div class="score-mobile">
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" class="score-mobile-logo" onerror="this.style.display='none'" alt="">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.Mandante) || '—'}</span>
                    </div>
                    <span class="score-mobile-value">${hasScore ? homeGoals : ''}</span>
                </div>
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" class="score-mobile-logo" onerror="this.style.display='none'" alt="">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.Visitante) || '—'}</span>
                    </div>
                    <span class="score-mobile-value">${hasScore ? awayGoals : ''}</span>
                </div>
            </div>

            <div class="score-date-row">
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
                ${match.Estadio ? `<span>🏟️ ${match.Estadio}</span>` : ''}
            </div>
        </div>
    `;
}

// ─── Seções de informação ─────────────────────────
function renderImages(match) {
    const _matchCarouselId = `carousel-match-${match.ID || Date.now()}`;
    document.getElementById('image-carousel').innerHTML =
        match.Imagem ? ImageCarousel.renderHTML(match.Imagem, _matchCarouselId) : '';
    if (match.Imagem && Array.isArray(match.Imagem) && match.Imagem.length > 1) {
        ImageCarousel.init(_matchCarouselId, match.Imagem);
    }
}

function renderTvInfo(match, divId) {
    const rows = [
        { label: 'broadcaster', value: match.Emissora               || 'N/A' },
        { label: 'narration', value: match.Narração                 || 'N/A' },
        { label: 'origin',   value: LanguageManager.t(match.Origem) || 'N/A' },
        { label: 'type',     value: LanguageManager.t(match.Tipo)   || 'N/A' },
    ].filter(r => r.value && r.value !== '—');

    document.getElementById(divId).innerHTML = rows.map(r => `
        <div class="detail-list-item">
            <span class="detail-list-label">${LanguageManager.t(r.label)}</span>
            <span class="detail-list-value">${r.value}</span>
        </div>
    `).join('');
}

function renderTechInfo(match, divId) {
    const items = [
        { label: 'ID',               value: match.ID },
        { label: 'Qualidade',        value: match.Qualidade },
        { label: 'Formato de Áudio', value: match['Formato de áudio'] },
        { label: 'Bitrate',          value: match.Bitrate },
        { label: 'Duração',          value: match.Duração },
        { label: 'Tamanho',          value: Utils.formatSize(match.Tamanho) },
    ].filter(i => i.value);

    document.getElementById(divId).innerHTML = items.map(i => `
        <div class="detail-list-item">
            <div class="detail-list-label">${i.label}</div>
            <div class="detail-list-value">${i.value}</div>
        </div>
    `).join('');
}

function renderStorage(match, divId) {
    const badges = [];
    if (match.Local) badges.push(`<span class="storage-badge badge-success">${match.Local}</span>`);
    if (match.Nuvem) badges.push(`<span class="storage-badge badge-info">Cloud</span>`);
    document.getElementById(divId).innerHTML = badges.join('') ||
        '<span style="color:var(--text-tertiary);font-size:var(--font-size-md)">Nenhuma informação de storage</span>';
}

function renderObsAndTags(match) {
    const obs = match.Obs || '';
    if (!obs) return;
    const tags = TAG_RULES.filter(r => r.pattern.test(obs));
    if (tags.length || obs) document.getElementById('meTagsSection').style.display = 'block';
    document.getElementById('meTagsList').innerHTML = tags
        .map(t => `<span class="me-tag ${t.cls}">${t.label}</span>`).join('');
    if (obs) {
        document.getElementById('meObs').textContent = obs;
        document.getElementById('meObs').style.display = 'block';
    }
}

// ─── Seções enriquecidas (GE Globo) ──────────────────────────────────────────

function renderMatchInfo(detail) {
    const rows = [
        detail.referees?.referee ?            { label: LanguageManager.t('referee'),       value: detail.referees.referee                } : null,
        detail.referees?.assistants?.length ? { label: LanguageManager.t('refereeAssis'),  value: detail.referees.assistants.join(' · ') } : null,
        detail.referees?.fourth_official ?    { label: LanguageManager.t('refereeFourth'), value: detail.referees.fourth_official       } : null,
    ].filter(Boolean);

    if (!rows.length) return;

    document.getElementById('meRefereeSection').style.display = 'block'
    document.getElementById('meRefereeInfo').innerHTML = rows.map(r => `
        <div class="detail-list-item">
            <div class="detail-list-label">${r.label}</div>
            <div class="detail-list-value">${r.value}</div>
        </div>
    `).join('');

    const row = document.querySelector(".score-date-row");

    const span = document.createElement("span");
    span.textContent = `📍 ${detail.region ? detail.region : detail.city}`;

    row.appendChild(span);
}

function renderLastResults(last_results, homeName, awayName) {
    if (!last_results) return;
    const home = last_results.homeTeam || [];
    const away = last_results.awayTeam || [];
    if (!home.length && !away.length) return;

    const resultIcon = r => {
        const v = (r || '').toUpperCase();
        if (v === 'VICTORY' || v === 'WIN')  return '<span class="me-form-win">V</span>';
        if (v === 'DEFEAT'  || v === 'LOSS') return '<span class="me-form-loss">D</span>';
        return '<span class="me-form-draw">E</span>';
    };

    const score = document.querySelector(".score-desktop");

    score.insertAdjacentHTML(
        "afterbegin",
        `<span class="me-form-badges">${home.map(resultIcon).join('')}</span>`
    );

    score.insertAdjacentHTML(
        "beforeend",
        `<span class="me-form-badges">${away.map(resultIcon).join('')}</span>`
    );

    const teams = document.querySelectorAll(".score-mobile .score-team-name");

    const homeBadges = document.createElement("span");
    homeBadges.className = "me-form-badges";
    homeBadges.innerHTML = home.map(resultIcon).join("");
    teams[0].after(homeBadges);

    const awayBadges = document.createElement("span");
    awayBadges.className = "me-form-badges";
    awayBadges.innerHTML = away.map(resultIcon).join("");
    teams[1].after(awayBadges);
}

function renderStatistics(stats, detail) {
    if (!stats || typeof stats !== 'object') return;

    // GE: { homeTeam: { chave: { total: N } }, awayTeam: { ... } }
    const home = stats.homeTeam || {};
    const away = stats.awayTeam || {};

    const rows = STATS_ORDER
        .filter(key => home[key] !== undefined || away[key] !== undefined)
        .map(key => ({
            label: LanguageManager.t(key),
            home:  home[key]?.total ?? '—',
            away:  away[key]?.total ?? '—',
        }));

    if (!rows.length) return;

    document.getElementById('meStatisticsInfo').innerHTML = rows.map(s => {
                const hv = parseFloat(s.home);
                const av = parseFloat(s.away);
                const total = hv + av;
                const homePct = total > 0 ? Math.round((hv / total) * 100) : 50;
                const hasBar  = !isNaN(hv) && !isNaN(av);
                return `
                <div class="me-stat-row">
                    <span class="me-stat-value">${s.home}</span>
                    <div class="me-stat-center">
                        <span class="me-stat-label">${s.label}</span>
                        ${hasBar ? `
                        <div class="me-stat-bar">
                            <div class="me-stat-bar-home" style="background:${detail.homeTeam.colors?.primary};width:${homePct}%"></div>
                            <div class="me-stat-bar-away" style="background:${detail.awayTeam.colors?.primary};width:${100 - homePct}%"></div>
                        </div>` : ''}
                    </div>
                    <span class="me-stat-value">${s.away}</span>
                </div>`;
            }).join('')
}

function renderLineups(homeTeam, awayTeam) {
    if (!homeTeam?.lineup && !awayTeam?.lineup) return;

    document.getElementById('meLineupSection').style.display = 'block';

    const grid = document.getElementById('meLineupGrid');
    grid.innerHTML = '';

    [homeTeam, awayTeam].forEach(team => {
        if (!team?.lineup) return;
        const { formation, coach, startingXI = [], substitute = [] } = team.lineup;
        const color = team.colors?.primary || null;
        const color1 = team.colors?.primary || null;
        const color2 = team.colors?.secondary || null;
        const color3 = team.colors?.tertiary || null;

        const col = document.createElement('div');
        
        if (color3 === color2 || color3 === '#000000') {
            col.style.backgroundImage = `
                linear-gradient(
                    to right,
                    ${color1} 0%,
                    ${color1} 50%,
                    ${color2} 50%,
                    ${color2} 100%
                )
            `;
        }
        else if (color2 === color1 || color2 === '#000000') {
            col.style.backgroundImage = `
                linear-gradient(
                    to right,
                    ${color1} 0%,
                    ${color1} 100%
                )
            `;
        }
        else {
            col.style.backgroundImage = `
                linear-gradient(
                    to right,
                    ${color1} 0%,
                    ${color1} 33.33%,
                    ${color2} 33.33%,
                    ${color2} 66.66%,
                    ${color3} 66.66%,
                    ${color3} 100%
                )
            `;
        }

        col.style.backgroundRepeat = "no-repeat";
        col.style.backgroundPosition = "top";
        col.style.backgroundSize = "100% 4px";
        col.className = 'me-lineup-col';
        col.innerHTML = `
            <div class="me-lineup-team-header">
                <div class="me-lineup-team-info">
                    <div class="me-lineup-team-name"${color ? ` style="color:${color}"` : ''}>
                        ${LanguageManager.t(team.name) || ''}
                    </div>
                    ${formation ? `<div class="me-lineup-formation">${formation}</div>` : ''}
                    ${coach     ? `<div class="me-lineup-coach">${LanguageManager.t('coach')}: ${coach}</div>` : ''}
                </div>
            </div>
            ${startingXI.map(p => `
                <div class="me-player-row">
                    <span class="me-player-num">${p.shirtNumber ?? ''}</span>
                    <span class="me-player-name">${p.name || p.fullName || '—'}</span>
                    <span class="me-player-pos">${p.posSlug || ''}</span>
                </div>
            `).join('')}
            ${substitute.length ? `
                <div class="me-lineup-sub-label">${LanguageManager.t('subtitutes')}</div>
                ${substitute.map(p => `
                    <div class="me-player-row sub">
                        <span class="me-player-num">${p.shirtNumber ?? ''}</span>
                        <span class="me-player-name">${p.name || p.fullName || '—'}</span>
                        <span class="me-player-pos">${p.posSlug || ''}</span>
                    </div>
                `).join('')}
            ` : ''}
        `;
        grid.appendChild(col);
    });
}

// ─── Helpers ─────────────────────────────────────
function parseGoals(val) {
    if (val === '' || val === null || val === undefined) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : Math.round(n);
}

function hideLoading()  { document.getElementById('matchEnrichedLoading').style.display = 'none'; }
function showContent()  { document.getElementById('matchEnrichedContent').style.display = 'block'; }
function showError()    { hideLoading(); document.getElementById('matchEnrichedError').style.display = 'block'; }