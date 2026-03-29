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
            document.getElementById('matchesContainer').innerHTML = `
                <div class="empty-state">
                    <h2>Erro ao carregar dados</h2>
                    <p>Verifique a URL da API</p>
                    <p style="font-size: 0.9em; margin-top: 10px;">Erro: ${error.message}</p>
                </div>
            `;
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
        
        // Remove todos os temas
        document.body.classList.remove('theme-football', 'theme-others', 'theme-motor');
        
        // Adiciona o tema apropriado
        if (sport === 'football') {
            document.body.classList.add('theme-football');
        } else if (sport === 'others') {
            document.body.classList.add('theme-others');
        } else if (sport === 'motor') {
            document.body.classList.add('theme-motor');
        }
        
        this.loadData();
    },
    readUrlParams() {
        const params = new URLSearchParams(window.location.search);
 
        // ?sport=football|others|motor
        const sport = params.get('sport');
        if (sport && ['football', 'others', 'motor'].includes(sport)) {
            CONFIG.currentSport = sport;
            document.body.classList.remove('theme-football', 'theme-others', 'theme-motor');
            if (sport === 'football') document.body.classList.add('theme-football');
            if (sport === 'others') document.body.classList.add('theme-others');
            if (sport === 'motor')  document.body.classList.add('theme-motor');
            document.querySelectorAll('.sport-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.sport === sport);
            });
        }
 
        // ?page=N
        const page = parseInt(params.get('page'));
        if (page > 0) AppState.currentPage = page;
 
        // ?view=grid|list
        const view = params.get('view');
        if (view && ['grid', 'list'].includes(view)) {
            AppState.currentView = view;
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
        }
 
        // ?search=texto
        const search = params.get('search');
        if (search) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = search;
        }
    },
    init() {
        LanguageManager.init();
        this.readUrlParams();
        
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
        this.loadData();
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());