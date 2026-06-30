/**
 * collections.js
 * Interface de acesso aos dados de times e competições.
 *
 * Os dados vivem em data/collections.json (gerado por sheets-to-json.mjs).
 * Este módulo carrega o JSON uma única vez e expõe o CollectionsDB para o
 * SidebarManager em detail.js.
 *
 * Uso: incluir ANTES de detail.js no HTML.
 *   <script src="js/collections.js"></script>
 *   <script src="js/detail.js"></script>
 */

const CollectionsDB = (() => {
    /* ── Estado interno ─────────────────────────────────────────────── */
    let _data   = [];        // array carregado do JSON
    let _ready  = false;     // true após fetch bem-sucedido
    let _promise = null;     // promise do fetch (compartilhada entre chamadas)

    /* ── Caminho do JSON (ajuste se necessário) ─────────────────────── */
    const JSON_PATH = 'data/collections.json';

    /* ── Carregamento ────────────────────────────────────────────────── */
    function _load() {
        if (_promise) return _promise;

        _promise = fetch(JSON_PATH)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} ao carregar ${JSON_PATH}`);
                return r.json();
            })
            .then(json => {
                _data  = Array.isArray(json) ? json : [];
                _ready = true;
            })
            .catch(err => {
                console.warn('CollectionsDB: falha ao carregar JSON —', err.message);
                _data  = [];
                _ready = true; // marca ready mesmo em erro para não travar chamadas
            });

        return _promise;
    }

    /* ── API pública ─────────────────────────────────────────────────── */
    return {
        ready() {
            return _load();
        },

        find(query) {
            if (!query || !_ready) return null;
            const q = query.trim().toLowerCase();
            return _data.find(e => e.key.toLowerCase() === q) || null;
        },

        bySport(sport) {
            return _data.filter(e => e.sport === sport);
        },

        upsert(entry) {
            const idx = _data.findIndex(
                e => e.key.toLowerCase() === entry.key.toLowerCase()
            );
            if (idx >= 0) {
                _data[idx] = { ..._data[idx], ...entry };
            } else {
                _data.push(entry);
            }
        },

        /** Quantidade de entradas carregadas (útil para debug). */
        get size() { return _data.length; },
    };
})();