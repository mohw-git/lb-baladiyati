#Requires -Version 5.1
<#
.SYNOPSIS
  Safe production deploy: git pull, build, migrate, restart PM2, smoke test.

.DESCRIPTION
  Uses existing repo at AppRoot - never reclones or deletes the app folder.
  Does NOT run seed, prisma migrate dev, or prisma db push.
  Does NOT print secrets.

.PARAMETER AppRoot
  Repository root (default C:\baladiyati\app).

.PARAMETER Branch
  Optional branch to checkout before pull (e.g. fix/complaint-workflow-governance).

.PARAMETER SkipGitPull
  Skip git fetch/pull (tree already synced).

.PARAMETER SkipMigrate
  Skip prisma migrate deploy (rollback redeploy when DB unchanged).

.PARAMETER SkipInstall
  Skip npm ci (use when node_modules already match lockfile).

.PARAMETER NoRestart
  Build only - do not restart PM2.

.EXAMPLE
  .\deploy\deploy.ps1
  .\deploy\deploy.ps1 -Branch fix/complaint-workflow-governance
  .\deploy\deploy.ps1 -SkipGitPull -SkipMigrate
#>
[CmdletBinding()]
param(
  [string] $AppRoot = 'C:\baladiyati\app',
  [string] $Branch = '',
  [switch] $SkipGitPull,
  [switch] $SkipMigrate,
  [switch] $SkipInstall,
  [switch] $NoRestart
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

try {
  $AppRoot = Resolve-BaladiAppRoot $AppRoot
  Write-Step "Production deploy - $AppRoot"

  Test-RequiredEnvFiles -AppRoot $AppRoot

  $oldCommit = Get-GitCommitShort -AppRoot $AppRoot
  $oldBranch = Get-GitBranch -AppRoot $AppRoot
  Write-Host "  Before: branch=$oldBranch commit=$oldCommit" -ForegroundColor DarkGray

  if (-not $SkipGitPull) {
    Invoke-GitPullProduction -AppRoot $AppRoot -Branch $Branch
  } else {
    Write-WarnMsg 'Skipped git pull (-SkipGitPull)'
  }

  $newCommit = Get-GitCommitShort -AppRoot $AppRoot
  $newBranch = Get-GitBranch -AppRoot $AppRoot

  Set-Location $AppRoot

  if (-not $SkipInstall) {
    Write-Step 'Backend: npm ci'
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed in app root (exit $LASTEXITCODE)" }
  } else {
    Write-WarnMsg 'Skipped backend npm ci (-SkipInstall)'
  }

  Write-Step 'Backend: prisma generate'
  npm run prisma:generate
  if ($LASTEXITCODE -ne 0) { throw "prisma generate failed (exit $LASTEXITCODE)" }

  if (-not $SkipMigrate) {
    Write-Step 'Backend: prisma migrate deploy (production only - no seed)'
    npm run prisma:migrate:deploy
    if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed (exit $LASTEXITCODE)" }
  } else {
    Write-WarnMsg 'Skipped migrate deploy (-SkipMigrate)'
  }

  Write-Step 'Backend: npm run build'
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "backend build failed (exit $LASTEXITCODE)" }

  $webDir = Join-Path $AppRoot 'web-dashboard'
  Set-Location $webDir

  if (-not $SkipInstall) {
    Write-Step 'Web: npm ci'
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed in web-dashboard (exit $LASTEXITCODE)" }
  }

  Write-Step 'Web: npm run build (production)'
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "web build failed (exit $LASTEXITCODE)" }

  Set-Location $AppRoot
  Test-BuildArtifacts -AppRoot $AppRoot

  if (-not $NoRestart) {
    Write-Step 'Restart PM2 apps'
    pm2 restart baladi-api baladi-web --update-env 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Write-WarnMsg 'PM2 restart failed - attempting start via ecosystem'
      $ecosystem = Ensure-EcosystemConfig
      pm2 start $ecosystem 2>&1 | Out-Host
      if ($LASTEXITCODE -ne 0) { throw "PM2 restart/start failed (exit $LASTEXITCODE)" }
    }
    Start-Sleep -Seconds 6
    Invoke-Pm2Save
  } else {
    Write-WarnMsg 'Skipped PM2 restart (-NoRestart)'
  }

  Write-Step 'Smoke tests (local + public)'
  Invoke-BaladiSmoke -AppRoot $AppRoot -IncludePublic

  Write-Host "`nDeploy finished." -ForegroundColor Green
  Write-Host "  $oldBranch $oldCommit -> $newBranch $newCommit" -ForegroundColor DarkGray
  exit 0
} catch {
  Write-Fail $_.Exception.Message
  exit 1
}
