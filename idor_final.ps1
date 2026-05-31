$BASE    = 'http://localhost:3000'
$MUNI_ID = '8a5d6279-3269-46ae-9091-300aec463585'  # Beirut Municipality

# ─── Hard-coded real IDs (verified from DB) ───────────────────────────────────
$ID = @{
    citizen      = '55988792-009b-4540-9719-930ee29a4eec'
    admin        = '790e85b5-e416-4333-bbca-48079e0d0721'
    super        = '2bb8942b-2783-486b-9580-bf6571b41cd6'
    staffUser    = 'c53a79ee-11ef-4e32-a42a-650d0b60dcf6'   # assigner@beirut.gov.lb
    dept1        = 'a7b6beb1-a7e4-4c99-bb8d-563fc48423de'   # Parks & Recreation
    dept2        = '067da1b0-802d-4da3-888a-1bbcbbfe0988'   # Public Safety
    cat1         = '2ed4df48-dc86-4dad-88b3-aa62eee33a38'   # Drainage Problems
    existComp    = 'e0bf95d2-7a69-42a7-8264-fbdf6ae7f523'   # SUBMITTED complaint
}

# ─── Login ────────────────────────────────────────────────────────────────────
function Get-JWT($email, $pass) {
    $b = @{ email = $email; password = $pass } | ConvertTo-Json
    (Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType 'application/json' -Body $b).data.accessToken
}
$tC = Get-JWT 'citizen@test.com'     'citizen123'
$tA = Get-JWT 'admin@beirut.gov.lb'  'admin123'
$tS = Get-JWT 'super@platform.local' 'superadmin123'

# Second staff account for same-municipality cross-user test
$tA2 = Get-JWT 'worker1.roads@beirut.gov.lb' 'worker123'

Write-Host "=== Tokens refreshed ===" -ForegroundColor Cyan

# ─── Request wrapper ──────────────────────────────────────────────────────────
function Req($method, $url, $tok, $isWeb = $false, $payload = $null) {
    $headers = @{ Authorization = "Bearer $tok" }
    if ($isWeb) { $headers['X-Client-Platform'] = 'web' }
    try {
        $p = @{ Uri = "$BASE$url"; Method = $method; Headers = $headers; ErrorAction = 'Stop' }
        if ($payload) { $p.Body = ($payload | ConvertTo-Json -Depth 6); $p.ContentType = 'application/json' }
        $r = Invoke-RestMethod @p
        return [PSCustomObject]@{ code = 200; ok = $true; body = $r }
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
        $msg = ''
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $json   = $reader.ReadToEnd() | ConvertFrom-Json
            $msg    = if ($json.error.code) { "$($json.error.code): $($json.error.message)" } else { $json.message }
        } catch {}
        return [PSCustomObject]@{ code = $code; ok = $false; body = $msg }
    }
}

# ─── Result collector ─────────────────────────────────────────────────────────
$results = [System.Collections.Generic.List[PSCustomObject]]::new()
function Check($section, $desc, $actor, $method, $url, $tok, $isWeb = $false, $payload = $null, $shouldBlock = $true) {
    $r = Req $method $url $tok $isWeb $payload
    if ($shouldBlock) {
        $verdict = if (-not $r.ok -and $r.code -in 401, 403)   { 'SECURE  (blocked)'  }
                   elseif (-not $r.ok -and $r.code -eq 404)     { 'SAFE    (404)'       }
                   elseif ($r.ok)                                { '!!! IDOR FOUND !!!' }
                   else                                          { "UNEXPECTED $($r.code)" }
    } else {
        $verdict = if ($r.ok)     { 'OK (expected access)' }
                   else           { "UNEXPECTED DENY $($r.code): $($r.body)" }
    }
    $results.Add([PSCustomObject]@{
        Section  = $section
        Verdict  = $verdict
        HTTP     = $r.code
        Actor    = $actor
        Method   = $method
        Resource = $url
        Detail   = if (-not $r.ok) { $r.body } else { '' }
    })
}

# ═══════════════════════════════════════════════════════════════════════
# Create test complaints for richer testing
# ═══════════════════════════════════════════════════════════════════════
Write-Host "=== Creating test data ===" -ForegroundColor Cyan
$newCompPayload = @{ categoryId=$ID.cat1; title='IDOR Test - Drainage on Test St'; description='This is a test complaint for IDOR security testing automated run'; latitude=33.8938; longitude=35.5018 }

$cc = Req POST '/complaints' $tC $false $newCompPayload
$citizenCompId = if ($cc.ok) { $cc.body.data.id } else { $null }
Write-Host "Citizen created complaint : $citizenCompId  ($($cc.code) $($cc.body))"

$ac = Req POST '/complaints' $tA $true $newCompPayload
$adminCompId = if ($ac.ok) { $ac.body.data.id } else { $ID.existComp }  # fallback to known
Write-Host "Admin created complaint  : $adminCompId  ($($ac.code))"

# Also get a staff-created complaint via list
$compList = Req GET '/complaints?limit=20' $tA $true
$staffComps = if ($compList.ok) {
    $compList.body.data | Where-Object { $_.createdBy.id -ne $ID.citizen }
} else { @() }
$staffCompId = if ($adminCompId) { $adminCompId } `
               elseif ($staffComps.Count -gt 0) { $staffComps[0].id } `
               else { $ID.existComp }
Write-Host "Staff complaint for tests: $staffCompId"

# ═══════════════════════════════════════════════════════════════════════
# A. USER IDOR
# ═══════════════════════════════════════════════════════════════════════
Write-Host "`n[A] User IDOR" -ForegroundColor Yellow

# Citizen has no permission on /users — expects 403
Check 'A' 'Citizen reads own profile via /users/:id'     'CITIZEN'  GET   "/users/$($ID.citizen)"       $tC $true $null $true
Check 'A' 'Citizen reads STAFF user profile'             'CITIZEN'  GET   "/users/$($ID.staffUser)"     $tC $true $null $true
Check 'A' 'Citizen reads ADMIN profile'                  'CITIZEN'  GET   "/users/$($ID.admin)"         $tC $true $null $true
Check 'A' 'Citizen updates STAFF user (name change)'     'CITIZEN'  PATCH "/users/$($ID.staffUser)"     $tC $true @{firstName='Hacked'} $true
Check 'A' 'Citizen deletes STAFF user'                   'CITIZEN'  DELETE "/users/$($ID.staffUser)"    $tC $true $null $true
Check 'A' 'Citizen assigns role to staff user'           'CITIZEN'  POST  "/users/$($ID.staffUser)/roles" $tC $true @{roleId='fake'} $true

# Admin reads citizen — same municipality, should be allowed
Check 'A' 'Admin reads CITIZEN profile (same muni)'      'ADMIN'    GET   "/users/$($ID.citizen)"       $tA $true $null $false
# Admin reads own profile
Check 'A' 'Admin reads OWN profile via /users/:id'       'ADMIN'    GET   "/users/$($ID.admin)"         $tA $true $null $false

# Worker reads another user — should be blocked (no user:manage perm)
Check 'A' 'WORKER reads ADMIN profile (no perm)'         'WORKER'   GET   "/users/$($ID.admin)"         $tA2 $true $null $true

# Super admin has no municipality → /users returns 404 (different tenant isolation)
Check 'A' 'Super reads citizen via /users/:id (no muni)' 'SUPER'    GET   "/users/$($ID.citizen)"       $tS $true $null $true

# ═══════════════════════════════════════════════════════════════════════
# B. COMPLAINT IDOR
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[B] Complaint IDOR" -ForegroundColor Yellow

if ($staffCompId) {
    Check 'B' 'Citizen reads a STAFF-owned complaint'         'CITIZEN' GET    "/complaints/$staffCompId"            $tC $false $null $true
    Check 'B' 'Citizen changes status of STAFF complaint'     'CITIZEN' PATCH  "/complaints/$staffCompId/status"     $tC $false @{status='RESOLVED';reason='idor'} $true
    Check 'B' 'Citizen sets priority on STAFF complaint'      'CITIZEN' PATCH  "/complaints/$staffCompId/priority"   $tC $false @{priority='HIGH'} $true
    Check 'B' 'Citizen assigns STAFF complaint to self'       'CITIZEN' POST   "/complaints/$staffCompId/assign"     $tC $false @{userId=$ID.citizen} $true
    Check 'B' 'Citizen deletes STAFF complaint'               'CITIZEN' DELETE "/complaints/$staffCompId"            $tC $false $null $true
    Check 'B' 'Worker reads staff complaint (same muni)'      'WORKER'  GET    "/complaints/$staffCompId"            $tA2 $true $null $false
    Check 'B' 'Admin reads staff complaint (expected OK)'     'ADMIN'   GET    "/complaints/$staffCompId"            $tA $true $null $false
}
if ($citizenCompId) {
    Check 'B' 'Citizen reads OWN complaint'                   'CITIZEN' GET    "/complaints/$citizenCompId"          $tC $false $null $false
    Check 'B' 'Citizen deletes OWN complaint'                 'CITIZEN' DELETE "/complaints/$citizenCompId"          $tC $false $null $true
    Check 'B' 'Admin reads CITIZEN complaint'                 'ADMIN'   GET    "/complaints/$citizenCompId"          $tA $true $null $false
    Check 'B' 'Super reads citizen complaint (no muni)'       'SUPER'   GET    "/complaints/$citizenCompId"          $tS $false $null $true
}

# ═══════════════════════════════════════════════════════════════════════
# C. DEPARTMENT IDOR
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[C] Department IDOR" -ForegroundColor Yellow
Check 'C' 'Citizen reads department info'              'CITIZEN' GET    "/departments/$($ID.dept1)"         $tC $true $null $true
Check 'C' 'Citizen reads dept members'                 'CITIZEN' GET    "/departments/$($ID.dept1)/members" $tC $true $null $true
Check 'C' 'Citizen renames department'                 'CITIZEN' PATCH  "/departments/$($ID.dept1)"         $tC $true @{name='HackedDept'} $true
Check 'C' 'Citizen deletes department'                 'CITIZEN' DELETE "/departments/$($ID.dept1)"         $tC $true $null $true
Check 'C' 'Admin reads dept1 (expected OK)'            'ADMIN'   GET    "/departments/$($ID.dept1)"         $tA $true $null $false
Check 'C' 'Admin reads dept2 members (expected OK)'    'ADMIN'   GET    "/departments/$($ID.dept2)/members" $tA $true $null $false
Check 'C' 'Super reads dept (different tenant)'        'SUPER'   GET    "/departments/$($ID.dept1)"         $tS $true $null $true

# ═══════════════════════════════════════════════════════════════════════
# D. ROLE IDOR
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[D] Role IDOR" -ForegroundColor Yellow

# Fetch a real role id
$roleList = Req GET '/roles' $tA $true
$roleId = if ($roleList.ok -and $roleList.body.data.Count -gt 0) { $roleList.body.data[0].id }
          elseif ($roleList.ok -and $roleList.body.data.data) { $roleList.body.data.data[0].id }
          else { $null }
Write-Host "  roleId = $roleId"

if ($roleId) {
    Check 'D' 'Citizen reads role (no permission)'         'CITIZEN' GET    "/roles/$roleId"             $tC $true $null $true
    Check 'D' 'Citizen edits role name'                    'CITIZEN' PATCH  "/roles/$roleId"             $tC $true @{name='HackedRole'} $true
    Check 'D' 'Citizen sets role permissions'              'CITIZEN' POST   "/roles/$roleId/permissions" $tC $true @{permissions=@('complaint:view')} $true
    Check 'D' 'Citizen deletes role'                       'CITIZEN' DELETE "/roles/$roleId"             $tC $true $null $true
    Check 'D' 'Admin reads role (expected OK)'             'ADMIN'   GET    "/roles/$roleId"             $tA $true $null $false
}

# ═══════════════════════════════════════════════════════════════════════
# E. CATEGORY IDOR
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[E] Category IDOR" -ForegroundColor Yellow
Check 'E' 'Citizen reads category (public info?)'      'CITIZEN' GET    "/categories/$($ID.cat1)"   $tC $false $null $false
Check 'E' 'Citizen edits category (should block)'      'CITIZEN' PATCH  "/categories/$($ID.cat1)"   $tC $false @{name='HackedCat'} $true
Check 'E' 'Citizen deletes category'                   'CITIZEN' DELETE "/categories/$($ID.cat1)"   $tC $false $null $true

# ═══════════════════════════════════════════════════════════════════════
# F. MUNICIPALITY PUBLIC IDOR
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[F] Municipality IDOR" -ForegroundColor Yellow
Check 'F' 'Citizen reads own muni (public endpoint)'   'CITIZEN' GET   "/municipalities/$MUNI_ID"            $tC $false $null $false
Check 'F' 'Citizen updates muni branding'              'CITIZEN' PATCH "/municipalities/$MUNI_ID/branding"   $tC $false @{primaryColor='#FF0000'} $true
Check 'F' 'Admin updates muni branding (expected OK)'  'ADMIN'   PATCH "/municipalities/$MUNI_ID/branding"   $tA $true @{primaryColor='#0066CC'} $false

# ═══════════════════════════════════════════════════════════════════════
# G. PLATFORM (super-admin only) escalation
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[G] Platform privilege escalation" -ForegroundColor Yellow

# Fetch a real platform municipality ID
$platList = Req GET '/platform/municipalities' $tS $true
$platMuniId = if ($platList.ok -and $platList.body.data.Count -gt 0) { $platList.body.data[0].id }
              elseif ($platList.ok -and $platList.body.data.data) { $platList.body.data.data[0].id }
              else { $MUNI_ID }
Write-Host "  platform muni for test = $platMuniId"

Check 'G' 'Citizen hits /platform/municipalities'                       'CITIZEN' GET    '/platform/municipalities'          $tC $true $null $true
Check 'G' 'Admin hits /platform/municipalities (not super)'             'ADMIN'   GET    '/platform/municipalities'          $tA $true $null $true
Check 'G' 'Super hits /platform/municipalities (expected OK)'           'SUPER'   GET    '/platform/municipalities'          $tS $true $null $false
Check 'G' 'Citizen hits /platform/users'                                'CITIZEN' GET    '/platform/users'                   $tC $true $null $true
Check 'G' 'Admin hits /platform/users'                                  'ADMIN'   GET    '/platform/users'                   $tA $true $null $true
if ($platMuniId) {
    Check 'G' 'Citizen tries to delete a municipality'                  'CITIZEN' DELETE "/platform/municipalities/$platMuniId" $tC $true $null $true
    Check 'G' 'Admin tries to delete a municipality (no super perm)'    'ADMIN'   DELETE "/platform/municipalities/$platMuniId" $tA $true $null $true
}

# ═══════════════════════════════════════════════════════════════════════
# H. AUDIT LOG
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[H] Audit Log" -ForegroundColor Yellow
Check 'H' 'Citizen reads audit log (staff-only)'        'CITIZEN' GET '/audit'        $tC $true $null $true
Check 'H' 'Admin reads audit log (expected OK)'         'ADMIN'   GET '/audit'        $tA $true $null $false
Check 'H' 'Super reads audit log (no muni = 400/403)'   'SUPER'   GET '/audit'        $tS $true $null $true

# ═══════════════════════════════════════════════════════════════════════
# I. NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[I] Notifications" -ForegroundColor Yellow

# Get admin notifications, then try to read them as citizen
$adminNotifs = Req GET '/notifications?limit=5' $tA $false
$notifId = if ($adminNotifs.ok -and $adminNotifs.body.data.items.Count -gt 0) { $adminNotifs.body.data.items[0].id } else { $null }
Write-Host "  admin notif id = $notifId"
if ($notifId) {
    Check 'I' "Citizen reads admin's notification"           'CITIZEN' GET   "/notifications/$notifId"      $tC $false $null $true
    Check 'I' "Citizen marks admin notification as read"     'CITIZEN' PATCH "/notifications/$notifId/read" $tC $false $null $true
    Check 'I' "Admin reads own notification (expected OK)"   'ADMIN'   GET   "/notifications/$notifId"      $tA $false $null $false
}

# ═══════════════════════════════════════════════════════════════════════
# J. PROFILE / AUTH
# ═══════════════════════════════════════════════════════════════════════
Write-Host "[J] Auth / Profile" -ForegroundColor Yellow
Check 'J' 'Citizen reads own /auth/me'                  'CITIZEN' GET   '/auth/me'       $tC $false $null $false
Check 'J' 'Citizen updates own profile'                 'CITIZEN' PATCH '/auth/profile'  $tC $false @{firstName='Updated'} $false
Check 'J' 'Admin reads own /auth/me'                    'ADMIN'   GET   '/auth/me'       $tA $false $null $false

# ═══════════════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════════════
$idors      = $results | Where-Object { $_.Verdict -like '*IDOR*' }
$secured    = $results | Where-Object { $_.Verdict -like '*SECURE*' -or $_.Verdict -like '*SAFE*' }
$allowed    = $results | Where-Object { $_.Verdict -like '*expected*' }
$unexpected = $results | Where-Object { $_.Verdict -like '*UNEXPECTED*' }

$line = '=' * 130
Write-Host "`n$line" -ForegroundColor Cyan
Write-Host ('  IDOR SECURITY TEST REPORT  —  ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -ForegroundColor Cyan
Write-Host $line -ForegroundColor Cyan
Write-Host "  Target : $BASE"
Write-Host "  Tests  : $($results.Count)   Found: $($idors.Count)   Blocked: $($secured.Count)   Expected-OK: $($allowed.Count)   Unexpected: $($unexpected.Count)"
Write-Host $line -ForegroundColor Cyan

$results | Sort-Object Section, Verdict | Format-Table -AutoSize -Property Section, Verdict, HTTP, Actor, Method, Resource

if ($idors.Count -gt 0) {
    Write-Host $line -ForegroundColor Red
    Write-Host '  !! IDOR VULNERABILITIES — REQUIRES IMMEDIATE REVIEW !!' -ForegroundColor Red
    Write-Host $line -ForegroundColor Red
    $idors | Format-List Section, Verdict, HTTP, Actor, Method, Resource, Detail
} else {
    Write-Host $line -ForegroundColor Green
    Write-Host '  RESULT: No IDOR vulnerabilities detected across all tested endpoints.' -ForegroundColor Green
    Write-Host $line -ForegroundColor Green
}
