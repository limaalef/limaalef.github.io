/* ============================================================
   UI COMPONENTS — marcação das peças compartilhadas (estilos em
   css/ui-components.css). Usada por pedidos, admin e storage.
   Não depende de nada das páginas, exceto stepsHtml() que usa t().
   ============================================================ */

function uiEscape(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Ícones de traço único (herdam a cor do texto)
const ICON_PATHS = {
    copy:     '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
    check:    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 11 12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
    lock:     '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    back:     '<path d="M15 6l-6 6 6 6"/>',
    chevron:  '<path d="M6 9.5l6 6 6-6"/>',
    arrow:    '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    'chevron-right': '<path d="M9 6l6 6-6 6"/>',
    disk:     '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 14.5h17"/><path d="M16.5 17h.01"/>',
    cloud:    '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 11a3.8 3.8 0 0 1-.5 7.5H7z"/>',
};
function icon(name, size = 16) {
    return `<svg class="inline-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

// Pílula de status: fundo neutro, bolinha na cor do tema.
// kind: success | waiting | error | info | accent | off (ou vazio = neutro)
function pill(kind, label) {
    return `<span class="status-pill${kind ? ` status-pill--${kind}` : ''}"><i></i>${label}</span>`;
}
const STATUS_KIND = { pending:'waiting', processing:'info', ready:'success', completed:'accent', expired:'off', cancelled:'error' };

// Linha rótulo → valor. modifier: 'muted' | 'mono' (opcional)
function keyValueRow(label, valueHtml, modifier = '') {
    return `<div class="key-value${modifier ? ` key-value--${modifier}` : ''}"><span class="key-value-label">${label}</span><span class="key-value-value">${valueHtml}</span></div>`;
}

// Indicador: valor grande + rótulo. highlight = valor em accent
function statTile(value, label, highlight = false) {
    return `<div class="stat-tile${highlight ? ' stat-tile--highlight' : ''}"><div class="stat-tile-value">${value}</div><div class="stat-tile-label">${label}</div></div>`;
}

// Progresso do pedido (Recebido → Em análise → Pronto). Etapas concluídas usam o accent.
function stepsHtml(o) {
    if (o.status === 'expired' || o.status === 'cancelled') return '';
    const steps = [t('requestProgressReceived'), t('requestProgressAnalysis'), t('requestProgressReady')];
    const idx = { pending:0, processing:1, ready:2, completed:3 }[o.status] ?? 0;
    return `<ol class="stepper">${steps.map((label, i) => {
        const cls = i < idx ? 'done' : (i === idx ? 'active' : 'todo');
        return `<li class="stepper-step ${cls}">
            <span class="stepper-dot">${i < idx ? icon('check', 12) : ''}</span>
            <span class="stepper-label">${label}</span>
        </li>`;
    }).join('')}</ol>`;
}

// Miniatura gerada a partir do ID do item: cor estável por ID, tirada da paleta --chart-* do tema
function itemThumb(item) {
    const id = String(item.id ?? item.label ?? '');
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 6;
    const txt = id.length > 6 ? id.slice(-6) : id;
    return `<span class="thumbnail" style="--c:var(--chart-${h + 1})" aria-hidden="true"><span>${uiEscape(txt)}</span></span>`;
}

// Métodos de pagamento. Logotipos oficiais em /icons/payments/ (ver README da pasta):
//   <nome>.svg       → para fundo claro
//   <nome>-dark.svg  → para fundo escuro
// Se só um dos arquivos existir, ele é usado nos dois temas; se nenhum existir, aparece só o nome.
const PAY_METHODS = {
    pix:    { name: 'Pix',    logo: '/icons/payments/pix'    },
    paypal: { name: 'PayPal', logo: '/icons/payments/paypal' },
};
function payMethodKey(o) {
    return (o.externalPayment || o.paymentExternal === true || o.payment?.provider === 'paypal') ? 'paypal' : 'pix';
}
function methodLogo(key) {
    const m = PAY_METHODS[key];
    return `<span class="payment-logo">
        <img class="payment-logo-light" src="${m.logo}.svg" alt="" onerror="paymentLogoFallback(this)">
        <img class="payment-logo-dark" src="${m.logo}-dark.svg" alt="" onerror="paymentLogoFallback(this)">
    </span>`;
}
function paymentLogoFallback(img) {
    const wrap = img.parentNode;
    img.remove();
    if (wrap && wrap.querySelector('img')) wrap.classList.add('single');
}
