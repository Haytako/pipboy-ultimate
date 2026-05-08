# Pip-Boy 3000 Ultimate

Интерактивная симуляция интерфейса Pip-Boy 3000 из серии Fallout. Выполнена в стиле монохромного зелёного CRT-дисплея с эффектами развёртки и свечения.

## Возможности

- **STAT** — характеристики персонажа (S.P.E.C.I.A.L.)
- **INV** — инвентарь
- **DATA** — данные терминала
- **MAP** — карта локации
- **NOTES** — заметки
- **GAMES** — мини-игра Galaga (аналог Pip-Boy игр из Fallout 4)
- **SETTINGS** — настройки интерфейса

## Технологии

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Canvas API (рендеринг игры)
- Web Audio API (звуковые эффекты)
- Статический экспорт на GitHub Pages

## Деплой

Проект разворачивается на GitHub Pages из ветки `main`.
Для деплоя используется скрипт `deploy.ps1` (PowerShell):

```powershell
.\deploy.ps1
```

Или вручную:

```powershell
npm run build
Remove-Item -Recurse -Force _next -ErrorAction SilentlyContinue
Copy-Item -Recurse out/_next ./
Copy-Item out/index.html ./
if (-not (Test-Path .nojekyll)) { echo "" > .nojekyll }
git add -A
git commit -m "deploy"
git push
```

## Сайт

https://haytako.github.io/pipboy-ultimate/

## Автор

Sheglakov Aleksandr ([@haytako](https://github.com/haytako))
 
## Guide

[PipBoy_Ultimate_UserGuide_v3.pdf](./PipBoy_Ultimate_UserGuide_v3.pdf)