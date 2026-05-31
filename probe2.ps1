$BASE = 'http://localhost:3000'
function Get-Token($email, $pass) {
    $b = @{ email = $email; password = $pass } | ConvertTo-Json
    (Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b).data.accessToken
}
$tA = Get-Token 'admin@beirut.gov.lb'  'admin123'
$tS = Get-Token 'super@platform.local' 'superadmin123'

$hA  = @{ Authorization = "Bearer $tA"; 'X-Client-Platform' = 'web' }
$hAp = @{ Authorization = "Bearer $tA" }
$hS  = @{ Authorization = "Bearer $tS"; 'X-Client-Platform' = 'web' }

"=== /departments ==="
$d = Invoke-RestMethod -Uri "$BASE/departments" -Headers $hA
$d | ConvertTo-Json -Depth 5 | Select-Object -First 50

"=== /categories ==="
$c = Invoke-RestMethod -Uri "$BASE/categories" -Headers $hAp
$c | ConvertTo-Json -Depth 4 | Select-Object -First 30

"=== /platform/municipalities ==="
$m = Invoke-RestMethod -Uri "$BASE/platform/municipalities" -Headers $hS
$m | ConvertTo-Json -Depth 4 | Select-Object -First 30
