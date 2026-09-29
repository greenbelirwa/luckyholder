# push.ps1 - commit ALL changes in this repo and push to origin/main
# Usage: double-click push.bat   or   push.bat "commit message"
param([string]$Message = "")

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is not installed or not in PATH." }

    # Remove a stale lock left behind by a crashed git process
    if (Test-Path '.git\index.lock') {
        if (Get-Process git -ErrorAction SilentlyContinue) { throw "Another git process is running. Close it and try again." }
        Write-Host "Removing stale .git\index.lock" -ForegroundColor Yellow
        Remove-Item '.git\index.lock' -Force
    }

    $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne 'main') { throw "Current branch is '$branch', not 'main'. Run: git checkout main" }

    Write-Host ""
    Write-Host "== Changes ==" -ForegroundColor Cyan
    Invoke-Git status --short

    Invoke-Git add -A
    & git diff --cached --quiet
    $hasChanges = ($LASTEXITCODE -ne 0)

    if ($hasChanges) {
        if (-not $Message) { $Message = Read-Host "Commit message (Enter = auto)" }
        if (-not $Message) { $Message = "Update " + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
        Invoke-Git commit -m $Message
    } else {
        Write-Host "Nothing new to commit." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "== Syncing with GitHub ==" -ForegroundColor Cyan
    Invoke-Git pull --rebase origin main
    Invoke-Git push origin main

    Write-Host ""
    Write-Host "DONE - pushed to origin/main:" -ForegroundColor Green
    Invoke-Git log -1 --oneline
    exit 0
}
catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
