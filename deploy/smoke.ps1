#Requires -Version 5.1
<#
.SYNOPSIS
  HTTP smoke tests for production endpoints (run on server or admin workstation).

.PARAMETER ApiBase
  Default https://api.lb-baladiyati.com

.PARAMETER WebBase
  Default https://lb-baladiyati.com
#>
[CmdletBinding()]
param(
  [string] $ApiBase = 'https://api.lb-baladiyati.com',
  [string] $WebBase = 'https://lb-baladiyati.com'
)

$ErrorActionPreference = 'Stop'

function Test-Endpoint {
  param([string] $Name, [string] $Url, [int[]] $AllowedStatus = @(200))
  Write-Host "Checking $Name : $Url"
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
    if ($AllowedStatus -notcontains $response.StatusCode) {
      throw "Unexpected status $($response.StatusCode)"
    }
    Write-Host "  OK ($($response.StatusCode))" -ForegroundColor Green
    return $response
  } catch {
    Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
    throw
  }
}

$ApiBase = $ApiBase.TrimEnd('/')
$WebBase = $WebBase.TrimEnd('/')

Test-Endpoint -Name 'API liveness' -Url "$ApiBase/health"
Test-Endpoint -Name 'API readiness' -Url "$ApiBase/ready"
Test-Endpoint -Name 'API version' -Url "$ApiBase/version"
Test-Endpoint -Name 'Web portal' -Url $WebBase -AllowedStatus @(200, 301, 302, 307, 308)

Write-Host "`nAll smoke checks passed." -ForegroundColor Green
