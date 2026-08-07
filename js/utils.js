const Utils = {
    VALID_SPORTS: ['football', 'multisport', 'motor', 'carnaval'],

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
            const d = new Date(ts + (ts.endsWith('Z') ? '' : ''));
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
            multisport: { slug: 'multisport', key: 'modeMultisport' },
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
        document.body.classList.remove('theme-football', 'theme-multisport', 'theme-motor', 'theme-carnaval');
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

const STATS_ORDER = [
        'ballPossession', 'goalFinish', 'wrongFinish', 'blockedFinish',
        'ballOnThePost', 'cornerKick', 'foulMade', 'offSide',
        'yellowCardReceived', 'redCardReceived', 'tackle', 'defense',
        'totalPasses', 'rightPasses', 'wrongPasses', 'penaltyReceived',
    ];

const Elements = {
    // Tags pré-definidas (detectadas no campo Obs)
    TAG_RULES: [
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
    ],

    setDetailList(list) {
        const items = list.filter(i => i.value);

        if (!items.length) return null;

        return items.map(i => `
            <div class="detail-list-item ${i.noNewLine === true ? 'no-new-line' : '' }">
                ${i.progressBar === true ? `
                    <div class="detail-list-progress-bar">
                        <div style="height:100%; width:${i.value}%; background:var(--accent-color); border-radius:3px;"></div>
                    </div>
                    <div class="detail-list-progress-bar-value">${i.label}</div>`: 
                    `<div class="detail-list-label">
                        ${i.svg || ''}
                        ${LanguageManager.t(i.label)}
                    </div>
                    <div class="detail-list-value ${i.smallColored ? '" style="color:' + i.smallColored + ';font-size:var(--font-size-xs);font-weight: 400;margin-top:-0.25rem' : ''}">${i.value}</div>` }
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

        if (color2 === null && color3 === null) {
            return `
                background-image:linear-gradient(to right,${color1} 0%,${color1} 100%);
                background-repeat:no-repeat;
                background-position:center top;
                background-size:100% 4px;
            `;
        }
        if (color3 === null) {
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
        const homeColor = info.home_team?.colors?.primary;
        const homeName  = info.home_team?.name;
        const awayColor = info.away_team?.colors?.primary;
        const awayName  = info.away_team.name;

        return `<div class="plays-header-names">
            <div class="plays-header-grid">
                <span class="me-lineup-team-name plays-names"${homeColor ? ` style="color:${homeColor};${this.getTeamColorsStyle(info.home_team.colors)};border-right:1px solid var(--border-color);"` : ''}>
                    ${LanguageManager.t(homeName) || ''}
                </span>
                <span class="me-lineup-team-name plays-names"${awayColor ? ` style="color:${awayColor};${this.getTeamColorsStyle(info.away_team.colors)};"` : ''}>
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

    renderImages(match, dir = null, containerId = 'image-carousel') {
        const carouselId = `carousel-match-${match.id || match.ID || Date.now()}`;

        let images = match.Imagem || match.media?.image;

        if (dir) {
            const prefix = img => img.startsWith(dir) ? CONFIG.IMAGE_CONTENT_URL + img : CONFIG.IMAGE_CONTENT_URL + dir + img;

            if (typeof images === "string") {
                images = prefix(images);
            } else if (Array.isArray(images)) {
                images = images.map(prefix);
            }
        }

        const html = images
            ? ImageCarousel.renderHTML(images, carouselId)
            : '';

        // Só atualiza o DOM se existir um container
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = html;

                if (Array.isArray(images) && images.length > 1) {
                    ImageCarousel.init(carouselId, images);
                }
            }
        }

        return { html, images, carouselId };
    },

    renderTvInfo(match, divId = true, showType = true) {
        const rows = [
            { label: 'broadcaster', value: match.station?.name,                           svg: '<svg viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.0254 8.40554C20.7987 8.20998 20.5218 8.09678 20.3141 8.02584C20.0833 7.94703 19.8184 7.88184 19.5383 7.82624C18.9764 7.71473 18.2727 7.62624 17.4908 7.55704C15.9221 7.41822 13.955 7.34998 12 7.34998C10.045 7.34997 8.0779 7.41821 6.50923 7.55704C5.7273 7.62623 5.02357 7.71473 4.46174 7.82624C4.18161 7.88184 3.91672 7.94703 3.68594 8.02583C3.4782 8.09677 3.20126 8.20998 2.97462 8.40553C2.76112 8.58976 2.63916 8.81815 2.56971 8.97159C2.49263 9.14189 2.43333 9.32752 2.38581 9.50895C2.29052 9.87283 2.21854 10.3144 2.16365 10.7872C2.05319 11.7386 2 12.9242 2 14.1032C2 15.283 2.05326 16.4858 2.16311 17.4726C2.21784 17.9643 2.28883 18.4229 2.38053 18.807C2.46043 19.1416 2.59126 19.5854 2.85131 19.906C3.08981 20.2 3.43086 20.3352 3.60561 20.3981C3.82965 20.4789 4.09015 20.5429 4.36115 20.596C4.90739 20.703 5.60964 20.7873 6.39637 20.853C7.97657 20.9851 9.99449 21.05 12 21.05C14.0055 21.05 16.0234 20.9851 17.6036 20.853C18.3904 20.7873 19.0926 20.703 19.6388 20.596C19.9098 20.5429 20.1703 20.4789 20.3944 20.3981C20.5691 20.3352 20.9102 20.2 21.1487 19.906C21.4087 19.5854 21.5396 19.1416 21.6195 18.807C21.7112 18.4229 21.7822 17.9643 21.8369 17.4726C21.9467 16.4858 22 15.283 22 14.1032C22 12.9242 21.9468 11.7386 21.8363 10.7872C21.7815 10.3144 21.7095 9.87284 21.6142 9.50896C21.5667 9.32752 21.5074 9.14189 21.4303 8.9716C21.3608 8.81815 21.2389 8.58976 21.0254 8.40554Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="11.4858" y1="6.44995" x2="8.39999" y2="3.36416" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="-1" x2="5.36396" y2="-1" transform="matrix(0.707107 -0.707107 -0.707107 -0.707107 11.1 6.44995)" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
            { label: 'narration',   value: match.station?.commentary,                     svg: '<svg viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 10V12C19 15.866 15.866 19 12 19M5 10V12C5 15.866 8.13401 19 12 19M12 19V22M8 22H16M12 15C10.3431 15 9 13.6569 9 12V5C9 3.34315 10.3431 2 12 2C13.6569 2 15 3.34315 15 5V12C15 13.6569 13.6569 15 12 15Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
            { label: 'origin',      value: LanguageManager.t(match.station?.source_type), svg: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentcolor" class="cf-icon-svg"><path d="M13.27 14.91a.554.554 0 0 1-.392-.946 6.201 6.201 0 1 0-8.763 0 .554.554 0 1 1-.784.784 7.31 7.31 0 1 1 10.331 0 .55.55 0 0 1-.392.162zm-2.16-2.159a.554.554 0 0 1-.392-.946 3.142 3.142 0 1 0-4.444 0 .554.554 0 0 1-.783.784 4.25 4.25 0 1 1 6.011 0 .553.553 0 0 1-.391.162zm-1.117 3.32H9.05V10.99a1.511 1.511 0 1 0-1.108 0v5.081H7a.554.554 0 0 0 0 1.109h2.993a.554.554 0 0 0 0-1.109z"/></svg>' },
            ...(showType ? [{ label: 'type',        value: LanguageManager.t(match.type) }] : []),
        ];
        
        const result = this.setDetailList(rows);
        
        if (!divId) {
            return result;
        } else {
            document.getElementById(divId).innerHTML = result;
        }
    },

    renderTechInfo(match, divId) {
        const items = [
            { label: 'ID',          value: match.id,                                            svg: '<svg viewBox="0 0 512 532" fill="currentcolor" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><g><g><g><path d="M362.669,42.671h-50.815l5.896-11.793c5.269-10.538,0.998-23.353-9.541-28.622s-23.353-0.998-28.622,9.541 l-15.437,30.874h-16.297l-15.437-30.874c-5.269-10.538-18.083-14.81-28.622-9.541s-14.81,18.083-9.541,28.622l5.896,11.793 h-50.815c-35.355,0-64,28.645-64,64v341.333c0,35.355,28.645,64,64,64h213.333c35.355,0,64-28.645,64-64V106.671 C426.669,71.316,398.024,42.671,362.669,42.671z M384.002,448.005c0,11.791-9.542,21.333-21.333,21.333H149.336 c-11.791,0-21.333-9.542-21.333-21.333V106.671c0-11.791,9.542-21.333,21.333-21.333h72.149l15.437,30.874 c0.071,0.143,0.159,0.272,0.233,0.413c0.19,0.36,0.39,0.713,0.6,1.062c0.159,0.263,0.32,0.523,0.489,0.777 c0.214,0.323,0.439,0.637,0.671,0.949c0.193,0.26,0.388,0.516,0.592,0.765c0.23,0.281,0.471,0.554,0.716,0.824 c0.231,0.254,0.463,0.505,0.704,0.746c0.242,0.242,0.493,0.474,0.748,0.706c0.27,0.245,0.542,0.485,0.823,0.715 c0.249,0.204,0.506,0.399,0.766,0.593c0.311,0.232,0.625,0.456,0.948,0.67c0.255,0.169,0.515,0.331,0.779,0.49 c0.348,0.21,0.701,0.409,1.06,0.599c0.141,0.074,0.27,0.162,0.414,0.234c0.135,0.068,0.275,0.116,0.411,0.18 c0.35,0.166,0.704,0.319,1.062,0.465c0.315,0.129,0.629,0.254,0.947,0.367c0.316,0.112,0.635,0.212,0.956,0.309 c0.361,0.109,0.721,0.215,1.083,0.305c0.293,0.072,0.589,0.131,0.885,0.19c0.385,0.077,0.768,0.153,1.154,0.208 c0.302,0.044,0.605,0.072,0.908,0.103c0.374,0.038,0.747,0.075,1.121,0.092c0.337,0.016,0.675,0.015,1.014,0.015 c0.339,0,0.676,0.001,1.013-0.015c0.374-0.018,0.747-0.055,1.121-0.092c0.304-0.031,0.607-0.059,0.908-0.103 c0.386-0.056,0.769-0.131,1.154-0.208c0.296-0.06,0.592-0.118,0.885-0.191c0.363-0.089,0.723-0.195,1.083-0.304 c0.321-0.097,0.641-0.197,0.957-0.309c0.317-0.113,0.632-0.237,0.946-0.366c0.358-0.146,0.712-0.3,1.062-0.466 c0.136-0.064,0.275-0.112,0.41-0.18c0.143-0.072,0.272-0.159,0.413-0.233c0.359-0.189,0.712-0.389,1.061-0.599 c0.264-0.159,0.523-0.32,0.778-0.489c0.323-0.214,0.637-0.439,0.949-0.67c0.26-0.193,0.516-0.388,0.765-0.592 c0.281-0.23,0.554-0.471,0.824-0.716c0.254-0.231,0.505-0.463,0.747-0.704c0.242-0.242,0.474-0.493,0.705-0.747 c0.245-0.27,0.485-0.542,0.715-0.823c0.204-0.249,0.399-0.506,0.592-0.766c0.232-0.311,0.456-0.626,0.67-0.949 c0.169-0.254,0.33-0.514,0.489-0.778c0.21-0.349,0.41-0.702,0.599-1.061c0.074-0.141,0.162-0.27,0.233-0.413l15.437-30.874 h72.149c11.791,0,21.333,9.542,21.333,21.333V448.005z"/><path d="M320.002,149.338h-128c-11.782,0-21.333,9.551-21.333,21.333c0,11.782,9.551,21.333,21.333,21.333h128 c11.782,0,21.333-9.551,21.333-21.333C341.336,158.889,331.784,149.338,320.002,149.338z"/></g></g></g></svg>' },
            { label: 'quality',     value: match.technical_details?.video_quality,               svg: '<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 5V19M17 5V19M3 8H7M17 8H21M3 16H7M17 16H21M3 12H7M17 12H21M6.2 20H17.8C18.9201 20 19.4802 20 19.908 19.782C20.2843 19.5903 20.5903 19.2843 20.782 18.908C21 18.4802 21 17.9201 21 16.8V7.2C21 6.0799 21 5.51984 20.782 5.09202C20.5903 4.71569 20.2843 4.40973 19.908 4.21799C19.4802 4 18.9201 4 17.8 4H6.2C5.0799 4 4.51984 4 4.09202 4.21799C3.71569 4.40973 3.40973 4.71569 3.21799 5.09202C3 5.51984 3 6.07989 3 7.2V16.8C3 17.9201 3 18.4802 3.21799 18.908C3.40973 19.2843 3.71569 19.5903 4.09202 19.782C4.51984 20 5.07989 20 6.2 20Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
            { label: 'audioFormat', value: match.technical_details?.audio_format, svg: '<svg viewBox="0 0 22 22" id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg"><polyline class="cls-1" points="23.45 11.04 21.55 11.04 18.68 17.73 17.73 17.73 17.73 6.27 16.77 6.27 12.96 22.5 12 22.5 12 1.5 11.04 1.5 7.23 17.73 6.27 17.73 6.27 6.27 6.27 6.27 5.32 6.27 2.46 11.04 0.55 11.04"  stroke="currentcolor" stroke-width="2" stroke-linecap="round"/></svg>' },
            { label: 'bitrate',     value: (match.technical_details?.video_bitrate + ' Mbps'),   svg: '<svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 11V8.5C17 7.67157 16.3284 7 15.5 7H5.5C4.67157 7 4 7.67157 4 8.5V16.5C4 17.3284 4.67157 18 5.5 18H15.5C16.3284 18 17 17.3284 17 16.5V14.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round"/><path d="M17 11L20.2764 9.3618C20.6088 9.19558 21 9.43733 21 9.80902V15.2785C21 15.6276 20.6513 15.8692 20.3244 15.7467L17 14.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round"/></svg>' },
            { label: 'duration',    value: match.technical_details?.duration,                    svg: '<svg viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12ZM3.00683 12C3.00683 16.9668 7.03321 20.9932 12 20.9932C16.9668 20.9932 20.9932 16.9668 20.9932 12C20.9932 7.03321 16.9668 3.00683 12 3.00683C7.03321 3.00683 3.00683 7.03321 3.00683 12Z" fill="currentcolor"/><path d="M12 5C11.4477 5 11 5.44771 11 6V12.4667C11 12.4667 11 12.7274 11.1267 12.9235C11.2115 13.0898 11.3437 13.2343 11.5174 13.3346L16.1372 16.0019C16.6155 16.278 17.2271 16.1141 17.5032 15.6358C17.7793 15.1575 17.6155 14.5459 17.1372 14.2698L13 11.8812V6C13 5.44772 12.5523 5 12 5Z" fill="currentcolor"/></svg>' },
            { label: 'fileSize',    value: Utils.formatSize(match.technical_details?.file_size), svg: '<svg viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 9V17.8C19 18.9201 19 19.4802 18.782 19.908C18.5903 20.2843 18.2843 20.5903 17.908 20.782C17.4802 21 16.9201 21 15.8 21H8.2C7.07989 21 6.51984 21 6.09202 20.782C5.71569 20.5903 5.40973 20.2843 5.21799 19.908C5 19.4802 5 18.9201 5 17.8V6.2C5 5.07989 5 4.51984 5.21799 4.09202C5.40973 3.71569 5.71569 3.40973 6.09202 3.21799C6.51984 3 7.0799 3 8.2 3H13M19 9L13 3M19 9H14C13.4477 9 13 8.55228 13 8V3" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
        ];

        const result = this.setDetailList(items);
        
        if (!divId) {
            return result;
        } else {
            document.getElementById(divId).innerHTML = result;
        }
    },

    renderRefereeInfo(detail, divId, section) {
        const rows = [
            { label: 'referee',       value: detail.referees?.referee,                 svg: '<svg viewBox="0 0 480 480" xml:space="preserve" version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><style type="text/css">.st0{fill:currentcolor;}</style><g><path class="st0" d="M314.022,167.059c-21.788,0-41.358,0-60.564,0H0v91.268l122.43,21.778c23.356,4.153,43.101,19.682,52.644,41.4 c0,0,4.585,8.504,7.837,17.85c19.608,56.341,68.563,99.722,131.111,99.722c75.117,0,136.009-60.897,136.009-136.01 C450.031,227.956,389.139,167.059,314.022,167.059z M314.022,355.472c-28.945,0-52.408-23.464-52.408-52.404 c0-28.939,23.464-52.413,52.408-52.413c28.944,0,52.408,23.474,52.408,52.413C366.43,332.008,342.966,355.472,314.022,355.472z"/><path class="st0" d="M375.991,72.922c-40.945,0-274.535,0-274.535,0L2.008,144.233h145.575h125.84h40.94 c86.056,0,156.068,70.772,156.068,156.828c0,4.428-0.299,8.787-0.666,13.127l18.839-28.988c0.166-0.245,0.318-0.5,0.48-0.744 l3.478-5.721C504.824,258.307,512,234.491,512,208.932C512,133.82,451.108,72.922,375.991,72.922z M291.391,130.821h-62.66 l55.66-46.662h62.66L291.391,130.821z"/></g></svg>'},
            { label: 'refereeAssis',  value: detail.referees?.assistants?.join(' · '), svg: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 21V3.90002C5 3.90002 5.875 3 8.5 3C11.125 3 12.875 4.8 15.5 4.8C18.125 4.8 19 3.9 19 3.9V14.7C19 14.7 18.125 15.6 15.5 15.6C12.875 15.6 11.125 13.8 8.5 13.8C5.875 13.8 5 14.7 5 14.7" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'},
            { label: 'refereeFourth', value: detail.referees?.fourth_official,         svg: '<svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.1299 13.2539H14.002V7.04688H12.0059L7.85645 13.6025L7.94531 14.8467H12.0264V17H14.002V14.8467H15.1299V13.2539ZM12.0264 13.2539H9.8252L11.8965 9.96582L12.0264 9.74023V13.2539Z" fill="currentcolor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12Z" fill="currentcolor"/></svg>'},
        ];
        
        const result = this.setDetailList(rows);
        
        if (!divId) {
            return result;
        } else {
            section ? document.getElementById(section).style.display = 'block' : null;
            document.getElementById(divId).innerHTML = result;
        }
    },

    renderObsAndTags(match) {
        const obs = match.additional_info || '';
        if (!obs) return;
        const tags = this.TAG_RULES.filter(r => r.pattern.test(obs));
        if (tags.length || obs) document.getElementById('meTagsSection').style.display = 'block';
        document.getElementById('meTagsList').innerHTML = tags
            .map(t => `<span class="me-tag ${t.cls}">${t.label}</span>`).join('');
        if (obs) {
            document.getElementById('meObs').textContent = obs;
            document.getElementById('meObs').style.display = 'block';
        }
    },

    renderStorage(local, nuvem, divId) {
        const badges = [];
        if (local) badges.push(`<span class="storage-badge badge-success">${local}</span>`);
        if (nuvem) badges.push(`<span class="storage-badge badge-info">Cloud</span>`);
        document.getElementById(divId).innerHTML = badges.join('') ||
            '<span style="color:var(--text-tertiary);font-size:var(--font-size-md)">Nenhuma informação de storage</span>';
    },

    renderAttRev(detail, divId) {
        const attendance = Array.isArray(detail.attendance)
            ? detail.attendance
            : [detail.attendance];
        
        const rows = [
            ...detail.venue ? [{
                label: 'stadium',
                value: detail.venue.name || detail.venue,
                svg: '<svg viewBox="0 0 964.199 964.2" fill="currentcolor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><g><path d="M833.1,241.359v-68.8l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.4v31.6v33.1 c-34.199-9-72.1-16.6-113-22.3v-65.3l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.3 v31.7v38.9c-36.1-3.6-73.9-5.7-113-6.4v-76.6l44.801-18.3c10.299-4.2,10.299-18.8,0-23l-77.701-31.8c-8.199-3.3-17.1,2.7-17.1,11.5 v61.2v21v56.2c-39.4,0.7-77.6,2.9-114,6.5v-59.5l44.8-18.3c10.3-4.2,10.3-18.8,0-23l-77.7-31.8c-8.199-3.3-17.1,2.7-17.1,11.5v50.3 v31.7v45c-40.9,5.8-78.8,13.3-113,22.4v-53.8l44.8-18.3c10.3-4.2,10.3-18.8,0-23l-77.7-31.8c-8.2-3.3-17.1,2.7-17.1,11.5v50.4v31.6 v48.7C49.4,270.159,0,308.359,0,350.459l0,0v413.8c0,87.899,215.8,159.199,482.1,159.199c266.3,0,482.099-71.3,482.099-159.199 v-413.8l0,0C964.199,308.259,914.4,269.859,833.1,241.359z M149.1,746.359c-32.5-9.8-61.2-21.1-85.2-33.6v-27.7v-28.9 c2.1,0.601,4.2,1.5,6.2,2.7c6.6,4.1,13.9,8.1,21.7,11.9c16.7,8.3,35.9,16,57.4,23.1v52.5H149.1z M149.1,587.159 c-32.5-9.8-61.2-21.1-85.2-33.6v-56.601c2.1,0.601,4.2,1.5,6.2,2.7c20.9,12.9,47.6,24.7,79.1,35v52.5H149.1z M814.1,535.159 c29.5-9.7,55.201-20.8,76-33c1.801-1.1,3.801-1.899,5.701-2.5v56.2c-23.4,11.7-50.9,22.3-81.801,31.6v-52.3H814.1z M226,606.359 c-9.2-1.9-18.2-3.8-26.9-5.8v-51.4c11.8,2.9,24.1,5.7,36.8,8.2c20.9,4.2,42.7,7.9,65.2,10.9v48.399v2c-2.5-0.3-4.9-0.7-7.4-1 C270.4,614.559,247.7,610.759,226,606.359z M351.1,611.059v-37c34.4,3.3,69.9,5.2,106,5.899v25.4v24.6c-36-0.6-71.5-2.5-106-5.699 V611.059z M507.1,605.359v-25.4c36-0.6,71.201-2.6,105-5.8v36.8v13.4c-34.199,3.1-69.4,5-105,5.6V605.359z M662.1,616.559v-48.101 c36.4-4.899,70.6-11.3,102-19v51.301c-9.799,2.3-19.799,4.399-30,6.399c-20.5,4-41.699,7.601-63.6,10.601 c-2.801,0.399-5.6,0.8-8.4,1.1V616.559z M814.1,694.359c21.701-7.1,41.301-15,58.4-23.5c6.199-3.1,12.1-6.3,17.699-9.5 c1.801-1.1,3.801-1.9,5.701-2.5v23.7v32.5c-23.4,11.7-50.9,22.3-81.801,31.6V694.359L814.1,694.359z M861.1,365.659 c-22.4,12.5-53.199,24.4-89.1,34.4c-80.199,22.3-183.199,34.5-289.9,34.5c-106.7,0-209.7-12.2-289.9-34.5 c-35.9-10-66.7-21.8-89.1-34.4c-11-6.1-18.1-11.4-22.6-15.3c4.5-3.9,11.6-9.1,22.6-15.3c22.4-12.5,53.2-24.4,89.1-34.4 c80.2-22.3,183.2-34.5,289.9-34.5c106.701,0,209.701,12.3,289.9,34.5c35.9,10,66.699,21.8,89.1,34.4c11,6.1,18.1,11.4,22.6,15.3 C879.1,354.359,872,359.56,861.1,365.659z M220,764.259c-7.1-1.5-14.1-3-20.9-4.601v-51.399c11.8,2.899,24.1,5.699,36.8,8.199 c20.9,4.2,42.7,7.9,65.2,10.9v36.8v13.601c-25.9-3.4-51.1-7.5-75.1-12.4C224,765.159,222,764.659,220,764.259z M351.1,764.259 v-31.101c34.4,3.3,69.9,5.2,106,5.9v25.2v24.8c-36-0.601-71.5-2.5-106-5.7V764.259z M507.1,764.259v-25.2 c36-0.601,71.201-2.601,105-5.8v31v19.199c-34.199,3.101-69.4,5-105,5.601V764.259z M734.1,766.359c-23.1,4.6-47.199,8.5-72,11.7 v-13.7v-36.7c36.4-4.899,70.6-11.3,102-19v51.3c-6.5,1.5-13.199,3-19.9,4.4C740.801,764.958,737.5,765.659,734.1,766.359z"/></g></svg>'
            }] : [],

            ...detail.venue?.capacity ? [{
                label: 'stadiumCapacityFull',
                value: detail.venue?.capacity.toLocaleString(LanguageManager.getLanguage()),
                svg: '<svg viewBox="0 0 256 256" fill="currentcolor" version="1.2" baseProfile="tiny" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"><path d="M41,53.1c9.1,0,16.6,7.4,16.6,16.6S50.2,86.2,41,86.2s-16.6-7.4-16.6-16.6S31.9,53.1,41,53.1z M84.7,53.1 c9.1,0,16.6,7.4,16.6,16.6s-7.4,16.6-16.6,16.6s-16.6-7.4-16.6-16.6S75.6,53.1,84.7,53.1z M62.2,11.9c9.1,0,16.6,7.4,16.6,16.6 S71.4,45,62.2,45s-16.6-7.4-16.6-16.6S53.1,11.9,62.2,11.9z M106.9,11.9c9.1,0,16.6,7.4,16.6,16.6S116.1,45,106.9,45 s-16.6-7.4-16.6-16.6S97.8,11.9,106.9,11.9z M149.3,11.9c9.1,0,16.6,7.4,16.6,16.6S158.5,45,149.3,45s-16.6-7.4-16.6-16.6 S140.2,11.9,149.3,11.9z M191.5,11.9c9.1,0,16.6,7.4,16.6,16.6S200.7,45,191.5,45S175,37.6,175,28.5S182.4,11.9,191.5,11.9z M171.1,53.1c9.1,0,16.6,7.4,16.6,16.6s-7.4,16.6-16.6,16.6c-9.1,0-16.6-7.4-16.6-16.6S161.9,53.1,171.1,53.1z M126.1,53.1 c9.1,0,16.6,7.4,16.6,16.6c0,9.1-7.4,16.6-16.6,16.6c-9.2,0-16.6-7.4-16.6-16.6C109.5,60.5,116.9,53.1,126.1,53.1z M214.6,53.1 c9.1,0,16.6,7.4,16.6,16.6c0,9.1-7.4,16.6-16.6,16.6c-9.2,0-16.6-7.4-16.6-16.6C198.1,60.5,205.5,53.1,214.6,53.1z M41.1,53.5 c9,0,16.3,7.3,16.3,16.3s-7.3,16.3-16.3,16.3s-16.3-7.3-16.3-16.3S32.1,53.5,41.1,53.5z M59.5,89.3H40.9H22.2 c-11.3,0-18.5,9.3-18.5,21.1V164c0,9.7,12.7,9.7,12.7,0v-50.2c0-1.2,1-2,2-2c1.2,0,2,0.8,2,2v121.8c0,5,4,9.1,9.1,9.1 c5,0,9.1-4,9.1-9.1v-60.6c0-1.2,1-2,2-2h0.4c1.2,0,2,1,2,2v60.6c0,5,4,9.1,9.1,9.1c5,0,9.1-4,9.1-9.1V113.7c0-1.2,1-2,2-2 c1.2,0,2,1,2,2v50.4c0,9.7,12.7,9.7,12.7,0v-53.6C78.2,98.6,71.1,89.3,59.5,89.3z M144.7,89.3h-18.7h-18.7 c-11.3,0-18.5,9.3-18.5,21.1V164c0,9.7,12.7,9.7,12.7,0v-50.2c0-1.2,1-2,2-2c1.2,0,2,0.8,2,2v121.8c0,5,4,9.1,9.1,9.1 c5,0,9.1-4,9.1-9.1v-60.6c0-1.2,1-2,2-2h0.4c1.2,0,2,1,2,2v60.6c0,5,4,9.1,9.1,9.1c5,0,9.1-4,9.1-9.1V113.7c0-1.2,1-2,2-2 c1.2,0,2,1,2,2v50.4c0,9.7,12.7,9.7,12.7,0v-53.6C163.4,98.6,156.3,89.3,144.7,89.3z M233.7,89.3h-18.7h-18.7 c-11.3,0-18.5,9.3-18.5,21.1V164c0,9.7,12.7,9.7,12.7,0v-50.2c0-1.2,1-2,2-2c1.2,0,2,0.8,2,2v121.8c0,5,4,9.1,9.1,9.1 c5,0,9.1-4,9.1-9.1v-60.6c0-1.2,1-2,2-2h0.4c1.2,0,2,1,2,2v60.6c0,5,4,9.1,9.1,9.1c5,0,9.1-4,9.1-9.1V113.7c0-1.2,1-2,2-2 c1.2,0,2,1,2,2v50.4c0,9.7,12.7,9.7,12.7,0v-53.6C252.4,98.6,245.3,89.3,233.7,89.3z"/></svg>'
            }] : [],

            ...detail.attendance ? attendance.flatMap(item => [
                {
                    label: item.label,
                    value: item.value.toLocaleString(LanguageManager.getLanguage()),
                    svg: '<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-users"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
                },

                ...(item.occupancy && (attendance.length === 1 || (attendance.length > 1 && item.label.toLowerCase() === 'público total'))
                    ? [{
                        label: `${item.occupancy}% ${LanguageManager.translateText('stadiumCapacity')}`,
                        value: item.occupancy,
                        noNewLine: true,
                        progressBar: true
                    }]
                    : [])
            ]) : [],

            ...detail.revenue ? [{
                label: 'revenue',
                value: detail.revenue.value.toLocaleString(
                    LanguageManager.getLanguage(),
                    {
                        style: 'currency',
                        currency: detail.revenue.currency
                    }
                ),
                svg: '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_443_3628)"><rect x="2" y="6" width="20" height="12" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 10C21.4747 10 20.9546 9.89654 20.4693 9.69552C19.984 9.4945 19.543 9.19986 19.1716 8.82843C18.8001 8.45699 18.5055 8.01604 18.3045 7.53073C18.1035 7.04543 18 6.52529 18 6L22 6L22 10Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 18C18 16.9391 18.4214 15.9217 19.1716 15.1716C19.9217 14.4214 20.9391 14 22 14L22 18L18 18Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 14C3.06087 14 4.07828 14.4214 4.82843 15.1716C5.57857 15.9217 6 16.9391 6 18L2 18L2 14Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6C6 7.06087 5.57857 8.07828 4.82843 8.82843C4.07828 9.57857 3.06087 10 2 10L2 6H6Z" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.0741 9.5H11.3333C10.597 9.5 10 10.0596 10 10.75C10 11.4404 10.597 12 11.3333 12H13.1111C13.8475 12 14.4444 12.5596 14.4444 13.25C14.4444 13.9404 13.8475 14.5 13.1111 14.5H10" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9.51733V8.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15.5173V14.5" stroke="currentcolor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_443_3628"><rect width="24" height="24" fill="white"/></clipPath></defs></svg>'
            }] : [],

            ...(detail.revenue && detail.revenue.averageTicket != null
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

            ...(detail.revenue && detail.revenue.adjustedRevenue != null
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

        const result = Elements.setDetailList(rows);
        
        if (!divId) {
            return result;
        } else {
            document.getElementById('meAttRevSection').style.display = 'block';
            document.getElementById(divId).innerHTML = result;
        }
    },

    renderLineups(home_team, away_team) {
        if (!home_team?.lineup && !away_team?.lineup) return;

        document.getElementById('meLineupSection').style.display = 'block';

        const grid = document.getElementById('meLineupGrid');
        grid.innerHTML = '';

        [home_team, away_team].forEach(team => {
            if (!team?.lineup) return;
            grid.appendChild(this.buildLineupCol(team));
        });
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

    renderPenalties(detail, homeTla) {
        const penalties = detail.penalties;
        if (!penalties?.length) return;
 
        const container = document.getElementById('mePenaltiesSection');
        const list      = document.getElementById('mePenaltiesList');
        if (!container || !list) return;
 
        const homeTeam = detail.home_team;
        const awayTeam = detail.away_team;
        const penScore = detail.score?.penalties; // { home: N, away: N } ou null
 
        // Quem bateu primeiro
        const firstTla    = penalties[0]?.teamAbbr;
        const firstIsHome = firstTla === homeTla;
 
        // Separa cobranças por time, mantendo índice de rodada
        const home = [], away = [];
        penalties.forEach(p => {
            if (p.teamAbbr === homeTla) home.push(p);
            else                        away.push(p);
        });
        const rounds = Math.max(home.length, away.length);
 
        // ── Header: escudos, nomes e placar ──────────────────────────────────
        const scoreDisplay = penScore
            ? `<span class="pen-score">${penScore.home} × ${penScore.away}</span>`
            : '';
 
        const homeLogo = homeTeam?.escudo_svg || homeTeam?.escudo_png || '';
        const awayLogo = awayTeam?.escudo_svg || awayTeam?.escudo_png || '';
 
        let html = `
            ${this.getTeamHeaderList(detail)}
            <div class="pen-score-row">
                ${scoreDisplay}
            </div>
            <div class="pen-first-row pen-first-label">
                <span style="text-align: right;">${firstIsHome ? '↓' : ''} </span>
                <span>${LanguageManager.t('kickFirst').toLowerCase()}</span>
                <span style="text-align: left;">${!firstIsHome ? '↓' : ''} </span>
            </div>
        `;
 
        // ── Linhas de cobranças ───────────────────────────────────────────────
        for (let i = 0; i < rounds; i++) {
            // Se firstIsHome: linha = [home[i] | rodada | away[i]]
            // Se firstIsAway: linha = [away[i] | rodada | home[i]] — mas home sempre na esquerda visualmente
            const h = home[i];
            const a = away[i];
 
            const homeCell = h
                ? `<div class="pen-cell home ${h.scored ? 'scored' : 'missed'}">
                       <span class="pen-icon">${h.scored ? `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="var(--text-primary)" width="12px" height="12px" viewBox="0 0 122.88 122.88" version="1.1" id="Layer_1" style="enable-background:new 0 0 122.88 122.88" xml:space="preserve">
                        <style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style>
                        <g><path class="st0" d="M61.44,0c16.97,0,32.33,6.88,43.44,18c11.12,11.12,18,26.48,18,43.44c0,16.97-6.88,32.33-18,43.44 c-11.12,11.12-26.48,18-43.44,18S29.11,116,18,104.88C6.88,93.77,0,78.41,0,61.44C0,44.47,6.88,29.11,18,18 C29.11,6.88,44.47,0,61.44,0L61.44,0z M76.85,117.08L76.73,117l6.89-23.09L69.41,78.15L52.66,78L39.38,94.62l6.66,22.32l-0.15,0.1 c4.95,1.38,10.16,2.12,15.55,2.12C66.78,119.16,71.95,118.44,76.85,117.08L76.85,117.08z M12.22,91.61l24.34,0.12L49.28,75.8 l-5.26-16.12l-21.42-9.3L3.78,64.08C4.23,74.14,7.26,83.53,12.22,91.61L12.22,91.61z M16.77,24.88l7.4,22.14l19.98,8.68 l15.44-11.97V20.94L40.51,7.63c-7.52,2.93-14.28,7.39-19.89,13C19.27,21.98,17.98,23.4,16.77,24.88L16.77,24.88z M81.7,7.37 L63.3,20.77V43.7L77.8,54.91l20.81-8.92l7.18-21.49c-1.12-1.35-2.3-2.64-3.54-3.88C96.48,14.85,89.49,10.29,81.7,7.37L81.7,7.37z M119.09,64.36l-0.02,0.01L99.09,49.82l-19.81,8.49l-6.08,18.03l13.73,15.23c0.06,0.06,0.09,0.13,0.11,0.21l23.6-0.11 C115.56,83.65,118.59,74.34,119.09,64.36L119.09,64.36z"></path></g>
                    </svg>` : '✕'}</span>
                       <span class="pen-name">${h.popularName || h.name || '—'}</span>
                   </div>`
                : `<div class="pen-cell home empty"></div>`;
 
            const awayCell = a
                ? `<div class="pen-cell away ${a.scored ? 'scored' : 'missed'}">
                       <span class="pen-name">${a.popularName || a.name || '—'}</span>
                       <span class="pen-icon">${a.scored ? `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="var(--text-primary)" width="12px" height="12px" viewBox="0 0 122.88 122.88" version="1.1" id="Layer_1" style="enable-background:new 0 0 122.88 122.88" xml:space="preserve">
                        <style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;}</style>
                        <g><path class="st0" d="M61.44,0c16.97,0,32.33,6.88,43.44,18c11.12,11.12,18,26.48,18,43.44c0,16.97-6.88,32.33-18,43.44 c-11.12,11.12-26.48,18-43.44,18S29.11,116,18,104.88C6.88,93.77,0,78.41,0,61.44C0,44.47,6.88,29.11,18,18 C29.11,6.88,44.47,0,61.44,0L61.44,0z M76.85,117.08L76.73,117l6.89-23.09L69.41,78.15L52.66,78L39.38,94.62l6.66,22.32l-0.15,0.1 c4.95,1.38,10.16,2.12,15.55,2.12C66.78,119.16,71.95,118.44,76.85,117.08L76.85,117.08z M12.22,91.61l24.34,0.12L49.28,75.8 l-5.26-16.12l-21.42-9.3L3.78,64.08C4.23,74.14,7.26,83.53,12.22,91.61L12.22,91.61z M16.77,24.88l7.4,22.14l19.98,8.68 l15.44-11.97V20.94L40.51,7.63c-7.52,2.93-14.28,7.39-19.89,13C19.27,21.98,17.98,23.4,16.77,24.88L16.77,24.88z M81.7,7.37 L63.3,20.77V43.7L77.8,54.91l20.81-8.92l7.18-21.49c-1.12-1.35-2.3-2.64-3.54-3.88C96.48,14.85,89.49,10.29,81.7,7.37L81.7,7.37z M119.09,64.36l-0.02,0.01L99.09,49.82l-19.81,8.49l-6.08,18.03l13.73,15.23c0.06,0.06,0.09,0.13,0.11,0.21l23.6-0.11 C115.56,83.65,118.59,74.34,119.09,64.36L119.09,64.36z"></path></g>
                    </svg>` : '✕'}</span>
                   </div>`
                : `<div class="pen-cell away empty"></div>`;
 
            // Destaque visual na rodada que o time que bate primeiro vai
            const roundMark = firstIsHome
                ? (h ? 'first' : '')
                : (a ? 'first' : '');
 
            html += `
                <div class="pen-row">
                    ${homeCell}
                    <span class="pen-round ${roundMark}">${i + 1}</span>
                    ${awayCell}
                </div>`;
        }
 
        list.innerHTML = html;
        container.style.display = 'block';
    },

    renderStatistics(detail) {
        const home = detail.statistics?.homeTeam || {};
        const away = detail.statistics?.awayTeam || {};

        const rows = STATS_ORDER
            .filter(key => home[key] !== undefined || away[key] !== undefined)
            .map(key => ({
                label: LanguageManager.t(key),
                home:  home[key]?.total ?? '—',
                away:  away[key]?.total ?? '—',
            }));
        
        if (!rows.length) return;

        const section = document.getElementById('meStatisticsSection');
        const statsList = document.getElementById('meStatisticsInfo');

        section.style.display = 'block';
        
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
                            <div class="me-stat-bar-home" style="background:${equalZero ? 'var(--border-color)' : detail.home_team.colors?.primary};width:${homePct}%"></div>
                            <div class="me-stat-bar-away" style="background:${equalZero ? 'var(--border-color)' : detail.away_team.colors?.primary};width:${100 - homePct}%"></div>
                        </div>` : ''}
                    </div>
                </div>`;
            }).join('');
    },

    renderLastResults(last_results, homeName, awayName) {
        if (!last_results) return;
        const home = last_results.home_team || [];
        const away = last_results.away_team || [];
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