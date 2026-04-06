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

document.addEventListener('DOMContentLoaded', () => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;

    if (!isMobile) {
        fetch('/components/footer.html')
            .then(res => res.text())
            .then(html => {
                document.getElementById('footer').innerHTML = html;
            });
    }
});