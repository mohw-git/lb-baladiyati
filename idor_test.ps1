$ErrorActionPreference = 'Continue'
$BASE = 'http://localhost:3000'

# ─── Login ────────────────────────────────────────────────────────────────────
function Get-Token($email, $pass) {
    $b = @{ email = $email; password = $pass } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b
    [PSCustomObject]@{
        email          = $email
        userId         = $r.data.user.id
        municipalityId = $r.data.user.municipalityId
        token          = $r.data.accessToken
    }
}

# ─── Request wrapper ──────────────────────────────────────────────────────────
function Invoke-Api($method, $url, $tok, [switch]$web, $bodyObj = $null) {
    $headers = @{ Authorization = "Bearer $tok" }
    if ($web) { $headers['X-Client-Platform'] = 'web' }
    try {
        $params = @{ Uri = "$BASE$url"; Method = $method; Headers = $headers; ErrorAction = 'Stop' }
        if ($bodyObj) { $params.Body = ($bodyObj | ConvertTo-Json); $params.ContentType = 'application/json' }
        $r = Invoke-RestMethod @params
        [PSCustomObject]@{ status = 200; ok = $true; data = $r.data }
    } catch {
        $code = [int]($_.Exception.Response.StatusCode)
        $msg  = ''
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $j = $reader.ReadToEnd() | ConvertFrom-Json
            $msg = "$($j.error.code): $($j.error.message)"
        } catch {}
        [PSCustomObject]@{ status = $code; ok = $false; data = $msg }
    }
}

# ─── IDOR result row ──────────────────────────────────────────────────────────
$results = [System.Collections.Generic.List[PSCustomObject]]::new()
function Test-IDOR($desc, $method, $url, $tok, [switch]$web, $body = $null) {
    $r = Invoke-Api $method $url $tok -web:$web -bodyObj $body
    $verdict = if ($r.ok) { '!!! IDOR FOUND !!!' } `
               elseif ($r.status -in 401,403) { 'BLOCKED (secure)' } `
               elseif ($r.status -eq 404)     { 'NOT FOUND (safe)' } `
               else                            { "UNEXPECTED $($r.status)" }
    $results.Add([PSCustomObject]@{
        Verdict = $verdict
        HTTP    = $r.status
        Actor   = ($desc -split ' -> ')[0].Trim()
        Test    = ($desc -split ' -> ')[-1].Trim()
        Detail  = if ($r.ok) { 'ACCESS GRANTED - check if data belongs to another user' } else { $r.data }
    })
}

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "=== Logging in ===" -ForegroundColor Cyan
$citizen = Get-Token 'citizen@test.com'     'citizen123'
$admin   = Get-Token 'admin@beirut.gov.lb'  'admin123'
$super   = Get-Token 'super@platform.local' 'superadmin123'
$tC = $citizen.token; $tA = $admin.token; $tS = $super.token
Write-Host "citizen : $($citizen.userId)"
Write-Host "admin   : $($admin.userId)"
Write-Host "super   : $($super.userId)"

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n=== Harvesting Real IDs ===" -ForegroundColor Cyan

$compList  = Invoke-Api GET '/complaints?limit=30'  $tA -web
$userList  = Invoke-Api GET '/users?limit=30'        $tA -web
$deptList  = Invoke-Api GET '/departments'           $tA -web
$catList   = Invoke-Api GET '/categories'            $tA
$roleList  = Invoke-Api GET '/roles'                 $tA -web
$newsList  = Invoke-Api GET '/news?limit=10'         $tA -web
$taskList  = Invoke-Api GET '/tasks?limit=10'        $tA -web
$notifList = Invoke-Api GET '/notifications?limit=5' $tA
$platList  = Invoke-Api GET '/platform/municipalities' $tS -web

$complaints = if ($compList.ok)  { $compList.data.items  } else { @() }
$users      = if ($userList.ok)  { $userList.data        } else { @() }
$depts      = if ($deptList.ok)  { $deptList.data        } else { @() }
$cats       = if ($catList.ok)   { $catList.data         } else { @() }
$roles      = if ($roleList.ok)  { $roleList.data        } else { @() }
$newsItems  = if ($newsList.ok)  { $newsList.data.items  } else { @() }
$tasks      = if ($taskList.ok)  { $taskList.data.items  } else { @() }
$notifs     = if ($notifList.ok) { $notifList.data.items } else { @() }
$munis      = if ($platList.ok)  { $platList.data        } else { @() }

# First complaint citizen created; first owned by staff
$myComplaint    = $complaints | Where-Object { $_.createdBy.id -eq $citizen.userId } | Select-Object -First 1
$staffComplaint = $complaints | Where-Object { $_.createdBy.id -ne $citizen.userId } | Select-Object -First 1
$anyComplaint   = $complaints | Select-Object -First 1
$staffUser      = $users | Where-Object { $_.id -ne $citizen.userId -and $_.id -ne $admin.userId } | Select-Object -First 1
$dept1    = $depts | Select-Object -First 1
$dept2    = $depts | Select-Object -Skip 1 -First 1
$cat1     = $cats  | Select-Object -First 1
$role1    = $roles | Select-Object -First 1
$news1    = $newsItems | Select-Object -First 1
$task1    = $tasks | Select-Object -First 1
$notif1   = $notifs | Select-Object -First 1
$muni1    = $munis | Select-Object -First 1

Write-Host "complaints collected : $($complaints.Count)"
Write-Host "users collected      : $($users.Count)"
Write-Host "depts                : $($depts.Count)"
Write-Host "roles                : $($roles.Count)"
Write-Host "news                 : $($newsItems.Count)"
Write-Host "tasks                : $($tasks.Count)"
Write-Host "notifs (admin)       : $($notifs.Count)"
Write-Host "munis (super)        : $($munis.Count)"
Write-Host ""
Write-Host "staffComplaint id    : $($staffComplaint.id) ref=$($staffComplaint.referenceCode)"
Write-Host "myComplaint id       : $($myComplaint.id)"
Write-Host "staffUser id         : $($staffUser.id) email=$($staffUser.email)"
Write-Host "dept1 id             : $($dept1.id) name=$($dept1.name)"
Write-Host "role1 id             : $($role1.id) name=$($role1.name)"
Write-Host "news1 id             : $($news1.id)"
Write-Host "task1 id             : $($task1.id)"
Write-Host "notif1 id            : $($notif1.id)"
Write-Host "muni1 id             : $($muni1.id)"

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n=== Running IDOR Tests ===" -ForegroundColor Cyan

# ── 1. USER resource IDOR ─────────────────────────────────────────────────────
if ($staffUser.id) {
    Test-IDOR 'CITIZEN -> GET /users/{staff_user}'             GET "/users/$($staffUser.id)"  $tC -web
    Test-IDOR 'CITIZEN -> GET /users/{admin}'                  GET "/users/$($admin.userId)"  $tC -web
}
Test-IDOR     'CITIZEN -> GET /users/{self}'                   GET "/users/$($citizen.userId)" $tC -web
if ($staffUser.id) {
    # Citizen tries to UPDATE another user
    Test-IDOR 'CITIZEN -> PATCH /users/{staff} (update name)' PATCH "/users/$($staffUser.id)" $tC -web -body @{firstName='Hacked'}
    # Admin reads citizen user (same muni — expected to succeed, just verifying)
    Test-IDOR 'ADMIN   -> GET /users/{citizen}'                GET "/users/$($citizen.userId)" $tA -web
}

# ── 2. COMPLAINT resource IDOR ───────────────────────────────────────────────
if ($staffComplaint.id) {
    Test-IDOR 'CITIZEN -> GET /complaints/{staff_complaint}'    GET  "/complaints/$($staffComplaint.id)"  $tC
    Test-IDOR 'CITIZEN -> PATCH /complaints/{staff}/status'    PATCH "/complaints/$($staffComplaint.id)/status"  $tC -body @{status='RESOLVED';reason='test'}
    Test-IDOR 'CITIZEN -> DELETE /complaints/{staff}'          DELETE "/complaints/$($staffComplaint.id)" $tC
    Test-IDOR 'CITIZEN -> POST /complaints/{staff}/assign'     POST   "/complaints/$($staffComplaint.id)/assign" $tC -body @{userId=$admin.userId}
}
if ($myComplaint.id) {
    Test-IDOR 'ADMIN   -> PATCH /complaints/{citizen_own}/status' PATCH "/complaints/$($myComplaint.id)/status" $tA -body @{status='RESOLVED';reason='test'}
}
if ($anyComplaint.id) {
    # Super admin accessing complaint with no municipality
    Test-IDOR 'SUPER   -> GET /complaints/{any}'               GET "/complaints/$($anyComplaint.id)" $tS
}

# ── 3. DEPARTMENT IDOR ───────────────────────────────────────────────────────
if ($dept1.id) {
    Test-IDOR 'CITIZEN -> GET /departments/{dept}'             GET    "/departments/$($dept1.id)" $tC -web
    Test-IDOR 'CITIZEN -> PATCH /departments/{dept}'           PATCH  "/departments/$($dept1.id)" $tC -web -body @{name='Hacked Dept'}
    Test-IDOR 'CITIZEN -> DELETE /departments/{dept}'          DELETE "/departments/$($dept1.id)" $tC -web
}
if ($dept2.id) {
    Test-IDOR 'CITIZEN -> GET /departments/{dept2}/members'    GET "/departments/$($dept2.id)/members" $tC -web
}

# ── 4. ROLE IDOR ─────────────────────────────────────────────────────────────
if ($role1.id) {
    Test-IDOR 'CITIZEN -> GET /roles/{role}'                   GET    "/roles/$($role1.id)" $tC -web
    Test-IDOR 'CITIZEN -> PATCH /roles/{role}'                 PATCH  "/roles/$($role1.id)" $tC -web -body @{name='HackedRole'}
    Test-IDOR 'CITIZEN -> DELETE /roles/{role}'                DELETE "/roles/$($role1.id)" $tC -web
}

# ── 5. NEWS IDOR ─────────────────────────────────────────────────────────────
if ($news1.id) {
    Test-IDOR 'CITIZEN -> GET /news/{news}'                    GET    "/news/$($news1.id)"    $tC -web
    Test-IDOR 'CITIZEN -> PATCH /news/{news}'                  PATCH  "/news/$($news1.id)"    $tC -web -body @{title='Hacked'}
    Test-IDOR 'CITIZEN -> DELETE /news/{news}'                 DELETE "/news/$($news1.id)"    $tC -web
}

# ── 6. TASK IDOR ─────────────────────────────────────────────────────────────
if ($task1.id) {
    Test-IDOR 'CITIZEN -> GET /tasks/{task}'                   GET    "/tasks/$($task1.id)"   $tC -web
    Test-IDOR 'CITIZEN -> PATCH /tasks/{task}'                 PATCH  "/tasks/$($task1.id)"   $tC -web -body @{title='Hacked'}
    Test-IDOR 'CITIZEN -> DELETE /tasks/{task}'                DELETE "/tasks/$($task1.id)"   $tC -web
}

# ── 7. NOTIFICATION IDOR ─────────────────────────────────────────────────────
if ($notif1.id) {
    # Citizen tries to read/mark-read admin's notification
    Test-IDOR 'CITIZEN -> GET /notifications/{adminNotif}'          GET   "/notifications/$($notif1.id)"            $tC
    Test-IDOR 'CITIZEN -> PATCH /notifications/{adminNotif}/read'   PATCH "/notifications/$($notif1.id)/read"       $tC
}

# ── 8. CATEGORY IDOR ─────────────────────────────────────────────────────────
if ($cat1.id) {
    Test-IDOR 'CITIZEN -> GET /categories/{cat}'               GET    "/categories/$($cat1.id)" $tC
    Test-IDOR 'CITIZEN -> PATCH /categories/{cat}'             PATCH  "/categories/$($cat1.id)" $tC -body @{name='Hacked'}
    Test-IDOR 'CITIZEN -> DELETE /categories/{cat}'            DELETE "/categories/$($cat1.id)" $tC
}

# ── 9. MUNICIPALITY PUBLIC IDOR ──────────────────────────────────────────────
$muniId = $admin.municipalityId
Test-IDOR 'CITIZEN -> GET /municipalities/{muniId}'            GET  "/municipalities/$muniId" $tC
Test-IDOR 'CITIZEN -> PATCH /municipalities/{muniId}/branding' PATCH "/municipalities/$muniId/branding" $tC -body @{primaryColor='red'}

# ── 10. PLATFORM (super-admin only) IDOR ─────────────────────────────────────
Test-IDOR 'CITIZEN -> GET /platform/municipalities'            GET  '/platform/municipalities'          $tC -web
Test-IDOR 'ADMIN   -> GET /platform/municipalities'            GET  '/platform/municipalities'          $tA -web
Test-IDOR 'CITIZEN -> GET /platform/users'                     GET  '/platform/users'                   $tC -web
Test-IDOR 'ADMIN   -> GET /platform/users'                     GET  '/platform/users'                   $tA -web
if ($muni1.id) {
    Test-IDOR 'CITIZEN -> DELETE /platform/municipalities/{id}' DELETE "/platform/municipalities/$($muni1.id)" $tC -web
    Test-IDOR 'ADMIN   -> DELETE /platform/municipalities/{id}' DELETE "/platform/municipalities/$($muni1.id)" $tA -web
}

# ── 11. AUDIT LOG IDOR ───────────────────────────────────────────────────────
Test-IDOR 'CITIZEN -> GET /audit'                              GET '/audit'       $tC -web
Test-IDOR 'SUPER   -> GET /audit (no muni)'                   GET '/audit'       $tS -web

# ── 12. CROSS-MUNICIPALITY IDOR (citizen vs staff same muni) ─────────────────
# Register a second citizen in same municipality and test complaint isolation
# (skip if no complaint IDs to test)

# ─── Print report ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host ("=" * 110) -ForegroundColor Cyan
Write-Host " IDOR TEST REPORT" -ForegroundColor Cyan
Write-Host ("=" * 110) -ForegroundColor Cyan
$results | Sort-Object Verdict -Descending | Format-Table -AutoSize -Wrap

$found    = $results | Where-Object { $_.Verdict -like '*IDOR*' }
$blocked  = $results | Where-Object { $_.Verdict -like '*BLOCKED*' }
$notfound = $results | Where-Object { $_.Verdict -like '*NOT FOUND*' }
$unexpected = $results | Where-Object { $_.Verdict -like '*UNEXPECTED*' }

Write-Host ""
Write-Host "SUMMARY" -ForegroundColor Yellow
Write-Host "  !!! IDOR FOUND !!!  : $($found.Count)" -ForegroundColor $(if($found.Count -gt 0){'Red'}else{'Green'})
Write-Host "  BLOCKED (secure)    : $($blocked.Count)"  -ForegroundColor Green
Write-Host "  NOT FOUND (safe)    : $($notfound.Count)"
Write-Host "  UNEXPECTED          : $($unexpected.Count)" -ForegroundColor $(if($unexpected.Count -gt 0){'Yellow'}else{'White'})
Write-Host ""
if ($found.Count -gt 0) {
    Write-Host "=== IDOR VULNERABILITIES DETAIL ===" -ForegroundColor Red
    $found | Format-List
}
