/* ═══════════════════════════════════════════════════════════════
   HomeBrowse — times e narradores dos carrosséis da página inicial.
   Busca {HOME_BROWSE_API_BASE} (curadoria feita no admin, sem data).
   Se a API falhar ou a lista vier vazia, mantém o HTML estático da página.
═══════════════════════════════════════════════════════════════ */
const HomeBrowse = (() => {
    const esc = v => Utils.escapeHtml(v);

    // Mesma marcação dos cartões estáticos de index.html
    function card(kind, item) {
        const overflow = kind === 'commentary';
        const href = `/detail.html?type=${kind}&q=${encodeURIComponent(item.name)}`;
        return `<a href="${esc(href)}" class="browse-badge-card">
            <div class="browse-badge-circle${overflow ? ' circle-overflow' : ''}">
                ${item.image ? `<img src="${esc(item.image)}" class="browse-team-logo${overflow ? ' image-overflow' : ''}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
            </div>
            <span class="browse-badge-name">${esc(item.label || item.name)}</span>
        </a>`;
    }

    function fill(listId, kind, items) {
        const list = document.getElementById(listId);
        if (!list || !Array.isArray(items) || !items.length) return false;
        list.innerHTML = items.map(i => card(kind, i)).join('');
        list.scrollLeft = 0;
        return true;
    }

    async function load() {
        if (typeof CONFIG === 'undefined' || !CONFIG.HOME_BROWSE_API_BASE) return;
        try {
            const res = await fetch(CONFIG.HOME_BROWSE_API_BASE, { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            const data = await res.json();
            fill('clubsList', 'team', data.teams);
            fill('commentList', 'commentary', data.commentary);
        } catch { /* mantém o conteúdo estático */ }
    }

    return { load };
})();
