const APIService = {
    async fetchMatches(page, itemsPerPage) {
        const loadingMessage = LanguageManager.t('loadingData');
        Utils.showNotification(loadingMessage, 'info');

        const url = new URL(CONFIG.API_URLS[CONFIG.currentSport]);
        url.searchParams.append('max_items', itemsPerPage);
        url.searchParams.append('page', page);

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error('API retornou erro');

        return data;
    },
    transformData(apiResponse) {
        if (CONFIG.currentSport === 'motor') {
            return (apiResponse.data || []).map(item => ({
                ID: item.id || '',
                Tipo: 'motor',
                Campeonato: item.championship?.name || '',
                Fase: item.championship?.phase || '',
                DataInicio: item.start_date || '',
                DataFim: item.end_date || '',
                Eventos: item.events || [],
                'Logo emissora': item.main_station_logo || '',
                type: item.type || ''
            }));
        }
        
        return (apiResponse.data || []).map(item => ({
            ID: item.id || '',
            Data: item.date || '',
            Emissora: item.station?.name || '',
            Origem: item.station?.origem || '',
            Narração: item.station?.narracao || '',
            'Logo emissora': item.station?.logo || '',
            Competição: item.championship?.name || '',
            Fase: item.championship?.phase || '',
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
            Tipo: item.type || ''
        }));
    }
};