// Pip-Boy Ultimate — Zustand Store
// Maps + Habits + Notes + RPG Stats (S.P.E.C.I.A.L.)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ===== Types =====

export type Language = 'ru' | 'en';
export type MapLayer = 'streets' | 'topo';
export type SpecialStat = 'strength' | 'perception' | 'endurance' | 'charisma' | 'intelligence' | 'agility' | 'luck';
export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type NoteCategory = 'general' | 'quest' | 'journal' | 'location' | 'character';

export interface Marker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string;
  category?: string;
  favorite: boolean;
  color?: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  name: string;
  points: RoutePoint[];
  color?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface HabitLog {
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  customDays?: number[]; // for custom frequency, 0=Mon, 6=Sun
  stat: SpecialStat; // which SPECIAL stat this habit trains
  xpReward: number; // XP gained per completion
  level: number; // habit level (higher = more XP)
  log: HabitLog[];
  createdAt: number;
  active: boolean;
}

export interface SpecialStatData {
  stat: SpecialStat;
  value: number; // 1-10
  xp: number; // current XP toward next level
  xpToNext: number; // XP needed for next level
  label_ru: string;
  label_en: string;
  icon: string; // single character
}

export interface TransportSchedule {
  city: string;
  type: string;
  line: string;
  stops: string[];
  times: string[];
}

export interface MapSettings {
  center: [number, number];
  zoom: number;
  layer: MapLayer;
}

// ===== State Interface =====

interface PipBoyState {
  // UI
  language: Language;
  activeModule: 'map' | 'stats' | 'habits' | 'notes' | 'settings' | 'games';
  activePanel: string | null;

  // Map
  markers: Marker[];
  routes: Route[];
  mapSettings: MapSettings;

  // Habits
  habits: Habit[];

  // Notes
  notes: Note[];

  // Transport
  selectedTransportCity: string;

  // Computed (derived via selectors)
  getSpecialStats: () => SpecialStatData[];

  // Actions — UI
  setLanguage: (lang: Language) => void;
  setActiveModule: (mod: PipBoyState['activeModule']) => void;
  setActivePanel: (panel: string | null) => void;

  // Actions — Map
  addMarker: (marker: Marker) => void;
  updateMarker: (id: string, data: Partial<Marker>) => void;
  deleteMarker: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addRoute: (route: Route) => void;
  updateRoute: (id: string, data: Partial<Route>) => void;
  deleteRoute: (id: string) => void;
  updateMapSettings: (settings: Partial<MapSettings>) => void;

  // Actions — Habits
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, data: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitDay: (id: string, date: string) => void;

  // Actions — Notes
  addNote: (note: Note) => void;
  updateNote: (id: string, data: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;

  // Actions — Transport
  setSelectedTransportCity: (city: string) => void;

  // Actions — Data
  exportData: () => string;
  importData: (json: string) => boolean;
  clearAllData: () => void;
}

// ===== Helper: compute SPECIAL stats from habits =====

const SPECIAL_META: Record<SpecialStat, { label_ru: string; label_en: string; icon: string }> = {
  strength:     { label_ru: 'СИЛА',         label_en: 'STRENGTH',     icon: 'S' },
  perception:   { label_ru: 'ВОСПРИЯТИЕ',    label_en: 'PERCEPTION',   icon: 'P' },
  endurance:    { label_ru: 'ВЫНОСЛИВОСТЬ',  label_en: 'ENDURANCE',    icon: 'E' },
  charisma:     { label_ru: 'ХАРИЗМА',       label_en: 'CHARISMA',     icon: 'C' },
  intelligence: { label_ru: 'ИНТЕЛЛЕКТ',     label_en: 'INTELLIGENCE', icon: 'I' },
  agility:      { label_ru: 'ЛОВКОСТЬ',      label_en: 'AGILITY',      icon: 'A' },
  luck:         { label_ru: 'УДАЧА',         label_en: 'LUCK',         icon: 'L' },
};

function computeSpecialStats(habits: Habit[]): SpecialStatData[] {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];

  return (Object.keys(SPECIAL_META) as SpecialStat[]).map((statKey) => {
    const statHabits = habits.filter((h) => h.stat === statKey && h.active);

    // Count weighted completions in last 30 days
    let completions = 0;
    statHabits.forEach((h) => {
      h.log.forEach((entry) => {
        if (entry.completed && entry.date >= thirtyDaysAgo && entry.date <= today) {
          completions += 1; // could weight by xpReward * level later
        }
      });
    });

    // Calculate value: base 1, +1 for every 3 completions, max 10
    const value = Math.min(10, 1 + Math.floor(completions / 3));
    const xp = completions % 3;

    return {
      stat: statKey,
      value,
      xp,
      xpToNext: 3 - xp,
      label_ru: SPECIAL_META[statKey].label_ru,
      label_en: SPECIAL_META[statKey].label_en,
      icon: SPECIAL_META[statKey].icon,
    };
  });
}

// ===== Default values =====

const DEFAULT_MAP_SETTINGS: MapSettings = {
  center: [51.2194, 4.4025], // Antwerp
  zoom: 14,
  layer: 'streets',
};

const INITIAL_STATE = {
  // UI
  language: 'en' as Language,
  activeModule: 'map' as PipBoyState['activeModule'],
  activePanel: null as string | null,

  // Map
  markers: [] as Marker[],
  routes: [] as Route[],
  mapSettings: DEFAULT_MAP_SETTINGS,

  // Habits
  habits: [] as Habit[],

  // Notes
  notes: [] as Note[],

  // Transport
  selectedTransportCity: 'antwerp',
};

// ===== Store =====

export const usePipStore = create<PipBoyState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── Computed ──────────────────────────────────────────────
      getSpecialStats: () => computeSpecialStats(get().habits),

      // ── UI Actions ────────────────────────────────────────────
      setLanguage: (lang) => set({ language: lang }),

      setActiveModule: (mod) =>
        set({ activeModule: mod, activePanel: null }),

      setActivePanel: (panel) => set({ activePanel: panel }),

      // ── Map Actions ───────────────────────────────────────────
      addMarker: (marker) =>
        set((s) => ({ markers: [...s.markers, marker] })),

      updateMarker: (id, data) =>
        set((s) => ({
          markers: s.markers.map((m) => (m.id === id ? { ...m, ...data } : m)),
        })),

      deleteMarker: (id) =>
        set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),

      toggleFavorite: (id) =>
        set((s) => ({
          markers: s.markers.map((m) =>
            m.id === id ? { ...m, favorite: !m.favorite } : m
          ),
        })),

      addRoute: (route) =>
        set((s) => ({ routes: [...s.routes, route] })),

      updateRoute: (id, data) =>
        set((s) => ({
          routes: s.routes.map((r) => (r.id === id ? { ...r, ...data } : r)),
        })),

      deleteRoute: (id) =>
        set((s) => ({ routes: s.routes.filter((r) => r.id !== id) })),

      updateMapSettings: (settings) =>
        set((s) => ({
          mapSettings: { ...s.mapSettings, ...settings },
        })),

      // ── Habit Actions ─────────────────────────────────────────
      addHabit: (habit) =>
        set((s) => ({ habits: [...s.habits, habit] })),

      updateHabit: (id, data) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...data } : h)),
        })),

      deleteHabit: (id) =>
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

      toggleHabitDay: (id, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;

            const existingIndex = h.log.findIndex((e) => e.date === date);
            let newLog: HabitLog[];

            if (existingIndex >= 0) {
              // Toggle existing entry
              newLog = h.log.map((e, i) =>
                i === existingIndex ? { ...e, completed: !e.completed } : e
              );
            } else {
              // Add new entry — mark as completed
              newLog = [...h.log, { date, completed: true }];
            }

            return { ...h, log: newLog };
          }),
        })),

      // ── Note Actions ──────────────────────────────────────────
      addNote: (note) =>
        set((s) => ({ notes: [...s.notes, note] })),

      updateNote: (id, data) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, ...data, updatedAt: Date.now() } : n
          ),
        })),

      deleteNote: (id) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      togglePinNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
          ),
        })),

      // ── Transport Actions ─────────────────────────────────────
      setSelectedTransportCity: (city) =>
        set({ selectedTransportCity: city }),

      // ── Data Actions ──────────────────────────────────────────
      exportData: () => {
        const { habits, markers, notes, routes, language, mapSettings, selectedTransportCity } =
          get();
        const payload = {
          version: '2.0',
          exportedAt: new Date().toISOString(),
          app: 'Pip-Boy Ultimate',
          language,
          habits,
          markers,
          notes,
          routes,
          mapSettings,
          selectedTransportCity,
        };
        return JSON.stringify(payload, null, 2);
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          if (!data || typeof data !== 'object') return false;

          // Accept both v1 and v2 exports
          set({
            language: data.language || 'en',
            habits: Array.isArray(data.habits) ? data.habits : [],
            markers: Array.isArray(data.markers) ? data.markers : [],
            notes: Array.isArray(data.notes) ? data.notes : [],
            routes: Array.isArray(data.routes) ? data.routes : [],
            mapSettings: data.mapSettings || DEFAULT_MAP_SETTINGS,
            selectedTransportCity: data.selectedTransportCity || 'antwerp',
            activeModule: 'map',
            activePanel: null,
          });
          return true;
        } catch {
          return false;
        }
      },

      clearAllData: () => {
        set({ ...INITIAL_STATE });
      },
    }),
    {
      name: 'pipboy-ultimate', // localStorage key
      // Only persist data — functions are excluded automatically by zustand/persist
      partialize: (state) => ({
        language: state.language,
        activeModule: state.activeModule,
        markers: state.markers,
        routes: state.routes,
        mapSettings: state.mapSettings,
        habits: state.habits,
        notes: state.notes,
        selectedTransportCity: state.selectedTransportCity,
      }),
    }
  )
);
