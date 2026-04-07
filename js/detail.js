/**
 * app.collection.js
 * Lógica exclusiva da página collection.html (time/competição com sidebar).
 * Substitui app.js nesta página.
 */

/* ─────────────────────────────────────────
   Estado da página
───────────────────────────────────────── */
const CollectionState = {
    query: null,          // valor de ?q= na URL
    yearFilter: null,     // ano selecionado (null = todos)
};

/* ─────────────────────────────────────────
   SidebarManager — carrega e exibe a sidebar
───────────────────────────────────────── */
const SidebarManager = {
    /**
     * Busca dados da API de contexto (time ou competição) e popula o sidebar.
     * A API deve retornar um objeto com:
     *   Para clube:       { type: 'club',        name, full_name, logo, founded_year, country, description, sport }
     *   Para competição:  { type: 'competition', name, logo, organizer, format, scope, description, sport }
     *   sport deve ser 'football' | 'others' | 'motor'
     */
    async load(query) {
        const loading = document.getElementById('sidebarLoading');
        const content = document.getElementById('sidebarContent');

        loading.style.display = 'flex';
        content.style.display = 'none';

        try {
            const url = new URL(CONFIG.CONTEXT_API_URL);   // defina CONFIG.CONTEXT_API_URL no config.js
            url.searchParams.set('q', query);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error('API retornou erro');

            this.render(data.data || data);
        } catch (err) {
            // Falha silenciosa: sidebar fica em loading (não quebra a lista)
            console.warn('SidebarManager: erro ao carregar contexto:', err.message);
            loading.innerHTML = ''; // limpa skeleton sem mostrar erro
        }
    },

    render(info) {
        // Aplica tema conforme esporte retornado
        if (info.sport) {
            CollectionApp.applyTheme(info.sport);
        }

        // Escudo / logo
        const logoEl  = document.getElementById('sidebarLogo');
        const emojiEl = document.getElementById('sidebarEmoji');
        if (info.logo) {
            logoEl.src = info.logo;
            logoEl.alt = info.name || '';
            logoEl.style.display = '';
            emojiEl.style.display = 'none';
        } else {
            logoEl.style.display = 'none';
            // Emoji fallback por esporte
            const emojis = { football: '⚽', others: '🏀', motor: '🏎️' };
            emojiEl.textContent = emojis[info.sport] || '🏆';
            emojiEl.style.display = '';
        }

        // Nome e meta
        document.getElementById('sidebarName').textContent = info.name || '';

        const metaEl = document.getElementById('sidebarMeta');
        if (info.type === 'club') {
            metaEl.textContent = info.full_name || '';
        } else if (info.type === 'competition') {
            metaEl.textContent = info.scope || '';
        } else {
            metaEl.textContent = '';
        }

        // Detalhes específicos
        const detailsEl = document.getElementById('sidebarDetails');
        const pairs = [];

        if (info.type === 'club') {
            if (info.country)       pairs.push(['País',          info.country]);
            if (info.founded_year)  pairs.push(['Fundação',      info.founded_year]);
        } else if (info.type === 'competition') {
            if (info.organizer) pairs.push(['Organização',   info.organizer]);
            if (info.format)    pairs.push(['Sistema',       info.format]);
            if (info.scope)     pairs.push(['Âmbito',        info.scope]);
        }

        detailsEl.innerHTML = pairs.map(([label, value]) => `
            <div class="sidebar-detail-item">
                <span class="sidebar-detail-label">${label}</span>
                <span class="sidebar-detail-value">${value}</span>
            </div>
        `).join('');

        // Descrição
        const descEl = document.getElementById('sidebarDescription');
        descEl.innerHTML = info.description ? `<p>${info.description}</p>` : '';

        // Mostra conteúdo
        document.getElementById('sidebarLoading').style.display = 'none';
        document.getElementById('sidebarContent').style.display = '';
    }
};

/* ─────────────────────────────────────────
   Extensões do APIService para esta página
───────────────────────────────────────── */
Object.assign(APIService, {
    /**
     * Busca partidas filtrando por query (time/competição) e ano opcional.
     */
    async fetchByTeam(page, itemsPerPage) {
        const loadingMessage = LanguageManager.t('loadingData');
        Utils.showNotification(loadingMessage, 'info');

        const url = new URL(CONFIG.API_URLS[CONFIG.currentSport]);
        url.searchParams.append('max_items', 1500);
        url.searchParams.append('page', page);
        url.searchParams.append('search', CollectionState.query);

        if (CollectionState.yearFilter) {
            url.searchParams.append('year', CollectionState.yearFilter);
        }

        if (CONFIG.videoFilter) {
            url.searchParams.append('embed', 'true');
        }

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error('API retornou erro');

        return data;
    }
});

/* ─────────────────────────────────────────
   Patch no Renderer para filtro por ano via API
   (não filtra localmente — dispara nova requisição)
───────────────────────────────────────── */
const _origPopulateYearFilter = Renderer.populateYearFilter.bind(Renderer);
Renderer.populateYearFilter = function () {
    const years = new Set();
    AppState.matches.forEach(match => {
        const dateField = match.Tipo === 'motor' ? match.DataInicio : match.Data;
        const date = Utils.parseDate(dateField);
        if (date) years.add(date.getFullYear());
    });

    const bar = document.getElementById('yearFilterBar');
    if (!bar) return;

    const allYearsText = LanguageManager.t('allYears') || 'Todos';
    const sortedYears  = Array.from(years).sort((a, b) => b - a);

    bar.innerHTML = [null, ...sortedYears].map(year => {
        const isActive = year === CollectionState.yearFilter;
        const label    = year === null ? allYearsText : year;
        return `<button class="year-btn ${isActive ? 'active' : ''}" data-year="${year ?? ''}">${label}</button>`;
    }).join('');

    bar.querySelectorAll('.year-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.year;
            CollectionState.yearFilter = val ? parseInt(val) : null;

            bar.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            AppState.currentPage = 1;
            CollectionApp.loadData();
        });
    });
};

/* ─────────────────────────────────────────
   Patch no CardManager: injetar placar central
   e mover data para inline com a fase
───────────────────────────────────────── */
const _origCardCreate = CardManager.create.bind(CardManager);
CardManager.create = function (match) {
    const card = _origCardCreate(match);

    // ── Fase + data na mesma linha ──
    const compInfo = card.querySelector('.competition-info');
    if (compInfo) {
        const phaseEl = compInfo.querySelector('.match-phase');
        const dateDisplay = Utils.formatMatchDate(match.Data);

        // Substitui o conteúdo do competition-info para incluir a linha fase/data
        const competitionEl = compInfo.querySelector('.match-competition');
        compInfo.innerHTML = `
            ${competitionEl ? competitionEl.outerHTML : ''}
            <div class="match-phase-date-row">
                <span class="match-phase">${phaseEl ? phaseEl.textContent : ''}</span>
                <span class="match-date-inline">${dateDisplay}</span>
            </div>
        `;
    }

    // ── Placar central ──
    const teamsEl = card.querySelector('.match-teams');
    if (teamsEl) {
        const homeGoals = match['Gols mandante'] !== '' && match['Gols mandante'] !== null && match['Gols mandante'] !== undefined
            ? Math.round(parseFloat(match['Gols mandante'])) : '';
        const awayGoals = match['Gols visitante'] !== '' && match['Gols visitante'] !== null && match['Gols visitante'] !== undefined
            ? Math.round(parseFloat(match['Gols visitante'])) : '';

        const homeWinner = homeGoals !== '' && awayGoals !== '' && homeGoals > awayGoals;
        const awayWinner = homeGoals !== '' && awayGoals !== '' && awayGoals > homeGoals;

        const scoreCenter = document.createElement('div');
        scoreCenter.className = 'match-score-center';
        scoreCenter.innerHTML = `
            <span class="score-val ${homeWinner ? 'winner' : awayWinner ? 'loser' : ''}">${homeGoals !== '' ? homeGoals : '-'}</span>
            <span class="score-sep">x</span>
            <span class="score-val ${awayWinner ? 'winner' : homeWinner ? 'loser' : ''}">${awayGoals !== '' ? awayGoals : '-'}</span>
        `;

        // Insere entre os dois .team
        const teams = teamsEl.querySelectorAll('.team');
        if (teams.length === 2) {
            teamsEl.insertBefore(scoreCenter, teams[1]);
        }
    }

    return card;
};

/* ─────────────────────────────────────────
   CollectionApp — controlador principal
───────────────────────────────────────── */
const CollectionApp = {
    applyTheme(sport) {
        CONFIG.currentSport = sport;
        document.body.classList.remove('theme-football', 'theme-others', 'theme-motor');
        if (sport === 'football') document.body.classList.add('theme-football');
        else if (sport === 'others') document.body.classList.add('theme-others');
        else if (sport === 'motor')  document.body.classList.add('theme-motor');
    },

    async loadData() {
        if (!CollectionState.query) return;

        try {
            const apiResponse = await APIService.fetchByTeam(AppState.currentPage, AppState.itemsPerPage);
            PaginationManager.update(apiResponse);
            AppState.matches         = APIService.transformData(apiResponse);
            AppState.filteredMatches = AppState.matches;
            Renderer.populateYearFilter();
            Renderer.render();
            Renderer.updateStats(apiResponse);

            // Mostra controles após primeiro carregamento
            document.getElementById('mainControls').style.display = '';

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
                    <p style="font-size:0.9em;margin-top:10px;">Erro: ${error.message}</p>
                </div>
            `;
        }
    },

    readUrlParams() {
        const params = new URLSearchParams(window.location.search);

        // Redireciona se vier com ?id=
        const id       = parseInt(params.get('id'));
        const sportParam = params.get('sport') || 'football';
        if (id > 0) {
            const validSport = ['football', 'others', 'motor'].includes(sportParam) ? sportParam : 'football';
            window.location.replace(`match.html?id=${id}&sport=${validSport}`);
            return true;
        }

        // Lê query obrigatória
        const q = params.get('q');
        if (!q) {
            document.getElementById('matchesContainer').innerHTML = '';
            document.getElementById('noQueryState').style.display = '';
            document.getElementById('sidebarLoading').style.display = 'none';
            return false;
        }
        CollectionState.query = q;

        // Página inicial
        const page = parseInt(params.get('page'));
        if (page > 0) AppState.currentPage = page;

        // Busca no input
        const search = params.get('search');
        if (search) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = search;
        }

        return false;
    },

    init() {
        const _origPaginationUpdate = PaginationManager.update.bind(PaginationManager);
        PaginationManager.update = function(apiResponse) {
            _origPaginationUpdate(apiResponse);
            const pagination = document.getElementById('pagination');
            const wrapper = pagination.closest('.filter-sub-group').closest('.filter-options');
            if (pagination) {
                pagination.style.display = AppState.totalPages >= 2 ? '' : 'none';
                wrapper.classList.toggle('expand2', AppState.totalPages < 2);
            }
        };

        const _origFilterApply = FilterManager.apply.bind(FilterManager);
        FilterManager.apply = function() {
            const query = document.getElementById('searchInput').value.toLowerCase();
            AppState.filteredMatches = AppState.matches.filter(match =>
                Object.values(match).some(val => String(val).toLowerCase().includes(query))
            );
            Renderer.render();
        };

        LanguageManager.init();
        if (this.readUrlParams()) return;

        if (!CollectionState.query) return;

        // Busca sidebar e lista em paralelo
        SidebarManager.load(CollectionState.query);
        this.loadData();

        // Eventos
        document.getElementById('searchInput').addEventListener('input', () => FilterManager.apply());

        document.getElementById('firstPage').addEventListener('click', () => PaginationManager.goToFirst());
        document.getElementById('prevPage').addEventListener('click',  () => PaginationManager.goToPrevious());
        document.getElementById('nextPage').addEventListener('click',  () => PaginationManager.goToNext());
        document.getElementById('lastPage').addEventListener('click',  () => PaginationManager.goToLast());

        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') MatchModal.close();
        });

        document.addEventListener('keydown', (e) => {
            const modalOpen    = document.getElementById('modal').classList.contains('active');
            const searchFocused = document.activeElement === document.getElementById('searchInput');

            if (e.key === 'Escape' && modalOpen) { MatchModal.close(); return; }
            if (e.key === 'f' && !modalOpen && !searchFocused) {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
        });
    }
};

// Patch: PaginationManager chama CollectionApp.loadData em vez de App.loadData
PaginationManager.goToFirst    = function () { if (AppState.currentPage > 1) { AppState.currentPage = 1; CollectionApp.loadData(); } };
PaginationManager.goToPrevious = function () { if (AppState.currentPage > 1) { AppState.currentPage--; CollectionApp.loadData(); } };
PaginationManager.goToNext     = function () { if (AppState.currentPage < AppState.totalPages) { AppState.currentPage++; CollectionApp.loadData(); } };
PaginationManager.goToLast     = function () { if (AppState.currentPage < AppState.totalPages) { AppState.currentPage = AppState.totalPages; CollectionApp.loadData(); } };

window.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;
    CollectionApp.init();
});