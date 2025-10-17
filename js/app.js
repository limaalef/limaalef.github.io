const App = {
    async loadData() {
        try {
            const apiResponse = await APIService.fetchMatches(AppState.currentPage, AppState.itemsPerPage);
            
            // Atualiza paginação (suporta ambos formatos)
            PaginationManager.update(apiResponse);
            
            AppState.matches = APIService.transformData(apiResponse);
            AppState.filteredMatches = AppState.matches;
            Renderer.populateYearFilter();
            Renderer.render();
            Renderer.updateStats(apiResponse);
            
            // Suporta múltiplos formatos de total
            const totalRecords = apiResponse?.pagination?.total_items || 
                                apiResponse?.total_registros || 
                                apiResponse?.total_records || 
                                AppState.matches.length;
            
            Utils.showNotification(
                `${AppState.matches.length} jogos carregados (${totalRecords} total) - Página ${AppState.currentPage}/${AppState.totalPages}`, 
                'success'
            );
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
    init() {
        document.getElementById('searchInput').addEventListener('input', () => FilterManager.apply());
        document.getElementById('yearFilter').addEventListener('change', () => FilterManager.apply());
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchView(btn.dataset.view));
        });
        document.getElementById('autoRefresh').addEventListener('change', (e) => {
            e.target.checked ? AutoRefresh.start() : AutoRefresh.stop();
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
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') MatchModal.close();
        });
        this.loadData();
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());