param(
  [string]$Repo = "python-quest",
  [switch]$SkipChecks
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "Не найдено: $cmd. Установи: $hint" -ForegroundColor Red
    exit 1
  }
}
Need git "winget install --id Git.Git -e"
Need node "winget install --id OpenJS.NodeJS.LTS -e"
Need gh "winget install --id GitHub.cli -e"

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) { gh auth login --web --git-protocol https }
$user = gh api user --jq .login

if (-not $SkipChecks) {
  Write-Host "Ставлю зависимости и проверяю проект..." -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) { exit 1 }
  Write-Host "Проверяю Pyodide в vendor\pyodide (первый раз скачается около 340 МБ)..." -ForegroundColor Cyan
  npm run fetch:pyodide
  if ($LASTEXITCODE -ne 0) { Write-Host "Не удалось скачать Pyodide с GitHub — проверь интернет и запусти ещё раз." -ForegroundColor Red; exit 1 }
  npm run build:content
  if ($LASTEXITCODE -ne 0) { Write-Host "Сборка контента упала — смотри ошибки выше." -ForegroundColor Red; exit 1 }
  npm test
  if ($LASTEXITCODE -ne 0) { Write-Host "Тесты не прошли." -ForegroundColor Red; exit 1 }
}

if (-not (Test-Path .git)) {
  git init -b main | Out-Null
}
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m "Python Quest: обновление" | Out-Null }

gh repo view "$user/$Repo" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Создаю публичный репозиторий $user/$Repo..." -ForegroundColor Cyan
  gh repo create $Repo --public --source . --remote origin --push
  gh api -X POST "repos/$user/$Repo/pages" -f build_type=workflow 2>$null | Out-Null
} else {
  if (-not (git remote | Select-String origin)) { git remote add origin "https://github.com/$user/$Repo.git" }
  git push -u origin main
}

Write-Host "Жду, пока GitHub Actions соберёт и опубликует сайт..." -ForegroundColor Cyan
Start-Sleep -Seconds 10
gh run watch --repo "$user/$Repo" --exit-status (gh run list --repo "$user/$Repo" --limit 1 --json databaseId --jq ".[0].databaseId")
if ($LASTEXITCODE -eq 0) {
  Write-Host "Готово: https://$($user.ToLower()).github.io/$Repo/" -ForegroundColor Green
} else {
  Write-Host "Сборка на GitHub упала. Открой вкладку Actions в репозитории: https://github.com/$user/$Repo/actions" -ForegroundColor Red
}
