/* ═══════════════════════════════════════════════════════════════
   Admin → painel "Times e narradores": curadoria dos carrosséis da home.
   Busca times em {ADMIN_API_BASE}/lookup/teams e narradores em
   /lookup/values?field=narrator (nome do campo: NARRATOR_FIELD).
   Persistência: {HOME_BROWSE_API_BASE}/admin (worker sports-archive-homecontent).
   Depende de: CONFIG, admFetch, notify, esc (admin.html).
═══════════════════════════════════════════════════════════════ */
const AdminBrowse = (() => {
    const NARRATOR_FIELD = 'narrator';
    const KINDS = {
        team:       { title: 'Times',      host: 'br-team',       placeholder: 'Buscar time…',      image: n => `teams_logos/${slug(n, '-')}.svg` },
        commentary: { title: 'Narradores', host: 'br-commentary', placeholder: 'Buscar narrador…', image: n => `people_icon/${slug(n, '_')}.png` },
    };
    const api = path => `${CONFIG.HOME_BROWSE_API_BASE}/admin${path}`;
    const $ = id => document.getElementById(id);
    let items = [], loaded = false;

    // "Atlético-MG" → atletico-mg ; "Cléber Machado" → cleber_machado
    const slug = (name, space) => Utils.stripAccents(name).toLowerCase().replace(/[^a-z0-9-]+/g, space).replace(new RegExp(`^${space}+|${space}+$`, 'g'), '');
    const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const ofKind = k => items.filter(i => i.kind === k).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

    async function load(force) {
        if (loaded && !force) return render();
        try {
            const res = await admFetch(api(''));
            if (!res.ok) throw new Error('HTTP ' + res.status);
            items = (await res.json()).items || [];
            loaded = true;
            render();
        } catch (e) { notify('Não foi possível carregar a lista: ' + e.message); }
    }

    function render() {
        for (const [kind, cfg] of Object.entries(KINDS)) {
            const list = ofKind(kind);
            $(cfg.host + '-count').textContent = list.length;
            $(cfg.host + '-empty').classList.toggle('is-hidden', list.length > 0);
            $(cfg.host + '-list').innerHTML = list.map((it, i) => `
                <div class="br-row" data-id="${it.id}" data-kind="${kind}">
                    <div class="br-thumb"><img src="${esc(it.image)}" alt="" onerror="this.style.visibility='hidden'"></div>
                    <div class="br-fields stack">
                        <div class="br-name item-name">${esc(it.name)}</div>
                        <input class="field field--on-surface" data-f="label" value="${esc(it.label)}" placeholder="Texto exibido (padrão: ${esc(it.name)})" maxlength="60" aria-label="Texto exibido">
                        <input class="field field--on-surface" data-f="image" value="${esc(it.image)}" placeholder="Caminho da imagem" maxlength="200" aria-label="Caminho da imagem">
                    </div>
                    <div class="br-actions">
                        <button type="button" class="action-btn btn-ghost btn-xs" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
                        <button type="button" class="action-btn btn-ghost btn-xs" data-act="down" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Descer">▼</button>
                        <button type="button" class="action-btn btn-danger btn-xs" data-act="remove">Remover</button>
                    </div>
                </div>`).join('');
        }
    }

    async function add(kind, name, extra = {}) {
        const cfg = KINDS[kind];
        const res = await admFetch(api(''), json('POST', { kind, name, label: extra.label || '', image: extra.image || cfg.image(name) }));
        const d = await res.json().catch(() => ({}));
        if (!res.ok) return notify(d.error || `Erro ao adicionar (HTTP ${res.status})`, res.status === 409 ? 'warning' : 'error');
        load(true);
    }

    async function move(kind, id, dir) {
        const ids = ofKind(kind).map(i => i.id), at = ids.indexOf(id), to = at + dir;
        if (at < 0 || to < 0 || to >= ids.length) return;
        [ids[at], ids[to]] = [ids[to], ids[at]];
        const res = await admFetch(api('/reorder'), json('POST', { kind, ids }));
        if (!res.ok) return notify('Erro ao reordenar.');
        load(true);
    }

    async function onListClick(e) {
        const btn = e.target.closest('[data-act]'); if (!btn) return;
        const row = btn.closest('.br-row'), id = +row.dataset.id, kind = row.dataset.kind;
        if (btn.dataset.act === 'up') return move(kind, id, -1);
        if (btn.dataset.act === 'down') return move(kind, id, 1);
        if (btn.dataset.act === 'remove') {
            const res = await admFetch(api('/' + id), { method: 'DELETE' });
            if (!res.ok) return notify('Erro ao remover.');
            load(true);
        }
    }

    // Edição de texto/imagem: salva ao sair do campo, se mudou
    async function onChange(e) {
        const input = e.target.closest('[data-f]'); if (!input) return;
        const row = input.closest('.br-row'), it = items.find(i => i.id === +row.dataset.id);
        const label = row.querySelector('[data-f=label]').value.trim(), image = row.querySelector('[data-f=image]').value.trim();
        if (!it || (label === it.label && image === it.image)) return;
        const res = await admFetch(api('/' + it.id), json('PUT', { label, image }));
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { notify(d.error || 'Erro ao salvar.'); return load(true); }
        it.label = label; it.image = image;
        row.querySelector('.br-thumb img').src = image; row.querySelector('.br-thumb img').style.visibility = '';
        notify('Salvo.', 'success');
    }

    // ── busca com sugestões ──
    async function search(kind, q) {
        if (kind === 'team') {
            const res = await admFetch(`${CONFIG.ADMIN_API_BASE}/lookup/teams?q=${encodeURIComponent(q)}`);
            if (!res.ok) return [];
            return ((await res.json()).data || []).map(t => ({ name: t.nome, hint: [t.tla, t.pais_origem].filter(Boolean).join(' · '), image: t.slug ? `teams_logos/${t.slug}.svg` : '' }));
        }
        const res = await admFetch(`${CONFIG.ADMIN_API_BASE}/lookup/values?field=${NARRATOR_FIELD}&q=${encodeURIComponent(q)}`);
        if (!res.ok) return [];
        return ((await res.json()).data || []).map(v => ({ name: typeof v === 'string' ? v : v.name || v.value, hint: '', image: '' }));
    }

    function bindSearch(kind) {
        const cfg = KINDS[kind], input = $(cfg.host + '-search'), box = $(cfg.host + '-results');
        let timer = null, seq = 0;
        const close = () => { box.classList.add('is-hidden'); box.innerHTML = ''; };
        const pick = (name, image) => { input.value = ''; close(); add(kind, name, { image }); };

        input.addEventListener('input', () => {
            clearTimeout(timer);
            const q = input.value.trim();
            if (!q) return close();
            timer = setTimeout(async () => {
                const my = ++seq;
                let found = [];
                try { found = await search(kind, q); } catch { /* sem sugestões: ainda permite adicionar manualmente */ }
                if (my !== seq) return;
                const taken = new Set(ofKind(kind).map(i => i.name.toLowerCase()));
                const rows = found.filter(f => f.name && !taken.has(f.name.toLowerCase())).slice(0, 8);
                box.innerHTML = rows.map((f, i) => `<button type="button" class="br-result" data-i="${i}"><span>${esc(f.name)}</span><small>${esc(f.hint)}</small></button>`).join('')
                    + `<button type="button" class="br-result br-result--manual" data-manual="1"><span>Adicionar “${esc(q)}” manualmente</span></button>`;
                box.classList.remove('is-hidden');
                box._rows = rows;
            }, 250);
        });
        box.addEventListener('click', e => {
            const b = e.target.closest('.br-result'); if (!b) return;
            if (b.dataset.manual) return pick(input.value.trim(), '');
            const r = box._rows[+b.dataset.i]; pick(r.name, r.image);
        });
        input.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
        document.addEventListener('click', e => { if (!e.target.closest('#' + cfg.host + '-picker')) close(); });
    }

    function init() {
        for (const kind of Object.keys(KINDS)) {
            const host = KINDS[kind].host;
            $(host + '-list').addEventListener('click', onListClick);
            $(host + '-list').addEventListener('change', onChange);
            bindSearch(kind);
        }
    }
    return { init, load };
})();
