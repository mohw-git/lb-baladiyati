$BASE = 'http://localhost:3000'
function Tok($e,$p){ $b=@{email=$e;password=$p}|ConvertTo-Json; (Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b).data.accessToken }

$tA = Tok 'admin@beirut.gov.lb' 'admin123'
$tC = Tok 'citizen@test.com' 'citizen123'
$tS = Tok 'super@platform.local' 'superadmin123'
$hA  = @{ Authorization = "Bearer $tA" }
$hAw = @{ Authorization = "Bearer $tA"; 'X-Client-Platform' = 'web' }
$hSw = @{ Authorization = "Bearer $tS"; 'X-Client-Platform' = 'web' }
$hCw = @{ Authorization = "Bearer $tC"; 'X-Client-Platform' = 'web' }

"--- /categories ---"
$catResp = Invoke-RestMethod -Uri "$BASE/categories" -Headers $hA
$catResp | ConvertTo-Json -Depth 3 | Select-Object -First 20

"--- /roles ---"
$roleResp = Invoke-RestMethod -Uri "$BASE/roles" -Headers $hAw
$roleResp | ConvertTo-Json -Depth 3 | Select-Object -First 20

"--- /platform/municipalities ---"
$muniResp = Invoke-RestMethod -Uri "$BASE/platform/municipalities" -Headers $hSw
$muniResp | ConvertTo-Json -Depth 3 | Select-Object -First 20

"--- /news ---"
$newsResp = Invoke-RestMethod -Uri "$BASE/news?limit=5" -Headers $hAw
$newsResp | ConvertTo-Json -Depth 3 | Select-Object -First 20

"--- POST /complaints (complaint creation attempt) ---"
$catId = ($catResp.data | Select-Object -First 1).id
"catId = $catId"
if ($catId) {
    $payload = @{
        title = 'IDOR Test Complaint'
        description = 'Automated security test'
        categoryId = $catId
        municipalityId = '8a5d6279-3269-46ae-9091-300aec463585'
        location = @{ type = 'Point'; coordinates = @(35.5018, 33.8938) }
    } | ConvertTo-Json -Depth 5
    try {
        $cr = Invoke-RestMethod -Uri "$BASE/complaints" -Method POST -ContentType 'application/json' -Headers @{Authorization="Bearer $tC"} -Body $payload
        "SUCCESS complaint id=$($cr.data.id)"
    } catch {
        $_.ErrorDetails.Message
    }
}
