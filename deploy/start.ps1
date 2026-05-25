#Requires -Version 5.1
<#
.SYNOPSIS
  Start baladi-api and baladi-web via PM2 (production).

.PARAMETER AppRoot
  Repository root (default C:\baladiyati\app).

.PARAMETER IncludePublicSmoke
  Also run public HTTPS smoke checks after local checks.

.EXAMPLE
  .\deploy\start.ps1
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
  Write-Step "Start Baladi apps - $AppRoot"

  Test-RequiredEnvFiles -AppRoot $AppRoot
  Test-BuildArtifacts -AppRoot $AppRoot
  $ecosystem = Ensure-EcosystemConfig

  $list = pm2 jlist 2>&1 | ConvertFrom-Json
  $names = @($list | ForEach-Object { $_.name })
  $needStart = $false
  foreach ($app in $script:BaladiDefaults.Pm2Apps) {
    if ($names -notcontains $app) { $needStart = $true; break }
    $entry = $list | Where-Object { $_.name -eq $app } | Select-Object -First 1
    if ($entry.pm2_env.status -ne 'online') { $needStart = $true }
  }

  if ($needStart) {
    Write-Step "pm2 start $ecosystem"
    pm2 start $ecosystem 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "pm2 start failed (exit $LASTEXITCODE)" }
    Start-Sleep -Seconds 6
  } else {
    Write-Step 'PM2 apps already registered - starting if stopped'
    pm2 start $script:BaladiDefaults.Pm2Apps 2>&1 | Out-Host
    Start-Sleep -Seconds 4
  }

  pm2 list | Out-Host
  Invoke-Pm2Save

  Write-Step 'Local smoke checks'
  if ($IncludePublicSmoke) {
    Invoke-BaladiSmoke -AppRoot $AppRoot -IncludePublic
  } else {
    Invoke-BaladiSmoke -AppRoot $AppRoot
  }

  Write-Host "`nStart completed." -ForegroundColor Green
  exit 0
} catch {
  Write-Fail $_.Exception.Message
  exit 1
}
