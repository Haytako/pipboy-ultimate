'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { usePipStore } from '../lib/store';
import type { Marker, Route, MapSettings } from '../lib/store';

// ===== Public Props Interface =====

interface MapComponentProps {
  markers: Marker[];
  routes: Route[];
  onMarkerAdd?: (marker: Marker) => void;
  onRouteAdd?: (route: Route) => void;
  mapSettings: MapSettings;
  drawMode: 'none' | 'marker' | 'draw' | 'measure';
  measurePoints: [number, number][];
  onMeasurePointsChange?: (points: [number, number][]) => void;
  onMeasureDistance?: (distance: number) => void;
  onMarkerNameRequest?: (lat: number, lng: number) => void;
}

// ===== Tile Layer Config =====

const TILE_URLS: Record<string, string> = {
  streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
};

const TILE_ATTRIBUTION: Record<string, string> = {
  streets:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  topo: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
};

// ===== Dynamically loaded map (SSR disabled for Leaflet) =====

const MapInner = dynamic(
  async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L: any = (await import('leaflet') as any).default;
    const {
      MapContainer,
      TileLayer,
      Marker,
      Polyline,
      Popup,
      useMap,
      useMapEvents,
    } = await import('react-leaflet');

    // ─── Fix default Leaflet marker icons ───────────────────────
    // Prevents broken-image icons in webpack/Next.js bundlers
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    // ─── Custom Pip-Boy Icons (L.divIcon) ───────────────────────

    const greenIcon = L.divIcon({
      html: `<svg viewBox="0 0 24 36" width="24" height="36"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" fill="#00ff00" stroke="#008f00" stroke-width="1"/><circle cx="12" cy="11" r="3.5" fill="#0a0f0a"/></svg>`,
      className: 'pip-marker',
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -36],
    });

    const amberIcon = L.divIcon({
      html: `<svg viewBox="0 0 24 36" width="24" height="36"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 17c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" fill="#ffb000" stroke="#b07800" stroke-width="1"/><circle cx="12" cy="11" r="3.5" fill="#0a0f0a"/></svg>`,
      className: 'pip-marker-favorite',
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -36],
    });

    const drawPointIcon = L.divIcon({
      html: `<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="6" cy="6" r="5" fill="#00ff00" fill-opacity="0.5" stroke="#00ff00" stroke-width="1"/></svg>`,
      className: '',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    function createMeasurePointIcon(index: number) {
      return L.divIcon({
        html: `<div style="background:rgba(10,15,10,0.9);border:1px solid #ffb000;color:#ffb000;font-family:'Courier New',monospace;font-size:10px;padding:1px 3px;text-shadow:0 0 4px #ffb000;">${index + 1}</div>`,
        className: '',
        iconAnchor: [6, -8],
      });
    }

    function createDistanceLabelIcon(label: string) {
      return L.divIcon({
        html: `<div style="background:rgba(10,15,10,0.9);border:1px solid #ffb000;color:#ffb000;font-family:'Courier New',monospace;font-size:10px;padding:2px 4px;white-space:nowrap;text-shadow:0 0 4px #ffb000;">${label}</div>`,
        className: '',
        iconAnchor: [30, 8],
      });
    }

    // ─── Utility helpers ────────────────────────────────────────

    function calculateTotalDistance(points: [number, number][]): number {
      if (points.length < 2) return 0;
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        total += L.latLng(points[i - 1][0], points[i - 1][1]).distanceTo(
          L.latLng(points[i][0], points[i][1])
        );
      }
      return total;
    }

    function formatDistance(meters: number): string {
      if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
      }
      return `${Math.round(meters)} m`;
    }

    // ─── Map Click Handler ──────────────────────────────────────

    function MapClickHandler({
      drawMode,
      measurePoints,
      onMarkerNameRequest,
      onMeasurePointsChange,
      onMeasureDistance,
      drawingPoints,
      setDrawingPoints,
    }: {
      drawMode: MapComponentProps['drawMode'];
      measurePoints: [number, number][];
      onMarkerNameRequest?: (lat: number, lng: number) => void;
      onMeasurePointsChange?: (points: [number, number][]) => void;
      onMeasureDistance?: (distance: number) => void;
      drawingPoints: [number, number][];
      setDrawingPoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
    }) {
      useMapEvents({
        click(e: L.LeafletMouseEvent) {
          const { lat, lng } = e.latlng;

          if (drawMode === 'marker') {
            // Request marker naming via callback (no window.prompt)
            onMarkerNameRequest?.(lat, lng);
          } else if (drawMode === 'draw') {
            // Add point to current drawing
            setDrawingPoints((prev) => [...prev, [lat, lng]]);
          } else if (drawMode === 'measure') {
            // Add measurement point and report distance
            const newPoints: [number, number][] = [...measurePoints, [lat, lng]];
            onMeasurePointsChange?.(newPoints);
            const dist = calculateTotalDistance(newPoints);
            onMeasureDistance?.(dist);
          }
        },
      });
      return null;
    }

    // ─── Cursor Handler ─────────────────────────────────────────

    function MapCursorHandler({ drawMode }: { drawMode: string }) {
      const map = useMap();
      useEffect(() => {
        const container = map.getContainer();
        if (drawMode !== 'none') {
          container.style.cursor = 'crosshair';
        } else {
          container.style.cursor = '';
        }
        return () => {
          container.style.cursor = '';
        };
      }, [drawMode, map]);
      return null;
    }

    // ─── Map Ref Handler (programmatic access) ──────────────────

    function MapRefHandler({
      mapRef,
    }: {
      mapRef: React.MutableRefObject<L.Map | null>;
    }) {
      const map = useMap();
      useEffect(() => {
        mapRef.current = map;
        return () => {
          mapRef.current = null;
        };
      }, [map, mapRef]);
      return null;
    }

    // ─── Map Move/Zoom Tracker (saves position to store) ────────

    function MapMoveTracker({
      onMoveEnd,
    }: {
      onMoveEnd: (center: [number, number], zoom: number) => void;
    }) {
      const map = useMap();
      useEffect(() => {
        const handleMoveEnd = () => {
          const c = map.getCenter();
          const z = map.getZoom();
          onMoveEnd([c.lat, c.lng], z);
        };
        map.on('moveend', handleMoveEnd);
        map.on('zoomend', handleMoveEnd);
        return () => {
          map.off('moveend', handleMoveEnd);
          map.off('zoomend', handleMoveEnd);
        };
      }, [map, onMoveEnd]);
      return null;
    }

    // ─── City Search Result Type ────────────────────────────────

    interface SearchResult {
      lat: number;
      lng: number;
      display_name: string;
    }

    // ─── Pip-Boy Styled Marker Popup ────────────────────────────

    function MarkerPopup({
      marker,
      onDelete,
      onToggleFavorite,
      onRename,
    }: {
      marker: Marker;
      onDelete: () => void;
      onToggleFavorite: () => void;
      onRename: (newTitle: string) => void;
    }) {
      const favColor = '#ffb000';
      const greenColor = '#00ff00';
      const dimGreen = '#008800';
      const darkGreen = '#005500';
      const redColor = '#ff2020';

      const btnBase: React.CSSProperties = {
        fontFamily: "'Courier New', monospace",
        fontSize: '10px',
        padding: '3px 8px',
        cursor: 'pointer',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        lineHeight: '1',
      };

      return (
        <Popup>
          <div style={{ minWidth: 170 }}>
            {/* Title */}
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                color: marker.favorite ? favColor : greenColor,
                fontSize: '13px',
                fontWeight: 'bold',
                marginBottom: '4px',
                textShadow: `0 0 4px ${marker.favorite ? favColor : greenColor}`,
              }}
            >
              {marker.title || 'UNTITLED'}
            </div>

            {/* Description */}
            {marker.description && (
              <div
                style={{
                  fontFamily: "'Courier New', monospace",
                  color: dimGreen,
                  fontSize: '11px',
                  marginBottom: '6px',
                  lineHeight: '1.4',
                }}
              >
                {marker.description}
              </div>
            )}

            {/* Category */}
            {marker.category && marker.category !== 'general' && (
              <div
                style={{
                  fontFamily: "'Courier New', monospace",
                  color: darkGreen,
                  fontSize: '10px',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                [{marker.category}]
              </div>
            )}

            {/* Coordinates */}
            <div
              style={{
                fontFamily: "'Courier New', monospace",
                color: darkGreen,
                fontSize: '10px',
                marginBottom: '8px',
              }}
            >
              [{marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}]
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const newName = window.prompt('Rename marker:', marker.title);
                  if (newName !== null && newName.trim()) onRename(newName.trim());
                }}
                style={{
                  ...btnBase,
                  background: 'rgba(0,255,0,0.05)',
                  border: `1px solid #00aa00`,
                  color: greenColor,
                }}
              >
                {'\u270E'} EDIT
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleFavorite();
                }}
                style={{
                  ...btnBase,
                  background: marker.favorite
                    ? 'rgba(255,176,0,0.15)'
                    : 'rgba(0,255,0,0.05)',
                  border: `1px solid ${marker.favorite ? favColor : '#00aa00'}`,
                  color: marker.favorite ? favColor : greenColor,
                }}
              >
                {marker.favorite ? '\u2605 FAV' : '\u2606 FAV'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete();
                }}
                style={{
                  ...btnBase,
                  background: 'rgba(255,32,32,0.1)',
                  border: `1px solid ${redColor}`,
                  color: redColor,
                }}
              >
                {'\u2715'} DEL
              </button>
            </div>
          </div>
        </Popup>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    //  MAIN MAP CONTENT COMPONENT
    // ═══════════════════════════════════════════════════════════════

    function MapContent(props: MapComponentProps) {
      const {
        markers,
        routes,
        onMarkerAdd,
        onRouteAdd,
        mapSettings,
        drawMode,
        measurePoints,
        onMeasurePointsChange,
        onMeasureDistance,
        onMarkerNameRequest: externalNameRequest,
      } = props;

      // Expose map instance for programmatic access
      const mapRef = useRef<L.Map | null>(null);

      // Marker naming dialog state
      const [namingMarker, setNamingMarker] = useState<{ lat: number; lng: number } | null>(null);
      const [markerName, setMarkerName] = useState('');

      // Ref for auto-focusing the naming input
      const namingInputRef = useRef<HTMLInputElement>(null);

      // Drawing state (accumulated points in draw mode)
      const [drawingPoints, setDrawingPoints] = useState<[number, number][]>(
        []
      );

      // Track previous draw mode to detect mode transitions
      const prevDrawModeRef = useRef<string>(drawMode);

      // Store actions for marker operations
      const deleteMarker = usePipStore((s) => s.deleteMarker);
      const toggleFavorite = usePipStore((s) => s.toggleFavorite);
      const updateMarker = usePipStore((s) => s.updateMarker);
      const updateMapSettings = usePipStore((s) => s.updateMapSettings);
      const flyToTarget = usePipStore((s) => s.flyToTarget);
      const clearFlyTo = usePipStore((s) => s.clearFlyTo);

      // ── City search state ──────────────────────────────────────
      const [searchQuery, setSearchQuery] = useState('');
      const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
      const [isSearching, setIsSearching] = useState(false);
      const [showResults, setShowResults] = useState(false);
      const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      // ── Perform city search via Photon API ─────────────────────
      const performSearch = useCallback(async (query: string) => {
        const q = (query || '').trim();
        if (!q) {
          setSearchResults([]);
          setShowResults(false);
          setIsSearching(false);
          return;
        }
        setIsSearching(true);
        setShowResults(true);
        try {
          const res = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`
          );
          const text = await res.text();
          let data: any = null;
          try { data = JSON.parse(text); } catch { data = null; }
          const results: SearchResult[] = (data?.features || [])
            .filter((f: any) => f?.geometry?.coordinates?.[1] != null && f?.geometry?.coordinates?.[0] != null)
            .map((f: any) => {
              const props = f.properties || {};
              const name = props.name || '';
              const city = props.city || props.town || props.village || '';
              const country = props.country || '';
              const parts = [name, city, country].filter(Boolean);
              return {
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0],
                display_name: parts.join(', ') || 'Unknown',
              };
            });
          setSearchResults(results);
        } catch (e) {
          console.error('Search failed:', e);
          setSearchResults([]);
        }
        setIsSearching(false);
      }, []);

      // ── Debounced search input handler ─────────────────────────
      const handleSearchInput = useCallback((value: string) => {
        setSearchQuery(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
          performSearch(value);
        }, 400);
      }, [performSearch]);

      // ── Fly to search result ───────────────────────────────────
      const handleSelectResult = useCallback((result: SearchResult) => {
        if (mapRef.current) {
          mapRef.current.flyTo([result.lat, result.lng], 15, { duration: 1.2 });
        }
        setSearchQuery(result.display_name);
        setShowResults(false);
        setSearchResults([]);
      }, []);

      // ── Save map position on move/zoom (debounced) ──────────────
      const savePositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const handleMapMoveEnd = useCallback((center: [number, number], zoom: number) => {
        if (savePositionTimerRef.current) clearTimeout(savePositionTimerRef.current);
        savePositionTimerRef.current = setTimeout(() => {
          updateMapSettings({ center, zoom });
        }, 500);
      }, [updateMapSettings]);

      // ── React to flyToTarget from store (e.g. marker click in side panel) ──
      useEffect(() => {
        if (!flyToTarget) return;
        const t = setTimeout(() => {
          if (mapRef.current) {
            const zoom = flyToTarget.zoom ?? Math.max(mapRef.current.getZoom(), 14);
            mapRef.current.flyTo([flyToTarget.lat, flyToTarget.lng], zoom, {
              duration: 1.2,
            });
          }
          clearFlyTo();
        }, 50);
        return () => clearTimeout(t);
      }, [flyToTarget, clearFlyTo]);

      // ── Auto-focus naming input when dialog opens ──────────────
      useEffect(() => {
        if (namingMarker !== null && namingInputRef.current) {
          // Small delay to ensure the input is mounted and visible
          const timer = setTimeout(() => {
            namingInputRef.current?.focus();
          }, 50);
          return () => clearTimeout(timer);
        }
      }, [namingMarker]);

      // ── Handle Escape key to cancel naming dialog ──────────────
      useEffect(() => {
        if (namingMarker === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            setNamingMarker(null);
            setMarkerName('');
          }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, [namingMarker]);

      // ── Internal marker name request handler ───────────────────
      const handleMarkerNameRequest = useCallback(
        (lat: number, lng: number) => {
          setNamingMarker({ lat, lng });
          setMarkerName('');
          // Notify parent if callback provided
          externalNameRequest?.(lat, lng);
        },
        [externalNameRequest]
      );

      // ── Confirm marker creation from naming dialog ─────────────
      const handleNamingOk = useCallback(() => {
        if (!namingMarker) return;
        const newMarker: Marker = {
          id: crypto.randomUUID(),
          lat: namingMarker.lat,
          lng: namingMarker.lng,
          title: markerName.trim() || 'NEW LOCATION',
          description: '',
          category: 'general',
          favorite: false,
        };
        onMarkerAdd?.(newMarker);
        setNamingMarker(null);
        setMarkerName('');
      }, [namingMarker, markerName, onMarkerAdd]);

      // ── Cancel marker naming dialog ────────────────────────────
      const handleNamingCancel = useCallback(() => {
        setNamingMarker(null);
        setMarkerName('');
      }, []);

      // ── Handle Enter key in naming input ───────────────────────
      const handleNamingKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            handleNamingOk();
          } else if (e.key === 'Escape') {
            handleNamingCancel();
          }
        },
        [handleNamingOk, handleNamingCancel]
      );

      // ── Finalize route when leaving draw mode ──────────────────
      useEffect(() => {
        if (prevDrawModeRef.current === 'draw' && drawMode !== 'draw') {
          if (drawingPoints.length >= 2 && onRouteAdd) {
            const route: Route = {
              id: crypto.randomUUID(),
              name: `ROUTE-${new Date().toLocaleTimeString()}`,
              points: drawingPoints.map(([lat, lng]) => ({ lat, lng })),
              color: '#00ff00',
            };
            onRouteAdd(route);
          }
          // Reset drawing points via callback pattern (no direct setState in effect)
          return () => { setDrawingPoints([]); };
        }
        prevDrawModeRef.current = drawMode;
      }, [drawMode, drawingPoints, onRouteAdd]);

      // ── Calculate and report measure distance ──────────────────
      const measureDistance = useMemo(
        () => calculateTotalDistance(measurePoints),
        [measurePoints]
      );

      useEffect(() => {
        onMeasureDistance?.(measureDistance);
      }, [measureDistance, onMeasureDistance]);

      // ── Tile layer selection ───────────────────────────────────
      const tileUrl =
        TILE_URLS[mapSettings.layer] || TILE_URLS.streets;
      const tileAttr =
        TILE_ATTRIBUTION[mapSettings.layer] || TILE_ATTRIBUTION.streets;

      // ── Drawing polyline key (forces re-render on point change) ─
      const drawPolylineKey = drawingPoints.length;

      // ── Zoom button handlers ───────────────────────────────────
      const handleZoomIn = useCallback(() => {
        if (mapRef.current) {
          mapRef.current.zoomIn();
        }
      }, []);

      const handleZoomOut = useCallback(() => {
        if (mapRef.current) {
          mapRef.current.zoomOut();
        }
      }, []);

      // Pip-Boy styled zoom button
      const zoomBtnStyle: React.CSSProperties = {
        width: '32px',
        height: '32px',
        background: 'rgba(10,15,10,0.9)',
        border: '1px solid #00aa00',
        color: '#00ff00',
        fontFamily: "'Courier New', monospace",
        fontSize: '16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textShadow: '0 0 4px #00ff00',
      };

      // Pip-Boy styled naming button
      const namingBtnStyle: React.CSSProperties = {
        fontFamily: "'Courier New', monospace",
        fontSize: '12px',
        padding: '6px 16px',
        cursor: 'pointer',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        lineHeight: '1',
      };

      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* React-Leaflet Map Container */}
          <MapContainer
            center={mapSettings.center}
            zoom={mapSettings.zoom}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
            attributionControl={true}
          >
            {/* Tile layer — streets or topo */}
            <TileLayer url={tileUrl} attribution={tileAttr} maxZoom={19} />

            {/* Map infrastructure hooks */}
            <MapRefHandler mapRef={mapRef} />
            <MapMoveTracker onMoveEnd={handleMapMoveEnd} />
            <MapCursorHandler drawMode={drawMode} />
            <MapClickHandler
              drawMode={drawMode}
              measurePoints={measurePoints}
              onMarkerNameRequest={handleMarkerNameRequest}
              onMeasurePointsChange={onMeasurePointsChange}
              onMeasureDistance={onMeasureDistance}
              drawingPoints={drawingPoints}
              setDrawingPoints={setDrawingPoints}
            />

            {/* ── Existing markers ──────────────────────────────── */}
            {markers.map((m) => (
              <Marker
                key={m.id}
                position={[m.lat, m.lng]}
                icon={m.favorite ? amberIcon : greenIcon}
              >
                <MarkerPopup
                  marker={m}
                  onDelete={() => deleteMarker(m.id)}
                  onToggleFavorite={() => toggleFavorite(m.id)}
                  onRename={(newTitle) => updateMarker(m.id, { title: newTitle })}
                />
              </Marker>
            ))}

            {/* ── Existing routes ───────────────────────────────── */}
            {routes.map((route) => {
              if (route.points.length < 2) return null;
              const latlngs: [number, number][] = route.points.map(
                (p) => [p.lat, p.lng]
              );
              return (
                <Polyline
                  key={route.id}
                  positions={latlngs}
                  pathOptions={{
                    color: route.color || '#00ff00',
                    weight: 2,
                    dashArray: '8, 4',
                    opacity: 0.8,
                  }}
                />
              );
            })}

            {/* ── Active drawing: polyline ──────────────────────── */}
            {drawingPoints.length >= 2 && (
              <Polyline
                key={`draw-line-${drawPolylineKey}`}
                positions={drawingPoints}
                pathOptions={{
                  color: '#00ff00',
                  weight: 2,
                  dashArray: '8, 4',
                  opacity: 0.6,
                }}
              />
            )}

            {/* ── Active drawing: point markers ─────────────────── */}
            {drawingPoints.map((pos, i) => (
              <Marker key={`draw-pt-${i}`} position={pos} icon={drawPointIcon} />
            ))}

            {/* ── Measurement: polyline ─────────────────────────── */}
            {measurePoints.length >= 2 && (
              <Polyline
                positions={measurePoints}
                pathOptions={{
                  color: '#ffb000',
                  weight: 2,
                  dashArray: '4, 4',
                  opacity: 0.7,
                  className: 'measure-path',
                }}
              />
            )}

            {/* ── Measurement: segment distance labels ──────────── */}
            {measurePoints.length >= 2 &&
              Array.from({ length: measurePoints.length - 1 }, (_, i) => {
                const p1 = measurePoints[i];
                const p2 = measurePoints[i + 1];
                const segDist = L.latLng(p1[0], p1[1]).distanceTo(
                  L.latLng(p2[0], p2[1])
                );
                const midLat = (p1[0] + p2[0]) / 2;
                const midLng = (p1[1] + p2[1]) / 2;
                return (
                  <Marker
                    key={`seg-dist-${i}`}
                    position={[midLat, midLng]}
                    icon={createDistanceLabelIcon(formatDistance(segDist))}
                    interactive={false}
                  />
                );
              })}

            {/* ── Measurement: numbered point markers ───────────── */}
            {measurePoints.map((pos, i) => (
              <Marker
                key={`measure-pt-${i}`}
                position={pos}
                icon={createMeasurePointIcon(i)}
                interactive={false}
              />
            ))}
          </MapContainer>

          {/* ── HUD Overlays (outside leaflet, pip-boy styled) ── */}

          {/* Measure distance display */}
          {drawMode === 'measure' && measurePoints.length >= 2 && (
            <div
              className="pip-panel pip-glow"
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                padding: '6px 16px',
                fontFamily: "'Courier New', monospace",
                fontSize: '12px',
                color: '#ffb000',
                textShadow: '0 0 4px #ffb000',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              DIST: {formatDistance(measureDistance)}
            </div>
          )}

          {/* Draw mode hint */}
          {drawMode === 'draw' && (
            <div
              className="pip-panel"
              style={{
                position: 'absolute',
                bottom: 56,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                padding: '6px 16px',
                fontFamily: "'Courier New', monospace",
                fontSize: '11px',
                color: '#008800',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {drawingPoints.length > 0
                ? `DRAWING... (${drawingPoints.length} PTS)`
                : '// CLICK TO PLACE POINTS'}
            </div>
          )}

          {/* Marker mode hint */}
          {drawMode === 'marker' && namingMarker === null && (
            <div
              className="pip-panel"
              style={{
                position: 'absolute',
                bottom: 56,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                padding: '6px 16px',
                fontFamily: "'Courier New', monospace",
                fontSize: '11px',
                color: '#008800',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {'// CLICK TO PLACE MARKER'}
            </div>
          )}

          {/* Measure mode hint (no points yet) */}
          {drawMode === 'measure' && measurePoints.length === 0 && (
            <div
              className="pip-panel"
              style={{
                position: 'absolute',
                bottom: 56,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                padding: '6px 16px',
                fontFamily: "'Courier New', monospace",
                fontSize: '11px',
                color: '#ffb000',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {'// CLICK TO MEASURE DISTANCE'}
            </div>
          )}

          {/* ── Custom Pip-Boy Zoom Buttons ─────────────────────── */}
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <button onClick={handleZoomIn} style={zoomBtnStyle} title="Zoom in">
              +
            </button>
            <button onClick={handleZoomOut} style={zoomBtnStyle} title="Zoom out">
              −
            </button>
          </div>

          {/* ── City Search Box (top-left) ─────────────────────── */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 1000,
              width: '220px',
              maxWidth: 'calc(100vw - 20px)',
            }}
          >
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                onBlur={() => { setTimeout(() => setShowResults(false), 200); }}
                placeholder="// SEARCH CITY..."
                autoComplete="off"
                style={{
                  width: '100%',
                  background: 'rgba(10,15,10,0.92)',
                  border: '1px solid #00aa00',
                  color: '#00ff00',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '11px',
                  padding: '6px 10px 6px 26px',
                  outline: 'none',
                  textShadow: '0 0 4px #00ff00',
                  letterSpacing: '1px',
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#00ff00',
                  fontSize: '11px',
                  pointerEvents: 'none',
                  textShadow: '0 0 4px #00ff00',
                }}
              >
                ⌕
              </div>
              {isSearching && (
                <div
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#ffb000',
                    fontSize: '10px',
                    pointerEvents: 'none',
                  }}
                >
                  ...
                </div>
              )}
            </div>

            {showResults && searchResults.length > 0 && (
              <div
                style={{
                  marginTop: '2px',
                  background: 'rgba(10,15,10,0.95)',
                  border: '1px solid #00aa00',
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectResult(r); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '5px 10px',
                      fontSize: '10px',
                      color: '#00ff00',
                      background: 'none',
                      border: 'none',
                      borderBottom: i < searchResults.length - 1 ? '1px solid rgba(0,170,0,0.2)' : 'none',
                      cursor: 'pointer',
                      fontFamily: "'Courier New', monospace",
                      lineHeight: '1.3',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'none';
                    }}
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}

            {showResults && !isSearching && searchResults.length === 0 && searchQuery.trim() && (
              <div
                style={{
                  marginTop: '2px',
                  background: 'rgba(10,15,10,0.95)',
                  border: '1px solid #660000',
                  padding: '6px 10px',
                  fontSize: '10px',
                  color: '#ff6666',
                  fontFamily: "'Courier New', monospace",
                }}
              >
                // NO RESULTS
              </div>
            )}
          </div>

          {/* ── Marker Naming Dialog ────────────────────────────── */}
          {namingMarker !== null && (
            <div className="pip-marker-naming-overlay">
              <div className="pip-marker-naming-panel">
                <div
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: '11px',
                    color: '#00aa00',
                    marginBottom: '10px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase' as const,
                    textShadow: '0 0 4px rgba(0, 170, 0, 0.3)',
                  }}
                >
                  ENTER MARKER NAME:
                </div>
                <input
                  ref={namingInputRef}
                  type="text"
                  className="pip-marker-naming-input"
                  value={markerName}
                  onChange={(e) => setMarkerName(e.target.value)}
                  onKeyDown={handleNamingKeyDown}
                  placeholder="NEW LOCATION"
                  autoComplete="off"
                  autoFocus
                />
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '14px',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    onClick={handleNamingCancel}
                    style={{
                      ...namingBtnStyle,
                      background: 'rgba(10,15,10,0.9)',
                      border: '1px solid #006600',
                      color: '#008800',
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleNamingOk}
                    style={{
                      ...namingBtnStyle,
                      background: 'rgba(0,255,0,0.1)',
                      border: '1px solid #00aa00',
                      color: '#00ff00',
                      textShadow: '0 0 4px #00ff00',
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return { default: MapContent };
  },
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#0a0f0a',
          color: '#00ff00',
          fontFamily: "'Courier New', monospace",
          fontSize: '13px',
          letterSpacing: '2px',
          textShadow: '0 0 4px #00ff00',
        }}
      >
        {'// LOADING MAP DATA...'}
      </div>
    ),
  }
);

// ===== Exported Component =====

export default function MapComponent(props: MapComponentProps) {
  return <MapInner {...props} />;
}
