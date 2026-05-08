# deploy.ps1 — Скрипт деплоя Pip-Boy Ultimate на GitHub Pages
# Использование: .\deploy.ps1

Write-Host "=== Pip-Boy Ultimate Deploy ===" -ForegroundColor Green

# Перейти в корень проекта (где лежит этот скрипт)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Проверить что .git существует
if (-not (Test-Path ".git")) {
    Write-Host "ОШИБКА: Не найдена папка .git. Этот скрипт должен лежать в корне репозитория!" -ForegroundColor Red
    exit 1
}

# 2. Собрать проект
Write-Host ""
Write-Host "[1/5] Сборка проекта (npm run build)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ОШИБКА: Сборка провалилась!" -ForegroundColor Red
    exit 1
}

# 3. Убедиться что папка out/ существует
if (-not (Test-Path "out")) {
    Write-Host "ОШИБКА: Папка out/ не найдена после сборки!" -ForegroundColor Red
    exit 1
}

# 4. Скопировать ТОЛЬКО нужные файлы (README.md НЕ трогаем!)
Write-Host ""
Write-Host "[2/5] Копирование файлов из out/ ..." -ForegroundColor Yellow

# Удалить старый _next (если есть)
if (Test-Path "_next") {
    Remove-Item -Recurse -Force _next
    Write-Host "  - Удалён старый _next/" -ForegroundColor DarkGray
}

# Скопировать _next
Copy-Item -Recurse "out/_next" ".\_next"
Write-Host "  + Скопирован _next/" -ForegroundColor Gray

# Скопировать index.html
Copy-Item "out\index.html" ".\index.html"
Write-Host "  + Скопирован index.html" -ForegroundColor Gray

# Скопировать другие файлы из out (кроме README, .git и _next)
Get-ChildItem "out" -File | Where-Object {
    $_.Name -ne "README.md"
} | ForEach-Object {
    Copy-Item $_.FullName ".\$($_.Name)" -Force
    Write-Host "  + Скопирован $($_.Name)" -ForegroundColor Gray
}

# 5. Убедиться что .nojekyll существует
Write-Host ""
Write-Host "[3/5] Проверка .nojekyll ..." -ForegroundColor Yellow
if (-not (Test-Path ".nojekyll")) {
    echo "" > .nojekyll
    Write-Host "  + Создан .nojekyll" -ForegroundColor Gray
} else {
    Write-Host "  OK: .nojekyll на месте" -ForegroundColor Gray
}

# 6. Проверить что README.md на месте
Write-Host ""
Write-Host "[4/5] Проверка README.md ..." -ForegroundColor Yellow
if (Test-Path "README.md") {
    Write-Host "  OK: README.md на месте" -ForegroundColor Gray
} else {
    Write-Host "  ВНИМАНИЕ: README.md отсутствует! Рекомендуется его восстановить." -ForegroundColor Red
}

# 7. Git commit & push
Write-Host ""
Write-Host "[5/5] Git commit & push ..." -ForegroundColor Yellow
git add -A
git status

Write-Host ""
$commitMsg = Read-Host "Введите сообщение коммита (или Enter для 'deploy')"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "deploy"
}

git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "Нечего коммитить или ошибка." -ForegroundColor Yellow
} else {
    git push
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== DEPLOY УСПЕШЕН ===" -ForegroundColor Green
        Write-Host "Сайт: https://haytako.github.io/pipboy-ultimate/" -ForegroundColor Cyan
    } else {
        Write-Host "ОШИБКА при git push!" -ForegroundColor Red
    }
}
