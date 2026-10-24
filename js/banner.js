/* ═══════════════════════════════════════════════════════════════
   BannerCarousel — módulo independente de banners.
   Uso na página:  BannerCarousel.mount('#homeBanners');
   Busca {BANNERS_API_BASE} (a API já devolve só o que está publicado
   agora). Sem banners ou com erro, o container permanece oculto.
   BannerCarousel.slideHtml(banner) também serve ao preview do admin.
═══════════════════════════════════════════════════════════════ */
const BannerCarousel = (() => {
    const AUTOPLAY_MS = 6000;
    const HEX = /^#[0-9a-f]{6}$/i;
    const ARROW = {
        prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
        next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    };

    const esc = v => Utils.escapeHtml(v);
    const safeColor = (value, fallback) => (HEX.test(value || '') ? value : fallback);
    const safeUrl = url => (/^(https?:\/\/|\/|[\w.-]+(\/|\.html))/i.test(url || '') && !/^\s*(javascript|data):/i.test(url) ? url : '');

    // Texto no idioma da página: português em PT; nos demais, inglês. Campo vazio usa o outro idioma.
    const isPt = () => (typeof LanguageManager !== 'undefined' ? LanguageManager.getLanguage() : 'pt-BR').toLowerCase().startsWith('pt');
    const pick = (b, key, lang) => {
        const pt = b[key] || '', en = b[key + '_en'] || '';
        return (lang === 'pt' || (lang === undefined && isPt())) ? (pt || en) : (en || pt);
    };

    function slideHtml(b, { eager = false, preview = false, lang } = {}) {
        const title = pick(b, 'title', lang), headline = pick(b, 'headline', lang), subtitle = pick(b, 'subtitle', lang);
        const style = [
            b.bg_color ? `--banner-bg:${safeColor(b.bg_color, '')}` : '',
            b.text_color ? `--banner-text:${safeColor(b.text_color, '')}` : '',
            b.title_bg_color ? `--banner-title-bg:${safeColor(b.title_bg_color, '')}` : '',
            b.title_text_color ? `--banner-title-text:${safeColor(b.title_text_color, '')}` : '',
        ].filter(s => !s.endsWith(':')).join(';');

        const inner = `
            ${b.image_url ? `<img class="banner-image" src="${esc(b.image_url)}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" draggable="false">` : ''}
            <div class="banner-content">
                ${title ? `<span class="banner-title">${esc(title)}</span>` : ''}
                <p class="banner-headline">${esc(headline)}</p>
                ${subtitle ? `<p class="banner-subtitle">${esc(subtitle)}</p>` : ''}
            </div>`;

        const link = preview ? '' : safeUrl(b.link_url);
        if (!link) return `<div class="banner" style="${style}">${inner}</div>`;
        const external = /^https?:\/\//i.test(link) && new URL(link).origin !== location.origin;
        return `<a class="banner" style="${style}" href="${esc(link)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`;
    }

    function mount(target, { endpoint } = {}) {
        const host = typeof target === 'string' ? document.querySelector(target) : target;
        if (!host) return;
        const url = endpoint || (typeof CONFIG !== 'undefined' ? CONFIG.BANNERS_API_BASE : '');
        if (!url) return;

        fetch(url, { headers: { Accept: 'application/json' } })
            .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(data => {
                const banners = Array.isArray(data.banners) ? data.banners : [];
                render(host, banners);
                // Trocar o idioma redesenha com o texto da outra língua
                document.addEventListener('languagechange', () => retext(host, banners));
            })
            .catch(() => { host.hidden = true; });
    }

    // Troca só os textos dos slides já montados (mantém posição do carrossel e rotação)
    function retext(host, banners) {
        const tpl = document.createElement('template');
        host.querySelectorAll('.banner').forEach((el, i) => {
            if (!banners[i]) return;
            tpl.innerHTML = slideHtml(banners[i], { preview: true });
            const content = tpl.content.querySelector('.banner-content');
            const target = el.querySelector('.banner-content');
            if (content && target) target.innerHTML = content.innerHTML;
        });
    }

    function render(host, banners) {
        if (!banners.length) { host.hidden = true; host.innerHTML = ''; return; }
        const single = banners.length === 1;

        host.classList.add('banner-carousel');
        host.classList.toggle('is-single', single);
        host.setAttribute('role', 'region');
        host.setAttribute('aria-roledescription', 'carrossel');
        host.setAttribute('aria-label', 'Destaques');
        host.innerHTML = `
            <div class="banner-stage">
                <div class="banner-track">${banners.map((b, i) => slideHtml(b, { eager: i === 0 })).join('')}</div>
                <button type="button" class="banner-arrow banner-arrow--prev" aria-label="Banner anterior">${ARROW.prev}</button>
                <button type="button" class="banner-arrow banner-arrow--next" aria-label="Próximo banner">${ARROW.next}</button>
            </div>
            <div class="banner-dots">${banners.map((_, i) => `<button type="button" class="banner-dot${i ? '' : ' active'}" aria-label="Ir para o banner ${i + 1}"></button>`).join('')}</div>`;
        host.hidden = false;
        if (!single) enhance(host, banners.length);
    }

    function enhance(host, count) {
        const track = host.querySelector('.banner-track');
        const dots = [...host.querySelectorAll('.banner-dot')];
        let current = 0, timer = null, held = false;

        const width = () => track.clientWidth + parseFloat(getComputedStyle(track).columnGap || 0);
        const goTo = i => {
            current = (i + count) % count;
            track.scrollTo({ left: current * width(), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        };
        const markActive = () => {
            current = Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / width())));
            dots.forEach((d, i) => { d.classList.toggle('active', i === current); i === current ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'); });
        };

        track.addEventListener('scroll', () => requestAnimationFrame(markActive), { passive: true });
        host.querySelector('.banner-arrow--prev').addEventListener('click', () => goTo(current - 1));
        host.querySelector('.banner-arrow--next').addEventListener('click', () => goTo(current + 1));
        dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

        // Rotação automática: pausa com mouse, foco, toque e aba oculta; desligada com "reduzir movimento".
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const stop = () => { clearInterval(timer); timer = null; };
        const start = () => { if (!timer && !held && !document.hidden) timer = setInterval(() => goTo(current + 1), AUTOPLAY_MS); };
        const hold = on => { held = on; on ? stop() : start(); };
        host.addEventListener('mouseenter', () => hold(true));
        host.addEventListener('mouseleave', () => hold(false));
        host.addEventListener('focusin', () => hold(true));
        host.addEventListener('focusout', () => hold(false));
        host.addEventListener('touchstart', () => hold(true), { passive: true });
        host.addEventListener('touchend', () => setTimeout(() => hold(false), AUTOPLAY_MS), { passive: true });
        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
        start();
    }

    return { mount, render, slideHtml };
})();
