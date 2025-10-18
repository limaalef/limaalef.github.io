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
        
        // Usar LanguageManager para atualizar texto
        LanguageManager.updatePageInfo();
        
        document.getElementById('firstPage').disabled = AppState.currentPage === 1;
        document.getElementById('prevPage').disabled = AppState.currentPage === 1;
        document.getElementById('nextPage').disabled = AppState.currentPage === AppState.totalPages;
        document.getElementById('lastPage').disabled = AppState.currentPage === AppState.totalPages;
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
        card.className = `match-card ${status}`;
        card.onclick = () => MatchModal.show(match);
        
        const homeGoals = match['Gols mandante'] !== '' && match['Gols mandante'] !== null && match['Gols mandante'] !== undefined ? Math.round(parseFloat(match['Gols mandante'])) : '';
        const awayGoals = match['Gols visitante'] !== '' && match['Gols visitante'] !== null && match['Gols visitante'] !== undefined ? Math.round(parseFloat(match['Gols visitante'])) : '';
        const homeWinner = homeGoals !== '' && awayGoals !== '' && homeGoals > awayGoals;
        const awayWinner = homeGoals !== '' && awayGoals !== '' && awayGoals > homeGoals;
        
        // Usar tradução para status
        const statusText = status === 'pending' ? LanguageManager.t('pendingMatch') : '';
        const statusBadge = status === 'pending' ? `<span class="match-status">⏳ ${statusText}</span>` : '';
        
        const competition = LanguageManager.translateText(match.Competição);
        const phase = LanguageManager.translateText(match.Fase);
        const audioFormat = LanguageManager.translateText(match['Formato de áudio']);
        
        card.innerHTML = `
            ${statusBadge}
            <div class="match-header">
                <span class="match-date">${Utils.formatDate(match.Data)}</span>
                ${competition ? `<span class="match-competition">${competition}</span>` : ''}
            </div>
            <div class="match-phase">${phase || ''}</div>
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

const ListManager = {
    create(match) {
        const item = document.createElement('div');
        const status = Utils.getMatchStatus(match);
        item.className = `list-item ${status}`;
        item.onclick = () => MatchModal.show(match);
        
        const homeGoals = match['Gols mandante'] !== '' && match['Gols mandante'] !== null && match['Gols mandante'] !== undefined ? Math.round(parseFloat(match['Gols mandante'])) : '';
        const awayGoals = match['Gols visitante'] !== '' && match['Gols visitante'] !== null && match['Gols visitante'] !== undefined ? Math.round(parseFloat(match['Gols visitante'])) : '';
        const scoreText = `${homeGoals} x ${awayGoals}`;
        
        // Usar tradução para status
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

const MatchModal = {
    show(match) {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modalTitle');
        const score = document.getElementById('modalScore');
        const body = document.getElementById('modalBody');
        const status = Utils.getMatchStatus(match);
        
        title.textContent = `${match.Competição} - ${match.Fase}`;
        
        const homeGoals = match['Gols mandante'] !== '' && match['Gols mandante'] !== null && match['Gols mandante'] !== undefined ? Math.round(parseFloat(match['Gols mandante'])) : '';
        const awayGoals = match['Gols visitante'] !== '' && match['Gols visitante'] !== null && match['Gols visitante'] !== undefined ? Math.round(parseFloat(match['Gols visitante'])) : '';
        
        const competition = LanguageManager.translateText(match.Competição);
        const phase = LanguageManager.translateText(match.Fase);
        title.textContent = `${competition} - ${phase}`;
        
        let scoreText = '';
        if (status === 'pending') {
            const pendingText = LanguageManager.t('pendingMatch');
            scoreText = `${match.Mandante} ${homeGoals} x ${awayGoals} ${match.Visitante} <span class="badge badge-warning" style="margin-left: 15px;">⏳ ${pendingText}</span>`;
        } else if (status === 'future') {
            const futureText = LanguageManager.t('futureMatch');
            scoreText = `${match.Mandante} vs ${match.Visitante} <span class="badge badge-success" style="margin-left: 15px;">📅 ${futureText}</span>`;
        } else {
            scoreText = `${match.Mandante} ${homeGoals} x ${awayGoals} ${match.Visitante}`;
        }
        
        score.innerHTML = scoreText;
        
        const audioFormat = match['Formato de áudio'];
        
        // Usar traduções nos títulos das seções
        const matchInfoTitle = LanguageManager.t('matchInfo') || 'Informações da Partida';
        const technicalInfoTitle = LanguageManager.t('technicalInfo') || 'Especificações Técnicas';
        const storageTitle = LanguageManager.t('storageInfo') || 'Armazenamento';
        const observationsTitle = LanguageManager.t('observations') || 'Observações';
        
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
            AppState.filteredMatches.forEach(match => grid.appendChild(CardManager.create(match)));
        } else {
            container.innerHTML = '<div class="matches-list" id="list"></div>';
            const list = document.getElementById('list');
            AppState.filteredMatches.forEach(match => list.appendChild(ListManager.create(match)));
        }
    },
    
    updateStats(apiResponse) {
        if (AppState.matches.length === 0) return;
        document.getElementById('stats').style.display = 'flex';
        
        let pendingCount = 0, futureCount = 0, totalSize = 0, totalMinutes = 0;
        
        AppState.matches.forEach(match => {
            const status = Utils.getMatchStatus(match);
            if (status === 'pending') pendingCount++;
            if (status === 'future') futureCount++;
            if (match.Tamanho) {
                const size = parseFloat(match.Tamanho);
                if (!isNaN(size)) totalSize += size;
            }
            if (match.Duração) {
                const duration = String(match.Duração);
                const parts = duration.match(/(\d+)/g);
                if (parts && parts.length >= 2) {
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parseInt(parts[1]) || 0;
                    const seconds = parseInt(parts[2]) || 0;
                    totalMinutes += hours * 60 + minutes + (seconds / 60);
                }
            }
        });

        const totalGames = apiResponse?.pagination?.total_items || 
                          apiResponse?.total_registros || 
                          apiResponse?.total_records || 
                          AppState.matches.length;
        
        document.getElementById('totalGames').textContent = totalGames;
        document.getElementById('pendingGames').textContent = pendingCount;
        document.getElementById('futureGames').textContent = futureCount;
        document.getElementById('totalSize').textContent = (totalSize / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
        
        if (apiResponse && apiResponse.total_hours) {
            document.getElementById('totalDuration').textContent = Math.round(apiResponse.total_hours) + 'h';
        } else {
            document.getElementById('totalDuration').textContent = Math.round(totalMinutes / 60) + 'h';
        }
    },
    
    populateYearFilter() {
        const years = new Set();
        AppState.matches.forEach(match => {
            const date = Utils.parseDate(match.Data);
            if (date) years.add(date.getFullYear());
        });
        const yearFilter = document.getElementById('yearFilter');
        
        // Usar tradução para "Todos os anos"
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
                const date = Utils.parseDate(match.Data);
                matchesYear = date && date.getFullYear().toString() === year;
            }
            return matchesQuery && matchesYear;
        });
        Renderer.render();
    }
};