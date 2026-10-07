$ZAP_API  = 'http://localhost:8090'
$API_BASE = 'http://localhost:3000'
$SPEC_URL = 'http://localhost:3000/api-json'

function ZAP($path, $params = @{}) {
    $qs  = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString($_.Value))" }) -join '&'
    $url = if ($qs) { "$ZAP_API/JSON/$path/?$qs" } else { "$ZAP_API/JSON/$path/" }
    try   { Invoke-RestMethod -Uri $url -ErrorAction Stop }
    catch { Write-Host "  ZAP call failed [$path]: $($_.Exception.Message)" -ForegroundColor Red; $null }
}

function ZAP-Wait($scanId, $scanType) {
    $prog = 0
    while ($prog -lt 100) {
        Start-Sleep -Seconds 3
        $r    = ZAP "$scanType/view/status" @{ scanId = "$scanId" }
        $prog = if ($r) { [int]$r.status } else { 100 }
        Write-Host "  $scanType $prog% ..."
    }
    Write-Host "  $scanType complete"
}

function Get-JWT($email, $pass) {
    $b = @{ email = $email; password = $pass } | ConvertTo-Json
    (Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b).data.accessToken
}

Write-Host "--- Step 1: Login ---"
$tC = Get-JWT 'citizen@test.com'     'citizen123'
$tA = Get-JWT 'admin@beirut.gov.lb'  'admin123'
$tS = Get-JWT 'super@platform.local' 'superadmin123'
Write-Host "citizen : $($tC.Substring(0,25))..."
Write-Host "admin   : $($tA.Substring(0,25))..."
Write-Host "super   : $($tS.Substring(0,25))..."

Write-Host "--- Step 2: Import OpenAPI spec ---"
$imp = ZAP 'openapi/action/importUrl' @{ url = $SPEC_URL; hostOverride = $API_BASE }
Write-Host "Import: $($imp | ConvertTo-Json -Compress)"
Start-Sleep -Seconds 5

Write-Host "--- Step 3: Create context ---"
$ctxId = (ZAP 'context/action/newContext' @{ contextName = 'BaladiAPI' }).contextId
Write-Host "Context ID: $ctxId"
ZAP 'context/action/includeInContext' @{ contextName = 'BaladiAPI'; regex = 'http://localhost:3000.*' } | Out-Null
ZAP 'authentication/action/setAuthenticationMethod' @{ contextId = "$ctxId"; authMethodName = 'manualAuthentication' } | Out-Null

$uA = (ZAP 'users/action/newUser' @{ contextId = "$ctxId"; name = 'Admin'   }).userId
$uC = (ZAP 'users/action/newUser' @{ contextId = "$ctxId"; name = 'Citizen' }).userId
ZAP 'users/action/setUserEnabled' @{ contextId = "$ctxId"; userId = "$uA"; enabled = 'true' } | Out-Null
ZAP 'users/action/setUserEnabled' @{ contextId = "$ctxId"; userId = "$uC"; enabled = 'true' } | Out-Null
Write-Host "Users Admin=$uA Citizen=$uC"

Write-Host "--- Step 4: Admin token replacer ---"
ZAP 'replacer/action/addRule' @{
    description   = 'JWT-Admin'
    matchType     = 'REQ_HEADER'
    matchString   = 'Authorization'
    replacement   = "Bearer $tA"
    enable        = 'true'
} | Out-Null
Write-Host "Admin token rule added"

Write-Host "--- Step 5: Spider ---"
$spId = (ZAP 'spider/action/scan' @{ url = $API_BASE; contextName = 'BaladiAPI'; maxChildren = '0'; recurse = 'true' }).scan
Write-Host "Spider ID: $spId"
ZAP-Wait $spId 'spider'
$urlCount = (ZAP 'spider/view/results' @{ scanId = "$spId" }).results.Count
Write-Host "URLs discovered: $urlCount"

Write-Host "--- Step 6: Active scan as Admin ---"
$s1 = (ZAP 'ascan/action/scan' @{ url = $API_BASE; contextId = "$ctxId"; userId = "$uA"; recurse = 'true' }).scan
Write-Host "Admin scan ID: $s1"
ZAP-Wait $s1 'ascan'

Write-Host "--- Step 7: Switch to Citizen token ---"
ZAP 'replacer/action/removeRule' @{ description = 'JWT-Admin' } | Out-Null
ZAP 'replacer/action/addRule' @{
    description   = 'JWT-Citizen'
    matchType     = 'REQ_HEADER'
    matchString   = 'Authorization'
    replacement   = "Bearer $tC"
    enable        = 'true'
} | Out-Null
Write-Host "Citizen token rule added"

$s2 = (ZAP 'ascan/action/scan' @{ url = $API_BASE; contextId = "$ctxId"; userId = "$uC"; recurse = 'true' }).scan
Write-Host "Citizen scan ID: $s2"
ZAP-Wait $s2 'ascan'

Write-Host "--- Step 8: Alerts ---"
$alerts = (ZAP 'alert/view/alerts' @{ baseurl = $API_BASE; count = '200' }).alerts
$hi = @($alerts | Where-Object { $_.risk -eq 'High' })
$me = @($alerts | Where-Object { $_.risk -eq 'Medium' })
$lo = @($alerts | Where-Object { $_.risk -eq 'Low' })
$inf= @($alerts | Where-Object { $_.risk -eq 'Informational' })

Write-Host "========================================"
Write-Host "  ZAP SCAN REPORT"
Write-Host "  HIGH     : $($hi.Count)"
Write-Host "  MEDIUM   : $($me.Count)"
Write-Host "  LOW      : $($lo.Count)"
Write-Host "  INFO     : $($inf.Count)"
Write-Host "  TOTAL    : $($alerts.Count)"
Write-Host "========================================"

if ($hi.Count -gt 0) {
    Write-Host "HIGH RISK FINDINGS:" -ForegroundColor Red
    $hi | Select-Object risk, name, url, solution | Format-List
}
if ($me.Count -gt 0) {
    Write-Host "MEDIUM RISK FINDINGS:" -ForegroundColor Yellow
    $me | Select-Object risk, name, url | Format-Table -AutoSize
}
if ($lo.Count -gt 0) {
    Write-Host "LOW RISK FINDINGS:"
    $lo | Select-Object risk, name, url | Format-Table -AutoSize
}

Write-Host "--- Step 9: Generate HTML report ---"
$rpt = ZAP 'reports/action/generate' @{
    title          = 'Baladi API Scan'
    template       = 'traditional-html'
    reportDir      = 'C:\Users\A\Documents\bau\app'
    reportFileName = 'zap_report'
    sites          = $API_BASE
}
Write-Host "Report file: $($rpt.generate)"
