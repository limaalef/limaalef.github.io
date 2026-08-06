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
        const base = 'https://api.limaalef.com/archive/matches';
        const url = new URL(base);
        url.searchParams.set('today_in_history', 'true');
        url.searchParams.set('fields', 'id,date,home_team,away_team,championship');

        return this._fetchJson(url.toString());
    },

    async fetchByTeam(page, itemsPerPage) {
        const loadingMessage = LanguageManager.t('loadingData');
        Utils.showNotification(loadingMessage, 'info');

        const url = new URL(CONFIG.API_URLS[CONFIG.currentSport]);
        url.searchParams.append('max_items', 100);
        url.searchParams.append('page', page);
        url.searchParams.append(CollectionState.type, CollectionState.query);

        // if (CONFIG.currentSport === 'football' && CollectionState.type !== 'commentor') {
        //     url.searchParams.append('type', 'group');
        // }

        // if (CollectionState.yearFilter) {
        //     url.searchParams.append('year', CollectionState.yearFilter);
        // }

        // if (CONFIG.videoFilter) {
        //     url.searchParams.append('embed', 'true');
        // }

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
            return apiResponse.data
        }
        else if (sport === 'carnaval') {
            return (apiResponse.data || []).map(item => ({
                ...item,
                ID: item.id ?? '',
                Data: item.date || '',
                Emissora: item.station?.name || '',
                Origem: item.station?.origem || '',
                Narração: item.station?.narracao || '',
                'Logo emissora': item.station?.logo || '',
                Cidade: item.championship?.city || '',
                Divisão: item.championship?.division || '',
                Venue: item.championship?.venue || '',
                Escola: item.samba_school?.name || '',
                Enredo: item.samba_school?.plot,
                Carnavalesco: item.samba_school?.carnavalesco || '',
                Interprete: item.samba_school?.interpreter || '',
                Logo: item.samba_school?.logo,
                'Nota_final': item.samba_school?.result?.total || '',
                Posição: item.samba_school?.result?.final_position || '',
                Notas: item.samba_school?.result?.category || '',
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
                Tipo: item.type || ''
            }));
        }
        return (apiResponse.data || []).map(item => {
            const sources = Array.isArray(item.sources) ? item.sources : null;
            return {
                ...item,
                sources: sources,
                qtd_sources: sources ? sources.length : 1
            };
        });
    }
};