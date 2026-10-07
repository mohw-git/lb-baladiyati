$BASE = 'http://localhost:3000'
function Get-Token($email, $pass) {
    $b = @{ email = $email; password = $pass } | ConvertTo-Json
    (Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b).data.accessToken
}

$tC = Get-Token 'citizen@test.com'     'citizen123'
$tA = Get-Token 'admin@beirut.gov.lb'  'admin123'
$tS = Get-Token 'super@platform.local' 'superadmin123'

$hA  = @{ Authorization = "Bearer $tA"; 'X-Client-Platform' = 'web' }
$hAp = @{ Authorization = "Bearer $tA" }
$hS  = @{ Authorization = "Bearer $tS"; 'X-Client-Platform' = 'web' }
$hC  = @{ Authorization = "Bearer $tC" }
$hCw = @{ Authorization = "Bearer $tC"; 'X-Client-Platform' = 'web' }

"--- /departments ---"
$d = Invoke-RestMethod -Uri "$BASE/departments" -Headers $hA
$d.data | Select-Object -First 4 | Format-Table id,name

"--- /categories ---"
$c = Invoke-RestMethod -Uri "$BASE/categories" -Headers $hAp
$c.data | Select-Object -First 4 | Format-Table id,name

"--- /roles ---"
$r = Invoke-RestMethod -Uri "$BASE/roles" -Headers $hA
$r.data | Select-Object -First 4 | Format-Table id,name

"--- /platform/municipalities ---"
$m = Invoke-RestMethod -Uri "$BASE/platform/municipalities" -Headers $hS
$m.data | Select-Object -First 4 | Format-Table id,name

"--- /news ---"
$n = Invoke-RestMethod -Uri "$BASE/news?limit=5" -Headers $hA
$n.data | Get-Member -MemberType NoteProperty | Select-Object Name

"--- /complaints (admin) ---"
try {
    $comp = Invoke-RestMethod -Uri "$BASE/complaints?limit=5" -Headers $hA
    "complaint items: $($comp.data.items.Count)"
    $comp.data.items | Select-Object -First 4 | Format-Table id,referenceCode,status
} catch { "complaints error: $_" }

"--- /users (admin) ---"
$u = Invoke-RestMethod -Uri "$BASE/users?limit=5" -Headers $hA
Write-Host "users type: $($u.data.GetType().Name)"
if ($u.data -is [array]) { $u.data | Select-Object -First 4 | Format-Table id,email }
else { $u.data | Get-Member -MemberType NoteProperty | Select-Object Name }
