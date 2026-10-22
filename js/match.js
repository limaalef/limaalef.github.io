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
        // Futebol e multiesporte usam o endpoint enriquecido; carnaval e motorsport usam o item simples.
        const data = EVENT_SPORTS.includes(sport)
            ? await loadEventItem(id, sport)
            : await APIService.fetchEnrichment(id, sport);

        pageState = { data, id, sport };
        drawPage();
        hideLoading();
        showContent();

        // Troca de idioma: os textos são montados em JS, então a página é redesenhada
        document.addEventListener('languagechange', () => { if (pageState) drawPage(); });
    } catch (err) {
        console.error('Erro ao carregar partida:', err);
        showError();
    }
});

// ─── Estado e desenho da página ──────────────────
// Tudo que depende de idioma é gerado aqui; por isso o desenho pode ser repetido (troca de idioma).
let pageState = null;
const EVENT_SPORTS = ['carnaval', 'motor'];

function drawPage() {
    const { data, id, sport } = pageState;
    const isEvent = EVENT_SPORTS.includes(sport);

    // Cada categoria tem o seu corpo: partida (colunas + estatísticas) ou evento (carnaval/motorsport)
    document.getElementById('meBody').hidden = isEvent;
    document.getElementById('meEventBody').hidden = !isEvent;

    if (isEvent) {
        renderEventPage(data, sport);
    } else {
        renderMatch(data, sport);
        // Botão "Editar dados": só aparece com sessão de administrador (a autorização real é do servidor)
        attachEditButton(id, sport);
    }

    // Botão "Adicionar ao pedido" (módulo de pedidos, request.js) — mesmo item e id usados no modal
    attachRequestButton({ ...data, id: data.id ?? id, sport }, sport);

    updateDocumentTitle(data, sport);
}

function updateDocumentTitle(match, sport) {
    if (EVENT_SPORTS.includes(sport)) { document.title = `${eventTitle(match, sport)} — Sports Archive`; return; }
    const t = key => LanguageManager.t(key);
    const home = t(match.home_team?.name) || '', away = t(match.away_team?.name) || '';
    const { homeGoals, awayGoals } = Utils.parseWinner(match.score?.fullTime?.home, match.score?.fullTime?.away);
    const score = homeGoals !== null && awayGoals !== null ? ` ${homeGoals} × ${awayGoals} ` : ' × ';
    document.title = `${home}${score}${away} — Sports Archive`;
}

// ─── Botão de edição (admin) ─────────────────────
// Fica na linha de ações da capa, junto de "Assistir" e "Adicionar ao pedido" (secundário).
function attachEditButton(id, sport) {
    if (!Auth.adminSession()) return;
    const row = document.querySelector('#meHero .match-buttons');
    if (!row || row.querySelector('.me-edit-link')) return;
    const link = document.createElement('a');
    link.className = 'me-edit-link match-action--ghost';
    link.href = `${CONFIG.MATCHDATA_EDIT_URL}?id=${encodeURIComponent(id)}&sport=${encodeURIComponent(sport)}`;
    link.textContent = LanguageManager.t('editData');
    link.setAttribute('aria-label', LanguageManager.t('editDataLabel'));
    link.target = '_blank';
    link.rel = 'noopener';
    row.appendChild(link);
}

// ─── Botão de pedido (carrinho) ──────────────────
// A linha .match-buttons (.score-header-buttons) já existe na capa; o módulo de pedidos
// anexa o botão nela, ao lado de "Assistir".
function attachRequestButton(item) {
    const overlay = document.querySelector('#meHero .score-overlay');
    if (!overlay || !window.RequestModule) return;
    RequestModule.attachDetailButton(item, overlay);
}

// ─── Arquivo: especificações + armazenamento (compartilhado com os eventos) ───
// Armazenamento: ícone + texto na cor do tema (verde = local, azul = nuvem), sem pílula nem bolinha.
function fileInfo(item) {
    const t = key => LanguageManager.t(key);
    const esc = value => Utils.escapeHtml(value);
    const tech = item.technical_details || {};
    const rows = [
        { label: 'ID',             value: item.id },
        { label: t('quality'),     value: tech.video_quality },
        { label: t('audioFormat'), value: tech.audio_format },
        { label: t('bitrate'),     value: tech.video_bitrate ? `${tech.video_bitrate} Mbps` : '' },
        { label: t('duration'),    value: tech.duration },
        { label: t('fileSize'),    value: Utils.formatSize(tech.file_size) },
    ].filter(r => !Utils.isBlank(r.value))
     .map(r => keyValueRow(esc(r.label), esc(r.value)))
     .join('');

    const places = Elements.storagePlaces(tech);
    return { rows, places };
}

function storageHtml(places) {
    if (!places.length) return '';
    const label = Utils.escapeHtml(LanguageManager.t('storageInfo'));
    return `<span class="match-aside-method-label">${label}</span><span class="match-aside-method-value">${places.join('')}</span>`;
}

// ─── Render principal ────────────────────────────
function renderMatch(match, sport) {
    renderHero(match);
    Elements.renderImages(match, "matches_image/");
    renderAside(match);
    Elements.renderArchiveStatus(match);
    Elements.renderObsAndTags(match);
    Elements.renderLineups(match.home_team, match.away_team);
    Elements.renderStatistics(match);
    Elements.renderPlays(match, match.home_team.tla);
    Elements.renderLastResults(match.last_results, match.home_team?.name, match.away_team?.name);

    if (match.penalties?.length) {
        Elements.renderPenalties(match, match.home_team.tla);
    }
}

// ─── Coluna da direita ───────────────────────────
// Painel único com quatro blocos (transmissão, arbitragem, público e renda, arquivo).
// Usa as linhas rótulo → valor compartilhadas (ui-components); as funções Elements.render*
// continuam como estão porque o modal e watch.html ainda as usam.
function renderAside(match) {
    const t   = key => LanguageManager.t(key);
    const esc = value => Utils.escapeHtml(value);
    const lang = LanguageManager.getLanguage();
    const rows = list => list
        .filter(r => !Utils.isBlank(r.value))
        .map(r => keyValueRow(esc(r.label), esc(r.value)))
        .join('');

    const station = match.station || {};
    const tech    = match.technical_details || {};
    const money   = (value, currency) => value.toLocaleString(lang, { style: 'currency', currency });

    // Transmissão
    const tv = rows([
        { label: t('broadcaster'), value: station.name },
        { label: t('narration'),   value: station.commentary },
        { label: t('origin'),      value: station.source_type ? t(station.source_type) : '' },
        { label: t('type'),        value: match.type ? t(match.type) : '' },
    ]);

    // Arbitragem
    const ref = match.referees || {};
    const referee = rows([
        { label: t('referee'),       value: ref.referee },
        { label: t('refereeAssis'),  value: Array.isArray(ref.assistants) ? ref.assistants.join(' · ') : ref.assistants },
        { label: t('refereeFourth'), value: ref.fourth_official },
    ]);

    // Público e renda: sem nenhum dos dois, o bloco não aparece (só estádio/capacidade repetiria o local da partida)
    const attendance = (Array.isArray(match.attendance) ? match.attendance : [match.attendance])
        .filter(item => item && item.value != null);
    const revenue = match.revenue?.value != null ? match.revenue : null;
    let attRev = '';
    if (attendance.length || revenue) {
        let html = rows([
            { label: t('stadium'),             value: match.venue?.name || (typeof match.venue === 'string' ? match.venue : '') },
            { label: t('stadiumCapacityFull'), value: match.venue?.capacity?.toLocaleString(lang) },
        ]);
        attendance.forEach(item => {
            html += rows([{ label: t(item.label), value: item.value.toLocaleString(lang) }]);
            const showOccupancy = item.occupancy && (attendance.length === 1 || String(item.label).toLowerCase() === 'público total');
            if (showOccupancy) {
                const percent = Math.max(0, Math.min(100, Number(item.occupancy) || 0));
                html += `<div class="usage-bar" role="img" aria-label="${esc(item.occupancy)}% ${esc(LanguageManager.translateText('stadiumCapacity'))}">
                    <div class="usage-bar-segment usage-bar-segment--archive" style="width:${percent}%"></div></div>`
                    + keyValueRow(esc(t('occupancy')), `${esc(item.occupancy)}% ${esc(LanguageManager.translateText('stadiumCapacity'))}`);
            }
        });
        if (revenue) {
            // Renda segue o mesmo padrão das demais linhas (sem destaque)
            html += rows([
                { label: t('revenue'),            value: money(revenue.value, revenue.currency) },
                { label: t('ticketAveragePrice'), value: revenue.averageTicket != null ? money(revenue.averageTicket, revenue.currency) : '' },
            ]);
            const adjusted = revenue.adjustedRevenue;
            if (adjusted?.value != null) {
                html += rows([{ label: t('inflationAdjusted'), value: money(adjusted.value, adjusted.currency) }]);
                if (adjusted.realIncrease != null) {
                    const increase = (adjusted.realIncrease / 100).toLocaleString(lang, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2 });
                    html += `<div class="match-aside-note">+${increase} ${esc(t('nominalIncrease'))}</div>`;
                }
            }
        }
        attRev = html;
    }

    // Arquivo: especificações + onde está armazenado
    const { rows: file, places } = fileInfo(match);
    const storage = document.getElementById('meStorage');
    storage.innerHTML = storageHtml(places);
    storage.hidden = !places.length;

    const fill = (id, html) => {
        const el = document.getElementById(id);
        el.innerHTML = html;
        el.closest('.match-aside-section').hidden = !html && !(id === 'meTechInfo' && places.length);
    };
    fill('meTvInfo', tv);
    fill('meRefereeInfo', referee);
    fill('meAttRevInfo', attRev);
    fill('meTechInfo', file);

    const aside = document.getElementById('meAside');
    aside.hidden = !aside.querySelector('.match-aside-section:not([hidden])');
}

function renderHero(match) {
    const { homeGoals, awayGoals } = Utils.parseWinner(match.score?.fullTime?.home, match.score?.fullTime?.away);
    const hasScore  = homeGoals !== null && awayGoals !== null;

    const compLogo = Utils.competitionLogoUrl(match.competition?.name, match.utcDate);
    const dateStr  = Utils.formatMatchDate(match.utcDate);

    // Fase vazia (null) não vira texto nem ocupa linha
    const phase = match.competition?.phase ? LanguageManager.translateText(match.competition.phase) : '';

    // Sem imagens, a capa vira só o bloco de texto (altura do conteúdo, sem carrossel nem botão de ocultar)
    const images = match.media?.image ?? match.image;
    const hasImages = Array.isArray(images) ? images.length > 0 : !Utils.isBlank(images);

    // "Assistir" só aparece quando a partida tem vídeo embutido (media.embed_video)
    const watchHref = match.media?.embed_video ? `watch.html?id=${encodeURIComponent(match.id)}` : '';
    const watchButton = watchHref ? `
        <a href="${watchHref}" class="match-action--primary">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <span>${LanguageManager.t('watchMatch')}</span>
        </a>` : '';

    // Emissora (mesmo logo e mesmas classes do card) ao lado esquerdo das etiquetas
    const station = match.station || {};
    const stationLogo = station.logo ? `<img src="${station.logo}" alt="${Utils.escapeHtml(station.name || '')}" title="${Utils.escapeHtml(station.name || '')}" class="broadcaster-logo${noFilterLogos.includes(station.logo) ? ' no-filter' : ''}" onerror="this.style.display='none'">` : '';
    const tags = [match.technical_details?.video_quality, match.type, match.technical_details?.duration]
        .filter(t => !Utils.isBlank(t))
        .map(t => `<span class="match-tag">${LanguageManager.t(t)}</span>`).join('');

    document.getElementById('meHero').innerHTML = `
      <div class="match-stage${hasImages ? '' : ' match-stage--no-image'}" id="matchStage">
        <div id="image-carousel"></div>
        ${hasImages ? `<button type="button" class="match-stage-toggle" id="matchStageToggle" aria-pressed="false" aria-label="${LanguageManager.t('hideStageTextLabel')}">
            <svg class="icon-visible" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="icon-hidden" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
            <span id="matchStageToggleLabel">${LanguageManager.t('hideStageText')}</span>
        </button>` : ''}
        <div class="score-overlay">
            <div class="logo-title-header">
                ${compLogo ? `<img src="${compLogo}" class="comp-logo" onerror="this.style.display='none'" alt="">` : ''}
                <h2 id="modalTitle">
                    <div class="section-title modal-title-competition">${LanguageManager.t(match.competition?.name) || ''}</div>
                    ${phase ? `<div class="modal-title-phase">${phase}</div>` : ''}
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
                    <svg viewBox="0 0 12 15" fill="currentcolor" xmlns="http://www.w3.org/2000/svg" class="cf-icon-svg">
                        <path d="M11.882 3.187a.476.476 0 0 1 .475.475v11.063a.476.476 0 0 1-.475.475H1.118a.476.476 0 0 1-.475-.475V3.662a.476.476 0 0 1 .475-.475h1.328v.721a1.425 1.425 0 0 0 2.85 0v-.72H7.71v.72a1.425 1.425 0 0 0 2.85 0v-.72zm-.634 3.37H1.752v7.535h9.496zm-7.384.821H2.621V8.67h1.243zm0 2.292H2.621v1.292h1.243zm0 2.292H2.621v1.291h1.243zm.561-8.054V2.475a.554.554 0 1 0-1.108 0v1.433a.554.554 0 1 0 1.108 0zm1.613 3.47H4.794V8.67h1.244zm0 2.292H4.794v1.292h1.244zm0 2.292H4.794v1.291h1.244zm2.174-4.584H6.968V8.67h1.244zm0 2.292H6.968v1.292h1.244zm0 2.292H6.968v1.291h1.244zm1.477-8.054V2.475a.554.554 0 0 0-1.108 0v1.433a.554.554 0 0 0 1.108 0zm.696 3.47H9.142V8.67h1.243zm0 2.292H9.142v1.292h1.243zm0 2.292H9.142v1.291h1.243z"/>
                    </svg>
                    ${dateStr}</span>` : ''}
                ${match.venue?.name ? `<span>
                    <svg viewBox="0 0 964.199 964.2" fill="currentcolor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><g><path d="M833.1,241.359v-68.8l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.4v31.6v33.1 c-34.199-9-72.1-16.6-113-22.3v-65.3l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.3 v31.7v38.9c-36.1-3.6-73.9-5.7-113-6.4v-76.6l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5 v61.2v21v56.2c-39.4,0.7-77.6,2.9-114,6.5v-59.5l44.8-18.3c10.3-4.2,10.3-18.8,0-23l-77.7-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.3 v31.7v45c-40.9,5.8-78.8,13.3-113,22.4v-53.8l44.8-18.3c10.3-4.2,10.3-18.8,0-23l-77.7-31.8c-8.2-3.3-17.1,2.7-17.1,11.5v50.4v31.6 v48.7C49.4,270.159,0,308.359,0,350.459l0,0v413.8c0,87.899,215.8,159.199,482.1,159.199c266.3,0,482.099-71.3,482.099-159.199 v-413.8l0,0C964.199,308.259,914.4,269.859,833.1,241.359z M149.1,746.359c-32.5-9.8-61.2-21.1-85.2-33.6v-27.7v-28.9 c2.1,0.601,4.2,1.5,6.2,2.7c6.6,4.1,13.9,8.1,21.7,11.9c16.7,8.3,35.9,16,57.4,23.1v52.5H149.1z M149.1,587.159 c-32.5-9.8-61.2-21.1-85.2-33.6v-56.601c2.1,0.601,4.2,1.5,6.2,2.7c20.9,12.9,47.6,24.7,79.1,35v52.5H149.1z M814.1,535.159 c29.5-9.7,55.201-20.8,76-33c1.801-1.1,3.801-1.899,5.701-2.5v56.2c-23.4,11.7-50.9,22.3-81.801,31.6v-52.3H814.1z M226,606.359 c-9.2-1.9-18.2-3.8-26.9-5.8v-51.4c11.8,2.9,24.1,5.7,36.8,8.2c20.9,4.2,42.7,7.9,65.2,10.9v48.399v2c-2.5-0.3-4.9-0.7-7.4-1 C270.4,614.559,247.7,610.759,226,606.359z M351.1,611.059v-37c34.4,3.3,69.9,5.2,106,5.899v25.4v24.6c-36-0.6-71.5-2.5-106-5.699 V611.059z M507.1,605.359v-25.4c36-0.6,71.201-2.6,105-5.8v36.8v13.4c-34.199,3.1-69.4,5-105,5.6V605.359z M662.1,616.559v-48.101 c36.4-4.899,70.6-11.3,102-19v51.301c-9.799,2.3-19.799,4.399-30,6.399c-20.5,4-41.699,7.601-63.6,10.601 c-2.801,0.399-5.6,0.8-8.4,1.1V616.559z M814.1,694.359c21.701-7.1,41.301-15,58.4-23.5c6.199-3.1,12.1-6.3,17.699-9.5 c1.801-1.1,3.801-1.9,5.701-2.5v23.7v32.5c-23.4,11.7-50.9,22.3-81.801,31.6V694.359L814.1,694.359z M861.1,365.659 c-22.4,12.5-53.199,24.4-89.1,34.4c-80.199,22.3-183.199,34.5-289.9,34.5c-106.7,0-209.7-12.2-289.9-34.5 c-35.9-10-66.7-21.8-89.1-34.4c-11-6.1-18.1-11.4-22.6-15.3c4.5-3.9,11.6-9.1,22.6-15.3c22.4-12.5,53.2-24.4,89.1-34.4 c80.2-22.3,183.2-34.5,289.9-34.5c106.701,0,209.701,12.3,289.9,34.5c35.9,10,66.699,21.8,89.1,34.4c11,6.1,18.1,11.4,22.6,15.3 C879.1,354.359,872,359.56,861.1,365.659z M220,764.259c-7.1-1.5-14.1-3-20.9-4.601v-51.399c11.8,2.899,24.1,5.699,36.8,8.199 c20.9,4.2,42.7,7.9,65.2,10.9v36.8v13.601c-25.9-3.4-51.1-7.5-75.1-12.4C224,765.159,222,764.659,220,764.259z M351.1,764.259 v-31.101c34.4,3.3,69.9,5.2,106,5.9v25.2v24.8c-36-0.601-71.5-2.5-106-5.7V764.259z M507.1,764.259v-25.2 c36-0.601,71.201-2.601,105-5.8v31v19.199c-34.199,3.101-69.4,5-105,5.601V764.259z M734.1,766.359c-23.1,4.6-47.199,8.5-72,11.7 v-13.7v-36.7c36.4-4.899,70.6-11.3,102-19v51.3c-6.5,1.5-13.199,3-19.9,4.4C740.801,764.958,737.5,765.659,734.1,766.359z"/></g></svg>
                    ${match.venue?.name}
                    </span>` : ''}
                ${match.venue?.city ? `<span>
                    <svg viewBox="0 0 18 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage">
                            <g id="Icon-Set" sketch:type="MSLayerGroup" transform="translate(-104.000000, -411.000000)" fill="currentcolor">
                                <path d="M116,426 C114.343,426 113,424.657 113,423 C113,421.343 114.343,420 116,420 C117.657,420 119,421.343 119,423 C119,424.657 117.657,426 116,426 L116,426 Z M116,418 C113.239,418 111,420.238 111,423 C111,425.762 113.239,428 116,428 C118.761,428 121,425.762 121,423 C121,420.238 118.761,418 116,418 L116,418 Z M116,440 C114.337,440.009 106,427.181 106,423 C106,417.478 110.477,413 116,413 C121.523,413 126,417.478 126,423 C126,427.125 117.637,440.009 116,440 L116,440 Z M116,411 C109.373,411 104,416.373 104,423 C104,428.018 114.005,443.011 116,443 C117.964,443.011 128,427.95 128,423 C128,416.373 122.627,411 116,411 L116,411 Z" id="location" sketch:type="MSShapeGroup"></path>
                            </g>
                        </g>
                    </svg>
                    ${match.venue?.city + ', ' + match.venue?.region}
                </span>` : ''}
            </div>

            <div class="match-actions">
                ${(stationLogo || tags) ? `<div class="match-tags">${stationLogo}${tags}</div>` : ''}
                <div class="score-header-buttons match-buttons">${watchButton}</div>
            </div>
        </div>
      </div>
    `;

    bindStageToggle();
}

// ─── Ver a imagem sem textos nem degradê (a preferência fica salva neste navegador) ───
function bindStageToggle() {
    const stage  = document.getElementById('matchStage');
    const toggle = document.getElementById('matchStageToggle');
    const label  = document.getElementById('matchStageToggleLabel');
    if (!stage || !toggle) return;

    const apply = clean => {
        stage.classList.toggle('is-clean', clean);
        toggle.setAttribute('aria-pressed', String(clean));
        toggle.setAttribute('aria-label', LanguageManager.t(clean ? 'showStageTextLabel' : 'hideStageTextLabel'));
        label.textContent = LanguageManager.t(clean ? 'showStageText' : 'hideStageText');
    };

    let saved = false;
    try { saved = localStorage.getItem('matchStageClean') === '1'; } catch { /* storage indisponível */ }
    apply(saved);

    toggle.addEventListener('click', () => {
        const clean = !stage.classList.contains('is-clean');
        apply(clean);
        try { localStorage.setItem('matchStageClean', clean ? '1' : '0'); } catch { /* storage indisponível */ }
    });
}

// ─── Estado da página ─────────────────────────────
function hideLoading()  { document.getElementById('matchEnrichedLoading').style.display = 'none'; }
function showContent()  { document.getElementById('matchEnrichedContent').style.display = 'block'; }
function showError()    { hideLoading(); document.getElementById('matchEnrichedError').style.display = 'block'; }