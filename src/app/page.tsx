'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePipStore } from '../lib/store';
import { t } from '../lib/translations';
import { cityTransports, getTransportTypeLabel, getTransportIcon } from '../lib/transportData';
import type {
  Language,
  MapLayer,
  SpecialStat,
  HabitFrequency,
  NoteCategory,
  Habit,
  Note,
  Marker,
  Route,
} from '../lib/store';

// ===== Dynamic Map Import (SSR disabled for Leaflet) =====

const GalagaGame = dynamic(() => import('../components/GalagaGame'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: 'var(--pip-bg)',
      color: 'var(--pip-text)',
      fontFamily: "'Courier New', monospace",
      fontSize: '13px',
      letterSpacing: '2px',
    }}>
      {'// LOADING GALAGA...'}
    </div>
  ),
});

const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: 'var(--pip-bg)',
      color: 'var(--pip-text)',
      fontFamily: "'Courier New', monospace",
      fontSize: '13px',
      letterSpacing: '2px',
    }}>
      {'// LOADING MAP DATA...'}
    </div>
  ),
});

// ===== Helper Functions =====

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function formatDate(ts: number, lang: Language): string {
  return new Date(ts).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US');
}

function getWeekDays(lang: Language): string[] {
  return lang === 'ru'
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

function calcStreak(habit: Habit): number {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().split('T')[0];
    const entry = habit.log.find((e) => e.date === dateStr);
    if (entry && entry.completed) {
      streak++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcBestStreak(habit: Habit): number {
  if (habit.log.length === 0) return 0;
  const sortedDates = habit.log
    .filter((e) => e.completed)
    .map((e) => e.date)
    .sort();
  if (sortedDates.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

const SPECIAL_KEYS: SpecialStat[] = [
  'strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck',
];

// ═══════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PipBoyPage() {
  // ── Store State ──────────────────────────────────────────────
  const language = usePipStore((s) => s.language);
  const activeModule = usePipStore((s) => s.activeModule);
  const setActiveModule = usePipStore((s) => s.setActiveModule);
  const setLanguage = usePipStore((s) => s.setLanguage);
  const markers = usePipStore((s) => s.markers);
  const routes = usePipStore((s) => s.routes);
  const notes = usePipStore((s) => s.notes);
  const habits = usePipStore((s) => s.habits);
  const mapSettings = usePipStore((s) => s.mapSettings);
  const updateMapSettings = usePipStore((s) => s.updateMapSettings);
  const addMarker = usePipStore((s) => s.addMarker);
  const addRoute = usePipStore((s) => s.addRoute);
  const toggleHabitDay = usePipStore((s) => s.toggleHabitDay);
  const addHabit = usePipStore((s) => s.addHabit);
  const updateHabit = usePipStore((s) => s.updateHabit);
  const deleteHabit = usePipStore((s) => s.deleteHabit);
  const addNote = usePipStore((s) => s.addNote);
  const updateNote = usePipStore((s) => s.updateNote);
  const deleteNote = usePipStore((s) => s.deleteNote);
  const togglePinNote = usePipStore((s) => s.togglePinNote);
  const exportData = usePipStore((s) => s.exportData);
  const importData = usePipStore((s) => s.importData);
  const clearAllData = usePipStore((s) => s.clearAllData);
  const getSpecialStats = usePipStore((s) => s.getSpecialStats);
  const selectedTransportCity = usePipStore((s) => s.selectedTransportCity);
  const setSelectedTransportCity = usePipStore((s) => s.setSelectedTransportCity);
  const deleteMarker = usePipStore((s) => s.deleteMarker);
  const deleteRoute = usePipStore((s) => s.deleteRoute);

  // ── Local State ──────────────────────────────────────────────
  const [booting, setBooting] = useState(true);
  const [bootPhase, setBootPhase] = useState(0);

  // Map
  const [drawMode, setDrawMode] = useState<'none' | 'marker' | 'draw' | 'measure'>('none');
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [measureDistance, setMeasureDistance] = useState(0);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showTransport, setShowTransport] = useState(false);

  // Habits
  const [habitFilter, setHabitFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [habitForm, setHabitForm] = useState({
    title: '',
    description: '',
    frequency: 'daily' as HabitFrequency,
    stat: 'strength' as SpecialStat,
    xpReward: 10,
  });

  // Notes
  const [noteCategory, setNoteCategory] = useState<NoteCategory | 'all' | 'pinned'>('all');
  const [noteSearch, setNoteSearch] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    category: 'general' as NoteCategory,
  });

  // Settings
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  // ── Boot Sequence ────────────────────────────────────────────
  useEffect(() => {
    const phases = [
      'INITIALIZING PIP-BOY 3000...',
      'LOADING MAP MODULES..',
      'CALIBRATING POSITION...',
      'SCANNING SURROUNDINGS....',
      'SYSTEM READY.',
    ];
    let phaseIdx = 0;
    const phaseTimer = setInterval(() => {
      phaseIdx++;
      if (phaseIdx < phases.length) {
        setBootPhase(phaseIdx);
      }
    }, 400);

    const bootTimer = setTimeout(() => {
      setBooting(false);
      clearInterval(phaseTimer);
    }, 2000);

    return () => {
      clearTimeout(bootTimer);
      clearInterval(phaseTimer);
    };
  }, []);

  // ── Status Message Timer ─────────────────────────────────────
  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  // ── Computed Values ──────────────────────────────────────────
  const todayStr = getTodayStr();
  const specialStats = useMemo(() => getSpecialStats(), [habits, getSpecialStats]);
  const overallLevel = useMemo(
    () => Math.round(specialStats.reduce((sum, s) => sum + s.value, 0) / specialStats.length),
    [specialStats]
  );

  const totalCompletions30 = useMemo(() => {
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    let count = 0;
    habits.forEach((h) => {
      h.log.forEach((e) => {
        if (e.completed && e.date >= thirtyAgo && e.date <= todayStr) count++;
      });
    });
    return count;
  }, [habits, todayStr]);

  const activeHabits = useMemo(() => habits.filter((h) => h.active), [habits]);
  const bestStreak = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map(calcStreak));
  }, [habits]);

  const todayCompletedHabits = useMemo(
    () => habits.filter((h) => {
      const entry = h.log.find((e) => e.date === todayStr);
      return entry && entry.completed;
    }),
    [habits, todayStr]
  );

  const filteredHabits = useMemo(() => {
    switch (habitFilter) {
      case 'active':
        return habits.filter((h) => h.active && !h.log.find((e) => e.date === todayStr && e.completed));
      case 'completed':
        return todayCompletedHabits;
      default:
        return habits;
    }
  }, [habits, habitFilter, todayStr, todayCompletedHabits]);

  const filteredNotes = useMemo(() => {
    let result = [...notes];
    if (noteCategory === 'pinned') {
      result = result.filter((n) => n.pinned);
    } else if (noteCategory !== 'all') {
      result = result.filter((n) => n.category === noteCategory);
    }
    if (noteSearch.trim()) {
      const q = noteSearch.toLowerCase();
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }
    // Pinned first, then by updatedAt
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    return result;
  }, [notes, noteCategory, noteSearch]);

  const currentCity = useMemo(
    () => cityTransports.find((c) => c.id === selectedTransportCity),
    [selectedTransportCity]
  );

  const currentDateStr = useMemo(
    () => new Date().toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US'),
    [language]
  );

  // ── Handlers ─────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipboy-ultimate-${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMsg(t('settings.exported', language));
  }, [exportData, todayStr, language]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const ok = importData(text);
        setStatusMsg(ok ? t('settings.imported', language) : 'IMPORT ERROR');
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importData, language]
  );

  const handleClear = useCallback(() => {
    clearAllData();
    setShowClearConfirm(false);
    setStatusMsg(t('settings.cleared', language));
  }, [clearAllData, language]);

  const handleSaveHabit = useCallback(() => {
    if (!habitForm.title.trim()) return;
    if (editingHabitId) {
      updateHabit(editingHabitId, {
        title: habitForm.title,
        description: habitForm.description,
        frequency: habitForm.frequency,
        stat: habitForm.stat,
        xpReward: habitForm.xpReward,
      });
    } else {
      const newHabit: Habit = {
        id: crypto.randomUUID(),
        title: habitForm.title,
        description: habitForm.description,
        frequency: habitForm.frequency,
        stat: habitForm.stat,
        xpReward: habitForm.xpReward,
        level: 1,
        log: [],
        createdAt: Date.now(),
        active: true,
      };
      addHabit(newHabit);
    }
    setShowHabitForm(false);
    setEditingHabitId(null);
    setHabitForm({ title: '', description: '', frequency: 'daily', stat: 'strength', xpReward: 10 });
  }, [habitForm, editingHabitId, updateHabit, addHabit]);

  const handleOpenEditHabit = useCallback(
    (habit: Habit) => {
      setEditingHabitId(habit.id);
      setHabitForm({
        title: habit.title,
        description: habit.description || '',
        frequency: habit.frequency,
        stat: habit.stat,
        xpReward: habit.xpReward,
      });
      setShowHabitForm(true);
    },
    []
  );

  const handleSaveNote = useCallback(() => {
    if (!noteForm.title.trim()) return;
    if (editingNoteId) {
      updateNote(editingNoteId, {
        title: noteForm.title,
        content: noteForm.content,
        category: noteForm.category,
      });
    } else {
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: noteForm.title,
        content: noteForm.content,
        category: noteForm.category,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
      };
      addNote(newNote);
    }
    setShowNoteForm(false);
    setEditingNoteId(null);
    setNoteForm({ title: '', content: '', category: 'general' });
  }, [noteForm, editingNoteId, updateNote, addNote]);

  const handleOpenEditNote = useCallback((note: Note) => {
    setEditingNoteId(note.id);
    setNoteForm({ title: note.title, content: note.content, category: note.category });
    setShowNoteForm(true);
  }, []);

  const handleDeleteNote = useCallback(
    (id: string) => {
      deleteNote(id);
      setExpandedNoteId(null);
    },
    [deleteNote]
  );

  // ═══════════════════════════════════════════════════════════════
  //  BOOT SCREEN
  // ═══════════════════════════════════════════════════════════════

  if (booting) {
    const bootMessages = [
      'INITIALIZING PIP-BOY 3000...',
      'LOADING MAP MODULES..',
      'CALIBRATING POSITION...',
      'SCANNING SURROUNDINGS....',
      'SYSTEM READY.',
    ];
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--pip-bg)',
        fontFamily: "'Courier New', monospace",
      }}>
        <div className="pip-glow-strong" style={{
          fontSize: '18px',
          color: 'var(--pip-green)',
          letterSpacing: '3px',
          marginBottom: '24px',
          textAlign: 'center',
        }}>
          ◧ PIP-BOY 3000
        </div>
        <div className="pip-boot-text" style={{
          fontSize: '14px',
          color: 'var(--pip-text-dim)',
          letterSpacing: '2px',
          marginBottom: '32px',
        }}>
          {bootMessages[bootPhase]}
        </div>
        <div style={{ width: '300px', height: '2px', border: '1px solid var(--pip-border-dim)' }}>
          <div className="pip-loading-bar" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  MAIN LAYOUT
  // ═══════════════════════════════════════════════════════════════

  const modules: { key: typeof activeModule; label: string }[] = [
    { key: 'map', label: t('mod.map', language) },
    { key: 'stats', label: t('mod.stats', language) },
    { key: 'habits', label: t('mod.habits', language) },
    { key: 'notes', label: t('mod.notes', language) },
    { key: 'games', label: t('mod.games', language) },
    { key: 'settings', label: t('mod.settings', language) },
  ];

  return (
    <div className="crt-screen" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--pip-bg)' }}>
      <div className="crt-overlay" />

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="pip-header" style={{ padding: '10px 16px', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="pip-glow-strong" style={{ fontSize: '20px', letterSpacing: '3px', lineHeight: '1.2' }}>
              ◧ PIP-BOY 3000
            </div>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--pip-text-dim)' }}>
              ULTIMATE // {t('app.studio', language)}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--pip-text-dim)' }}>
            <div>{currentDateStr}</div>
            {statusMsg && (
              <div style={{ color: 'var(--pip-amber)', fontSize: '11px', marginTop: '2px' }}>{statusMsg}</div>
            )}
          </div>
        </div>
      </header>

      {/* ── MODULE NAVIGATION ───────────────────────────────── */}
      <nav style={{
        display: 'flex',
        gap: '0',
        borderBottom: '2px solid var(--pip-border)',
        flexShrink: 0,
        zIndex: 10,
        background: 'var(--pip-bg)',
      }}>
        {modules.map((mod) => (
          <button
            key={mod.key}
            onClick={() => setActiveModule(mod.key)}
            className={`pip-tab ${activeModule === mod.key ? 'pip-tab-active' : ''}`}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '10px 8px',
              fontSize: '12px',
              letterSpacing: '2px',
              borderTop: activeModule === mod.key ? '2px solid var(--pip-green)' : '2px solid transparent',
            }}
          >
            {mod.label}
          </button>
        ))}
      </nav>

      {/* ── CONTENT AREA ────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="pip-fadein" key={activeModule} style={{ height: '100%', display: 'flex' }}>
          {activeModule === 'map' && (
            <MapPanel
              language={language}
              markers={markers}
              routes={routes}
              notes={notes}
              mapSettings={mapSettings}
              updateMapSettings={updateMapSettings}
              addMarker={addMarker}
              addRoute={addRoute}
              deleteMarker={deleteMarker}
              deleteRoute={deleteRoute}
              drawMode={drawMode}
              setDrawMode={setDrawMode}
              measurePoints={measurePoints}
              setMeasurePoints={setMeasurePoints}
              setMeasureDistance={setMeasureDistance}
              measureDistance={measureDistance}
              showSidePanel={showSidePanel}
              setShowSidePanel={setShowSidePanel}
              showTransport={showTransport}
              setShowTransport={setShowTransport}
              selectedTransportCity={selectedTransportCity}
              setSelectedTransportCity={setSelectedTransportCity}
            />
          )}
          {activeModule === 'stats' && (
            <StatsPanel
              language={language}
              specialStats={specialStats}
              overallLevel={overallLevel}
              totalCompletions30={totalCompletions30}
              activeHabitsCount={activeHabits.length}
              bestStreak={bestStreak}
            />
          )}
          {activeModule === 'habits' && (
            <HabitsPanel
              language={language}
              habits={filteredHabits}
              allHabits={habits}
              habitFilter={habitFilter}
              setHabitFilter={setHabitFilter}
              showHabitForm={showHabitForm}
              setShowHabitForm={setShowHabitForm}
              habitForm={habitForm}
              setHabitForm={setHabitForm}
              handleSaveHabit={handleSaveHabit}
              handleOpenEditHabit={handleOpenEditHabit}
              handleDeleteHabit={(id) => {
                deleteHabit(id);
                if (selectedHabitId === id) setSelectedHabitId(null);
              }}
              toggleHabitDay={toggleHabitDay}
              todayStr={todayStr}
              selectedHabitId={selectedHabitId}
              setSelectedHabitId={setSelectedHabitId}
            />
          )}
          {activeModule === 'notes' && (
            <NotesPanel
              language={language}
              notes={filteredNotes}
              noteCategory={noteCategory}
              setNoteCategory={setNoteCategory}
              noteSearch={noteSearch}
              setNoteSearch={setNoteSearch}
              showNoteForm={showNoteForm}
              setShowNoteForm={setShowNoteForm}
              noteForm={noteForm}
              setNoteForm={setNoteForm}
              handleSaveNote={handleSaveNote}
              handleOpenEditNote={handleOpenEditNote}
              handleDeleteNote={handleDeleteNote}
              togglePinNote={togglePinNote}
              expandedNoteId={expandedNoteId}
              setExpandedNoteId={setExpandedNoteId}
            />
          )}
          {activeModule === 'games' && (
            <GamesPanel language={language} />
          )}
          {activeModule === 'settings' && (
            <SettingsPanel
              language={language}
              setLanguage={setLanguage}
              handleExport={handleExport}
              handleImport={handleImport}
              handleClear={handleClear}
              showClearConfirm={showClearConfirm}
              setShowClearConfirm={setShowClearConfirm}
              importRef={importRef}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAP PANEL
// ═══════════════════════════════════════════════════════════════

function MapPanel({
  language,
  markers,
  routes,
  notes,
  mapSettings,
  updateMapSettings,
  addMarker,
  addRoute,
  deleteMarker,
  deleteRoute,
  drawMode,
  setDrawMode,
  measurePoints,
  setMeasurePoints,
  setMeasureDistance,
  measureDistance,
  showSidePanel,
  setShowSidePanel,
  showTransport,
  setShowTransport,
  selectedTransportCity,
  setSelectedTransportCity,
}: {
  language: Language;
  markers: Marker[];
  routes: Route[];
  notes: Note[];
  mapSettings: { center: [number, number]; zoom: number; layer: MapLayer };
  updateMapSettings: (s: { layer?: MapLayer }) => void;
  addMarker: (m: Marker) => void;
  addRoute: (r: Route) => void;
  deleteMarker: (id: string) => void;
  deleteRoute: (id: string) => void;
  drawMode: string;
  setDrawMode: (m: 'none' | 'marker' | 'draw' | 'measure') => void;
  measurePoints: [number, number][];
  setMeasurePoints: (p: [number, number][]) => void;
  setMeasureDistance: (d: number) => void;
  measureDistance: number;
  showSidePanel: boolean;
  setShowSidePanel: (v: boolean) => void;
  showTransport: boolean;
  setShowTransport: (v: boolean) => void;
  selectedTransportCity: string;
  setSelectedTransportCity: (c: string) => void;
}) {
  const currentCity = cityTransports.find((c) => c.id === selectedTransportCity);

  return (
    <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* ── Map Area ─────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Toolbar */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: showSidePanel || showTransport ? '280px' : '8px',
          zIndex: 1000,
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Layer selector */}
          <select
            className="pip-select"
            value={mapSettings.layer}
            onChange={(e) => updateMapSettings({ layer: e.target.value as MapLayer })}
            style={{ fontSize: '11px', padding: '4px 6px' }}
          >
            <option value="streets">{t('map.streets', language)}</option>
            <option value="topo">{t('map.topo', language)}</option>
          </select>

          {/* Marker/Note counts */}
          <span style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px' }}>
            {t('map.markers', language)}: {markers.length}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px' }}>
            {t('mod.notes', language)}: {notes.length}
          </span>

          {/* Offline button */}
          <button className="pip-btn" style={{ fontSize: '10px', padding: '4px 8px' }}>
            {t('map.offline', language)}
          </button>
        </div>

        {/* Tool buttons */}
        <div style={{
          position: 'absolute',
          top: '44px',
          left: '8px',
          zIndex: 1000,
          display: 'flex',
          gap: '4px',
        }}>
          <button
            className={`pip-btn ${drawMode === 'marker' ? 'pip-btn-active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'marker' ? 'none' : 'marker')}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            {t('map.marker', language)}
          </button>
          <button
            className={`pip-btn ${drawMode === 'draw' ? 'pip-btn-active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'draw' ? 'none' : 'draw')}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            {t('map.draw', language)}
          </button>
          <button
            className={`pip-btn ${drawMode === 'measure' ? 'pip-btn-active' : ''}`}
            onClick={() => {
              if (drawMode === 'measure') {
                setDrawMode('none');
                setMeasurePoints([]);
                setMeasureDistance(0);
              } else {
                setDrawMode('measure');
              }
            }}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            {t('map.measure', language)}
          </button>
          {measureDistance > 0 && drawMode === 'measure' && (
            <span style={{ fontSize: '11px', color: 'var(--pip-amber)', padding: '4px 8px', fontFamily: "'Courier New', monospace" }}>
              {measureDistance >= 1000 ? `${(measureDistance / 1000).toFixed(2)} ${t('map.km', language)}` : `${Math.round(measureDistance)} ${t('map.m', language)}`}
            </span>
          )}
        </div>

        {/* Side panel toggles */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: showSidePanel || showTransport ? '288px' : '8px',
          zIndex: 1000,
          display: 'flex',
          gap: '4px',
        }}>
          <button
            className={`pip-btn ${showSidePanel ? 'pip-btn-active' : ''}`}
            onClick={() => { setShowSidePanel(!showSidePanel); if (showTransport) setShowTransport(false); }}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            {t('map.markers', language)}
          </button>
          <button
            className={`pip-btn ${showTransport ? 'pip-btn-active' : ''}`}
            onClick={() => { setShowTransport(!showTransport); if (showSidePanel) setShowSidePanel(false); }}
            style={{ fontSize: '10px', padding: '4px 10px' }}
          >
            {t('transport.title', language)}
          </button>
        </div>

        {/* Map Component */}
        <MapComponent
          markers={markers}
          routes={routes}
          onMarkerAdd={addMarker}
          onRouteAdd={addRoute}
          mapSettings={mapSettings}
          drawMode={drawMode as 'none' | 'marker' | 'draw' | 'measure'}
          measurePoints={measurePoints}
          onMeasurePointsChange={setMeasurePoints}
          onMeasureDistance={setMeasureDistance}
        />
      </div>

      {/* ── SIDE PANEL: Markers / Routes ─────────────────── */}
      {showSidePanel && (
        <div style={{
          width: '280px',
          flexShrink: 0,
          borderLeft: '1px solid var(--pip-border)',
          background: 'var(--pip-bg-panel)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Markers section */}
          <div style={{ padding: '10px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '8px' }}>
              {t('map.markers', language)} [{markers.length}]
            </div>
            {markers.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--pip-text-dim)' }}>
                {t('map.noMarkers', language)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {markers.map((m) => (
                  <div key={m.id} style={{
                    padding: '6px 8px',
                    border: '1px solid var(--pip-border-dim)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                  onClick={() => usePipStore.getState().flyTo(m.lat, m.lng, 15)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: m.favorite ? 'var(--pip-amber)' : 'var(--pip-text)' }}>
                        {m.favorite ? '★ ' : '◉ '}{m.title}
                      </span>
                      <span style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); usePipStore.getState().flyTo(m.lat, m.lng, 15); }}
                          title={language === 'ru' ? 'Перелететь' : 'Fly to'}
                          style={{ color: 'var(--pip-green-bright)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '11px', fontFamily: "'Courier New', monospace", padding: '0 2px' }}
                        >
                          →
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMarker(m.id); }}
                          style={{ color: 'var(--pip-red)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '10px', fontFamily: "'Courier New', monospace" }}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                    {m.description && (
                      <div style={{ color: 'var(--pip-text-dim)', fontSize: '10px', marginTop: '2px' }}>
                        {m.description}
                      </div>
                    )}
                    <div style={{ color: 'var(--pip-green-dim)', fontSize: '9px', marginTop: '2px' }}>
                      [{m.lat.toFixed(4)}, {m.lng.toFixed(4)}]
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Routes section */}
          <div style={{ padding: '10px', borderTop: '1px solid var(--pip-border-dim)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '8px' }}>
              {t('map.routes', language)} [{routes.length}]
            </div>
            {routes.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--pip-text-dim)' }}>
                {t('map.noRoutes', language)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {routes.map((r) => {
                  const first = r.points[0];
                  return (
                  <div key={r.id} style={{
                    padding: '6px 8px',
                    border: '1px solid var(--pip-border-dim)',
                    fontSize: '11px',
                    cursor: first ? 'pointer' : 'default',
                  }}
                  onClick={() => first && usePipStore.getState().flyTo(first[0], first[1], 14)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--pip-text)' }}>{r.name}</span>
                      <span style={{ display: 'flex', gap: '6px' }}>
                        {first && (
                          <button
                            onClick={(e) => { e.stopPropagation(); usePipStore.getState().flyTo(first[0], first[1], 14); }}
                            title={language === 'ru' ? 'Перелететь' : 'Fly to'}
                            style={{ color: 'var(--pip-green-bright)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '11px', fontFamily: "'Courier New', monospace", padding: '0 2px' }}
                          >
                            →
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteRoute(r.id); }}
                          style={{ color: 'var(--pip-red)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '10px', fontFamily: "'Courier New', monospace" }}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                    <div style={{ color: 'var(--pip-text-dim)', fontSize: '10px', marginTop: '2px' }}>
                      {r.points.length} {language === 'ru' ? 'точек' : 'points'}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SIDE PANEL: Transport ─────────────────────────── */}
      {showTransport && (
        <div style={{
          width: '320px',
          flexShrink: 0,
          borderLeft: '1px solid var(--pip-border)',
          background: 'var(--pip-bg-panel)',
          overflow: 'auto',
          padding: '10px',
        }}>
          <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '10px' }}>
            {t('transport.title', language)}
          </div>

          {/* City selector */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
              {t('transport.city', language)}
            </label>
            <select
              className="pip-select"
              value={selectedTransportCity}
              onChange={(e) => setSelectedTransportCity(e.target.value)}
              style={{ width: '100%' }}
            >
              {cityTransports.map((city) => (
                <option key={city.id} value={city.id}>
                  {language === 'ru' ? city.nameRu : city.name}
                </option>
              ))}
            </select>
          </div>

          {/* Schedule table */}
          {currentCity && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', marginBottom: '8px' }}>
                {t('transport.schedule', language)} — {language === 'ru' ? currentCity.nameRu : currentCity.name}
              </div>
              <table className="pip-table">
                <thead>
                  <tr>
                    <th>{t('transport.type', language)}</th>
                    <th>{t('transport.line', language)}</th>
                    <th>{t('transport.schedule', language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCity.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <span style={{ marginRight: '4px' }}>{getTransportIcon(line.type)}</span>
                        {getTransportTypeLabel(line.type, language)}
                      </td>
                      <td>
                        <div style={{ color: 'var(--pip-green-bright)' }}>{line.number}</div>
                        <div style={{ fontSize: '10px', color: 'var(--pip-text-dim)' }}>{line.from} → {line.to}</div>
                      </td>
                      <td style={{ fontSize: '10px' }}>
                        {line.schedule}
                        {line.notes && (
                          <div style={{ color: 'var(--pip-amber)', fontSize: '9px', marginTop: '2px' }}>
                            {line.notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STATS PANEL
// ═══════════════════════════════════════════════════════════════

function StatsPanel({
  language,
  specialStats,
  overallLevel,
  totalCompletions30,
  activeHabitsCount,
  bestStreak,
}: {
  language: Language;
  specialStats: { stat: SpecialStat; value: number; xp: number; xpToNext: number; label_ru: string; label_en: string; icon: string }[];
  overallLevel: number;
  totalCompletions30: number;
  activeHabitsCount: number;
  bestStreak: number;
}) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      {/* Title */}
      <div style={{ marginBottom: '20px' }}>
        <div className="pip-glow-strong" style={{ fontSize: '18px', letterSpacing: '3px', marginBottom: '4px' }}>
          {t('stats.special', language)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--pip-text-dim)' }}>
          {t('stats.desc', language)}
        </div>
      </div>

      {/* Overall Level */}
      <div className="pip-panel" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', letterSpacing: '2px', color: 'var(--pip-green-bright)' }}>
            {t('stats.overall', language)}
          </span>
          <span className="pip-glow-strong" style={{ fontSize: '28px', color: 'var(--pip-amber)' }}>
            {overallLevel}
          </span>
        </div>
        <div style={{
          height: '8px',
          background: 'var(--pip-bg)',
          border: '1px solid var(--pip-border-dim)',
        }}>
          <div style={{
            height: '100%',
            width: `${overallLevel * 10}%`,
            background: 'var(--pip-amber)',
            boxShadow: '0 0 8px var(--pip-amber)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {[
          { label: t('stats.completions', language), value: totalCompletions30, color: 'var(--pip-green)' },
          { label: t('stats.totalHabits', language), value: activeHabitsCount, color: 'var(--pip-cyan)' },
          { label: t('stats.streak', language), value: bestStreak, color: 'var(--pip-amber)' },
        ].map((item) => (
          <div key={item.label} className="pip-panel" style={{ padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', color: item.color, fontWeight: 'bold' }}>{item.value}</div>
            <div style={{ fontSize: '9px', color: 'var(--pip-text-dim)', letterSpacing: '1px', marginTop: '4px' }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* S.P.E.C.I.A.L. Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {specialStats.map((stat) => {
          const label = language === 'ru' ? stat.label_ru : stat.label_en;
          const descKey = `stats.${stat.stat}.desc` as string;
          return (
            <div key={stat.stat} className="pip-panel" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '2px solid var(--pip-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: 'var(--pip-green)',
                  textShadow: '0 0 8px var(--pip-green)',
                  flexShrink: 0,
                  fontFamily: "'Courier New', monospace",
                }}>
                  {stat.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--pip-green-bright)' }}>
                      {label}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--pip-green)' }}>
                      {stat.value}/10
                    </span>
                  </div>

                  {/* Value bar */}
                  <div style={{
                    height: '6px',
                    background: 'var(--pip-bg)',
                    border: '1px solid var(--pip-border-dim)',
                    marginBottom: '4px',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${stat.value * 10}%`,
                      background: 'var(--pip-green)',
                      boxShadow: '0 0 4px var(--pip-green)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>

                  {/* XP progress */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', color: 'var(--pip-text-dim)' }}>
                      {t(descKey, language)}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--pip-amber)' }}>
                      {t('stats.xp', language)}: {stat.xp}/{stat.xp + stat.xpToNext}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  HABITS PANEL
// ═══════════════════════════════════════════════════════════════

function HabitsPanel({
  language,
  habits,
  allHabits,
  habitFilter,
  setHabitFilter,
  showHabitForm,
  setShowHabitForm,
  habitForm,
  setHabitForm,
  handleSaveHabit,
  handleOpenEditHabit,
  handleDeleteHabit,
  toggleHabitDay,
  todayStr,
  selectedHabitId,
  setSelectedHabitId,
}: {
  language: Language;
  habits: Habit[];
  allHabits: Habit[];
  habitFilter: 'all' | 'active' | 'completed';
  setHabitFilter: (f: 'all' | 'active' | 'completed') => void;
  showHabitForm: boolean;
  setShowHabitForm: (v: boolean) => void;
  habitForm: { title: string; description: string; frequency: HabitFrequency; stat: SpecialStat; xpReward: number };
  setHabitForm: (f: { title: string; description: string; frequency: HabitFrequency; stat: SpecialStat; xpReward: number }) => void;
  handleSaveHabit: () => void;
  handleOpenEditHabit: (h: Habit) => void;
  handleDeleteHabit: (id: string) => void;
  toggleHabitDay: (id: string, date: string) => void;
  todayStr: string;
  selectedHabitId: string | null;
  setSelectedHabitId: (id: string | null) => void;
}) {
  const last7 = getLast7Days();
  const weekDays = getWeekDays(language);

  const selectedHabit = selectedHabitId ? allHabits.find((h) => h.id === selectedHabitId) : null;

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
      {/* Habit list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="pip-glow" style={{ fontSize: '16px', letterSpacing: '3px' }}>
            {t('habits.title', language)}
          </div>
          <button
            className="pip-btn"
            onClick={() => setShowHabitForm(true)}
            style={{ fontSize: '11px' }}
          >
            + {t('habits.add', language)}
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid var(--pip-border-dim)' }}>
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setHabitFilter(f)}
              className={`pip-tab ${habitFilter === f ? 'pip-tab-active' : ''}`}
              style={{ padding: '6px 14px' }}
            >
              {t(`habits.${f === 'all' ? 'all' : f === 'active' ? 'pending' : 'completed'}`, language)}
              <span style={{ marginLeft: '6px', color: 'var(--pip-amber)' }}>
                {f === 'all' ? allHabits.length : f === 'active' ? allHabits.filter((h) => h.active && !h.log.find((e) => e.date === todayStr && e.completed)).length : allHabits.filter((h) => h.log.find((e) => e.date === todayStr && e.completed)).length}
              </span>
            </button>
          ))}
        </div>

        {/* Habit cards */}
        {habits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '12px', color: 'var(--pip-text-dim)', letterSpacing: '1px' }}>
              {t('habits.noHabits', language)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--pip-green-dim)', marginTop: '8px' }}>
              {t('habits.createHint', language)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {habits.map((habit) => {
              const isTodayCompleted = habit.log.find((e) => e.date === todayStr && e.completed);
              const streak = calcStreak(habit);
              const statLabel = language === 'ru'
                ? { strength: 'СИЛА', perception: 'ВОСПР.', endurance: 'ВЫНОС.', charisma: 'ХАРИЗ.', intelligence: 'ИНТЕЛ.', agility: 'ЛОВКОСТЬ', luck: 'УДАЧА' }[habit.stat]
                : habit.stat.toUpperCase();
              const freqLabel = t(`habits.${habit.frequency}`, language);

              return (
                <div
                  key={habit.id}
                  className="pip-panel"
                  style={{ padding: '12px', cursor: 'pointer' }}
                  onClick={() => setSelectedHabitId(selectedHabitId === habit.id ? null : habit.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Today checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHabitDay(habit.id, todayStr);
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        border: `2px solid ${isTodayCompleted ? 'var(--pip-green)' : 'var(--pip-border-dim)'}`,
                        background: isTodayCompleted ? 'rgba(0,255,0,0.15)' : 'var(--pip-bg)',
                        color: isTodayCompleted ? 'var(--pip-green)' : 'transparent',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontFamily: "'Courier New', monospace",
                      }}
                    >
                      ✓
                    </button>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        color: isTodayCompleted ? 'var(--pip-green)' : 'var(--pip-text)',
                        letterSpacing: '1px',
                        textDecoration: isTodayCompleted ? 'line-through' : 'none',
                        marginBottom: '4px',
                      }}>
                        {habit.title}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '9px',
                          padding: '1px 6px',
                          border: '1px solid var(--pip-border-dim)',
                          color: 'var(--pip-text-dim)',
                          letterSpacing: '1px',
                        }}>
                          {freqLabel}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          padding: '1px 6px',
                          border: '1px solid var(--pip-amber)',
                          color: 'var(--pip-amber)',
                          letterSpacing: '1px',
                        }}>
                          {statLabel}
                        </span>
                        <span style={{ fontSize: '9px', color: 'var(--pip-text-dim)' }}>
                          {t('habits.level', language)}: {habit.level}
                        </span>
                        {streak > 0 && (
                          <span style={{ fontSize: '9px', color: 'var(--pip-amber)' }}>
                            🔥 {streak}{language === 'ru' ? 'д' : 'd'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEditHabit(habit); }}
                        style={{ color: 'var(--pip-text-dim)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '12px', fontFamily: "'Courier New', monospace" }}
                        title={t('notes.edit', language)}
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteHabit(habit.id); }}
                        style={{ color: 'var(--pip-red)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '12px', fontFamily: "'Courier New', monospace" }}
                        title={t('habits.delete', language)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Habit detail side panel */}
      {selectedHabit && (
        <div style={{
          width: '300px',
          flexShrink: 0,
          borderLeft: '1px solid var(--pip-border)',
          background: 'var(--pip-bg-panel)',
          overflow: 'auto',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', letterSpacing: '2px', color: 'var(--pip-green-bright)' }}>
              {selectedHabit.title}
            </span>
            <button
              onClick={() => setSelectedHabitId(null)}
              style={{ color: 'var(--pip-text-dim)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '14px', fontFamily: "'Courier New', monospace" }}
            >
              ✕
            </button>
          </div>

          {selectedHabit.description && (
            <div style={{ fontSize: '11px', color: 'var(--pip-text-dim)', marginBottom: '12px', lineHeight: '1.5' }}>
              {selectedHabit.description}
            </div>
          )}

          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--pip-text-dim)', letterSpacing: '1px' }}>{t('habits.streak', language)}</div>
              <div style={{ fontSize: '18px', color: 'var(--pip-amber)' }}>{calcStreak(selectedHabit)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--pip-text-dim)', letterSpacing: '1px' }}>{t('habits.bestStreak', language)}</div>
              <div style={{ fontSize: '18px', color: 'var(--pip-amber)' }}>{calcBestStreak(selectedHabit)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--pip-text-dim)', letterSpacing: '1px' }}>{t('habits.xp', language)}</div>
              <div style={{ fontSize: '18px', color: 'var(--pip-green)' }}>+{selectedHabit.xpReward}</div>
            </div>
          </div>

          {/* Weekly calendar */}
          <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '10px' }}>
            {language === 'ru' ? 'ПОСЛЕДНИЕ 7 ДНЕЙ' : 'LAST 7 DAYS'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '16px' }}>
            {last7.map((dateStr, i) => {
              const entry = selectedHabit.log.find((e) => e.date === dateStr);
              const completed = entry && entry.completed;
              const isToday = dateStr === todayStr;
              const dayOfWeek = new Date(dateStr).getDay();
              const adjustedDow = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

              return (
                <div
                  key={dateStr}
                  onClick={() => toggleHabitDay(selectedHabit.id, dateStr)}
                  style={{
                    textAlign: 'center',
                    padding: '6px 2px',
                    border: `1px solid ${completed ? 'var(--pip-green)' : isToday ? 'var(--pip-border)' : 'var(--pip-border-dim)'}`,
                    background: completed ? 'rgba(0,255,0,0.1)' : 'var(--pip-bg)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '9px', color: 'var(--pip-text-dim)', marginBottom: '4px' }}>
                    {weekDays[adjustedDow]}
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: completed ? 'var(--pip-green)' : 'var(--pip-green-dim)',
                    textShadow: completed ? '0 0 4px var(--pip-green)' : 'none',
                  }}>
                    {completed ? '✓' : '○'}
                  </div>
                  <div style={{ fontSize: '8px', color: 'var(--pip-green-dim)', marginTop: '2px' }}>
                    {dateStr.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Edit / Delete */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="pip-btn"
              onClick={() => handleOpenEditHabit(selectedHabit)}
              style={{ flex: 1, fontSize: '10px' }}
            >
              {t('notes.edit', language)}
            </button>
            <button
              className="pip-btn pip-btn-danger"
              onClick={() => { handleDeleteHabit(selectedHabit.id); }}
              style={{ flex: 1, fontSize: '10px' }}
            >
              {t('habits.delete', language)}
            </button>
          </div>
        </div>
      )}

      {/* ── Habit Form Modal ──────────────────────────────── */}
      {showHabitForm && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div className="pip-panel" style={{ padding: '20px', width: '400px', maxWidth: '90vw' }}>
            <div style={{ fontSize: '14px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '16px' }}>
              {t('habits.add', language)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('habits.name', language)}
                </label>
                <input
                  className="pip-input"
                  value={habitForm.title}
                  onChange={(e) => setHabitForm({ ...habitForm, title: e.target.value })}
                  placeholder={t('habits.name', language)}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('habits.description', language)}
                </label>
                <input
                  className="pip-input"
                  value={habitForm.description}
                  onChange={(e) => setHabitForm({ ...habitForm, description: e.target.value })}
                  placeholder={t('habits.description', language)}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('habits.frequency', language)}
                </label>
                <select
                  className="pip-select"
                  value={habitForm.frequency}
                  onChange={(e) => setHabitForm({ ...habitForm, frequency: e.target.value as HabitFrequency })}
                  style={{ width: '100%' }}
                >
                  <option value="daily">{t('habits.daily', language)}</option>
                  <option value="weekly">{t('habits.weekly', language)}</option>
                  <option value="custom">{t('habits.custom', language)}</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('habits.stat', language)}
                </label>
                <select
                  className="pip-select"
                  value={habitForm.stat}
                  onChange={(e) => setHabitForm({ ...habitForm, stat: e.target.value as SpecialStat })}
                  style={{ width: '100%' }}
                >
                  {SPECIAL_KEYS.map((key) => {
                    const labels: Record<SpecialStat, { ru: string; en: string }> = {
                      strength: { ru: 'СИЛА', en: 'STRENGTH' },
                      perception: { ru: 'ВОСПРИЯТИЕ', en: 'PERCEPTION' },
                      endurance: { ru: 'ВЫНОСЛИВОСТЬ', en: 'ENDURANCE' },
                      charisma: { ru: 'ХАРИЗМА', en: 'CHARISMA' },
                      intelligence: { ru: 'ИНТЕЛЛЕКТ', en: 'INTELLIGENCE' },
                      agility: { ru: 'ЛОВКОСТЬ', en: 'AGILITY' },
                      luck: { ru: 'УДАЧА', en: 'LUCK' },
                    };
                    return (
                      <option key={key} value={key}>
                        {language === 'ru' ? labels[key].ru : labels[key].en}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('habits.xp', language)}
                </label>
                <input
                  className="pip-input"
                  type="number"
                  min={1}
                  max={100}
                  value={habitForm.xpReward}
                  onChange={(e) => setHabitForm({ ...habitForm, xpReward: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="pip-btn" onClick={() => setShowHabitForm(false)} style={{ flex: 1 }}>
                {t('habits.cancel', language)}
              </button>
              <button className="pip-btn pip-btn-active" onClick={handleSaveHabit} style={{ flex: 1 }}>
                {t('habits.save', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  NOTES PANEL
// ═══════════════════════════════════════════════════════════════

function NotesPanel({
  language,
  notes,
  noteCategory,
  setNoteCategory,
  noteSearch,
  setNoteSearch,
  showNoteForm,
  setShowNoteForm,
  noteForm,
  setNoteForm,
  handleSaveNote,
  handleOpenEditNote,
  handleDeleteNote,
  togglePinNote,
  expandedNoteId,
  setExpandedNoteId,
}: {
  language: Language;
  notes: Note[];
  noteCategory: NoteCategory | 'all' | 'pinned';
  setNoteCategory: (c: NoteCategory | 'all' | 'pinned') => void;
  noteSearch: string;
  setNoteSearch: (s: string) => void;
  showNoteForm: boolean;
  setShowNoteForm: (v: boolean) => void;
  noteForm: { title: string; content: string; category: NoteCategory };
  setNoteForm: (f: { title: string; content: string; category: NoteCategory }) => void;
  handleSaveNote: () => void;
  handleOpenEditNote: (n: Note) => void;
  handleDeleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;
  expandedNoteId: string | null;
  setExpandedNoteId: (id: string | null) => void;
}) {
  const categoryTabs: (NoteCategory | 'all' | 'pinned')[] = ['all', 'general', 'quest', 'journal', 'location', 'character', 'pinned'];
  const expandedNote = expandedNoteId ? notes.find((n) => n.id === expandedNoteId) : null;

  const getCategoryLabel = (cat: NoteCategory | 'all' | 'pinned'): string => {
    if (cat === 'all') return t('notes.all', language);
    if (cat === 'pinned') return t('notes.pinned', language);
    return t(`notes.${cat}`, language);
  };

  const getCategoryBadgeColor = (cat: NoteCategory): string => {
    const colors: Record<NoteCategory, string> = {
      general: 'var(--pip-green)',
      quest: 'var(--pip-amber)',
      journal: 'var(--pip-cyan)',
      location: '#ff6600',
      character: '#cc66ff',
    };
    return colors[cat] || 'var(--pip-green)';
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
      {/* Note list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="pip-glow" style={{ fontSize: '16px', letterSpacing: '3px' }}>
            {t('notes.title', language)}
          </div>
          <button
            className="pip-btn"
            onClick={() => setShowNoteForm(true)}
            style={{ fontSize: '11px' }}
          >
            + {t('notes.add', language)}
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '10px' }}>
          <input
            className="pip-input"
            value={noteSearch}
            onChange={(e) => setNoteSearch(e.target.value)}
            placeholder={t('notes.search', language)}
          />
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid var(--pip-border-dim)', overflowX: 'auto' }}>
          {categoryTabs.map((cat) => (
            <button
              key={cat}
              onClick={() => setNoteCategory(cat)}
              className={`pip-tab ${noteCategory === cat ? 'pip-tab-active' : ''}`}
              style={{ padding: '6px 12px', whiteSpace: 'nowrap', fontSize: '10px' }}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Note cards */}
        {notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '12px', color: 'var(--pip-text-dim)', letterSpacing: '1px' }}>
              {t('notes.noNotes', language)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--pip-green-dim)', marginTop: '8px' }}>
              {t('notes.createHint', language)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notes.map((note) => (
              <div
                key={note.id}
                className="pip-panel"
                style={{
                  padding: '12px',
                  cursor: 'pointer',
                  borderColor: expandedNoteId === note.id ? 'var(--pip-green)' : undefined,
                }}
                onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  {/* Pin icon */}
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePinNote(note.id); }}
                    style={{
                      color: note.pinned ? 'var(--pip-amber)' : 'var(--pip-green-dim)',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      fontSize: '14px',
                      fontFamily: "'Courier New', monospace",
                      flexShrink: 0,
                      marginTop: '1px',
                    }}
                  >
                    {note.pinned ? '★' : '☆'}
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--pip-green-bright)',
                      letterSpacing: '1px',
                      marginBottom: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.title}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--pip-text-dim)', flexShrink: 0, marginLeft: '8px' }}>
                        {formatDate(note.updatedAt, language)}
                      </span>
                    </div>

                    {/* Category badge */}
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 6px',
                        border: `1px solid ${getCategoryBadgeColor(note.category)}`,
                        color: getCategoryBadgeColor(note.category),
                        letterSpacing: '1px',
                      }}>
                        {t(`notes.${note.category}`, language).toUpperCase()}
                      </span>
                    </div>

                    {/* Preview */}
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--pip-text-dim)',
                      lineHeight: '1.4',
                      maxHeight: expandedNoteId === note.id ? 'none' : '2.8em',
                      overflow: 'hidden',
                    }}>
                      {expandedNoteId === note.id ? (
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'Courier New', monospace", margin: 0 }}>
                          {note.content || '—'}
                        </pre>
                      ) : (
                        note.content.slice(0, 150) || '—'
                      )}
                    </div>

                    {/* Actions for expanded note */}
                    {expandedNoteId === note.id && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--pip-border-dim)', paddingTop: '8px' }}>
                        <button
                          className="pip-btn"
                          onClick={(e) => { e.stopPropagation(); handleOpenEditNote(note); }}
                          style={{ fontSize: '10px', padding: '4px 12px' }}
                        >
                          {t('notes.edit', language)}
                        </button>
                        <button
                          className="pip-btn pip-btn-danger"
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                          style={{ fontSize: '10px', padding: '4px 12px' }}
                        >
                          {t('notes.delete', language)}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Note Form Modal ───────────────────────────────── */}
      {showNoteForm && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div className="pip-panel" style={{ padding: '20px', width: '480px', maxWidth: '90vw' }}>
            <div style={{ fontSize: '14px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '16px' }}>
              {t('notes.add', language)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('notes.title_field', language)}
                </label>
                <input
                  className="pip-input"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  placeholder={t('notes.title_field', language)}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('notes.category', language)}
                </label>
                <select
                  className="pip-select"
                  value={noteForm.category}
                  onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value as NoteCategory })}
                  style={{ width: '100%' }}
                >
                  {(['general', 'quest', 'journal', 'location', 'character'] as NoteCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {t(`notes.${cat}`, language).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                  {t('notes.content', language)}
                </label>
                <textarea
                  className="pip-textarea"
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  placeholder={t('notes.content', language)}
                  rows={8}
                  style={{ minHeight: '160px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="pip-btn" onClick={() => setShowNoteForm(false)} style={{ flex: 1 }}>
                {t('habits.cancel', language)}
              </button>
              <button className="pip-btn pip-btn-active" onClick={handleSaveNote} style={{ flex: 1 }}>
                {t('notes.save', language)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════

function SettingsPanel({
  language,
  setLanguage,
  handleExport,
  handleImport,
  handleClear,
  showClearConfirm,
  setShowClearConfirm,
  importRef,
}: {
  language: Language;
  setLanguage: (l: Language) => void;
  handleExport: () => void;
  handleImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClear: () => void;
  showClearConfirm: boolean;
  setShowClearConfirm: (v: boolean) => void;
  importRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      <div className="pip-glow" style={{ fontSize: '16px', letterSpacing: '3px', marginBottom: '20px' }}>
        {t('settings.title', language)}
      </div>

      {/* Language Toggle */}
      <div className="pip-panel" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '10px' }}>
          {t('settings.language', language)}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`pip-btn ${language === 'ru' ? 'pip-btn-active' : ''}`}
            onClick={() => setLanguage('ru')}
            style={{ flex: 1 }}
          >
            РУССКИЙ
          </button>
          <button
            className={`pip-btn ${language === 'en' ? 'pip-btn-active' : ''}`}
            onClick={() => setLanguage('en')}
            style={{ flex: 1 }}
          >
            ENGLISH
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="pip-panel" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Export */}
          <button className="pip-btn pip-btn-active" onClick={handleExport} style={{ width: '100%', textAlign: 'left', padding: '10px 16px' }}>
            <span style={{ marginRight: '8px' }}>↓</span>
            {t('settings.export', language)}
          </button>

          {/* Import */}
          <button
            className="pip-btn"
            onClick={() => importRef.current?.click()}
            style={{ width: '100%', textAlign: 'left', padding: '10px 16px' }}
          >
            <span style={{ marginRight: '8px' }}>↑</span>
            {t('settings.import', language)}
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />

          {/* Clear */}
          {!showClearConfirm ? (
            <button
              className="pip-btn pip-btn-danger"
              onClick={() => setShowClearConfirm(true)}
              style={{ width: '100%', textAlign: 'left', padding: '10px 16px' }}
            >
              <span style={{ marginRight: '8px' }}>✕</span>
              {t('settings.clear', language)}
            </button>
          ) : (
            <div style={{
              border: '1px solid var(--pip-red)',
              padding: '10px',
              background: 'rgba(255,32,32,0.05)',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--pip-red)', marginBottom: '8px', letterSpacing: '1px' }}>
                {t('settings.clearConfirm', language)}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="pip-btn" onClick={() => setShowClearConfirm(false)} style={{ flex: 1 }}>
                  {t('habits.cancel', language)}
                </button>
                <button className="pip-btn pip-btn-danger" onClick={handleClear} style={{ flex: 1 }}>
                  {t('habits.delete', language)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* About */}
      <div className="pip-panel" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '10px' }}>
          {t('settings.about', language)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--pip-text-dim)', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '8px' }}>
            <span className="pip-glow" style={{ fontSize: '14px', color: 'var(--pip-green)' }}>◧ PIP-BOY 3000</span>
          </div>
          <div style={{ marginBottom: '8px' }}>ULTIMATE // {t('app.studio', language)}</div>
          <div style={{ marginBottom: '12px' }}>VERSION 2.0</div>
          <div style={{ color: 'var(--pip-amber)', fontStyle: 'italic' }}>
            {t('settings.disclaimer', language)}
          </div>
        </div>
      </div>

      {/* Transport Data Credits */}
      <div className="pip-panel" style={{ padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--pip-green-bright)', marginBottom: '10px' }}>
          {t('transport.title', language)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--pip-text-dim)', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '6px' }}>
            {cityTransports.map((city) => (
              <span key={city.id} style={{ marginRight: '12px' }}>
                {language === 'ru' ? city.nameRu : city.name} ({city.lines.length})
              </span>
            ))}
          </div>
          <div style={{ color: 'var(--pip-amber)' }}>
            {t('settings.mapsCredits', language)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GAMES PANEL
// ═══════════════════════════════════════════════════════════════

function GamesPanel({ language }: { language: Language }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--pip-border)' }}>
        <div className="pip-glow-strong" style={{ fontSize: '18px', letterSpacing: '3px' }}>
          {t('games.title', language)}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--pip-text-dim)', letterSpacing: '1px', marginTop: '4px' }}>
          {t('games.controlsDesc', language)}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
        <GalagaGame language={language} />
      </div>
    </div>
  );
}
