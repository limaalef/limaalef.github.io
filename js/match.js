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

    Utils.applySportTheme(sport);

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

        renderPlays(detail, detail.homeTeam.tla);
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
        { label: 'narration',   value: match.Narração                 || 'N/A' },
        { label: 'origin',      value: LanguageManager.t(match.Origem) || 'N/A' },
        { label: 'type',        value: LanguageManager.t(match.Tipo)   || 'N/A' },
    ];

    document.getElementById(divId).innerHTML = Utils.setDetailList(rows);
}

function renderTechInfo(match, divId) {
    const items = [
        { label: 'ID',          value: match.ID },
        { label: 'quality',     value: match.Qualidade },
        { label: 'audioFormat', value: match['Formato de áudio'] },
        { label: 'bitrate',     value: (match.Bitrate + ' Mbps') },
        { label: 'duration',    value: match.Duração },
        { label: 'fileSize',    value: Utils.formatSize(match.Tamanho) },
    ];

    document.getElementById(divId).innerHTML = Utils.setDetailList(items);
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
        detail.referees?.referee ?            { label: 'referee',       value: detail.referees.referee                } : null,
        detail.referees?.assistants?.length ? { label: 'refereeAssis',  value: detail.referees.assistants.join(' · ') } : null,
        detail.referees?.fourth_official ?    { label: 'refereeFourth', value: detail.referees.fourth_official       } : null,
    ];

    document.getElementById('meRefereeSection').style.display = 'block'
    document.getElementById('meRefereeInfo').innerHTML = Utils.setDetailList(rows);

    if (!rows.length) return;

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

    const statsList = document.getElementById('meStatisticsInfo');

    const homeColor = detail.homeTeam.colors.primary
    const homeName = detail.homeTeam.name
    const awayColor = detail.awayTeam.colors.primary
    const awayName = detail.awayTeam.name

    statsList.innerHTML = getTeamHeaderList(detail)
    
    statsList.innerHTML += rows
        .filter(s => !(parseFloat(s.home) === 0 && parseFloat(s.away) === 0))
        .map(s => {
                const hv = parseFloat(s.home);
                const av = parseFloat(s.away);
                const total = hv + av;
                const homePct = total > 0 ? Math.round((hv / total) * 100) : 50;
                const hasBar  = !isNaN(hv) && !isNaN(av);
                let percentSignal = '';

                if (s.label.includes(" (%)")) {
                    s.label = s.label.replace(" (%)", "");
                    percentSignal = "%"
                }

                const equalZero = hv === 0 && av === 0
                return `
                <div class="me-stat-row">
                    <div class="me-stat-center">
                        <div class="me-stat-data">
                            <span class="me-stat-value">${s.home}${percentSignal}</span>
                            <span class="me-stat-label">${s.label}</span>
                            <span class="me-stat-value">${s.away}${percentSignal}</span>
                        </div>
                        ${hasBar ? `
                        <div class="me-stat-bar">
                            <div class="me-stat-bar-home" style="background:${equalZero ? 'var(--border-color)' : detail.homeTeam.colors?.primary};width:${homePct}%"></div>
                            <div class="me-stat-bar-away" style="background:${equalZero ? 'var(--border-color)' : detail.awayTeam.colors?.primary};width:${100 - homePct}%"></div>
                        </div>` : ''}
                    </div>
                    
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
        
        if (color2 === color1 || (color3 === color2 && color2 === '#000000')) {
            col.style.backgroundImage = `
                linear-gradient(
                    to right,
                    ${color1} 0%,
                    ${color1} 100%
                )
            `;
        }
        else if (color3 === color2 || color3 === '#000000') {
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
                <div class="me-lineup-sub-header">
                    <button class="me-lineup-sub-label" type="button">
                        <span>${LanguageManager.t('subtitutes')}</span>
                        <span>▼</span>
                    </button>
                </div>

                <div class="me-lineup-sub-list" hidden>
                    ${substitute.map(p => `
                        <div class="me-player-row sub">
                            <span class="me-player-num">${p.shirtNumber ?? ''}</span>
                            <span class="me-player-name">${p.name || p.fullName || '—'}</span>
                            <span class="me-player-pos">${p.posSlug || ''}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
        grid.appendChild(col);

        const toggle = col.querySelector('.me-lineup-sub-label');

        if (toggle) {
            toggle.addEventListener('click', () => {
                const list = col.querySelector('.me-lineup-sub-list');
                const open = !list.hidden;

                list.hidden = open;
                toggle.innerHTML = `<span>${LanguageManager.t('subtitutes')}</span><span>${open ? '▼' : '▲'}</span> `;
            });
        }
    });
}

function renderPlays(detail, homeTeamAbbr) {
    const plays = detail.plays
    const section = document.getElementById('mePlaysSection');
    const list    = document.getElementById('mePlaysList');
 
    if (!plays?.length) return;
 
    section.style.display = 'block';
 
    // Agrupa por período para inserir separadores
    const byPeriod = [];
    let lastPeriod = null;
 
    for (const goal of plays) {
        if (goal.period !== lastPeriod) {
            byPeriod.push({ type: 'period', label: goal.periodLabel });
            lastPeriod = goal.period;
        }
        byPeriod.push({ type: 'goal', data: goal });
    }

    const homeColor = detail.homeTeam.colors.primary
    const homeName = detail.homeTeam.name
    const awayColor = detail.awayTeam.colors.primary
    const awayName = detail.awayTeam.name

    list.innerHTML = `<div class="plays-header-names">
        <div class="plays-header-grid" style="">
        <span class="me-lineup-team-name plays-names"${homeColor ? ` style="color:${homeColor};${getTeamColorsStyle(detail.homeTeam.colors)};border-right:1px solid var(--border-color);"` : ''}>
                ${LanguageManager.t(homeName) || ''}
        </span>
        <span class="me-lineup-team-name plays-names"${awayColor ? ` style="color:${awayColor};${getTeamColorsStyle(detail.awayTeam.colors)};"` : ''}>
                ${LanguageManager.t(awayName) || ''}
        </span>
        </div>
    </div>`
 
    list.innerHTML += byPeriod.map(entry => {
        if (entry.type === 'period') {
            return `<div class="plays-period-label">${entry.label}</div>`;
        }
 
        const play   = entry.data;
        const isHome = play.teamAbbr === homeTeamAbbr;
        const badge  = goalTypeBadge(play.playType);
        const icon   = playTypeBadge(play.playType);
        const minute = `${play.minute}<span class="plays-minute-mark">'</span>`;
 
        const playerHome = `
            <span class="plays-player-name">${play.popularName || play.name || '—'}</span>
            ${badge}
            ${icon}
        `;

        const playerAway = `
            ${icon}
            ${badge}
            <span class="plays-player-name">${play.popularName || play.name || '—'}</span>
        `;
 
        return `
            <div class="plays-row">
                <div class="plays-side plays-home ${isHome ? 'plays-side--active' : ''}">
                    ${isHome ? playerHome : ''}
                </div>
                <div class="plays-minute">${minute}</div>
                <div class="plays-side plays-away ${!isHome ? 'plays-side--active' : ''}">
                    ${!isHome ? playerAway : ''}
                </div>
            </div>
        `;
    }).join('');
}
 
function getTeamHeaderList(info) {
    const homeColor = info.homeTeam.colors.primary
    const homeName = info.homeTeam.name
    const awayColor = info.awayTeam.colors.primary
    const awayName = info.awayTeam.name

    return `<div class="plays-header-names">
        <div class="plays-header-grid" style="">
        <span class="me-lineup-team-name plays-names"${homeColor ? ` style="color:${homeColor};${getTeamColorsStyle(info.homeTeam.colors)};border-right:1px solid var(--border-color);"` : ''}>
                ${LanguageManager.t(homeName) || ''}
        </span>
        <span class="me-lineup-team-name plays-names"${awayColor ? ` style="color:${awayColor};${getTeamColorsStyle(info.awayTeam.colors)};"` : ''}>
                ${LanguageManager.t(awayName) || ''}
        </span>
        </div>
    </div>`
}

function getTeamColorsStyle(colors) {
    const color1 = colors.primary;
    const color2 = colors.secondary;
    const color3 = colors.tertiary;
    
    if (color2 === color1 || (color3 === color2 && color2 === '#000000')) {
        return `
            background-image:linear-gradient(
                to right,
                ${color1} 0%,
                ${color1} 100%
            );
            background-repeat: no-repeat;
            background-position: center top;
            background-size: 100% 4px;
        `;
    }

    if (color3 === color2 || color3 === '#000000') {
        return `
            background-image:linear-gradient(
                to right,
                ${color1} 0%,
                ${color1} 50%,
                ${color2} 50%,
                ${color2} 100%
            );
            background-repeat: no-repeat;
            background-position: center top;
            background-size: 100% 4px;
        `;
    }

    return `
        background-image:linear-gradient(
            to right,
            ${color1} 0%,
            ${color1} 33.33%,
            ${color2} 33.33%,
            ${color2} 66.66%,
            ${color3} 66.66%,
            ${color3} 100%
        );
        background-repeat: no-repeat;
        background-position: center top;
        background-size: 100% 4px;
    `;
}

function goalTypeBadge(type) {
    if (!type || type === 'REGULAR') return '';
    if (type === 'PENALTY')  return `<span class="goals-type-badge goals-type-penalty"  title="Pênalti">P</span>`;
    if (type === 'OWN_GOAL') return `<span class="goals-type-badge goals-type-own-goal" title="Gol contra">C</span>`;
    return '';
}

function playTypeBadge(play) {
    switch (play) {
        case 'REGULAR_GOAL':
        case 'PENALTY':
        case 'OWN_GOAL':
            return `<span class="plays-badge plays-badge-goal" title="Gol">
                <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="var(--text-primary)" width="12px" height="12px" viewBox="0 0 122.88 122.88" version="1.1" id="Layer_1" style="enable-background:new 0 0 122.88 122.88" xml:space="preserve">
                    <style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style>
                        <g>
                            <path class="st0" d="M61.44,0c16.97,0,32.33,6.88,43.44,18c11.12,11.12,18,26.48,18,43.44c0,16.97-6.88,32.33-18,43.44 c-11.12,11.12-26.48,18-43.44,18S29.11,116,18,104.88C6.88,93.77,0,78.41,0,61.44C0,44.47,6.88,29.11,18,18 C29.11,6.88,44.47,0,61.44,0L61.44,0z M76.85,117.08L76.73,117l6.89-23.09L69.41,78.15L52.66,78L39.38,94.62l6.66,22.32l-0.15,0.1 c4.95,1.38,10.16,2.12,15.55,2.12C66.78,119.16,71.95,118.44,76.85,117.08L76.85,117.08z M12.22,91.61l24.34,0.12L49.28,75.8 l-5.26-16.12l-21.42-9.3L3.78,64.08C4.23,74.14,7.26,83.53,12.22,91.61L12.22,91.61z M16.77,24.88l7.4,22.14l19.98,8.68 l15.44-11.97V20.94L40.51,7.63c-7.52,2.93-14.28,7.39-19.89,13C19.27,21.98,17.98,23.4,16.77,24.88L16.77,24.88z M81.7,7.37 L63.3,20.77V43.7L77.8,54.91l20.81-8.92l7.18-21.49c-1.12-1.35-2.3-2.64-3.54-3.88C96.48,14.85,89.49,10.29,81.7,7.37L81.7,7.37z M119.09,64.36l-0.02,0.01L99.09,49.82l-19.81,8.49l-6.08,18.03l13.73,15.23c0.06,0.06,0.09,0.13,0.11,0.21l23.6-0.11 C115.56,83.65,118.59,74.34,119.09,64.36L119.09,64.36z"/>
                        </g>
                    </svg>
            </span>`;

        case 'YELLOW_CARD':
            return `<span class="plays-badge plays-badge-yellow" title="Cartão amarelo">
                <svg viewBox="0 0 64 90" xmlns="http://www.w3.org/2000/svg" width="12px" height="12px" aria-label="Cartão amarelo">
                    <rect x="2" y="2" width="60" height="86" rx="8" fill="#FFD200" stroke="#E6B800" stroke-width="4"/>
                    <path d="M2 2H60L2 88Z" fill="#FFFFFF" opacity="0.15"/>
                </svg>
            </span>`;

        case 'RED_CARD':
            return `<span class="plays-badge plays-badge-red" title="Cartão vermelho">
                <svg viewBox="0 0 64 90" xmlns="http://www.w3.org/2000/svg" width="12px" height="12px" aria-label="Cartão vermelho">
                    <rect x="2" y="2" width="60" height="86" rx="8" fill="#E60000" stroke="#C00000" stroke-width="4"/>
                    <path d="M2 2H60L2 88Z" fill="#FFFFFF" opacity="0.15"/>
                </svg>
            </span>`;

        default:
            return '';
    }
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