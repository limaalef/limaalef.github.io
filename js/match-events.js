// ═══════════════════════════════════════════════════════════════
//  Página de evento (match.html) para carnaval e motorsport.
//  Usa a mesma capa (.match-stage) e os mesmos painéis do futebol.
//  Depende de match.js (fileInfo, storageHtml) e ui-components.js.
// ═══════════════════════════════════════════════════════════════

async function loadEventItem(id, sport) {
    CONFIG.currentSport = sport;
    const response = await APIService.fetchById(id, sport);
    const items = APIService.transformData(response, sport);
    if (!items.length) throw new Error('not found');
    return items[0];
}

// ─── Campos do carnaval ──────────────────────────────────────────
// Formato ATUAL: date, embed_video, championship{division,city,venue}, samba_school{...}, station{}.
// O backend vai migrar para um formato parecido com o das partidas; cada campo lê o novo primeiro e
// cai no atual (mesmas suposições do adaptador de carnaval em managers.js).
function carnavalFields(item) {
    const school  = item.samba_school || item.school || {};
    const champ   = item.championship || {};
    const comp    = item.competition || {};
    const sources = Array.isArray(item.sources) ? item.sources : null;
    const station = item.station || sources?.[0]?.station || {};
    return {
        school,
        station,
        result:   school.result || {},
        date:     item.utcDate ?? item.date,
        city:     LanguageManager.translateText(comp.city ?? champ.city),
        division: LanguageManager.translateText(comp.phase ?? champ.division),
        venue:    comp.venue ?? champ.venue,
        hasVideo: !!(item.has_embed_video ?? item.embed_video),
        origin:   station.origem ?? station.source_type,
        narration: station.narracao ?? station.commentary
    };
}

function eventPeriod(item) {
    const dates = [item.start_date, item.end_date]
        .map(d => Utils.formatMatchDate(d))
        .filter(d => !Utils.isBlank(d));
    return dates.filter((d, i) => dates.indexOf(d) === i).join(' – ');
}

function eventTitle(item, sport) {
    if (sport === 'carnaval') {
        const f = carnavalFields(item);
        return [LanguageManager.t(f.school.name), f.city].filter(Boolean).join(' — ');
    }
    return [LanguageManager.translateText(item.competition?.name), LanguageManager.translateText(item.competition?.phase)]
        .filter(Boolean).join(' — ');
}

// ─── Linhas rótulo → valor ───────────────────────────────────────
function eventRows(list) {
    return list
        .filter(r => !Utils.isBlank(r.value))
        .map(r => keyValueRow(Utils.escapeHtml(r.label), Utils.escapeHtml(r.value)))
        .join('');
}

function eventSection(title, html, extra = '') {
    if (!html && !extra) return '';
    return `<section class="event-section"><h3 class="block-title">${Utils.escapeHtml(title)}</h3>${html || ''}${extra}</section>`;
}

function eventNotes(text) {
    return Utils.isBlank(text) ? '' : `<p class="event-notes">${Utils.escapeHtml(text)}</p>`;
}

// ─── Capa ────────────────────────────────────────────────────────
function eventHero(item, sport) {
    const t = key => LanguageManager.t(key);
    const esc = value => Utils.escapeHtml(value);
    const isCarnaval = sport === 'carnaval';
    const f = isCarnaval ? carnavalFields(item) : null;

    const images = item.media?.image ?? item.image;
    const hasImages = isCarnaval && (Array.isArray(images) ? images.length > 0 : !Utils.isBlank(images));

    const title  = isCarnaval ? f.city : LanguageManager.translateText(item.competition?.name);
    const phase  = isCarnaval ? f.division : LanguageManager.translateText(item.competition?.phase);
    const dateText = isCarnaval ? Utils.formatMatchDate(f.date) : eventPeriod(item);
    const place  = isCarnaval ? f.venue : '';

    const station = isCarnaval ? f.station : {};
    const tech = item.technical_details || {};
    const tags = [tech.video_quality, item.type, tech.duration].filter(v => !Utils.isBlank(v))
        .map(v => `<span class="match-tag">${esc(t(v))}</span>`).join('');
    const stationLogo = station.logo
        ? `<img src="${station.logo}" alt="${esc(station.name || '')}" title="${esc(station.name || '')}" class="broadcaster-logo${noFilterLogos.includes(station.logo) ? ' no-filter' : ''}" onerror="this.style.display='none'">`
        : '';

    const watch = isCarnaval && f.hasVideo ? `
        <a href="watch.html?id=${encodeURIComponent(item.id)}" class="match-action--primary">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <span>${t('watchMatch')}</span>
        </a>` : '';

    // Carnaval: escola em destaque (logo, nome e enredo). Motorsport: o próprio título é o destaque.
    const headline = isCarnaval ? `
        <div class="event-headline">
            ${f.school.logo ? `<img src="${f.school.logo}" class="event-headline-logo" alt="" onerror="this.style.display='none'">` : ''}
            <div class="event-headline-text">
                <span class="event-headline-name">${esc(t(f.school.name) || '—')}</span>
                ${f.school.plot ? `<span class="event-headline-plot">${esc(f.school.plot)}</span>` : ''}
            </div>
        </div>` : '';

    document.getElementById('meHero').innerHTML = `
      <div class="match-stage${hasImages ? '' : ' match-stage--no-image'}" id="matchStage">
        <div id="image-carousel"></div>
        ${hasImages ? `<button type="button" class="match-stage-toggle" id="matchStageToggle" aria-pressed="false" aria-label="${t('hideStageTextLabel')}">
            <svg class="icon-visible" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg class="icon-hidden" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
            <span id="matchStageToggleLabel">${t('hideStageText')}</span>
        </button>` : ''}
        <div class="score-overlay">
            <div class="logo-title-header">
                <h2 id="modalTitle">
                    <div class="section-title modal-title-competition">${esc(title || '')}</div>
                    ${phase ? `<div class="modal-title-phase">${esc(phase)}</div>` : ''}
                </h2>
            </div>
            ${headline}
            <div class="score-date-row">
                ${dateText ? `<span>${esc(dateText)}</span>` : ''}
                ${place ? `<span>${esc(place)}</span>` : ''}
            </div>
            <div class="match-actions">
                ${(stationLogo || tags) ? `<div class="match-tags">${stationLogo}${tags}</div>` : ''}
                <div class="score-header-buttons match-buttons">${watch}</div>
            </div>
        </div>
      </div>`;

    if (hasImages) Elements.renderImages(item, 'matches_image/');
    bindStageToggle();
}

// ─── Corpo: carnaval ─────────────────────────────────────────────
function judgmentRows(categories) {
    return categories.map(category => {
        const discarded = Array.isArray(category.discarded_indexes) ? category.discarded_indexes : [category.discarded_indexes];
        const scores = (category.scores || []).map((score, index) =>
            `<span class="judgment-score${discarded.includes(index) ? ' is-discarded' : ''}">${score === 10 ? score.toFixed(1) : score}</span>`).join('');
        const total = (category.scores || []).filter((_, i) => !discarded.includes(i)).reduce((sum, s) => sum + s, 0).toFixed(1);
        return `<div class="judgment-row">
            <span class="judgment-name">${Utils.escapeHtml(category.name)}</span>
            <span class="judgment-scores">${scores}</span>
            <span class="judgment-total">${total}</span>
        </div>`;
    }).join('');
}

function carnavalBody(item) {
    const t = key => LanguageManager.t(key);
    const f = carnavalFields(item);

    const finalPosition = f.result.final_position
        ? `${LanguageManager.translateOrdinary(f.result.final_position, 'fem')} ${t('place')}` : '';
    const finalScore = f.result.total ? `${f.result.total} ${t('points')}` : '';
    const judgments = judgmentRows(f.result.category || []);

    // Apuração: classificação e notas por quesito. Sem resultado, a seção não aparece.
    const result = eventSection(t('competitionInfo'),
        eventRows([{ label: t('finalPos'), value: finalPosition }, { label: t('finalScore'), value: finalScore }])
        + (judgments ? `<div class="judgment-list">${judgments}</div>` : ''));

    const parade = eventSection(t('carnavalInfo'), eventRows([
        { label: t('date'),         value: Utils.formatMatchDate(f.date) },
        { label: t('city'),         value: f.city },
        { label: t('division'),     value: f.division },
        { label: t('plot'),         value: f.school.plot },
        { label: t('carnavalesco'), value: f.school.carnavalesco },
        { label: t('interpreter'),  value: f.school.interpreter },
        { label: t('venue'),        value: f.venue },
        { label: t('type'),         value: item.type ? LanguageManager.translateText(item.type) : '' }
    ]));

    const tv = eventSection(t('tvInfo'), eventRows([
        { label: t('broadcaster'), value: f.station.name },
        { label: t('narration'),   value: f.narration },
        { label: t('origin'),      value: f.origin ? LanguageManager.translateText(f.origin) : '' }
    ]));

    const { rows, places } = fileInfo(item);
    const file = eventSection(t('fileInfo'), rows, places.length ? `<div class="match-aside-method">${storageHtml(places)}</div>` : '');

    return {
        main: result + parade + eventNotes(item.additional_info),
        side: [tv, file].filter(Boolean).join('')
    };
}

// ─── Corpo: motorsport (um painel por evento da etapa) ───────────
// Conteúdo escolhido no menu (-1 = nenhum). Guardado por etapa para sobreviver à troca de idioma.
const motorState = { itemId: null, selected: -1, events: [] };

// Detalhe de um conteúdo (evento da etapa): mesmos blocos do futebol/carnaval
function motorEventDetail(evt, index) {
    const t = key => LanguageManager.t(key);
    const station = evt.station || {};
    const carousels = [];

    let imageHtml = '';
    if (evt.media?.image) {
        const carouselId = `carousel-motor-${index}`;
        const images = Array.isArray(evt.media.image)
            ? evt.media.image.map(img => CONFIG.IMAGE_CONTENT_URL + img)
            : CONFIG.IMAGE_CONTENT_URL + evt.media.image;
        if (Array.isArray(images) && images.length > 1) carousels.push({ id: carouselId, images });
        imageHtml = `<div class="event-panel-image">${ImageCarousel.renderHTML(images, carouselId)}</div>`;
    }

    const title = LanguageManager.translateText(evt.event_type) || t('evento');
    const date = Utils.formatMatchDate(evt.utcDate);

    const broadcast = eventSection(t('tvInfo'), eventRows([
        { label: t('broadcaster'), value: station.name },
        { label: t('narration'),   value: station.commentary },
        { label: t('origin'),      value: station.source_type ? LanguageManager.translateText(station.source_type) : '' },
        { label: t('type'),        value: evt.type ? LanguageManager.translateText(evt.type) : '' }
    ]));
    const { rows, places } = fileInfo(evt);
    const file = eventSection(t('fileInfo'), rows, places.length ? `<div class="match-aside-method">${storageHtml(places)}</div>` : '');

    return {
        html: `<article class="event-detail" aria-live="polite">
            <header class="event-detail-head">
                <h3 class="event-detail-title">${Utils.escapeHtml(title)}</h3>
                ${date ? `<span class="event-detail-date">${Utils.escapeHtml(date)}</span>` : ''}
            </header>
            ${imageHtml}${broadcast}${file}${eventNotes(evt.additional_info)}
        </article>`,
        carousels
    };
}

// Motorsport: menu lateral com os conteúdos da etapa; o detalhe só carrega ao escolher um
function motorBody(item) {
    const t = key => LanguageManager.t(key);
    const events = item.events || [];
    if (motorState.itemId !== item.id) { motorState.itemId = item.id; motorState.selected = -1; }
    motorState.events = events;

    const menu = events.map((evt, index) => {
        const title = LanguageManager.translateText(evt.event_type) || t('evento');
        const date = Utils.formatMatchDate(evt.utcDate);
        const on = index === motorState.selected;
        return `<li><button type="button" class="event-menu-item${on ? ' active' : ''}" data-event="${index}" aria-pressed="${on}">
            <span class="event-menu-title">${Utils.escapeHtml(title)}</span>
            <span class="event-menu-date">${Utils.escapeHtml(date)}</span>
        </button></li>`;
    }).join('');

    const side = `<nav class="event-menu" aria-label="${Utils.escapeHtml(t('eventContents'))}">
        <h3 class="block-title">${Utils.escapeHtml(t('eventContents'))}<span class="counter">${events.length}</span></h3>
        <ul class="event-menu-list">${menu}</ul>
    </nav>`;

    const chosen = events[motorState.selected];
    const detail = chosen ? motorEventDetail(chosen, motorState.selected) : null;
    const main = `<div id="eventDetailHost">${detail ? detail.html : `<div class="event-empty"><p>${Utils.escapeHtml(t('eventSelectPrompt'))}</p></div>`}</div>${eventNotes(item.additional_info)}`;

    return { main, side, carousels: detail ? detail.carousels : [] };
}

// Escolha de um conteúdo no menu (delegação no #meEventBody)
function bindMotorMenu() {
    const host = document.getElementById('meEventBody');
    if (host.dataset.motorBound) return;
    host.dataset.motorBound = '1';
    host.addEventListener('click', e => {
        const btn = e.target.closest('.event-menu-item');
        if (!btn) return;
        const index = Number(btn.dataset.event);
        const evt = motorState.events[index];
        if (!evt) return;
        motorState.selected = index;
        host.querySelectorAll('.event-menu-item').forEach(b => {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        const detail = motorEventDetail(evt, index);
        const target = document.getElementById('eventDetailHost');
        target.innerHTML = detail.html;
        detail.carousels.forEach(c => ImageCarousel.init(c.id, c.images));
        if (window.matchMedia('(max-width: 900px)').matches) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// ─── Entrada ─────────────────────────────────────────────────────
function renderEventPage(item, sport) {
    eventHero(item, sport);
    const body = sport === 'carnaval' ? carnavalBody(item) : motorBody(item);
    const host = document.getElementById('meEventBody');
    host.classList.toggle('me-body--single', !body.side);
    host.classList.toggle('me-body--menu', sport === 'motor');
    host.innerHTML = `
        <div class="match-column match-column--main">${body.main}</div>
        ${body.side ? `<aside class="match-column match-column--side"><div class="match-aside"><div class="match-aside-inner">${body.side}</div></div></aside>` : ''}`;
    (body.carousels || []).forEach(c => ImageCarousel.init(c.id, c.images));
    if (sport === 'motor') bindMotorMenu();
}
