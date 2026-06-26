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

    switchView(view) {
        AppState.currentView = view;
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        Renderer.render();
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

        const view = params.get('view');
        if (view && ['grid', 'list'].includes(view)) {
            AppState.currentView = view;
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
        }

        const search = params.get('search');
        if (search) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = search;
        }
    },

    init() {
        if (this.readUrlParams()) return;

        document.getElementById('footballBtn').addEventListener('click', () => this.switchSport('football'));
        document.getElementById('othersBtn').addEventListener('click', () => this.switchSport('others'));
        document.getElementById('motorBtn').addEventListener('click', () => this.switchSport('motor'));
        document.getElementById('searchInput').addEventListener('input', () => FilterManager.apply());
        document.getElementById('yearFilter').addEventListener('change', () => FilterManager.apply());
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view));
        });
        document.getElementById('itemsPerPage').addEventListener('change', (e) => {
            AppState.itemsPerPage = parseInt(e.target.value);
            AppState.currentPage = 1;
            this.loadData();
        });
        document.getElementById('firstPage').addEventListener('click', () => PaginationManager.goToFirst());
        document.getElementById('prevPage').addEventListener('click', () => PaginationManager.goToPrevious());
        document.getElementById('nextPage').addEventListener('click', () => PaginationManager.goToNext());
        document.getElementById('lastPage').addEventListener('click', () => PaginationManager.goToLast());
        
        document.getElementById('videoFilterBtn').addEventListener('click', () => {
            CONFIG.videoFilter = !CONFIG.videoFilter;
            const btn = document.getElementById('videoFilterBtn');
            btn.classList.toggle('active', CONFIG.videoFilter);
            AppState.currentPage = 1;
            this.loadData();
        });
    
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') MatchModal.close();
        });

        document.addEventListener('keydown', (e) => {
            const modalOpen = document.getElementById('modal').classList.contains('active');
            if (e.key === 'Escape' && modalOpen) {
                MatchModal.close();
            }
        });

        this.loadData();
    }
};

// Aguarda o header estar no DOM antes de inicializar
window.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;
    App.init();
});