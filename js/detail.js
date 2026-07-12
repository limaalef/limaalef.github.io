/* ─────────────────────────────────────────
   Estado da página
───────────────────────────────────────── */
const CollectionState = {
    query: null,
    type: null,
    yearFilter: null,
};

/* ─────────────────────────────────────────
   SidebarManager — carrega e exibe a sidebar
───────────────────────────────────────── */
const SidebarManager = {
    async load(query) {
        const loading = document.getElementById('sidebarLoading');
        const content = document.getElementById('sidebarContent');

        loading.style.display = 'flex';
        content.style.display = 'none';

        // ── 1. Fonte local (CollectionsDB + collections.json) ───────────────
        if (typeof CollectionsDB !== 'undefined') {
            await CollectionsDB.ready();         // garante que o JSON foi carregado
            const localData = CollectionsDB.find(query);
            if (localData) {
                this.render(localData, query);
                return;
            }
        }

        // ── 2. Fallback: API remota ─────────────────────────────────────
        const apiUrl = typeof CONFIG !== 'undefined' ? CONFIG.CONTEXT_API_URL : null;
        if (!apiUrl) {
            // Sem dado local e sem API configurada: limpa skeleton silenciosamente
            console.warn(`SidebarManager: "${query}" não encontrado no CollectionsDB e CONTEXT_API_URL não configurada.`);
            loading.innerHTML = '';
            return;
        }

        try {
            const url = new URL(apiUrl);
            url.searchParams.set('q', query);

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error('API retornou erro');

            // Opcional: persiste no CollectionsDB para evitar re-fetch nesta sessão
            if (typeof CollectionsDB !== 'undefined') {
                CollectionsDB.upsert({ key: query, ...data.data });
            }

            this.render(data.data, query);
        } catch (err) {
            console.warn('SidebarManager: erro ao carregar contexto via API:', err.message);
            loading.innerHTML = '';
        }
    },

    render(info, query) {
        // Aplica tema conforme esporte retornado
        if (info.sport) {
            CollectionApp.applyTheme(info.sport);
        }

        // Escudo / logo
        const logoEl  = document.getElementById('sidebarLogo');
        logoEl.src = info.logo || `teams_logos/${query}.svg`;
        logoEl.alt = info.name || query;
        logoEl.style.display = '';

        // Nome e meta
        document.getElementById('sidebarName').textContent = info.name || query;

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
        } else {
            detailsEl.style.display = 'none';
        }

        // Pares extras opcionais vindos do CollectionsDB (campo details[])
        if (Array.isArray(info.details)) {
            info.details.forEach(([label, value]) => {
                if (label && value != null) pairs.push([label, value]);
            });
        }

        detailsEl.innerHTML = pairs.map(([label, value]) => `
            <div class="sidebar-detail-item">
                <span class="sidebar-detail-label">${LanguageManager.t(label)}</span>
                <span class="sidebar-detail-value">${value}</span>
            </div>
        `).join('');

        // Descrição
        const descEl = document.getElementById('sidebarDescription');
        if (info.description ==! '') {
            descEl.innerHTML = info.description ? `<p>${info.description}</p>` : '';
        } else {
            descEl.style.display = 'none';
        }

        // Mostra conteúdo
        document.getElementById('sidebarLoading').style.display = 'none';
        document.getElementById('sidebarContent').style.display = '';
    }
};

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

    bar.innerHTML = `<option value=null data-i18n="allYears">${LanguageManager.t('allYears')}</option>`;
 
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        bar.appendChild(opt);
    });
 
    bar.value = CollectionState.yearFilter;
 
    bar.onchange = () => {
        const val = bar.value;
        CollectionState.yearFilter = val ? parseInt(val) : null;
        AppState.currentPage = 1;
        CollectionApp.loadData();
        console.log(CollectionState.yearFilter)
    };
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
        const { homeGoals, homeWinner,
                awayGoals, awayWinner,
                hasWinner } = Utils.parseWinner(match['Gols mandante'], match['Gols visitante']);

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
        Utils.applySportTheme(sport);
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
            console.log(error)
            document.getElementById('matchesContainer').innerHTML =
                Utils.emptyStateHtml(
                    'Erro ao carregar dados',
                    `Verifique a URL da API<br><span style="font-size:0.9em;margin-top:10px;">Erro: ${error.message}</span>`
                );
        }
    },

    readUrlParams() {
        const { id, sport, page, raw: params } = Utils.getUrlParams();

        // Redireciona se vier com ?id=
        if (id > 0) {
            window.location.replace(`match.html?id=${id}&sport=${sport}`);
            return true;
        }

        // Lê query obrigatória
        const q = params.get('q');
        const s_type = params.get('type');
        if (!q) {
            document.getElementById('matchesContainer').innerHTML = '';
            document.getElementById('noQueryState').style.display = '';
            document.getElementById('sidebarLoading').style.display = 'none';
            return false;
        }
        CollectionState.query = q;
        CollectionState.type = s_type;

        // Página inicial
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