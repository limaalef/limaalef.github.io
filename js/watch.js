// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await window._headerPromise;

    const params = new URLSearchParams(location.search);
    const id     = params.get('id');
    const sport  = params.get('sport') || 'football';

    Utils.applySportTheme(sport);

    if (!id) { showWatchError(); return; }

    try {
        const data = await APIService.fetchById(id, sport);
        if (!data?.data?.length) throw new Error('Sem dados');

        const raw   = data.data[0];
        const match = APIService.transformData({ data: [raw] }, sport)[0];

        renderWatch(match, sport, raw);
        hideWatchLoading();
        showWatchContent();

    } catch (err) {
        console.error('Erro ao carregar partida:', err);
        showWatchError();
    }
});

// ─── Render principal ────────────────────────────
function renderWatch(match, sport, raw) {
    renderWatchHero(match);
    renderWatchVideo(raw);
    renderWatchLineups(match, raw);
    renderWatchTvInfo(match);
    renderWatchTechInfo(match);
    Elements.renderStorage(match, 'meStorageBadges');
    updateWatchMetaTags(match, raw);

    // Enriquecimento GE Globo — sobrescreve escalações e adiciona forma recente
    APIService.fetchEnrichment(match.ID, sport).then(detail => {
        if (!detail) return;

        if (detail.homeTeam?.lineup || detail.awayTeam?.lineup) {
            renderWatchLineupsEnriched(detail.homeTeam, detail.awayTeam);
        }

        if (detail.last_results) {
            renderWatchLastResults(detail.last_results);
        }

        if (detail.statistics) {
            Elements.renderStatistics(detail.statistics, detail);
        }

        if (detail.plays) {
            Elements.renderPlays(detail, detail.homeTeam.tla);
        }

        if (detail.penalties?.length) {
            Elements.renderPenalties(detail, detail.homeTeam.tla);
        }
        
    });
}

// ─── Hero (idêntico ao match.js) ─────────────────
function renderWatchHero(match) {
    const { homeGoals, awayGoals } = Utils.parseWinner(match['Gols mandante'], match['Gols visitante']);
    const hasScore = homeGoals !== null && awayGoals !== null;

    const compLogoSlug = (match.Competição || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    const year     = Utils.parseDate(match.Data)?.getFullYear() || '';
    const compLogo = match.Competição ? `competition_logos/${compLogoSlug}_${year}.png` : '';
    const dateStr  = Utils.formatMatchDate(match.Data);

    document.getElementById('watchHero').innerHTML = `
        <div class="score-overlay">
            <div class="logo-title-header">
                ${compLogo ? `<img src="${compLogo}" class="comp-logo" onerror="this.style.display='none'" alt="">` : ''}
                <h2 id="modalTitle">
                    <div class="section-title modal-title-competition">${LanguageManager.t(match.Competição) || ''}</div>
                    <div class="modal-title-phase">${LanguageManager.translateText(match.Fase)}</div>
                </h2>
            </div>

            <!-- Desktop -->
            <div class="score-desktop">
                <span class="score-team-name">${LanguageManager.t(match.Mandante) || ''}</span>
                ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" class="score-team-logo" onerror="this.style.display='none'" alt="">` : ''}
                <span class="score-value-modal">${hasScore ? homeGoals : ''} × ${hasScore ? awayGoals : ''}</span>
                ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" class="score-team-logo" onerror="this.style.display='none'" alt="">` : ''}
                <span class="score-team-name">${LanguageManager.t(match.Visitante) || '—'}</span>
            </div>

            <!-- Mobile -->
            <div class="score-mobile">
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match['Logo mandante'] ? `<img src="${match['Logo mandante']}" class="score-mobile-logo" onerror="this.style.display='none'" alt="">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.Mandante) || '—'}</span>
                    </div>
                    <span class="score-mobile-value">${hasScore ? homeGoals : ''}</span>
                </div>
                <div class="score-mobile-row">
                    <div class="score-mobile-team">
                        ${match['Logo visitante'] ? `<img src="${match['Logo visitante']}" class="score-mobile-logo" onerror="this.style.display='none'" alt="">` : ''}
                        <span class="score-team-name">${LanguageManager.t(match.Visitante) || '—'}</span>
                    </div>
                    <span class="score-mobile-value">${hasScore ? awayGoals : ''}</span>
                </div>
            </div>

            <div class="score-date-row">
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
                ${match.Estadio ? `<span>🏟️ ${match.Estadio}</span>` : ''}
            </div>
        </div>
    `;
}

// ─── Vídeo ───────────────────────────────────────
function renderWatchVideo(raw) {
    const embedUrl    = raw.embed_video || raw['Video embed'] || raw['Embed'] || '';
    const iframe      = document.getElementById('videoPlayer');
    const placeholder = document.getElementById('videoPlaceholder');

    if (embedUrl) {
        iframe.src            = embedUrl;
        iframe.style.display  = 'block';
        placeholder.style.display = 'none';
    } else {
        iframe.style.display      = 'none';
        placeholder.style.display = 'flex';
    }
}

// ─── Escalações simples (dados da API principal) ──
function renderWatchLineups(match, raw) {
    const homeLineup = raw.home_team?.lineup || [];
    const awayLineup = raw.away_team?.lineup || [];

    document.getElementById('watchHomeTeamName').textContent =
        LanguageManager.t(match.Mandante) || match.Mandante || '—';
    document.getElementById('watchAwayTeamName').textContent =
        LanguageManager.t(match.Visitante) || match.Visitante || '—';

    document.getElementById('watchHomeFormation').textContent = raw.home_team?.formation || '';
    document.getElementById('watchAwayFormation').textContent = raw.away_team?.formation || '';

    renderSimpleLineupList('watchHomeLineupList', homeLineup);
    renderSimpleLineupList('watchAwayLineupList', awayLineup);
}

function renderSimpleLineupList(containerId, lineup) {
    const el = document.getElementById(containerId);
    if (!lineup?.length) {
        el.innerHTML = `
            <div class="me-player-row" style="justify-content:center;color:var(--text-tertiary);font-size:var(--font-size-sm);">
                Escalação não disponível
            </div>`;
        return;
    }
    el.innerHTML = lineup.map(p => `
        <div class="me-player-row">
            <span class="me-player-num">${p.number ?? p.shirtNumber ?? ''}</span>
            <span class="me-player-name">${p.name || p.fullName || '—'}</span>
            <span class="me-player-pos">${p.position || p.posSlug || ''}</span>
        </div>
    `).join('');
}

function renderWatchLineupsEnriched(homeTeam, awayTeam) {
    [
        { team: homeTeam, colId: 'watchHomeLineup' },
        { team: awayTeam, colId: 'watchAwayLineup' },
    ].forEach(({ team, colId }) => {
        if (!team?.lineup) return;
        const col    = Elements.buildLineupCol(team);
        const target = document.getElementById(colId);
        // Transfere classe de largura do watch para o col gerado
        col.classList.add('watch-lineup-col');
        target.replaceWith(col);
        col.id = colId;
    });
}

// ─── Forma recente (GE Globo) ─────────────────────
function renderWatchLastResults(last_results) {
    const home = last_results.homeTeam || [];
    const away = last_results.awayTeam || [];
    if (!home.length && !away.length) return;

    const resultIcon = r => {
        const v = (r || '').toUpperCase();
        if (v === 'VICTORY' || v === 'WIN')  return '<span class="me-form-win">V</span>';
        if (v === 'DEFEAT'  || v === 'LOSS') return '<span class="me-form-loss">D</span>';
        return '<span class="me-form-draw">E</span>';
    };

    const score = document.querySelector('#watchHero .score-desktop');
    if (score) {
        score.insertAdjacentHTML('afterbegin',
            `<span class="me-form-badges">${home.map(resultIcon).join('')}</span>`);
        score.insertAdjacentHTML('beforeend',
            `<span class="me-form-badges">${away.map(resultIcon).join('')}</span>`);
    }

    const teams = document.querySelectorAll('#watchHero .score-mobile .score-team-name');
    if (teams[0]) {
        const b = document.createElement('span');
        b.className = 'me-form-badges';
        b.innerHTML = home.map(resultIcon).join('');
        teams[0].after(b);
    }
    if (teams[1]) {
        const b = document.createElement('span');
        b.className = 'me-form-badges';
        b.innerHTML = away.map(resultIcon).join('');
        teams[1].after(b);
    }
}

function renderWatchTvInfo(match) {
    const rows = [
        { label: 'broadcaster', value: match.Emissora                 || 'N/A' },
        { label: 'narration',   value: match.Narração                  || 'N/A' },
        { label: 'origin',      value: LanguageManager.t(match.Origem) || 'N/A' },
        { label: 'type',        value: LanguageManager.t(match.Tipo)   || 'N/A' },
    ];
    document.getElementById('watchTvInfo').innerHTML = Elements.setDetailList(rows);
}

function renderWatchTechInfo(match) {
    const items = [
        { label: 'ID',          value: match.ID },
        { label: 'quality',     value: match.Qualidade },
        { label: 'audioFormat', value: match['Formato de áudio'] },
        { label: 'bitrate',     value: match.Bitrate ? (match.Bitrate + ' Mbps') : 'N/A' },
        { label: 'duration',    value: match.Duração },
        { label: 'fileSize',    value: Utils.formatSize(match.Tamanho) },
    ];
    document.getElementById('watchTechInfo').innerHTML = Elements.setDetailList(items);
}

// ─── Meta tags ────────────────────────────────────
function updateWatchMetaTags(match, raw) {
    const home  = LanguageManager.t(match.Mandante)  || match.Mandante  || '';
    const away  = LanguageManager.t(match.Visitante) || match.Visitante || '';
    const comp  = LanguageManager.t(match.Competição) || match.Competição || '';
    const title = `${home} vs ${away} - ${comp}`;
    const desc  = `Assista ${home} ${match['Gols mandante'] ?? ''} x ${match['Gols visitante'] ?? ''} ${away} - ${comp}`;

    document.title = title + ' — Sports Archive';

    const set = (id, val) => document.getElementById(id)?.setAttribute('content', val);
    set('og-title',            title);
    set('og-description',      desc);
    set('twitter-title',       title);
    set('twitter-description', desc);
    document.getElementById('twitter-url')?.setAttribute('content', location.href);

    const img = raw.image || match.Imagem?.[0] || '';
    if (img) { set('og-image', img); set('twitter-image', img); }
}

// ─── Estado da página ─────────────────────────────
function hideWatchLoading() { document.getElementById('watchLoading').style.display = 'none';  }
function showWatchContent() { document.getElementById('watchContent').style.display  = 'block'; }
function showWatchError()   {
    hideWatchLoading();
    document.getElementById('watchError').style.display = 'block';
}