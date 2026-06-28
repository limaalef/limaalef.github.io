const Utils = {
    VALID_SPORTS: ['football', 'others', 'motor'],

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
            motorsport: { slug: 'motor', key: 'modeMotorsport' }
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
        document.body.classList.remove('theme-football', 'theme-others', 'theme-motor');
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
    },

    setDetailList(list) {
        const items = list.filter(i => i.value);

        return items.map(i => `
            <div class="detail-list-item">
                <div class="detail-list-label">${LanguageManager.t(i.label)}</div>
                <div class="detail-list-value">${i.value}</div>
            </div>
        `).join('');
    }
};

LanguageManager.init()