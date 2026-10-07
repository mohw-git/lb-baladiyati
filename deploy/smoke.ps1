#Requires -Version 5.1
<#
.SYNOPSIS
  HTTP smoke tests for Baladiyati production (local and/or public).

.PARAMETER ApiBase
  API base URL (default local http://127.0.0.1:3000).

.PARAMETER WebBase
  Web base URL (default local http://127.0.0.1:3001).

.PARAMETER IncludePublic
  Run local checks (127.0.0.1) then public HTTPS endpoints.

.PARAMETER IncludeLocal
  Alias for IncludePublic when testing public URLs.

.PARAMETER PublicOnly
  Only test public HTTPS endpoints.

.EXAMPLE
  .\deploy\smoke.ps1
  .\deploy\smoke.ps1 -IncludePublic
  .\deploy\smoke.ps1 -ApiBase https://api.lb-baladiyati.com -WebBase https://lb-baladiyati.com
#>
[CmdletBinding()]
param(
  [string] $ApiBase = 'http://127.0.0.1:3000',
  [string] $WebBase = 'http://127.0.0.1:3001',
  [switch] $IncludePublic,
  [switch] $IncludeLocal,
  [switch] $PublicOnly
)

$ErrorActionPreference = 'Stop'

$failed = 0
$passed = 0

function Test-Endpoint {
  param(
    [string] $Name,
    [string] $Url,
    [int[]] $AllowedStatus = @(200)
  )
  Write-Host "  [$Name] $Url" -NoNewline
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
    if ($AllowedStatus -notcontains $response.StatusCode) {
      Write-Host " -> FAIL (HTTP $($response.StatusCode), expected $($AllowedStatus -join '/'))" -ForegroundColor Red
      $script:failed++
      return $false
    }
    Write-Host " -> OK ($($response.StatusCode))" -ForegroundColor Green
    $script:passed++
    return $true
  } catch {
    $code = $null
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
    }
    if ($code -and ($AllowedStatus -contains $code)) {
      Write-Host " -> OK ($code)" -ForegroundColor Green
      $script:passed++
      return $true
    }
    $msg = if ($code) { "HTTP $code" } else { $_.Exception.Message }
    Write-Host " -> FAIL ($msg)" -ForegroundColor Red
    $script:failed++
    return $false
  }
}

function Invoke-SmokeSuite {
  param(
    [string] $Label,
    [string] $Api,
    [string] $Web
  )
  Write-Host "`n--- $Label ---" -ForegroundColor Cyan
  $Api = $Api.TrimEnd('/')
  $Web = $Web.TrimEnd('/')
  Test-Endpoint -Name 'API health' -Url "$Api/health" | Out-Null
  Test-Endpoint -Name 'API ready' -Url "$Api/ready" | Out-Null
  Test-Endpoint -Name 'Web home' -Url $Web -AllowedStatus @(200, 301, 302, 307, 308) | Out-Null
}

try {
  Write-Host 'Baladiyati smoke tests' -ForegroundColor Cyan

  $runBoth = $IncludePublic -or $IncludeLocal
  if ($PublicOnly) {
    Invoke-SmokeSuite -Label 'Public' `
      -Api 'https://api.lb-baladiyati.com' `
      -Web 'https://lb-baladiyati.com'
  } elseif ($runBoth -or ($ApiBase -match '^https://api\.lb-baladiyati')) {
    Invoke-SmokeSuite -Label 'Local' -Api 'http://127.0.0.1:3000' -Web 'http://127.0.0.1:3001'
    Invoke-SmokeSuite -Label 'Public' `
      -Api 'https://api.lb-baladiyati.com' `
      -Web 'https://lb-baladiyati.com'
  } else {
    Invoke-SmokeSuite -Label 'Local' -Api $ApiBase -Web $WebBase
  }

  Write-Host "`nSummary: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })
  if ($failed -gt 0) {
    exit 1
  }
  Write-Host 'All smoke checks passed.' -ForegroundColor Green
  exit 0
} catch {
  Write-Host "Smoke aborted: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
