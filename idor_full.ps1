$BASE = 'http://localhost:3000'
$ErrorActionPreference = 'Continue'

function Get-JWT($email, $pass) {
    $b = @{ email = $email; password = $pass } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b
    [PSCustomObject]@{
        email  = $email
        userId = $r.data.user.id
        muniId = $r.data.user.municipalityId
        token  = $r.data.accessToken
    }
}

function Call-API($method, $url, $token, [switch]$web, $payload = $null) {
    $headers = @{ Authorization = "Bearer $token" }
    if ($web) { $headers['X-Client-Platform'] = 'web' }
    try {
        $p = @{ Uri = "$BASE$url"; Method = $method; Headers = $headers; ErrorAction = 'Stop' }
        if ($payload) { $p.Body = ($payload | ConvertTo-Json -Depth 5); $p.ContentType = 'application/json' }
        $r = Invoke-RestMethod @p
        [PSCustomObject]@{ code = 200; ok = $true; data = $r.data; raw = $r }
    } catch {
        $code = [int]($_.Exception.Response.StatusCode)
        $msg  = ''
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $j = $reader.ReadToEnd() | ConvertFrom-Json
            $msg = if ($j.error.code) { $j.error.code } else { $j.message }
        } catch {}
        [PSCustomObject]@{ code = $code; ok = $false; data = $null; raw = $msg }
    }
}

$report = [System.Collections.Generic.List[PSCustomObject]]::new()

function Test-Access($label, $actor, $method, $url, $token, [switch]$web, $payload = $null, $expectBlocked = $false) {
    $r = Call-API $method $url $token -web:$web -payload $payload
    $issue = ($r.ok -and -not $expectBlocked) -or (-not $r.ok -and $expectBlocked -and $r.code -in 401,403)
    $status = if ($r.ok) {
        if ($expectBlocked) { '!!! IDOR FOUND !!!' } else { 'ALLOWED (expected)' }
    } else {
        switch ($r.code) {
            401 { 'BLOCKED 401 Unauthorized' }
            403 { 'BLOCKED 403 Forbidden' }
            404 { 'SAFE 404 Not Found' }
            400 { "SAFE/ERR 400 Bad Request: $($r.raw)" }
            default { "STATUS $($r.code): $($r.raw)" }
        }
    }
    $report.Add([PSCustomObject]@{
        Verdict = $status
        HTTP    = $r.code
        Actor   = $actor
        Method  = $method
        Endpoint = $url
        Note    = $label
    })
    $r
}

# ══════════════════════════════════════════════════════════════════
Write-Host '=== STEP 1: Login all 3 users ===' -ForegroundColor Cyan
$citizen = Get-JWT 'citizen@test.com'     'citizen123'
$admin   = Get-JWT 'admin@beirut.gov.lb'  'admin123'
$super   = Get-JWT 'super@platform.local' 'superadmin123'
$tC = $citizen.token; $tA = $admin.token; $tS = $super.token
Write-Host "citizen  $($citizen.userId)"
Write-Host "admin    $($admin.userId)"
Write-Host "super    $($super.userId)"
Write-Host "muni     $($admin.muniId)"

# ══════════════════════════════════════════════════════════════════
Write-Host "`n=== STEP 2: Harvest Real IDs ===" -ForegroundColor Cyan

# departments   → .data.data[]
$dRaw  = Call-API GET '/departments'               $tA -web
$depts = if ($dRaw.ok) { $dRaw.data.data } else { @() }

# categories    → .data[]  (flat array)
$cRaw  = Call-API GET '/categories'                $tA
$cats  = if ($cRaw.ok) { $cRaw.data }             else { @() }

# roles         → .data[]
$rRaw  = Call-API GET '/roles'                     $tA -web
$roles = if ($rRaw.ok) { $rRaw.data }             else { @() }

# users         → .data[]
$uRaw  = Call-API GET '/users?limit=30'            $tA -web
$users = if ($uRaw.ok) { $uRaw.data }             else { @() }

# news          → .data.items[]
$nRaw  = Call-API GET '/news?limit=10'             $tA -web
$news  = if ($nRaw.ok) { $nRaw.data.items }       else { @() }

# tasks         → .data.items[]
$tkRaw = Call-API GET '/tasks?limit=10'            $tA -web
$tasks = if ($tkRaw.ok) { $tkRaw.data.items }     else { @() }

# platform municipalities → .data[]
$mRaw  = Call-API GET '/platform/municipalities'   $tS -web
$munis = if ($mRaw.ok) { $mRaw.data }             else { @() }

# help-requests
$hrRaw = Call-API GET '/help-requests'             $tA -web
$hrs   = if ($hrRaw.ok) { $hrRaw.data.items }     else { @() }

# audit
$auRaw = Call-API GET '/audit'                     $tA -web
$audits= if ($auRaw.ok) { $auRaw.data.items }     else { @() }

# admin notifications
$noRaw  = Call-API GET '/notifications?limit=5'   $tA
$notifs = if ($noRaw.ok) { $noRaw.data.items }    else { @() }

Write-Host "depts: $($depts.Count)  cats: $($cats.Count)  roles: $($roles.Count)  users: $($users.Count)  news: $($news.Count)  tasks: $($tasks.Count)"
Write-Host "munis: $($munis.Count)  help-reqs: $($hrs.Count)  notifs: $($notifs.Count)"

# ── Pick IDs ──────────────────────────────────────────────────────
$dept1     = $depts | Select-Object -First 1
$dept2     = $depts | Select-Object -Skip 1 -First 1
$cat1      = $cats  | Select-Object -First 1
$role1     = $roles | Select-Object -First 1
$staffUser = $users | Where-Object { $_.id -ne $citizen.userId } | Select-Object -First 1
$news1     = $news  | Select-Object -First 1
$task1     = $tasks | Select-Object -First 1
$muni1     = $munis | Select-Object -First 1
$notif1    = $notifs| Select-Object -First 1
$hr1       = $hrs   | Select-Object -First 1

Write-Host "`ndept1  : $($dept1.id) '$($dept1.name)'"
Write-Host "cat1   : $($cat1.id) '$($cat1.name)'"
Write-Host "role1  : $($role1.id) '$($role1.name)'"
Write-Host "staff  : $($staffUser.id) '$($staffUser.email)'"
Write-Host "news1  : $($news1.id)"
Write-Host "task1  : $($task1.id)"
Write-Host "muni1  : $($muni1.id) '$($muni1.name)'"
Write-Host "notif1 : $($notif1.id)"

# ══════════════════════════════════════════════════════════════════
Write-Host "`n=== STEP 3: Create test complaints ===" -ForegroundColor Cyan

# Need categoryId. Use first cat.
$catId  = if ($cat1.id) { $cat1.id } else { 'unknown' }
$muniId = $admin.muniId

# Citizen creates a complaint
$compPayload = @{
    title       = 'IDOR_TEST_CITIZEN_COMPLAINT'
    description = 'Automated IDOR test complaint created by citizen'
    categoryId  = $catId
    municipalityId = $muniId
    location    = @{ type = 'Point'; coordinates = @(35.5018, 33.8938) }
}
$cComp = Call-API POST '/complaints' $tC -payload $compPayload
$citizenCompId = if ($cComp.ok) { $cComp.data.id } else { $null }
Write-Host "Citizen complaint: $citizenCompId  (status $($cComp.code) $($cComp.raw))"

# Admin creates a complaint (as staff)
$compPayload2 = @{
    title       = 'IDOR_TEST_ADMIN_COMPLAINT'
    description = 'Automated IDOR test complaint created by admin'
    categoryId  = $catId
    municipalityId = $muniId
    location    = @{ type = 'Point'; coordinates = @(35.5020, 33.8940) }
}
$aComp = Call-API POST '/complaints' $tA -web -payload $compPayload2
$adminCompId = if ($aComp.ok) { $aComp.data.id } else { $null }
Write-Host "Admin complaint  : $adminCompId  (status $($aComp.code) $($aComp.raw))"

# Also list existing complaints
$allComp = Call-API GET '/complaints?limit=20' $tA -web
$existComps = if ($allComp.ok) { $allComp.data.items } else { @() }
$firstComp = $existComps | Select-Object -First 1
if (-not $adminCompId) { $adminCompId = $firstComp.id }
if (-not $citizenCompId) { $citizenCompId = ($existComps | Where-Object { $_.createdBy.id -eq $citizen.userId } | Select-Object -First 1).id }
Write-Host "All complaints: $($existComps.Count)  using adminComp=$adminCompId  citizenComp=$citizenCompId"

# ══════════════════════════════════════════════════════════════════
Write-Host "`n=== STEP 4: IDOR Tests ===" -ForegroundColor Cyan

# ── A. USER resource ──────────────────────────────────────────────────────────
Write-Host "`n-- A. Users --"
if ($staffUser.id) {
    Test-Access 'Citizen reads STAFF user profile'     'CITIZEN' GET  "/users/$($staffUser.id)"  $tC -web -expectBlocked | Out-Null
    Test-Access 'Citizen reads ADMIN user profile'     'CITIZEN' GET  "/users/$($admin.userId)"  $tC -web -expectBlocked | Out-Null
    Test-Access 'Citizen writes/updates staff profile' 'CITIZEN' PATCH "/users/$($staffUser.id)" $tC -web -payload @{firstName='Hacked'} -expectBlocked | Out-Null
    Test-Access 'Citizen deletes staff user'           'CITIZEN' DELETE "/users/$($staffUser.id)" $tC -web -expectBlocked | Out-Null
}
Test-Access 'Citizen reads OWN profile (via users/:id)' 'CITIZEN' GET "/users/$($citizen.userId)" $tC -web | Out-Null
Test-Access 'Admin reads citizen profile (cross-role)'  'ADMIN'   GET "/users/$($citizen.userId)" $tA -web | Out-Null
Test-Access 'Super reads citizen profile'               'SUPER'   GET "/users/$($citizen.userId)" $tS -web | Out-Null

# ── B. COMPLAINT resource ─────────────────────────────────────────────────────
Write-Host "`n-- B. Complaints --"
if ($adminCompId) {
    Test-Access "Citizen reads ADMIN complaint ($adminCompId)"      'CITIZEN' GET    "/complaints/$adminCompId"         $tC -expectBlocked | Out-Null
    Test-Access 'Citizen changes status of admin complaint'         'CITIZEN' PATCH  "/complaints/$adminCompId/status" $tC -payload @{status='RESOLVED';reason='hack'} -expectBlocked | Out-Null
    Test-Access 'Citizen assigns admin complaint to self'           'CITIZEN' POST   "/complaints/$adminCompId/assign" $tC -payload @{userId=$citizen.userId} -expectBlocked | Out-Null
    Test-Access 'Citizen deletes admin complaint'                   'CITIZEN' DELETE "/complaints/$adminCompId"         $tC -expectBlocked | Out-Null
    Test-Access 'Citizen sets priority on admin complaint'          'CITIZEN' PATCH  "/complaints/$adminCompId/priority" $tC -payload @{priority='HIGH'} -expectBlocked | Out-Null
    Test-Access 'Admin reads complaint (expected OK)'               'ADMIN'   GET    "/complaints/$adminCompId"         $tA -web | Out-Null
}
if ($citizenCompId) {
    Test-Access "Citizen reads OWN complaint ($citizenCompId)"      'CITIZEN' GET "/complaints/$citizenCompId" $tC | Out-Null
    Test-Access 'Admin reads citizen complaint (expected OK)'       'ADMIN'   GET "/complaints/$citizenCompId" $tA -web | Out-Null
    Test-Access 'Super reads citizen complaint (no muni — expect 404/403)' 'SUPER' GET "/complaints/$citizenCompId" $tS -expectBlocked | Out-Null
    Test-Access 'Citizen deletes OWN complaint'                     'CITIZEN' DELETE "/complaints/$citizenCompId" $tC -expectBlocked | Out-Null
}

# ── C. DEPARTMENT resource ────────────────────────────────────────────────────
Write-Host "`n-- C. Departments --"
if ($dept1.id) {
    Test-Access 'Citizen reads department info'             'CITIZEN' GET    "/departments/$($dept1.id)"            $tC -web -expectBlocked | Out-Null
    Test-Access 'Citizen reads department members'         'CITIZEN' GET    "/departments/$($dept1.id)/members"    $tC -web -expectBlocked | Out-Null
    Test-Access 'Citizen renames department'               'CITIZEN' PATCH  "/departments/$($dept1.id)"            $tC -web -payload @{name='Hacked Dept'} -expectBlocked | Out-Null
    Test-Access 'Citizen deletes department'               'CITIZEN' DELETE "/departments/$($dept1.id)"            $tC -web -expectBlocked | Out-Null
}
if ($dept2.id) {
    Test-Access 'Admin reads dept2 (same muni, expected OK)'  'ADMIN' GET "/departments/$($dept2.id)" $tA -web | Out-Null
}

# ── D. ROLE resource ──────────────────────────────────────────────────────────
Write-Host "`n-- D. Roles --"
if ($role1.id) {
    Test-Access 'Citizen reads role details'               'CITIZEN' GET    "/roles/$($role1.id)"             $tC -web -expectBlocked | Out-Null
    Test-Access 'Citizen renames role'                     'CITIZEN' PATCH  "/roles/$($role1.id)"             $tC -web -payload @{name='HackedRole'} -expectBlocked | Out-Null
    Test-Access 'Citizen sets role permissions'            'CITIZEN' POST   "/roles/$($role1.id)/permissions" $tC -web -payload @{permissions=@('complaint:view')} -expectBlocked | Out-Null
    Test-Access 'Citizen deletes role'                     'CITIZEN' DELETE "/roles/$($role1.id)"             $tC -web -expectBlocked | Out-Null
}

# ── E. NEWS resource ──────────────────────────────────────────────────────────
Write-Host "`n-- E. News --"
if ($news1.id) {
    Test-Access 'Citizen reads news article (public?)'     'CITIZEN' GET    "/news/$($news1.id)"  $tC -web | Out-Null
    Test-Access 'Citizen edits news article'               'CITIZEN' PATCH  "/news/$($news1.id)"  $tC -web -payload @{title='Hacked News'} -expectBlocked | Out-Null
    Test-Access 'Citizen deletes news article'             'CITIZEN' DELETE "/news/$($news1.id)"  $tC -web -expectBlocked | Out-Null
}

# ── F. TASK resource ──────────────────────────────────────────────────────────
Write-Host "`n-- F. Tasks --"
if ($task1.id) {
    Test-Access 'Citizen reads task'                       'CITIZEN' GET    "/tasks/$($task1.id)"  $tC -web -expectBlocked | Out-Null
    Test-Access 'Citizen edits task'                       'CITIZEN' PATCH  "/tasks/$($task1.id)"  $tC -web -payload @{title='Hacked'} -expectBlocked | Out-Null
    Test-Access 'Citizen deletes task'                     'CITIZEN' DELETE "/tasks/$($task1.id)"  $tC -web -expectBlocked | Out-Null
}

# ── G. NOTIFICATION IDOR ──────────────────────────────────────────────────────
Write-Host "`n-- G. Notifications --"
if ($notif1.id) {
    Test-Access "Citizen reads ADMIN notification ($($notif1.id))" 'CITIZEN' GET   "/notifications/$($notif1.id)"      $tC -expectBlocked | Out-Null
    Test-Access "Citizen marks ADMIN notification read"            'CITIZEN' PATCH "/notifications/$($notif1.id)/read" $tC -expectBlocked | Out-Null
}
# Try to get citizen notifications with admin token
Test-Access "Admin reads CITIZEN notification list (different user)"  'ADMIN' GET '/notifications' $tA | Out-Null

# ── H. CATEGORY IDOR ─────────────────────────────────────────────────────────
Write-Host "`n-- H. Categories --"
if ($cat1.id) {
    Test-Access 'Citizen reads category (public?)'         'CITIZEN' GET    "/categories/$($cat1.id)"  $tC | Out-Null
    Test-Access 'Citizen edits category'                   'CITIZEN' PATCH  "/categories/$($cat1.id)"  $tC -payload @{name='Hacked Cat'} -expectBlocked | Out-Null
    Test-Access 'Citizen deletes category'                 'CITIZEN' DELETE "/categories/$($cat1.id)"  $tC -expectBlocked | Out-Null
}

# ── I. MUNICIPALITY IDOR ─────────────────────────────────────────────────────
Write-Host "`n-- I. Municipalities --"
Test-Access 'Citizen reads own municipality (public info)' 'CITIZEN' GET   "/municipalities/$muniId"            $tC | Out-Null
Test-Access 'Citizen updates municipality branding'        'CITIZEN' PATCH "/municipalities/$muniId/branding"   $tC -payload @{primaryColor='#ff0000'} -expectBlocked | Out-Null

# ── J. PLATFORM (super-only) endpoints ───────────────────────────────────────
Write-Host "`n-- J. Platform (Super-admin only) --"
Test-Access 'CITIZEN tries /platform/municipalities'       'CITIZEN' GET '/platform/municipalities'         $tC -web -expectBlocked | Out-Null
Test-Access 'ADMIN   tries /platform/municipalities'       'ADMIN'   GET '/platform/municipalities'         $tA -web -expectBlocked | Out-Null
Test-Access 'SUPER   access /platform/municipalities'      'SUPER'   GET '/platform/municipalities'         $tS -web | Out-Null
Test-Access 'CITIZEN tries /platform/users'                'CITIZEN' GET '/platform/users'                  $tC -web -expectBlocked | Out-Null
Test-Access 'ADMIN   tries /platform/users'                'ADMIN'   GET '/platform/users'                  $tA -web -expectBlocked | Out-Null
if ($muni1.id) {
    Test-Access 'CITIZEN tries delete municipality'        'CITIZEN' DELETE "/platform/municipalities/$($muni1.id)" $tC -web -expectBlocked | Out-Null
    Test-Access 'ADMIN   tries delete municipality'        'ADMIN'   DELETE "/platform/municipalities/$($muni1.id)" $tA -web -expectBlocked | Out-Null
}

# ── K. AUDIT (staff-only) ────────────────────────────────────────────────────
Write-Host "`n-- K. Audit --"
Test-Access 'CITIZEN tries /audit'                         'CITIZEN' GET '/audit'  $tC -web -expectBlocked | Out-Null
Test-Access 'ADMIN   reads /audit (expected OK)'           'ADMIN'   GET '/audit'  $tA -web | Out-Null
Test-Access 'SUPER   tries /audit (no municipality)'       'SUPER'   GET '/audit'  $tS -web -expectBlocked | Out-Null

# ── L. AUTH/PROFILE IDOR ─────────────────────────────────────────────────────
Write-Host "`n-- L. Auth / Profile --"
Test-Access 'Citizen reads own /auth/me'                   'CITIZEN' GET '/auth/me' $tC | Out-Null
# Try to bypass /auth/me by injecting another userId via profile update
Test-Access 'Citizen updates OWN profile'                  'CITIZEN' PATCH '/auth/profile' $tC -payload @{firstName='Test2'} | Out-Null

# ══════════════════════════════════════════════════════════════════
# FINAL REPORT
Write-Host "`n"
Write-Host ('=' * 120) -ForegroundColor Cyan
Write-Host ' IDOR SECURITY TEST REPORT' -ForegroundColor Cyan
Write-Host ('=' * 120) -ForegroundColor Cyan

$idors      = $report | Where-Object { $_.Verdict -like '*IDOR*' }
$blocked    = $report | Where-Object { $_.Verdict -like '*BLOCKED*' }
$safe404    = $report | Where-Object { $_.Verdict -like '*404*' }
$allowed    = $report | Where-Object { $_.Verdict -like '*expected*' }
$unexpected = $report | Where-Object { $_.Verdict -notlike '*IDOR*' -and $_.Verdict -notlike '*BLOCKED*' -and $_.Verdict -notlike '*404*' -and $_.Verdict -notlike '*expected*' }

Write-Host ""
Write-Host ("SUMMARY  " + ('-'*60)) -ForegroundColor Yellow
Write-Host "  Total tests run        : $($report.Count)"
Write-Host "  !!! IDOR FOUND !!!     : $($idors.Count)"     -ForegroundColor $(if($idors.Count -gt 0){'Red'}else{'Green'})
Write-Host "  Properly BLOCKED       : $($blocked.Count)"   -ForegroundColor Green
Write-Host "  NOT FOUND (safe)       : $($safe404.Count)"
Write-Host "  ALLOWED (by design)    : $($allowed.Count)"
Write-Host "  Unexpected / skipped   : $($unexpected.Count)" -ForegroundColor $(if($unexpected.Count -gt 0){'Yellow'}else{'White'})

Write-Host ""
Write-Host ("ALL RESULTS  " + ('-'*55)) -ForegroundColor Yellow
$report | Format-Table -AutoSize -Property Verdict,HTTP,Actor,Method,Endpoint

if ($idors.Count -gt 0) {
    Write-Host ('=' * 120) -ForegroundColor Red
    Write-Host '  !!! IDOR VULNERABILITIES FOUND !!!' -ForegroundColor Red
    Write-Host ('=' * 120) -ForegroundColor Red
    $idors | Format-List
} else {
    Write-Host ('=' * 120) -ForegroundColor Green
    Write-Host '  No IDOR vulnerabilities found in tested endpoints.' -ForegroundColor Green
    Write-Host ('=' * 120) -ForegroundColor Green
}
