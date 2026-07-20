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
        if (detail.penalties?.length) {
            Elements.renderPenalties(detail, detail.homeTeam.tla);
        }
        renderMatchInfo(detail);
        renderAttRev(detail);
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
                ${dateStr ? `<span>
                    <svg width="var(--font-size-mdm)" height="var(--font-size-mdm)" viewBox="0 0 12 15" fill="currentcolor" xmlns="http://www.w3.org/2000/svg" class="cf-icon-svg">
                        <path d="M11.882 3.187a.476.476 0 0 1 .475.475v11.063a.476.476 0 0 1-.475.475H1.118a.476.476 0 0 1-.475-.475V3.662a.476.476 0 0 1 .475-.475h1.328v.721a1.425 1.425 0 0 0 2.85 0v-.72H7.71v.72a1.425 1.425 0 0 0 2.85 0v-.72zm-.634 3.37H1.752v7.535h9.496zm-7.384.821H2.621V8.67h1.243zm0 2.292H2.621v1.292h1.243zm0 2.292H2.621v1.291h1.243zm.561-8.054V2.475a.554.554 0 1 0-1.108 0v1.433a.554.554 0 1 0 1.108 0zm1.613 3.47H4.794V8.67h1.244zm0 2.292H4.794v1.292h1.244zm0 2.292H4.794v1.291h1.244zm2.174-4.584H6.968V8.67h1.244zm0 2.292H6.968v1.292h1.244zm0 2.292H6.968v1.291h1.244zm1.477-8.054V2.475a.554.554 0 0 0-1.108 0v1.433a.554.554 0 0 0 1.108 0zm.696 3.47H9.142V8.67h1.243zm0 2.292H9.142v1.292h1.243zm0 2.292H9.142v1.291h1.243z"/>
                    </svg>
                    ${dateStr}</span>` : ''}
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
        { label: 'broadcaster', value: match.Emissora,                  svg: '<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.0254 8.40554C20.7987 8.20998 20.5218 8.09678 20.3141 8.02584C20.0833 7.94703 19.8184 7.88184 19.5383 7.82624C18.9764 7.71473 18.2727 7.62624 17.4908 7.55704C15.9221 7.41822 13.955 7.34998 12 7.34998C10.045 7.34997 8.0779 7.41821 6.50923 7.55704C5.7273 7.62623 5.02357 7.71473 4.46174 7.82624C4.18161 7.88184 3.91672 7.94703 3.68594 8.02583C3.4782 8.09677 3.20126 8.20998 2.97462 8.40553C2.76112 8.58976 2.63916 8.81815 2.56971 8.97159C2.49263 9.14189 2.43333 9.32752 2.38581 9.50895C2.29052 9.87283 2.21854 10.3144 2.16365 10.7872C2.05319 11.7386 2 12.9242 2 14.1032C2 15.283 2.05326 16.4858 2.16311 17.4726C2.21784 17.9643 2.28883 18.4229 2.38053 18.807C2.46043 19.1416 2.59126 19.5854 2.85131 19.906C3.08981 20.2 3.43086 20.3352 3.60561 20.3981C3.82965 20.4789 4.09015 20.5429 4.36115 20.596C4.90739 20.703 5.60964 20.7873 6.39637 20.853C7.97657 20.9851 9.99449 21.05 12 21.05C14.0055 21.05 16.0234 20.9851 17.6036 20.853C18.3904 20.7873 19.0926 20.703 19.6388 20.596C19.9098 20.5429 20.1703 20.4789 20.3944 20.3981C20.5691 20.3352 20.9102 20.2 21.1487 19.906C21.4087 19.5854 21.5396 19.1416 21.6195 18.807C21.7112 18.4229 21.7822 17.9643 21.8369 17.4726C21.9467 16.4858 22 15.283 22 14.1032C22 12.9242 21.9468 11.7386 21.8363 10.7872C21.7815 10.3144 21.7095 9.87284 21.6142 9.50896C21.5667 9.32752 21.5074 9.14189 21.4303 8.9716C21.3608 8.81815 21.2389 8.58976 21.0254 8.40554Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="11.4858" y1="6.44995" x2="8.39999" y2="3.36416" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="-1" x2="5.36396" y2="-1" transform="matrix(0.707107 -0.707107 -0.707107 -0.707107 11.1 6.44995)" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { label: 'narration',   value: match.Narração,                  svg: '<svg viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 10V12C19 15.866 15.866 19 12 19M5 10V12C5 15.866 8.13401 19 12 19M12 19V22M8 22H16M12 15C10.3431 15 9 13.6569 9 12V5C9 3.34315 10.3431 2 12 2C13.6569 2 15 3.34315 15 5V12C15 13.6569 13.6569 15 12 15Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { label: 'origin',      value: LanguageManager.t(match.Origem), svg: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentcolor" class="cf-icon-svg"><path d="M13.27 14.91a.554.554 0 0 1-.392-.946 6.201 6.201 0 1 0-8.763 0 .554.554 0 1 1-.784.784 7.31 7.31 0 1 1 10.331 0 .55.55 0 0 1-.392.162zm-2.16-2.159a.554.554 0 0 1-.392-.946 3.142 3.142 0 1 0-4.444 0 .554.554 0 0 1-.783.784 4.25 4.25 0 1 1 6.011 0 .553.553 0 0 1-.391.162zm-1.117 3.32H9.05V10.99a1.511 1.511 0 1 0-1.108 0v5.081H7a.554.554 0 0 0 0 1.109h2.993a.554.554 0 0 0 0-1.109z"/></svg>' },
        { label: 'type',        value: LanguageManager.t(match.Tipo),   svg: '' },
    ];

    document.getElementById(divId).innerHTML = Elements.setDetailList(rows);
}

function renderTechInfo(match, divId) {
    const items = [
        { label: 'ID',          value: match.ID,                  svg: '<svg viewBox="0 0 512 532" fill="currentcolor" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><g><g><g><path d="M362.669,42.671h-50.815l5.896-11.793c5.269-10.538,0.998-23.353-9.541-28.622s-23.353-0.998-28.622,9.541 l-15.437,30.874h-16.297l-15.437-30.874c-5.269-10.538-18.083-14.81-28.622-9.541s-14.81,18.083-9.541,28.622l5.896,11.793 h-50.815c-35.355,0-64,28.645-64,64v341.333c0,35.355,28.645,64,64,64h213.333c35.355,0,64-28.645,64-64V106.671 C426.669,71.316,398.024,42.671,362.669,42.671z M384.002,448.005c0,11.791-9.542,21.333-21.333,21.333H149.336 c-11.791,0-21.333-9.542-21.333-21.333V106.671c0-11.791,9.542-21.333,21.333-21.333h72.149l15.437,30.874 c0.071,0.143,0.159,0.272,0.233,0.413c0.19,0.36,0.39,0.713,0.6,1.062c0.159,0.263,0.32,0.523,0.489,0.777 c0.214,0.323,0.439,0.637,0.671,0.949c0.193,0.26,0.388,0.516,0.592,0.765c0.23,0.281,0.471,0.554,0.716,0.824 c0.231,0.254,0.463,0.505,0.704,0.746c0.242,0.242,0.493,0.474,0.748,0.706c0.27,0.245,0.542,0.485,0.823,0.715 c0.249,0.204,0.506,0.399,0.766,0.593c0.311,0.232,0.625,0.456,0.948,0.67c0.255,0.169,0.515,0.331,0.779,0.49 c0.348,0.21,0.701,0.409,1.06,0.599c0.141,0.074,0.27,0.162,0.414,0.234c0.135,0.068,0.275,0.116,0.411,0.18 c0.35,0.166,0.704,0.319,1.062,0.465c0.315,0.129,0.629,0.254,0.947,0.367c0.316,0.112,0.635,0.212,0.956,0.309 c0.361,0.109,0.721,0.215,1.083,0.305c0.293,0.072,0.589,0.131,0.885,0.19c0.385,0.077,0.768,0.153,1.154,0.208 c0.302,0.044,0.605,0.072,0.908,0.103c0.374,0.038,0.747,0.075,1.121,0.092c0.337,0.016,0.675,0.015,1.014,0.015 c0.339,0,0.676,0.001,1.013-0.015c0.374-0.018,0.747-0.055,1.121-0.092c0.304-0.031,0.607-0.059,0.908-0.103 c0.386-0.056,0.769-0.131,1.154-0.208c0.296-0.06,0.592-0.118,0.885-0.191c0.363-0.089,0.723-0.195,1.083-0.304 c0.321-0.097,0.641-0.197,0.957-0.309c0.317-0.113,0.632-0.237,0.946-0.366c0.358-0.146,0.712-0.3,1.062-0.466 c0.136-0.064,0.275-0.112,0.41-0.18c0.143-0.072,0.272-0.159,0.413-0.233c0.359-0.189,0.712-0.389,1.061-0.599 c0.264-0.159,0.523-0.32,0.778-0.489c0.323-0.214,0.637-0.439,0.949-0.67c0.26-0.193,0.516-0.388,0.765-0.592 c0.281-0.23,0.554-0.471,0.824-0.716c0.254-0.231,0.505-0.463,0.747-0.704c0.242-0.242,0.474-0.493,0.705-0.747 c0.245-0.27,0.485-0.542,0.715-0.823c0.204-0.249,0.399-0.506,0.592-0.766c0.232-0.311,0.456-0.626,0.67-0.949 c0.169-0.254,0.33-0.514,0.489-0.778c0.21-0.349,0.41-0.702,0.599-1.061c0.074-0.141,0.162-0.27,0.233-0.413l15.437-30.874 h72.149c11.791,0,21.333,9.542,21.333,21.333V448.005z"/><path d="M320.002,149.338h-128c-11.782,0-21.333,9.551-21.333,21.333c0,11.782,9.551,21.333,21.333,21.333h128 c11.782,0,21.333-9.551,21.333-21.333C341.336,158.889,331.784,149.338,320.002,149.338z"/></g></g></g></svg>' },
        { label: 'quality',     value: match.Qualidade,           svg: '<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 5V19M17 5V19M3 8H7M17 8H21M3 16H7M17 16H21M3 12H7M17 12H21M6.2 20H17.8C18.9201 20 19.4802 20 19.908 19.782C20.2843 19.5903 20.5903 19.2843 20.782 18.908C21 18.4802 21 17.9201 21 16.8V7.2C21 6.0799 21 5.51984 20.782 5.09202C20.5903 4.71569 20.2843 4.40973 19.908 4.21799C19.4802 4 18.9201 4 17.8 4H6.2C5.0799 4 4.51984 4 4.09202 4.21799C3.71569 4.40973 3.40973 4.71569 3.21799 5.09202C3 5.51984 3 6.07989 3 7.2V16.8C3 17.9201 3 18.4802 3.21799 18.908C3.40973 19.2843 3.71569 19.5903 4.09202 19.782C4.51984 20 5.07989 20 6.2 20Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        { label: 'audioFormat', value: match['Formato de áudio'], svg: '<svg viewBox="0 0 22 22" id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg"><polyline class="cls-1" points="23.45 11.04 21.55 11.04 18.68 17.73 17.73 17.73 17.73 6.27 16.77 6.27 12.96 22.5 12 22.5 12 1.5 11.04 1.5 7.23 17.73 6.27 17.73 6.27 6.27 6.27 6.27 5.32 6.27 2.46 11.04 0.55 11.04"  stroke="currentcolor" stroke-width="2" stroke-linecap="round"/></svg>' },
        { label: 'bitrate',     value: (match.Bitrate + ' Mbps'), svg: '<svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 11V8.5C17 7.67157 16.3284 7 15.5 7H5.5C4.67157 7 4 7.67157 4 8.5V16.5C4 17.3284 4.67157 18 5.5 18H15.5C16.3284 18 17 17.3284 17 16.5V14.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round"/><path d="M17 11L20.2764 9.3618C20.6088 9.19558 21 9.43733 21 9.80902V15.2785C21 15.6276 20.6513 15.8692 20.3244 15.7467L17 14.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round"/></svg>' },
        { label: 'duration',    value: match.attendance },
        { label: 'duration',    value: match.Duração,             svg: '<svg viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12ZM3.00683 12C3.00683 16.9668 7.03321 20.9932 12 20.9932C16.9668 20.9932 20.9932 16.9668 20.9932 12C20.9932 7.03321 16.9668 3.00683 12 3.00683C7.03321 3.00683 3.00683 7.03321 3.00683 12Z" fill="currentcolor"/><path d="M12 5C11.4477 5 11 5.44771 11 6V12.4667C11 12.4667 11 12.7274 11.1267 12.9235C11.2115 13.0898 11.3437 13.2343 11.5174 13.3346L16.1372 16.0019C16.6155 16.278 17.2271 16.1141 17.5032 15.6358C17.7793 15.1575 17.6155 14.5459 17.1372 14.2698L13 11.8812V6C13 5.44772 12.5523 5 12 5Z" fill="currentcolor"/></svg>' },
        { label: 'fileSize',    value: Utils.formatSize(match.Tamanho), svg: '<svg viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 9V17.8C19 18.9201 19 19.4802 18.782 19.908C18.5903 20.2843 18.2843 20.5903 17.908 20.782C17.4802 21 16.9201 21 15.8 21H8.2C7.07989 21 6.51984 21 6.09202 20.782C5.71569 20.5903 5.40973 20.2843 5.21799 19.908C5 19.4802 5 18.9201 5 17.8V6.2C5 5.07989 5 4.51984 5.21799 4.09202C5.40973 3.71569 5.71569 3.40973 6.09202 3.21799C6.51984 3 7.0799 3 8.2 3H13M19 9L13 3M19 9H14C13.4477 9 13 8.55228 13 8V3" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
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
        { label: 'referee',       value: detail.referees.referee,                 svg: '<svg viewBox="0 0 480 480" xml:space="preserve" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><style type="text/css">.st0{fill:currentcolor;}</style><g><path class="st0" d="M314.022,167.059c-21.788,0-41.358,0-60.564,0H0v91.268l122.43,21.778c23.356,4.153,43.101,19.682,52.644,41.4 c0,0,4.585,8.504,7.837,17.85c19.608,56.341,68.563,99.722,131.111,99.722c75.117,0,136.009-60.897,136.009-136.01 C450.031,227.956,389.139,167.059,314.022,167.059z M314.022,355.472c-28.945,0-52.408-23.464-52.408-52.404 c0-28.939,23.464-52.413,52.408-52.413c28.944,0,52.408,23.474,52.408,52.413C366.43,332.008,342.966,355.472,314.022,355.472z"/><path class="st0" d="M375.991,72.922c-40.945,0-274.535,0-274.535,0L2.008,144.233h145.575h125.84h40.94 c86.056,0,156.068,70.772,156.068,156.828c0,4.428-0.299,8.787-0.666,13.127l18.839-28.988c0.166-0.245,0.318-0.5,0.48-0.744 l3.478-5.721C504.824,258.307,512,234.491,512,208.932C512,133.82,451.108,72.922,375.991,72.922z M291.391,130.821h-62.66 l55.66-46.662h62.66L291.391,130.821z"/></g></svg>'},
        { label: 'refereeAssis',  value: detail.referees.assistants?.join(' · '), svg: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 21V3.90002C5 3.90002 5.875 3 8.5 3C11.125 3 12.875 4.8 15.5 4.8C18.125 4.8 19 3.9 19 3.9V14.7C19 14.7 18.125 15.6 15.5 15.6C12.875 15.6 11.125 13.8 8.5 13.8C5.875 13.8 5 14.7 5 14.7" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'},
        { label: 'refereeFourth', value: detail.referees.fourth_official,         svg: '<svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.1299 13.2539H14.002V7.04688H12.0059L7.85645 13.6025L7.94531 14.8467H12.0264V17H14.002V14.8467H15.1299V13.2539ZM12.0264 13.2539H9.8252L11.8965 9.96582L12.0264 9.74023V13.2539Z" fill="currentcolor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12Z" fill="currentcolor"/></svg>'},
    ];

    htmlEl = Elements.setDetailList(rows);

    if (!htmlEl) return;

    document.getElementById('meRefereeSection').style.display = 'block'
    document.getElementById('meRefereeInfo').innerHTML = htmlEl;

    const row = document.querySelector(".score-date-row");

    const span = document.createElement("span");
    span.innerHTML = `<svg width="var(--font-size-mdm)" height="var(--font-size-mdm)" viewBox="0 0 18 32" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage"><g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-104.000000, -411.000000)" fill="currentcolor"><path d="M116,426 C114.343,426 113,424.657 113,423 C113,421.343 114.343,420 116,420 C117.657,420 119,421.343 119,423 C119,424.657 117.657,426 116,426 L116,426 Z M116,418 C113.239,418 111,420.238 111,423 C111,425.762 113.239,428 116,428 C118.761,428 121,425.762 121,423 C121,420.238 118.761,418 116,418 L116,418 Z M116,440 C114.337,440.009 106,427.181 106,423 C106,417.478 110.477,413 116,413 C121.523,413 126,417.478 126,423 C126,427.125 117.637,440.009 116,440 L116,440 Z M116,411 C109.373,411 104,416.373 104,423 C104,428.018 114.005,443.011 116,443 C117.964,443.011 128,427.95 128,423 C128,416.373 122.627,411 116,411 L116,411 Z" id="location" sketch:type="MSShapeGroup"></path></g></g></svg> ${detail.region ? detail.region : detail.city}`;

    row.appendChild(span);
}

function renderAttRev(detail) {
    const attendance = Array.isArray(detail.attendance)
        ? detail.attendance
        : [detail.attendance];

        console.log(attendance)
    const rows = [
        ...attendance.flatMap(item => [
            {
                label: item.label,
                value: item.value.toLocaleString(LanguageManager.getLanguage()),
                svg: '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-users"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
            },

            ...(item.occupancy && item.label.toLowerCase() === 'público total'
                ? [{
                    label: `${item.occupancy}% ${LanguageManager.translateText('stadiumCapacity')}`,
                    value: item.occupancy,
                    noNewLine: true,
                    progressBar: true
                }]
                : [])
        ]),

        {
            label: 'revenue',
            value: detail.revenue.value.toLocaleString(
                LanguageManager.getLanguage(),
                {
                    style: 'currency',
                    currency: detail.revenue.currency
                }
            ),
            svg: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_443_3628)"><rect x="2" y="6" width="20" height="12" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 10C21.4747 10 20.9546 9.89654 20.4693 9.69552C19.984 9.4945 19.543 9.19986 19.1716 8.82843C18.8001 8.45699 18.5055 8.01604 18.3045 7.53073C18.1035 7.04543 18 6.52529 18 6L22 6L22 10Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 18C18 16.9391 18.4214 15.9217 19.1716 15.1716C19.9217 14.4214 20.9391 14 22 14L22 18L18 18Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14C3.06087 14 4.07828 14.4214 4.82843 15.1716C5.57857 15.9217 6 16.9391 6 18L2 18L2 14Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6C6 7.06087 5.57857 8.07828 4.82843 8.82843C4.07828 9.57857 3.06087 10 2 10L2 6H6Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.0741 9.5H11.3333C10.597 9.5 10 10.0596 10 10.75C10 11.4404 10.597 12 11.3333 12H13.1111C13.8475 12 14.4444 12.5596 14.4444 13.25C14.4444 13.9404 13.8475 14.5 13.1111 14.5H10" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9.51733V8.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15.5173V14.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_443_3628"><rect width="24" height="24" fill="white"/></clipPath></defs></svg>'
        },

        ...(detail.revenue.averageTicket != null
            ? [{
                label: 'ticketAveragePrice',
                value: detail.revenue.averageTicket.toLocaleString(
                    LanguageManager.getLanguage(),
                    {
                        style: 'currency',
                        currency: detail.revenue.currency
                    }
                ),
                svg: '<svg fill="currentcolor" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><path d="M4,8.39l2,2.09L8.39,7.76l2.69,2.75,4.7-5.89L14.22,3.38l-3.3,4.11L8.29,4.81,6,7.52l-1.91-2L.29,9.29l1.42,1.42ZM0,12.3v1.4H16V12.3Z"/></svg>'
            }]
            : []),

        ...(detail.revenue.adjustedRevenue != null
            ? [
                {
                    label: `inflationAdjusted`,
                    value: detail.revenue.adjustedRevenue.value.toLocaleString(
                        LanguageManager.getLanguage(),
                        {
                            style: 'currency',
                            currency: detail.revenue.adjustedRevenue.currency
                        }
                    ),
                    svg: '<svg viewBox="0 0 385 190" fill="currentcolor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><g><path d="M385.375,65.087c-1.439-2.148-3.904-3.404-6.461-3.337l-50.696,1.368c-3.471,0.094-6.429,2.547-7.161,5.941 c-0.732,3.395,0.95,6.85,4.074,8.366l11.846,5.75L196.96,183.012l-95.409-86.504c-4.738-4.296-11.955-4.322-16.723-0.062 L4.173,168.491c-5.149,4.599-5.594,12.501-0.995,17.649c4.598,5.148,12.499,5.594,17.649,0.995l72.265-64.55l94.533,85.709 c2.369,2.147,5.376,3.239,8.398,3.239c2.532,0,5.074-0.767,7.255-2.322L350.82,104.01l0.701,11.074 c0.22,3.464,2.777,6.329,6.193,6.939c0.444,0.079,0.889,0.118,1.328,0.118c2.938,0,5.662-1.724,6.885-4.483l20.077-45.327 C387.052,69.968,386.815,67.234,385.375,65.087z"/></g></svg>'
                },
                {
                    label: '',
                    value: '+' + `${(detail.revenue.adjustedRevenue.realIncrease / 100).toLocaleString(
                        LanguageManager.getLanguage(),
                        {
                            style: 'percent',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                        }
                    )}` + ` nominal`,
                    noNewLine: true,
                    smallColored: '#25b148',
                }
            ]
            : [])
    ];

    const htmlEl = Elements.setDetailList(rows);

    if (!htmlEl) return;

    document.getElementById('meAttRevSection').style.display = 'block';
    document.getElementById('meAttRevInfo').innerHTML = htmlEl;
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