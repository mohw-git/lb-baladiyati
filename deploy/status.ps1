#Requires -Version 5.1
<#
.SYNOPSIS
  Show PM2 status, port listeners, Caddy, and optional recent logs.

.PARAMETER Logs
  Show last 50 lines of API and web PM2 logs.

.EXAMPLE
  .\deploy\status.ps1
  .\deploy\status.ps1 -Logs
#>
[CmdletBinding()]
param(
  [switch] $Logs
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_common.ps1')

Write-Step 'PM2 process list'
pm2 list 2>&1 | Out-Host

Write-Step 'Port listeners (3000 API, 3001 Web)'
Get-PortListenerSummary | Format-Table -AutoSize | Out-Host

Write-Step 'Caddy'
$caddy = Get-CaddyProcessSummary
if ($caddy.Running) {
  Write-Ok "Caddy running - PID $($caddy.PID) - $($caddy.Path)"
} else {
  Write-WarnMsg 'Caddy process not found (reverse proxy may be down)'
}

if ($Logs) {
  Write-Step 'PM2 logs - baladi-api (last 50)'
  pm2 logs baladi-api --lines 50 --nostream 2>&1 | Out-Host
  Write-Step 'PM2 logs - baladi-web (last 50)'
  pm2 logs baladi-web --lines 50 --nostream 2>&1 | Out-Host
}

Write-Host ''
exit 0
