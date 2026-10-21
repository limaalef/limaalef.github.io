const APIService = {
    async _fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error('API retornou erro');
        return data;
    },

    async fetchMatches(page, itemsPerPage = 50) {
        const loadingMessage = LanguageManager.t('loadingData');
        Utils.showNotification(loadingMessage, 'info');

        const url = new URL(CONFIG.API_URLS[CONFIG.currentSport]);
        url.searchParams.append('max_items', itemsPerPage);
        url.searchParams.append('page', page);

        return this._fetchJson(url.toString());
    },

    async fetchById(id, sport) {
        const url = `${CONFIG.CF_API_URLS[sport]}/${encodeURIComponent(id)}`;
        const data = await this._fetchJson(url);

        return {
            ...data,
            data: Array.isArray(data.data)
                ? data.data
                : data.data
                    ? [data.data]
                    : []
        };
    },

    async fetchChangelog(page, itemsPerPage = 50, { mode = '' } = {}) {
        const url = new URL(CONFIG.CHANGELOG_URL);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', itemsPerPage);
        if (mode) url.searchParams.set('mode', mode);

        return this._fetchJson(url.toString());
    },

    async fetchTodayInHistory() {
        const base = 'https://api.limaalef.com/archive/matches';
        const url = new URL(base);
        url.searchParams.set('today_in_history', 'true');
        url.searchParams.set('fields', 'id,date,home_team,away_team,championship');

        return this._fetchJson(url.toString());
    },

    async fetchByTeam(page, itemsPerPage = 50) {
        const loadingMessage = LanguageManager.t('loadingData');
        Utils.showNotification(loadingMessage, 'info');
        let url = null

        if (CollectionState.type === "commentary") {
            url = new URL(CONFIG.API_URLS.allsports);
        } else {
            url = new URL(CONFIG.API_URLS[CONFIG.currentSport]);
        }
        
        url.searchParams.append('max_items', itemsPerPage);
        url.searchParams.append('page', page);
        url.searchParams.append(CollectionState.type, CollectionState.query);

        return this._fetchJson(url.toString());
    },

    async fetchEnrichment(matchId, sport) {
        try {
            let url = `${CONFIG.REQUEST_API_BASE}/v2/matches/${encodeURIComponent(sport)}/${encodeURIComponent(matchId)}/detail`;
            // Depois de uma edição (match-edit.html) o detalhe em cache (3 h) estaria velho: o admin que acabou de
            // editar busca uma URL nova. Os demais visitantes só veem a mudança quando o cache expirar.
            try {
                const bust = sessionStorage.getItem(`me_bust:${sport}:${matchId}`);
                if (bust) url += `?_v=${encodeURIComponent(bust)}`;
            } catch { /* storage indisponível */ }
            const res = await fetch(url);
            if (!res.ok) return null;
            const response = await res.json();
            return response.data || null;
        } catch { return null; }
    },

    transformData(apiResponse, sport = CONFIG.currentSport) {
        if (sport === 'motor') {
            return (apiResponse.data || []).map(item => ({ ...item, sport: 'motor' }));
        }
        return (apiResponse.data || []).map(item => {
            const sources = Array.isArray(item.sources) ? item.sources : null;
            return {
                ...item,
                // O esporte do item vem da API (endpoint "all" mistura esportes);
                // nos demais endpoints é o esporte consultado.
                sport: Utils.getItemSport(item, sport),
                sources: sources,
                qtd_sources: sources ? sources.length : 1
            };
        });
    }
};