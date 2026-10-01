const APIService = {
    async _fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error('API retornou erro');
        return data;
    },

    async fetchMatches(page, itemsPerPage) {
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

    async fetchChangelog(page, itemsPerPage, { mode = '' } = {}) {
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

    async fetchByTeam(page, itemsPerPage) {
        const loadingMessage = LanguageManager.t('loadingData');
        Utils.showNotification(loadingMessage, 'info');
        let url = null

        if (CollectionState.type === "commentary") {
            url = new URL(CONFIG.API_URLS.allsports);
        } else {
            url = new URL(CONFIG.API_URLS[CONFIG.currentSport]);
        }
        
        url.searchParams.append('max_items', 100);
        url.searchParams.append('page', page);
        url.searchParams.append(CollectionState.type, CollectionState.query);

        return this._fetchJson(url.toString());
    },

    // Busca os jogos que estão fisicamente armazenados em um disco/volume
    // específico (ex.: openVolumeDetail na página de storage).
    async fetchByStorage(volumeName, page = 1, itemsPerPage = 1500) {
        const url = new URL(CONFIG.API_URLS['football']);
        url.searchParams.append('max_items', itemsPerPage);
        url.searchParams.append('page', page);
        url.searchParams.append('search_type', 'storage');
        url.searchParams.append('search', volumeName);

        return this._fetchJson(url.toString());
    },

    async fetchEnrichment(matchId, sport) {
        try {
            const url = `${CONFIG.REQUEST_API_BASE}/v2/matches/${encodeURIComponent(sport)}/${encodeURIComponent(matchId)}/detail`;
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