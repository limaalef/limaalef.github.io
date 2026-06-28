/* =============================================
   watch.js
   Página de assistir uma partida.
   URL: watch.html?id=5599&sport=football
   ============================================= */

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
    const id     = params.get('id');
    const sport  = params.get('sport') || 'football';

    Utils.applySportTheme(sport);

    if (!id) { showWatchError(); return; }

    try {
        const data = await APIService.fetchById(id, sport);
        if (!data?.data?.length) throw new Error('Sem dados');

        const raw   = data.data[0];
        const match = APIService.transformData({ data: [raw] }, sport)[0];

        renderWatch(match, sport, raw);
        hideWatchLoading();
        showWatchContent();

    } catch (err) {
        console.error('Erro ao carregar partida:', err);
        showWatchError();
    }
});

// ─── Render principal ────────────────────────────
function renderWatch(match, sport, raw) {
    renderWatchHero(match);
    renderWatchVideo(raw);
    renderWatchLineups(match, raw);
    renderWatchTvInfo(match);
    renderWatchTechInfo(match);
    renderStorage(match, 'meStorageBadges');
    updateWatchMetaTags(match, raw);

    // Enriquecimento GE Globo — sobrescreve escalações e adiciona forma recente
    APIService.fetchEnrichment(match.ID, sport).then(detail => {
        if (!detail) return;

        if (detail.homeTeam?.lineup || detail.awayTeam?.lineup) {
            renderWatchLineupsEnriched(detail.homeTeam, detail.awayTeam);
        }

        if (detail.last_results) {
            renderWatchLastResults(detail.last_results);
        }

        if (detail.statistics) {
            renderStatistics(detail.statistics, detail);
        }

        if (detail.plays) {
            renderPlays(detail, detail.homeTeam.tla);
        }
    });
}

// ─── Hero (idêntico ao match.js) ─────────────────
function renderWatchHero(match) {
    const { homeGoals, awayGoals } = Utils.parseWinner(match['Gols mandante'], match['Gols visitante']);
    const hasScore = homeGoals !== null && awayGoals !== null;

    const compLogoSlug = (match.Competição || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    const year     = Utils.parseDate(match.Data)?.getFullYear() || '';
    const compLogo = match.Competição ? `competition_logos/${compLogoSlug}_${year}.png` : '';
    const dateStr  = Utils.formatMatchDate(match.Data);

    document.getElementById('watchHero').innerHTML = `
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

// ─── Vídeo ───────────────────────────────────────
function renderWatchVideo(raw) {
    const embedUrl    = raw.embed_video || raw['Video embed'] || raw['Embed'] || '';
    const iframe      = document.getElementById('videoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');

    if (embedUrl) {
        iframe.src            = embedUrl;
        iframe.style.display  = 'block';
        placeholder.style.display = 'none';
    } else {
        iframe.style.display      = 'none';
        placeholder.style.display = 'flex';
    }
}

// ─── Escalações simples (dados da API principal) ──
function renderWatchLineups(match, raw) {
    const homeLineup = raw.home_team?.lineup || [];
    const awayLineup = raw.away_team?.lineup || [];

    document.getElementById('watchHomeTeamName').textContent =
        LanguageManager.t(match.Mandante) || match.Mandante || '—';
    document.getElementById('watchAwayTeamName').textContent =
        LanguageManager.t(match.Visitante) || match.Visitante || '—';

    document.getElementById('watchHomeFormation').textContent = raw.home_team?.formation || '';
    document.getElementById('watchAwayFormation').textContent = raw.away_team?.formation || '';

    renderSimpleLineupList('watchHomeLineupList', homeLineup);
    renderSimpleLineupList('watchAwayLineupList', awayLineup);
}

function renderSimpleLineupList(containerId, lineup) {
    const el = document.getElementById(containerId);
    if (!lineup?.length) {
        el.innerHTML = `
            <div class="me-player-row" style="justify-content:center;color:var(--text-tertiary);font-size:var(--font-size-sm);">
                Escalação não disponível
            </div>`;
        return;
    }
    el.innerHTML = lineup.map(p => `
        <div class="me-player-row">
            <span class="me-player-num">${p.number ?? p.shirtNumber ?? ''}</span>
            <span class="me-player-name">${p.name || p.fullName || '—'}</span>
            <span class="me-player-pos">${p.position || p.posSlug || ''}</span>
        </div>
    `).join('');
}

// ─── Escalações enriquecidas (GE Globo) ──────────
function renderWatchLineupsEnriched(homeTeam, awayTeam) {
    if (homeTeam?.name)
        document.getElementById('watchHomeTeamName').textContent =
            LanguageManager.t(homeTeam.name) || homeTeam.name;

    if (awayTeam?.name)
        document.getElementById('watchAwayTeamName').textContent =
            LanguageManager.t(awayTeam.name) || awayTeam.name;

    applyLineupColColors(document.getElementById('watchHomeLineup'), homeTeam?.colors);
    applyLineupColColors(document.getElementById('watchAwayLineup'), awayTeam?.colors);

    if (homeTeam?.lineup) {
        const { formation = '', startingXI = [], substitute = [] } = homeTeam.lineup;
        if (formation) document.getElementById('watchHomeFormation').textContent = formation;
        renderEnrichedLineupList('watchHomeLineupList', startingXI, substitute);
    }
    if (awayTeam?.lineup) {
        const { formation = '', startingXI = [], substitute = [] } = awayTeam.lineup;
        if (formation) document.getElementById('watchAwayFormation').textContent = formation;
        renderEnrichedLineupList('watchAwayLineupList', startingXI, substitute);
    }
}

function applyLineupColColors(col, colors) {
    if (!colors?.primary) return;
    const { primary: c1, secondary: c2, tertiary: c3 } = colors;

    if (c2 === c1 || (c3 === c2 && c2 === '#000000')) {
        col.style.backgroundImage = `linear-gradient(to right,${c1} 0%,${c1} 100%)`;
    } else if (c3 === c2 || c3 === '#000000') {
        col.style.backgroundImage = `linear-gradient(to right,${c1} 0%,${c1} 50%,${c2} 50%,${c2} 100%)`;
    } else {
        col.style.backgroundImage = `linear-gradient(to right,${c1} 0%,${c1} 33.33%,${c2} 33.33%,${c2} 66.66%,${c3} 66.66%,${c3} 100%)`;
    }
    col.style.backgroundRepeat   = 'no-repeat';
    col.style.backgroundPosition = 'top';
    col.style.backgroundSize     = '100% 4px';
}

function renderEnrichedLineupList(containerId, startingXI, substitute) {
    const el = document.getElementById(containerId);
    el.innerHTML = startingXI.map(p => `
        <div class="me-player-row">
            <span class="me-player-num">${p.shirtNumber ?? ''}</span>
            <span class="me-player-name">${p.name || p.fullName || '—'}</span>
            <span class="me-player-pos">${p.posSlug || ''}</span>
        </div>
    `).join('');

    if (substitute?.length) {
        el.innerHTML += `
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
        `;
        const toggle = el.querySelector('.me-lineup-sub-label');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const list = el.querySelector('.me-lineup-sub-list');
                const open = !list.hidden;
                list.hidden = open;
                toggle.innerHTML = `<span>${LanguageManager.t('subtitutes')}</span><span>${open ? '▼' : '▲'}</span>`;
            });
        }
    }
}

// ─── Forma recente (GE Globo) ─────────────────────
function renderWatchLastResults(last_results) {
    const home = last_results.homeTeam || [];
    const away = last_results.awayTeam || [];
    if (!home.length && !away.length) return;

    const resultIcon = r => {
        const v = (r || '').toUpperCase();
        if (v === 'VICTORY' || v === 'WIN')  return '<span class="me-form-win">V</span>';
        if (v === 'DEFEAT'  || v === 'LOSS') return '<span class="me-form-loss">D</span>';
        return '<span class="me-form-draw">E</span>';
    };

    const score = document.querySelector('#watchHero .score-desktop');
    if (score) {
        score.insertAdjacentHTML('afterbegin',
            `<span class="me-form-badges">${home.map(resultIcon).join('')}</span>`);
        score.insertAdjacentHTML('beforeend',
            `<span class="me-form-badges">${away.map(resultIcon).join('')}</span>`);
    }

    const teams = document.querySelectorAll('#watchHero .score-mobile .score-team-name');
    if (teams[0]) {
        const b = document.createElement('span');
        b.className = 'me-form-badges';
        b.innerHTML = home.map(resultIcon).join('');
        teams[0].after(b);
    }
    if (teams[1]) {
        const b = document.createElement('span');
        b.className = 'me-form-badges';
        b.innerHTML = away.map(resultIcon).join('');
        teams[1].after(b);
    }
}

// ─── Info (reutiliza Utils.setDetailList) ─────────
function renderWatchTvInfo(match) {
    const rows = [
        { label: 'broadcaster', value: match.Emissora                 || 'N/A' },
        { label: 'narration',   value: match.Narração                  || 'N/A' },
        { label: 'origin',      value: LanguageManager.t(match.Origem) || 'N/A' },
        { label: 'type',        value: LanguageManager.t(match.Tipo)   || 'N/A' },
    ];
    document.getElementById('watchTvInfo').innerHTML = Utils.setDetailList(rows);
}

function renderWatchTechInfo(match) {
    const items = [
        { label: 'ID',          value: match.ID },
        { label: 'quality',     value: match.Qualidade },
        { label: 'audioFormat', value: match['Formato de áudio'] },
        { label: 'bitrate',     value: match.Bitrate ? (match.Bitrate + ' Mbps') : 'N/A' },
        { label: 'duration',    value: match.Duração },
        { label: 'fileSize',    value: Utils.formatSize(match.Tamanho) },
    ];
    document.getElementById('watchTechInfo').innerHTML = Utils.setDetailList(items);
}

function renderStorage(match, divId) {
    const badges = [];
    if (match.Local) badges.push(`<span class="storage-badge badge-success">${match.Local}</span>`);
    if (match.Nuvem) badges.push(`<span class="storage-badge badge-info">Cloud</span>`);
    document.getElementById(divId).innerHTML = badges.join('') ||
        '<span style="color:var(--text-tertiary);font-size:var(--font-size-md)">Nenhuma informação de storage</span>';
}

// ─── Estatísticas ─────────────────────────────────
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


// ─── Meta tags ────────────────────────────────────
function updateWatchMetaTags(match, raw) {
    const home  = LanguageManager.t(match.Mandante)  || match.Mandante  || '';
    const away  = LanguageManager.t(match.Visitante) || match.Visitante || '';
    const comp  = LanguageManager.t(match.Competição) || match.Competição || '';
    const title = `${home} vs ${away} - ${comp}`;
    const desc  = `Assista ${home} ${match['Gols mandante'] ?? ''} x ${match['Gols visitante'] ?? ''} ${away} - ${comp}`;

    document.title = title + ' — Sports Archive';

    const set = (id, val) => document.getElementById(id)?.setAttribute('content', val);
    set('og-title',            title);
    set('og-description',      desc);
    set('twitter-title',       title);
    set('twitter-description', desc);
    document.getElementById('twitter-url')?.setAttribute('content', location.href);

    const img = raw.image || match.Imagem?.[0] || '';
    if (img) { set('og-image', img); set('twitter-image', img); }
}

// ─── Estado da página ─────────────────────────────
function hideWatchLoading() { document.getElementById('watchLoading').style.display = 'none';  }
function showWatchContent() { document.getElementById('watchContent').style.display  = 'block'; }
function showWatchError()   {
    hideWatchLoading();
    document.getElementById('watchError').style.display = 'block';
}