const CONFIG = {
    API_URLS: {
        football: 'https://api.limaalef.com/archive/matches?',
        others: 'https://api.limaalef.com/archive/matches?type=multi',
        motor: 'https://api.limaalef.com/archive/matches?type=motor'
    },
    CHANGELOG_URL: 'https://api.limaalef.com/archive/changelog',
    DEFAULT_ITEMS_PER_PAGE: 200,
    currentSport: 'football',
    videoFilter: false
};

// Promise criada imediatamente — não depende de ordem de scripts
window._headerPromise = new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', async () => {
        const isMobile = window.matchMedia('(max-width: 496px)').matches;

        if (!isMobile) {
            fetch('/components/footer.html')
                .then(res => res.text())
                .then(html => {
                    document.getElementById('footer').innerHTML = html;
                });
        }

        const container = document.getElementById('header');
        const res = await fetch('/components/header.html');
        container.innerHTML = await res.text();

        // Logo e título
        const logo = document.getElementById('logo-header-svg');

        if (isMobile && container.dataset.back === 'true') {
            document.getElementById('page-title').textContent = container.dataset.title || '';
            logo.style.display = 'none';
        }

        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        // Botão voltar
        if (isMobile && container.dataset.back === 'true') {
            const backBtn = document.createElement('a');
            backBtn.href = 'index.html';
            backBtn.className = 'btn back-btn';
            backBtn.onclick = e => {
                e.preventDefault();
                history.length > 1 ? history.back() : location.href = 'index.html';
            };
            backBtn.innerHTML = `<span class="button-text">‹</span>`;
            document.getElementById('logo-header').prepend(backBtn);
        }

        // Ações extras
        const actions = container.dataset.actions;
        if (actions) {
            document.getElementById('header-actions')
                .insertAdjacentHTML('afterbegin', actions);
        }

        resolve(); // sinaliza que o header está pronto
    });
});