#Requires -Version 5.1
<#
.SYNOPSIS
  First-time server setup: clone repo, create folders, copy env examples (no secrets).

.PARAMETER RepoUrl
  Git remote URL (required if app folder does not exist).

.PARAMETER AppRoot
  Target clone path (default C:\baladiyati\app).

.EXAMPLE
  .\deploy\first-clone.ps1 -RepoUrl https://github.com/your-org/baladiyati.git
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string] $RepoUrl = '',
  [string] $AppRoot = 'C:\baladiyati\app'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$parent = Split-Path $AppRoot -Parent
$dirs = @(
  $parent
  $script:BaladiDefaults.UploadsPath
  $script:BaladiDefaults.SecretsPath
  $script:BaladiDefaults.BackupRoot
  $script:BaladiDefaults.LogsPath
)

try {
  Write-Step 'First-time Baladiyati server setup'

  foreach ($d in $dirs) {
    if (-not (Test-Path -LiteralPath $d)) {
      New-Item -ItemType Directory -Path $d -Force | Out-Null
      Write-Ok "Created $d"
    } else {
      Write-Ok "Exists $d"
    }
  }

  if (Test-Path -LiteralPath $AppRoot) {
    $gitDir = Join-Path $AppRoot '.git'
    if (Test-Path -LiteralPath $gitDir) {
      Write-WarnMsg "App folder already exists: $AppRoot - clone skipped (never delete automatically)."
    } else {
      throw "Path exists but is not a git repo: $AppRoot - resolve manually before re-running."
    }
  } else {
    if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
      throw 'AppRoot does not exist. Pass -RepoUrl <git-url> to clone.'
    }
    Write-Step "git clone -> $AppRoot"
    git clone $RepoUrl $AppRoot
    if ($LASTEXITCODE -ne 0) { throw "git clone failed (exit $LASTEXITCODE)" }
    Write-Ok 'Repository cloned'
  }

  $backendExample = Join-Path $AppRoot '.env.production.example'
  $backendEnv = Join-Path $AppRoot '.env'
  if (-not (Test-Path -LiteralPath $backendEnv) -and (Test-Path -LiteralPath $backendExample)) {
    Copy-Item -LiteralPath $backendExample -Destination $backendEnv
    Write-Ok 'Created .env from .env.production.example - EDIT with real secrets before start'
  } elseif (Test-Path -LiteralPath $backendEnv) {
    Write-Ok 'Backend .env already exists (not overwritten)'
  }

  $webExample = Join-Path $AppRoot 'web-dashboard\.env.production.example'
  $webEnv = Join-Path $AppRoot 'web-dashboard\.env.production'
  if (-not (Test-Path -LiteralPath $webEnv) -and (Test-Path -LiteralPath $webExample)) {
    Copy-Item -LiteralPath $webExample -Destination $webEnv
    Write-Ok 'Created web-dashboard\.env.production from example'
  } elseif (Test-Path -LiteralPath $webEnv) {
    Write-Ok 'Web .env.production already exists (not overwritten)'
  }

  $ecosystem = $script:BaladiDefaults.EcosystemConfig
  if (-not (Test-Path -LiteralPath $ecosystem)) {
    Copy-Item -LiteralPath $script:BaladiDefaults.EcosystemExample -Destination $ecosystem
    Write-Ok "Created $ecosystem"
  }

  Write-Host @'

Next manual steps (secrets are NOT filled by this script):
  1. Edit C:\baladiyati\app\.env - JWT_SECRET, DATABASE_URL, Resend, Firebase path, etc.
  2. Place Firebase JSON at C:\baladiyati\secrets\firebase-adminsdk.json
  3. Edit C:\baladiyati\app\web-dashboard\.env.production - NEXT_PUBLIC_API_URL
  4. Install Node 24, PM2, PostgreSQL, Caddy
  5. cd C:\baladiyati\app
     npm ci
     npm run prisma:generate
     npm run prisma:migrate:deploy
     npm run build
     cd web-dashboard
     npm ci
     npm run build
  6. npm install -g pm2-windows-startup
     pm2-startup install
  7. .\deploy\start.ps1 -IncludePublicSmoke

Never run prisma seed on production.
Normal updates use: .\deploy\backup.ps1 -Uploads  then  .\deploy\deploy.ps1

'@ -ForegroundColor Yellow

  exit 0
} catch {
  Write-Fail $_.Exception.Message
  exit 1
}
