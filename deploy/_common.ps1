# Shared helpers for Baladi production deploy scripts (Windows Server).
# Dot-source from deploy\*.ps1 - do not run directly.

$script:BaladiDefaults = @{
  AppRoot           = 'C:\baladiyati\app'
  EcosystemConfig   = 'C:\baladiyati\ecosystem.config.cjs'
  EcosystemExample  = 'C:\baladiyati\app\deploy\pm2.ecosystem.example.cjs'
  BackupRoot        = 'C:\baladiyati\backup'
  UploadsPath       = 'C:\baladiyati\data\uploads'
  SecretsPath       = 'C:\baladiyati\secrets'
  LogsPath          = 'C:\baladiyati\logs'
  BackendMain       = 'dist\src\main.js'
  WebBuildId        = 'web-dashboard\.next\BUILD_ID'
  EnvBackend        = '.env'
  EnvWeb            = 'web-dashboard\.env.production'
  Pm2Apps           = @('baladi-api', 'baladi-web')
}

function Write-Step([string] $Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string] $Message) {
  Write-Host "  OK: $Message" -ForegroundColor Green
}

function Write-WarnMsg([string] $Message) {
  Write-Host "  WARN: $Message" -ForegroundColor Yellow
}

function Write-Fail([string] $Message) {
  Write-Host "  FAIL: $Message" -ForegroundColor Red
}

function Resolve-BaladiAppRoot([string] $AppRoot) {
  if ([string]::IsNullOrWhiteSpace($AppRoot)) {
    $AppRoot = $script:BaladiDefaults.AppRoot
  }
  $resolved = (Resolve-Path -LiteralPath $AppRoot -ErrorAction SilentlyContinue).Path
  if (-not $resolved) {
    throw "AppRoot not found: $AppRoot"
  }
  return $resolved
}

function Ensure-EcosystemConfig {
  param([string] $EcosystemConfig = $script:BaladiDefaults.EcosystemConfig)

  if (Test-Path -LiteralPath $EcosystemConfig) {
    Write-Ok "PM2 ecosystem: $EcosystemConfig"
    return $EcosystemConfig
  }

  $example = $script:BaladiDefaults.EcosystemExample
  if (-not (Test-Path -LiteralPath $example)) {
    throw "Missing ecosystem example: $example"
  }

  Write-WarnMsg "Creating $EcosystemConfig from example"
  Copy-Item -LiteralPath $example -Destination $EcosystemConfig -Force
  Write-Ok "Copied ecosystem config"
  return $EcosystemConfig
}

function Test-RequiredEnvFiles {
  param([string] $AppRoot)

  $backendEnv = Join-Path $AppRoot $script:BaladiDefaults.EnvBackend
  $webEnv = Join-Path $AppRoot $script:BaladiDefaults.EnvWeb

  if (-not (Test-Path -LiteralPath $backendEnv)) {
    throw "Missing backend env: $backendEnv (copy from .env.production.example)"
  }
  Write-Ok "Backend env file exists"

  if (-not (Test-Path -LiteralPath $webEnv)) {
    throw "Missing web env: $webEnv (copy from web-dashboard\.env.production.example)"
  }
  Write-Ok "Web env file exists"
}

function Test-BuildArtifacts {
  param([string] $AppRoot)

  $mainJs = Join-Path $AppRoot $script:BaladiDefaults.BackendMain
  $buildId = Join-Path $AppRoot $script:BaladiDefaults.WebBuildId

  if (-not (Test-Path -LiteralPath $mainJs)) {
    throw "Backend build missing: $mainJs - run: npm run build (in app root)"
  }
  Write-Ok "Backend build: $mainJs"

  if (-not (Test-Path -LiteralPath $buildId)) {
    throw "Web production build missing: $buildId - run: cd web-dashboard; npm run build"
  }
  Write-Ok "Web build: $buildId"
}

function Get-GitCommitShort {
  param([string] $AppRoot)
  Push-Location $AppRoot
  try {
    $null = git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return (git rev-parse --short HEAD).Trim()
  } finally {
    Pop-Location
  }
}

function Get-GitBranch {
  param([string] $AppRoot)
  Push-Location $AppRoot
  try {
    return (git rev-parse --abbrev-ref HEAD).Trim()
  } finally {
    Pop-Location
  }
}

function Assert-GitRepoReady {
  param(
    [string] $AppRoot,
    [switch] $AllowDirty
  )

  Push-Location $AppRoot
  try {
    $null = git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0) {
      throw "Not a git repository: $AppRoot"
    }

    $status = git status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "git status failed: $status"
    }

    if ($status -and -not $AllowDirty) {
      Write-Fail "Working tree has uncommitted changes. Commit, stash, or discard before deploy."
      $status | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkYellow }
      throw "Deploy aborted: dirty working tree"
    }

    if (-not $status) {
      Write-Ok "Git working tree clean"
    } else {
      Write-WarnMsg "Dirty working tree allowed for this operation"
    }
  } finally {
    Pop-Location
  }
}

function Invoke-GitPullProduction {
  param(
    [string] $AppRoot,
    [string] $Branch
  )

  Push-Location $AppRoot
  try {
    Assert-GitRepoReady -AppRoot $AppRoot

    $currentBranch = Get-GitBranch -AppRoot $AppRoot
    Write-Host "  Branch: $currentBranch" -ForegroundColor DarkGray

    if ($Branch -and $Branch -ne $currentBranch) {
      Write-Step "Checkout branch: $Branch"
      git fetch origin
      if ($LASTEXITCODE -ne 0) { throw "git fetch failed (exit $LASTEXITCODE)" }
      git checkout $Branch
      if ($LASTEXITCODE -ne 0) { throw "git checkout $Branch failed (exit $LASTEXITCODE)" }
      Write-Ok "Checked out $Branch"
    }

    Write-Step 'git fetch origin'
    git fetch origin
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed (exit $LASTEXITCODE)" }

    Write-Step 'git pull --ff-only'
    $pullOut = git pull --ff-only 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
      Write-Fail $pullOut.Trim()
      throw "git pull --ff-only failed. Resolve conflicts manually - do not reclone the app folder."
    }
    Write-Ok ($pullOut.Trim() -replace "`n", ' ')
  } finally {
    Pop-Location
  }
}

function Get-PortListenerSummary {
  param([int[]] $Ports = @(3000, 3001))

  $rows = @()
  foreach ($port in $Ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($conn) {
      $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
      $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
      $rows += [pscustomobject]@{ Port = $port; PID = $conn.OwningProcess; Process = $name; Listening = $true }
    } else {
      $rows += [pscustomobject]@{ Port = $port; PID = $null; Process = '-'; Listening = $false }
    }
  }
  return $rows
}

function Get-CaddyProcessSummary {
  $proc = Get-Process -Name 'caddy' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($proc) {
    return [pscustomobject]@{
      Running = $true
      PID     = $proc.Id
      Path    = $proc.Path
    }
  }
  return [pscustomobject]@{ Running = $false; PID = $null; Path = $null }
}

function Invoke-Pm2Save {
  pm2 save 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "pm2 save failed (exit $LASTEXITCODE)"
  }
  Write-Ok 'PM2 process list saved'
}

function Invoke-BaladiSmoke {
  param(
    [string] $AppRoot,
    [string] $ApiBase = 'http://127.0.0.1:3000',
    [string] $WebBase = 'http://127.0.0.1:3001',
    [switch] $IncludePublic
  )

  $smokeScript = Join-Path $AppRoot 'deploy\smoke.ps1'
  if (-not (Test-Path -LiteralPath $smokeScript)) {
    throw "Smoke script missing: $smokeScript"
  }

  if ($IncludePublic) {
    & $smokeScript -IncludePublic
  } else {
    & $smokeScript -ApiBase $ApiBase -WebBase $WebBase
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Smoke tests failed (exit $LASTEXITCODE)"
  }
}

function Export-RedactedEnvCopy {
  param(
    [string] $SourcePath,
    [string] $DestPath
  )

  if (-not (Test-Path -LiteralPath $SourcePath)) {
    return $false
  }

  $lines = Get-Content -LiteralPath $SourcePath -Encoding UTF8
  $redacted = foreach ($line in $lines) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') { $line }
    elseif ($line -match '^\s*([^#=]+?)\s*=\s*(.*)$') {
      $key = $Matches[1].Trim()
      "$key=(REDACTED)"
    } else { $line }
  }
  $null = New-Item -ItemType Directory -Path (Split-Path $DestPath -Parent) -Force -ErrorAction SilentlyContinue
  Set-Content -LiteralPath $DestPath -Value $redacted -Encoding UTF8
  return $true
}

function Get-PgDumpFromEnv {
  param([string] $EnvPath)

  if (-not (Test-Path -LiteralPath $EnvPath)) { return $null }

  $dbUrl = $null
  foreach ($line in Get-Content -LiteralPath $EnvPath -Encoding UTF8) {
    if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') {
      $dbUrl = $Matches[1].Trim().Trim('"').Trim([char]39)
      break
    }
  }
  if (-not $dbUrl) { return $null }

  try {
    $uri = [Uri]$dbUrl
    return @{
      Host     = $uri.Host
      Port     = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
      Database = $uri.AbsolutePath.TrimStart('/').Split('?')[0]
      User     = [Uri]::UnescapeDataString($uri.UserInfo.Split(':')[0])
      Password = if ($uri.UserInfo.Contains(':')) {
        [Uri]::UnescapeDataString($uri.UserInfo.Split(':', 2)[1])
      } else { $null }
    }
  } catch {
    return $null
  }
}
