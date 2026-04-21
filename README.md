[pipboy-ultimate-README.md](https://github.com/user-attachments/files/26942280/pipboy-ultimate-README.md)
# ◧ PIP-BOY 3000 ULTIMATE

<p align="center">
  <img src="https://haytako.github.io/pipboy-ultimate/favicon.svg" alt="Pip-Boy Ultimate" width="120">
</p>

<p align="center">
  <strong>Fallout-style personal organizer — Maps, RPG Stats, Habits Tracker & Notes</strong><br>
  <a href="https://haytako.github.io/pipboy-ultimate/">🌐 Live Demo</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/PWA-Ready-9333ea" alt="PWA">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## What is this?

The **PIP-BOY 3000 ULTIMATE** is a Fallout-inspired personal organizer that combines four powerful modules into one immersive CRT-style interface. It's not just a map — it's your entire wasteland survival kit, running entirely in the browser.

Think of it as: *what if the Vault-Tec engineers built a productivity app?*

## ✨ Features

### 🗺 MAP
- Interactive Leaflet map with street, satellite, and dark tile layers
- Custom markers with categories and colors
- Route planning and freehand drawing
- Distance measurement tool
- Built-in transport schedules (Antwerp, Brussels, Moscow, Balashikha)
- Offline tile caching via Service Worker

### 📊 STATS (S.P.E.C.I.A.L.)
- Full RPG character stat system — Strength, Perception, Endurance, Charisma, Intelligence, Agility, Luck
- Level-up system (start at Level 2, gain XP from habits)
- Each stat scales 1–10 with visual progress bars
- Stats increase automatically as you build habits

### ✅ HABITS
- Daily habit tracker with custom categories
- Streak tracking — don't break the chain!
- Completion history and statistics
- Each completed habit grants +1 XP toward your next level
- Stats grow with your habits — RPG motivation meets real productivity

### 📝 NOTES
- Organized note-taking with categories (Personal, Work, Ideas, Vault-Tec, Other)
- Each note has a title, content, and category tag
- Persistent storage — your notes survive browser restarts
- Quick add and manage workflow

### ⚙️ SETTINGS
- Language toggle: 🇷🇺 Russian / 🇬🇧 English
- Map preferences (default layer, transport city)
- Data management (all stored locally)

## 🎮 Gamification

The magic of Pip-Boy Ultimate is how it ties everything together:

```
Complete a habit → Earn XP → Level up → Boost your S.P.E.C.I.A.L. stats
```

Your real-life productivity literally makes your character stronger. Vault Boy would be proud.

## 🛠 Tech Stack

| Tech | Purpose |
|------|---------|
| [Next.js 16](https://nextjs.org/) | React framework with App Router |
| [TypeScript](https://www.typescriptlang.org/) | Full type safety |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first styling |
| [Leaflet](https://leafletjs.com/) | Interactive maps |
| [Zustand](https://zustand.docs.pmnd.rs/) | Lightweight state management |
| [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) | Offline tile caching |
| [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) | Persistent data storage |

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/haytako/pipboy-ultimate.git
cd pipboy-ultimate

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Build for GitHub Pages

```bash
npm run build
```

The `out/` folder contains the static export. Deploy it to any static hosting.

## 📱 Install as App

1. Open the [live demo](https://haytako.github.io/pipboy-ultimate/) on your phone
2. Tap **"Add to Home Screen"** (Safari) or **"Install"** (Chrome)
3. Boom — Pip-Boy on your phone like a real Vault Dweller 🎯

## 🏗 Architecture

```
src/
├── app/
│   ├── page.tsx          # Main UI with all 5 panels
│   ├── layout.tsx        # PWA meta tags, fonts
│   └── globals.css       # Full CRT Pip-Boy theme
├── components/
│   └── MapComponent.tsx  # Leaflet map with all features
└── lib/
    ├── store.ts           # Zustand store (all state + localStorage)
    ├── translations.ts    # RU/EN full translations
    ├── transportData.ts   # Transport schedules
    └── offlineTiles.ts    # Tile download & caching
```

## 🤔 Why?

Because productivity apps are boring. Why track habits in a plain white interface when you can do it in a Fallout terminal? This project proves that functional tools can also be fun and immersive.

Also — it works offline, needs no server, and respects your privacy. All data stays on your device.

---

<p align="center">
  Made by <strong>Sandalf Studio</strong><br>
  <a href="https://github.com/haytako/pipboy-ultimate/issues">Report a bug</a> ·
  <a href="https://github.com/haytako/pipboy-ultimate/issues">Feature request</a> ·
  ⭐ Star if you like it!
</p>

<p align="center">
  <sub>"War. War never changes. But your habits can."</sub>
</p>
