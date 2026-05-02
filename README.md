\# ◧ PIP-BOY 3000 ULTIMATE



<p align="center">

&nbsp; <img src="https://haytako.github.io/pipboy-ultimate/favicon.svg" alt="Pip-Boy Ultimate" width="120">

</p>



<p align="center">

&nbsp; <strong>Fallout-style personal organizer — Maps, RPG Stats, Habits, Notes \& Transport</strong><br>

&nbsp; <a href="https://haytako.github.io/pipboy-ultimate/">🌐 Live Demo</a>

</p>



<p align="center">

&nbsp; <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js">

&nbsp; <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">

&nbsp; <img src="https://img.shields.io/badge/Tailwind\_CSS-4-06B6D4?logo=tailwindcss" alt="Tailwind CSS">

&nbsp; <img src="https://img.shields.io/badge/PWA-Ready-9333ea" alt="PWA">

&nbsp; <img src="https://img.shields.io/badge/Offline-Support-brightgreen" alt="Offline">

&nbsp; <img src="https://img.shields.io/badge/License-MIT-green" alt="License">

</p>



---



\## What is this?



The \*\*PIP-BOY 3000 ULTIMATE\*\* is a Fallout-inspired personal organizer that combines five powerful modules into one immersive CRT-style interface. It's not just a map — it's your entire wasteland survival kit, running entirely in the browser with full offline support.



Think of it as: \*what if the Vault-Tec engineers built a productivity app?\*



```

╔══════════════════════════════════════════════╗

║  ◧ PIP-BOY 3000 ULTIMATE                    ║

║  ┌─────────────────────────────────────────┐ ║

║  │ MAP │ STATS │ HABITS │ NOTES │ SETTINGS │ ║

║  ├─────────────────────────────────────────┤ ║

║  │                                         │ ║

║  │   Your life. Gamified.                  │ ║

║  │   Offline. Private. Fun.                │ ║

║  │                                         │ ║

║  └─────────────────────────────────────────┘ ║

╚══════════════════════════════════════════════╝

```



\## ✨ Features



\### 🗺 MAP

\- Interactive Leaflet map with \*\*Streets\*\* and \*\*Topo\*\* tile layers

\- \*\*City search\*\* — find any city worldwide via Nominatim

\- Custom markers with categories, descriptions and favorites

\- Route planning and freehand drawing

\- Distance measurement tool (km/m)

\- \*\*Map position memory\*\* — zoom and center persist between sessions

\- \*\*Fly-to-marker\*\* navigation

\- Built-in transport schedules (Antwerp, Brussels, Moscow, Balashikha)

\- Offline tile caching via Service Worker



\### 📊 STATS (S.P.E.C.I.A.L.)

\- Full RPG character stat system — \*\*S\*\*trength, \*\*P\*\*erception, \*\*E\*\*ndurance, \*\*C\*\*harisma, \*\*I\*\*ntelligence, \*\*A\*\*gility, \*\*L\*\*uck

\- Each stat scales \*\*1–10\*\* with visual progress bars

\- Stats increase automatically as you complete linked habits

\- \*\*Overall level\*\* — average of all 7 stats

\- Summary dashboard: 30-day completions, active habits, best streak



\### ✅ HABITS

\- Daily, weekly, or custom frequency habits

\- Each habit links to a \*\*S.P.E.C.I.A.L. stat\*\* of your choice

\- \*\*XP rewards\*\* (default 10, customizable 1–100)

\- \*\*Streak tracking\*\* — current streak + all-time best streak

\- \*\*7-day calendar\*\* — visual weekly completion history

\- \*\*Habit levels\*\* — each habit has its own level

\- Filter: All / Active / Completed

\- Edit and delete existing habits



\### 📝 NOTES

\- Organized note-taking with \*\*5 categories\*\*: General, Quest, Journal, Location, Character

\- \*\*Pin\*\* important notes — they always appear first

\- Search across titles and content

\- Category filter tabs: All, General, Quest, Journal, Location, Character, Pinned

\- Full CRUD — create, read, update, delete



\### 🚌 TRANSPORT

\- Public transport schedules for \*\*4 cities\*\*:

&nbsp; - \*\*Antwerp\*\* — Bus, Tram (7 lines)

&nbsp; - \*\*Brussels\*\* — Metro, Bus, Tram, Train (7 lines)

&nbsp; - \*\*Moscow\*\* — Metro, MCC, Bus (6 lines)

&nbsp; - \*\*Balashikha\*\* — Bus, Electric Train (6 lines)

\- Type icons: bus, tram, metro, train

\- Schedule, route direction, and notes for each line



\### ⚙️ SETTINGS

\- Language toggle: 🇷🇺 Russian / 🇬🇧 English

\- Export all data as JSON (backup)

\- Import data from JSON file

\- Clear all data (with confirmation)



\## 🎮 RPG System



The core mechanic ties habits to character progression:



```

Create Habit → Link to S.P.E.C.I.A.L. stat → Complete daily → Earn XP

&nbsp;                                                             ↓

&nbsp;                                             Every 3 completions = +1 stat point

&nbsp;                                                             ↓

&nbsp;                                                   Level up your character!

```



\*\*Example:\*\*

| Situation | Result |

|-----------|--------|

| 3 habits on Strength, each done 5 times | 15 / 3 = +5 = \*\*Level 6\*\* |

| 1 habit on Luck, done 30 times | 30 / 3 = +9 = \*\*Level 10 (MAX)\*\* |



Base level: \*\*1\*\* · Maximum: \*\*10\*\* · Calculation window: \*\*last 30 days\*\*



\## 🛠 Tech Stack



| Tech | Purpose |

|------|---------|

| \[Next.js 16](https://nextjs.org/) | React framework with App Router |

| \[TypeScript](https://www.typescriptlang.org/) | Full type safety |

| \[Tailwind CSS 4](https://tailwindcss.com/) | Utility-first styling |

| \[Leaflet](https://leafletjs.com/) | Interactive maps |

| \[Zustand](https://zustand.docs.pmnd.rs/) | Lightweight state management |

| \[Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service\_Worker\_API) | Offline support |

| \[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) | Persistent data storage |

| \[Nominatim/Photon](https://photon.komoot.io/) | City search geocoding |



\## 🚀 Quick Start



```bash

\# Clone the repo

git clone https://github.com/Haytako/pipboy-ultimate.git

cd pipboy-ultimate



\# Install dependencies

npm install



\# Run dev server

npm run dev

```



Open \[http://localhost:3000](http://localhost:3000) in your browser.



\## 📦 Build for GitHub Pages



```bash

npm run build

```



The `out/` folder contains the static export. Deploy it to any static hosting.



\## 📱 Install as App



1\. Open the \[live demo](https://haytako.github.io/pipboy-ultimate/) on your phone

2\. Tap \*\*"Add to Home Screen"\*\* (Safari) or \*\*"Install"\*\* (Chrome)

3\. Boom — Pip-Boy on your phone like a real Vault Dweller 🎯



\## 🏗 Architecture



```

src/

├── app/

│   ├── page.tsx          # Main UI with all 5 panels

│   ├── layout.tsx        # PWA meta tags, fonts

│   └── globals.css       # Full CRT Pip-Boy theme

├── components/

│   └── MapComponent.tsx  # Leaflet map with all features

└── lib/

&nbsp;   ├── store.ts           # Zustand store (all state + localStorage)

&nbsp;   ├── translations.ts    # RU/EN full translations

&nbsp;   ├── transportData.ts   # Transport schedules

&nbsp;   └── offlineTiles.ts    # Tile download \& caching

```



\## 📂 Data Management



All data is stored in `localStorage` under key `pipboy-ultimate`.



\- \*\*Auto-save\*\* — everything saves automatically

\- \*\*Export\*\* — download backup as `pipboy-ultimate-YYYY-MM-DD.json`

\- \*\*Import\*\* — restore from backup file

\- \*\*No server\*\* — all data stays on your device

\- \*\*No sync\*\* — transfer data manually between devices



\## 🤔 Why?



Because productivity apps are boring. Why track habits in a plain white interface when you can do it in a Fallout terminal? This project proves that functional tools can also be fun and immersive.



Also — it works offline, needs no server, and respects your privacy. All data stays on your device.



---



<p align="center">

&nbsp; Made by <strong>Sandalf Studio</strong><br>

&nbsp; <a href="https://github.com/Haytako/pipboy-ultimate/issues">Report a bug</a> ·

&nbsp; <a href="https://github.com/Haytako/pipboy-ultimate/issues">Feature request</a> ·

&nbsp; ⭐ Star if you like it!

</p>



<p align="center">

&nbsp; <sub>"War. War never changes. But your habits can."</sub>

</p>



