const AppState = {
    matches: [],
    filteredMatches: [],
    currentView: 'cards',
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: CONFIG.DEFAULT_ITEMS_PER_PAGE
};

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
        const status = Utils.getMatchStatus(match);
        const hasVideo = match['Video Embed'] ? 'has-video' : '';
        card.className = `match-card ${status} ${hasVideo}`;
        card.onclick = () => MatchModal.show(match);
        
        const homeGoals = match['Gols mandante'] !== '' && match['Gols mandante'] !== null && match['Gols mandante'] !== undefined ? Math.round(parseFloat(match['Gols mandante'])) : '';
        const awayGoals = match['Gols visitante'] !== '' && match['Gols visitante'] !== null && match['Gols visitante'] !== undefined ? Math.round(parseFloat(match['Gols visitante'])) : '';
        const homeWinner = homeGoals !== '' && awayGoals !== '' && homeGoals > awayGoals;
        const awayWinner = homeGoals !== '' && awayGoals !== '' && awayGoals > homeGoals;
        
        const statusText = status === 'pending' ? LanguageManager.t('pendingMatch') : '';
        const statusBadge = status === 'pending' ? `<span class="match-status">⏳ ${statusText}</span>` : '';

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
                    ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" alt="${match.Mandante}" class="team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="team-name ${homeWinner ? 'winner' : ''}">${match.Mandante || 'Time 1'}</span>
                    <span class="score ${homeWinner ? 'winner' : ''}">${homeGoals}</span>
                </div>
                <div class="team">
                    ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" alt="${match.Visitante}" class="team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="team-name ${awayWinner ? 'winner' : ''}">${match.Visitante || 'Time 2'}</span>
                    <span class="score ${awayWinner ? 'winner' : ''}">${awayGoals}</span>
                </div>
            </div>
            <div class="match-footer">
                ${match['Logo emissora'] ? `<img src="${match['Logo emissora']}" alt="${match.Emissora}" class="broadcaster-logo" onerror="this.style.display='none'">` : '<div></div>'}
                <div class="tech-badges">
                    ${match.Qualidade ? `<span class="tech-badge">${match.Qualidade}</span>` : ''}
                    <span class="tech-badge">${audioFormat}</span>
                </div>
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
        card.onclick = () => MotorModal.show(event);
        
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
                <div class="motor-phase-name">${phase || 'N/A'}</div>
            </div>
            <div class="motor-footer">
                ${event['Logo emissora'] ? `<img src="${event['Logo emissora']}" alt="Emissora" class="broadcaster-logo" onerror="this.style.display='none'">` : '<div></div>'}
                <span class="tech-badge motor-event-badge">${eventCount} ${eventLabel}</span>
            </div>
        `;
        return card;
    }
};

const ListManager = {
    create(match) {
        const item = document.createElement('div');
        const status = Utils.getMatchStatus(match);
        item.className = `list-item ${status}`;
        item.onclick = () => MatchModal.show(match);
        
        const homeGoals = match['Gols mandante'] !== '' && match['Gols mandante'] !== null && match['Gols mandante'] !== undefined ? Math.round(parseFloat(match['Gols mandante'])) : '';
        const awayGoals = match['Gols visitante'] !== '' && match['Gols visitante'] !== null && match['Gols visitante'] !== undefined ? Math.round(parseFloat(match['Gols visitante'])) : '';
        const scoreText = `${homeGoals} x ${awayGoals}`;
        
        const statusText = LanguageManager.t('pendingMatch');
        const statusBadge = status === 'pending' ? `<span class="badge badge-warning" style="font-size: 0.7em; margin-left: 8px;">${statusText}</span>` : '';

        const competition = LanguageManager.translateText(match.Competição);
        const phase = LanguageManager.translateText(match.Fase);

        item.innerHTML = `
            <div><strong>${Utils.formatDate(match.Data, true)}</strong></div>
            <div>
                <strong>${match.Mandante} ${scoreText} ${match.Visitante}</strong> ${statusBadge}
                <div style="color: var(--text-secondary); font-size: 0.85em; margin-top: 4px;">
                    ${competition} - ${phase}
                </div>
            </div>
            <div style="text-align: center; font-size: 0.85em;">${match.Qualidade || 'N/A'}</div>
            <div style="text-align: right;">
                ${match['Logo emissora'] ? `<img src="${match['Logo emissora']}" alt="${match.Emissora}" class="broadcaster-logo" onerror="this.style.display='none'">` : `<span style="font-size: 0.85em; color: var(--text-secondary);">${match.Emissora || 'N/A'}</span>`}
            </div>
        `;
        return item;
    }
};

const MotorListManager = {
    create(event) {
        const item = document.createElement('div');
        item.className = 'list-item motor-event';
        item.onclick = () => MotorModal.show(event);
        
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
                ${event['Logo emissora'] ? `<img src="${event['Logo emissora']}" alt="Emissora" class="broadcaster-logo" onerror="this.style.display='none'">` : `<span style="font-size: 0.85em; color: var(--text-secondary);">N/A</span>`}
            </div>
        `;
        return item;
    }
};

const MatchModal = {
    show(match) {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body = document.getElementById('modalBody');
        const status = Utils.getMatchStatus(match);
        
        const competition = LanguageManager.translateText(match.Competição);
        const phase = LanguageManager.translateText(match.Fase);
        
        title.innerHTML = `
            <div class="modal-title-competition">${competition}</div>
            <div class="modal-title-phase">${phase}</div>
        `;
        
        const homeGoals = match['Gols mandante'] !== '' && match['Gols mandante'] !== null && match['Gols mandante'] !== undefined ? Math.round(parseFloat(match['Gols mandante'])) : '';
        const awayGoals = match['Gols visitante'] !== '' && match['Gols visitante'] !== null && match['Gols visitante'] !== undefined ? Math.round(parseFloat(match['Gols visitante'])) : '';

        const embed = match['Video Embed'];
        
        // ADICIONAR: HTML do vídeo embed (se existir)
        const videoHtml = match['Video Embed'] ? `
            <div class="watch-button-container">
                <a href="watch?id=${match.ID}" class="watch-match-button">
                    <span class="watch-match-text">${LanguageManager.t('watchMatch') || 'Assistir Jogo'}</span>
                </a>
            </div>
        ` : '';
        
        let scoreHtml = '';
        if (status === 'pending') {
            const pendingText = LanguageManager.t('pendingMatch');
            scoreHtml = `
                <div class="score-desktop">
                    <span class="score-team-name">${match.Mandante}</span>
                    ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" alt="${match.Mandante}" class="score-team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="score-value">${homeGoals} x ${awayGoals}</span>
                    ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" alt="${match.Visitante}" class="score-team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="score-team-name">${match.Visitante}</span>
                    <span class="badge badge-warning score-status-badge">⏳ ${pendingText}</span>
                </div>
                <div class="score-mobile">
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" alt="${match.Mandante}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                            <span class="score-team-name">${match.Mandante}</span>
                        </div>
                        <span class="score-mobile-value">${homeGoals}</span>
                    </div>
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" alt="${match.Visitante}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                            <span class="score-team-name">${match.Visitante}</span>
                        </div>
                        <span class="score-mobile-value">${awayGoals}</span>
                    </div>
                    <div class="score-mobile-status">
                        <span class="badge badge-warning">⏳ ${pendingText}</span>
                    </div>
                </div>
            `;
        } else {
            scoreHtml = `
                <div class="score-desktop">
                    <span class="score-team-name">${match.Mandante}</span>
                    ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" alt="${match.Mandante}" class="score-team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="score-value">${homeGoals} x ${awayGoals}</span>
                    ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" alt="${match.Visitante}" class="score-team-logo" onerror="this.style.display='none'">` : ''}
                    <span class="score-team-name">${match.Visitante}</span>
                </div>
                <div class="score-mobile">
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" alt="${match.Mandante}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                            <span class="score-team-name">${match.Mandante}</span>
                        </div>
                        <span class="score-mobile-value">${homeGoals}</span>
                    </div>
                    <div class="score-mobile-row">
                        <div class="score-mobile-team">
                            ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" alt="${match.Visitante}" class="score-mobile-logo" onerror="this.style.display='none'">` : ''}
                            <span class="score-team-name">${match.Visitante}</span>
                        </div>
                        <span class="score-mobile-value">${awayGoals}</span>
                    </div>
                </div>
                ${videoHtml}
            `;
        }
        
        score.innerHTML = scoreHtml;
        
        const audioFormat = LanguageManager.translateText(match['Formato de áudio']);

        const matchInfoTitle = LanguageManager.t('matchInfo');
        const technicalInfoTitle = LanguageManager.t('technicalInfo');
        const storageTitle = LanguageManager.t('storageInfo');
        const observationsTitle = LanguageManager.t('observations');
        const videoTitle = LanguageManager.t('video') || 'Vídeo';
        const imageTitle = LanguageManager.t('image') || 'Imagem';
        
        
        body.innerHTML = `
            ${match.Imagem ? `<img src="${match.Imagem}" alt="Imagem da partida" class="modal-image" onerror="this.style.display='none'">` : ''}
            
            <div class="detail-section">
                <div class="section-title">${matchInfoTitle}</div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">ID</div>
                        <div class="detail-value">${match.ID || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('date')}</div>
                        <div class="detail-value">${Utils.formatDate(match.Data)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('competition')}</div>
                        <div class="detail-value">${competition || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('phase')}</div>
                        <div class="detail-value">${phase || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('type')}</div>
                        <div class="detail-value">${match.Tipo || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('broadcaster')}</div>
                        <div class="detail-value">${match.Emissora || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('origin')}</div>
                        <div class="detail-value">${match.Origem || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('narration')}</div>
                        <div class="detail-value">${match.Narração || 'N/A'}</div>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <div class="section-title">${technicalInfoTitle}</div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('quality')}</div>
                        <div class="detail-value">${match.Qualidade || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('audioFormat')}</div>
                        <div class="detail-value">${audioFormat}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('bitrate')}</div>
                        <div class="detail-value">${match.Bitrate ? match.Bitrate + ' Mbps' : 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('duration')}</div>
                        <div class="detail-value">${match.Duração || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">${LanguageManager.t('fileSize')}</div>
                        <div class="detail-value">${Utils.formatSize(match.Tamanho)}</div>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <div class="section-title">${storageTitle}</div>
                <div class="storage-badges">
                    ${match.Local ? `<span class="badge badge-success">💾 ${match.Local}</span>` : ''}
                    ${match.Nuvem && match.Nuvem.toLowerCase() === 'nuvem' ? `<span class="badge badge-info">☁️ ${LanguageManager.t('cloud')}</span>` : ''}
                    ${!match.Local && (!match.Nuvem || match.Nuvem.toLowerCase() !== 'nuvem') ? `<span class="badge" style="background: var(--border-color); color: var(--text-secondary);">${LanguageManager.t('noStorage') || 'Nenhum armazenamento registrado'}</span>` : ''}
                </div>
            </div>
            
            ${match.Obs ? `
                <div class="detail-section">
                    <div class="section-title">${observationsTitle}</div>
                    <div class="detail-item" style="grid-column: 1/-1;">
                        <div class="detail-value">${match.Obs}</div>
                    </div>
                </div>
            ` : ''}
        `;
        
        modal.classList.add('active');
    },
    close() {
        document.getElementById('modal').classList.remove('active');
    }
};

const MotorModal = {
    show(event) {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body = document.getElementById('modalBody');
        
        const competition = LanguageManager.translateText(event.Campeonato);
        const phase = LanguageManager.translateText(event.Fase);
        
        title.innerHTML = `
            <div class="modal-title-competition">${competition}</div>
            <div class="modal-title-phase">${phase}</div>
        `;
        
        const startDate = Utils.formatDate(event.DataInicio);
        const endDate = Utils.formatDate(event.DataFim);
        const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
        
        score.innerHTML = `<div style="text-align: center; font-weight: 600;">${dateRange}</div>`;
        
        const eventsHtml = (event.Eventos || []).map((evt, index) => {
        const videoTitle = LanguageManager.t('video') || 'Vídeo';
        const videoHtml = event['Video Embed'] ? `
            <div class="detail-section">
                <div class="section-title">${videoTitle}</div>
                <div style="text-align: center; padding: 30px;">
                    <a href="watch?id=${match.ID}" class="watch-button" target="_blank">
                        <span style="font-size: 3em;">▶️</span>
                        <div style="font-size: 1.2em; font-weight: 700; margin-top: 10px;">Assistir Jogo</div>
                    </a>
                </div>
            </div>
        ` : '';
        
        return `
            <div class="motor-event-accordion">
                <div class="motor-event-header" onclick="MotorModal.toggleEvent(${index})">
                    <div class="motor-event-header-content">
                        <span class="motor-event-title">${LanguageManager.translateText(evt.event_type) || 'Evento'}</span>
                        <span class="motor-event-date">${Utils.formatDate(evt.date)}</span>
                    </div>
                    <span class="motor-event-icon" id="icon-${index}">▼</span>
                </div>
                <div class="motor-event-content" id="content-${index}" style="display: none;">
                    ${videoHtml}
                    
                    ${evt.image ? `<img src="${evt.image}" alt="${evt.event_type}" class="modal-image" onerror="this.style.display='none'">` : ''}
                    
                   <div class="detail-section">
                        <div class="section-title">${LanguageManager.t('matchInfo')}</div>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('date')}</div>
                                <div class="detail-value">${Utils.formatDate(evt.date)}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('broadcaster')}</div>
                                <div class="detail-value">${evt.station?.name || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('origin')}</div>
                                <div class="detail-value">${evt.station?.origem || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('narration')}</div>
                                <div class="detail-value">${evt.station?.narracao || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="section-title">${LanguageManager.t('technicalInfo')}</div>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('quality')}</div>
                                <div class="detail-value">${evt.technical_details?.video_quality || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('audioFormat')}</div>
                                <div class="detail-value">${LanguageManager.translateText(evt.technical_details?.audio_format || 'N/A')}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('bitrate')}</div>
                                <div class="detail-value">${evt.technical_details?.video_bitrate ? evt.technical_details.video_bitrate + ' Mbps' : 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('duration')}</div>
                                <div class="detail-value">${evt.technical_details?.duration || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">${LanguageManager.t('fileSize')}</div>
                                <div class="detail-value">${Utils.formatSize(evt.technical_details?.file_size)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <div class="section-title">${LanguageManager.t('storageInfo')}</div>
                        <div class="storage-badges">
                            ${evt.technical_details?.local ? `<span class="badge badge-success">💾 ${evt.technical_details.local}</span>` : ''}
                            ${evt.technical_details?.cloud ? `<span class="badge badge-info">☁️ ${LanguageManager.t('cloud')}</span>` : ''}
                            ${!evt.technical_details?.local && !evt.technical_details?.cloud ? `<span class="badge" style="background: var(--border-color); color: var(--text-secondary);">${LanguageManager.t('noStorage') || 'Nenhum armazenamento'}</span>` : ''}
                        </div>
                    </div>
                    
                    ${evt.additional_info ? `
                        <div class="detail-section">
                            <div class="section-title">${LanguageManager.t('observations')}</div>
                            <div class="detail-item" style="grid-column: 1/-1;">
                                <div class="detail-value">${evt.additional_info}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
        
        body.innerHTML = eventsHtml;
        modal.classList.add('active');
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
                const card = match.Tipo === 'motor' 
                    ? MotorCardManager.create(match) 
                    : CardManager.create(match);
                grid.appendChild(card);
            });
        } else {
            container.innerHTML = '<div class="matches-list" id="list"></div>';
            const list = document.getElementById('list');
            AppState.filteredMatches.forEach(match => {
                const item = match.Tipo === 'motor'
                    ? MotorListManager.create(match)
                    : ListManager.create(match);
                list.appendChild(item);
            });
        }
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
        
        document.getElementById('totalGames').textContent = totalGames;
        document.getElementById('pendingGames').textContent = pendingCount;
        document.getElementById('futureGames').textContent = futureCount;
        document.getElementById('totalSize').textContent = pendingCount;
        document.getElementById('futureGames').textContent = futureCount;

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
        const allYearsText = LanguageManager.t('allYears');
        yearFilter.innerHTML = `<option value="" data-i18n="allYears">${allYearsText}</option>`;
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

