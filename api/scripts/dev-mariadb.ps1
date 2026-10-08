# Project-local MariaDB 10.11 instance (same engine and version as the production server).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/dev-mariadb.ps1 start|stop|status|reset
#
# - Binaries: the official Windows x64 ZIP is downloaded once into api/.localdb/mariadb-10.11/server
#   (no installer, no admin rights). Set TXTMS_MARIADB_HOME to use an existing MariaDB 10.11 directory instead.
# - Data: api/.localdb/mariadb-10.11/data (gitignored). Port 3318 (override with TXTMS_MARIADB_PORT).
# - Databases txtms (local development) and txtms_test (integration tests), user txtms@127.0.0.1/localhost.
# - api/.env: TEST_DB_URL/TEST_DB_USERNAME/TEST_DB_PASSWORD are written (other keys are kept). When .env does not
#   exist yet, DB_URL/DB_USERNAME/DB_PASSWORD (local txtms database) and a random JWT_SECRET are written as well.
param([Parameter(Mandatory = $true)][ValidateSet('start', 'stop', 'status', 'reset')][string]$Command)

$ErrorActionPreference = 'Stop'
$Version = '10.11.13'
$ApiDir = Split-Path -Parent $PSScriptRoot
$Root = Join-Path $ApiDir '.localdb\mariadb-10.11'
$DefaultHome = Join-Path $Root 'server'
$MariaHome = if ($env:TXTMS_MARIADB_HOME) { $env:TXTMS_MARIADB_HOME } else { $DefaultHome }
$Port = if ($env:TXTMS_MARIADB_PORT) { [int]$env:TXTMS_MARIADB_PORT } else { 3318 }
$DataDir = Join-Path $Root 'data'
$Ini = Join-Path $Root 'my.ini'
$EnvFile = Join-Path $ApiDir '.env'
$Server = Join-Path $MariaHome 'bin\mariadbd.exe'
$Client = Join-Path $MariaHome 'bin\mariadb.exe'
$Admin = Join-Path $MariaHome 'bin\mariadb-admin.exe'
$InstallDb = Join-Path $MariaHome 'bin\mariadb-install-db.exe'
$ArchiveBase = "https://archive.mariadb.org/mariadb-$Version/winx64-packages"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function New-Secret([int]$Bytes) {
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

function Test-Up {
    # The admin tool writes to stderr when the server is down; PowerShell 5.1 would turn that into a terminating error.
    $ErrorActionPreference = 'SilentlyContinue'
    & $Admin --host=127.0.0.1 --port=$Port --user=root ping 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Test-PortBusy {
    $busy = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -ne $busy)
}

function Install-Binaries {
    if (Test-Path $Server) { return }
    if ($MariaHome -ne $DefaultHome) { throw "mariadbd.exe not found under TXTMS_MARIADB_HOME ($MariaHome)" }
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $zipName = "mariadb-$Version-winx64.zip"
    $zip = Join-Path $Root $zipName
    $sums = Join-Path $Root 'sha256sums.txt'
    Write-Host "Downloading MariaDB $Version ..."
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -UseBasicParsing -Uri "$ArchiveBase/sha256sums.txt" -OutFile $sums
    Invoke-WebRequest -UseBasicParsing -Uri "$ArchiveBase/$zipName" -OutFile $zip
    $line = Get-Content $sums | Where-Object { $_ -match [regex]::Escape($zipName) + '$' } | Select-Object -First 1
    if (-not $line) { throw "checksum for $zipName not found" }
    $expected = ($line -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { throw "SHA-256 mismatch for $zipName" }
    $unpack = Join-Path $Root 'unpack'
    if (Test-Path $unpack) { Remove-Item -Recurse -Force $unpack }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $unpack)
    Move-Item -Path (Join-Path $unpack "mariadb-$Version-winx64") -Destination $DefaultHome
    Remove-Item -Recurse -Force $unpack
    Remove-Item -Force $zip, $sums
    Write-Host "MariaDB $Version installed in $DefaultHome"
}

function Initialize-Db {
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    & $InstallDb "--datadir=$DataDir" "--port=$Port" --silent
    if ($LASTEXITCODE -ne 0) { throw 'mariadb-install-db failed' }
}

function Write-Ini {
    # Server defaults mirror the production database: utf8mb4 / utf8mb4_general_ci.
    $iniText = "[mysqld]`r`nbasedir=$($MariaHome -replace '\\','/')`r`ndatadir=$($DataDir -replace '\\','/')`r`n" +
        "port=$Port`r`nbind-address=127.0.0.1`r`ncharacter-set-server=utf8mb4`r`ncollation-server=utf8mb4_general_ci`r`n" +
        "default-time-zone=+09:00`r`nmax_allowed_packet=64M`r`n"
    Write-Utf8NoBom $Ini $iniText
}

function Set-EnvKeys([hashtable]$Values) {
    $lines = New-Object System.Collections.Generic.List[string]
    if (Test-Path $EnvFile) {
        foreach ($l in [System.IO.File]::ReadAllLines($EnvFile)) {
            $key = ($l -split '=', 2)[0]
            if (-not $Values.ContainsKey($key)) { $lines.Add($l) }
        }
    }
    foreach ($k in ($Values.Keys | Sort-Object)) { $lines.Add("$k=$($Values[$k])") }
    Write-Utf8NoBom $EnvFile (($lines -join "`n") + "`n")
}

function Initialize-Accounts {
    $appPw = (New-Secret 18) -replace '[^A-Za-z0-9]', 'x'
    $sql = "CREATE DATABASE IF NOT EXISTS txtms CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; " +
        "CREATE DATABASE IF NOT EXISTS txtms_test CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; "
    foreach ($h in @('127.0.0.1', 'localhost')) {
        $sql += "CREATE USER IF NOT EXISTS 'txtms'@'$h' IDENTIFIED BY '$appPw'; ALTER USER 'txtms'@'$h' IDENTIFIED BY '$appPw'; " +
            "GRANT ALL PRIVILEGES ON txtms.* TO 'txtms'@'$h'; GRANT ALL PRIVILEGES ON txtms_test.* TO 'txtms'@'$h'; "
    }
    $sql += 'FLUSH PRIVILEGES;'
    & $Client --host=127.0.0.1 --port=$Port --user=root -e $sql
    if ($LASTEXITCODE -ne 0) { throw 'database bootstrap failed' }

    $values = @{
        'TEST_DB_URL'      = "jdbc:mariadb://127.0.0.1:$Port/txtms_test"
        'TEST_DB_USERNAME' = 'txtms'
        'TEST_DB_PASSWORD' = $appPw
    }
    if (-not (Test-Path $EnvFile)) {
        $values['DB_URL'] = "jdbc:mariadb://127.0.0.1:$Port/txtms"
        $values['DB_USERNAME'] = 'txtms'
        $values['DB_PASSWORD'] = $appPw
        $values['JWT_SECRET'] = New-Secret 48
    }
    Set-EnvKeys $values
    Write-Host "Updated $EnvFile (TEST_DB_*)"
}

function Test-EnvCurrent {
    if (-not (Test-Path $EnvFile)) { return $false }
    $text = [System.IO.File]::ReadAllText($EnvFile)
    return ($text -match "(?m)^TEST_DB_URL=jdbc:mariadb://127\.0\.0\.1:$Port/txtms_test\s*$") -and
        ($text -match '(?m)^TEST_DB_PASSWORD=\S+')
}

function Start-Db {
    if (Test-Up) { Write-Host "MariaDB already running on port $Port"; return }
    if (Test-PortBusy) { throw "port $Port is used by another process (set TXTMS_MARIADB_PORT)" }
    Install-Binaries
    $fresh = -not (Test-Path $DataDir)
    if ($fresh) { Initialize-Db }
    Write-Ini
    Start-Process -FilePath $Server -ArgumentList "--defaults-file=`"$Ini`"" -WindowStyle Hidden | Out-Null
    for ($i = 0; $i -lt 60; $i++) { if (Test-Up) { break }; Start-Sleep -Milliseconds 500 }
    if (-not (Test-Up)) { throw "MariaDB did not start on port $Port (see $DataDir\*.err)" }
    if ($fresh -or -not (Test-EnvCurrent)) { Initialize-Accounts }
    Write-Host "MariaDB $Version running on 127.0.0.1:$Port"
}

function Stop-Db {
    if (-not (Test-Up)) { Write-Host 'MariaDB is not running'; return }
    & $Admin --host=127.0.0.1 --port=$Port --user=root shutdown
    for ($i = 0; $i -lt 40; $i++) { if (-not (Test-Up)) { break }; Start-Sleep -Milliseconds 500 }
    Write-Host 'MariaDB stopped'
}

switch ($Command) {
    'start' { Start-Db }
    'stop' { Stop-Db }
    'status' { if (Test-Up) { Write-Host "running on $Port" } else { Write-Host 'stopped' } }
    'reset' {
        # Drops the local data (both databases); the downloaded binaries are kept.
        Stop-Db
        Start-Sleep -Seconds 2
        if (Test-Path $DataDir) { Remove-Item -Recurse -Force $DataDir }
        Start-Db
    }
}
