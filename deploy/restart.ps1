#Requires -Version 5.1
<#
.SYNOPSIS
  Restart baladi-api and baladi-web with updated env, then smoke test.

.PARAMETER AppRoot
  Repository root (default C:\baladiyati\app).

.PARAMETER IncludePublicSmoke
  Also test public HTTPS endpoints.

.EXAMPLE
  .\deploy\restart.ps1
#>
[CmdletBinding()]
param(
  [string] $AppRoot = 'C:\baladiyati\app',
  [switch] $IncludePublicSmoke
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

try {
  $AppRoot = Resolve-BaladiAppRoot $AppRoot
  Write-Step "Restart Baladiyati apps - $AppRoot"

  Test-BuildArtifacts -AppRoot $AppRoot

  Write-Step 'pm2 restart baladi-api baladi-web --update-env'
  pm2 restart baladi-api baladi-web --update-env 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-WarnMsg 'Restart failed - trying pm2 start via ecosystem'
    $ecosystem = Ensure-EcosystemConfig
    pm2 start $ecosystem 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "pm2 restart/start failed (exit $LASTEXITCODE)" }
  }

  Start-Sleep -Seconds 6
  pm2 list | Out-Host
  Invoke-Pm2Save

  Write-Step 'Smoke checks after restart'
  if ($IncludePublicSmoke) {
    Invoke-BaladiSmoke -AppRoot $AppRoot -IncludePublic
  } else {
    Invoke-BaladiSmoke -AppRoot $AppRoot
  }

  Write-Host "`nRestart completed." -ForegroundColor Green
  exit 0
} catch {
  Write-Fail $_.Exception.Message
  exit 1
}
