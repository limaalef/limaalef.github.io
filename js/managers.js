const AppState = {
    matches: [],
    filteredMatches: [],
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: CONFIG.DEFAULT_ITEMS_PER_PAGE
};

const noFilterLogos = [
    "channel_logos/sbt.svg",
    "channel_logos/record.svg",,
    "channel_logos/band.svg",
    "channel_logos/fox_sports.svg",
    "channel_logos/band_sports.svg"
];

const PaginationManager = {
    update(apiResponse) {
        if (apiResponse.pagination) {
            AppState.currentPage = apiResponse.pagination.current_page;
            AppState.totalPages = apiResponse.pagination.total_pages;
            AppState.itemsPerPage = apiResponse.pagination.items_per_page;
        } else {
            AppState.totalPages = apiResponse.total_pages || 1;
        }
        LanguageManager.updatePageInfo();
        document.getElementById('firstPage').disabled = AppState.currentPage === 1;
        document.getElementById('prevPage').disabled = AppState.currentPage === 1;
        document.getElementById('nextPage').disabled = AppState.currentPage === AppState.totalPages;
        document.getElementById('lastPage').disabled = AppState.currentPage === AppState.totalPages;

        document.getElementById('pageNumber').textContent = AppState.currentPage;
        document.getElementById('pageTotal').textContent = AppState.totalPages;
    },
    goToFirst() { if (AppState.currentPage > 1) { AppState.currentPage = 1; App.loadData(); } },
    goToPrevious() { if (AppState.currentPage > 1) { AppState.currentPage--; App.loadData(); } },
    goToNext() { if (AppState.currentPage < AppState.totalPages) { AppState.currentPage++; App.loadData(); } },
    goToLast() { if (AppState.currentPage < AppState.totalPages) { AppState.currentPage = AppState.totalPages; App.loadData(); } }
};

// ══════════════════════════════════════════════════════════════════
//  CARD ÚNICO
//  Um só template (CardManager.create) para todos os tipos de conteúdo.
//  Cada esporte tem um ADAPTADOR que converte o item da API num
//  view-model comum; o template só conhece o view-model.
//
//  View-model:
//    { id, sport, status, hasVideo, statusBadge,
//      header: { logo, logoAlt, title, subtitle },
//      dateText,
//      body:   { type: 'teams' | 'event' | 'show', ... },
//      footer: { cls, sourcesCount, stationLogo, stationName, badges[] },
//      sources, onClick }
//
//  Para criar um novo tipo de conteúdo: adicionar um adaptador em
//  CardAdapters e (se o corpo for diferente) um renderer em CardBodies.
// ══════════════════════════════════════════════════════════════════
const CardAdapters = {
    // Clique padrão: várias fontes → escolher emissora; senão abre o detalhe direto.
    _defaultClick(item, sport, sources) {
        return () => {
            if (sources && sources.length > 1) {
                SourcePicker.open(item);
            } else {
                const id = (sources && sources.length === 1 && sources[0].id != null) ? sources[0].id : item.id;
                MatchModal.fetchAndShow(id, sport);
            }
        };
    },

    // Football e Multisport compartilham o mesmo formato (times, placar, fontes).
    match(item, sport) {
        const sources = Array.isArray(item.sources) ? item.sources : null;
        const tech = item.technical_details || {};
        const station = item.station || sources?.[0]?.station || {};
        return {
            id: item.id,
            sport,
            status: Utils.getMatchStatus(item),
            hasVideo: !!item.has_embed_video,
            header: {
                logo: Utils.competitionLogoUrl(item.competition?.name, item.utcDate),
                logoAlt: item.competition?.name,
                title: LanguageManager.translateText(item.competition?.name) || 'N/A',
                subtitle: LanguageManager.translateText(item.competition?.phase) || ''
            },
            dateText: Utils.formatMatchDate(item.utcDate),
            body: {
                type: 'teams',
                home: item.home_team,
                away: item.away_team,
                // listagem traz home_team.goals; o detalhe (coleção) traz score.fullTime
                goals: { home: item.home_team?.goals, away: item.away_team?.goals },
                fullTime: { home: item.score?.fullTime?.home, away: item.score?.fullTime?.away },
                dateInline: Utils.formatMatchDate(item.utcDate)
            },
            footer: {
                cls: 'match-footer',
                // Várias fontes: o logo da emissora sai e entra o contador (mesmo contador do motorsport)
                count: (sources && sources.length > 1)
                    ? { value: sources.length, label: LanguageManager.t('sourcesCount') } : null,
                stationLogo: (sources && sources.length > 1) ? '' : station.logo,
                stationName: station.name,
                badges: [tech.video_quality, LanguageManager.translateText(tech.audio_format) ?? '']
                    .filter((b, i) => i === 1 || b)
            },
            sourcesList: sources,
            onClick: this._defaultClick(item, sport, sources)
        };
    },

    // Motorsport: item = etapa que agrupa vários eventos.
    motor(item, sport) {
        const events = Array.isArray(item.events) ? item.events : [];
        const n = events.length;
        const label = LanguageManager.currentLang === 'en'
            ? (n === 1 ? 'event' : 'events')
            : (n === 1 ? 'evento' : 'eventos');
        return {
            id: item.id,
            sport,
            status: '',
            hasVideo: !!item.media?.video_embed,
            header: {
                logo: Utils.competitionLogoUrl(item.competition?.name, item.start_date),
                logoAlt: item.competition?.phase,
                title: LanguageManager.translateText(item.competition?.name) || 'N/A',
                subtitle: ''
            },
            dateText: Utils.formatMotorDateRange(item.start_date, item.end_date),
            body: {
                type: 'event',
                flag: item.competition?.country_name ? item.competition?.country_flag : '',
                flagAlt: item.competition?.country_name,
                title: LanguageManager.translateText(item.competition?.phase) || 'N/A'
            },
            footer: {
                cls: 'motor-footer',
                stationLogo: item.main_station_logo,
                stationName: 'Emissora',
                count: { value: n, label },
            },
            onClick: () => MatchModal.fetchAndShow(item.id, sport)
        };
    },

    // Carnaval: sem agrupamento. Formato ATUAL: date, embed_video, championship{division,city},
    // samba_school{name,logo,plot}, station{}. O backend vai migrar para um formato parecido
    // com o dos outros esportes (utcDate, has_embed_video, competition{...}, sources[]);
    // por isso cada campo lê o formato novo primeiro e cai no atual (fallbacks abaixo).
    // ⚠ Nomes do formato novo são SUPOSIÇÃO — ajustar aqui quando o backend definir.
    carnaval(item, sport) {
        const school = item.samba_school || item.school || {};
        const champ = item.championship || {};
        const comp = item.competition || {};
        const sources = Array.isArray(item.sources) ? item.sources : null;
        const station = item.station || sources?.[0]?.station || {};
        const tech = item.technical_details || {};
        const dateStr = item.utcDate ?? item.date;
        const city = comp.city ?? champ.city;
        const citySlug = city ? Utils.slug(city) : '';
        return {
            id: item.id,
            sport,
            status: Utils.getEventStatus(dateStr),
            hasVideo: !!(item.has_embed_video ?? item.embed_video),
            header: {
                logo: citySlug ? `city_flag/${citySlug}.svg` : '',
                logoAlt: city,
                title: LanguageManager.translateText(city) || 'N/A',
                subtitle: LanguageManager.translateText(comp.phase ?? champ.division) || ''
            },
            dateText: Utils.formatMatchDate(dateStr),
            body: {
                type: 'show',
                logo: school.logo ? school.logo.replace('.svg', '.png').replace(/[̀-ͯ]/g, '') : '',
                name: school.name || 'N/A',
                plot: school.plot || 'N/A'
            },
            footer: {
                cls: 'match-footer',
                stationLogo: station.logo,
                stationName: station.name,
                badges: [tech.video_quality, LanguageManager.translateText(tech.audio_format || '2.0')]
                    .filter((b, i) => i === 1 || b)
            },
            onClick: () => MatchModal.fetchAndShow(item.id, sport)
        };
    }
};

// Corpo do card por tipo de conteúdo
const CardBodies = {
    teams(vm, opts) {
        const b = vm.body;
        const { homeGoals, homeWinner, homeLoser, awayGoals, awayWinner, awayLoser } =
            Utils.parseWinner(b.goals.home, b.goals.away);
        const team = (t, goals, win, lose, fallback) => {
            const name = LanguageManager.t(t?.name);
            return `
                <div class="team">
                    ${t?.logo ? `<img src="${t.logo}" alt="${Utils.escapeHtml(name || '')}" class="team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="team-name ${win ? 'winner' : ''} ${lose ? 'loser' : ''}">${name || fallback}</span>
                    <span class="score ${win ? 'winner' : ''} ${lose ? 'loser' : ''}">${goals}</span>
                </div>`;
        };

        let center = '';
        if (opts.layout === 'detail') {
            // Placar central entre os times (usa score.fullTime)
            const ft = Utils.parseWinner(b.fullTime.home, b.fullTime.away);
            center = `
                <div class="match-score-center">
                    <span class="score-val ${ft.homeWinner ? 'winner' : ft.awayWinner ? 'loser' : ''}">${ft.homeGoals !== '' ? ft.homeGoals : '-'}</span>
                    <span class="score-sep">x</span>
                    <span class="score-val ${ft.awayWinner ? 'winner' : ft.homeWinner ? 'loser' : ''}">${ft.awayGoals !== '' ? ft.awayGoals : '-'}</span>
                </div>`;
        }
        return `
            <div class="match-teams">
                ${team(b.home, homeGoals, homeWinner, homeLoser, 'Time 1')}
                ${center}
                ${team(b.away, awayGoals, awayWinner, awayLoser, 'Time 2')}
            </div>`;
    },

    event(vm) {
        const b = vm.body;
        return `
            <div class="motor-phase-section">
                ${b.flag ? `<img src="${b.flag}" alt="${Utils.escapeHtml(b.flagAlt || '')}" class="country-flag" onerror="this.style.display='none'">` : ''}
                <div class="motor-phase-name entity-title">${b.title}</div>
            </div>`;
    },

    show(vm) {
        const b = vm.body;
        return `
            <div class="carnaval-data-section">
                <div class="carnaval-school-section">
                    ${b.logo ? `<img src="${b.logo}" alt="${Utils.escapeHtml(b.name)}" class="country-flag" onerror="this.style.display='none'">` : ''}
                    <div class="carnaval-school-name entity-title">${b.name}</div>
                </div>
                <div class="carnaval-plot-name">${b.plot}</div>
            </div>`;
    }
};

const CardManager = {
    // Opções globais. layout 'detail' (página de coleção) move a data para a linha da fase
    // e mostra o placar central nos cards de partida; os demais tipos não mudam.
    options: { layout: 'default' },

    _adapterFor(sport) {
        return (sport === 'motor' || sport === 'carnaval') ? CardAdapters[sport] : CardAdapters.match;
    },

    create(item, opts = {}) {
        const o = { ...this.options, ...opts };
        const sport = Utils.getItemSport(item);
        const vm = this._adapterFor(sport).call(CardAdapters, item, sport);
        const detail = o.layout === 'detail' && vm.body.type === 'teams';

        const card = document.createElement('div');
        card.dataset.matchId = vm.id;
        if (vm.sourcesList && vm.sourcesList.length > 1) {
            // Item agrupado: sem botão de pedido no card (o usuário escolhe a fonte antes)
            card.dataset.groupId = vm.id;
            card.dataset.sourceCount = String(vm.sourcesList.length);
        }
        card.className = ['match-card', vm.sport === 'motor' ? 'motor-event' : '', vm.status, vm.hasVideo ? 'has-video' : '']
            .filter(Boolean).join(' ');
        card.onclick = vm.onClick;

        const statusBadge = vm.status === 'pending'
            ? `<span class="match-status">${LanguageManager.t('pendingMatch')}</span>` : '';

        const h = vm.header;
        const logo = h.logo
            ? `<img src="${h.logo}" alt="${Utils.escapeHtml(h.logoAlt || '')}" class="competition-logo" onerror="this.style.display='none'">` : '';
        const info = detail
            ? `<div class="match-competition">${h.title}</div>
               <div class="match-phase-date-row">
                   <span class="match-phase">${h.subtitle}</span>
                   <span class="match-date-inline">${vm.body.dateInline}</span>
               </div>`
            : `<div class="match-competition">${h.title}</div>
               ${vm.body.type === 'event' ? '' : `<div class="match-phase">${h.subtitle}</div>`}`;

        card.innerHTML = `
            ${statusBadge}
            <div class="match-header">
                ${logo}
                <div class="competition-info">
                    ${info}
                </div>
            </div>
            <div class="match-date">${vm.dateText}</div>
            ${CardBodies[vm.body.type](vm, { layout: detail ? 'detail' : 'default' })}
            ${this._footer(vm)}
        `;
        return card;
    },

    // Rodapé único: emissora à esquerda; à direita o contador (fontes / eventos)
    // ou, sem contador, os selos técnicos.
    _footer(vm) {
        const f = vm.footer;
        const logo = f.stationLogo
            ? `<img src="${f.stationLogo}" alt="${Utils.escapeHtml(f.stationName || '')}" class="broadcaster-logo${noFilterLogos.includes(f.stationLogo) ? ' no-filter' : ''}" onerror="this.style.display='none'">`
            : '<div></div>';
        const right = f.count
            ? `<div class="sources-count-badge" title="${f.count.value} ${Utils.escapeHtml(f.count.label || '')}">
                   <span class="sources-count-value">${f.count.value}</span>
                   <span class="sources-count-label">${f.count.label || ''}</span>
               </div>`
            : `<div class="tech-badges row-wrap">${(f.badges || []).map(b => `<span class="tech-badge">${b}</span>`).join('')}</div>`;
        return `<div class="${f.cls}">${logo}${right}</div>`;
    }
};

// Seletor de emissoras: modal PRÓPRIO (#source-modal), separado do #modal da partida.
// Ao escolher uma emissora, o modal da partida abre por cima e este continua aberto por trás
// (o mesmo esquema usado no admin: pedido atrás, jogo na frente).
const SourcePicker = {
    _ensureModal() {
        let modal = document.getElementById('source-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'modal modal-broadcasters';
        modal.id = 'source-modal';
        modal.innerHTML = `
            <div class="modal-content modal-down-effect">
                <div class="modal-header modal-down">
                    <button type="button" class="btn close-btn" aria-label="Fechar" onclick="SourcePicker.close()">×</button>
                    <h2 class="modal-title" id="sourceModalTitle"></h2>
                </div>
                <div class="modal-body" id="sourceModalBody"></div>
            </div>`;
        // Clique no fundo fecha este modal (o #modal, quando aberto, está por cima e trata o próprio clique)
        modal.addEventListener('click', e => { if (e.target === modal) SourcePicker.close(); });
        document.body.appendChild(modal);
        return modal;
    },

    isOpen() {
        return !!document.getElementById('source-modal')?.classList.contains('active');
    },

    open(match) {
        const modal = this._ensureModal();
        const title = document.getElementById('sourceModalTitle');
        const body  = document.getElementById('sourceModalBody');
        const sport = Utils.getItemSport(match);
        const sources = Array.isArray(match.sources) ? match.sources : [];

        // Título + a partida a que as fontes se referem
        const esc = v => Utils.escapeHtml(String(v ?? ''));
        const matchup = (match.home_team && match.away_team)
            ? `${LanguageManager.t(match.home_team.name)} x ${LanguageManager.t(match.away_team.name)}`
            : LanguageManager.translateText(match.competition?.name || '');
        title.innerHTML = `
            <div class="section-title modal-title-competition">${esc(LanguageManager.t('chooseSource'))}</div>
            <div class="modal-title-phase">${esc(matchup)}</div>`;

        body.innerHTML = `
            <div class="source-picker-section">
                <p class="source-picker-hint">${esc(LanguageManager.t('chooseSourceHint'))}</p>
                <ul class="source-picker-list" id="sourcePickerList">
                    ${sources.map(src => {
                        const name = src.station?.name || `#${src.id}`;
                        const meta = [src.video_quality, src.audio_format, src.station?.commentary].filter(v => !Utils.isBlank(v)).map(esc).join(' · ');
                        return `<li><button type="button" class="source-picker-item" data-source-id="${esc(src.id)}">
                            <span class="source-picker-logo">${src.station?.logo
                                ? `<img src="${esc(src.station.logo)}" alt="" class="broadcaster-logo no-filter" onerror="this.style.display='none'">`
                                : `<span class="source-picker-initials" aria-hidden="true">${esc(name.slice(0, 2).toUpperCase())}</span>`}</span>
                            <span class="source-picker-text">
                                <span class="source-picker-name">${esc(name)}</span>
                                ${meta ? `<span class="source-picker-meta">${meta}</span>` : ''}
                            </span>
                            <svg class="source-picker-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                        </button></li>`;
                    }).join('')}
                </ul>
            </div>
        `;

        body.querySelectorAll('.source-picker-item').forEach(btn => {
            btn.addEventListener('click', () => MatchModal.fetchAndShow(btn.dataset.sourceId, sport));
        });

        document.body.style.overflow = 'hidden';
        modal.classList.add('active');
    },

    close() {
        document.getElementById('source-modal')?.classList.remove('active');
        // O scroll da página só volta se o modal da partida também estiver fechado
        if (!document.getElementById('modal')?.classList.contains('active')) document.body.style.overflow = '';
    }
};

// ══════════════════════════════════════════════════════════════════
//  MODAL ÚNICO
//  Um só modal (MatchModal.show) para todos os tipos de conteúdo, na mesma
//  linha dos cards: cada categoria tem um ADAPTADOR que converte o item da
//  API num view-model comum; o modal só conhece o view-model.
//
//  View-model:
//    { sport, variant, title: { competition, phase },
//      header: { type: 'teams' | 'show' | 'period', ... },
//      body:   { type: 'sections', imageItem, sections[], notes }
//            | { type: 'accordion', events[] } }
//    section = { title, html, boxClass? }
//
//  Novo tipo de conteúdo: adicionar um adaptador em ModalAdapters (e um
//  cabeçalho/corpo em ModalHeaders/ModalBodies, se for diferente).
//  O modal usa os mesmos IDs (#modalTitle, #modalScore, #modalBody) em
//  index/collection (modal) e match.html (página).
// ══════════════════════════════════════════════════════════════════
const ModalAdapters = {
    // Football e Multisport
    match(item, sport) {
        const status = Utils.getMatchStatus(item);
        const tvInfo = Elements.renderTvInfo(item, false, false);
        const rowsMatchInfo = [
            { label: 'date', value: Utils.formatDateTime(item.utcDate), svg: '<svg viewBox="0 0 12 15" fill="currentcolor" xmlns="http://www.w3.org/2000/svg" class="cf-icon-svg"><path d="M11.882 3.187a.476.476 0 0 1 .475.475v11.063a.476.476 0 0 1-.475.475H1.118a.476.476 0 0 1-.475-.475V3.662a.476.476 0 0 1 .475-.475h1.328v.721a1.425 1.425 0 0 0 2.85 0v-.72H7.71v.72a1.425 1.425 0 0 0 2.85 0v-.72zm-.634 3.37H1.752v7.535h9.496zm-7.384.821H2.621V8.67h1.243zm0 2.292H2.621v1.292h1.243zm0 2.292H2.621v1.291h1.243zm.561-8.054V2.475a.554.554 0 1 0-1.108 0v1.433a.554.554 0 1 0 1.108 0zm1.613 3.47H4.794V8.67h1.244zm0 2.292H4.794v1.292h1.244zm0 2.292H4.794v1.291h1.244zm2.174-4.584H6.968V8.67h1.244zm0 2.292H6.968v1.292h1.244zm0 2.292H6.968v1.291h1.244zm1.477-8.054V2.475a.554.554 0 0 0-1.108 0v1.433a.554.554 0 0 0 1.108 0zm.696 3.47H9.142V8.67h1.243zm0 2.292H9.142v1.292h1.243zm0 2.292H9.142v1.291h1.243z"/></svg>' },
            { label: 'city', value: item.venue?.city, svg: `<svg fill="currentColor"version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="00 0 315 315" xml:space="preserve"><g>
<path d="M290.012,95.991c-3.629,7.01-7.824,14.115-12.246,21.031l-1.756,2.72c-3.723,5.708-7.569,11.257-11.343,16.485 c14.51,8.949,22.596,19.327,22.596,29.444c0,12.723-12.775,25.861-35.051,36.046c-7.314,3.344-15.367,6.236-23.97,8.676 c1.678-11.29,2.717-23.054,3.084-35.087c-0.849,0.231-1.727,0.365-2.625,0.365c-2.895,0-5.648-1.255-7.547-3.44 c-1.376-1.583-4.934-5.721-9.724-11.623c0.028,1.684,0.054,3.369,0.054,5.063c0,17.288-1.48,34.029-4.283,49.556 c-15.526,2.802-32.267,4.283-49.554,4.283c-17.29,0-34.032-1.48-49.561-4.283c-2.802-15.527-4.282-32.268-4.282-49.556 s1.48-34.029,4.282-49.556c15.528-2.802,32.271-4.283,49.561-4.283c6.46,0,12.843,0.207,19.115,0.612 c-4.195-6.804-8.103-13.727-11.412-20.507c-2.558-0.063-5.123-0.105-7.703-0.105c-15.396,0-30.438,1.12-44.727,3.243 c2.439-8.604,5.332-16.657,8.676-23.971c10.185-22.274,23.323-35.05,36.046-35.051c0.001,0,0.002,0,0.003,0 c0.245,0,0.491,0.014,0.737,0.023c2.158-7.064,5.347-13.683,9.401-19.672c-3.351-0.225-6.729-0.351-10.137-0.351 c-0.001,0-0.001,0-0.002,0h-0.001c-0.001,0-0.002,0-0.003,0C75.143,16.056,8.026,83.173,8.026,165.671 c0,82.498,67.116,149.615,149.615,149.618c0.001,0,0.002,0,0.003,0h0.001c0.001,0,0.001,0,0.002,0 c82.498,0,149.615-67.118,149.615-149.618C307.263,140.525,301.017,116.813,290.012,95.991z M114.175,43.561 c-3.869,5.612-7.476,12.028-10.768,19.227C98.425,73.686,94.34,85.98,91.2,99.229c-13.247,3.14-25.541,7.224-36.439,12.206 c-7.199,3.292-13.617,6.899-19.229,10.769C48.586,85.644,77.615,56.615,114.175,43.561z M63.078,129.624 c7.314-3.344,15.366-6.235,23.969-8.675c-2.123,14.287-3.242,29.327-3.242,44.722c0,15.395,1.119,30.434,3.242,44.721 c-8.603-2.439-16.655-5.331-23.968-8.675c-22.276-10.186-35.052-23.324-35.052-36.046 C28.026,152.948,40.802,139.809,63.078,129.624z M35.532,209.137c5.612,3.869,12.03,7.477,19.229,10.769 c10.897,4.982,23.191,9.067,36.439,12.207c3.14,13.248,7.225,25.543,12.207,36.441c3.292,7.199,6.899,13.615,10.768,19.227 C77.615,274.727,48.585,245.697,35.532,209.137z M157.645,295.289c-0.001,0-0.002,0-0.003,0 c-12.723-0.001-25.861-12.777-36.046-35.051c-3.344-7.314-6.236-15.367-8.676-23.971c14.289,2.123,29.33,3.243,44.727,3.243 c15.394,0,30.433-1.119,44.719-3.242c-2.439,8.604-5.332,16.656-8.676,23.97C183.506,282.513,170.367,295.289,157.645,295.289z M201.11,287.784c3.869-5.612,7.478-12.03,10.77-19.23c4.983-10.898,9.068-23.192,12.208-36.441 c13.248-3.139,25.543-7.225,36.441-12.207c7.199-3.292,13.616-6.899,19.228-10.769C266.703,245.7,237.672,274.731,201.11,287.784z"/>
<path d="M229.034,154.702c0.898,0,1.749-0.402,2.319-1.097c9.218-11.23,55.2-68.64,55.2-96.088C286.553,25.802,260.75,0,229.035,0 c-31.715,0-57.517,25.802-57.517,57.517c0,27.459,45.98,84.861,55.197,96.088C227.285,154.3,228.136,154.702,229.034,154.702z M198.035,54.169c0-17.093,13.907-31,31-31c17.093,0,31,13.907,31,31s-13.907,31-31,31 C211.942,85.169,198.035,71.263,198.035,54.169z"/></g></svg>`
            },
            { label: 'type', value: LanguageManager.translateText(item.type) },
        ];
        return {
            sport,
            variant: '',
            title: {
                competition: LanguageManager.translateText(item.competition.name),
                phase: LanguageManager.translateText(item.competition.phase)
            },
            header: {
                type: 'teams',
                home: item.home_team,
                away: item.away_team,
                homeGoals: Utils.parseGoals(item.score.fullTime?.home),
                awayGoals: Utils.parseGoals(item.score.fullTime?.away),
                pending: status === 'pending',
                watchHref: item.media?.embed_video ? `watch.html?id=${item.id}` : '',
                statsHref: item.media?.has_stats ? `match.html?id=${item.id}&sport=${sport}` : ''
            },
            body: {
                type: 'sections',
                imageItem: item,
                sections: [
                    { title: LanguageManager.t('matchInfo'),     html: Elements.setDetailList(rowsMatchInfo) },
                    { title: LanguageManager.t('tvInfo'),        html: tvInfo },
                    { title: LanguageManager.t('technicalInfo'), html: Elements.renderTechInfo(item), after: Elements.storageMethod(item.technical_details) },
                    { title: LanguageManager.t('refereeInfo'),   html: Elements.renderRefereeInfo(item) },
                    { title: LanguageManager.t('attRevInfo'),    html: Elements.renderAttRev(item) }
                ],
                notes: item.additional_info
            }
        };
    },

    // Motorsport: item = etapa com vários eventos (acordeão)
    motor(item, sport) {
        const startDate = Utils.formatMatchDate(item.start_date);
        const endDate = Utils.formatMatchDate(item.end_date);
        const period = [startDate, endDate].filter(d => !Utils.isBlank(d)).filter((d, i, arr) => arr.indexOf(d) === i).join(' - ');
        return {
            sport,
            variant: 'motor-division',
            title: {
                competition: LanguageManager.translateText(item.competition?.name),
                phase: LanguageManager.translateText(item.competition?.phase)
            },
            header: { type: 'period', text: period },
            body: {
                type: 'accordion',
                events: (item.events || []).map(evt => ({
                    title: LanguageManager.translateText(evt.event_type) || 'Evento',
                    date: Utils.formatMatchDate(evt.utcDate),
                    images: evt.media?.image,
                    sections: [
                        { title: LanguageManager.t('eventInfo'),     html: Elements.renderTvInfo(evt, false, false) },
                        { title: LanguageManager.t('technicalInfo'), html: Elements.renderTechInfo(evt), after: Elements.storageMethod(evt.technical_details) }
                    ],
                    notes: evt.additional_info
                }))
            }
        };
    },

    // Carnaval. Formato ATUAL: date, embed_video, championship{division,city,venue},
    // samba_school{...}, station{}. O backend vai migrar para um formato parecido com o dos
    // outros esportes; cada campo lê o novo primeiro e cai no atual (mesmas suposições do card).
    carnaval(item, sport) {
        const school = item.samba_school || item.school || {};
        const champ = item.championship || {};
        const comp = item.competition || {};
        const sources = Array.isArray(item.sources) ? item.sources : null;
        const station = item.station || sources?.[0]?.station || {};
        const tech = item.technical_details || {};
        const result = school.result || {};
        const dateStr = item.utcDate ?? item.date;
        const city = LanguageManager.translateText(comp.city ?? champ.city);
        const division = LanguageManager.translateText(comp.phase ?? champ.division);
        const placeText = LanguageManager.t('place');
        const pointsText = LanguageManager.t('points');

        const info = Elements.setDetailList([
            { label: 'date',         value: Utils.formatMatchDate(dateStr) },
            { label: 'city',         value: city },
            { label: 'division',     value: division },
            { label: 'plot',         value: school.plot },
            { label: 'carnavalesco', value: school.carnavalesco },
            { label: 'interpreter',  value: school.interpreter },
            { label: 'venue',        value: comp.venue ?? champ.venue },
            { label: 'type',         value: LanguageManager.translateText(item.type) },
        ]);
        const tvInfo = Elements.setDetailList([
            { label: 'broadcaster', value: station.name },
            { label: 'origin',      value: LanguageManager.translateText(station.origem ?? station.source_type) },
            { label: 'narration',   value: station.narracao ?? station.commentary },
        ]);
        const competitionInfo = Elements.setDetailList([
            { label: 'finalPos',   value: result.final_position ? LanguageManager.translateOrdinary(result.final_position, 'fem') + ' ' + placeText : '' },
            { label: 'finalScore', value: result.total ? result.total + ' ' + pointsText : '' },
        ]);
        const judgments = Elements.renderJudgmentItems(result.category || []);
        const techGrid = Elements.setDetailGrid([
            { label: 'ID',          value: item.id },
            { label: 'quality',     value: tech.video_quality },
            { label: 'audioFormat', value: LanguageManager.translateText(tech.audio_format || '2.0') },
            { label: 'bitrate',     value: (tech.video_bitrate ? tech.video_bitrate + ' Mbps' : '') },
            { label: 'duration',    value: tech.duration },
            { label: 'fileSize',    value: Utils.formatSize(tech.file_size) },
        ]);
        return {
            sport,
            variant: '',
            title: { competition: city, phase: division },
            header: {
                type: 'show',
                school,
                pending: Utils.getEventStatus(dateStr) === 'pending',
                watchHref: (item.has_embed_video ?? item.embed_video) ? `watch.html?id=${item.id}` : ''
            },
            body: {
                type: 'sections',
                imageItem: item,
                sections: [
                    { title: LanguageManager.t('carnavalInfo'),     html: info },
                    { title: LanguageManager.t('competitionInfo'),  html: competitionInfo + (judgments || '') },
                    { title: LanguageManager.t('tvInfo'),           html: tvInfo },
                    { title: LanguageManager.t('technicalInfo'),    html: techGrid, boxClass: 'detail-grid technical', after: Elements.storageMethod(tech) }
                ],
                notes: item.additional_info
            }
        };
    }
};

// Cabeçalho do modal (#modalScore) por tipo de conteúdo
const ModalHeaders = {
    _watchButton(href) {
        return href ? `
            <div class="score-button-container">
                <a href="${href}" class="score-button watch-match-button">
                    <span>${LanguageManager.t('watchMatch') || 'Assistir jogo'}</span>
                </a>
            </div>` : '';
    },

    teams(vm) {
        const h = vm.header;
        const pendingText = LanguageManager.t('pendingMatch');
        const name = t => LanguageManager.t(t.name);
        const logo = (t, cls) => t.logo ? `<img src="${t.logo}" alt="${name(t)}" class="${cls}" onerror="this.style.display='none'">` : '';
        const statsButton = h.statsHref ? `
            <div class="score-button-container">
                <a href="${h.statsHref}" class="score-button see-stats-button">
                    <span>${LanguageManager.t('seeStats') || 'Veja estatísticas'}</span>
                </a>
            </div>` : '';
        const row = (t, goals) => `
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${logo(t, 'score-mobile-logo')}
                        <span class="score-team-name">${name(t)}</span>
                    </div>
                    <span class="score-mobile-value">${goals}</span>
                </div>`;
        return `
            <div class="score-desktop">
                <span class="score-team-name">${name(h.home)}</span>
                ${logo(h.home, 'score-team-logo')}
                <span class="score-value-modal">${h.homeGoals} x ${h.awayGoals}</span>
                ${logo(h.away, 'score-team-logo')}
                <span class="score-team-name">${name(h.away)}</span>
                ${h.pending ? `<span class="badge badge-warning score-status-badge">${pendingText}</span>` : ''}
            </div>
            <div class="score-mobile">
                ${row(h.home, h.homeGoals)}
                ${row(h.away, h.awayGoals)}
                ${h.pending ? `<div class="score-mobile-status">
                    <span class="badge badge-warning">${pendingText}</span>
                </div>` : ''}
            </div>
            ${(h.statsHref || h.watchHref) ? `<div class="score-header-buttons">
                ${statsButton}
                ${this._watchButton(h.watchHref)}
            </div>` : '<div class="score-header-buttons"></div>'}
        `;
    },

    show(vm) {
        const h = vm.header;
        const school = h.school;
        const schoolName = LanguageManager.t(school.name);
        return `
            <div>
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${school.logo ? `<img src="${school.logo}" alt="${schoolName}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                        <span class="score-team-name">${schoolName}</span>
                    </div>
                </div>
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        <span class="carnaval-school-plot">${LanguageManager.t(school.plot)}</span>
                    </div>
                </div>
                ${h.pending ? `<div class="score-mobile-status">
                    <span class="badge badge-warning">${LanguageManager.t('pendingMatch')}</span>
                </div>` : ''}
            </div>
            ${(!h.pending && h.watchHref) ? `<div class="score-header-buttons">
                ${this._watchButton(h.watchHref)}
            </div>` : ''}
        `;
    },

    period(vm) {
        const text = vm.header.text;
        return `${text ? `<div style="text-align: center; font-weight: 600;">${text}</div>` : ''}<div class="score-header-buttons"></div>`;
    }
};

// Corpo do modal (#modalBody) por tipo de conteúdo. Devolve { html, carousels }.
const ModalBodies = {
    _notes(text) {
        return text ? `
            <div class="detail-section">
                <div class="section-title modal-style">${LanguageManager.t('observations')}</div>
                <div class="detail-item" style="grid-column: 1/-1;">
                    <div class="detail-value">${text}</div>
                </div>
            </div>` : '';
    },

    _sections(list) {
        return list.map(s => Elements.section(s.title, s.html, s.boxClass, s.after)).join('\n');
    },

    sections(vm) {
        const b = vm.body;
        const { html, images, carouselId } = Elements.renderImages(b.imageItem, "matches_image/", null);
        return {
            html: `
            ${html}

            <div class="modal-division">
            ${this._sections(b.sections)}
            ${this._notes(b.notes)}
            </div>
        `,
            carousels: (Array.isArray(images) && images.length > 1) ? [{ id: carouselId, images }] : []
        };
    },

    // Motorsport: um item do acordeão por evento da etapa
    accordion(vm) {
        const carousels = [];
        const html = vm.body.events.map((evt, index) => {
            let imageHtml = '';
            if (evt.images) {
                const cid = `carousel-motor-${index}-${Date.now()}`;
                if (Array.isArray(evt.images) && evt.images.length > 1) carousels.push({ id: cid, images: evt.images });
                imageHtml = ImageCarousel.renderHTML(CONFIG.IMAGE_CONTENT_URL + evt.images, cid);
            }
            return `
                <div class="motor-event-accordion">
                    <div class="motor-event-header" onclick="MatchModal.toggleEvent(${index})">
                        <div class="motor-event-header-content">
                            <span class="motor-event-title">${evt.title}</span>
                            <span class="motor-event-date">${evt.date}</span>
                        </div>
                        <span class="motor-event-icon" id="icon-${index}">▼</span>
                    </div>
                    <div class="motor-event-content" id="content-${index}" style="display: none;">
                        ${imageHtml}
                        ${this._sections(evt.sections)}
                        ${this._notes(evt.notes)}
                    </div>
                </div>
            `;
        }).join('');
        return { html, carousels };
    }
};

// REVISADO
const MatchModal = {
    // O #modal é reutilizado por futebol, motorsport e carnaval: limpa o que um deles
    // deixa para o próximo.
    resetVariant() {
        document.getElementById('modalBody')?.classList.remove('motor-division');
    },

    // Mostra qualquer tipo de conteúdo: o adaptador da categoria monta o view-model.
    // sportOverride: para páginas que já sabem a categoria (match.html).
    show(item, sportOverride) {
        document.body.style.overflow = 'hidden';
        MatchModal.resetVariant();

        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body = document.getElementById('modalBody');
        if (!title || !score || !body) return;

        const sport = sportOverride || Utils.getItemSport(item);
        const adapter = (sport === 'motor' || sport === 'carnaval') ? ModalAdapters[sport] : ModalAdapters.match;
        const vm = adapter.call(ModalAdapters, item, sport);

        if (vm.variant) body.classList.add(vm.variant);
        title.innerHTML = `
            <div class="section-title modal-title-competition">${vm.title.competition}</div>
            <div class="modal-title-phase">${vm.title.phase}</div>
        `;
        score.innerHTML = ModalHeaders[vm.header.type](vm);

        const { html, carousels } = ModalBodies[vm.body.type](vm);
        body.innerHTML = html;
        carousels.forEach(c => ImageCarousel.init(c.id, c.images));
        modal?.classList.add('active');
    },

    // Acordeão de eventos (motorsport)
    toggleEvent(index) {
        const content = document.getElementById(`content-${index}`);
        const icon = document.getElementById(`icon-${index}`);
        if (!content || !icon) return;
        const open = content.style.display === 'none';
        content.style.display = open ? 'block' : 'none';
        icon.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
    },

    // options.requestHtml: bloco HTML extra (ex.: dados coletados no pedido do usuário), exibido no topo do modal.
    async fetchAndShow(id, sport = 'football', options = {}) {
        const modal = document.getElementById('modal');
        const body  = document.getElementById('modalBody');
        const score = document.getElementById('modalScore');
        const title = document.getElementById('modalTitle');

        if (!modal || !body || !score || !title) {
            console.error('fetchAndShow: elementos do modal não encontrados no DOM.', { modal, body, score, title });
            return;
        }

        // Botão de compartilhamento
        const existingShareBtn = document.getElementById('modalShareBtn');
        if (existingShareBtn) existingShareBtn.remove();
        const shareBtn = document.createElement('button');
        shareBtn.id = 'modalShareBtn';
        shareBtn.className = 'btn share-btn';
        shareBtn.title = 'Compartilhar';
        shareBtn.setAttribute('aria-label', 'Compartilhar');
        shareBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
        shareBtn.onclick = () => {
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('id', id);
            urlParams.set('sport', sport);
            const shareUrl = `${window.location.origin}/match.html?${urlParams.toString()}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                Utils.showNotification('Link copiado!', 'success');
            }).catch(() => {
                Utils.showNotification('Erro ao copiar link', 'error');
            });
        };
        // Na administração o link público de compartilhamento não é necessário
        if (!document.body.classList.contains('page-admin')) {
            document.querySelector('#modal .modal-header .close-btn').insertAdjacentElement('afterend', shareBtn);
        }
        
        MatchModal.resetVariant();
        title.innerHTML = `<div class="section-title modal-title-competition">${LanguageManager.t('loadingData') || 'Carregando...'}</div>`;
        score.innerHTML = '';
        body.innerHTML  = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Loading...</div>';
        modal?.classList.add('active');

        try {
            const apiResponse = await APIService.fetchById(id, sport);

            // Carnaval ainda passa pelo transformData (formato antigo da API)
            const items = sport === 'carnaval' ? APIService.transformData(apiResponse, sport) : apiResponse.data;
            if (!items.length) throw new Error('Item não encontrado');
            MatchModal.show({ ...items[0], sport });
            if (options.requestHtml) body.insertAdjacentHTML('afterbegin', options.requestHtml);
        } catch (err) {
            title.innerHTML = '';
            body.innerHTML = `
                ${options.requestHtml || ''}
                <div class="empty-state">
                    <h2>Erro ao carregar</h2>
                    <p>${Utils.escapeHtml ? Utils.escapeHtml(err.message) : err.message}</p>
                </div>`;
        }
    },
    // Fecha o modal. O #modal não tem transição própria (só os filhos têm), então o antigo
    // "espera o transitionend" dependia de um evento que subia de um filho qualquer — por exemplo
    // do hover do botão — e em telas de toque nunca disparava, deixando o modal preso.
    // Agora o fechamento é imediato, ou aguarda a animação do próprio #modal se houver uma.
    close() {
        const modal = document.getElementById('modal');
        if (!modal || !modal.classList.contains('active') || modal.classList.contains('closing')) return;

        document.body.style.overflow = SourcePicker.isOpen() ? 'hidden' : '';
        modal.classList.add('closing');

        const finish = () => {
            if (!modal.classList.contains('closing')) return;
            modal.classList.remove('active', 'closing');
            MatchModal.resetVariant();
        };

        const style = getComputedStyle(modal);
        const ms = v => Math.max(...String(v).split(',').map(s => (parseFloat(s) || 0) * (s.includes('ms') ? 1 : 1000)));
        const duration = Math.max(ms(style.transitionDuration), ms(style.animationDuration));

        if (duration <= 0) { finish(); return; }

        const onEnd = e => { if (e.target === modal) { modal.removeEventListener('transitionend', onEnd); modal.removeEventListener('animationend', onEnd); finish(); } };
        modal.addEventListener('transitionend', onEnd);
        modal.addEventListener('animationend', onEnd);
        setTimeout(finish, duration + 100);   // garantia
    },

    // Fechamento por Escape e por clique no fundo: um único conjunto de listeners (delegação em
    // document), válido para todas as páginas que usam o modal.
    _bindEscape() {
        if (this._escapeBound) return;
        this._escapeBound = true;
        document.addEventListener('click', e => {
            if (e.target?.id === 'modal') MatchModal.close();
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            // O painel do carrinho fica por cima do modal e fecha primeiro
            if (document.getElementById('om-panel')?.classList.contains('om-open')) return;
            // Camadas, de cima para baixo: modal da partida → seletor de emissoras
            const modal = document.getElementById('modal');
            if (modal?.classList.contains('active')) { e.preventDefault(); MatchModal.close(); return; }
            if (SourcePicker.isOpen()) { e.preventDefault(); SourcePicker.close(); }
        });
    }
};
MatchModal._bindEscape();

// REVISADO
const Renderer = {
    render() {
        const container = document.getElementById('matchesContainer');
        if (AppState.filteredMatches.length === 0) {
            const noMatchesText = LanguageManager.t('noMatches');
            const noMatchesMsg = LanguageManager.t('noMatchesMessage');
            container.innerHTML = `
                <div class="empty-state">
                    <h2>${noMatchesText}</h2>
                    <p>${noMatchesMsg}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '<div class="matches-grid" id="grid"></div>';
        const grid = document.getElementById('grid');
        AppState.filteredMatches.forEach(match => {
            // Card único: o adaptador do PRÓPRIO esporte do item (a listagem "all" mistura esportes)
            grid.appendChild(CardManager.create(match));
        });

        document.dispatchEvent(new CustomEvent('matchesRendered'));
    },
    updateStats(apiResponse) {
        if (AppState.matches.length === 0) return;
        document.getElementById('stats').style.display = 'flex';
        
        const totalGames = apiResponse?.pagination?.total_items || 
                          apiResponse?.total_registros || 
                          apiResponse?.total_records || 
                          AppState.matches.length;
        
        const totalFileSize = apiResponse?.total_size;
        const totalMinutes = apiResponse?.total_duration;
        const totalFiles = apiResponse?.total_files;
        
        document.getElementById('totalGames').textContent = totalGames;
        document.getElementById('totalFiles').textContent = totalFiles;
        if (totalFileSize < 1099511627776) {
            document.getElementById('totalSize').textContent = (totalFileSize / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        } else {
            document.getElementById('totalSize').textContent = (totalFileSize / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
        }
        
        if (apiResponse && apiResponse.total_hours) {
            document.getElementById('totalDuration').textContent = Math.round(apiResponse.total_hours) + 'h';
        } else {
            document.getElementById('totalDuration').textContent = Math.round(totalMinutes / 3600) + 'h';
        }
    },
    populateYearFilter() {
        const years = new Set();
        AppState.matches.forEach(match => {
            const date = Utils.parseDate(Utils.getItemDate(match));
            if (date) years.add(date.getFullYear());
        });
        const yearFilter = document.getElementById('yearFilter');
        yearFilter.innerHTML = `<option value="" data-i18n="allYears">${LanguageManager.t('allYears')}</option>`;
        Array.from(years).sort((a, b) => b - a).forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        });
    }
};

// REVISADO
const FilterManager = {
    apply() {
        const query = document.getElementById('searchInput').value;
        const year = document.getElementById('yearFilter').value;
        
        AppState.filteredMatches = AppState.matches.filter(match => {
            const matchesQuery = Utils.matchesSearch(match, query);
            let matchesYear = true;
            
            if (year) {
                const date = Utils.parseDate(Utils.getItemDate(match));
                matchesYear = date && date.getFullYear().toString() === year;
            }
            return matchesQuery && matchesYear;
        });
        Renderer.render();
    }
};


const ImageCarousel = {
    _carousels: {},

    renderHTML(image, id) {
        const images = Array.isArray(image) ? image : [image];
        if (images.length === 0) return '';

        if (images.length === 1) {
            return `<img src="${images[0]}" alt="Imagem" class="modal-image" onerror="this.onerror=null; this.remove();">`;
        }

        const carouselId = id || `carousel-${Date.now()}`;
        return `
            <div class="modal-image-carousel" id="${carouselId}" data-index="0" data-total="${images.length}">
                <img src="${images[0]}" alt="Imagem 1 de ${images.length}" class="modal-image carousel-img" onerror="this.style.opacity='0'">
                <button class="carousel-btn carousel-btn-prev" onclick="ImageCarousel.prev('${carouselId}')">&#8249;</button>
                <button class="carousel-btn carousel-btn-next" onclick="ImageCarousel.next('${carouselId}')">&#8250;</button>
                <div class="carousel-counter"><span class="carousel-current">1</span> / ${images.length}</div>
            </div>`;
    },

    init(carouselId, images) {
        this._carousels[carouselId] = images;
    },

    prev(carouselId) {
        this._navigate(carouselId, -1);
    },

    next(carouselId) {
        this._navigate(carouselId, 1);
    },

    _navigate(carouselId, direction) {
        const el = document.getElementById(carouselId);
        if (!el) return;
        const images = this._carousels[carouselId];
        if (!images) return;
        if (el.dataset.animating === 'true') return;

        const total = images.length;
        let idx = parseInt(el.dataset.index, 10);
        const nextIdx = (idx + direction + total) % total;

        const current = el.querySelector('.carousel-img');
        const incoming = current.cloneNode();
        incoming.src = images[nextIdx];
        incoming.alt = `Imagem ${nextIdx + 1} de ${total}`;
        incoming.style.position = 'absolute';
        incoming.style.top = '0';
        incoming.style.left = '0';
        incoming.style.transform = direction > 0 ? 'translateX(100%)' : 'translateX(-100%)';
        incoming.style.transition = 'none';
        el.style.position = 'relative';
        el.appendChild(incoming);

        el.dataset.animating = 'true';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                incoming.style.transition = 'transform 0.35s ease';
                current.style.transition = 'transform 0.35s ease';
                incoming.style.transform = 'translateX(0)';
                current.style.transform = direction > 0 ? 'translateX(-100%)' : 'translateX(100%)';
            });
        });

        incoming.addEventListener('transitionend', () => {
            current.remove();
            incoming.style.position = '';
            incoming.style.top = '';
            incoming.style.left = '';
            incoming.style.transform = '';
            incoming.style.transition = '';
            incoming.classList.add('carousel-img');
            el.dataset.index = nextIdx;
            el.dataset.animating = 'false';
            const counter = el.querySelector('.carousel-current');
            if (counter) counter.textContent = nextIdx + 1;
        }, { once: true });
    }
};