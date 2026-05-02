// ============================================
// Pip-Boy Ultimate — Service Worker
// Caches map tiles for offline use
// ============================================

const CACHE_NAME = 'pipboy-tiles-v1';

// Tile URL patterns we cache
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'tile.opentopomap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
];

// Install — pre-cache critical assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('pipboy-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for tiles, network-first for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if this is a tile request
  const isTile = TILE_HOSTS.some((host) => url.hostname === host);

  if (isTile) {
    event.respondWith(cacheFirst(event.request));
  }
});

// Cache-first strategy: serve from cache, fallback to network
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline placeholder
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">' +
      '<rect width="256" height="256" fill="#0a0f0a"/>' +
      '<text x="128" y="128" text-anchor="middle" dy=".3em" fill="#005500" font-size="12" font-family="monospace">NO DATA</text>' +
      '</svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
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
  const { bounds, minZoom, maxZoom, tileUrl, onProgress } = data;

  const totalTiles = countTiles(bounds, minZoom, maxZoom);
  let downloaded = 0;

  const client = await self.clients.get(event.source?.id || '');
  if (!client) {
    // Try to notify all clients
    const clients = await self.clients.matchAll();
    const notifyClient = clients[0];
    if (!notifyClient) return;

    for (let z = minZoom; z <= maxZoom; z++) {
      const tiles = getTileNumbers(bounds, z);
      for (const { x, y } of tiles) {
        try {
          const url = tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
          const subUrl = url.replace('tile.', `abc[Math.floor(Math.random()*3)].`);

          const response = await fetch(subUrl);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            // Cache all subdomain variations
            for (const sub of ['a', 'b', 'c']) {
              const subUrl2 = url.replace('tile.', `${sub}.`);
              const req = new Request(subUrl2);
              cache.put(req, response.clone());
            }
            const req = new Request(url);
            cache.put(req, response.clone());
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
    return;
  }

  for (let z = minZoom; z <= maxZoom; z++) {
    const tiles = getTileNumbers(bounds, z);
    for (const { x, y } of tiles) {
      try {
        const url = tileUrl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

        const response = await fetch(url);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          const req = new Request(url);
          cache.put(req, response.clone());

          // Also cache subdomain variants
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
        client.postMessage({
          type: 'DOWNLOAD_PROGRESS',
          progress: Math.round((downloaded / totalTiles) * 100),
          downloaded,
          total: totalTiles,
        });
      }
    }
  }

  client.postMessage({ type: 'DOWNLOAD_COMPLETE', total: downloaded });
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
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    let totalSize = 0;

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }

    return (totalSize / (1024 * 1024)).toFixed(2);
  } catch {
    return '0';
  }
}

// Clear all cached tiles
async function clearTileCache() {
  await caches.delete(CACHE_NAME);
}
