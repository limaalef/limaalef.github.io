/* ============================================================
   MATCH EDITOR — correção de nomes de jogadores nos detalhes de um jogo
   (escalação, plays e pênaltis). Disponível em match.html para quem está
   logado com permissão de administrador (Auth.adminSession()).

   Funcionamento:
   1. extract(match) varre o jogo e lista TODA ocorrência de nome de pessoa
      (técnico, titulares, reservas, plays, substituições e pênaltis).
   2. O admin edita os campos; uma correção pode ser aplicada a todas as
      ocorrências do mesmo nome de uma vez.
   3. buildPatch() gera apenas as diferenças, no contrato da API:
        PATCH /v2/matches/{sport}/{id}/players
        { edits: [
            { section: 'plays',     path: [1, 'popularName'], value, expected },
            { section: 'penalties', path: [9, 'name'],        value, expected },
            { section: 'lineup', team: 'home', path: ['startingXI', 9, 'name'], value, expected }
        ] }
      "expected" é o valor lido ao abrir o editor: o servidor pode recusar a edição
      se o dado mudou no banco nesse meio tempo (evita sobrescrever correção alheia).
   4. save() envia com "Authorization: Bearer <token>" — o token emitido pela API no login
      com Google. A autorização real é do servidor; o cliente só mostra/esconde.
   ============================================================ */
const MatchEditor = (() => {
    // Os nomes significam coisas diferentes por seção, conforme os dados reais:
    //   escalação:           name = nome popular   | fullName = nome completo
    //   plays / pênaltis:    popularName = popular | name = nome completo
    const KINDS = {
        lineup: [['name', 'Nome popular'],        ['fullName', 'Nome completo']],
        event:  [['popularName', 'Nome popular'], ['name', 'Nome completo']],
    };
    const PLAY_LABEL = { REGULAR_GOAL: 'Gol', GOAL: 'Gol', OWN_GOAL: 'Gol contra', PENALTY_GOAL: 'Gol de pênalti', PENALTY: 'Gol de pênalti',
                         YELLOW_CARD: 'Cartão amarelo', RED_CARD: 'Cartão vermelho', SUBSTITUTION: 'Substituição' };
    const esc = s => Utils.escapeHtml(s ?? '');
    const plural = n => `${n} alteraç${n > 1 ? 'ões' : 'ão'}`;
    // A API pode devolver o nome como null. `original` guarda o valor cru (string | null) para o
    // "expected" do servidor; para exibir e comparar usamos o texto ('' quando for null).
    const orig = f => f.original ?? '';

    let state = null;   // { sport, id, match, title, fields, sections, onSaved }

    // ── Configuração da API ────────────────────────────────────────────────
    const cfg = () => CONFIG.MATCH_EDIT || {};
    const isConfigured = () => !!cfg().endpoint;
    const endpointFor = (sport, id) =>
        cfg().endpoint.replace('{sport}', encodeURIComponent(sport)).replace('{id}', encodeURIComponent(id));

    // ── Permissão ──────────────────────────────────────────────────────────
    const session = () => Auth.adminSession();
    const canEdit = () => !!session();

    // ── Extração ───────────────────────────────────────────────────────────
    function extract(match, sport) {
        const fields = [];
        const sections = [];

        const newSection = (id, title) => { const s = { id, title, rows: [] }; sections.push(s); return s; };
        const newRow = (section, title, meta = '') => { const r = { title, meta, fields: [], section }; section.rows.push(r); return r; };

        // edit = { section, team?, path:[...] } no contrato da API
        // allowNull: o registro é de uma pessoa, então um nome null também é editável (preencher).
        // Quando não é (ex.: lance sem jogador), só entram campos que já são texto.
        const personFields = (row, obj, kind, edit, prefix = '', allowNull = true) => {
            if (!obj || typeof obj !== 'object') return;
            KINDS[kind].forEach(([prop, label]) => {
                const v = obj[prop];
                if (typeof v !== 'string' && !(allowNull && v === null)) return;
                const f = { id: fields.length, edit: { ...edit, path: [...edit.path, prop] }, prop, label: prefix + label,
                            original: v, value: v ?? '', row };
                fields.push(f); row.fields.push(f);
            });
        };

        const home = match.home_team, away = match.away_team;
        const teamLabel = p => [home, away].find(t => t?.tla && t.tla === p.teamAbbr)?.name || p.teamAbbr || p.teamSlug || '';

        // Escalação
        [['home', home, 'mandante'], ['away', away, 'visitante']].forEach(([team, data, side]) => {
            const lineup = data?.lineup;
            if (!lineup) return;
            const section = newSection(`lineup-${team}`, `Escalação · ${data.name || side} (${side})`);
            [['startingXI', 'Titular'], ['substitute', 'Reserva']].forEach(([listKey, kind]) => {
                (lineup[listKey] || []).forEach((p, i) => {
                    const num = p.shirtNumber != null ? `#${p.shirtNumber}` : '';
                    const title = [num, p.posSlug, p.position].filter(Boolean).join(' · ') || `${kind} ${i + 1}`;
                    personFields(newRow(section, title, kind), p, 'lineup', { section: 'lineup', team, path: [listKey, i] });
                });
            });
        });

        // Plays
        if (match.plays?.length) {
            const section = newSection('plays', 'Plays');
            match.plays.forEach((play, i) => {
                const label = PLAY_LABEL[play.playType] || play.playType || 'Lance';
                const when = [play.periodLabel, play.minute != null ? `${play.minute}'` : ''].filter(Boolean).join(' ');
                const row = newRow(section, `${when} · ${label}`, teamLabel(play));
                if (play.playType === 'SUBSTITUTION') {
                    personFields(row, play.playerIn,  'event', { section: 'plays', path: [i, 'playerIn'] },  'Entra · ');
                    personFields(row, play.playerOut, 'event', { section: 'plays', path: [i, 'playerOut'] }, 'Sai · ');
                } else {
                    // Só lances de jogador (gol, cartão…) aceitam nome null; início/fim de período etc. não.
                    personFields(row, play, 'event', { section: 'plays', path: [i] }, '', !!PLAY_LABEL[play.playType]);
                }
            });
        }

        // Pênaltis
        if (match.penalties?.length) {
            const section = newSection('penalties', 'Pênaltis');
            match.penalties.forEach((p, i) => {
                const n = p.order ?? i + 1;
                const row = newRow(section, `${n}ª cobrança · ${p.scored ? 'convertida' : 'perdida'}`, teamLabel(p));
                personFields(row, p, 'event', { section: 'penalties', path: [i] });
            });
        }

        const homeName = home?.name || 'Mandante', awayName = away?.name || 'Visitante';
        return { sport, id: match.id, match, title: `${homeName} x ${awayName}`, fields, sections, onSaved: null };
    }

    // ── Diferenças ─────────────────────────────────────────────────────────
    // Sujo = o admin mudou o texto de verdade (um espaço a mais/menos não conta; valores que já
    // vinham com espaço sobrando no banco só viram edição se forem alterados).
    const isDirty = f => f.value !== orig(f) && f.value.trim() !== orig(f);
    const dirtyOf = () => state.fields.filter(isDirty);
    const emptied = f => isDirty(f) && orig(f).trim() !== '' && f.value.trim() === '';

    // Corpo da requisição, exatamente no contrato da API
    function buildPatch() {
        return {
            edits: dirtyOf().map(f => ({
                section: f.edit.section,
                ...(f.edit.team ? { team: f.edit.team } : {}),
                path: f.edit.path,
                value: f.value.trim(),
                expected: f.original,
            })),
        };
    }

    // Reflete as edições salvas no objeto do jogo em memória, para que reabrir o editor
    // use o valor novo como "expected" (senão a próxima edição seria recusada).
    function applyToSource(match, edit) {
        let target = edit.section === 'lineup'
            ? match[edit.team === 'home' ? 'home_team' : 'away_team']?.lineup
            : match[edit.section];
        const path = [...edit.path], last = path.pop();
        for (const key of path) target = target?.[key];
        if (target) target[last] = edit.value;
    }

    // ── Interface ──────────────────────────────────────────────────────────
    function ensureModal() {
        let modal = document.getElementById('edit-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'edit-modal';
        modal.innerHTML = `
            <div class="modal-content ed-content">
                <div class="modal-header">
                    <button type="button" class="btn close-btn" aria-label="Fechar" data-ed="close">×</button>
                    <h2 class="modal-title"><div class="section-title modal-title-competition">Editar jogadores</div></h2>
                    <div class="modal-score"><div class="ed-subtitle" id="ed-title"></div></div>
                </div>
                <div class="ed-toolbar">
                    <input type="search" id="ed-filter" class="ed-input" placeholder="Filtrar por nome…" autocomplete="off">
                    <span class="ed-count" id="ed-count"></span>
                </div>
                <div class="modal-body ed-body" id="ed-body"></div>
                <div class="ed-footer">
                    <div class="ed-status" id="ed-status" role="status" aria-live="polite"></div>
                    <div class="ed-actions">
                        <button type="button" class="action-btn btn-ghost" data-ed="copy">Copiar alterações (JSON)</button>
                        <button type="button" class="action-btn btn-primary" data-ed="save">Salvar alterações</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', e => {
            const action = e.target.closest('[data-ed]')?.dataset.ed;
            if (e.target === modal || action === 'close') requestClose();
            else if (action === 'copy') copyPatch();
            else if (action === 'save') save();
            else if (action === 'undo') { const f = state.fields[+e.target.closest('[data-fid]').dataset.fid]; f.value = orig(f); refresh(); }
            else if (action === 'apply') applyToAll(+e.target.closest('[data-fid]').dataset.fid);
        });
        modal.addEventListener('input', e => {
            if (e.target.matches('input[data-fid]')) {
                state.fields[+e.target.dataset.fid].value = e.target.value;
                refresh({ keepFocus: true });
            }
        });
        document.getElementById('ed-filter').addEventListener('input', applyFilter);

        // Escape: fecha só o editor (fase de captura, antes dos listeners dos modais por trás)
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                e.preventDefault(); e.stopImmediatePropagation(); requestClose();
            }
        }, true);
        return modal;
    }

    function fieldHtml(f) {
        const dirty = isDirty(f);
        const others = dirty ? sameNameOthers(f) : [];
        return `
            <div class="ed-field${dirty ? ' ed-changed' : ''}${emptied(f) ? ' ed-invalid' : ''}" data-fid="${f.id}">
                <label>
                    <span class="ed-label">${esc(f.label)}</span>
                    <input type="text" data-fid="${f.id}" value="${esc(f.value)}"${f.original === null ? ' placeholder="(vazio)"' : ''} autocomplete="off" spellcheck="false">
                </label>
                ${dirty ? `<button type="button" class="ed-link" data-ed="undo" title="Voltar ao original">↺ Original</button>` : ''}
                ${others.length ? `<button type="button" class="ed-link ed-apply" data-ed="apply">Aplicar a mais ${others.length} ocorrência${others.length > 1 ? 's' : ''}</button>` : ''}
                ${emptied(f) ? `<div class="ed-error">O nome não pode ficar vazio.</div>` : ''}
            </div>`;
    }

    function render() {
        const body = document.getElementById('ed-body');
        if (!state.sections.length) {
            body.innerHTML = `<div class="empty-state"><h2>Nada para editar</h2><p>Este jogo não tem escalação, plays ou pênaltis.</p></div>`;
            return;
        }
        body.innerHTML = state.sections.map(s => `
            <details class="ed-section" open>
                <summary>${esc(s.title)} <span class="ed-section-count">${s.rows.length}</span></summary>
                ${s.rows.map(r => `
                    <div class="ed-row" data-search="">
                        <div class="ed-row-title">${esc(r.title)}${r.meta ? `<span class="ed-row-meta">${esc(r.meta)}</span>` : ''}</div>
                        <div class="ed-fields">${r.fields.map(fieldHtml).join('')}</div>
                    </div>`).join('')}
            </details>`).join('');
        applyFilter();
    }

    // Atualiza só o necessário para não perder foco ao digitar
    function refresh({ keepFocus = false } = {}) {
        const active = keepFocus ? document.activeElement : null;
        const fid = active?.dataset?.fid, pos = active?.selectionStart;
        render();
        if (fid !== undefined) {
            const el = document.querySelector(`#ed-body input[data-fid="${fid}"]`);
            if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* ignore */ } }
        }
        updateFooter();
    }

    function updateFooter() {
        const n = dirtyOf().length;
        const invalid = state.fields.some(emptied);
        document.getElementById('ed-count').textContent = n ? plural(n) : 'Sem alterações';
        const saveBtn = document.querySelector('#edit-modal [data-ed="save"]');
        const copyBtn = document.querySelector('#edit-modal [data-ed="copy"]');
        saveBtn.disabled = !n || invalid;
        copyBtn.disabled = !n;
        if (!isConfigured()) setStatus('API de edição ainda não configurada: as alterações podem ser copiadas em JSON.', 'warn');
        else if (!document.getElementById('ed-status').dataset.sticky) setStatus('');
    }

    function applyFilter() {
        const q = Utils.normalizeSearch(document.getElementById('ed-filter')?.value || '');
        document.querySelectorAll('#ed-body .ed-row').forEach(row => {
            const text = Utils.normalizeSearch(row.innerText + ' ' + [...row.querySelectorAll('input')].map(i => i.value).join(' '));
            row.hidden = !!q && !text.includes(q);
        });
    }

    function setStatus(text, kind = '', sticky = false) {
        const el = document.getElementById('ed-status');
        el.textContent = text;
        el.className = 'ed-status' + (kind ? ' ' + kind : '');
        if (sticky) el.dataset.sticky = '1'; else delete el.dataset.sticky;
    }

    // Mesmo texto original em outras ocorrências (em qualquer campo de nome) ainda não corrigidas para o novo valor
    function sameNameOthers(f) {
        if (!orig(f).trim()) return [];
        return state.fields.filter(o => o.id !== f.id && o.original === f.original && o.value !== f.value);
    }
    function applyToAll(fid) {
        const f = state.fields[fid];
        sameNameOthers(f).forEach(o => { o.value = f.value; });
        refresh();
    }

    // ── Ações ──────────────────────────────────────────────────────────────
    async function copyPatch() {
        const json = JSON.stringify(buildPatch(), null, 2);   // corpo exato da requisição
        try { await navigator.clipboard.writeText(json); }
        catch {
            const ta = Object.assign(document.createElement('textarea'), { value: json });
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        }
        Utils.showNotification('Alterações copiadas (JSON).', 'success');
    }

    async function save() {
        if (!isConfigured()) { setStatus('API de edição ainda não configurada (CONFIG.MATCH_EDIT.endpoint).', 'warn', true); return; }
        const patch = buildPatch();
        if (!patch.edits.length) return;
        const btn = document.querySelector('#edit-modal [data-ed="save"]');
        btn.disabled = true; btn.textContent = 'Salvando…';
        setStatus('');
        try {
            const active = session();
            if (!active) { setStatus('Sessão de administrador não encontrada. Entre novamente.', 'err', true); return; }
            // O fetch da sessão envia "Authorization: Bearer <token da API>" e encerra a sessão em 401
            const res = await active.fetch(endpointFor(state.sport, state.id), {
                method: cfg().method || 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            }, {
                // Sessão expirada: não recarrega a página (perderia as edições em andamento)
                onExpired: () => setStatus('Sessão expirada. Copie as alterações (JSON), entre novamente e refaça a edição.', 'err', true),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) return;
            if (!res.ok) {
                const server = data.error || data.message || '';
                const msg = res.status === 403 ? 'Sem permissão para editar (a conta precisa ser administradora).'
                          : res.status === 409 ? `Conflito: o valor no banco mudou desde que o jogo foi aberto. Feche e reabra o jogo.${server ? ' (' + server + ')' : ''}`
                          : server || `Não foi possível salvar (HTTP ${res.status}).`;
                setStatus(msg, 'err', true);
                return;
            }
            patch.edits.forEach(edit => applyToSource(state.match, edit));
            state.fields.forEach(f => { if (isDirty(f)) { f.value = f.value.trim(); f.original = f.value; } });
            refresh();
            state.onSaved?.(state.match);   // a página redesenha escalação, plays e pênaltis com os nomes novos
            setStatus(`Salvo: ${plural(patch.edits.length)}.`, 'ok', true);
            Utils.showNotification('Nomes corrigidos.', 'success');
        } catch (err) {
            setStatus('Falha de conexão: ' + err.message, 'err', true);
        } finally {
            btn.textContent = 'Salvar alterações';
            updateFooter();
        }
    }

    function requestClose() {
        if (state && dirtyOf().length && !confirm('Há alterações não salvas. Descartar?')) return;
        document.getElementById('edit-modal')?.classList.remove('active');
        state = null;
    }

    // ── API pública ────────────────────────────────────────────────────────
    // opts.id      → id usado na URL da API (o mesmo do ?id= da página)
    // opts.focus   → começa com só essa seção aberta ('lineup', 'plays' ou 'penalties')
    // opts.onSaved → chamado depois de salvar, com o jogo já atualizado em memória
    function open(sport, match, opts = {}) {
        if (!canEdit()) { Utils.showNotification('Você precisa estar logado como administrador para editar.', 'warning'); return; }
        const modal = ensureModal();
        state = extract(match, sport);
        if (opts.id != null) state.id = opts.id;
        state.onSaved = opts.onSaved || null;
        if (!state.sections.length) { state = null; Utils.showNotification('Este jogo não tem escalação, plays ou pênaltis para editar.', 'warning'); return; }
        document.getElementById('ed-title').textContent = state.title;
        document.getElementById('ed-filter').value = '';
        setStatus('');
        render();
        if (opts.focus) {
            document.querySelectorAll('#ed-body .ed-section').forEach((el, i) => { el.open = state.sections[i].id.startsWith(opts.focus); });
        }
        updateFooter();
        modal.classList.add('active');
    }

    // Coloca um botão "Editar nomes" no título de cada seção da página (escalação, plays, pênaltis),
    // somente se o usuário estiver logado com permissão. Chamar de novo é seguro.
    function attach({ match, sport, id, onSaved }) {
        if (!canEdit()) return;
        [['meLineupSection', 'lineup'], ['mePlaysSection', 'plays'], ['mePenaltiesSection', 'penalties']].forEach(([sectionId, focus]) => {
            const title = document.querySelector(`#${sectionId} .section-title`);
            if (!title || title.querySelector('.ed-launch')) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ed-launch';
            btn.textContent = 'Editar nomes';
            btn.addEventListener('click', () => open(sport, match, { id, focus, onSaved }));
            title.appendChild(btn);
        });
    }

    return { open, attach, canEdit, extract, buildPatch: () => (state ? buildPatch() : null), isConfigured };
})();
