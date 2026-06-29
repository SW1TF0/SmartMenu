<#
  ============================================================
  SmartMenuKJ — Full application server (static site + JSON API)
  Pure PowerShell. No installs required beyond Windows PowerShell.

  Serves the front-end AND a real backend:
    POST /api/register   { name, email, password }
    POST /api/login      { email, password }
    POST /api/logout
    GET  /api/me
    POST /api/contact    { name, email, phone, service, message }

  Security:
    - Passwords hashed with PBKDF2-SHA256 (100k iterations, per-user salt)
    - Sessions via random token in an HttpOnly cookie (7-day expiry)
    - Server-side validation on every endpoint
    - Data files are never served over HTTP

  Data is persisted as JSON under .\server-data\
  ============================================================
#>

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Port    = if ($env:SMKJ_PORT) { [int]$env:SMKJ_PORT } else { 5173 }
$Root    = $PSScriptRoot
$DataDir = Join-Path $Root 'server-data'
$UsersFile     = Join-Path $DataDir 'users.json'
$SessionsFile  = Join-Path $DataDir 'sessions.json'
$InquiriesFile = Join-Path $DataDir 'inquiries.json'
$ViewsFile     = Join-Path $DataDir 'views.json'

# Accounts whose email is listed here gain access to the admin panel (/admin.html)
$AdminEmails = @('krasimiruzun@smartmenukj.com')

if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }

$Utf8 = New-Object System.Text.UTF8Encoding($false)

# ---------- JSON storage helpers (server runs single-threaded, so no locking needed) ----------
function Load-Array([string]$path) {
  if (-not (Test-Path $path)) { return @() }
  $text = [IO.File]::ReadAllText($path, $Utf8)
  if ([string]::IsNullOrWhiteSpace($text)) { return @() }
  # NOTE: ConvertFrom-Json (Windows PowerShell 5.1) emits an array as a single
  # non-enumerated object, so we must materialize it into a variable before
  # wrapping with @() — otherwise multi-item arrays collapse to one element.
  $parsed = $text | ConvertFrom-Json
  if ($null -eq $parsed) { return @() }
  return @($parsed)
}
function Save-Array([string]$path, $arr) {
  # Serialize each element on its own and join, so single-item and multi-item
  # arrays always produce a clean JSON array (avoids PowerShell's ConvertTo-Json
  # wrapping arrays in {"value":[...],"Count":N}).
  $parts = @()
  foreach ($item in @($arr)) {
    if ($null -ne $item) { $parts += ($item | ConvertTo-Json -Depth 8 -Compress) }
  }
  $json = '[' + ($parts -join ',') + ']'
  [IO.File]::WriteAllText($path, $json, $Utf8)
}
function Load-Object([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  $text = [IO.File]::ReadAllText($path, $Utf8)
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  return ($text | ConvertFrom-Json)
}
function Save-Object([string]$path, $obj) {
  [IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 8), $Utf8)
}

# ---------- Crypto helpers ----------
function New-PasswordHash([string]$password) {
  $iterations = 100000
  $salt = New-Object byte[] 16
  ([Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($salt)
  $kdf  = New-Object Security.Cryptography.Rfc2898DeriveBytes($password, $salt, $iterations, [Security.Cryptography.HashAlgorithmName]::SHA256)
  $hash = $kdf.GetBytes(32)
  $kdf.Dispose()
  return ('pbkdf2_sha256${0}${1}${2}' -f $iterations, [Convert]::ToBase64String($salt), [Convert]::ToBase64String($hash))
}
function Test-PasswordHash([string]$password, [string]$stored) {
  try {
    $parts = $stored.Split('$')
    if ($parts.Length -ne 4) { return $false }
    $iterations = [int]$parts[1]
    $salt = [Convert]::FromBase64String($parts[2])
    $expected = [Convert]::FromBase64String($parts[3])
    $kdf  = New-Object Security.Cryptography.Rfc2898DeriveBytes($password, $salt, $iterations, [Security.Cryptography.HashAlgorithmName]::SHA256)
    $actual = $kdf.GetBytes($expected.Length)
    $kdf.Dispose()
    # constant-time comparison
    $diff = 0
    for ($i = 0; $i -lt $expected.Length; $i++) { $diff = $diff -bor ($expected[$i] -bxor $actual[$i]) }
    return ($diff -eq 0)
  } catch { return $false }
}
function New-Token {
  $bytes = New-Object byte[] 32
  ([Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($bytes)
  return ([BitConverter]::ToString($bytes) -replace '-', '').ToLower()
}
function New-Id { return [Guid]::NewGuid().ToString('N') }

# ---------- Validation ----------
function Test-Email([string]$email) { return ($email -match '^[^\s@]+@[^\s@]+\.[^\s@]+$') }

# Timestamps are stored as numeric Unix-epoch seconds (survive JSON round-trips
# losslessly and are locale-independent) plus a non-ISO display string for audit.
function Now-Epoch { return [int64]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) }
function Now-Text  { return ((Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm 'UTC'")) }

# ---------- HTTP helpers ----------
function Send-Json($ctx, $obj, [int]$status = 200) {
  $json  = $obj | ConvertTo-Json -Depth 8 -Compress
  $bytes = $Utf8.GetBytes($json)
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = 'application/json; charset=utf-8'
  $ctx.Response.Headers.Add('Cache-Control', 'no-store')
  $ctx.Response.ContentLength64 = $bytes.Length
  try { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length); $ctx.Response.Close() } catch {}
}
function Read-Body($ctx) {
  if (-not $ctx.Request.HasEntityBody) { return $null }
  $reader = New-Object System.IO.StreamReader($ctx.Request.InputStream, $ctx.Request.ContentEncoding)
  $raw = $reader.ReadToEnd()
  $reader.Close()
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  try { return $raw | ConvertFrom-Json } catch { return $null }
}
function Set-SessionCookie($ctx, [string]$token, [int]$maxAge = 604800) {
  $secure = if ($ctx.Request.IsSecureConnection) { '; Secure' } else { '' }
  $ctx.Response.Headers.Add('Set-Cookie', "smkj_session=$token; Path=/; HttpOnly; SameSite=Lax; Max-Age=$maxAge$secure")
}
function Get-CookieToken($ctx) {
  $c = $ctx.Request.Cookies['smkj_session']
  if ($c) { return $c.Value }
  return $null
}

# ---------- Session / user resolution ----------
function Get-SessionUser($ctx) {
  $token = Get-CookieToken $ctx
  if (-not $token) { return $null }
  $sessions = Load-Array $SessionsFile
  $match = $sessions | Where-Object { $_.token -eq $token } | Select-Object -First 1
  if (-not $match) { return $null }
  if ([int64]$match.expires -lt (Now-Epoch)) { return $null }
  $users = Load-Array $UsersFile
  return ($users | Where-Object { $_.id -eq $match.userId } | Select-Object -First 1)
}
function Remove-ExpiredSessions {
  $sessions = Load-Array $SessionsFile
  $now = Now-Epoch
  $valid = @($sessions | Where-Object { [int64]$_.expires -ge $now })
  Save-Array $SessionsFile $valid
}
function Add-Session([string]$userId) {
  Remove-ExpiredSessions
  $token = New-Token
  $sessions = @(Load-Array $SessionsFile)
  $sessions += [PSCustomObject]@{
    token   = $token
    userId  = $userId
    expires = ((Now-Epoch) + 604800)  # 7 days
  }
  Save-Array $SessionsFile $sessions
  return $token
}

# ---------- API handlers ----------
function Public-User($u) { return [PSCustomObject]@{ id = $u.id; name = $u.name; email = $u.email } }

function Handle-Register($ctx) {
  $b = Read-Body $ctx
  if (-not $b) { Send-Json $ctx @{ error = 'Invalid request.' } 400; return }
  $name = ('' + $b.name).Trim()
  $email = ('' + $b.email).Trim().ToLower()
  $password = '' + $b.password
  if ($name.Length -lt 2)       { Send-Json $ctx @{ error = 'Please enter your name.' } 400; return }
  if (-not (Test-Email $email)) { Send-Json $ctx @{ error = 'Enter a valid email.' } 400; return }
  if ($password.Length -lt 6)   { Send-Json $ctx @{ error = 'Password must be at least 6 characters.' } 400; return }

  $users = @(Load-Array $UsersFile)
  if ($users | Where-Object { $_.email -eq $email }) {
    Send-Json $ctx @{ error = 'An account with this email already exists.' } 409; return
  }
  $user = [PSCustomObject]@{
    id        = New-Id
    name      = $name
    email     = $email
    password  = (New-PasswordHash $password)
    createdAt = (Now-Text)
  }
  $users += $user
  Save-Array $UsersFile $users
  $token = Add-Session $user.id
  Set-SessionCookie $ctx $token
  Write-Host "[register] $email"
  Send-Json $ctx @{ user = (Public-User $user) } 201
}

function Handle-Login($ctx) {
  $b = Read-Body $ctx
  if (-not $b) { Send-Json $ctx @{ error = 'Invalid request.' } 400; return }
  $email = ('' + $b.email).Trim().ToLower()
  $password = '' + $b.password
  if (-not (Test-Email $email) -or $password.Length -lt 1) {
    Send-Json $ctx @{ error = 'Invalid email or password.' } 400; return
  }
  $users = @(Load-Array $UsersFile)
  $user = $users | Where-Object { $_.email -eq $email } | Select-Object -First 1
  if (-not $user -or -not (Test-PasswordHash $password $user.password)) {
    Send-Json $ctx @{ error = 'Invalid email or password.' } 401; return
  }
  $token = Add-Session $user.id
  Set-SessionCookie $ctx $token
  Write-Host "[login] $email"
  Send-Json $ctx @{ user = (Public-User $user) } 200
}

function Handle-Logout($ctx) {
  $token = Get-CookieToken $ctx
  if ($token) {
    $sessions = @(Load-Array $SessionsFile | Where-Object { $_.token -ne $token })
    Save-Array $SessionsFile $sessions
  }
  Set-SessionCookie $ctx '' 0
  Send-Json $ctx @{ ok = $true } 200
}

function Handle-Me($ctx) {
  $u = Get-SessionUser $ctx
  if ($u) { Send-Json $ctx @{ user = (Public-User $u) } 200 }
  else    { Send-Json $ctx @{ user = $null } 200 }
}

function Handle-Contact($ctx) {
  $b = Read-Body $ctx
  if (-not $b) { Send-Json $ctx @{ error = 'Invalid request.' } 400; return }
  $name = ('' + $b.name).Trim()
  $email = ('' + $b.email).Trim()
  $message = ('' + $b.message).Trim()
  if ($name.Length -lt 2)             { Send-Json $ctx @{ error = 'Please enter your name.' } 400; return }
  if (-not (Test-Email $email.ToLower())) { Send-Json $ctx @{ error = 'Enter a valid email.' } 400; return }
  if ($message.Length -lt 10)         { Send-Json $ctx @{ error = 'Please add a few more details.' } 400; return }

  $current = Get-SessionUser $ctx
  $inquiries = @(Load-Array $InquiriesFile)
  $inquiry = [PSCustomObject]@{
    id        = New-Id
    name      = $name
    email     = $email
    phone     = ('' + $b.phone).Trim()
    service   = ('' + $b.service).Trim()
    message   = $message
    userId    = if ($current) { $current.id } else { $null }
    ip        = $ctx.Request.RemoteEndPoint.Address.ToString()
    createdAt = (Now-Text)
  }
  $inquiries += $inquiry
  Save-Array $InquiriesFile $inquiries
  Write-Host "[contact] from $email ($($b.service))"
  Send-Json $ctx @{ ok = $true; id = $inquiry.id } 201
}

function Get-ViewsData {
  $v = Load-Object $ViewsFile
  $total = 0; $daily = @{}
  if ($v) {
    $total = [int]$v.total
    if ($v.daily) { $v.daily.PSObject.Properties | ForEach-Object { $daily[$_.Name] = [int]$_.Value } }
  }
  return @{ total = $total; daily = $daily }
}
function Handle-Track($ctx) {
  $data = Get-ViewsData
  $today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
  $data.total = $data.total + 1
  if ($data.daily.ContainsKey($today)) { $data.daily[$today] = $data.daily[$today] + 1 } else { $data.daily[$today] = 1 }
  Save-Object $ViewsFile $data
  Send-Json $ctx @{ total = $data.total } 200
}

# Returns the admin user object, $false (logged in but not admin), or $null (not authenticated)
function Require-Admin($ctx) {
  $u = Get-SessionUser $ctx
  if (-not $u) { return $null }
  if ($AdminEmails -contains $u.email) { return $u }
  return $false
}
function Handle-AdminSummary($ctx) {
  $admin = Require-Admin $ctx
  if ($null -eq $admin)  { Send-Json $ctx @{ error = 'Not authenticated.' } 401; return }
  if ($admin -eq $false) { Send-Json $ctx @{ error = 'Forbidden - admin access only.' } 403; return }

  # Map to plain hashtables so single-item arrays serialize as proper JSON arrays
  $users = @(Load-Array $UsersFile | ForEach-Object { @{ id = $_.id; name = $_.name; email = $_.email; createdAt = $_.createdAt } })
  $inquiries = @(Load-Array $InquiriesFile | ForEach-Object { @{ id = $_.id; name = $_.name; email = $_.email; phone = $_.phone; service = $_.service; message = $_.message; userId = $_.userId; createdAt = $_.createdAt } })
  $views = Get-ViewsData
  $today = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')

  Send-Json $ctx @{
    admin          = @{ name = $admin.name; email = $admin.email }
    views          = @{ total = $views.total; today = ([int]$views.daily[$today]); daily = $views.daily }
    usersCount     = $users.Count
    inquiriesCount = $inquiries.Count
    users          = $users
    inquiries      = $inquiries
  } 200
}

# ---------- Static file serving ----------
$Mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'; '.mp4' = 'video/mp4'
}
function Serve-Static($ctx, [string]$rel) {
  if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
  # Block access to server internals and data
  if ($rel -match '(?i)(^|/)server-data(/|$)' -or $rel -match '(?i)\.ps1$') {
    $ctx.Response.StatusCode = 404; $ctx.Response.Close(); return
  }
  $full = Join-Path $Root $rel
  # prevent path traversal outside root
  $fullResolved = [IO.Path]::GetFullPath($full)
  if (-not $fullResolved.StartsWith([IO.Path]::GetFullPath($Root))) {
    $ctx.Response.StatusCode = 403; $ctx.Response.Close(); return
  }
  if (Test-Path $full -PathType Leaf) {
    $bytes = [IO.File]::ReadAllBytes($full)
    $ext = [IO.Path]::GetExtension($full).ToLower()
    $ct = $Mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
    $ctx.Response.ContentType = $ct
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.ContentLength64 = $bytes.Length
    try { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length); $ctx.Response.Close() } catch {}
  } else {
    $ctx.Response.StatusCode = 404
    $msg = $Utf8.GetBytes('404 Not Found')
    try { $ctx.Response.OutputStream.Write($msg, 0, $msg.Length); $ctx.Response.Close() } catch {}
  }
}

# ---------- Router ----------
function Route($ctx) {
  $method = $ctx.Request.HttpMethod
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)

  if ($path -like '/api/*') {
    switch ("$method $path") {
      'POST /api/register' { Handle-Register $ctx; return }
      'POST /api/login'    { Handle-Login $ctx; return }
      'POST /api/logout'   { Handle-Logout $ctx; return }
      'GET /api/me'           { Handle-Me $ctx; return }
      'POST /api/contact'     { Handle-Contact $ctx; return }
      'POST /api/track'       { Handle-Track $ctx; return }
      'GET /api/admin/summary' { Handle-AdminSummary $ctx; return }
      default                 { Send-Json $ctx @{ error = 'Not found.' } 404; return }
    }
  }
  Serve-Static $ctx $path.TrimStart('/')
}

# ---------- Boot ----------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "SmartMenuKJ server running on http://localhost:$Port/"
Write-Host "  static root : $Root"
Write-Host "  data dir    : $DataDir"
Write-Host "  api         : /api/register /api/login /api/logout /api/me /api/contact"

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    Route $ctx
  } catch {
    Write-Host "Request error: $($_.Exception.Message)"
    try { $ctx.Response.StatusCode = 500; $ctx.Response.Close() } catch {}
  }
}
