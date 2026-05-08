# ГАЙД: Pip-Boy Ultimate (и будущий Gwent)

> Инструкция для нового чата. Прочитай ВСЁ перед началом работы.
> Обновлён: 2026-05-09. Автор: Sheglakov Aleksandr (GitHub: haytako).
> Сайт: https://haytako.github.io/pipboy-ultimate/

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА — ПРОЧИТАТЬ ПЕРВЫМ

### 🚫 КАТЕГОРИЧЕСКИ НЕ ДЕЛАЙ:

1. **НЕ предлагай VS Code** — пользователь работает через блокнот + командную строку. Не устанавливай, не открывай, не упоминай VS Code.

2. **НЕ используй curl/wget для скачивания файлов** — не придумывай URL типа `files.chatglm.site/...` или `raw.githubusercontent.com/...` — они не работают. Все файлы передавай через инструменты чата (зипы, прямое редактирование).

3. **НЕ используй `import { t } from "../i18n"`** — такого пути нет. Правильно: `import { t } from '../lib/translations'`

4. **НЕ давай команды PowerShell со `&&`** — в PowerShell это не работает. Используй `;` или отдельные строки. Но вообще лучше cmd (см. ниже).

5. **НЕ используй `type nul > file`** — в PowerShell не работает. Используй `echo "" > file` или `echo.>file` в cmd.

6. **НЕ запускай npm в Git Bash** — node не в PATH в Git Bash. Только cmd.

7. **НЕ запускай npm в PowerShell** — PowerShell часто блокирует npm скрипты из-за Execution Policy (`PSSecurityException`). Используй cmd.

8. **НЕ удаляй `node_modules/` и `package-lock.json`** без крайней необходимости. npm install заново = 850+ пакетов, 2+ минуты.

9. **НЕ забывай `.nojekyll`** — без него GitHub Pages использует Jekyll, который игнорирует `_next/` → все JS/CSS = 404.

10. **НЕ пушь без билда** — если запушишь без `npm run build`, сайт сломается (не будет `_next/`).

### ✅ ПРАВИЛЬНЫЙ подход:

1. **Только cmd** — для ВСЕГО: npm, git, копирование файлов. Один терминал, одни команды.
2. npm install — только если удалён node_modules или package-lock.json
3. npm run build — может "молчать" 1-3 минуты при первой компиляции. Это нормально. Жди.
4. git push — может "зависнуть" (ничего не происходит после ввода). Нажми **Enter**.
5. Если cmd завис полностью (>3 минуты) — Ctrl+C и повтори команду.

---

## 1. Окружение пользователя (Windows)

| Параметр | Значение |
|---|---|
| Проект | `C:\Users\RobotComp.ru\Desktop\pipboy-ultimate` |
| Node.js | `C:\Program Files\nodejs\` (v24.15.0) |
| npm работает | Только в **cmd** (НЕ в Git Bash, НЕ в PowerShell) |
| Git | Через Git Bash |
| Терминал для деплоя | **cmd** (Пуск → cmd) |

---

## 2. Проекты на GitHub

| Репозиторий | URL | Статус |
|---|---|---|
| pipboy-ultimate | https://github.com/haytako/pipboy-ultimate | Активный |
| dark-matter-article | https://github.com/haytako/dark-matter-article | Завершён |

---

## 3. Pip-Boy Ultimate — что это

Симуляция интерфейса Pip-Boy 3000 из Fallout. Монохромный зелёно-чёрный экран с CRT-эффектами. Статический сайт на Next.js, деплоится на GitHub Pages.

### Вкладки:
- **STAT** — характеристики (S.P.E.C.I.A.L.)
- **INV** — инвентарь
- **DATA** — данные
- **MAP** — интерактивная карта (Leaflet)
- **NOTES** — заметки
- **GAMES** — мини-игра Galaga
- **SETTINGS** — настройки (RU/EN)

### Технологии:
- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS 4
- Zustand (localStorage persistence)
- Leaflet (карта)
- shadcn/ui (48 компонентов в src/components/ui/)
- Canvas API (Galaga)
- Web Audio API (звуки)
- Service Worker (офлайн)
- Статический экспорт: `output: 'export'`, `basePath: '/pipboy-ultimate'`

---

## 4. Структура проекта

```
pipboy-ultimate/
├── .git/
├── .gitignore
├── .nojekyll                    # КРИТИЧЕСКИ ВАЖНО для GitHub Pages!
├── README.md
├── next.config.ts               # output: 'export', basePath: '/pipboy-ultimate'
├── package.json
├── tsconfig.json
├── public/
│   ├── favicon.svg, logo.svg
│   ├── icon-192.png, icon-512.png
│   ├── manifest.json            # PWA
│   ├── sw.js                    # Service Worker
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout + ServiceWorkerRegistrar
│   │   ├── page.tsx             # Главная (~2029 строк, все панели inline)
│   │   └── globals.css          # CRT-стили + Galaga (~491 строка)
│   ├── components/
│   │   ├── GalagaGame.tsx       # Игра Galaga (~1170 строк)
│   │   ├── MapComponent.tsx     # Leaflet карта
│   │   ├── ServiceWorkerRegistrar.tsx  # Регистрация SW
│   │   └── ui/                  # 48 shadcn/ui компонентов
│   ├── hooks/
│   └── lib/
│       ├── store.ts             # Zustand store
│       ├── translations.ts      # i18n: RU + EN
│       ├── transportData.ts
│       ├── offlineTiles.ts
│       └── utils.ts
└── out/                         # Результат build (статический экспорт)
    ├── index.html
    └── _next/static/            # JS/CSS бандлы
```

### Правильные импорты:
```typescript
import { t } from '../lib/translations';  // НЕ "../i18n"!
import type { Language } from '../lib/store';
```

---

## 5. Деплой — ПОЛНАЯ ИНСТРУКЦИЯ

### Ситуация А: Быстрый деплой (исходники на месте, нужно пересобрать)

Открой **cmd** (Пуск → ввести "cmd" → Enter). Все команды по очереди:

```cmd
cd %USERPROFILE%\Desktop\pipboy-ultimate
npm run build
```
> ⏳ Жди 1-3 минуты. Next.js с Turbopack компилирует. "Молчит" — это нормально.

После успешного билда:

```cmd
rmdir /s /q _next
xcopy /e /i out\_next _next
copy out\index.html .
if not exist .nojekyll echo.>.nojekyll
git add -A
git commit -m "deploy: описание изменений"
git push
```
> ⏳ Если git push "завис" — нажми Enter. Жди завершения.

### Ситуация Б: Полная замена из zip (исходники потерялись)

**Шаг 1 — Git Bash** (распаковка, сохраняем .git и node_modules):
```bash
cd ~/Desktop/pipboy-ultimate
find . -maxdepth 1 ! -name '.' ! -name '.git' ! -name '.nojekyll' ! -name 'node_modules' ! -name 'package-lock.json' -exec rm -rf {} +
unzip ~/Desktop/pipboy-ultimate-full.zip
mv pipboy-ultimate-zip/* ./
mv pipboy-ultimate-zip/.gitignore ./ 2>/dev/null
rmdir pipboy-ultimate-zip
```

**Шаг 2 — cmd** (сборка):
```cmd
cd %USERPROFILE%\Desktop\pipboy-ultimate
npm run build
```

**Шаг 3 — cmd** (деплой):
```cmd
cd %USERPROFILE%\Desktop\pipboy-ultimate
rmdir /s /q _next
xcopy /e /i out\_next _next
copy out\index.html .
if not exist .nojekyll echo.>.nojekyll
git add -A
git commit -m "deploy: full update from zip"
git push
```

> 💡 Ситуация Б — всё можно сделать в cmd, кроме распаковки zip (удобнее в Git Bash).

---

## 6. Galaga — статус

### Работает (v5), задеплоена.

**Реализовано:**
- Canvas-рендеринг, 5 рядов x 8 колонок врагов (5 типов)
- Пикирующие атаки врагов (синусоида)
- 2 пули игрока одновременно
- 3 жизни, 2с неуязвимости после смерти
- Волны с нарастающей сложностью
- Звёздное поле (параллакс)
- Звуки (Web Audio API): выстрел, взрыв, game over
- Кнопки управления: LEFT, FIRE, RIGHT
- Клавиатура: стрелки + пробел
- Рекорды в localStorage
- Адаптивный размер canvas (телефон/ПК)
- Clip-область (враги не вылезают за границы)

**Баланс (текущий — упрощён для уровня 1):**
- Скорость формы: 0.3 (base) + 0.05 за уровень
- Пикирование: 0.00008 шанс/кадр/враг
- Стрельба врагов: 0.0003 шанс/кадр/враг
- Пули игрока: 2 одновременно
- 3 жизни

**Canvas-масштабирование** (исправлено в v5):
```javascript
const scaleX = displayW / GAME_W;   // GAME_W = 240
const scaleY = displayH / GAME_H;   // GAME_H = 320
ctx2d.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, 0, 0);
ctx2d.beginPath();
ctx2d.rect(0, 0, GAME_W, GAME_H);
ctx2d.clip();
```

---

## 7. Офлайн-поддержка (PWA)

### Работает, задеплоена.

- Service Worker: `public/sw.js`, кеш `pipboy-v1`
- Регистрация: `ServiceWorkerRegistrar.tsx` в `layout.tsx`
- Cache-first: JS/CSS/картинки/шрифты
- Network-first: HTML
- Первый визит с интернетом → всё кешируется
- Без интернета → работает из кеша

**Для обновления кеша** при новом деплое:
```javascript
// в public/sw.js:
const CACHE_NAME = 'pipboy-v2';  // поменять версию
```
Старый кеш удалится автоматически при активации нового SW.

---

## 8. Gwent — план (будущее)

Карточная игра в стиле Gwent (The Witcher 3) с тематикой Fallout. Будет во вкладке GAMES.

### Версии:
- **v0.1 (мини)** — PvE против AI, ~30 карт, упрощённые правила
- **v1.0 (полная)** — PvP мультиплеер, ~50+ карт, Firebase RTDB

### Мини-версия — правила:
- 2 игрока, 10 карт в колоде, 3 раунда
- 3 линии: Melee, Ranged, Siege
- Карта → очки силы на линии
- Можно "pass" (пропустить раунд)
- Раунд = оба passed → побеждает у кого больше очков
- Типы карт: юниты, особые (разовый эффект), лидерские способности

### Фракции:
- Brotherhood of Steel
- NCR
- Caesar's Legion
- Нейтральные

### Мультиплеер (v1.0):
- Firebase Realtime Database (free tier: 1 GB, 100 connections)
- Система комнат через код
- Структура: `/games/{roomCode}/state/players/board/`

---

## 9. Известные проблемы и решения

| Проблема | Причина | Решение |
|---|---|---|
| 404 на JS/CSS | Нет `.nojekyll` | `echo.>.nojekyll` + git push |
| Galaga в маленьком окне | setTransform без масштаба | `setTransform(dpr*scaleX, 0, 0, dpr*scaleY, 0, 0)` |
| npm не работает в Git Bash | node не в PATH | Используй cmd |
| npm блокируется PowerShell | Execution Policy | Используй cmd |
| cmd "завис" после команды | Нужен Enter | Нажми Enter |
| git push ничего не делает | Нужен Enter | Нажми Enter |
| npm run build долго молчит | Turbopack компилирует | Жди 1-3 минуты |
| Сайт сломался после push | Забыли `npm run build` | Пересобрать и запушить |
| README пропал | Копировали только из out/ | README теперь в git |

---

## 10. Чеклист для нового чата

### Как продолжить работу:

Отправь этот файл новому чату и скажи:

> "Привет! Вот гайд по моему проекту Pip-Boy Ultimate. Прочитай его ВНИМАТЕЛЬНО, особенно раздел с красными предупреждениями. Работаю на Windows, через cmd. Проект на GitHub Pages. Мне нужно [описание задачи]."

### Статус на 2026-05-09:

- ✅ **pipboy-ultimate**: Работает. Galaga v5. Офлайн через SW. Исходники в git.
- 📋 **Gwent**: На стадии планирования. Разработка не начиналась.
- ✅ **dark-matter-article**: Завершён, не трогаем.

---

*Конец инструкции.*
