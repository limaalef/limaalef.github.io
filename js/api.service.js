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
        
        if (CONFIG.videoFilter) {
            url.searchParams.append('embed', 'true');
        }

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

    async fetchChangelog(page, itemsPerPage) {
        const url = new URL(CONFIG.CHANGELOG_URL);
        url.searchParams.set('page', page);
        url.searchParams.set('limit', itemsPerPage);

        return this._fetchJson(url.toString());
    },

    async fetchTodayInHistory() {
        const base = CONFIG.API_URLS['football'].replace(/\?$/, '');
        const url = new URL(base);
        url.searchParams.set('today_in_history', 'true');
        url.searchParams.set('fields', 'id,date,home_team,away_team,championship');

        return this._fetchJson(url.toString());
    },

    async fetchByTeam(page, itemsPerPage) {
        const loadingMessage = LanguageManager.t('loadingData');
        Utils.showNotification(loadingMessage, 'info');

        const url = new URL(CONFIG.API_URLS[CONFIG.currentSport]);
        url.searchParams.append('max_items', 1500);
        url.searchParams.append('page', page);
        url.searchParams.append('search_type', CollectionState.type);
        url.searchParams.append('search', CollectionState.query);

        if (CollectionState.yearFilter) {
            url.searchParams.append('year', CollectionState.yearFilter);
        }

        if (CONFIG.videoFilter) {
            url.searchParams.append('embed', 'true');
        }

        return this._fetchJson(url.toString());
    },

    async fetchEnrichment(matchId, sport) {
        try {
            const url = `${CONFIG.REQUEST_API_BASE}/matches/${encodeURIComponent(sport)}/${encodeURIComponent(matchId)}/detail`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const response = await res.json();
            return response.data || null;
        } catch { return null; }
    },

    transformData(apiResponse, sport = CONFIG.currentSport) {
        if (sport === 'motor') {
            return (apiResponse.data || []).map(item => ({
                ID: item.id || '',
                Tipo: 'motor',
                Campeonato: item.championship?.name || '',
                Fase: item.championship?.phase || '',
                Pais: item.championship?.country_name || '',
                Bandeira: item.championship?.country_flag || '',
                DataInicio: item.start_date || '',
                DataFim: item.end_date || '',
                Eventos: item.events || [],
                'Logo emissora': item.main_station_logo || '',
                'Video Embed': item.embed_video || '',
                'Mais dados': !!item.match_data,
                type: item.type || ''
            }));
        }
        
        return (apiResponse.data || []).map(item => ({
            ID: item.id ?? '',
            Data: item.date || '',
            Emissora: item.station?.name || '',
            Origem: item.station?.origem || '',
            Narração: item.station?.narracao || '',
            'Logo emissora': item.station?.logo || '',
            Competição: item.championship?.name || '',
            Fase: item.championship?.phase || '',
            Estadio: item.championship?.stadium || '',
            Mandante: item.home_team?.name || '',
            'Gols mandante': item.home_team?.goals,
            'Logo mandante': item.home_team?.logo || '',
            Visitante: item.away_team?.name || '',
            'Gols visitante': item.away_team?.goals,
            'Logo visitante': item.away_team?.logo || '',
            Obs: item.additional_info || '',
            Imagem: item.image || '',
            Local: item.technical_details?.local || '',
            Nuvem: item.technical_details?.cloud ? 'Nuvem' : '',
            Duração: item.technical_details?.duration || '',
            Tamanho: item.technical_details?.file_size || '',
            Qualidade: item.technical_details?.video_quality || '',
            Bitrate: item.technical_details?.video_bitrate || '',
            'Formato de áudio': item.technical_details?.audio_format || '2.0',
            'Video Embed': item.embed_video || '',
            'Mais dados': !!item.match_data,
            Tipo: item.type || ''
        }));
    }
};