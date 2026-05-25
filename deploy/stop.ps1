#Requires -Version 5.1
<#
.SYNOPSIS
  Stop baladi-api and baladi-web (does not stop Caddy or Postgres).

.PARAMETER Delete
  Remove processes from PM2 (use before a clean ecosystem start).

.EXAMPLE
  .\deploy\stop.ps1
  .\deploy\stop.ps1 -Delete
#>
[CmdletBinding()]
param(
  [switch] $Delete
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

try {
  Write-Step 'Stop Baladi PM2 apps (Caddy and Postgres are not touched)'

  $apps = ($script:BaladiDefaults.Pm2Apps -join ' ')
  if ($Delete) {
    Write-Step "pm2 delete $apps"
    pm2 delete $script:BaladiDefaults.Pm2Apps 2>&1 | Out-Host
  } else {
    Write-Step "pm2 stop $apps"
    pm2 stop $script:BaladiDefaults.Pm2Apps 2>&1 | Out-Host
  }

  if ($LASTEXITCODE -ne 0) {
    Write-WarnMsg "pm2 returned exit $LASTEXITCODE (apps may already be stopped)"
  }

  pm2 list | Out-Host
  Invoke-Pm2Save

  Write-Host "`nStop completed." -ForegroundColor Green
  exit 0
} catch {
  Write-Fail $_.Exception.Message
  exit 1
}
