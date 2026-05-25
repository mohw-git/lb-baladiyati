#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy Baladi on Windows Server (manual git pull + build + migrate + restart).

.DESCRIPTION
  Does NOT run prisma seed. Does NOT copy .env files.
  Run from an elevated or service account that owns C:\baladiyati\app.

.PARAMETER AppRoot
  Repository root on the server (default C:\baladiyati\app).

.PARAMETER SkipGitPull
  Skip git pull (use when CI already synced the tree).

.PARAMETER SkipMigrate
  Skip prisma migrate deploy (emergency rollback redeploy only).

.PARAMETER UsePm2
  Restart via PM2 process names baladi-api / baladi-web instead of Windows services.

.EXAMPLE
  .\deploy\deploy.ps1 -AppRoot C:\baladiyati\app
#>
[CmdletBinding()]
param(
  [string] $AppRoot = 'C:\baladiyati\app',
  [switch] $SkipGitPull,
  [switch] $SkipMigrate,
  [switch] $UsePm2
)

$ErrorActionPreference = 'Stop'

function Write-Step([string] $Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path $AppRoot)) {
  throw "AppRoot not found: $AppRoot"
}

Set-Location $AppRoot

if (-not $SkipGitPull) {
  Write-Step 'Git pull'
  git fetch origin
  git pull --ff-only
  $env:GIT_COMMIT_SHA = (git rev-parse --short HEAD)
  Write-Host "GIT_COMMIT_SHA=$($env:GIT_COMMIT_SHA)"
}

if (-not (Test-Path '.env')) {
  throw "Missing $AppRoot\.env — copy from .env.production.example and fill secrets first."
}

Write-Step 'Backend: npm ci + prisma generate'
npm ci
npx prisma generate

if (-not $SkipMigrate) {
  Write-Step 'Prisma migrate deploy (no seed)'
  npm run prisma:migrate:deploy
}

Write-Step 'Backend: build'
npm run build

Write-Step 'Web dashboard: npm ci + build'
Set-Location (Join-Path $AppRoot 'web-dashboard')
if (-not (Test-Path '.env.production')) {
  Write-Warning 'web-dashboard\.env.production missing — copy from .env.production.example before build.'
}
npm ci
npm run build
Set-Location $AppRoot

Write-Step 'Restart application processes'
if ($UsePm2) {
  pm2 restart baladi-api --update-env
  pm2 restart baladi-web --update-env
  pm2 save
} else {
  $apiService = 'BaladiApi'
  $webService = 'BaladiWeb'
  foreach ($name in @($apiService, $webService)) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($svc) {
      Restart-Service -Name $name -Force
      Write-Host "Restarted Windows service: $name"
    } else {
      Write-Warning "Service not found: $name — start API/web manually or install NSSM services (see DEPLOYMENT.md)."
    }
  }
}

Write-Step 'Smoke checks'
& (Join-Path $AppRoot 'deploy\smoke.ps1')

Write-Host "`nDeploy finished." -ForegroundColor Green
