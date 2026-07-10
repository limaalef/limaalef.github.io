const Utils = {
    VALID_SPORTS: ['football', 'others', 'motor', 'carnaval'],

    parseDate(dateStr) {
        if (!dateStr) return null;
        const formats = [
            /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
            /(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2})/,
            /(\d{2})\/(\d{2})\/(\d{4})/,
            /(\d{4})-(\d{2})-(\d{2})/
        ];
        for (let format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (format === formats[0]) return new Date(match[1], match[2] - 1, match[3], match[4], match[5]);
                if (format === formats[1]) return new Date(match[3], match[2] - 1, match[1], match[4], match[5]);
                if (format === formats[2]) return new Date(match[3], match[2] - 1, match[1]);
                return new Date(match[1], match[2] - 1, match[3]);
            }
        }
        return new Date(dateStr);
    },
    
    formatDateTime(ts) {
        if (!ts) return '';
        try {
            const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch { return ts.slice(0, 16).replace('T', ' '); }
    },

    formatMatchDate(date) {
        if (!date) return 'N/A';
        const d = this.parseDate(date);
        if (!d || isNaN(d)) return date;
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        // Se tem horário válido (diferente de 00:00), mostra
        if (hours !== '00' || minutes !== '00') {
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        }
        
        // Se não tem horário, mostra só a data
        return `${day}/${month}/${year}`;
    },

    formatSize(size) {
        if (!size) return 'N/A';
        const bytes = parseFloat(size);
        if (isNaN(bytes)) return size;
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    },

    modeLabelName(mode) {
        const map = {
            football:   { slug: 'football', key: 'modeFootball', },
            multisport: { slug: 'others', key: 'modeMultisport' },
            motorsport: { slug: 'motor', key: 'modeMotorsport' },
            carnaval: { slug: 'carnaval', key: 'modeCarnaval' }
        };

        const modeName = LanguageManager.t(map[mode].key) || mode;
        const slug = map[mode].slug;

        return {mode, slug, modeName}
    },
    
    getMatchStatus(match) {
        const hasData = match.Mandante && match.Visitante;
        const hasScores = (match['Gols mandante'] !== undefined && match['Gols mandante'] !== '' && match['Gols mandante'] !== null) &&
                        (match['Gols visitante'] !== undefined && match['Gols visitante'] !== '' && match['Gols visitante'] !== null);
        if (match.Data) {
            const matchDate = this.parseDate(match.Data);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (matchDate > today && !hasScores) return 'future';
            if (hasData && !hasScores && (matchDate >= yesterday && matchDate <= today)) return 'pending';
        }
        return 'completed';
    },

    parseGoals(value) {
        const goalValue = value !== '' &&
                          value !== null &&
                          value !== undefined ? Math.round(parseFloat(value)) : '';
    
        return goalValue
    },

    parseWinner(homeGoalsValue, awayGoalsValue) {
        const homeGoals = Utils.parseGoals(homeGoalsValue)
        const awayGoals = Utils.parseGoals(awayGoalsValue)

        const homeWinner = homeGoals !== '' && awayGoals !== '' && homeGoals > awayGoals;
        const awayWinner = homeGoals !== '' && awayGoals !== '' && awayGoals > homeGoals;

        const hasWinner = homeWinner || awayWinner;
        const homeLoser = hasWinner && !homeWinner;
        const awayLoser = hasWinner && !awayWinner;

        return {homeGoals, homeWinner, homeLoser, awayGoals, awayWinner, awayLoser, hasWinner}
    },
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
        const icons = { success: '', error: '', warning: '⚠', info: 'ℹ' };
        notification.style.border = `1px solid ${colors[type]}`;
        
        // Tentar traduzir a mensagem se o LanguageManager estiver disponível
        const translatedMsg = window.LanguageManager ? (LanguageManager.t(message) || message) : message;
        
        notification.innerHTML = `
            <span style="font-size: 1.2em; margin-right: 10px;">${icons[type]}</span>
            <span>${translatedMsg}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOutCenter 0.25s ease forwards';

            setTimeout(() => {
                notification.remove();
            }, 250);

        }, 3000);
    },

    formatMotorDateRange(startDate, endDate) {
        if (!startDate || !endDate) return 'N/A';
        
        const start = this.parseDate(startDate);
        const end = this.parseDate(endDate);
        
        if (!start || isNaN(start) || !end || isNaN(end)) return 'N/A';
        
        const startDay = String(start.getDate()).padStart(2, '0');
        const startMonth = String(start.getMonth() + 1).padStart(2, '0');
        const startYear = start.getFullYear();
        
        const endDay = String(end.getDate()).padStart(2, '0');
        const endMonth = String(end.getMonth() + 1).padStart(2, '0');
        const endYear = end.getFullYear();
        
        // Se for a mesma data
        if (startDay === endDay && startMonth === endMonth && startYear === endYear) {
            return `${startDay}/${startMonth}/${startYear}`;
        }
        
        // Se ano e mês iguais: 10 a 11/11/2020
        if (startYear === endYear && startMonth === endMonth) {
            return `${startDay} a ${endDay}/${endMonth}/${endYear}`;
        }
        
        // Se ano igual e mês diferente: 10/10 a 11/11/2020
        if (startYear === endYear) {
            return `${startDay}/${startMonth} a ${endDay}/${endMonth}/${endYear}`;
        }
        
        // Se tudo diferente: 10/10/2020 a 01/01/2021
        return `${startDay}/${startMonth}/${startYear} a ${endDay}/${endMonth}/${endYear}`;
    },

    escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;');
    },

    parseSport(value, fallback = 'football') {
        return this.VALID_SPORTS.includes(value) ? value : fallback;
    },

    applySportTheme(sport) {
        document.body.classList.remove('theme-football', 'theme-others', 'theme-motor', 'theme-carnaval');
        document.body.classList.add(`theme-${sport}`);
    },

    getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            sport : this.parseSport(params.get('sport')),
            id    : parseInt(params.get('id'))   || 0,
            page  : parseInt(params.get('page')) || 0,
            raw   : params,
        };
    },

    emptyStateHtml(title, message) {
        return `<div class="empty-state"><h2>${title}</h2><p>${message}</p></div>`;
    },

    sectionStateHtml(icon, message) {
        return `<div class="section-state"><div class="icon">${icon}</div><p>${message}</p></div>`;
    }    
}

const Elements = {
    STATS_ORDER: [
        'ballPossession', 'goalFinish', 'wrongFinish', 'blockedFinish',
        'ballOnThePost', 'cornerKick', 'foulMade', 'offSide',
        'yellowCardReceived', 'redCardReceived', 'tackle', 'defense',
        'totalPasses', 'rightPasses', 'wrongPasses', 'penaltyReceived',
    ],

    setDetailList(list) {
        const items = list.filter(i => i.value);

        if (!items.length) return null;

        return items.map(i => `
            <div class="detail-list-item">
                <div class="detail-list-label">${LanguageManager.t(i.label)}</div>
                <div class="detail-list-value">${i.value}</div>
            </div>
        `).join('');
    },

    setDetailGrid(list) {
        const items = list.filter(i => i.value);

        if (!items.length) return null;

        return items.map(i => `
            <div class="detail-item">
                <div class="detail-label">${LanguageManager.t(i.label)}</div>
                <div class="detail-value">${i.value}</div>
            </div>
        `).join('');
    },

    setStorageBadges(local, cloud) {
        return `
            ${local ? `<span class="storage-badge badge-success">${local}</span>` : ''}
            ${cloud || String(cloud).toLowerCase() === 'nuvem' ? `<span class="storage-badge badge-info">${LanguageManager.t('cloud')}</span>` : ''}
            ${!local && (!cloud || cloud.toLowerCase() !== 'nuvem') ? `<span class="badge" style="background: var(--border-color); color: var(--text-secondary);">${LanguageManager.t('noStorage') || 'Nenhum armazenamento registrado'}</span>` : ''}
        `
    },

    getTeamColorsStyle(colors) {
        const color1 = colors.primary;
        const color2 = colors.secondary;
        const color3 = colors.tertiary;

        if (color2 === color1 || (color3 === color2 && color2 === '#000000')) {
            return `
                background-image:linear-gradient(to right,${color1} 0%,${color1} 100%);
                background-repeat:no-repeat;
                background-position:center top;
                background-size:100% 4px;
            `;
        }
        if (color3 === color2 || color3 === '#000000') {
            return `
                background-image:linear-gradient(to right,${color1} 0%,${color1} 50%,${color2} 50%,${color2} 100%);
                background-repeat:no-repeat;
                background-position:center top;
                background-size:100% 4px;
            `;
        }
        return `
            background-image:linear-gradient(to right,${color1} 0%,${color1} 33.33%,${color2} 33.33%,${color2} 66.66%,${color3} 66.66%,${color3} 100%);
            background-repeat:no-repeat;
            background-position:center top;
            background-size:100% 4px;
        `;
    },

    getTeamHeaderList(info) {
        const homeColor = info.homeTeam.colors.primary;
        const homeName  = info.homeTeam.name;
        const awayColor = info.awayTeam.colors.primary;
        const awayName  = info.awayTeam.name;

        return `<div class="plays-header-names">
            <div class="plays-header-grid">
                <span class="me-lineup-team-name plays-names"${homeColor ? ` style="color:${homeColor};${this.getTeamColorsStyle(info.homeTeam.colors)};border-right:1px solid var(--border-color);"` : ''}>
                    ${LanguageManager.t(homeName) || ''}
                </span>
                <span class="me-lineup-team-name plays-names"${awayColor ? ` style="color:${awayColor};${this.getTeamColorsStyle(info.awayTeam.colors)};"` : ''}>
                    ${LanguageManager.t(awayName) || ''}
                </span>
            </div>
        </div>`;
    },

    goalTypeBadge(type) {
        if (!type || type === 'REGULAR') return '';
        if (type === 'PENALTY')  return `<span class="goals-type-badge goals-type-penalty"  title="Pênalti">P</span>`;
        if (type === 'OWN_GOAL') return `<span class="goals-type-badge goals-type-own-goal" title="Gol contra">C</span>`;
        return '';
    },

    playTypeBadge(play) {
        switch (play) {
            case 'REGULAR_GOAL':
            case 'PENALTY':
            case 'OWN_GOAL':
                return `<span class="plays-badge plays-badge-goal" title="Gol">
                    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="var(--text-primary)" width="12px" height="12px" viewBox="0 0 122.88 122.88" version="1.1" id="Layer_1" style="enable-background:new 0 0 122.88 122.88" xml:space="preserve">
                        <style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style>
                        <g><path class="st0" d="M61.44,0c16.97,0,32.33,6.88,43.44,18c11.12,11.12,18,26.48,18,43.44c0,16.97-6.88,32.33-18,43.44 c-11.12,11.12-26.48,18-43.44,18S29.11,116,18,104.88C6.88,93.77,0,78.41,0,61.44C0,44.47,6.88,29.11,18,18 C29.11,6.88,44.47,0,61.44,0L61.44,0z M76.85,117.08L76.73,117l6.89-23.09L69.41,78.15L52.66,78L39.38,94.62l6.66,22.32l-0.15,0.1 c4.95,1.38,10.16,2.12,15.55,2.12C66.78,119.16,71.95,118.44,76.85,117.08L76.85,117.08z M12.22,91.61l24.34,0.12L49.28,75.8 l-5.26-16.12l-21.42-9.3L3.78,64.08C4.23,74.14,7.26,83.53,12.22,91.61L12.22,91.61z M16.77,24.88l7.4,22.14l19.98,8.68 l15.44-11.97V20.94L40.51,7.63c-7.52,2.93-14.28,7.39-19.89,13C19.27,21.98,17.98,23.4,16.77,24.88L16.77,24.88z M81.7,7.37 L63.3,20.77V43.7L77.8,54.91l20.81-8.92l7.18-21.49c-1.12-1.35-2.3-2.64-3.54-3.88C96.48,14.85,89.49,10.29,81.7,7.37L81.7,7.37z M119.09,64.36l-0.02,0.01L99.09,49.82l-19.81,8.49l-6.08,18.03l13.73,15.23c0.06,0.06,0.09,0.13,0.11,0.21l23.6-0.11 C115.56,83.65,118.59,74.34,119.09,64.36L119.09,64.36z"/></g>
                    </svg>
                </span>`;
            case 'YELLOW_CARD':
                return `<span class="plays-badge plays-badge-yellow" title="Cartão amarelo">
                    <svg viewBox="0 0 64 90" xmlns="http://www.w3.org/2000/svg" width="12px" height="12px" aria-label="Cartão amarelo">
                        <rect x="2" y="2" width="60" height="86" rx="8" fill="#FFD200" stroke="#E6B800" stroke-width="4"/>
                        <path d="M2 2H60L2 88Z" fill="#FFFFFF" opacity="0.15"/>
                    </svg>
                </span>`;
            case 'RED_CARD':
                return `<span class="plays-badge plays-badge-red" title="Cartão vermelho">
                    <svg viewBox="0 0 64 90" xmlns="http://www.w3.org/2000/svg" width="12px" height="12px" aria-label="Cartão vermelho">
                        <rect x="2" y="2" width="60" height="86" rx="8" fill="#E60000" stroke="#C00000" stroke-width="4"/>
                        <path d="M2 2H60L2 88Z" fill="#FFFFFF" opacity="0.15"/>
                    </svg>
                </span>`;
            default:
                return '';
        }
    },

    renderStorage(match, divId) {
        const badges = [];
        if (match.Local) badges.push(`<span class="storage-badge badge-success">${match.Local}</span>`);
        if (match.Nuvem) badges.push(`<span class="storage-badge badge-info">Cloud</span>`);
        document.getElementById(divId).innerHTML = badges.join('') ||
            '<span style="color:var(--text-tertiary);font-size:var(--font-size-md)">Nenhuma informação de storage</span>';
    },

    renderStatistics(stats, detail) {
        if (!stats || typeof stats !== 'object') return;

        const home = stats.homeTeam || {};
        const away = stats.awayTeam || {};

        const rows = this.STATS_ORDER
            .filter(key => home[key] !== undefined || away[key] !== undefined)
            .map(key => ({
                label: LanguageManager.t(key),
                home:  home[key]?.total ?? '—',
                away:  away[key]?.total ?? '—',
            }));

        if (!rows.length) return;

        const statsList = document.getElementById('meStatisticsInfo');
        statsList.innerHTML = this.getTeamHeaderList(detail);
        statsList.innerHTML += rows
            .filter(s => !(parseFloat(s.home) === 0 && parseFloat(s.away) === 0))
            .map(s => {
                const hv = parseFloat(s.home);
                const av = parseFloat(s.away);
                const total = hv + av;
                const homePct = total > 0 ? Math.round((hv / total) * 100) : 50;
                const hasBar  = !isNaN(hv) && !isNaN(av);
                let percentSignal = '';
                if (s.label.includes(' (%)')) {
                    s.label = s.label.replace(' (%)', '');
                    percentSignal = '%';
                }
                const equalZero = hv === 0 && av === 0;
                return `
                <div class="me-stat-row">
                    <div class="me-stat-center">
                        <div class="me-stat-data">
                            <span class="me-stat-value">${s.home}${percentSignal}</span>
                            <span class="me-stat-label">${s.label}</span>
                            <span class="me-stat-value">${s.away}${percentSignal}</span>
                        </div>
                        ${hasBar ? `
                        <div class="me-stat-bar">
                            <div class="me-stat-bar-home" style="background:${equalZero ? 'var(--border-color)' : detail.homeTeam.colors?.primary};width:${homePct}%"></div>
                            <div class="me-stat-bar-away" style="background:${equalZero ? 'var(--border-color)' : detail.awayTeam.colors?.primary};width:${100 - homePct}%"></div>
                        </div>` : ''}
                    </div>
                </div>`;
            }).join('');
    },

    renderPlays(detail, homeTeamAbbr) {
        const plays   = detail.plays;
        const section = document.getElementById('mePlaysSection');
        const list    = document.getElementById('mePlaysList');

        if (!plays?.length) return;

        section.style.display = 'block';

        const byPeriod = [];
        let lastPeriod = null;
        for (const goal of plays) {
            if (goal.period !== lastPeriod) {
                byPeriod.push({ type: 'period', label: goal.periodLabel });
                lastPeriod = goal.period;
            }
            byPeriod.push({ type: 'goal', data: goal });
        }

        list.innerHTML = this.getTeamHeaderList(detail);
        list.innerHTML += byPeriod.map(entry => {
            if (entry.type === 'period') {
                return `<div class="plays-period-label">${entry.label}</div>`;
            }
            const play   = entry.data;
            const isHome = play.teamAbbr === homeTeamAbbr;
            const badge  = this.goalTypeBadge(play.playType);
            const icon   = this.playTypeBadge(play.playType);
            const minute = `${play.minute}<span class="plays-minute-mark">'</span>`;
            const playerHome = `
                <span class="plays-player-name">${play.popularName || play.name || '—'}</span>
                ${badge}${icon}
            `;
            const playerAway = `
                ${icon}${badge}
                <span class="plays-player-name">${play.popularName || play.name || '—'}</span>
            `;
            return `
                <div class="plays-row">
                    <div class="plays-side plays-home ${isHome ? 'plays-side--active' : ''}">
                        ${isHome ? playerHome : ''}
                    </div>
                    <div class="plays-minute">${minute}</div>
                    <div class="plays-side plays-away ${!isHome ? 'plays-side--active' : ''}">
                        ${!isHome ? playerAway : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    buildLineupCol(team) {
        const { formation, coach, startingXI = [], substitute = [] } = team.lineup;
        const color = team.colors?.primary || null;

        const col = document.createElement('div');
        col.className = 'me-lineup-col';

        // Faixa de cores no topo da coluna — reutiliza getTeamColorsStyle
        if (team.colors) {
            col.style.cssText += this.getTeamColorsStyle(team.colors);
        }
        col.innerHTML = `
            <div class="me-lineup-team-header">
                <div class="me-lineup-team-info">
                    <div class="me-lineup-team-name"${color ? ` style="color:${color}"` : ''}>
                        ${LanguageManager.t(team.name) || ''}
                    </div>
                    ${formation ? `<div class="me-lineup-formation">${formation}</div>` : ''}
                    ${coach     ? `<div class="me-lineup-coach">${LanguageManager.t('coach')}: ${coach}</div>` : ''}
                </div>
            </div>
            ${startingXI.map(p => `
                <div class="me-player-row">
                    <span class="me-player-num">${p.shirtNumber ?? ''}</span>
                    <span class="me-player-name">${p.name || p.fullName || '—'}</span>
                    <span class="me-player-pos">${p.posSlug || ''}</span>
                </div>
            `).join('')}
            ${substitute.length ? `
                <div class="me-lineup-sub-header">
                    <button class="me-lineup-sub-label" type="button">
                        <span>${LanguageManager.t('subtitutes')}</span>
                        <span>▼</span>
                    </button>
                </div>
                <div class="me-lineup-sub-list" hidden>
                    ${substitute.map(p => `
                        <div class="me-player-row sub">
                            <span class="me-player-num">${p.shirtNumber ?? ''}</span>
                            <span class="me-player-name">${p.name || p.fullName || '—'}</span>
                            <span class="me-player-pos">${p.posSlug || ''}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;

        const toggle = col.querySelector('.me-lineup-sub-label');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const list = col.querySelector('.me-lineup-sub-list');
                const open = !list.hidden;
                list.hidden = open;
                toggle.innerHTML = `<span>${LanguageManager.t('subtitutes')}</span><span>${open ? '▼' : '▲'}</span>`;
            });
        }

        return col;
    },

    renderJudgmentItems(judgments) {
        return judgments.map(judgment => {
            const discardedIndexes = Array.isArray(judgment.discarded_indexes)
                ? judgment.discarded_indexes
                : [judgment.discarded_indexes];

            const scoresHTML = judgment.scores.map((score, index) => {
                const isDiscard = discardedIndexes.includes(index);
                return `<span class="score${isDiscard ? ' discard' : ''}">${score === 10 ? score.toFixed(1) : score}</span>`;
            }).join('');

            const validScores = judgment.scores.filter((_, i) => !discardedIndexes.includes(i));
            const partialTotal = validScores.reduce((sum, s) => sum + s, 0).toFixed(1);

            return `
            <div class="detail-list-item judgment-item">
                <div class="detail-list-label">${judgment.name}</div>
                <div class="detail-list-value judgment-values">
                    <div class="judgment-scores">${scoresHTML}</div>
                    <span class="judgment-total">${partialTotal}</span>
                </div>
            </div>`;
        }).join('');
    }
};

LanguageManager.init()