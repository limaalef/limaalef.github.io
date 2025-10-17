const Utils = {
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
    formatDate(date, shortFormat = false) {
        if (!date) return 'N/A';
        const d = this.parseDate(date);
        if (!d || isNaN(d)) return date;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        if (shortFormat) return `${day}/${month}/${year}`;
        if (hours === '00' && minutes === '00') return `${day}/${month}/${year}`;
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    },
    formatSize(size) {
        if (!size) return 'N/A';
        const bytes = parseFloat(size);
        if (isNaN(bytes)) return size;
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
            if (matchDate > today) return 'future';
            if (hasData && !hasScores && (matchDate >= yesterday && matchDate <= today)) return 'pending';
        }
        return 'completed';
    },
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        notification.style.borderLeft = `4px solid ${colors[type]}`;
        notification.innerHTML = `<span style="font-size: 1.2em; margin-right: 10px;">${icons[type]}</span><span>${message}</span>`;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
};