// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;

    const params = new URLSearchParams(location.search);
    const id     = params.get('id');
    let sport  = params.get('sport');
    
    Utils.applySportTheme(sport);

    sport = sport === 'multisport' ? 'multisport' : sport

    if (!id) { showError(); return; }

    try {
        const data = await APIService.fetchEnrichment(id, sport);

        renderMatch(data, sport);
        hideLoading();
        showContent();
    } catch (err) {
        console.error('Erro ao carregar partida:', err);
        showError();
    }
});

// ─── Render principal ────────────────────────────
function renderMatch(match, sport) {
    renderHero(match);
    Elements.renderImages(match, "matches_image/");
    Elements.renderTvInfo(match, 'meTvInfo');
    Elements.renderTechInfo(match, 'meTechInfo');
    Elements.renderRefereeInfo(match, 'meRefereeInfo', 'meRefereeSection');
    Elements.renderAttRev(match, 'meAttRevInfo');
    Elements.renderStorage(match.technical_details?.local, match.technical_details?.nuvem, 'meStorageBadges');
    Elements.renderObsAndTags(match);
    Elements.renderLineups(match.home_team, match.away_team);
    Elements.renderStatistics(match);
    Elements.renderPlays(match, match.home_team.tla);
    Elements.renderLastResults(match.last_results, match.home_team?.name, match.away_team?.name);

    if (match.penalties?.length) {
        Elements.renderPenalties(match, match.home_team.tla);
    }
}

function renderHero(match) {
    const { homeGoals, awayGoals } = Utils.parseWinner(match.score?.fullTime?.home, match.score?.fullTime?.away);
    const hasScore  = homeGoals !== null && awayGoals !== null;

    const compLogoSlug = (match.competition?.name || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    const year    = Utils.parseDate(match.utcDate)?.getFullYear() || '';
    const compLogo = match.competition?.name ? `competition_logos/${compLogoSlug}_${year}.png` : '';
    const dateStr  = Utils.formatMatchDate(match.utcDate);

    document.getElementById('meHero').innerHTML = `
        <div class="score-overlay">
            <div class="logo-title-header">
                ${compLogo ? `<img src="${compLogo}" class="comp-logo" onerror="this.style.display='none'" alt="">` : ''}
                <h2 id="modalTitle">
                    <div class="section-title modal-title-competition">${LanguageManager.t(match.competition?.name) || ''}</div>
                    <div class="modal-title-phase">${LanguageManager.translateText(match.competition?.phase)}</div>
                </h2>
            </div>

            <!-- Desktop -->
            <div class="score-desktop">
                <span class="score-team-name">${LanguageManager.t(match.home_team.name) || ''}</span>
                ${match.home_team.logo ? `<img src="${match.home_team.logo}" class="score-team-logo" onerror="this.style.display='none'" alt="">` : ''}
                <span class="score-value-modal">${hasScore ? homeGoals : ''} × ${hasScore ? awayGoals : ''}</span>
                ${match.away_team.logo ? `<img src="${match.away_team.logo}" class="score-team-logo" onerror="this.style.display='none'" alt="">` : ''}
                <span class="score-team-name">${LanguageManager.t(match.away_team.name) || '—'}</span>
            </div>

            <!-- Mobile -->
            <div class="score-mobile">
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match.home_team.logo ? `<img src="${match.home_team.logo}" class="score-mobile-logo" onerror="this.style.display='none'" alt="">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.home_team.name) || '—'}</span>
                    </div>
                    <span class="score-mobile-value">${hasScore ? homeGoals : ''}</span>
                </div>
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match.away_team.logo ? `<img src="${match.away_team.logo}" class="score-mobile-logo" onerror="this.style.display='none'" alt="">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.away_team.name) || '—'}</span>
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
                ${match.venue?.name ? `<span>
                    <svg width="var(--font-size-mdm)" height="var(--font-size-mdm)" viewBox="0 0 964.199 964.2" fill="currentcolor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><g><path d="M833.1,241.359v-68.8l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.4v31.6v33.1 c-34.199-9-72.1-16.6-113-22.3v-65.3l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.3 v31.7v38.9c-36.1-3.6-73.9-5.7-113-6.4v-76.6l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5 v61.2v21v56.2c-39.4,0.7-77.6,2.9-114,6.5v-59.5l44.8-18.3c10.3-4.2,10.3-18.8,0-23l-77.7-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.3 v31.7v45c-40.9,5.8-78.8,13.3-113,22.4v-53.8l44.8-18.3c10.3-4.2,10.3-18.8,0-23l-77.7-31.8c-8.2-3.3-17.1,2.7-17.1,11.5v50.4v31.6 v48.7C49.4,270.159,0,308.359,0,350.459l0,0v413.8c0,87.899,215.8,159.199,482.1,159.199c266.3,0,482.099-71.3,482.099-159.199 v-413.8l0,0C964.199,308.259,914.4,269.859,833.1,241.359z M149.1,746.359c-32.5-9.8-61.2-21.1-85.2-33.6v-27.7v-28.9 c2.1,0.601,4.2,1.5,6.2,2.7c6.6,4.1,13.9,8.1,21.7,11.9c16.7,8.3,35.9,16,57.4,23.1v52.5H149.1z M149.1,587.159 c-32.5-9.8-61.2-21.1-85.2-33.6v-56.601c2.1,0.601,4.2,1.5,6.2,2.7c20.9,12.9,47.6,24.7,79.1,35v52.5H149.1z M814.1,535.159 c29.5-9.7,55.201-20.8,76-33c1.801-1.1,3.801-1.899,5.701-2.5v56.2c-23.4,11.7-50.9,22.3-81.801,31.6v-52.3H814.1z M226,606.359 c-9.2-1.9-18.2-3.8-26.9-5.8v-51.4c11.8,2.9,24.1,5.7,36.8,8.2c20.9,4.2,42.7,7.9,65.2,10.9v48.399v2c-2.5-0.3-4.9-0.7-7.4-1 C270.4,614.559,247.7,610.759,226,606.359z M351.1,611.059v-37c34.4,3.3,69.9,5.2,106,5.899v25.4v24.6c-36-0.6-71.5-2.5-106-5.699 V611.059z M507.1,605.359v-25.4c36-0.6,71.201-2.6,105-5.8v36.8v13.4c-34.199,3.1-69.4,5-105,5.6V605.359z M662.1,616.559v-48.101 c36.4-4.899,70.6-11.3,102-19v51.301c-9.799,2.3-19.799,4.399-30,6.399c-20.5,4-41.699,7.601-63.6,10.601 c-2.801,0.399-5.6,0.8-8.4,1.1V616.559z M814.1,694.359c21.701-7.1,41.301-15,58.4-23.5c6.199-3.1,12.1-6.3,17.699-9.5 c1.801-1.1,3.801-1.9,5.701-2.5v23.7v32.5c-23.4,11.7-50.9,22.3-81.801,31.6V694.359L814.1,694.359z M861.1,365.659 c-22.4,12.5-53.199,24.4-89.1,34.4c-80.199,22.3-183.199,34.5-289.9,34.5c-106.7,0-209.7-12.2-289.9-34.5 c-35.9-10-66.7-21.8-89.1-34.4c-11-6.1-18.1-11.4-22.6-15.3c4.5-3.9,11.6-9.1,22.6-15.3c22.4-12.5,53.2-24.4,89.1-34.4 c80.2-22.3,183.2-34.5,289.9-34.5c106.701,0,209.701,12.3,289.9,34.5c35.9,10,66.699,21.8,89.1,34.4c11,6.1,18.1,11.4,22.6,15.3 C879.1,354.359,872,359.56,861.1,365.659z M220,764.259c-7.1-1.5-14.1-3-20.9-4.601v-51.399c11.8,2.899,24.1,5.699,36.8,8.199 c20.9,4.2,42.7,7.9,65.2,10.9v36.8v13.601c-25.9-3.4-51.1-7.5-75.1-12.4C224,765.159,222,764.659,220,764.259z M351.1,764.259 v-31.101c34.4,3.3,69.9,5.2,106,5.9v25.2v24.8c-36-0.601-71.5-2.5-106-5.7V764.259z M507.1,764.259v-25.2 c36-0.601,71.201-2.601,105-5.8v31v19.199c-34.199,3.101-69.4,5-105,5.601V764.259z M734.1,766.359c-23.1,4.6-47.199,8.5-72,11.7 v-13.7v-36.7c36.4-4.899,70.6-11.3,102-19v51.3c-6.5,1.5-13.199,3-19.9,4.4C740.801,764.958,737.5,765.659,734.1,766.359z"/></g></svg>
                    ${match.venue?.name}
                    </span>` : ''}
                ${match.venue?.city ? `<span>
                    <svg width="var(--font-size-mdm)" height="var(--font-size-mdm)" viewBox="0 0 18 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage">
                            <g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-104.000000, -411.000000)" fill="currentcolor">
                                <path d="M116,426 C114.343,426 113,424.657 113,423 C113,421.343 114.343,420 116,420 C117.657,420 119,421.343 119,423 C119,424.657 117.657,426 116,426 L116,426 Z M116,418 C113.239,418 111,420.238 111,423 C111,425.762 113.239,428 116,428 C118.761,428 121,425.762 121,423 C121,420.238 118.761,418 116,418 L116,418 Z M116,440 C114.337,440.009 106,427.181 106,423 C106,417.478 110.477,413 116,413 C121.523,413 126,417.478 126,423 C126,427.125 117.637,440.009 116,440 L116,440 Z M116,411 C109.373,411 104,416.373 104,423 C104,428.018 114.005,443.011 116,443 C117.964,443.011 128,427.95 128,423 C128,416.373 122.627,411 116,411 L116,411 Z" id="location" sketch:type="MSShapeGroup"></path>
                            </g>
                        </g>
                    </svg>
                    ${match.venue?.city + ', ' + match.venue?.region}
                </span>` : ''}
            </div>
        </div>
    `;
}

// ─── Estado da página ─────────────────────────────
function hideLoading()  { document.getElementById('matchEnrichedLoading').style.display = 'none'; }
function showContent()  { document.getElementById('matchEnrichedContent').style.display = 'block'; }
function showError()    { hideLoading(); document.getElementById('matchEnrichedError').style.display = 'block'; }