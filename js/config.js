const CONFIG = {
    API_URLS: {
        football: 'https://n12o72kc41.execute-api.sa-east-1.amazonaws.com/v1/matches?',
        others: 'https://n12o72kc41.execute-api.sa-east-1.amazonaws.com/v1/matches?type=multi',
        motor: 'https://n12o72kc41.execute-api.sa-east-1.amazonaws.com/v1/matches?type=motor'
    },
    CHANGELOG_URL: 'https://n12o72kc41.execute-api.sa-east-1.amazonaws.com/v1/changelog',
    DEFAULT_ITEMS_PER_PAGE: 200,
    currentSport: 'football',
    videoFilter: false
};

document.addEventListener('DOMContentLoaded', () => {
    fetch('/components/footer.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('footer').innerHTML = html;
        });
});