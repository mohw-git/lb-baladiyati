#Requires -Version 5.1
<#
.SYNOPSIS
  Timestamped backup before production deploy (no secrets printed).

.PARAMETER Uploads
  Copy C:\baladiyati\data\uploads into the backup folder.

.PARAMETER DatabaseName
  Database name for pg_dump (default baladi).

.PARAMETER DbUser
  PostgreSQL user for pg_dump (default postgres).

.EXAMPLE
  .\deploy\backup.ps1 -Uploads
#>
[CmdletBinding()]
param(
  [switch] $Uploads,
  [string] $DatabaseName = 'baladi',
  [string] $DbUser = 'postgres',
  [string] $AppRoot = 'C:\baladiyati\app',
  [string] $BackupRoot = 'C:\baladiyati\backup'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

try {
  $AppRoot = Resolve-BaladiAppRoot $AppRoot
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $dest = Join-Path $BackupRoot $stamp
  New-Item -ItemType Directory -Path $dest -Force | Out-Null

  Write-Step "Backup folder: $dest"

  $manifest = [ordered]@{
    CreatedAt = (Get-Date).ToString('o')
    AppRoot   = $AppRoot
    Items     = @()
  }

  $envPath = Join-Path $AppRoot '.env'
  $redactedDest = Join-Path $dest 'env-backend-redacted.txt'
  if (Export-RedactedEnvCopy -SourcePath $envPath -DestPath $redactedDest) {
    Write-Ok 'Backend .env copied (values REDACTED)'
    $manifest.Items += 'env-backend-redacted.txt'
  } else {
    Write-WarnMsg 'Backend .env not found - skipped'
  }

  $webEnv = Join-Path $AppRoot 'web-dashboard\.env.production'
  $webRedacted = Join-Path $dest 'env-web-redacted.txt'
  if (Export-RedactedEnvCopy -SourcePath $webEnv -DestPath $webRedacted) {
    Write-Ok 'Web .env.production copied (values REDACTED)'
    $manifest.Items += 'env-web-redacted.txt'
  }

  $commit = Get-GitCommitShort -AppRoot $AppRoot
  $branch = Get-GitBranch -AppRoot $AppRoot
  @(
    "branch=$branch"
    "commit=$commit"
    "hostname=$env:COMPUTERNAME"
  ) | Set-Content -LiteralPath (Join-Path $dest 'git-info.txt') -Encoding UTF8
  Write-Ok "Git: $branch @ $commit"

  if ($Uploads) {
    $uploadsSrc = $script:BaladiDefaults.UploadsPath
    if (Test-Path -LiteralPath $uploadsSrc) {
      $uploadsDest = Join-Path $dest 'uploads'
      Write-Step "Copying uploads: $uploadsSrc"
      Copy-Item -LiteralPath $uploadsSrc -Destination $uploadsDest -Recurse -Force
      Write-Ok 'Uploads folder copied'
      $manifest.Items += 'uploads/'
    } else {
      Write-WarnMsg "Uploads path not found: $uploadsSrc"
    }
  }

  $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
  if (-not $pgDump) {
    Write-WarnMsg 'pg_dump not found on PATH - database backup skipped. Install PostgreSQL client tools or add bin to PATH.'
  } else {
    $pg = Get-PgDumpFromEnv -EnvPath $envPath
    $dumpFile = Join-Path $dest "db-$DatabaseName.sql"
    if ($pg) {
      Write-Step "pg_dump -> $dumpFile (host $($pg.Host), db $($pg.Database))"
      $env:PGPASSWORD = $pg.Password
      $args = @(
        '-h', $pg.Host
        '-p', $pg.Port
        '-U', $(if ($pg.User) { $pg.User } else { $DbUser })
        '-d', $(if ($pg.Database) { $pg.Database } else { $DatabaseName })
        '-F', 'p'
        '-f', $dumpFile
        '--no-owner'
        '--no-acl'
      )
      & pg_dump @args 2>&1 | Out-Host
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
      if ($LASTEXITCODE -ne 0) {
        Write-WarnMsg "pg_dump failed (exit $LASTEXITCODE) - check DATABASE_URL and PostgreSQL service"
      } else {
        Write-Ok "Database dump: $dumpFile"
        $manifest.Items += (Split-Path $dumpFile -Leaf)
      }
    } else {
      Write-WarnMsg 'Could not parse DATABASE_URL from .env - trying pg_dump with -d parameter only'
      & pg_dump -U $DbUser -d $DatabaseName -F p -f $dumpFile --no-owner --no-acl 2>&1 | Out-Host
      if ($LASTEXITCODE -eq 0) {
        Write-Ok "Database dump: $dumpFile"
        $manifest.Items += (Split-Path $dumpFile -Leaf)
      } else {
        Write-WarnMsg "pg_dump failed (exit $LASTEXITCODE)"
      }
    }
  }

  $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dest 'manifest.json') -Encoding UTF8
  Write-Host "`nBackup completed: $dest" -ForegroundColor Green
  exit 0
} catch {
  Write-Fail $_.Exception.Message
  exit 1
}
