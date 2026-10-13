/* ============================================================
   MATCH EDIT — edição completa do matchdata de uma partida (somente administrador).

   Página: match-edit.html?id={id do evento}&sport={football|multisport}
   API:    GET   {ADMIN_API_BASE}/matches/{sport}/{id}/matchdata            → dados crus, por seção
           PATCH {ADMIN_API_BASE}/matches/{sport}/{id}/matchdata/{seção}    → grava UMA seção { version, data }
           GET   {ADMIN_API_BASE}/lookup/{venues|teams|values}?q=           → buscas dos campos

   Segurança: a AUTORIZAÇÃO real é sempre do servidor (token de sessão com isAdmin). Aqui o cliente só
   decide o que mostrar. Todo texto vindo da API é inserido com textContent/value (nunca innerHTML).
   Concorrência: cada seção carrega uma "version"; se outra sessão alterou a seção, o servidor responde 409.
   ============================================================ */
const MatchEdit = (() => {
    'use strict';

    // ── DOM helpers (sem innerHTML) ────────────────────────────────────────
    const DIRECT_PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'htmlFor']);
    function h(tag, props = {}, ...kids) {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(props || {})) {
            if (v === null || v === undefined || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
            else if (DIRECT_PROPS.has(k)) el[k] = v;
            else el.setAttribute(k, v === true ? '' : String(v));
        }
        const add = kid => {
            if (kid === null || kid === undefined || kid === false) return;
            if (Array.isArray(kid)) kid.forEach(add);
            else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
        };
        kids.forEach(add);
        return el;
    }
    const $ = id => document.getElementById(id);
    const clone = x => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));
    const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

    // Normaliza espaços e troca texto vazio por null — igual ao que o servidor faz.
    function clean(v) {
        if (typeof v === 'string') { const s = v.replace(/\s+/g, ' ').trim(); return s === '' ? null : s; }
        if (Array.isArray(v)) return v.map(clean);
        if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
        return v;
    }
    function stable(v) {
        if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
        if (isObj(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
        return JSON.stringify(v === undefined ? null : v);
    }

    // ── Estado ─────────────────────────────────────────────────────────────
    const state = {
        sport: 'football', id: '', ctx: null, matchDataId: '', scrapedAt: '',
        sections: {},          // key → { key, version, original, draft, corrupt, saving, rendered, error }
        active: 'general',
        labels: { venues: {}, teams: {} },   // id → rótulo (para exibir o que está selecionado)
        sessionLost: false,
    };

    class ApiError extends Error {
        constructor(status, message, code, data = {}) { super(message); this.status = status; this.code = code; this.data = data; }
    }

    // ── API ────────────────────────────────────────────────────────────────
    async function api(method, path, body) {
        // adminSession() relê o storage: se o admin entrar de novo em outra aba, o token novo é usado aqui.
        const session = Auth.adminSession();
        if (!session) throw new ApiError(401, 'Sessão de administrador não encontrada. Entre novamente.');
        const res = await session.fetch(`${CONFIG.ADMIN_API_BASE}${path}`, {
            method,
            cache: 'no-store',
            headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
            body: body !== undefined ? JSON.stringify(body) : undefined,
        }, {
            // Não recarrega a página (perderia as edições em andamento).
            onExpired: () => { state.sessionLost = true; showBanner('Sessão expirada. Entre novamente em outra aba e volte a salvar — suas alterações nesta página foram mantidas.', 'err'); },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const fallback = res.status === 403 ? 'Sem permissão (a conta precisa ser administradora).' : `Falha na requisição (HTTP ${res.status}).`;
            throw new ApiError(res.status, json.error || fallback, json.code, json);
        }
        return json;
    }
    const sectionPath = key => `/matches/${encodeURIComponent(state.sport)}/${encodeURIComponent(state.id)}/matchdata${key ? '/' + key : ''}`;

    // ── Constantes de domínio ──────────────────────────────────────────────
    const PLAY_TYPES = [
        ['REGULAR_GOAL', 'Gol'], ['PENALTY_GOAL', 'Gol de pênalti'], ['OWN_GOAL', 'Gol contra'],
        ['YELLOW_CARD', 'Cartão amarelo'], ['RED_CARD', 'Cartão vermelho'], ['SUBSTITUTION', 'Substituição'],
    ];
    const playTypeLabel = t => (PLAY_TYPES.find(([v]) => v === t) || [])[1] || t || '—';
    const POSITIONS = [
        ['Goleiro', 'GOL'], ['Lateral-direito', 'LAD'], ['Lateral-esquerdo', 'LAE'], ['Zagueiro direito', 'ZAD'],
        ['Zagueiro esquerdo', 'ZAE'], ['Volante', 'VOL'], ['Meio-campo', 'MEC'], ['Atacante', 'ATA'],
    ];
    const RESULTS = [['VICTORY', 'Vitória'], ['DRAW', 'Empate'], ['DEFEAT', 'Derrota']];
    const OFFSETS = ['Z', ...Array.from({ length: 27 }, (_, i) => {
        const n = i - 12; const a = Math.abs(n).toString().padStart(2, '0');
        return `${n < 0 ? '-' : '+'}${a}:00`;
    }), '-09:30', '-03:30', '+03:30', '+04:30', '+05:30', '+05:45', '+06:30', '+08:45', '+09:30', '+10:30', '+12:45'];

    const stats = () => (typeof STATS_ORDER !== 'undefined' ? STATS_ORDER : []);
    const statLabel = key => {
        const t = (typeof LanguageManager !== 'undefined' && LanguageManager.t) ? LanguageManager.t(key) : key;
        return t || key;
    };

    // ── Rótulos de estádio/time ────────────────────────────────────────────
    const venueLabel = v => (v ? [v.name, [v.city, v.region].filter(Boolean).join(' / ')].filter(Boolean).join(' — ') : '');
    function teamInfo(side) {
        const g = state.sections.general?.draft || {};
        const id = side === 'home' ? g.home_team_id : g.away_team_id;
        const base = side === 'home' ? state.ctx.home_team : state.ctx.away_team;
        return (id != null && state.labels.teams[id]) || base || null;
    }
    const teamName = side => teamInfo(side)?.nome || (side === 'home' ? 'Mandante' : 'Visitante');

    // ── Dirty / status ─────────────────────────────────────────────────────
    function payloadFor(key) {
        const sec = state.sections[key];
        let draft = clone(sec.draft);
        if (key === 'penalties' && draft) draft.shootout = (draft.shootout || []).map((s, i) => ({ ...s, order: i + 1 }));
        if (key === 'statistics' && draft) {
            for (const side of ['homeTeam', 'awayTeam']) if (draft[side] && !Object.keys(draft[side]).length) delete draft[side];
        }
        return clean(draft);
    }
    const isDirty = key => {
        const sec = state.sections[key];
        if (!sec) return false;
        // Compara o rascunho com o original passando os dois pelo mesmo preparo.
        const orig = { ...sec, draft: sec.original };
        const save = state.sections[key];
        state.sections[key] = orig;
        const a = payloadFor(key);
        state.sections[key] = save;
        return stable(a) !== stable(payloadFor(key));
    };
    const anyDirty = () => Object.keys(state.sections).some(isDirty);

    function refresh(key) {
        const sec = state.sections[key];
        const dirty = isDirty(key);
        const tab = $(`mx-tab-${key}`);
        if (tab) tab.classList.toggle('dirty', dirty);
        const bar = $(`mx-bar-${key}`);
        if (!bar) return;
        bar.querySelector('[data-act="save"]').disabled = !dirty || sec.saving || sec.corrupt;
        bar.querySelector('[data-act="discard"]').disabled = !dirty || sec.saving;
        const status = bar.querySelector('.mx-status');
        if (!sec.error) {
            status.className = 'mx-status';
            status.textContent = sec.corrupt ? 'O conteúdo desta seção no banco não é um JSON válido — edição bloqueada.'
                : dirty ? 'Alterações não salvas.' : '';
        }
    }
    function setStatus(key, text, kind = '') {
        const sec = state.sections[key];
        sec.error = kind === 'err' ? text : null;
        const status = $(`mx-bar-${key}`)?.querySelector('.mx-status');
        if (status) { status.textContent = text; status.className = `mx-status ${kind}`.trim(); }
    }

    // ── Banner global ──────────────────────────────────────────────────────
    function showBanner(text, kind = 'warn') {
        const el = $('mxBanner');
        el.textContent = text;
        el.className = `mx-banner ${kind}`;
        el.hidden = false;
    }
    const hideBanner = () => { $('mxBanner').hidden = true; };

    // ── Campos reutilizáveis ───────────────────────────────────────────────
    let uid = 0;
    const nextId = p => `${p}-${++uid}`;

    function field(label, control, { hint = '', wide = false, id = '' } = {}) {
        const wrap = h('div', { class: `mx-field${wide ? ' wide' : ''}` });
        const lab = h('label', { class: 'mx-label', htmlFor: id || control.id || '' }, label);
        wrap.append(lab, control);
        if (hint) wrap.append(h('div', { class: 'mx-hint' }, hint));
        return wrap;
    }
    function textControl(obj, key, { max = 100, list = '', placeholder = '', onChange, mono = false } = {}) {
        const id = nextId('f');
        const input = h('input', { id, type: 'text', class: `mx-input${mono ? ' mono' : ''}`, maxlength: max, autocomplete: 'off', spellcheck: 'false', placeholder, list: list || null, value: obj[key] ?? '' });
        input.addEventListener('input', () => { obj[key] = input.value; onChange?.(input.value); touchActive(); });
        return input;
    }
    function numControl(obj, key, { min = 0, max = 999999999, step = 1, placeholder = '', onChange } = {}) {
        const id = nextId('f');
        const input = h('input', { id, type: 'number', class: 'mx-input', min, max, step, inputmode: step === 1 ? 'numeric' : 'decimal', placeholder, value: obj[key] ?? '' });
        input.addEventListener('input', () => {
            obj[key] = input.value === '' ? null : Number(input.value);
            onChange?.(obj[key]); touchActive();
        });
        return input;
    }
    function selectControl(options, current, onPick, { id = nextId('f') } = {}) {
        const sel = h('select', { id, class: 'mx-input' });
        options.forEach(([value, label]) => sel.append(h('option', { value, selected: value === current }, label)));
        if (current !== undefined && !options.some(([v]) => v === current)) sel.append(h('option', { value: current ?? '', selected: true }, current ?? '—'));
        sel.addEventListener('change', () => { onPick(sel.value); touchActive(); });
        return sel;
    }
    function iconBtn(label, glyph, onClick, { danger = false, disabled = false } = {}) {
        return h('button', { type: 'button', class: `mx-icon-btn${danger ? ' danger' : ''}`, 'aria-label': label, title: label, disabled, onClick }, glyph);
    }
    function actionBtn(label, onClick, { kind = 'ghost', small = false, disabled = false } = {}) {
        return h('button', { type: 'button', class: `action-btn btn-${kind}${small ? ' btn-xs' : ''}`, disabled, onClick }, label);
    }
    function move(list, i, d) {
        const j = i + d;
        if (j < 0 || j >= list.length) return false;
        [list[i], list[j]] = [list[j], list[i]];
        return true;
    }

    // Listas de sugestões (datalist) alimentadas pela API (competição, edição, rodada, status)
    const valueLists = {};
    function valueDatalist(field) {
        if (valueLists[field]) return valueLists[field].id;
        const dl = h('datalist', { id: `mx-dl-${field}` });
        document.body.appendChild(dl);
        valueLists[field] = dl;
        let timer = null;
        const load = async q => {
            try {
                const { data } = await api('GET', `/lookup/values?field=${field}&q=${encodeURIComponent(q || '')}`);
                dl.replaceChildren(...data.map(v => h('option', { value: v })));
            } catch { /* sugestão é opcional */ }
        };
        load('');
        dl.refresh = q => { clearTimeout(timer); timer = setTimeout(() => load(q), 250); };
        return dl.id;
    }
    function staticDatalist(id, values) {
        if (!$(id)) document.body.appendChild(h('datalist', { id }, values.map(v => h('option', { value: v }))));
        return id;
    }

    // ── Seletor com busca (modal) ──────────────────────────────────────────
    function openPicker({ title, placeholder, search, onPick, onClear, clearLabel = 'Remover seleção' }) {
        const opener = document.activeElement;
        let seq = 0, timer = null;
        const input = h('input', { type: 'text', class: 'mx-input', placeholder, autocomplete: 'off', spellcheck: 'false', 'aria-label': placeholder });
        const list = h('div', { class: 'mx-picker-list', role: 'listbox', 'aria-label': title });
        const closeBtn = h('button', { type: 'button', class: 'mx-icon-btn', 'aria-label': 'Fechar', onClick: close }, '✕');
        const box = h('div', { class: 'modal-content mx-picker-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            h('div', { class: 'mx-picker-head' }, h('div', { class: 'mx-picker-title' }, title), closeBtn),
            h('div', { class: 'mx-picker-search' }, input),
            list,
            onClear ? h('div', { class: 'mx-picker-foot' }, actionBtn(clearLabel, () => { onClear(); close(); }, { kind: 'danger', small: true })) : null);
        const modal = h('div', { class: 'modal active mx-picker' }, box);

        function close() {
            clearTimeout(timer);
            document.removeEventListener('keydown', onKey, true);
            modal.remove();
            document.body.classList.remove('mx-lock');
            opener?.focus?.();
        }
        function onKey(e) {
            if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
            if (e.key === 'Tab') {   // mantém o foco dentro do diálogo
                const f = [...box.querySelectorAll('button, input')].filter(x => !x.disabled);
                if (!f.length) return;
                const first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && box.contains(document.activeElement)) {
                const items = [...list.querySelectorAll('button')];
                if (!items.length) return;
                e.preventDefault();
                const idx = items.indexOf(document.activeElement);
                const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx <= 0 ? items.length - 1 : idx - 1);
                items[next].focus();
            }
        }
        async function run(q) {
            const mine = ++seq;
            list.setAttribute('aria-busy', 'true');
            try {
                const items = await search(q);
                if (mine !== seq) return;   // resposta velha
                list.replaceChildren(...(items.length ? items.map(it => h('button', {
                    type: 'button', class: 'mx-picker-item', role: 'option',
                    onClick: () => { onPick(it); close(); },
                }, h('span', { class: 'mx-picker-main' }, it.primary), it.secondary ? h('span', { class: 'mx-picker-sub' }, it.secondary) : null))
                    : [h('div', { class: 'mx-picker-empty' }, 'Nada encontrado.')]));
            } catch (err) {
                if (mine === seq) list.replaceChildren(h('div', { class: 'mx-picker-empty err' }, err.message || 'Falha na busca.'));
            } finally { if (mine === seq) list.removeAttribute('aria-busy'); }
        }
        input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(input.value), 250); });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); list.querySelector('button')?.click(); } });
        modal.addEventListener('mousedown', e => { if (e.target === modal) close(); });
        document.addEventListener('keydown', onKey, true);
        document.body.append(modal);
        document.body.classList.add('mx-lock');
        input.focus();
        run('');
    }

    function pickerField(label, { text, empty, onOpen, onClear }) {
        const id = nextId('f');
        const btn = h('button', { id, type: 'button', class: 'mx-pick-btn', onClick: onOpen });
        const clear = h('button', { type: 'button', class: 'mx-icon-btn', 'aria-label': `Remover ${label.toLowerCase()}`, title: 'Remover', onClick: onClear }, '✕');
        const update = value => {
            btn.textContent = value || empty;
            btn.classList.toggle('placeholder', !value);
            clear.hidden = !value;
        };
        update(text);
        const wrap = field(label, h('div', { class: 'mx-pick' }, btn, clear), { id, wide: true });
        wrap.update = update;
        return wrap;
    }

    // ── Painel: Geral ──────────────────────────────────────────────────────
    function renderGeneral(body, sec) {
        const d = sec.draft;
        const grid = h('div', { class: 'mx-grid' });

        grid.append(
            field('Competição', textControl(d, 'competition', { max: 120, list: valueDatalist('competition'), onChange: v => valueLists.competition.refresh(v) })),
            field('Edição', textControl(d, 'edition', { max: 120, list: valueDatalist('edition'), onChange: v => valueLists.edition.refresh(v) })),
            field('Rodada / fase', textControl(d, 'matchday', { max: 60, list: valueDatalist('matchday'), onChange: v => valueLists.matchday.refresh(v) })),
            field('Status', textControl(d, 'status', { max: 40, list: valueDatalist('status'), onChange: v => valueLists.status.refresh(v) })),
            dateTimeField(d),
        );

        // Estádio
        const venueText = () => venueLabel(d.venue_id != null ? state.labels.venues[d.venue_id] : null);
        const venueF = pickerField('Estádio', {
            text: venueText(), empty: 'Escolher estádio…',
            onOpen: () => openPicker({
                title: 'Escolher estádio', placeholder: 'Buscar por nome ou cidade…',
                search: async q => (await api('GET', `/lookup/venues?q=${encodeURIComponent(q)}`)).data.map(v => ({
                    ...v, primary: v.name, secondary: [[v.city, v.region].filter(Boolean).join(' / '), v.capacity ? `${v.capacity.toLocaleString('pt-BR')} lugares` : ''].filter(Boolean).join(' · '),
                })),
                onPick: v => { state.labels.venues[v.id] = v; d.venue_id = v.id; venueF.update(venueText()); touchActive(); },
                onClear: d.venue_id != null ? () => { d.venue_id = null; venueF.update(''); touchActive(); } : null,
                clearLabel: 'Remover estádio',
            }),
            onClear: () => { d.venue_id = null; venueF.update(''); touchActive(); },
        });
        grid.append(venueF);

        // Times
        const teamPicker = (side, label) => {
            const idKey = `${side}_team_id`, nameKey = `${side}_team_name`;
            const text = () => {
                if (d[idKey] == null) return d[nameKey] || '';
                const t = state.labels.teams[d[idKey]];
                return t ? `${t.nome}${t.tla ? ` (${t.tla})` : ''}` : `${d[nameKey] || 'Time'} (#${d[idKey]})`;
            };
            const f = pickerField(label, {
                text: text(), empty: 'Escolher time…',
                onOpen: () => openPicker({
                    title: `Escolher ${label.toLowerCase()}`, placeholder: 'Buscar por nome, sigla ou slug…',
                    search: async q => (await api('GET', `/lookup/teams?q=${encodeURIComponent(q)}`)).data.map(t => ({
                        ...t, primary: t.nome, secondary: [t.tla, t.pais_origem].filter(Boolean).join(' · '),
                    })),
                    onPick: t => { state.labels.teams[t.id] = t; d[idKey] = t.id; d[nameKey] = t.nome; f.update(text()); touchActive(); },
                    onClear: d[idKey] != null ? () => { d[idKey] = null; d[nameKey] = null; f.update(''); touchActive(); } : null,
                    clearLabel: `Remover ${label.toLowerCase()}`,
                }),
                onClear: () => { d[idKey] = null; d[nameKey] = null; f.update(''); touchActive(); },
            });
            return f;
        };
        grid.append(teamPicker('home', 'Mandante'), teamPicker('away', 'Visitante'));
        grid.append(
            field('Gols do mandante', numControl(d, 'home_score', { min: 0, max: 99 })),
            field('Gols do visitante', numControl(d, 'away_score', { min: 0, max: 99 })),
        );

        body.append(
            h('p', { class: 'mx-note' }, 'Trocar o time não altera os lances, pênaltis e escalações já gravados — ajuste-os nas respectivas abas se necessário.'),
            grid,
        );
    }

    function dateTimeField(d) {
        const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(d.utc_date || '');
        const offsets = m && !OFFSETS.includes(m[4]) ? [...OFFSETS, m[4]] : OFFSETS;
        const id = nextId('f');
        const input = h('input', { id, type: 'datetime-local', step: '1', class: 'mx-input', value: m ? `${m[1]}T${m[2]}${m[3] || ':00'}` : '' });
        const sel = h('select', { class: 'mx-input mx-offset', 'aria-label': 'Fuso horário' });
        offsets.forEach(o => sel.append(h('option', { value: o, selected: o === (m ? m[4] : '-03:00') }, o === 'Z' ? 'UTC' : `UTC${o}`)));
        const sync = () => {
            let v = input.value;
            if (!v) d.utc_date = null;
            else { if (v.length === 16) v += ':00'; d.utc_date = `${v}${sel.value}`; }
            touchActive();
        };
        input.addEventListener('input', sync);
        sel.addEventListener('change', sync);
        return field('Data e hora', h('div', { class: 'mx-datetime' }, input, sel), { id, wide: true, hint: 'Horário local do jogo e o fuso em que ele foi registrado.' });
    }

    // ── Painel: Escalação ──────────────────────────────────────────────────
    function renderLineup(body, sec, side) {
        const rerender = () => { body.replaceChildren(); renderLineup(body, sec, side); touchActive(); };
        if (!sec.draft) {
            body.append(h('div', { class: 'mx-empty' },
                h('p', {}, `Sem escalação cadastrada para ${teamName(side)}.`),
                actionBtn('Criar escalação', () => { sec.draft = { formation: null, coach: null, startingXI: [], substitute: [] }; rerender(); }, { kind: 'primary' })));
            return;
        }
        const l = sec.draft;
        l.startingXI ??= []; l.substitute ??= [];
        body.append(
            h('div', { class: 'mx-grid' },
                field('Formação', textControl(l, 'formation', { max: 20, placeholder: 'ex.: 4-3-3' })),
                field('Técnico', textControl(l, 'coach', { max: 100 }))),
            lineupList(l, 'startingXI', 'Titulares', 'substitute', rerender),
            lineupList(l, 'substitute', 'Reservas', 'startingXI', rerender),
            h('div', { class: 'mx-danger-zone' },
                actionBtn('Remover escalação inteira', () => {
                    if (!confirm('Remover toda a escalação deste time? (a seção só é gravada quando você salvar)')) return;
                    sec.draft = null; rerender();
                }, { kind: 'danger', small: true })),
        );
    }

    function lineupList(lineup, listName, title, otherName, rerender) {
        const list = lineup[listName];
        const posList = staticDatalist('mx-dl-positions', POSITIONS.map(p => p[0]));
        const count = h('span', { class: 'mx-count' }, String(list.length));
        const head = h('div', { class: 'mx-list-head' },
            h('h3', { class: 'mx-list-title' }, title, ' ', count),
            actionBtn('+ Jogador', () => {
                list.push({ name: null, fullName: null, position: null, posSlug: null, shirtNumber: null });
                rerender();
            }, { small: true }));
        const warn = listName === 'startingXI' && list.length !== 11
            ? h('div', { class: 'mx-hint warn' }, `${list.length} titulares (o usual é 11).`) : null;

        const rows = list.map((p, i) => {
            const posSlug = h('input', { type: 'text', class: 'mx-input mono', maxlength: 6, 'aria-label': 'Sigla da posição', value: p.posSlug ?? '' });
            posSlug.addEventListener('input', () => { p.posSlug = posSlug.value; touchActive(); });
            const pos = h('input', { type: 'text', class: 'mx-input', maxlength: 40, list: posList, 'aria-label': 'Posição', placeholder: 'Posição', value: p.position ?? '' });
            pos.addEventListener('input', () => {
                p.position = pos.value;
                const known = POSITIONS.find(([n]) => n === pos.value);
                if (known) { p.posSlug = known[1]; posSlug.value = known[1]; }
                touchActive();
            });
            const num = h('input', { type: 'text', class: 'mx-input mx-num', maxlength: 4, inputmode: 'numeric', 'aria-label': 'Número da camisa', placeholder: '#', value: p.shirtNumber ?? '' });
            num.addEventListener('input', () => { p.shirtNumber = num.value; touchActive(); });
            const name = h('input', { type: 'text', class: 'mx-input', maxlength: 100, 'aria-label': 'Nome popular', placeholder: 'Nome popular', value: p.name ?? '' });
            name.addEventListener('input', () => { p.name = name.value; touchActive(); });
            const full = h('input', { type: 'text', class: 'mx-input', maxlength: 150, 'aria-label': 'Nome completo', placeholder: 'Nome completo', value: p.fullName ?? '' });
            full.addEventListener('input', () => { p.fullName = full.value; touchActive(); });

            return h('div', { class: 'mx-row mx-player' },
                h('div', { class: 'mx-player-main' }, num, name, full),
                h('div', { class: 'mx-player-pos' }, pos, posSlug),
                h('div', { class: 'mx-row-actions' },
                    iconBtn('Mover para cima', '↑', () => { if (move(list, i, -1)) rerender(); }, { disabled: i === 0 }),
                    iconBtn('Mover para baixo', '↓', () => { if (move(list, i, 1)) rerender(); }, { disabled: i === list.length - 1 }),
                    iconBtn(listName === 'startingXI' ? 'Mover para os reservas' : 'Mover para os titulares', '⇄', () => { lineup[otherName].push(list.splice(i, 1)[0]); rerender(); }),
                    iconBtn('Remover jogador', '✕', () => { list.splice(i, 1); rerender(); }, { danger: true })));
        });

        return h('section', { class: 'mx-list' }, head, warn, rows.length ? rows : h('div', { class: 'mx-empty small' }, 'Nenhum jogador.'));
    }

    // ── Painel: Lances ─────────────────────────────────────────────────────
    function sideOf(p) {
        const home = teamInfo('home'), away = teamInfo('away');
        if (home && ((p.teamId != null && p.teamId === home.id) || (p.teamAbbr && p.teamAbbr === home.tla))) return 'home';
        if (away && ((p.teamId != null && p.teamId === away.id) || (p.teamAbbr && p.teamAbbr === away.tla))) return 'away';
        return (p.teamId == null && !p.teamAbbr) ? '' : 'other';
    }
    function setSide(p, side) {
        const t = side ? teamInfo(side) : null;
        p.teamId = t?.id ?? null; p.teamAbbr = t?.tla ?? null; p.teamSlug = t?.slug ?? null;
    }
    function sideSelect(p, rerender) {
        const cur = sideOf(p);
        const opts = [['', '—'], ['home', teamName('home')], ['away', teamName('away')]];
        if (cur === 'other') opts.push(['other', `Outro (${p.teamAbbr || p.teamId}) — mantido`]);
        return selectControl(opts, cur, v => { if (v !== 'other') { setSide(p, v); rerender?.(); } });
    }

    // Jogadores das escalações (rascunho atual) para preencher nomes sem digitar
    function lineupPlayers(side) {
        const l = state.sections[`lineup_${side}`]?.draft;
        return [...(l?.startingXI || []), ...(l?.substitute || [])].filter(p => p.name || p.fullName);
    }
    function pickFromLineup(side, onPick) {
        const players = lineupPlayers(side);
        if (!players.length) { Utils.showNotification(`A escalação de ${teamName(side)} está vazia.`, 'warning'); return; }
        openPicker({
            title: `Escalação · ${teamName(side)}`, placeholder: 'Filtrar jogador…',
            search: async q => {
                const n = Utils.normalizeSearch(q);
                return players.filter(p => !n || Utils.normalizeSearch(`${p.name} ${p.fullName} ${p.shirtNumber}`).includes(n))
                    .map(p => ({ ...p, primary: p.name || p.fullName, secondary: [p.shirtNumber ? `#${p.shirtNumber}` : '', p.fullName !== p.name ? p.fullName : '', p.posSlug].filter(Boolean).join(' · ') }));
            },
            onPick,
        });
    }

    function renderPlays(body, sec) {
        const plays = sec.draft;
        const listBox = h('div', { class: 'mx-rows' });
        const summary = h('div', { class: 'mx-hint' });
        const redraw = () => {
            listBox.replaceChildren(...plays.map((p, i) => playRow(plays, i, redraw)));
            const goals = plays.filter(p => /GOAL/.test(p.playType || '')).length;
            summary.textContent = `${plays.length} lance(s) · ${goals} gol(s)`;
            touchActive();
        };
        const timeKey = p => [p.period ?? 0, p.realMinute ?? parseInt(p.minute, 10) ?? 0];
        body.append(
            h('div', { class: 'mx-list-head' }, summary, h('div', { class: 'mx-head-actions' },
                actionBtn('Ordenar por tempo', () => {
                    plays.sort((a, b) => { const [pa, ma] = timeKey(a), [pb, mb] = timeKey(b); return pa - pb || ma - mb; });
                    redraw();
                }, { small: true }),
                actionBtn('+ Lance', () => {
                    const last = plays[plays.length - 1];
                    const p = { minute: last?.minute ?? 1, realMinute: last?.realMinute ?? 1, period: last?.period ?? 1, periodLabel: last?.periodLabel ?? '1T', playType: 'YELLOW_CARD', name: null, popularName: null, shirtNumber: null, slug: null, teamAbbr: null, teamId: null, teamSlug: null };
                    setSide(p, 'home');
                    plays.push(p); redraw();
                    listBox.lastElementChild?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, { kind: 'primary', small: true }))),
            listBox);
        redraw();
        touchActive();
        refresh(sec.key);
    }

    function playRow(plays, i, redraw) {
        const p = plays[i];
        const isSub = p.playType === 'SUBSTITUTION';
        const rowEl = h('div', { class: 'mx-row' });
        const rerenderRow = () => { rowEl.replaceWith(playRow(plays, i, redraw)); touchActive(); };

        const minute = h('input', { type: 'text', class: 'mx-input', maxlength: 6, 'aria-label': 'Minuto', placeholder: 'ex.: 45+2', value: p.minute ?? '' });
        minute.addEventListener('input', () => { p.minute = /^\d{1,3}$/.test(minute.value.trim()) ? Number(minute.value.trim()) : minute.value.trim(); touchActive(); });
        const period = numControl(p, 'period', { min: 1, max: 9, onChange: v => { if (!p.periodLabel && v) { p.periodLabel = `${v}T`; label.value = p.periodLabel; } } });
        const label = textControl(p, 'periodLabel', { max: 20 });
        const typeOpts = [...PLAY_TYPES];
        const typeSel = selectControl(typeOpts, p.playType, v => { p.playType = v; if (v === 'SUBSTITUTION') { p.playerIn ??= { name: null, popularName: null }; p.playerOut ??= { name: null, popularName: null }; } rerenderRow(); });

        const summary = `${i + 1}. ${p.minute ?? '?'}' · ${playTypeLabel(p.playType)}${isSub ? '' : ` · ${p.popularName || p.name || '—'}`}`;
        const head = h('div', { class: 'mx-row-head' },
            h('div', { class: 'mx-row-title' }, summary),
            h('div', { class: 'mx-row-actions' },
                iconBtn('Mover para cima', '↑', () => { if (move(plays, i, -1)) redraw(); }, { disabled: i === 0 }),
                iconBtn('Mover para baixo', '↓', () => { if (move(plays, i, 1)) redraw(); }, { disabled: i === plays.length - 1 }),
                iconBtn('Duplicar lance', '⧉', () => { plays.splice(i + 1, 0, clone(p)); redraw(); }),
                iconBtn('Remover lance', '✕', () => { plays.splice(i, 1); redraw(); }, { danger: true })));

        const grid = h('div', { class: 'mx-grid sm' },
            field('Tipo', typeSel), field('Time', sideSelect(p, rerenderRow)),
            field('Período', period), field('Rótulo', label),
            field('Minuto', minute), field('Minuto real', numControl(p, 'realMinute', { min: 0, max: 300 })));

        const personBox = (title, obj, side) => {
            const popular = textControl(obj, 'popularName', { max: 100 });
            const full = textControl(obj, 'name', { max: 100 });
            const more = [];
            if (Object.hasOwn(obj, 'shirtNumber') || !isSub) more.push(field('Camisa', textControl(obj, 'shirtNumber', { max: 4 })));
            more.push(field('Slug', textControl(obj, 'slug', { max: 100, mono: true })));
            return h('div', { class: 'mx-person' },
                h('div', { class: 'mx-person-head' }, h('span', {}, title),
                    actionBtn('Da escalação', () => pickFromLineup(sideOf(p) || side, pl => {
                        obj.popularName = pl.name || null; obj.name = pl.fullName || null; obj.shirtNumber = pl.shirtNumber ?? obj.shirtNumber ?? null;
                        rerenderRow();
                    }), { small: true })),
                h('div', { class: 'mx-grid sm' }, field('Nome popular', popular), field('Nome completo', full)),
                h('details', { class: 'mx-more' }, h('summary', {}, 'Mais campos'), h('div', { class: 'mx-grid sm' }, more)));
        };

        if (isSub) {
            p.playerIn ??= { name: null, popularName: null };
            p.playerOut ??= { name: null, popularName: null };
            rowEl.append(head, grid, h('div', { class: 'mx-persons' }, personBox('Entra ▲', p.playerIn, 'home'), personBox('Sai ▼', p.playerOut, 'home')));
        } else {
            rowEl.append(head, grid, h('div', { class: 'mx-persons' }, personBox('Jogador', p, 'home')));
        }
        return rowEl;
    }

    // ── Painel: Pênaltis ───────────────────────────────────────────────────
    function renderPenalties(body, sec) {
        const d = sec.draft;
        d.shootout ??= [];
        const listBox = h('div', { class: 'mx-rows' });
        const homeIn = numControl(d, 'home', { min: 0, max: 99 });
        const awayIn = numControl(d, 'away', { min: 0, max: 99 });
        const redraw = () => {
            listBox.replaceChildren(...d.shootout.map((s, i) => penaltyRow(d.shootout, i, redraw)));
            touchActive();
        };
        const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);
        body.append(
            h('div', { class: 'mx-grid' },
                field(`Pênaltis — ${teamName('home')}`, homeIn), field(`Pênaltis — ${teamName('away')}`, awayIn)),
            h('div', { class: 'mx-list-head' },
                h('h3', { class: 'mx-list-title' }, 'Cobranças'),
                h('div', { class: 'mx-head-actions' },
                    actionBtn('Calcular placar', () => {
                        d.home = d.shootout.filter(s => s.scored && sideOf(s) === 'home').length;
                        d.away = d.shootout.filter(s => s.scored && sideOf(s) === 'away').length;
                        homeIn.value = d.home; awayIn.value = d.away; touchActive();
                    }, { small: true }),
                    actionBtn('+ Cobrança', () => {
                        const last = d.shootout[d.shootout.length - 1];
                        const s = { playId: uuid(), name: null, popularName: null, slug: null, teamAbbr: null, teamId: null, teamSlug: null, scored: true, order: d.shootout.length + 1 };
                        setSide(s, last ? (sideOf(last) === 'home' ? 'away' : 'home') : 'home');
                        d.shootout.push(s); redraw();
                    }, { kind: 'primary', small: true }))),
            listBox);
        redraw();
    }

    function penaltyRow(list, i, redraw) {
        const s = list[i];
        const rowEl = h('div', { class: 'mx-row' });
        const rerenderRow = () => { rowEl.replaceWith(penaltyRow(list, i, redraw)); touchActive(); };
        const scored = h('input', { type: 'checkbox', id: nextId('f'), checked: !!s.scored });
        scored.addEventListener('change', () => { s.scored = scored.checked; touchActive(); });
        rowEl.append(
            h('div', { class: 'mx-row-head' },
                h('div', { class: 'mx-row-title' }, `${i + 1}ª cobrança · ${s.popularName || s.name || '—'}`),
                h('div', { class: 'mx-row-actions' },
                    iconBtn('Mover para cima', '↑', () => { if (move(list, i, -1)) redraw(); }, { disabled: i === 0 }),
                    iconBtn('Mover para baixo', '↓', () => { if (move(list, i, 1)) redraw(); }, { disabled: i === list.length - 1 }),
                    iconBtn('Remover cobrança', '✕', () => { list.splice(i, 1); redraw(); }, { danger: true }))),
            h('div', { class: 'mx-grid sm' },
                field('Time', sideSelect(s, rerenderRow)),
                field('Nome popular', textControl(s, 'popularName', { max: 100 })),
                field('Nome completo', textControl(s, 'name', { max: 100 })),
                h('div', { class: 'mx-field mx-check' }, scored, h('label', { htmlFor: scored.id }, 'Converteu'))),
            h('div', { class: 'mx-row-tools' },
                actionBtn('Da escalação', () => pickFromLineup(sideOf(s) || 'home', pl => {
                    s.popularName = pl.name || null; s.name = pl.fullName || null; rerenderRow();
                }), { small: true })));
        return rowEl;
    }

    // ── Painel: Estatísticas ───────────────────────────────────────────────
    function renderStatistics(body, sec) {
        sec.draft ??= {};
        const d = sec.draft;
        d.homeTeam ??= {}; d.awayTeam ??= {};
        const table = h('div', { class: 'mx-stats' });
        const keys = () => {
            const all = new Set([...Object.keys(d.homeTeam), ...Object.keys(d.awayTeam)]);
            const order = stats();
            return [...all].sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999) || a.localeCompare(b));
        };
        const redraw = () => {
            table.replaceChildren(
                h('div', { class: 'mx-stats-row head' }, h('span', {}, teamName('home')), h('span', {}, 'Estatística'), h('span', {}, teamName('away')), h('span', {})),
                ...keys().map(key => {
                    const cell = side => {
                        const obj = d[side][key] ??= null;
                        const input = h('input', { type: 'number', class: 'mx-input', min: 0, step: 'any', inputmode: 'decimal', 'aria-label': `${statLabel(key)} — ${teamName(side === 'homeTeam' ? 'home' : 'away')}`, value: obj?.total ?? '' });
                        input.addEventListener('input', () => {
                            if (input.value === '') delete d[side][key];
                            else { d[side][key] = { ...(d[side][key] || {}), total: Number(input.value) }; }
                            touchActive();
                        });
                        if (obj === null) delete d[side][key];
                        return input;
                    };
                    return h('div', { class: 'mx-stats-row' }, cell('homeTeam'),
                        h('div', { class: 'mx-stat-name' }, statLabel(key), h('span', { class: 'mx-stat-key' }, key)),
                        cell('awayTeam'),
                        iconBtn(`Remover ${statLabel(key)}`, '✕', () => { delete d.homeTeam[key]; delete d.awayTeam[key]; redraw(); }, { danger: true }));
                }));
            if (!keys().length) table.append(h('div', { class: 'mx-empty small' }, 'Nenhuma estatística.'));
            touchActive();
        };

        const addSel = h('select', { class: 'mx-input', 'aria-label': 'Adicionar estatística' });
        const custom = h('input', { type: 'text', class: 'mx-input mono', placeholder: 'chave personalizada', maxlength: 40, 'aria-label': 'Chave personalizada' });
        const addBtn = actionBtn('+ Adicionar', () => {
            const key = (custom.value.trim() || addSel.value);
            if (!key) return;
            if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(key)) { Utils.showNotification('Chave inválida: use letras e números, começando por letra.', 'warning'); return; }
            if (!Object.hasOwn(d.homeTeam, key) && !Object.hasOwn(d.awayTeam, key)) { d.homeTeam[key] = { total: 0 }; d.awayTeam[key] = { total: 0 }; }
            custom.value = ''; fillAdd(); redraw();
        }, { kind: 'primary', small: true });
        const fillAdd = () => {
            const present = new Set(keys());
            addSel.replaceChildren(h('option', { value: '' }, 'Escolher estatística…'),
                ...stats().filter(k => !present.has(k)).map(k => h('option', { value: k }, statLabel(k))));
        };
        fillAdd();
        body.append(table, h('div', { class: 'mx-add-stat' }, addSel, custom, addBtn),
            h('p', { class: 'mx-hint' }, 'Deixe um dos lados em branco para não informar a estatística daquele time.'));
        redraw();
    }

    // ── Painel: Árbitros ───────────────────────────────────────────────────
    function renderReferees(body, sec) {
        sec.draft ??= {};
        const d = sec.draft;
        d.assistants ??= [];
        const box = h('div', { class: 'mx-rows' });
        const redraw = () => {
            box.replaceChildren(...d.assistants.map((_, i) => {
                const input = h('input', { type: 'text', class: 'mx-input', maxlength: 100, 'aria-label': `Assistente ${i + 1}`, value: d.assistants[i] ?? '' });
                input.addEventListener('input', () => { d.assistants[i] = input.value; touchActive(); });
                return h('div', { class: 'mx-row inline' }, input,
                    h('div', { class: 'mx-row-actions' },
                        iconBtn('Mover para cima', '↑', () => { if (move(d.assistants, i, -1)) redraw(); }, { disabled: i === 0 }),
                        iconBtn('Mover para baixo', '↓', () => { if (move(d.assistants, i, 1)) redraw(); }, { disabled: i === d.assistants.length - 1 }),
                        iconBtn('Remover assistente', '✕', () => { d.assistants.splice(i, 1); redraw(); }, { danger: true })));
            }));
            touchActive();
        };
        body.append(
            h('div', { class: 'mx-grid' }, field('Árbitro', textControl(d, 'referee')), field('Quarto árbitro', textControl(d, 'fourth_official'))),
            h('div', { class: 'mx-list-head' }, h('h3', { class: 'mx-list-title' }, 'Assistentes'),
                actionBtn('+ Assistente', () => { if (d.assistants.length >= 6) return; d.assistants.push(''); redraw(); }, { small: true })),
            box);
        redraw();
    }

    // ── Painel: Público e renda ────────────────────────────────────────────
    function renderAttendance(body, sec) {
        const d = sec.draft;
        d.attendance ??= [];
        const labels = staticDatalist('mx-dl-att', ['Público pagante', 'Público total']);
        const box = h('div', { class: 'mx-rows' });
        const revBox = h('div', { class: 'mx-revenue' });
        const redrawAtt = () => {
            box.replaceChildren(...d.attendance.map((a, i) => h('div', { class: 'mx-row inline' },
                h('div', { class: 'mx-grid sm' },
                    field('Descrição', textControl(a, 'label', { max: 60, list: labels })),
                    field('Pessoas', numControl(a, 'value', { min: 0, max: 3000000 }))),
                h('div', { class: 'mx-row-actions' },
                    iconBtn('Mover para cima', '↑', () => { if (move(d.attendance, i, -1)) redrawAtt(); }, { disabled: i === 0 }),
                    iconBtn('Mover para baixo', '↓', () => { if (move(d.attendance, i, 1)) redrawAtt(); }, { disabled: i === d.attendance.length - 1 }),
                    iconBtn('Remover linha', '✕', () => { d.attendance.splice(i, 1); redrawAtt(); }, { danger: true })))));
            if (!d.attendance.length) box.append(h('div', { class: 'mx-empty small' }, 'Sem público informado.'));
            touchActive();
        };
        const redrawRev = () => {
            revBox.replaceChildren();
            if (!d.revenue) {
                revBox.append(h('div', { class: 'mx-empty small' }, 'Sem renda informada. ',
                    actionBtn('Informar renda', () => { d.revenue = { value: 0, currency: 'BRL', averageTicket: null }; redrawRev(); }, { small: true })));
            } else {
                revBox.append(
                    h('div', { class: 'mx-grid' },
                        field('Renda bruta', numControl(d.revenue, 'value', { min: 0, max: 1e12, step: 'any' })),
                        field('Moeda', selectControl([['BRL', 'BRL — Real'], ['USD', 'USD — Dólar'], ['EUR', 'EUR — Euro']], d.revenue.currency, v => { d.revenue.currency = v; })),
                        field('Ingresso médio', numControl(d.revenue, 'averageTicket', { min: 0, max: 1e7, step: 'any' }), { hint: 'Opcional.' })),
                    h('div', { class: 'mx-danger-zone' }, actionBtn('Remover renda', () => { d.revenue = null; redrawRev(); }, { kind: 'danger', small: true })));
            }
            touchActive();
        };
        body.append(
            h('div', { class: 'mx-list-head' }, h('h3', { class: 'mx-list-title' }, 'Público'),
                actionBtn('+ Linha', () => { if (d.attendance.length >= 10) return; d.attendance.push({ value: 0, label: d.attendance.length ? 'Público total' : 'Público pagante' }); redrawAtt(); }, { small: true })),
            box,
            h('div', { class: 'mx-list-head' }, h('h3', { class: 'mx-list-title' }, 'Renda')),
            revBox,
            h('p', { class: 'mx-hint' }, 'A renda corrigida pela inflação é calculada na hora da exibição e não é gravada.'));
        redrawAtt(); redrawRev();
    }

    // ── Painel: Forma recente (últimos resultados) ─────────────────────────
    function renderForm(body, sec) {
        sec.draft ??= {};
        const d = sec.draft;
        // Preserva o nome das chaves que já existem nos dados; padrão camelCase.
        const keyFor = side => (side === 'home'
            ? (Object.hasOwn(d, 'home_team') && !Object.hasOwn(d, 'homeTeam') ? 'home_team' : 'homeTeam')
            : (Object.hasOwn(d, 'away_team') && !Object.hasOwn(d, 'awayTeam') ? 'away_team' : 'awayTeam'));
        const block = side => {
            const key = keyFor(side);
            d[key] ??= [];
            const chips = h('div', { class: 'mx-chips' });
            const redraw = () => {
                chips.replaceChildren(...d[key].map((r, i) => {
                    const sel = selectControl(RESULTS, RESULTS.some(([v]) => v === r) ? r : (r === 'WIN' ? 'VICTORY' : r === 'LOSS' ? 'DEFEAT' : r), v => { d[key][i] = v; chip.className = `mx-chip ${v}`; });
                    sel.setAttribute('aria-label', `Resultado ${i + 1}`);
                    const chip = h('div', { class: `mx-chip ${r}` }, sel,
                        iconBtn('Remover resultado', '✕', () => { d[key].splice(i, 1); redraw(); }, { danger: true }));
                    return chip;
                }));
                if (!d[key].length) chips.append(h('div', { class: 'mx-empty small' }, 'Sem resultados.'));
                touchActive();
            };
            const wrap = h('section', { class: 'mx-list' },
                h('div', { class: 'mx-list-head' }, h('h3', { class: 'mx-list-title' }, teamName(side)),
                    actionBtn('+ Resultado', () => { if (d[key].length >= 10) return; d[key].push('DRAW'); redraw(); }, { small: true })),
                chips);
            redraw();
            return wrap;
        };
        body.append(block('home'), block('away'),
            h('p', { class: 'mx-hint' }, 'Do mais antigo ao mais recente, como estão gravados. Até 10 resultados por time.'));
    }

    // ── Registro de painéis ────────────────────────────────────────────────
    const PANELS = [
        { key: 'general', label: () => 'Geral', render: renderGeneral },
        { key: 'lineup_home', label: () => `Escalação · ${teamInfo('home')?.tla || 'Mandante'}`, render: (b, s) => renderLineup(b, s, 'home') },
        { key: 'lineup_away', label: () => `Escalação · ${teamInfo('away')?.tla || 'Visitante'}`, render: (b, s) => renderLineup(b, s, 'away') },
        { key: 'plays', label: () => 'Lances', render: renderPlays },
        { key: 'penalties', label: () => 'Pênaltis', render: renderPenalties },
        { key: 'statistics', label: () => 'Estatísticas', render: renderStatistics },
        { key: 'referees', label: () => 'Árbitros', render: renderReferees },
        { key: 'attendance', label: () => 'Público e renda', render: renderAttendance },
        { key: 'last_results', label: () => 'Forma recente', render: renderForm },
    ];

    function touchActive() { refresh(state.active); }

    function renderPanel(key) {
        const sec = state.sections[key];
        const panel = $(`mx-panel-${key}`);
        const body = panel.querySelector('.mx-panel-body');
        body.replaceChildren();
        if (sec.corrupt) body.append(h('div', { class: 'mx-banner err' }, 'O conteúdo desta seção no banco não é um JSON válido. Para evitar perda de dados, a edição foi bloqueada — corrija diretamente no banco.'));
        else PANELS.find(p => p.key === key).render(body, sec);
        sec.rendered = true;
        refresh(key);
    }

    function activate(key, focus = false) {
        state.active = key;
        PANELS.forEach(p => {
            const on = p.key === key;
            const tab = $(`mx-tab-${p.key}`);
            tab.classList.toggle('active', on);
            tab.setAttribute('aria-selected', String(on));
            tab.tabIndex = on ? 0 : -1;
            $(`mx-panel-${p.key}`).hidden = !on;
        });
        const firstTime = !state.sections[key].rendered;
        if (firstTime) renderPanel(key);
        else refresh(key);   // rótulos de time podem ter mudado em outra aba
        const t = $(`mx-tab-${key}`);
        t.scrollIntoView({ block: 'nearest', inline: 'center' });
        if (focus) t.focus();
        // Painéis que dependem de dados de outras abas são redesenhados ao voltar (ex.: nomes dos times).
        if (['lineup_home', 'lineup_away', 'penalties', 'plays', 'statistics', 'last_results'].includes(key) && !firstTime && !isDirty(key)) renderPanel(key);
    }

    // ── Salvar / descartar / recarregar ────────────────────────────────────
    function markCacheBust() {
        try { sessionStorage.setItem(`me_bust:${state.sport}:${state.id}`, String(Date.now())); } catch { /* indisponível */ }
    }

    function highlightError(key, message) {
        const m = /\[(\d+)\]/.exec(message || '');
        if (!m) return;
        const rows = $(`mx-panel-${key}`).querySelectorAll('.mx-row');
        const row = rows[Number(m[1])];
        if (!row) return;
        row.classList.add('invalid');
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => row.classList.remove('invalid'), 4000);
    }
    const humanize = message => String(message || '').replace(/\[(\d+)\]/g, (_, n) => ` #${Number(n) + 1}`).replace(/^data\.?/, '');

    async function save(key) {
        const sec = state.sections[key];
        if (sec.saving || !isDirty(key) || sec.corrupt) return;
        sec.saving = true; hideBanner();
        const bar = $(`mx-bar-${key}`);
        const btn = bar.querySelector('[data-act="save"]');
        btn.textContent = 'Salvando…';
        refresh(key); setStatus(key, '');
        try {
            const res = await api('PATCH', sectionPath(key), { version: sec.version, data: payloadFor(key) });
            sec.version = res.version;
            sec.original = clone(res.data);
            sec.draft = clone(res.data);
            if (res.applied) markCacheBust();
            renderPanel(key);
            refreshTabs();
            setStatus(key, res.applied ? 'Salvo.' : 'Nada mudou.', 'ok');
            Utils.showNotification(res.applied ? 'Seção salva.' : 'Nenhuma alteração a salvar.', res.applied ? 'success' : 'info');
        } catch (err) {
            if (err.status === 409) {
                setStatus(key, err.message, 'err');
                showBanner(`${err.message} Use "Recarregar seção" (suas alterações nesta seção serão descartadas).`, 'warn');
                bar.querySelector('[data-act="reload"]').hidden = false;
            } else if (err.status === 401) {
                setStatus(key, err.message, 'err');
            } else {
                setStatus(key, humanize(err.message), 'err');
                if (err.status === 400) highlightError(key, err.message);
            }
        } finally {
            sec.saving = false;
            btn.textContent = 'Salvar seção';
            refresh(key);
        }
    }

    function discard(key) {
        const sec = state.sections[key];
        if (!isDirty(key)) return;
        if (!confirm('Descartar as alterações não salvas desta seção?')) return;
        sec.draft = clone(sec.original);
        renderPanel(key);
        setStatus(key, '');
        refresh(key);
    }

    async function reloadSection(key) {
        const sec = state.sections[key];
        try {
            const { data } = await api('GET', sectionPath());
            const fresh = data.sections[key];
            Object.assign(sec, { version: fresh.version, original: clone(fresh.data), draft: clone(fresh.data), corrupt: !!fresh.corrupt, error: null });
            state.ctx = data.context;
            $(`mx-bar-${key}`).querySelector('[data-act="reload"]').hidden = true;
            hideBanner();
            renderPanel(key);
            setStatus(key, 'Seção recarregada.', 'ok');
        } catch (err) { setStatus(key, err.message, 'err'); }
    }

    function refreshTabs() {
        PANELS.forEach(p => { $(`mx-tab-${p.key}`).firstChild.textContent = p.label(); });
    }

    // ── Montagem da página ─────────────────────────────────────────────────
    function buildShell() {
        const tabs = $('mxTabs'), panels = $('mxPanels');
        PANELS.forEach(p => {
            tabs.append(h('button', {
                id: `mx-tab-${p.key}`, type: 'button', class: 'mx-tab', role: 'tab', 'aria-controls': `mx-panel-${p.key}`, 'aria-selected': 'false', tabindex: '-1',
                onClick: () => activate(p.key),
            }, p.label(), h('span', { class: 'mx-dot', 'aria-hidden': 'true', title: 'Alterações não salvas' })));

            const bar = h('div', { id: `mx-bar-${p.key}`, class: 'mx-savebar' },
                h('div', { class: 'mx-status', role: 'status', 'aria-live': 'polite' }),
                h('div', { class: 'mx-bar-actions' },
                    actionBtn('Recarregar seção', () => reloadSection(p.key), { small: true }),
                    actionBtn('Descartar', () => discard(p.key), { small: true }),
                    actionBtn('Salvar seção', () => save(p.key), { kind: 'primary' })));
            const [reload, discardBtn, saveBtn] = bar.querySelectorAll('button');
            reload.dataset.act = 'reload'; reload.hidden = true;
            discardBtn.dataset.act = 'discard'; saveBtn.dataset.act = 'save';
            panels.append(h('section', { id: `mx-panel-${p.key}`, class: 'mx-panel', role: 'tabpanel', 'aria-labelledby': `mx-tab-${p.key}`, hidden: true },
                h('div', { class: 'mx-panel-body' }), bar));
        });

        // Navegação por teclado entre abas (setas, Home, End)
        tabs.addEventListener('keydown', e => {
            const i = PANELS.findIndex(p => p.key === state.active);
            let n = null;
            if (e.key === 'ArrowRight') n = (i + 1) % PANELS.length;
            else if (e.key === 'ArrowLeft') n = (i - 1 + PANELS.length) % PANELS.length;
            else if (e.key === 'Home') n = 0;
            else if (e.key === 'End') n = PANELS.length - 1;
            if (n !== null) { e.preventDefault(); activate(PANELS[n].key, true); }
        });
    }

    function renderHeader() {
        const c = state.ctx.event;
        const g = state.sections.general.original;
        const date = Utils.formatMatchDate(g.utc_date || c.date);
        $('mxSummary').replaceChildren(
            h('div', { class: 'mx-sum-comp' }, [c.championship, c.phase].filter(Boolean).join(' · ') || g.competition || 'Partida'),
            h('div', { class: 'mx-sum-match' }, `${state.ctx.home_team?.nome || c.homeName || '—'} ${g.home_score ?? ''} × ${g.away_score ?? ''} ${state.ctx.away_team?.nome || c.awayName || '—'}`),
            h('div', { class: 'mx-sum-meta' }, [date, `Evento #${state.id}`, `matchdata ${state.matchDataId}`].filter(Boolean).join(' · ')));
        $('mxBack').href = `match.html?id=${encodeURIComponent(state.id)}&sport=${encodeURIComponent(state.sport)}`;
    }

    function showOnly(which) {
        ['mxLoading', 'mxDenied', 'mxError', 'mxCreate', 'mxContent'].forEach(id => { $(id).hidden = id !== which; });
    }
    function showFailure(boxId, title, text) {
        const box = $(boxId);
        box.querySelector('h2').textContent = title;
        box.querySelector('p').textContent = text;
        showOnly(boxId);
    }

    let started = false;
    // ── Partida sem matchdata: criar (não vincula) ─────────────────────────
    function showCreated(matchDataId, text) {
        $('mxCreateText').textContent = text;
        $('mxCreateId').textContent = matchDataId;
        $('mxCreateResult').hidden = false;
        $('mxCreateBtn').hidden = true;
        $('mxCreateError').hidden = true;
        $('mxCreateCopy').onclick = async () => {
            try { await navigator.clipboard.writeText(matchDataId); Utils.showNotification('Id copiado.', 'success'); }
            catch { Utils.showNotification('Não foi possível copiar; selecione o id manualmente.', 'warning'); }
        };
    }

    function showCreate(pendingId) {
        $('mxCreateBack').href = `match.html?id=${encodeURIComponent(state.id)}&sport=${encodeURIComponent(state.sport)}`;
        showOnly('mxCreate');
        const btn = $('mxCreateBtn');
        const fail = message => { const e = $('mxCreateError'); e.textContent = message; e.hidden = false; };
        if (pendingId) {
            showCreated(pendingId, `O matchdata ${pendingId} já foi criado para esta partida, mas ainda não está vinculado a ela. A vinculação é feita manualmente.`);
            return;
        }
        btn.onclick = async () => {
            if (btn.disabled) return;
            btn.disabled = true; btn.textContent = 'Criando…'; $('mxCreateError').hidden = true;
            try {
                const res = await api('POST', sectionPath());
                showCreated(res.matchDataId, 'Matchdata criado em branco. Ele NÃO foi vinculado à partida — a vinculação é feita manualmente. Depois de vinculado, esta página abre o matchdata para edição.');
                markCacheBust();
            } catch (err) {
                if (err.code === 'already_created' && err.data.matchDataId) {
                    showCreated(err.data.matchDataId, `O matchdata ${err.data.matchDataId} já foi criado para esta partida, mas ainda não está vinculado a ela. A vinculação é feita manualmente.`);
                } else if (err.code === 'already_linked') {
                    location.reload();
                } else {
                    fail(err.message || 'Não foi possível criar o matchdata.');
                    btn.disabled = false; btn.textContent = 'Criar matchdata';
                }
            }
        };
    }

    async function init() {
        if (started) return;   // evita montar a página duas vezes
        started = true;
        await window._headerPromise;
        const params = new URLSearchParams(location.search);
        const sport = params.get('sport');
        const id = params.get('id');
        Utils.applySportTheme('admin');

        if (!id || !/^\d{1,12}$/.test(id) || !['football', 'multisport'].includes(sport)) {
            showFailure('mxError', 'Partida inválida', 'Informe o id do evento e o esporte (football ou multisport) na URL.');
            return;
        }
        state.sport = sport; state.id = id;
        $('mxBack').href = `match.html?id=${encodeURIComponent(id)}&sport=${encodeURIComponent(sport)}`;

        // O cliente só decide o que mostrar; o servidor valida o token em toda requisição.
        if (!Auth.adminSession()) {
            showFailure('mxDenied', 'Acesso restrito', 'Esta página é exclusiva para administradores. Entre com uma conta de administrador e tente de novo.');
            return;
        }

        try {
            const { data } = await api('GET', sectionPath());
            state.ctx = data.context;
            state.matchDataId = data.matchDataId;
            state.scrapedAt = data.scrapedAt;
            for (const [key, s] of Object.entries(data.sections)) {
                state.sections[key] = { key, version: s.version, original: clone(s.data), draft: clone(s.data), corrupt: !!s.corrupt, saving: false, rendered: false, error: null };
            }
            // Rótulos do que já está selecionado
            const g = data.sections.general.data;
            if (data.context.venue && g.venue_id != null) state.labels.venues[g.venue_id] = data.context.venue;
            if (data.context.home_team && g.home_team_id != null) state.labels.teams[g.home_team_id] = data.context.home_team;
            if (data.context.away_team && g.away_team_id != null) state.labels.teams[g.away_team_id] = data.context.away_team;

            buildShell();
            renderHeader();
            refreshTabs();
            showOnly('mxContent');
            activate('general');
        } catch (err) {
            if (err.status === 401 || err.status === 403) showFailure('mxDenied', 'Acesso restrito', err.message);
            else if (err.status === 404 && err.code === 'no_matchdata') showCreate(err.data.pendingMatchDataId || null);
            else if (err.status === 404) showFailure('mxError', 'Nada para editar', err.message);
            else showFailure('mxError', 'Não foi possível carregar', err.message || 'Tente novamente em instantes.');
        }
    }

    // Avisa antes de sair com alterações não salvas
    window.addEventListener('beforeunload', e => { if (state.ctx && anyDirty()) { e.preventDefault(); e.returnValue = ''; } });
    // Ctrl/Cmd + S salva a seção aberta
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && state.ctx) { e.preventDefault(); save(state.active); }
    });

    return { init, _state: state };
})();

document.addEventListener('DOMContentLoaded', () => MatchEdit.init());
