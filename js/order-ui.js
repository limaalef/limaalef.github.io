/* ============================================================
   ORDER UI — peças visuais compartilhadas pelas páginas de pedido
   (my-requests.html e request-detail.html). Depende de t() e esc()
   definidas em cada página; só são chamadas em tempo de execução.
   ============================================================ */

// Ícones de traço único (herdam a cor do texto)
const RD_ICON = {
    copy:     '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
    check:    '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 11 12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
    lock:     '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    back:     '<path d="M15 6l-6 6 6 6"/>',
    chevron:  '<path d="M6 9.5l6 6 6-6"/>',
    arrow:    '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
};
function ico(name, size = 16) {
    return `<svg class="rd-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RD_ICON[name]}</svg>`;
}

// Pílula de status: fundo neutro, bolinha na cor do tema (success / warning / error / info / accent)
function pill(kind, label) {
    return `<span class="rd-pill rd-pill--${kind}"><i></i>${label}</span>`;
}
const STATUS_KIND = { pending:'wait', processing:'info', ready:'ok', completed:'accent', expired:'off', cancelled:'err' };

// Progresso do pedido (Recebido → Em análise → Pronto). Etapas concluídas usam o accent.
function stepsHtml(o) {
    if (o.status === 'expired' || o.status === 'cancelled') return '';
    const steps = [t('requestProgressReceived'), t('requestProgressAnalysis'), t('requestProgressReady')];
    const idx = { pending:0, processing:1, ready:2, completed:3 }[o.status] ?? 0;
    return `<ol class="rd-steps">${steps.map((label, i) => {
        const cls = i < idx ? 'done' : (i === idx ? 'active' : 'todo');
        return `<li class="rd-step ${cls}">
            <span class="rd-step-dot">${i < idx ? ico('check', 12) : ''}</span>
            <span class="rd-step-lbl">${label}</span>
        </li>`;
    }).join('')}</ol>`;
}

// Miniatura gerada a partir do ID do item: cor estável por ID, tirada da paleta --chart-* do tema
function itemThumb(item) {
    const id = String(item.id ?? item.label ?? '');
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 6;
    const txt = id.length > 6 ? id.slice(-6) : id;
    return `<span class="rd-thumb" style="--c:var(--chart-${h + 1})" aria-hidden="true"><span>${esc(txt)}</span></span>`;
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
    return `<span class="rd-mlogo">
        <img class="rd-mlogo-l" src="${m.logo}.svg" alt="" onerror="rdLogoErr(this)">
        <img class="rd-mlogo-d" src="${m.logo}-dark.svg" alt="" onerror="rdLogoErr(this)">
    </span>`;
}
function rdLogoErr(img) {
    const wrap = img.parentNode;
    img.remove();
    if (wrap && wrap.querySelector('img')) wrap.classList.add('single');
}
