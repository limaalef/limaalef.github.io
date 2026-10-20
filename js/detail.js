/* ─────────────────────────────────────────
   Estado da página
───────────────────────────────────────── */
const CollectionState = {
    query: null,
    type: null,
    yearFilter: null,
};

/* ─────────────────────────────────────────
   Tipos de busca suportados (?type=) e as suas imagens
   Cada tipo define o formato da imagem e onde procurá-la. As fontes são tentadas
   em ordem e a primeira que carrega vence:
     1. image/logo do collections.json (ou da API de contexto)
     2. imagem cadastrada no admin (times e narradores: HOME_BROWSE_API_BASE)
     3. convenção de pastas do projeto, abaixo
     4. iniciais do nome (sempre funciona)
   Tipo novo: acrescente uma entrada aqui e uma chave detailType* em translation.js.
───────────────────────────────────────── */
const EntityTypes = (() => {
    const slug = (name, sep) => String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^${sep}+|${sep}+$`, 'g'), '');
    // Mesmo formato que a página inicial usa nos escudos: minúsculas, sem acento, espaço vira "-"
    const legacySlug = name => String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
    const unique = list => [...new Set(list)];

    const TYPES = {
        team: {
            shape: 'emblem', labelKey: 'detailTypeTeam', browseKind: 'teams',
            images: name => unique([`teams_logos/${legacySlug(name)}.svg`, `teams_logos/${slug(name, '-')}.svg`, `teams_logos/${slug(name, '-')}.png`])
        },
        competition: {
            shape: 'emblem', labelKey: 'detailTypeCompetition',
            // Os logos de competição têm ano no nome (copa_do_brasil_2025.png): tenta sem ano e os anos recentes
            images: name => {
                const base = `competition_logos/${slug(name, '_')}`;
                const year = new Date().getFullYear();
                return [`${base}.png`, `${base}.svg`, ...[0, 1, 2, 3].map(back => `${base}_${year - back}.png`)];
            }
        },
        commentary: {
            shape: 'portrait', labelKey: 'detailTypeCommentary', browseKind: 'commentary',
            images: name => ['png', 'webp', 'jpg'].map(ext => `people_icon/${slug(name, '_')}.${ext}`)
        },
        storage: { shape: 'icon', labelKey: 'detailTypeStorage', icon: 'disk', images: () => [] }
    };

    // collections.json usa "club"; a URL usa "team"
    const ALIAS = { club: 'team' };

    return {
        resolve(urlType, infoType) {
            const key = ALIAS[urlType] || urlType || ALIAS[infoType] || infoType;
            return { key, ...(TYPES[key] || { shape: 'emblem', labelKey: '', images: () => [] }) };
        }
    };
})();

const EntityImage = {
    _browse: null,

    // Imagens cadastradas no admin (times e narradores), carregadas uma vez
    async _browseImages() {
        if (this._browse) return this._browse;
        this._browse = (async () => {
            if (typeof CONFIG === 'undefined' || !CONFIG.HOME_BROWSE_API_BASE) return {};
            try {
                const res = await fetch(CONFIG.HOME_BROWSE_API_BASE, { headers: { Accept: 'application/json' } });
                return res.ok ? await res.json() : {};
            } catch { return {}; }
        })();
        return this._browse;
    },

    _normalize: value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(),

    _canLoad(url) {
        return new Promise(resolve => {
            const probe = new Image();
            probe.onload = () => resolve(true);
            probe.onerror = () => resolve(false);
            probe.src = url;
        });
    },

    async _firstThatLoads(urls) {
        for (const url of urls) { if (url && await this._canLoad(url)) return url; }
        return '';
    },

    // Desenha o formato certo e já mostra o fallback; troca pela imagem quando encontrar uma que carrega.
    async render(type, name, info) {
        const holder = document.getElementById('entityImage');
        holder.dataset.shape = type.shape;
        const initials = String(name).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
        holder.innerHTML = type.icon
            ? icon(type.icon, 40)
            : `<span class="entity-image-fallback" aria-hidden="true">${Utils.escapeHtml(initials)}</span>`;

        const fromData = info.logo || info.image || '';
        let fromAdmin = '';
        if (type.browseKind) {
            const browse = await this._browseImages();
            const wanted = this._normalize(name);
            fromAdmin = (browse[type.browseKind] || []).find(i => this._normalize(i.name) === wanted)?.image || '';
        }
        const url = await this._firstThatLoads([fromData, fromAdmin, ...type.images(name)]);
        // A página pode ter mudado de busca enquanto as imagens eram testadas
        if (url && document.getElementById('entityImage') === holder) {
            holder.innerHTML = `<img src="${Utils.escapeHtml(url)}" alt="${Utils.escapeHtml(name)}">`;
        }
    }
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
        if (apiUrl) {
            try {
                const url = new URL(apiUrl);
                url.searchParams.set('q', query);

                const response = await fetch(url.toString());
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (!data.success) throw new Error('API retornou erro');

                // Persiste no CollectionsDB para evitar novo fetch nesta sessão
                if (typeof CollectionsDB !== 'undefined') {
                    CollectionsDB.upsert({ key: query, ...data.data });
                }

                this.render(data.data, query);
                return;
            } catch (err) {
                console.warn('SidebarManager: erro ao carregar contexto via API:', err.message);
            }
        } else {
            console.warn(`SidebarManager: "${query}" não encontrado no CollectionsDB e CONTEXT_API_URL não configurada.`);
        }

        // ── 3. Sem cadastro: o painel mostra o que se sabe pela própria busca (nome, tipo, imagem, números)
        this.render({}, query);
    },

    render(info, query) {
        // Aplica tema conforme esporte retornado
        if (info.sport) {
            CollectionApp.applyTheme(info.sport);
        }

        const type = EntityTypes.resolve(CollectionState.type, info.type);
        const name = info.name || query;

        document.getElementById('sidebarName').textContent = name;
        EntityImage.render(type, name, info);

        // Subtítulo: nome completo (clube), âmbito (competição) ou o próprio tipo da busca
        const typeLabel = type.labelKey ? LanguageManager.t(type.labelKey) : '';
        document.getElementById('sidebarMeta').textContent =
            (info.type === 'club' ? info.full_name : info.type === 'competition' ? info.scope : '') || typeLabel;

        // Detalhes específicos
        const pairs = [];
        if (info.type === 'club') {
            if (info.country)       pairs.push(['País',     info.country]);
            if (info.founded_year)  pairs.push(['Fundação', info.founded_year]);
        } else if (info.type === 'competition') {
            if (info.organizer) pairs.push(['Organização', info.organizer]);
            if (info.format)    pairs.push(['Sistema',     info.format]);
            if (info.scope)     pairs.push(['Âmbito',      info.scope]);
        }

        // Pares extras opcionais vindos do CollectionsDB (campo details[])
        if (Array.isArray(info.details)) {
            info.details.forEach(([label, value]) => {
                if (label && value != null) pairs.push([label, value]);
            });
        }

        const detailsEl = document.getElementById('sidebarDetails');
        detailsEl.innerHTML = pairs.map(([label, value]) => keyValueRow(Utils.escapeHtml(LanguageManager.t(label)), Utils.escapeHtml(value))).join('');
        detailsEl.style.display = pairs.length ? '' : 'none';

        // Descrição (texto cadastrado, sem HTML)
        document.getElementById('sidebarDescription').textContent = info.description || '';

        // Mostra conteúdo
        document.getElementById('sidebarLoading').style.display = 'none';
        document.getElementById('sidebarContent').style.display = '';
    }
};

/* ─────────────────────────────────────────
   Patch no Renderer: filtro por ano (aplicado aos jogos da página carregada)
───────────────────────────────────────── */
Renderer.populateYearFilter = function () {
    const years = new Set();
    AppState.matches.forEach(match => {
        const date = Utils.parseDate(Utils.getItemDate(match));
        if (date) years.add(date.getFullYear());
    });

    const bar = document.getElementById('yearFilterBar');
    if (!bar) return;

    bar.innerHTML = `<option value="" data-i18n="allYears">${LanguageManager.t('allYears')}</option>`;
    [...years].sort((a, b) => b - a).forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        bar.appendChild(opt);
    });

    // Mantém a seleção quando o ano ainda existe na página carregada
    bar.value = years.has(CollectionState.yearFilter) ? CollectionState.yearFilter : '';
    CollectionState.yearFilter = bar.value ? parseInt(bar.value, 10) : null;

    // O filtro vale para os jogos da página carregada (a API ainda não recebe o ano)
    bar.onchange = () => {
        CollectionState.yearFilter = bar.value ? parseInt(bar.value, 10) : null;
        FilterManager.apply();
    };
};

/* ─────────────────────────────────────────
   Layout do card na coleção: placar central e data
   na linha da fase (opção do card único, só p/ partidas)
───────────────────────────────────────── */
CardManager.options.layout = 'detail';

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
            console.error(error);
            document.getElementById('matchesContainer').innerHTML =
                `<div class="detail-state"><h2>${LanguageManager.t('cl_error')}</h2><p>${Utils.escapeHtml(error.message)}</p></div>`;
        }
    },

    async resolveSport() {
        const fromUrl = new URLSearchParams(location.search).get('sport');
        if (Utils.VALID_SPORTS.includes(fromUrl)) { this.applyTheme(fromUrl); return; }
        try {
            if (typeof CollectionsDB !== 'undefined') {
                await CollectionsDB.ready();
                const entry = CollectionsDB.find(CollectionState.query);
                if (entry?.sport && Utils.VALID_SPORTS.includes(entry.sport)) this.applyTheme(entry.sport);
            }
        } catch (err) {
            console.warn('resolveSport:', err.message);
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
            if (pagination) pagination.hidden = AppState.totalPages < 2;
        };

        const _origFilterApply = FilterManager.apply.bind(FilterManager);
        FilterManager.apply = function() {
            const query = document.getElementById('searchInput').value;
            const year = CollectionState.yearFilter;
            AppState.filteredMatches = AppState.matches.filter(match =>
                Utils.matchesSearch(match, query)
                && (!year || Utils.parseDate(Utils.getItemDate(match))?.getFullYear() === year));
            Renderer.render();
        };

        if (this.readUrlParams()) return;

        if (!CollectionState.query) return;

        // Descobre o esporte ANTES de buscar a lista: a URL (?sport=) manda; senão vale o
        // esporte cadastrado no collections.json. Sem isso a busca saía no endpoint de
        // futebol e os cards abriam sempre os dados de futebol.
        this.resolveSport().then(() => {
            SidebarManager.load(CollectionState.query);
            this.loadData();
        });

        // Se o idioma mudar, refaz o filtro (a busca também considera o texto traduzido)
        document.addEventListener('languagechange', () => {
            if (document.getElementById('searchInput')?.value) FilterManager.apply();
        });

        // Eventos
        document.getElementById('searchInput').addEventListener('input', () => FilterManager.apply());

        document.getElementById('firstPage').addEventListener('click', () => PaginationManager.goToFirst());
        document.getElementById('prevPage').addEventListener('click',  () => PaginationManager.goToPrevious());
        document.getElementById('nextPage').addEventListener('click',  () => PaginationManager.goToNext());
        document.getElementById('lastPage').addEventListener('click',  () => PaginationManager.goToLast());

        document.addEventListener('keydown', (e) => {
            const modalOpen    = document.getElementById('modal').classList.contains('active');
            const searchFocused = document.activeElement === document.getElementById('searchInput');

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