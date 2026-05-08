// Pip-Boy Maps — Offline tile utilities

export interface TileBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TileCoords {
  x: number;
  y: number;
  z: number;
}

// Convert longitude to tile X number
export function lngToTile(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

// Convert latitude to tile Y number
export function latToTile(lat: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
}

// Get all tile numbers for a bounding box at a given zoom level
export function getTilesInBounds(bounds: TileBounds, zoom: number): TileCoords[] {
  const tiles: TileCoords[] = [];
  const xMin = lngToTile(bounds.west, zoom);
  const xMax = lngToTile(bounds.east, zoom);
  const yMin = latToTile(bounds.north, zoom);
  const yMax = latToTile(bounds.south, zoom);

  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

// Count total tiles across a zoom range
export function countTilesInRange(bounds: TileBounds, minZoom: number, maxZoom: number): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    total += getTilesInBounds(bounds, z).length;
  }
  return total;
}

// Estimate tile download size in MB (avg tile ~15KB)
export function estimateDownloadSize(tileCount: number): string {
  const bytes = tileCount * 15000; // ~15KB per tile average
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

// Register the service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (e) {
    console.warn('Service Worker registration failed:', e);
    return null;
  }
}

// Download tiles via service worker message
export function startTileDownload(
  bounds: TileBounds,
  minZoom: number,
  maxZoom: number,
  tileUrl: string,
  onProgress?: (progress: number, downloaded: number, total: number) => void,
  onComplete?: (total: number) => void
): { cancel: () => void } {
  let cancelled = false;

  const sw = navigator.serviceWorker?.controller;
  if (!sw) {
    // Fallback: download directly
    downloadTilesDirect(bounds, minZoom, maxZoom, tileUrl, onProgress, onComplete);
    return { cancel: () => { cancelled = true; } };
  }

  const handler = (event: MessageEvent) => {
    const msg = event.data;
    if (msg.type === 'DOWNLOAD_PROGRESS' && onProgress) {
      if (!cancelled) onProgress(msg.progress, msg.downloaded, msg.total);
    }
    if (msg.type === 'DOWNLOAD_COMPLETE' && onComplete) {
      onComplete(msg.total);
      navigator.serviceWorker?.removeEventListener('message', handler);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);

  sw.postMessage({
    type: 'DOWNLOAD_TILES',
    data: { bounds, minZoom, maxZoom, tileUrl },
  });

  return {
    cancel: () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener('message', handler);
    },
  };
}

// Get cached tile size from service worker
export async function getCacheSize(): Promise<string> {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return '0';

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'CACHE_SIZE') {
        resolve(event.data.size);
        navigator.serviceWorker?.removeEventListener('message', handler);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    sw.postMessage({ type: 'GET_CACHE_SIZE' });

    // Timeout fallback
    setTimeout(() => {
      resolve('?');
      navigator.serviceWorker?.removeEventListener('message', handler);
    }, 3000);
  });
}

// Clear cached tiles
export async function clearTileCache(): Promise<void> {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return;

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'CACHE_CLEARED') {
        resolve();
        navigator.serviceWorker?.removeEventListener('message', handler);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    sw.postMessage({ type: 'CLEAR_TILE_CACHE' });

    setTimeout(() => {
      resolve();
      navigator.serviceWorker?.removeEventListener('message', handler);
    }, 3000);
  });
}

// Direct tile download (fallback when no service worker)
async function downloadTilesDirect(
  bounds: TileBounds,
  minZoom: number,
  maxZoom: number,
  tileUrl: string,
  onProgress?: (progress: number, downloaded: number, total: number) => void,
  onComplete?: (total: number) => void
) {
  const total = countTilesInRange(bounds, minZoom, maxZoom);
  let downloaded = 0;

  for (let z = minZoom; z <= maxZoom; z++) {
    const tiles = getTilesInBounds(bounds, z);
    for (const tile of tiles) {
      try {
        const url = tileUrl
          .replace('{s}', 'abc'[Math.floor(Math.random() * 3)])
          .replace('{z}', String(tile.z))
          .replace('{x}', String(tile.x))
          .replace('{y}', String(tile.y));

        const response = await fetch(url);
        if (response.ok) {
          const cache = await caches.open('pipboy-tiles-v1');
          await cache.put(new Request(url), response);
        }
      } catch {
        // Skip failed tiles
      }

      downloaded++;
      if (onProgress && downloaded % 3 === 0) {
        onProgress(Math.round((downloaded / total) * 100), downloaded, total);
      }
    }
  }

  if (onComplete) onComplete(downloaded);
}
