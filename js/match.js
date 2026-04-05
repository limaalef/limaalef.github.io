const MatchPage = {
    async init() {
        LanguageManager.init();

        const params = new URLSearchParams(window.location.search);
        const id     = parseInt(params.get('id'));
        const sport  = ['football', 'others', 'motor'].includes(params.get('sport'))
            ? params.get('sport')
            : 'football';

        // Aplica tema
        document.body.classList.remove('theme-football', 'theme-others', 'theme-motor');
        document.body.classList.add(sport === 'motor' ? 'theme-motor' : sport === 'others' ? 'theme-others' : 'theme-football');

        if (!id) {
            this.renderError('ID não informado na URL.');
            return;
        }

        CONFIG.currentSport = sport;

        try {
            const apiResponse = await APIService.fetchById(id, sport);
            const items = APIService.transformData(apiResponse);
            if (!items.length) throw new Error('Partida não encontrada.');
            this.render(items[0], sport);
        } catch (err) {
            this.renderError(err.message);
        }
    },

    render(match, sport) {
        const container = document.getElementById('matchPageContent');

        // Atualiza o <title> da página
        if (sport !== 'motor') {
            const homeGoals = match['Gols mandante'] != null && match['Gols mandante'] !== '' ? Math.round(parseFloat(match['Gols mandante'])) : '';
            const awayGoals = match['Gols visitante'] != null && match['Gols visitante'] !== '' ? Math.round(parseFloat(match['Gols visitante'])) : '';
            const score = homeGoals !== '' ? ` ${homeGoals}x${awayGoals} ` : ' x ';
            document.title = `${match.Mandante}${score}${match.Visitante} — Sports Archive`;
        } else {
            document.title = `${match.Campeonato} — ${match.Fase} — Sports Archive`;
        }

        // Reutiliza exatamente o mesmo HTML que o modal geraria,
        // injetando em divs com os mesmos IDs que MatchModal.show() escreve
        container.innerHTML = `
            <div class="modal-header">
                <h2 id="modalTitle"></h2>
                <div id="modalScore" class="modal-score"></div>
            </div>
            <div class="modal-body" id="modalBody"></div>
        `;

        // Chama o show() existente — ele popula modalTitle, modalScore e modalBody
        if (sport === 'motor') {
            MotorModal.show(match);
        } else {
            MatchModal.show(match);
        }

        // O show() adiciona .active ao #modal (que não existe aqui), ignora silenciosamente
    },

    renderError(message) {
        document.getElementById('matchPageContent').innerHTML = `
            <div class="state-box">
                <div class="icon">❌</div>
                <h2>Erro ao carregar</h2>
                <p>${message}</p>
                <a href="index.html" style="margin-top: 16px; display: inline-block; color: var(--accent-color);">
                    ← Voltar para a coleção
                </a>
            </div>
        `;
    }
};

window.addEventListener('DOMContentLoaded', () => MatchPage.init());