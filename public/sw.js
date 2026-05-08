// ============================================
// Pip-Boy Ultimate — Service Worker
// Caches app shell + map tiles for offline use
// ============================================

const APP_CACHE = 'pipboy-app-v2';
const TILE_CACHE = 'pipboy-tiles-v1';

// Tile URL patterns we cache
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'tile.opentopomap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
];

// Install — pre-cache critical app assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      // Pre-cache the shell — these are the minimum to show the app
      const basePath = self.registration.scope.replace(/\/$/, '');
      const urls = [
        basePath + '/',
        basePath + '/favicon.svg',
        basePath + '/logo.svg',
        basePath + '/icon-192.png',
        basePath + '/icon-512.png',
        basePath + '/manifest.json',
      ];
      return cache.addAll(urls).catch(() => {
        // If pre-cache fails (e.g. some files missing), continue anyway
      });
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => {
            // Keep current app and tile caches, delete old ones
            if (key === APP_CACHE || key === TILE_CACHE) return false;
            return key.startsWith('pipboy-');
          })
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — different strategies for different resources
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // Check if this is a tile request
  const isTile = TILE_HOSTS.some((host) => url.hostname === host);

  if (isTile) {
    event.respondWith(cacheFirst(event.request, TILE_CACHE));
    return;
  }

  // For same-origin requests (our app files)
  if (url.origin === self.location.origin) {
    // JS, CSS, fonts, images — cache-first (static assets with hashes in filenames)
    const isStaticAsset =
      url.pathname.includes('/_next/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.endsWith('.json');

    if (isStaticAsset) {
      event.respondWith(cacheFirst(event.request, APP_CACHE));
      return;
    }

    // HTML pages — network first, fallback to cache
    if (
      event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/')
    ) {
      event.respondWith(networkFirst(event.request, APP_CACHE));
      return;
    }
  }
});

// Cache-first: serve from cache, fetch and cache if miss
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (cacheName === TILE_CACHE) {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">' +
        '<rect width="256" height="256" fill="#0a0f0a"/>' +
        '<text x="128" y="128" text-anchor="middle" dy=".3em" fill="#005500" font-size="12" font-family="monospace">NO DATA</text>' +
        '</svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Network-first: try network, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      '<!DOCTYPE html><html><body style="background:#0a0f0a;color:#00ff00;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><h1>PIP-BOY 3000</h1><p>NO SIGNAL</p><p style="color:#008800">Check connection</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  if (type === 'DOWNLOAD_TILES') {
    downloadTiles(data);
  }

  if (type === 'GET_CACHE_SIZE') {
    getCacheSize().then((size) => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_SIZE', size });
        });
      });
    });
  }

  if (type === 'CLEAR_TILE_CACHE') {
    clearTileCache().then(() => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      });
    });
  }
});

// Pre-download tiles for a region
async function downloadTiles(data) {
  const { bounds, minZoom, maxZoom, tileUrl } = data;
  const totalTiles = countTiles(bounds, minZoom, maxZoom);
  let downloaded = 0;

  const clients = await self.clients.matchAll();

  for (let z = minZoom; z <= maxZoom; z++) {
    const tiles = getTileNumbers(bounds, z);
    for (const { x, y } of tiles) {
      try {
        const url = tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
        const response = await fetch(url);
        if (response.ok) {
          const cache = await caches.open(TILE_CACHE);
          const req = new Request(url);
          cache.put(req, response.clone());
          for (const sub of ['a', 'b', 'c']) {
            const subUrl = url.replace('tile.', `${sub}.`);
            await cache.put(new Request(subUrl), response.clone());
          }
        }
      } catch {
        // Skip failed tiles
      }

      downloaded++;
      if (downloaded % 5 === 0) {
        clients.forEach((c) => {
          c.postMessage({
            type: 'DOWNLOAD_PROGRESS',
            progress: Math.round((downloaded / totalTiles) * 100),
            downloaded,
            total: totalTiles,
          });
        });
      }
    }
  }

  clients.forEach((c) => {
    c.postMessage({ type: 'DOWNLOAD_COMPLETE', total: downloaded });
  });
}

// Calculate tile numbers for a bounding box at a given zoom level
function getTileNumbers(bounds, zoom) {
  const { north, south, east, west } = bounds;
  const tiles = [];

  const xMin = lngToTile(west, zoom);
  const xMax = lngToTile(east, zoom);
  const yMin = latToTile(north, zoom);
  const yMax = latToTile(south, zoom);

  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

// Count total tiles across zoom range
function countTiles(bounds, minZoom, maxZoom) {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    total += getTileNumbers(bounds, z).length;
  }
  return total;
}

// Convert longitude to tile X
function lngToTile(lng, zoom) {
  return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
}

// Convert latitude to tile Y
function latToTile(lat, zoom) {
  const n = Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
}

// Get cache size in MB
async function getCacheSize() {
  try {
    let totalSize = 0;
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      const cacheKeys = await cache.keys();
      for (const request of cacheKeys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    return (totalSize / (1024 * 1024)).toFixed(2);
  } catch {
    return '0';
  }
}

// Clear all cached tiles
async function clearTileCache() {
  await caches.delete(TILE_CACHE);
}
