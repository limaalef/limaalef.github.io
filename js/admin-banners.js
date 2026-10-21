/* ═══════════════════════════════════════════════════════════════
   Admin → painel "Banners": lista com status + criador com preview.
   Depende de: CONFIG, admFetch, notify, esc (admin.html), pill (ui-components.js)
   e BannerCarousel.slideHtml (banner.js) para o preview.
   API: {BANNERS_API_BASE}/admin  (ver workers/banners)
═══════════════════════════════════════════════════════════════ */
const AdminBanners = (() => {
    const STATUS = {
        active:    ['success', 'No ar'],
        scheduled: ['waiting', 'Agendado'],
        expired:   ['off',     'Encerrado'],
        disabled:  ['off',     'Desativado'],
    };
    const DEFAULTS = { bg_color: '#1f2937', text_color: '#ffffff', title_bg_color: '#8b5cf6', title_text_color: '#ffffff' };
    const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    const IMAGE_TYPES = ['image/png', 'image/webp', 'image/jpeg', 'image/avif'];

    let banners = [], loaded = false;
    let draft = null;          // banner em edição
    let pendingFile = null;    // arquivo escolhido, enviado só ao salvar
    let pendingUrl = '';       // object URL do arquivo escolhido

    const $ = id => document.getElementById(id);
    const api = path => `${CONFIG.BANNERS_API_BASE}/admin${path}`;

    // ── datas: o <input datetime-local> é no fuso do navegador; a API guarda ISO em UTC ──
    const pad = n => String(n).padStart(2, '0');
    const toLocalInput = iso => {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const fromLocalInput = v => (v ? new Date(v).toISOString() : null);
    const fmt = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const period = b => `${b.starts_at ? fmt(b.starts_at) : 'Imediato'} → ${b.ends_at ? fmt(b.ends_at) : 'sem término'}`;

    // ── lista ──
    async function load(force) {
        if (loaded && !force) return render();
        $('bn-loading').classList.remove('is-hidden');
        try {
            const res = await admFetch(api(''));
            if (!res.ok) throw new Error('HTTP ' + res.status);
            banners = (await res.json()).banners || [];
            loaded = true;
            render();
        } catch (e) {
            $('bn-list').innerHTML = '';
            $('bn-empty').classList.remove('is-hidden');
            $('bn-empty').textContent = 'Não foi possível carregar os banners: ' + e.message;
        } finally {
            $('bn-loading').classList.add('is-hidden');
        }
    }

    function render() {
        $('bn-count').textContent = banners.length;
        $('bn-empty').textContent = 'Nenhum banner cadastrado.';
        $('bn-empty').classList.toggle('is-hidden', banners.length > 0);
        $('bn-list').innerHTML = banners.map(b => {
            const [kind, label] = STATUS[b.status] || ['', b.status];
            return `<div class="bn-row" data-id="${esc(b.id)}">
                <div class="bn-thumb" style="background:${esc(b.bg_color)}">${b.image_url ? `<img src="${esc(b.image_url)}" alt="" loading="lazy">` : ''}</div>
                <div class="bn-info">
                    <div class="bn-name item-name">${esc(b.headline)}</div>
                    <div class="bn-meta">${esc(b.title)} · ${esc(period(b))} · ordem ${b.sort_order}</div>
                </div>
                ${pill(kind, label)}
                <div class="bn-actions row-wrap row-wrap--end">
                    <button type="button" class="action-btn btn-ghost btn-xs" data-act="edit">Editar</button>
                    <button type="button" class="action-btn btn-ghost btn-xs" data-act="toggle">${b.enabled ? 'Desativar' : 'Ativar'}</button>
                    <button type="button" class="action-btn btn-danger btn-xs" data-act="delete">Excluir</button>
                </div>
            </div>`;
        }).join('');
    }

    async function onListClick(e) {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const b = banners.find(x => x.id === btn.closest('.bn-row').dataset.id);
        if (!b) return;
        if (btn.dataset.act === 'edit') return openEditor(b);
        if (btn.dataset.act === 'toggle') return persist({ ...b, enabled: !b.enabled }).then(ok => ok && load(true));
        if (btn.dataset.act === 'delete') {
            if (!confirm(`Excluir o banner "${b.headline}"? A imagem também será apagada.`)) return;
            const res = await admFetch(api('/' + encodeURIComponent(b.id)), { method: 'DELETE' });
            if (!res.ok) return notify((await res.json().catch(() => ({}))).error || 'Erro ao excluir.');
            notify('Banner excluído.', 'success');
            load(true);
        }
    }

    // ── editor ──
    function openEditor(b) {
        draft = b ? { ...b } : { ...DEFAULTS, title: '', headline: '', subtitle: '', link_url: '', image_url: '', image_key: '',
                                 sort_order: banners.length, enabled: true, starts_at: null, ends_at: null };
        pendingFile = null; pendingUrl = '';
        $('bn-editor-title').textContent = b ? 'Editar banner' : 'Novo banner';
        const set = (id, v) => { $(id).value = v ?? ''; };
        set('bn-title', draft.title); set('bn-headline', draft.headline); set('bn-subtitle', draft.subtitle); set('bn-link', draft.link_url);
        set('bn-order', draft.sort_order);
        for (const k of Object.keys(DEFAULTS)) set('bn-' + k, draft[k]);
        $('bn-enabled').checked = !!draft.enabled;
        set('bn-starts', toLocalInput(draft.starts_at)); set('bn-ends', toLocalInput(draft.ends_at));
        $('bn-file').value = '';
        $('bn-list-view').classList.add('is-hidden');
        $('bn-editor').classList.remove('is-hidden');
        window.scrollTo(0, 0);
        refresh();
    }

    function closeEditor() {
        if (pendingUrl) URL.revokeObjectURL(pendingUrl);
        draft = null; pendingFile = null; pendingUrl = '';
        $('bn-editor').classList.add('is-hidden');
        $('bn-list-view').classList.remove('is-hidden');
    }

    // Lê o formulário, atualiza contadores/hex e redesenha o preview.
    function readForm() {
        const v = id => $(id).value.trim();
        return {
            ...draft,
            title: v('bn-title'), headline: v('bn-headline'), subtitle: v('bn-subtitle'), link_url: v('bn-link'),
            sort_order: parseInt($('bn-order').value, 10) || 0, enabled: $('bn-enabled').checked,
            starts_at: fromLocalInput($('bn-starts').value), ends_at: fromLocalInput($('bn-ends').value),
            bg_color: $('bn-bg_color').value, text_color: $('bn-text_color').value,
            title_bg_color: $('bn-title_bg_color').value, title_text_color: $('bn-title_text_color').value,
            image_url: pendingUrl || draft.image_url,
        };
    }

    function refresh() {
        const b = readForm();
        for (const k of Object.keys(DEFAULTS)) $(`bn-${k}-hex`).textContent = b[k];
        for (const [id, max] of [['bn-title', 40], ['bn-headline', 90], ['bn-subtitle', 160]]) $(id + '-count').textContent = `${$(id).value.length}/${max}`;

        const thumb = $('bn-upload-thumb');
        thumb.style.background = b.bg_color;
        thumb.innerHTML = b.image_url ? `<img src="${esc(b.image_url)}" alt="">` : '';
        $('bn-upload-name').textContent = pendingFile ? pendingFile.name : (b.image_url ? 'Imagem atual' : 'Nenhuma imagem');

        $('bn-preview').innerHTML = `<div class="banner-carousel is-single"><div class="banner-track">${
            BannerCarousel.slideHtml({ ...b, title: b.title || 'TÍTULO', headline: b.headline || 'Texto de destaque do banner',
                                       subtitle: b.subtitle || 'Texto auxiliar abaixo do destaque' }, { eager: true, preview: true })}</div></div>`;

        const [kind, label] = STATUS[statusOf(b)];
        $('bn-status').innerHTML = pill(kind, label);
    }

    function statusOf(b) {
        const now = Date.now();
        if (!b.enabled) return 'disabled';
        if (b.starts_at && new Date(b.starts_at) > now) return 'scheduled';
        if (b.ends_at && new Date(b.ends_at) <= now) return 'expired';
        return 'active';
    }

    function onFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!IMAGE_TYPES.includes(file.type)) { e.target.value = ''; return notify('Use PNG, WebP, JPEG ou AVIF (de preferência PNG/WebP com fundo transparente).', 'warning'); }
        if (file.size > MAX_IMAGE_BYTES) { e.target.value = ''; return notify('A imagem deve ter no máximo 2 MB.', 'warning'); }
        if (pendingUrl) URL.revokeObjectURL(pendingUrl);
        pendingFile = file; pendingUrl = URL.createObjectURL(file);
        refresh();
        // Aviso (não bloqueia) se a proporção estiver longe de 5:3
        const probe = new Image();
        probe.onload = () => { const r = probe.width / probe.height; if (Math.abs(r - 5 / 3) > 0.08) notify(`A imagem tem proporção ${probe.width}×${probe.height}; o ideal é 5×3 (ela será recortada).`, 'warning'); };
        probe.src = pendingUrl;
    }

    // Envia a imagem (se houver nova) e grava o banner.
    async function persist(b, file = null) {
        try {
            let imageKey = b.image_key || '';
            if (file) {
                const up = await admFetch(api('/image'), { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
                const d = await up.json().catch(() => ({}));
                if (!up.ok) throw new Error(d.error || `Upload falhou (HTTP ${up.status})`);
                imageKey = d.image_key;
            }
            const payload = { ...b, image_key: imageKey };
            const res = await admFetch(api(b.id ? '/' + encodeURIComponent(b.id) : ''), {
                method: b.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
            notify('Banner salvo.', 'success');
            return true;
        } catch (e) {
            notify('Erro ao salvar: ' + e.message);
            return false;
        }
    }

    async function save() {
        const b = readForm();
        if (!b.title) return notify('Informe o título.', 'warning');
        if (!b.headline) return notify('Informe o texto de destaque.', 'warning');
        if (b.starts_at && b.ends_at && b.ends_at <= b.starts_at) return notify('O término deve ser depois do início.', 'warning');
        const btn = $('bn-save'); btn.disabled = true;
        const ok = await persist(b, pendingFile);
        btn.disabled = false;
        if (ok) { closeEditor(); load(true); }
    }

    function init() {
        $('bn-list').addEventListener('click', onListClick);
        $('bn-new').addEventListener('click', () => openEditor(null));
        $('bn-back').addEventListener('click', closeEditor);
        $('bn-cancel').addEventListener('click', closeEditor);
        $('bn-save').addEventListener('click', save);
        $('bn-pick').addEventListener('click', () => $('bn-file').click());
        $('bn-file').addEventListener('change', onFile);
        $('bn-remove-image').addEventListener('click', () => { if (pendingUrl) URL.revokeObjectURL(pendingUrl); pendingFile = null; pendingUrl = ''; draft.image_url = ''; draft.image_key = ''; $('bn-file').value = ''; refresh(); });
        $('bn-clear-ends').addEventListener('click', () => { $('bn-ends').value = ''; refresh(); });
        $('bn-form').addEventListener('input', refresh);
    }

    return { init, load };
})();
