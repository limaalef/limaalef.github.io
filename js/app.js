const App = {
    async loadData() {
        try {
            const apiResponse = await APIService.fetchMatches(AppState.currentPage, AppState.itemsPerPage);
            PaginationManager.update(apiResponse);
            AppState.matches = APIService.transformData(apiResponse);
            AppState.filteredMatches = AppState.matches;
            Renderer.populateYearFilter();
            Renderer.render();
            Renderer.updateStats(apiResponse);
            
            const totalRecords = apiResponse?.pagination?.total_items || 
                                apiResponse?.total_registros || 
                                apiResponse?.total_records || 
                                AppState.matches.length;
            
            const message = `${AppState.matches.length} ${LanguageManager.t('games').toLowerCase()} ${LanguageManager.t('loadedText')} (${totalRecords} total) - ${LanguageManager.t('page')} ${AppState.currentPage}/${AppState.totalPages}`;
            Utils.showNotification(message, 'success');
        } catch (error) {
            console.log(error);
            document.getElementById('matchesContainer').innerHTML =
                Utils.emptyStateHtml(
                    'Erro ao carregar dados',
                    `Verifique a URL da API<br><span style="font-size:0.9em;margin-top:10px;">Erro: ${error.message}</span>`
                );
        }
    },

    switchSport(sport) {
        CONFIG.currentSport = sport;
        AppState.currentPage = 1;
        document.querySelectorAll('.sport-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sport === sport);
        });
        Utils.applySportTheme(sport);
        this.loadData();
    },

    readUrlParams() {
        const { sport, id, page, raw: params } = Utils.getUrlParams();

        if (id > 0) {
            window.location.replace(`match.html?id=${id}&sport=${sport}`);
            return true;
        }

        const rawSport = params.get('sport');
        if (rawSport && Utils.VALID_SPORTS.includes(rawSport)) {
            CONFIG.currentSport = rawSport;
            Utils.applySportTheme(rawSport);
            document.querySelectorAll('.sport-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.sport === rawSport);
            });
        }

        if (page > 0) AppState.currentPage = page;

        const search = params.get('search');
        if (search) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = search;
        }
    },

    init() {
        if (this.readUrlParams()) return;

        document.getElementById('footballBtn').addEventListener('click', () => this.switchSport('football'));
        document.getElementById('multisportBtn').addEventListener('click', () => this.switchSport('multisport'));
        document.getElementById('motorBtn').addEventListener('click', () => this.switchSport('motor'));
        document.getElementById('carnavalBtn').addEventListener('click', () => this.switchSport('carnaval'));
        document.getElementById('searchInput').addEventListener('input', () => FilterManager.apply());
        document.addEventListener('languagechange', () => {
            if (document.getElementById('searchInput')?.value) FilterManager.apply();
        });
        document.getElementById('yearFilter').addEventListener('change', () => FilterManager.apply());
        document.getElementById('itemsPerPage').addEventListener('change', (e) => {
            AppState.itemsPerPage = parseInt(e.target.value);
            AppState.currentPage = 1;
            this.loadData();
        });
        document.getElementById('firstPage').addEventListener('click', () => PaginationManager.goToFirst());
        document.getElementById('prevPage').addEventListener('click', () => PaginationManager.goToPrevious());
        document.getElementById('nextPage').addEventListener('click', () => PaginationManager.goToNext());
        document.getElementById('lastPage').addEventListener('click', () => PaginationManager.goToLast());
        
        this.loadData();
    }
};

// Aguarda o header estar no DOM antes de inicializar
window.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;
    App.init();
});