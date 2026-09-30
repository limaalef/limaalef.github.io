/* Service worker — cache do "shell" do Sports Archive.
   Estratégia:
   - Navegação (HTML): rede primeiro, cache como fallback offline.
   - CSS/JS/componentes/ícones do mesmo domínio: stale-while-revalidate.
   - Requisições de outros domínios (APIs, imagens externas, Google): nunca interceptadas.
   Incremente CACHE_VERSION ao publicar mudanças no shell. */
const CACHE_VERSION = 'sa-shell-v1';
const SHELL = [
  '/', '/index.html', '/collection.html', '/my-requests.html',
  '/css/theme.css', '/css/components.css',
  '/js/config.js', '/js/translation.js', '/js/utils.js',
  '/components/header.html', '/components/footer.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
