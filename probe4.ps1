$BASE = 'http://localhost:3000'
function Tok($e,$p){ $b=@{email=$e;password=$p}|ConvertTo-Json; (Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b).data.accessToken }
$tA = Tok 'admin@beirut.gov.lb' 'admin123'
$tS = Tok 'super@platform.local' 'superadmin123'
$hAw = @{ Authorization = "Bearer $tA"; 'X-Client-Platform' = 'web' }
$hSw = @{ Authorization = "Bearer $tS"; 'X-Client-Platform' = 'web' }

"-- roles --"
$r = Invoke-RestMethod -Uri "$BASE/roles" -Headers $hAw
$r.data | Select-Object -First 3 | Format-Table id,name

"-- platform/municipalities --"
$m = Invoke-RestMethod -Uri "$BASE/platform/municipalities" -Headers $hSw
$m.data | Select-Object -First 5 | Format-Table id,name

"-- complaints list (admin) --"
try {
    $c = Invoke-RestMethod -Uri "$BASE/complaints?limit=10" -Headers $hAw
    "complaints ok type=" + $c.data.GetType().Name
    if ($c.data -is [array]) { $c.data | Format-Table id,status }
    else { $c.data.items | Select-Object -First 5 | Format-Table id,status,@{n='owner';e={$_.createdBy.id}} }
} catch { "complaints error: $_" }
