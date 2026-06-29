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
    Elements.renderStorage(match, 'meStorageBadges');
    renderObsAndTags(match);

    APIService.fetchEnrichment(match.ID, sport).then(detail => {
        if (!detail) {
            document.getElementById('meBody').style.display = 'block';
            return;
        }
        document.getElementById('modalBody').style.display = 'block';

        Elements.renderPlays(detail, detail.homeTeam.tla);
        renderMatchInfo(detail);
        renderLastResults(detail.last_results, detail.homeTeam?.name, detail.awayTeam?.name);
        Elements.renderStatistics(detail.statistics, detail);
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

    document.getElementById(divId).innerHTML = Elements.setDetailList(rows);
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

    document.getElementById(divId).innerHTML = Elements.setDetailList(items);
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
        { label: 'referee',       value: detail.referees.referee                },
        { label: 'refereeAssis',  value: detail.referees.assistants?.join(' · ') },
        { label: 'refereeFourth', value: detail.referees.fourth_official       },
    ];

    htmlEl = Elements.setDetailList(rows);

    if (!htmlEl) return;

    document.getElementById('meRefereeSection').style.display = 'block'
    document.getElementById('meRefereeInfo').innerHTML = htmlEl;

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


function renderLineups(homeTeam, awayTeam) {
    if (!homeTeam?.lineup && !awayTeam?.lineup) return;

    document.getElementById('meLineupSection').style.display = 'block';

    const grid = document.getElementById('meLineupGrid');
    grid.innerHTML = '';

    [homeTeam, awayTeam].forEach(team => {
        if (!team?.lineup) return;
        grid.appendChild(Elements.buildLineupCol(team));
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