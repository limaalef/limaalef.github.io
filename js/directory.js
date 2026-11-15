/* ═══════════════════════════════════════════════════════════════
   Directory — listagem de clubes, campeonatos e narradores.
   Uma página por tipo (teams.html, competitions.html, commentators.html), todas com
   este arquivo; o tipo vem de <body data-kind="teams|competitions|commentary">.
   Dados: {DIRECTORY_API_BASE}/{kind} — um JSON único, sem paginação (ver docs/directory-examples).
   Ordem e letras do índice são calculadas aqui; o JSON pode vir em qualquer ordem.
═══════════════════════════════════════════════════════════════ */
const Directory = (() => {
    // type = valor de ?type= em detail.html; shape = formato da imagem (mesmo padrão de detail, em tamanho reduzido)
    const KINDS = {
        teams:        { type: 'team',        shape: 'emblem'   },
        competitions: { type: 'competition', shape: 'emblem'   },
        commentary:   { type: 'commentary',  shape: 'portrait' },
    };
    const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const OTHER = '#';

    const esc = v => Utils.escapeHtml(v);
    const t = (key, vars = {}) => Object.entries(vars).reduce((txt, [k, v]) => txt.replace(`{${k}}`, v), LanguageManager.t(key));
    const $ = id => document.getElementById(id);

    const state = { kind: null, cfg: null, items: [], generatedAt: '', query: '' };

    const initialOf = name => {
        const c = Utils.stripAccents(name).trim().charAt(0).toUpperCase();
        return /[A-Z]/.test(c) ? c : OTHER;
    };
    const initials = name => String(name).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const matchesText = n => t(n === 1 ? 'dirMatchesOne' : 'dirMatchesMany', { n: n.toLocaleString(LanguageManager.getLanguage()) });

    function normalize(raw) {
        return (Array.isArray(raw?.items) ? raw.items : []).filter(i => i && i.name).map(i => ({
            name: String(i.name),
            sport: String(i.sport),
            image: i.image || '',
            matches: Number.isFinite(+i.matches) ? +i.matches : null,
            channels: (Array.isArray(i.channels) ? i.channels : []).filter(c => c && c.name)
                .map(c => ({ name: String(c.name), matches: +c.matches || 0 })).sort((a, b) => b.matches - a.matches),
            search: Utils.normalizeSearch(i.name),
        }));
    }

    // ── cartões ──
    function avatar(item) {
        const img = item.image
            ? `<img src="${esc(item.image)}" alt="" loading="lazy" onerror="this.parentElement.classList.remove('has-image');this.remove()">` : '';
        return `<span class="dir-avatar${item.image ? ' has-image' : ''}" data-shape="${state.cfg.shape}">${img}<span class="dir-avatar-fallback" aria-hidden="true">${esc(initials(item.name))}</span></span>`;
    }

    function card(item) {
        const sub = item.matches !== null ? matchesText(item.matches) : '';
        const channels = item.channels.length ? `
            <div class="dir-channels-label">${t('dirChannels')}</div>
            <ul class="dir-channels">${item.channels.map(c => `<li class="dir-channel"><span>${esc(c.name)}</span><b>${c.matches.toLocaleString(LanguageManager.getLanguage())}</b></li>`).join('')}</ul>` : '';
        return `<a class="dir-card" data-shape="${state.cfg.shape}" href="detail.html?type=${state.cfg.type}&sport=${item.sport}&q=${encodeURIComponent(item.name)}">
            <div class="dir-card-top">${avatar(item)}
                <span class="dir-card-text"><span class="dir-name item-name">${esc(item.name)}</span>${sub ? `<span class="dir-sub">${esc(sub)}</span>` : ''}</span>
            </div>${channels}</a>`;
    }

    // ── lista agrupada por letra + índice ──
    function groups(items) {
        const collator = new Intl.Collator(LanguageManager.getLanguage(), { sensitivity: 'base', numeric: true });
        const map = new Map();
        [...items].sort((a, b) => collator.compare(a.name, b.name)).forEach(i => {
            const k = initialOf(i.name);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(i);
        });
        return [...LETTERS, OTHER].filter(k => map.has(k)).map(k => [k, map.get(k)]);
    }

    function render() {
        const q = Utils.normalizeSearch(state.query);
        const shown = q ? state.items.filter(i => i.search.includes(q)) : state.items;
        $('dirCount').textContent = q ? `${shown.length} / ${state.items.length}` : state.items.length;

        const list = $('dirList'), index = $('dirIndex');
        if (!shown.length) {
            list.innerHTML = `<div class="empty-state">${t(state.items.length ? 'dirNoResults' : 'dirEmpty')}</div>`;
            index.hidden = true;
            return;
        }
        const grouped = groups(shown);
        list.innerHTML = grouped.map(([letter, items]) => `
            <section class="dir-group" id="dir-${letter === OTHER ? 'other' : letter}" data-letter="${letter}">
                <h2 class="dir-letter">${letter}<span class="counter">${items.length}</span></h2>
                <div class="dir-grid" data-shape="${state.cfg.shape}">${items.map(card).join('')}</div>
            </section>`).join('');

        const present = new Set(grouped.map(([k]) => k));
        index.hidden = false;
        index.innerHTML = [...LETTERS, ...(present.has(OTHER) ? [OTHER] : [])]
            .map(k => `<button type="button" class="dir-index-btn" data-letter="${k}"${present.has(k) ? '' : ' disabled'}>${k}</button>`).join('');
        spy();
    }

    function jump(letter) {
        const target = document.querySelector(`.dir-group[data-letter="${letter}"]`);
        if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }

    // Destaca no índice a letra da seção que está no topo
    let spyQueued = false;
    function spy() {
        if (spyQueued) return;
        spyQueued = true;
        requestAnimationFrame(() => {
            spyQueued = false;
            const offset = ($("dirIndex").offsetHeight || 0) + 40;
            let current = '';
            document.querySelectorAll('.dir-group').forEach(g => { if (g.getBoundingClientRect().top <= offset) current = g.dataset.letter; });
            $('dirIndex').querySelectorAll('.dir-index-btn').forEach(b => {
                const on = b.dataset.letter === current;
                b.classList.toggle('active', on);
                if (on) b.scrollIntoView({ block: 'nearest', inline: 'center' });
            });
        });
    }

    function skeleton() {
        $('dirList').innerHTML = `<div class="dir-grid" data-shape="${state.cfg.shape}">${Array.from({ length: 12 }, () =>
            '<div class="dir-card"><div class="dir-card-top"><span class="skeleton dir-skel-avatar"></span><span class="skeleton skeleton--line"></span></div></div>').join('')}</div>`;
    }

    function showUpdated() {
        const el = $('dirUpdated');
        const d = state.generatedAt ? new Date(state.generatedAt) : null;
        el.textContent = d && !isNaN(d) ? t('dirUpdated', { date: d.toLocaleString(LanguageManager.getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }) }) : '';
    }

    async function load() {
        skeleton();
        try {
            const res = await fetch(`${CONFIG.DIRECTORY_API_BASE}/${state.kind}`, { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            state.items = normalize(data);
            state.generatedAt = data.generated_at || '';
            render();
            showUpdated();
        } catch (e) {
            $('dirIndex').hidden = true;
            $('dirList').innerHTML = `<div class="empty-state dir-error">${t('dirError')}<br><button type="button" class="button" id="dirRetry">${t('dirRetry')}</button></div>`;
            $('dirRetry').addEventListener('click', load);
        }
    }

    function init() {
        state.kind = document.body.dataset.kind;
        state.cfg = KINDS[state.kind];
        if (!state.cfg) return;
        let timer;
        $('dirSearch').addEventListener('input', e => { clearTimeout(timer); timer = setTimeout(() => { state.query = e.target.value; render(); }, 120); });
        $('dirIndex').addEventListener('click', e => { const b = e.target.closest('[data-letter]'); if (b && !b.disabled) jump(b.dataset.letter); });
        window.addEventListener('scroll', spy, { passive: true });
        document.addEventListener('languagechange', () => { if (state.items.length) { render(); showUpdated(); } });
        load();
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', async () => { await window._headerPromise; Directory.init(); });
