const AppState = {
    matches: [],
    filteredMatches: [],
    currentView: 'cards',
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

const CardManager = {
    create(match) {
        const card = document.createElement('div');
        const sources = Array.isArray(match.Fontes) ? match.Fontes : null;
        const sourceCount = sources ? sources.length : 1;

        card.dataset.matchId = match.ID;
        const status = Utils.getMatchStatus(match);
        const hasVideo = match['Video Embed'] ? 'has-video' : '';
        card.className = `match-card ${status} ${hasVideo}`;
        card.onclick = () => {
            if (sources && sources.length > 1) {
                SourcePicker.open(match);
            } else {
                const singleId = (sources && sources.length === 1) ? sources[0].id : match.ID;
                MatchModal.fetchAndShow(singleId, CONFIG.currentSport);
            }
        };
        
        const { homeGoals, homeWinner, homeLoser,
                awayGoals, awayWinner, awayLoser,
                hasWinner } = Utils.parseWinner(match['Gols mandante'], match['Gols visitante']);
        
        const statusText = status === 'pending' ? LanguageManager.t('pendingMatch') : '';
        const statusBadge = status === 'pending' ? `<span class="match-status">${statusText}</span>` : '';

        const competition = LanguageManager.translateText(match.Competição);
        const phase = LanguageManager.translateText(match.Fase);
        const audioFormat = LanguageManager.translateText(match['Formato de áudio']);
        
        // Gerar URL do logo da competição
        let competitionLogo = '';
        if (match.Competição && match.Data) {
            const competitionSlug = match.Competição
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .replace(/\s+/g, '_');
            
            const matchDate = Utils.parseDate(match.Data);
            const year = matchDate ? matchDate.getFullYear() : new Date().getFullYear();
            competitionLogo = `competition_logos/${competitionSlug}_${year}.png`;
        }

        // Formatar a data
        const dateDisplay = Utils.formatMatchDate(match.Data);
        
        card.innerHTML = `
            ${statusBadge}
            <div class="match-header">
                ${competitionLogo ? `<img src="${competitionLogo}" alt="${match.Competição}" class="competition-logo" onerror="this.style.display='none'">` : ''}
                <div class="competition-info">
                    <div class="match-competition">${competition || 'N/A'}</div>
                    <div class="match-phase">${phase || ''}</div>
                </div>
            </div>
            <div class="match-date">${dateDisplay}</div>
            <div class="match-teams">
                <div class="team">
                    ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" alt="${LanguageManager.t(match.Mandante)}" class="team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="team-name ${homeWinner ? 'winner' : ''} ${homeLoser ? 'loser' : ''}">${LanguageManager.t(match.Mandante) || 'Time 1'}</span>
                    <span class="score ${homeWinner ? 'winner' : ''} ${homeLoser ? 'loser' : ''}">${homeGoals}</span>
                </div>
                <div class="team">
                    ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" alt="${LanguageManager.t(match.Visitante)}" class="team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="team-name ${awayWinner ? 'winner' : ''} ${awayLoser ? 'loser' : ''}">${LanguageManager.t(match.Visitante) || 'Time 2'}</span>
                    <span class="score ${awayWinner ? 'winner' : ''} ${awayLoser ? 'loser' : ''}">${awayGoals}</span>
                </div>
            </div>
            <div class="match-footer">
                ${sourceCount > 1 ? `
                    <div class="sources-count-badge" title="${sourceCount} ${LanguageManager.t('sourcesCount') || 'fontes disponíveis'}">
                        <span class="sources-count-value">${sourceCount}</span>
                        <span class="sources-count-label">${LanguageManager.t('sourcesCount')}</span>
                    </div>
                ` : `
                    ${match['Logo emissora'] ? `<img src="${match['Logo emissora']}" alt="${match.Emissora}" class="broadcaster-logo${noFilterLogos.includes(match['Logo emissora']) ? ' no-filter' : ''}" onerror="this.style.display='none'">` : '<div></div>'}
                    <div class="tech-badges">
                        ${match.Qualidade ? `<span class="tech-badge">${match.Qualidade}</span>` : ''}
                        <span class="tech-badge">${audioFormat}</span>
                    </div>
                `}
            </div>
        `;
        return card;
    }
};

const MotorCardManager = {
    create(event) {
        const card = document.createElement('div');
        const hasVideo = event['Video Embed'] ? 'has-video' : '';
        card.className = `match-card motor-event ${hasVideo}`;
        card.onclick = () => MatchModal.fetchAndShow(event.ID, 'motor');
        
        const dateRange = Utils.formatMotorDateRange(event.DataInicio, event.DataFim);
        
        const competition = LanguageManager.translateText(event.Campeonato);
        const phase = LanguageManager.translateText(event.Fase);
        
        const eventCount = event.Eventos?.length || 0;
        const eventLabel = LanguageManager.currentLang === 'en' 
            ? (eventCount === 1 ? 'event' : 'events')
            : (eventCount === 1 ? 'evento' : 'eventos');
        
        let competitionLogo = '';
        if (event.Campeonato && event.DataInicio) {
            const competitionSlug = event.Campeonato
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .replace(/\s+/g, '_');
            
            const matchDate = Utils.parseDate(event.DataInicio);
            const year = matchDate ? matchDate.getFullYear() : new Date().getFullYear();
            competitionLogo = `competition_logos/${competitionSlug}_${year}.png`;
        }

        card.innerHTML = `
            <div class="match-header">
                ${competitionLogo ? `<img src="${competitionLogo}" alt="${event.Campeonato}" class="competition-logo" onerror="this.style.display='none'">` : ''}  
                <div class="competition-info">
                    <div class="match-competition">${competition || 'N/A'}</div>
                </div>
            </div>
            <div class="match-date">${dateRange}</div>
            <div class="motor-phase-section">
                ${event.Pais ? `<img src="${event.Bandeira}" alt="${event.Pais}" class="country-flag" onerror="this.style.display='none'">` : ''}
                <div class="motor-phase-name">${phase || 'N/A'}</div>
            </div>
            <div class="motor-footer">
                ${event['Logo emissora'] ? `<img src="${event['Logo emissora']}" alt="Emissora" class="broadcaster-logo${noFilterLogos.includes(event['Logo emissora']) ? ' no-filter' : ''}" onerror="this.style.display='none'">` : '<div></div>'}
                <span class="tech-badge motor-event-badge">${eventCount} ${eventLabel}</span>
            </div>
        `;
        return card;
    }
};

const CarnavalCardManager = {
    create(match) {
        const card = document.createElement('div');
        card.dataset.matchId = match.ID;
        const status = Utils.getMatchStatus(match);
        const hasVideo = match['Video Embed'] ? 'has-video' : '';
        card.className = `match-card ${status} ${hasVideo}`;
        card.onclick = () => MatchModal.fetchAndShow(match.ID, CONFIG.currentSport);
        
        
        const statusText = status === 'pending' ? LanguageManager.t('pendingMatch') : '';
        const statusBadge = status === 'pending' ? `<span class="match-status">${statusText}</span>` : '';

        const competition = LanguageManager.translateText(match.Cidade);
        const phase = LanguageManager.translateText(match.Divisão);
        const audioFormat = LanguageManager.translateText(match['Formato de áudio']);
        
        // Gerar URL do logo da competição
        let cityLogo = '';
        if (match.Cidade) {
            const citySlug = match.Cidade
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .replace(/\s+/g, '_');
            
            const matchDate = Utils.parseDate(match.Data);
            const year = matchDate ? matchDate.getFullYear() : new Date().getFullYear();
            cityLogo = `city_flag/${citySlug}.svg`;
        }

        // Formatar a data
        const dateDisplay = Utils.formatMatchDate(match.Data);
        
        card.innerHTML = `
            ${statusBadge}
            <div class="match-header">
                ${match.Cidade ? `<img src="${cityLogo}" alt="${match.Cidade}" class="competition-logo" onerror="this.style.display='none'">` : ''}
                <div class="competition-info">
                    <div class="match-competition">${competition || 'N/A'}</div>
                    <div class="match-phase">${phase || ''}</div>
                </div>
            </div>
            <div class="match-date">${dateDisplay}</div>
            <div class="carnaval-data-section">
                <div class="carnaval-school-section">
                    ${match.Logo ? `<img src="${match.Logo.replace('.svg','.png').replace(/[\u0300-\u036f]/g, '')}" alt="${match.Escola}" class="country-flag" onerror="this.style.display='none'">` : ''}
                    <div class="carnaval-school-name">${match.Escola || 'N/A'}</div>
                </div> 
                <div class="carnaval-plot-name">${match.Enredo || 'N/A'}</div>
            </div>
            <div class="match-footer">
                ${match['Logo emissora'] ? `<img src="${match['Logo emissora']}" alt="${match.Emissora}" class="broadcaster-logo${noFilterLogos.includes(match['Logo emissora']) ? ' no-filter' : ''}" onerror="this.style.display='none'">` : '<div></div>'}
                <div class="tech-badges">
                    ${match.Qualidade ? `<span class="tech-badge">${match.Qualidade}</span>` : ''}
                    <span class="tech-badge">${audioFormat}</span>
                </div>
            </div>
        `;
        return card;
    }
};

const ListManager = {
    create(match) {
        const item = document.createElement('div');
        const status = Utils.getMatchStatus(match);
        const sources = Array.isArray(match.Fontes) ? match.Fontes : null;
        item.className = `list-item ${status}`;
        item.onclick = () => {
            if (sources && sources.length > 1) {
                SourcePicker.open(match);
            } else {
                const singleId = (sources && sources.length === 1) ? sources[0].id : match.ID;
                MatchModal.fetchAndShow(singleId, CONFIG.currentSport);
            }
        };
        
        const homeGoals = Utils.parseGoals(match['Gols mandante']);
        const awayGoals = Utils.parseGoals(match['Gols visitante']);
        const scoreText = `${homeGoals} x ${awayGoals}`;
        
        const statusText = LanguageManager.t('pendingMatch');
        const statusBadge = status === 'pending' ? `<span class="badge badge-warning" style="font-size: 0.7em; margin-left: 8px;">${statusText}</span>` : '';

        const competition = LanguageManager.translateText(match.Competição);
        const phase = LanguageManager.translateText(match.Fase);

        const broadcasterCell = (sources && sources.length > 1)
            ? `<span style="font-size: 0.85em; color: var(--text-secondary);">${sources.length} ${LanguageManager.t('sourcesCount') || 'fontes'}</span>`
            : (match['Logo emissora'] ? `<img src="${match['Logo emissora']}" alt="${match.Emissora}" class="broadcaster-logo${noFilterLogos.includes(match['Logo emissora']) ? ' no-filter' : ''}" onerror="this.style.display='none'">` : `<span style="font-size: 0.85em; color: var(--text-secondary);">${match.Emissora || 'N/A'}</span>`);

        item.innerHTML = `
            <div><strong>${Utils.formatMatchDate(match.Data, true)}</strong></div>
            <div>
                <strong>${LanguageManager.t(match.Mandante)} ${scoreText} ${LanguageManager.t(match.Visitante)}</strong> ${statusBadge}
                <div style="color: var(--text-secondary); font-size: 0.85em; margin-top: 4px;">
                    ${competition} - ${phase}
                </div>
            </div>
            <div style="text-align: center; font-size: 0.85em;">${match.Qualidade || 'N/A'}</div>
            <div style="text-align: right;">
                ${broadcasterCell}
            </div>
        `;
        return item;
    }
};

const MotorListManager = {
    create(event) {
        const item = document.createElement('div');
        item.className = 'list-item motor-event';
        item.onclick = () => MatchModal.fetchAndShow(event.ID, 'motor');
        
        const dateRange = Utils.formatMotorDateRange(event.DataInicio, event.DataFim);
        
        const competition = LanguageManager.translateText(event.Campeonato);
        const phase = LanguageManager.translateText(event.Fase);
        
        const eventCount = event.Eventos?.length || 0;
        const eventLabel = LanguageManager.currentLang === 'en' 
            ? (eventCount === 1 ? 'event' : 'events')
            : (eventCount === 1 ? 'evento' : 'eventos');

        item.innerHTML = `
            <div><strong>${dateRange}</strong></div>
            <div>
                <strong>${phase}</strong>
                <div style="color: var(--text-secondary); font-size: 0.85em; margin-top: 4px;">
                    ${competition}
                </div>
            </div>
            <div style="text-align: center; font-size: 0.85em;">${eventCount} ${eventLabel}</div>
            <div style="text-align: right;">
                ${event['Logo emissora'] ? `<img src="${event['Logo emissora']}" alt="Emissora" class="broadcaster-logo${noFilterLogos.includes(match['Logo emissora']) ? ' no-filter' : ''}" onerror="this.style.display='none'">` : `<span style="font-size: 0.85em; color: var(--text-secondary);">N/A</span>`}
            </div>
        `;
        return item;
    }
};

const SourcePicker = {
    open(match) {
        document.body.style.overflow = 'hidden';
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body  = document.getElementById('modalBody');
        if (!modal || !title || !score || !body) return;

        modal.querySelector('.modal-content').style.minHeight = '1px'

        const existingShareBtn = document.getElementById('modalShareBtn');
        if (existingShareBtn) existingShareBtn.remove();

        const competition = LanguageManager.translateText(match.Competição);
        const phase = LanguageManager.translateText(match.Fase);

        title.innerHTML = ``;

        score.innerHTML = ``;

        const sources = Array.isArray(match.Fontes) ? match.Fontes : [];
        const chooseSourceTitle = LanguageManager.t('chooseSource');

        body.innerHTML = `
            <div class="detail-section">
                <div class="section-title modal-style">${chooseSourceTitle}</div>
                <div class="source-picker-list" id="sourcePickerList">
                    ${sources.map(src => `
                        <button class="source-picker-item" data-source-id="${src.id}">
                            ${src.station?.logo
                                ? `<img src="${src.station.logo}" alt="${src.station?.name || ''}" class="broadcaster-logo${noFilterLogos.includes(src.station.logo) ? ' no-filter' : ''}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'source-picker-fallback-name',textContent:${JSON.stringify(src.station?.name || `#${src.id}`)}}))">`
                                : `<span class="source-picker-fallback-name">${src.station?.name || `#${src.id}`}</span>`
                            }
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        body.querySelectorAll('.source-picker-item').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelector('.modal-content').style.removeProperty('min-height');
                MatchModal.fetchAndShow(btn.dataset.sourceId, CONFIG.currentSport);
            });
        });

        modal.classList.add('active');
    }
};

// REVISADO
const MatchModal = {
    show(match) {
        document.body.style.overflow = 'hidden';
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body = document.getElementById('modalBody');
        if (!title || !score || !body) return;
        const status = Utils.getMatchStatus(match);
        
        const competition = LanguageManager.translateText(match.competition.name);
        const phase = LanguageManager.translateText(match.competition.phase);
        
        title.innerHTML = `
            <div class="section-title modal-title-competition">${competition}</div>
            <div class="modal-title-phase">${phase}</div>
        `;
        
        const homeGoals = Utils.parseGoals(match.score.fullTime?.home);
        const awayGoals = Utils.parseGoals(match.score.fullTime?.away);
        const pendingText = LanguageManager.t('pendingMatch');
        const embed = match.media?.embed_video;
        
        // HTML do vídeo embed (se existir)
        const videoId = match.id
        const videoHtml = embed ? `
            <div class="score-button-container">
                <a href="watch.html?id=${videoId}" class="score-button watch-match-button">
                    <span>${LanguageManager.t('watchMatch') || 'Assistir jogo'}</span>
                </a>
            </div>
        ` : '';

        // HTML das estatistucas (se existir)
        const statsHTML = match.media?.has_stats ? `
            <div class="score-button-container">
                <a href="match.html?id=${videoId}&sport=${CONFIG.currentSport}" class="score-button see-stats-button">
                    <span>${LanguageManager.t('seeStats') || 'Veja estatísticas'}</span>
                </a>
            </div>
        ` : '';
        
        let scoreHtml = '';
        scoreHtml = `
            <div class="score-desktop">
                <span class="score-team-name">${LanguageManager.t(match.home_team.name)}</span>
                ${match.home_team.logo ? `<img src="${match.home_team.logo}" alt="${LanguageManager.t(match.home_team.name)}" class="score-team-logo" onerror="this.style.display='none'">` : ''}
                <span class="score-value-modal">${homeGoals} x ${awayGoals}</span>
                ${match.away_team.logo ? `<img src="${match.away_team.logo}" alt="${LanguageManager.t(match.away_team.name)}" class="score-team-logo" onerror="this.style.display='none'">` : ''}
                <span class="score-team-name">${LanguageManager.t(match.away_team.name)}</span>
                ${status === 'pending' ? `<span class="badge badge-warning score-status-badge">${pendingText}</span>` : ''}
            </div>
            <div class="score-mobile">
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match.home_team.logo ? `<img src="${match.home_team.logo}" alt="${LanguageManager.t(match.home_team.name)}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.home_team.name)}</span>
                    </div>
                    <span class="score-mobile-value">${homeGoals}</span>
                </div>
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match.away_team.logo ? `<img src="${match.away_team.logo}" alt="${LanguageManager.t(match.away_team.name)}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.away_team.name)}</span>
                    </div>
                    <span class="score-mobile-value">${awayGoals}</span>
                </div>
                ${status === 'pending' ? `<div class="score-mobile-status">
                    <span class="badge badge-warning">${pendingText}</span>
                </div>` : ''}
            </div>
            <div class="score-header-buttons">
            ${(match.media?.has_stats || embed) ? `
                ${statsHTML}
                ${videoHtml}
            </div>` : ''}
        `;
        
        score.innerHTML = scoreHtml;
        
        const rows_match_info = [
            { label: 'date', value: Utils.formatDateTime(match.utcDate), svg: '<svg viewBox="0 0 12 15" fill="currentcolor" xmlns="http://www.w3.org/2000/svg" class="cf-icon-svg"><path d="M11.882 3.187a.476.476 0 0 1 .475.475v11.063a.476.476 0 0 1-.475.475H1.118a.476.476 0 0 1-.475-.475V3.662a.476.476 0 0 1 .475-.475h1.328v.721a1.425 1.425 0 0 0 2.85 0v-.72H7.71v.72a1.425 1.425 0 0 0 2.85 0v-.72zm-.634 3.37H1.752v7.535h9.496zm-7.384.821H2.621V8.67h1.243zm0 2.292H2.621v1.292h1.243zm0 2.292H2.621v1.291h1.243zm.561-8.054V2.475a.554.554 0 1 0-1.108 0v1.433a.554.554 0 1 0 1.108 0zm1.613 3.47H4.794V8.67h1.244zm0 2.292H4.794v1.292h1.244zm0 2.292H4.794v1.291h1.244zm2.174-4.584H6.968V8.67h1.244zm0 2.292H6.968v1.292h1.244zm0 2.292H6.968v1.291h1.244zm1.477-8.054V2.475a.554.554 0 0 0-1.108 0v1.433a.554.554 0 0 0 1.108 0zm.696 3.47H9.142V8.67h1.243zm0 2.292H9.142v1.292h1.243zm0 2.292H9.142v1.291h1.243z"/></svg>' },
            { label: 'city', value: match.venue?.city, svg: `<svg fill="currentColor"version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="00 0 315 315" xml:space="preserve"><g>
<path d="M290.012,95.991c-3.629,7.01-7.824,14.115-12.246,21.031l-1.756,2.72c-3.723,5.708-7.569,11.257-11.343,16.485 c14.51,8.949,22.596,19.327,22.596,29.444c0,12.723-12.775,25.861-35.051,36.046c-7.314,3.344-15.367,6.236-23.97,8.676 c1.678-11.29,2.717-23.054,3.084-35.087c-0.849,0.231-1.727,0.365-2.625,0.365c-2.895,0-5.648-1.255-7.547-3.44 c-1.376-1.583-4.934-5.721-9.724-11.623c0.028,1.684,0.054,3.369,0.054,5.063c0,17.288-1.48,34.029-4.283,49.556 c-15.526,2.802-32.267,4.283-49.554,4.283c-17.29,0-34.032-1.48-49.561-4.283c-2.802-15.527-4.282-32.268-4.282-49.556 s1.48-34.029,4.282-49.556c15.528-2.802,32.271-4.283,49.561-4.283c6.46,0,12.843,0.207,19.115,0.612 c-4.195-6.804-8.103-13.727-11.412-20.507c-2.558-0.063-5.123-0.105-7.703-0.105c-15.396,0-30.438,1.12-44.727,3.243 c2.439-8.604,5.332-16.657,8.676-23.971c10.185-22.274,23.323-35.05,36.046-35.051c0.001,0,0.002,0,0.003,0 c0.245,0,0.491,0.014,0.737,0.023c2.158-7.064,5.347-13.683,9.401-19.672c-3.351-0.225-6.729-0.351-10.137-0.351 c-0.001,0-0.001,0-0.002,0h-0.001c-0.001,0-0.002,0-0.003,0C75.143,16.056,8.026,83.173,8.026,165.671 c0,82.498,67.116,149.615,149.615,149.618c0.001,0,0.002,0,0.003,0h0.001c0.001,0,0.001,0,0.002,0 c82.498,0,149.615-67.118,149.615-149.618C307.263,140.525,301.017,116.813,290.012,95.991z M114.175,43.561 c-3.869,5.612-7.476,12.028-10.768,19.227C98.425,73.686,94.34,85.98,91.2,99.229c-13.247,3.14-25.541,7.224-36.439,12.206 c-7.199,3.292-13.617,6.899-19.229,10.769C48.586,85.644,77.615,56.615,114.175,43.561z M63.078,129.624 c7.314-3.344,15.366-6.235,23.969-8.675c-2.123,14.287-3.242,29.327-3.242,44.722c0,15.395,1.119,30.434,3.242,44.721 c-8.603-2.439-16.655-5.331-23.968-8.675c-22.276-10.186-35.052-23.324-35.052-36.046 C28.026,152.948,40.802,139.809,63.078,129.624z M35.532,209.137c5.612,3.869,12.03,7.477,19.229,10.769 c10.897,4.982,23.191,9.067,36.439,12.207c3.14,13.248,7.225,25.543,12.207,36.441c3.292,7.199,6.899,13.615,10.768,19.227 C77.615,274.727,48.585,245.697,35.532,209.137z M157.645,295.289c-0.001,0-0.002,0-0.003,0 c-12.723-0.001-25.861-12.777-36.046-35.051c-3.344-7.314-6.236-15.367-8.676-23.971c14.289,2.123,29.33,3.243,44.727,3.243 c15.394,0,30.433-1.119,44.719-3.242c-2.439,8.604-5.332,16.656-8.676,23.97C183.506,282.513,170.367,295.289,157.645,295.289z M201.11,287.784c3.869-5.612,7.478-12.03,10.77-19.23c4.983-10.898,9.068-23.192,12.208-36.441 c13.248-3.139,25.543-7.225,36.441-12.207c7.199-3.292,13.616-6.899,19.228-10.769C266.703,245.7,237.672,274.731,201.11,287.784z"/>
<path d="M229.034,154.702c0.898,0,1.749-0.402,2.319-1.097c9.218-11.23,55.2-68.64,55.2-96.088C286.553,25.802,260.75,0,229.035,0 c-31.715,0-57.517,25.802-57.517,57.517c0,27.459,45.98,84.861,55.197,96.088C227.285,154.3,228.136,154.702,229.034,154.702z M198.035,54.169c0-17.093,13.907-31,31-31c17.093,0,31,13.907,31,31s-13.907,31-31,31 C211.942,85.169,198.035,71.263,198.035,54.169z"/></g></svg>`
            },
            { label: 'type', value: LanguageManager.translateText(match.type) },
        ];
        const matchInfoTitle = LanguageManager.t('matchInfo');
        const match_info  = Elements.setDetailList(rows_match_info);

        const tvInfoTitle = LanguageManager.t('tvInfo');
        const tv_info     = Elements.renderTvInfo(match, false, false);

        const technicalInfoTitle = LanguageManager.t('technicalInfo');
        const tech_info   = Elements.renderTechInfo(match);

        const refereeTitle = LanguageManager.t('refereeInfo');
        const referee_info = Elements.renderRefereeInfo(match);

        const attRevTitle = LanguageManager.t('attRevInfo');
        const attrev_info = Elements.renderAttRev(match);

        const storageTitle = LanguageManager.t('storageInfo');

        const observationsTitle = LanguageManager.t('observations');

        const { html, images, carouselId } = Elements.renderImages(match, "matches_image/", null);
        body.innerHTML = `
            ${html}
            
            <div class="modal-division">
            <div class="detail-section">
                <div class="section-title modal-style">${matchInfoTitle}</div>
                <div class="detail-list">
                    ${match_info}
                </div>
            </div>

            <div class="detail-section">
                <div class="section-title modal-style">${tvInfoTitle}</div>
                <div class="detail-list">
                    ${tv_info}
                </div>                
            </div>
            
            <div class="detail-section">
                <div class="section-title modal-style">${technicalInfoTitle}</div>
                <div class="detail-list">
                    ${tech_info}
                </div>
            </div>

            ${referee_info ? `<div class="detail-section">
                <div class="section-title modal-style">${refereeTitle}</div>
                <div class="detail-list">
                    ${referee_info}
                </div>
            </div>` : ''}
            
            ${attrev_info ? `<div class="detail-section">
                <div class="section-title modal-style">${attRevTitle}</div>
                <div class="detail-list">
                    ${attrev_info}
                </div>
            </div>` : ''}
            
            <div class="detail-section">
                <div class="section-title modal-style">${storageTitle}</div>
                <div class="storage-badges">
                    ${Elements.setStorageBadges(match.technical_details?.local,match.technical_details?.nuvem)}
                </div>
            </div>
            
            ${match.additional_info ? `
                <div class="detail-section">
                    <div class="section-title modal-style">${observationsTitle}</div>
                    <div class="detail-item" style="grid-column: 1/-1;">
                        <div class="detail-value">${match.additional_info}</div>
                    </div>
                </div>
                </div>
            ` : ''}
        `;
        
        if (Array.isArray(images) && images.length > 1) {
            ImageCarousel.init(carouselId, images);
        }
        modal?.classList.add('active');
    },
    async fetchAndShow(id, sport = 'football') {
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
        shareBtn.innerHTML = '🔗';
        shareBtn.onclick = () => {
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('id', id);
            urlParams.set('sport', sport);
            const shareUrl = `${window.location.origin}/${sport === 'football' || sport === 'multisport' ? 'match.html' : 'event.html'}?${urlParams.toString()}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                Utils.showNotification('Link copiado!', 'success');
            }).catch(() => {
                Utils.showNotification('Erro ao copiar link', 'error');
            });
        };
        document.querySelector('.modal-header .close-btn').insertAdjacentElement('afterend', shareBtn);
        
        title.innerHTML = `<div class="section-title modal-title-competition">${LanguageManager.t('loadingData') || 'Carregando...'}</div>`;
        score.innerHTML = '';
        body.innerHTML  = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Loading...</div>';
        modal?.classList.add('active');

        try {
            const apiResponse = await APIService.fetchById(id, sport);

            if (sport === 'motor') {
                const items = APIService.transformData(apiResponse, sport);
                if (!items.length) throw new Error('Item não encontrado');
                MotorModal.show(items[0]);
            } else if (sport === 'carnaval') {
                const items = APIService.transformData(apiResponse, sport);
                if (!items.length) throw new Error('Item não encontrado');
                CarnavalModal.show(items[0]);
            } else {
                const items = apiResponse.data;
                if (!items.length) throw new Error('Item não encontrado');
                MatchModal.show(items[0]);
            }
        } catch (err) {
            title.innerHTML = '';
            body.innerHTML = `
                <div class="empty-state">
                    <h2>Erro ao carregar</h2>
                    <p>${err.message}</p>
                </div>`;
        }
    },
    close() {
        document.body.style.overflow = '';
        document.getElementById('modal').classList.remove('active');
    }
};

const CarnavalModal = {
    show(match) {
        document.body.style.overflow = 'hidden';
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body = document.getElementById('modalBody');
        if (!title || !score || !body) return;
        const status = Utils.getMatchStatus(match);
        
        const competition = LanguageManager.translateText(match.Cidade);
        const phase = LanguageManager.translateText(match.Divisão);
        
        title.innerHTML = `
            <div class="section-title modal-title-competition">${competition}</div>
            <div class="modal-title-phase">${phase}</div>
        `;

        const embed = match['Video Embed'];
        
        // ADICIONAR: HTML do vídeo embed (se existir)
        const videoHtml = match['Video Embed'] ? `
            <div class="score-button-container">
                <a href="watch.html?id=${match.id}" class="score-button watch-match-button">
                    <span>${LanguageManager.t('watchMatch') || 'Assistir jogo'}</span>
                </a>
            </div>
        ` : '';
        
        let scoreHtml = '';
        if (status === 'pending') {
            const pendingText = LanguageManager.t('pendingMatch');
            scoreHtml = `
                <div>
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            ${match['Logo'] ? `<img src="${match['Logo']}" alt="${LanguageManager.t(match.Escola)}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                            <span class="score-team-name">${LanguageManager.t(match.Escola)}</span>
                        </div>
                    </div>
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            <span class="carnaval-school-plot">${LanguageManager.t(match.Enredo)}</span>
                        </div>
                    </div>
                    <div class="score-mobile-status">
                        <span class="badge badge-warning">${pendingText}</span>
                    </div>
                </div>
            `;
        } else {
            scoreHtml = `
                <div>
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            ${match['Logo'] ? `<img src="${match['Logo']}" alt="${LanguageManager.t(match.Escola)}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                            <span class="score-team-name">${LanguageManager.t(match.Escola)}</span>
                        </div>
                    </div>
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            <span class="carnaval-school-plot">${LanguageManager.t(match.Enredo)}</span>
                        </div>
                    </div>
                </div>
                ${(match['Mais dados'] || match['Video Embed']) ? `<div class="score-header-buttons">
                    ${statsHTML}
                    ${videoHtml}
                </div>` : ''}
            `;
        }
        
        score.innerHTML = scoreHtml;
        
        const audioFormat = LanguageManager.translateText(match['Formato de áudio']);

        const carnavalInfoTitle = LanguageManager.t('carnavalInfo');
        const competitionInfoTitle = LanguageManager.t('competitionInfo');
        const tvInfoTitle = LanguageManager.t('tvInfo');
        const technicalInfoTitle = LanguageManager.t('technicalInfo');
        const storageTitle = LanguageManager.t('storageInfo');
        const observationsTitle = LanguageManager.t('observations');
        const videoTitle = LanguageManager.t('video') || 'Vídeo';
        const imageTitle = LanguageManager.t('image') || 'Imagem';

        const placeText = LanguageManager.t('place')
        const pointsText = LanguageManager.t('points')

        const rows_carnaval_info = [
            { label: 'date',        value: Utils.formatMatchDate(match.Data) },
            { label: 'city',        value: competition },
            { label: 'division',    value: phase },
            { label: 'plot',        value: match.Enredo },
            { label: 'carnavalesco',value: match.Carnavalesco },
            { label: 'interpreter', value: match.Interprete },
            { label: 'venue',       value: match.Venue },
            { label: 'type',        value: LanguageManager.translateText(match.Tipo) },
        ];
        
        const rows_tv_info = [
            { label: 'broadcaster', value: match.Emissora },
            { label: 'origin',      value: LanguageManager.translateText(match.Origem) },
            { label: 'narration',   value: match.Narração },
        ];
        
        const rows_competition_info = [
            { label: 'finalPos',    value: LanguageManager.translateOrdinary(match.Posição, 'fem') + ' ' + placeText },
            { label: 'finalScore',  value: match['Nota_final'] + ' ' + pointsText },
        ];
        
        const rows_tech_info = [
            { label: 'ID',          value: match.ID },
            { label: 'quality',     value: match.Qualidade },
            { label: 'audioFormat', value: audioFormat },
            { label: 'bitrate',     value: match.Bitrate + ' Mbps' },
            { label: 'duration',    value: match.Duração },
            { label: 'fileSize',    value: Utils.formatSize(match.Tamanho) },
        ];

        const carnaval_info = Elements.setDetailList(rows_carnaval_info);
        const tv_info = Elements.setDetailList(rows_tv_info);
        const competition_info = Elements.setDetailList(rows_competition_info);
        const result_info = Elements.renderJudgmentItems(match.Notas)
        const tech_info = Elements.setDetailGrid(rows_tech_info);

        const _matchCarouselId = `carousel-match-${match.ID || Date.now()}`;
        body.innerHTML = `
            ${match.Imagem ? ImageCarousel.renderHTML(match.Imagem, _matchCarouselId) : ''}
            
            <div class="modal-division">
            <div class="detail-section">
                <div class="section-title modal-style">${carnavalInfoTitle}</div>
                <div class="detail-list">
                    ${carnaval_info}
                </div>
            </div>

            <div class="detail-section">
                <div class="section-title modal-style">${competitionInfoTitle}</div>
                <div class="detail-list">
                    ${competition_info}
                    ${result_info}
                </div>                
            </div>

            <div class="detail-section">
                <div class="section-title modal-style">${tvInfoTitle}</div>
                <div class="detail-list">
                    ${tv_info}
                </div>                
            </div>
            
            <div class="detail-section">
                <div class="section-title modal-style">${technicalInfoTitle}</div>
                <div class="detail-grid technical">
                    ${tech_info}
                </div>
            </div>
            
            <div class="detail-section">
                <div class="section-title modal-style">${storageTitle}</div>
                <div class="storage-badges">
                    ${Elements.setStorageBadges(match.Local,match.Nuvem)}
                </div>
            </div>
            
            ${match.Obs ? `
                <div class="detail-section">
                    <div class="section-title modal-style">${observationsTitle}</div>
                    <div class="detail-item" style="grid-column: 1/-1;">
                        <div class="detail-value">${match.Obs}</div>
                    </div>
                </div>
                </div>
            ` : ''}
        `;
        
        if (match.Imagem && Array.isArray(match.Imagem) && match.Imagem.length > 1) {
            ImageCarousel.init(_matchCarouselId, match.Imagem);
        }
        modal?.classList.add('active');
    },
    
    async fetchAndShow(id) {
        return MatchModal.fetchAndShow(id, 'carnaval');
    },
    
    close() {
        document.body.style.overflow = '';
        document.getElementById('modal').classList.remove('active');
    }
};

const MotorModal = {
    show(event) {
        document.body.style.overflow = 'hidden';
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body = document.getElementById('modalBody');
        if (!title || !score || !body) return;
        
        const competition = LanguageManager.translateText(event.Campeonato);
        const phase = LanguageManager.translateText(event.Fase);
        
        title.innerHTML = `
            <div class="section-title modal-title-competition">${competition}</div>
            <div class="modal-title-phase">${phase}</div>
        `;
        
        const startDate = Utils.formatMatchDate(event.DataInicio);
        const endDate = Utils.formatMatchDate(event.DataFim);
        const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
        
        score.innerHTML = `<div style="text-align: center; font-weight: 600;">${dateRange}</div>`;

        const _motorCarousels = [];
        const eventsHtml = (event.Eventos || []).map((evt, index) => {
            const rows_tv_info = [
                { label: 'broadcaster', value: evt.station?.name },
                { label: 'origin',      value: LanguageManager.translateText(evt.station?.origem) },
                { label: 'narration',   value: evt.station?.narracao },
            ];
            
            const rows_tech_info = [
                { label: 'quality',     value: evt.technical_details?.video_quality },
                { label: 'audioFormat', value: LanguageManager.translateText(evt.technical_details?.audio_format) },
                { label: 'bitrate',     value: evt.technical_details?.video_bitrate + ' Mbps' },
                { label: 'duration',    value: evt.technical_details?.duration },
                { label: 'fileSize',    value: Utils.formatSize(evt.technical_details?.file_size) },
            ];

            const tv_info = Elements.setDetailList(rows_tv_info);
            const tech_info = Elements.setDetailGrid(rows_tech_info);

            const videoTitle = LanguageManager.t('video') || 'Vídeo';
            const videoHtml = event['Video Embed'] ? `
            <div class="detail-section">
                <div class="section-title">${videoTitle}</div>
                <div style="text-align: center; padding: 30px;">
                    <a href="watch.html?id=${match.id}" class="watch-button" target="_blank">
                        <span style="font-size: 3em;">▶️</span>
                        <div style="font-size: 1.2em; font-weight: 700; margin-top: 10px;">Assistir evento</div>
                    </a>
                </div>
            </div>
        ` : '';
        
        return `
            <div class="motor-event-accordion">
                <div class="motor-event-header" onclick="MotorModal.toggleEvent(${index})">
                    <div class="motor-event-header-content">
                        <span class="motor-event-title">${LanguageManager.translateText(evt.event_type) || 'Evento'}</span>
                        <span class="motor-event-date">${Utils.formatMatchDate(evt.date)}</span>
                    </div>
                    <span class="motor-event-icon" id="icon-${index}">▼</span>
                </div>
                <div class="motor-event-content" id="content-${index}" style="display: none;">
                    ${videoHtml}
                    
                    ${(() => {
                        if (!evt.image) return '';
                        const cid = `carousel-motor-${index}-${Date.now()}`;
                        if (Array.isArray(evt.image) && evt.image.length > 1) {
                            _motorCarousels.push({ id: cid, images: evt.image });
                        }
                        return ImageCarousel.renderHTML(evt.image, cid);
                    })()}
                    
                   <div class="detail-section">
                        <div class="section-title modal-style">${LanguageManager.t('eventInfo')}</div>
                        <div class="detail-list">
                            ${tv_info}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="section-title modal-style">${LanguageManager.t('technicalInfo')}</div>
                        <div class="detail-grid technical">
                            ${tech_info}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="section-title modal-style">${LanguageManager.t('storageInfo')}</div>
                        <div class="storage-badges">
                            ${Elements.setStorageBadges(evt.technical_details?.local,evt.technical_details?.cloud)}
                        </div>
                    </div>
                    
                    ${evt.additional_info ? `
                        <div class="detail-section">
                            <div class="section-title modal-style">${LanguageManager.t('observations')}</div>
                                <div class="detail-item" style="grid-column: 1/-1;">
                                    <div class="detail-value">${evt.additional_info}</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
        
        body.innerHTML = eventsHtml;
        _motorCarousels.forEach(c => ImageCarousel.init(c.id, c.images));
        modal?.classList.add('active');
    },
    
    async fetchAndShow(id) {
        return MatchModal.fetchAndShow(id, 'motor');
    },
    toggleEvent(index) {
        const content = document.getElementById(`content-${index}`);
        const icon = document.getElementById(`icon-${index}`);
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
            icon.style.transform = 'rotate(180deg)';
        } else {
            content.style.display = 'none';
            icon.textContent = '▼';
            icon.style.transform = 'rotate(0deg)';
        }
    },
    
    close() {
        document.body.style.overflow = '';
        document.getElementById('modal').classList.remove('active');
    }
};

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
        
        if (AppState.currentView === 'cards') {
            container.innerHTML = '<div class="matches-grid" id="grid"></div>';
            const grid = document.getElementById('grid');
            AppState.filteredMatches.forEach(match => {
                const card = CONFIG.currentSport === 'motor' 
                    ? MotorCardManager.create(match) 
                    : CONFIG.currentSport === 'carnaval' 
                    ? CarnavalCardManager.create(match) 
                    : CardManager.create(match);
                grid.appendChild(card);
            });
        } else {
            container.innerHTML = '<div class="matches-list" id="list"></div>';
            const list = document.getElementById('list');
            AppState.filteredMatches.forEach(match => {
                const item = CONFIG.currentSport === 'motor'
                    ? MotorListManager.create(match)
                    : CONFIG.currentSport === 'carnaval'
                    ? ListManager.create(match)
                    : ListManager.create(match);
                list.appendChild(item);
            });
        }

        document.dispatchEvent(new CustomEvent('matchesRendered'));
    },
    updateStats(apiResponse) {
        if (AppState.matches.length === 0) return;
        document.getElementById('stats').style.display = 'flex';
        
        let pendingCount = 0, futureCount = 0;
        
        AppState.matches.forEach(match => {
            const status = Utils.getMatchStatus(match);
            if (status === 'pending') pendingCount++;
            if (status === 'future') futureCount++;
            if (match.Tamanho) {
                const size = parseFloat(match.Tamanho);
                if (!isNaN(size)) totalSize += size;
            }   
        });

        const totalGames = apiResponse?.pagination?.total_items || 
                          apiResponse?.total_registros || 
                          apiResponse?.total_records || 
                          AppState.matches.length;
        
        const totalFileSize = apiResponse?.total_size;
        const totalMinutes = apiResponse?.total_duration;
        const totalFiles = apiResponse?.total_files;
        
        document.getElementById('totalGames').textContent = totalGames;
        document.getElementById('totalFiles').textContent = totalFiles;
        document.getElementById('totalSize').textContent = pendingCount;

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
            const dateField = match.Tipo === 'motor' ? match.DataInicio : match.Data;
            const date = Utils.parseDate(dateField);
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

const FilterManager = {
    apply() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const year = document.getElementById('yearFilter').value;
        
        AppState.filteredMatches = AppState.matches.filter(match => {
            const matchesQuery = Object.values(match).some(val => String(val).toLowerCase().includes(query));
            let matchesYear = true;
            if (year) {
                const dateField = match.Tipo === 'motor' ? match.DataInicio : match.Data;
                const date = Utils.parseDate(dateField);
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

    _getImages(carouselEl) {
        const id = carouselEl.id;
        if (this._carousels[id]) return this._carousels[id];
        // fallback: re-derive from rendered src (only works for first image loaded)
        return null;
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