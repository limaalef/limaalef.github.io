const WatchPage = {
    matchId: null,
    defaultData: {
        stadium: 'Estádio não informado',
        round: 'Fase não informada',
        competition: 'Competição não informada',
        home_team: { name: 'Time Casa', goals: 0, logo: '' },
        away_team: { name: 'Time Visitante', goals: 0, logo: '' },
        date: new Date().toISOString(),
        embed_video: '',
        home_formation: '4-4-2',
        away_formation: '4-4-2',
        home_lineup: [],
        away_lineup: [],
        technical_details: {
            broadcaster: 'N/A',
            narration: 'N/A',
            origin: 'N/A',
            video_quality: 'N/A',
            audio_format: 'N/A',
            duration: 'N/A',
            file_size: 0,
            video_bitrate: 'N/A',
            local: 'N/A'
        },
        stats: {
            possession_home: 50,
            possession_away: 50,
            shots_home: 0,
            shots_away: 0,
            shots_on_target_home: 0,
            shots_on_target_away: 0,
            corners_home: 0,
            corners_away: 0,
            fouls_home: 0,
            fouls_away: 0,
            yellow_cards_home: 0,
            yellow_cards_away: 0
        },
        highlights: []
    },
    
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.matchId = urlParams.get('id');
        
        if (!this.matchId) {
            this.showError();
            return;
        }
        
        LanguageManager.init();
        this.setupTabs();
        this.loadMatchData();
    },
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                button.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    },
    
    async loadMatchData() {
        try {
            this.showLoading(true);
            
            // Buscar dados da API
            const apiUrl = `https://n12o72kc41.execute-api.sa-east-1.amazonaws.com/v1/matches?id=${this.matchId}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.data) {
                throw new Error('API retornou erro');
            }
            
            // Filtrar o jogo pelo ID
            const matchData = data.data.find(item => item.id == this.matchId);
            
            if (!matchData) {
                throw new Error('Jogo não encontrado');
            }
            
            // Mesclar dados da API com defaults
            const mergedData = this.mergeWithDefaults(matchData);
            this.renderMatchData(mergedData);
            this.showNotification(LanguageManager.t('dataLoaded') || 'Dados carregados com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showNotification('Não foi possível carregar os dados. Usando informações padrão.', 'warning');
            this.renderMatchData(this.defaultData);
        } finally {
            this.showLoading(false);
        }
    },
    
    updateMetaTags(match) {
        const competition = LanguageManager.translateText(match.competition);
        const round = LanguageManager.translateText(match.round);
        
        // Criar título dinâmico
        const pageTitle = `${match.home_team.name} vs ${match.away_team.name} - ${competition}`;
        const description = `Assista ${match.home_team.name} ${match.home_team.goals} x ${match.away_team.goals} ${match.away_team.name} - ${competition} ${round}`;
        
        // Atualizar título da página
        document.title = pageTitle + ' - Minha Coleção de Esportes';
        
        // Atualizar Open Graph
        const ogTitle = document.getElementById('og-title');
        if (ogTitle) ogTitle.setAttribute('content', pageTitle);
        
        const ogDescription = document.getElementById('og-description');
        if (ogDescription) ogDescription.setAttribute('content', description);
        
        const ogImage = document.getElementById('og-image');
        if (ogImage && match.image) {
            ogImage.setAttribute('content', match.image);
        }
        
        // Atualizar Twitter Card
        const twitterTitle = document.getElementById('twitter-title');
        if (twitterTitle) twitterTitle.setAttribute('content', pageTitle);
        
        const twitterDescription = document.getElementById('twitter-description');
        if (twitterDescription) twitterDescription.setAttribute('content', description);
        
        const twitterImage = document.getElementById('twitter-image');
        if (twitterImage && match.image) {
            twitterImage.setAttribute('content', match.image);
        }
        
        const twitterUrl = document.getElementById('twitter-url');
        if (twitterUrl) {
            twitterUrl.setAttribute('content', window.location.href);
        }
    },

    mergeWithDefaults(apiData) {
        return {
            stadium:  apiData.championship?.stadium || this.defaultData.stadium,
            round: apiData.championship?.phase || this.defaultData.round,
            competition: apiData.championship?.name || this.defaultData.competition,
            date: apiData.date || this.defaultData.date,
            home_team: {
                name: apiData.home_team?.name || this.defaultData.home_team.name,
                goals: apiData.home_team?.goals ?? this.defaultData.home_team.goals,
                logo: apiData.home_team?.logo || this.defaultData.home_team.logo
            },
            away_team: {
                name: apiData.away_team?.name || this.defaultData.away_team.name,
                goals: apiData.away_team?.goals ?? this.defaultData.away_team.goals,
                logo: apiData.away_team?.logo || this.defaultData.away_team.logo
            },
            embed_video: apiData.embed_video || this.defaultData.embed_video,
            home_formation: apiData.home_team?.formation || this.defaultData.home_formation,
            away_formation: apiData.away_team?.formation || this.defaultData.away_formation,
            home_lineup: apiData.home_team?.lineup || this.defaultData.home_lineup,
            away_lineup: apiData.away_team?.lineup || this.defaultData.away_lineup,
            technical_details: {
                broadcaster: apiData.station?.name || this.defaultData.technical_details.broadcaster,
                narration: apiData.station?.narracao || this.defaultData.technical_details.narration,
                origin: apiData.station?.origem || this.defaultData.technical_details.origin,
                video_quality: apiData.technical_details?.video_quality || this.defaultData.technical_details.video_quality,
                audio_format: apiData.technical_details?.audio_format || this.defaultData.technical_details.audio_format,
                duration: apiData.technical_details?.duration || this.defaultData.technical_details.duration,
                file_size: apiData.technical_details?.file_size || this.defaultData.technical_details.file_size,
                video_bitrate: apiData.technical_details?.video_bitrate || this.defaultData.technical_details.video_bitrate,
                local: apiData.technical_details?.local || this.defaultData.technical_details.local
            },
            stats: apiData.stats || this.defaultData.stats,
            highlights: apiData.highlights || this.defaultData.highlights,
            commentators: apiData.commentators || [],
            image: apiData.image || ''
        };
    },
    
    renderMatchData(match) {
        // Traduzir textos
        const competition = LanguageManager.translateText(match.competition);
        const round = LanguageManager.translateText(match.round);
        
        // Atualizar cabeçalho
        document.getElementById('stadium').textContent = match.stadium;
        document.getElementById('round').textContent = round;
        document.getElementById('competition').textContent = competition;
        
        // Formatar data
        const matchDate = this.parseDate(match.date);
        if (matchDate) {
            const dateStr = matchDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            document.getElementById('matchDate').textContent = dateStr;
            document.getElementById('matchTime').textContent = timeStr;
        }
        
        // Atualizar times e placar
        document.getElementById('homeTeam').textContent = match.home_team.name;
        document.getElementById('awayTeam').textContent = match.away_team.name;
        
        const homeGoals = match.home_team.goals !== null && match.home_team.goals !== undefined ? match.home_team.goals : '-';
        const awayGoals = match.away_team.goals !== null && match.away_team.goals !== undefined ? match.away_team.goals : '-';
        
        document.getElementById('homeScore').textContent = homeGoals;
        document.getElementById('awayScore').textContent = awayGoals;
        document.getElementById('homeScore-inline').textContent = homeGoals;
        document.getElementById('awayScore-inline').textContent = awayGoals;
        
        if (match.home_team.logo) {
            document.getElementById('homeLogo').src = match.home_team.logo;
            document.getElementById('homeLogo').style.display = 'block';
        } else {
            document.getElementById('homeLogo').style.display = 'none';
        }
        
        if (match.away_team.logo) {
            document.getElementById('awayLogo').src = match.away_team.logo;
            document.getElementById('awayLogo').style.display = 'block';
        } else {
            document.getElementById('awayLogo').style.display = 'none';
        }
        
        // Atualizar vídeo
        if (match.embed_video) {
            const iframe = document.getElementById('videoPlayer');
            const placeholder = iframe.nextElementSibling;
            
            iframe.src = match.embed_video;
            iframe.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        } else {
            const iframe = document.getElementById('videoPlayer');
            const placeholder = iframe.nextElementSibling;
            
            iframe.style.display = 'none';
            if (placeholder) {
                placeholder.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: var(--bg-tertiary); padding: 12px 0px">
                        <div style="text-align: center; color: var(--text-secondary);">
                            <div style="font-size: 4em; margin-bottom: 20px;">🎥</div>
                            <div style="font-size: 1.2em; font-weight: 600;">Vídeo não disponível</div>
                        </div>
                    </div>
                `;
                placeholder.style.display = 'flex';
            }
        }

        // Criar as tags de redes sociais com dados do jogo
        this.updateMetaTags(match);
        
        // Atualizar escalações
        this.renderLineup('homeLineup', match.home_lineup, match.home_formation);
        this.renderLineup('awayLineup', match.away_lineup, match.away_formation);
        
        // Atualizar detalhes técnicos
        this.renderTechnicalDetails(match.technical_details);
        
        // Atualizar estatísticas
        this.renderStats(match.stats);
        
        // Atualizar destaques
        this.renderHighlights(match.highlights);
        
        // Atualizar narração
        this.renderCommentary(match.technical_details, match.commentators);
    },
    
    renderLineup(elementId, lineup, formation) {
        const container = document.getElementById(elementId);
        const lineupColumn = container.closest('.lineup-column');
        const formationElement = lineupColumn.querySelector('.lineup-formation');
        
        if (formationElement) {
            formationElement.textContent = formation;
        }
        
        if (!lineup || lineup.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px 10px; color: var(--text-secondary);">
                    <div style="font-size: 2em; margin-bottom: 10px;">📋</div>
                    <div style="font-size: 0.9em;">Escalação não disponível</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = lineup.map(player => `
            <div class="player-item">
                <span class="player-number">${player.number || '?'}</span>
                <span class="player-name">${player.name}</span>
                <span class="player-position">${player.position || ''}</span>
            </div>
        `).join('');
    },
    
    renderTechnicalDetails(details) {
        const detailsMap = [
            { id: 'quality', icon: '🎬', value: details.video_quality },
            { id: 'audioFormat', icon: '🔊', value: LanguageManager.translateText(details.audio_format) },
            { id: 'duration', icon: '⏱️', value: details.duration },
            { id: 'fileSize', icon: '💾', value: this.formatFileSize(details.file_size) },
            { id: 'bitrate', icon: '📊', value: details.video_bitrate ? `${details.video_bitrate} Mbps` : 'N/A' },
            { id: 'storage', icon: '🗄️', value: details.local }
        ];
        
        const grid = document.querySelector('.detail-grid-watch');
        grid.innerHTML = detailsMap.map(item => `
            <div class="detail-card">
                <div class="detail-icon">${item.icon}</div>
                <div class="detail-label" data-i18n="${item.id}">${LanguageManager.t(item.id)}</div>
                <div class="detail-value">${item.value}</div>
            </div>
        `).join('');
    },
    
    renderStats(stats) {
        const statsData = [
            { label: 'possession', home: stats.possession_home || 50, away: stats.possession_away || 50, unit: '%' },
            { label: 'shots', home: stats.shots_home || 0, away: stats.shots_away || 0 },
            { label: 'shotsOnTarget', home: stats.shots_on_target_home || 0, away: stats.shots_on_target_away || 0 },
            { label: 'corners', home: stats.corners_home || 0, away: stats.corners_away || 0 },
            { label: 'fouls', home: stats.fouls_home || 0, away: stats.fouls_away || 0 },
            { label: 'yellowCards', home: stats.yellow_cards_home || 0, away: stats.yellow_cards_away || 0 }
        ];
        
        const grid = document.querySelector('.stats-grid');
        grid.innerHTML = statsData.map(stat => `
            <div class="stat-row">
                <div class="stat-home">${stat.home}${stat.unit || ''}</div>
                <div class="stat-name" data-i18n="${stat.label}">${LanguageManager.t(stat.label)}</div>
                <div class="stat-away">${stat.away}${stat.unit || ''}</div>
            </div>
        `).join('');
    },
    
    renderHighlights(highlights) {
        const container = document.querySelector('.highlights-list');
        
        if (!highlights || highlights.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                    <div style="font-size: 3em; margin-bottom: 15px;">⚽</div>
                    <div style="font-size: 1.1em; font-weight: 600;">Destaques não disponíveis</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = highlights.map(highlight => {
            const iconClass = highlight.type === 'goal' ? 'goal' : 
                            highlight.type === 'card' ? 'card' : '';
            const icon = highlight.type === 'goal' ? '⚽' : 
                        highlight.type === 'yellow_card' ? '🟨' : 
                        highlight.type === 'red_card' ? '🟥' : '📌';
            
            return `
                <div class="highlight-item">
                    <div class="highlight-time">${highlight.time || '?'}'</div>
                    <div class="highlight-icon ${iconClass}">${icon}</div>
                    <div class="highlight-text">${highlight.description || ''}</div>
                </div>
            `;
        }).join('');
    },
    
    renderCommentary(details, commentators) {
        const container = document.querySelector('.commentary-info');
        
        const narratorName = details.narration || 'N/A';
        const commentatorsList = commentators && commentators.length > 0 
            ? commentators.join(', ') 
            : 'N/A';
        const origin = details.origin || 'N/A';
        const broadcaster = details.broadcaster || 'N/A';
        
        container.innerHTML = `
            <div class="commentator-card">
                <div class="commentator-icon">🎙️</div>
                <div class="commentator-details">
                    <div class="commentator-role" data-i18n="narrator">${LanguageManager.t('narrator')}</div>
                    <div class="commentator-name">${narratorName}</div>
                </div>
            </div>
            <div class="commentator-card">
                <div class="commentator-icon">💬</div>
                <div class="commentator-details">
                    <div class="commentator-role" data-i18n="commentators">${LanguageManager.t('commentators')}</div>
                    <div class="commentator-name">${commentatorsList}</div>
                </div>
            </div>
            <div class="commentator-card">
                <div class="commentator-icon">📺</div>
                <div class="commentator-details">
                    <div class="commentator-role" data-i18n="broadcaster">${LanguageManager.t('broadcaster')}</div>
                    <div class="commentator-name">${broadcaster}</div>
                </div>
            </div>
            <div class="commentator-card">
                <div class="commentator-icon">📻</div>
                <div class="commentator-details">
                    <div class="commentator-role" data-i18n="origin">${LanguageManager.t('origin')}</div>
                    <div class="commentator-name">${origin}</div>
                </div>
            </div>
        `;
    },
    
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
            /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
            /(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/,
            /(\d{2})\/(\d{2})\/(\d{4})/
        ];
        
        for (let format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (format === formats[0] || format === formats[1]) {
                    return new Date(match[1], match[2] - 1, match[3], match[4] || 0, match[5] || 0);
                }
                if (format === formats[2]) {
                    return new Date(match[3], match[2] - 1, match[1], match[4], match[5]);
                }
                if (format === formats[3]) {
                    return new Date(match[3], match[2] - 1, match[1]);
                }
            }
        }
        
        return new Date(dateStr);
    },
    
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return 'N/A';
        const gb = bytes / (1024 * 1024 * 1024);
        return gb.toFixed(2) + ' GB';
    },
    
    showLoading(show) {
        let loadingEl = document.getElementById('loading-overlay');
        
        if (show) {
            if (!loadingEl) {
                loadingEl = document.createElement('div');
                loadingEl.id = 'loading-overlay';
                loadingEl.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    backdrop-filter: blur(5px);
                `;
                loadingEl.innerHTML = `
                    <div style="text-align: center; color: white;">
                        <div style="font-size: 4em; margin-bottom: 20px; animation: bounce 1s infinite;">⚽</div>
                        <div style="font-size: 1.3em; font-weight: 600;">Carregando dados do jogo...</div>
                    </div>
                `;
                document.body.appendChild(loadingEl);
                
                // Adicionar animação bounce
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes bounce {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-20px); }
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    },
    
    showError() {
        document.querySelector('.watch-container').innerHTML = `
            <div class="empty-state" style="padding: 100px 20px; text-align: center;">
                <h2>❌ Jogo não encontrado</h2>
                <p style="margin: 20px 0; color: var(--text-secondary); font-size: 1.1em;">O ID do jogo não foi fornecido ou é inválido.</p>
                <button onclick="window.location.href='index'" style="
                    background: var(--accent-color);
                    color: white;
                    padding: 14px 28px;
                    border: none;
                    border-radius: 10px;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 1.1em;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';">
                    ⬅️ Voltar para Coleção
                </button>
            </div>
        `;
    },
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        notification.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            background: var(--bg-secondary);
            padding: 16px 22px;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            border-left: 4px solid ${colors[type]};
            z-index: 9999;
            animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: 380px;
            font-weight: 500;
        `;
        
        notification.innerHTML = `
            <span style="font-size: 1.3em; margin-right: 12px;">${icons[type]}</span>
            <span style="color: var(--text-primary);">${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3500);
    }
};

window.addEventListener('DOMContentLoaded', () => WatchPage.init());