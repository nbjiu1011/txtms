# Project-local MySQL 8 instance for development and integration tests.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 start|stop|status|reset
# Data lives in api/.localdb (gitignored). Port 3317 avoids clashing with other local servers.
# Writes api/.env with random secrets on first start.
param([Parameter(Mandatory = $true)][ValidateSet('start', 'stop', 'status', 'reset')][string]$Command)

$ErrorActionPreference = 'Stop'
$ApiDir = Split-Path -Parent $PSScriptRoot
$MysqlHome = if ($env:TXTMS_MYSQL_HOME) { $env:TXTMS_MYSQL_HOME } else { 'C:\laragon\bin\mysql\mysql-8.0.31-winx64' }
$Mysqld = Join-Path $MysqlHome 'bin\mysqld.exe'
$Mysql = Join-Path $MysqlHome 'bin\mysql.exe'
$Admin = Join-Path $MysqlHome 'bin\mysqladmin.exe'
$Root = Join-Path $ApiDir '.localdb'
$DataDir = Join-Path $Root 'data'
$Ini = Join-Path $Root 'my.ini'
$Port = 3317
$EnvFile = Join-Path $ApiDir '.env'

function Test-Up {
    # mysqladmin writes to stderr when the server is down; PowerShell 5.1 would turn that into a terminating error.
    $ErrorActionPreference = 'SilentlyContinue'
    & $Admin --host=127.0.0.1 --port=$Port --user=root ping 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function New-Secret([int]$Bytes) {
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return [Convert]::ToBase64String($buf)
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function Initialize-Db {
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    $iniText = "[mysqld]`r`nbasedir=$($MysqlHome -replace '\\','/')`r`ndatadir=$($DataDir -replace '\\','/')`r`nport=$Port`r`nbind-address=127.0.0.1`r`ncharacter-set-server=utf8mb4`r`ncollation-server=utf8mb4_0900_ai_ci`r`ndefault-time-zone=+00:00`r`nmysqlx=OFF`r`n"
    Write-Utf8NoBom $Ini $iniText
    & $Mysqld "--defaults-file=$Ini" --initialize-insecure --console
    if ($LASTEXITCODE -ne 0) { throw 'mysqld --initialize-insecure failed' }
}

function Start-Db {
    if (Test-Up) { Write-Host "MySQL already running on port $Port"; return }
    if (-not (Test-Path $DataDir)) { Initialize-Db }
    Start-Process -FilePath $Mysqld -ArgumentList "--defaults-file=`"$Ini`"" -WindowStyle Hidden | Out-Null
    for ($i = 0; $i -lt 60; $i++) { if (Test-Up) { break }; Start-Sleep -Milliseconds 500 }
    if (-not (Test-Up)) { throw "MySQL did not start on port $Port" }

    if (-not (Test-Path $EnvFile)) {
        $appPw = (New-Secret 18) -replace '[^A-Za-z0-9]', 'x'
        $sql = "CREATE DATABASE IF NOT EXISTS txtms CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; CREATE DATABASE IF NOT EXISTS txtms_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; CREATE USER IF NOT EXISTS 'txtms'@'127.0.0.1' IDENTIFIED BY '$appPw'; GRANT ALL PRIVILEGES ON txtms.* TO 'txtms'@'127.0.0.1'; GRANT ALL PRIVILEGES ON txtms_test.* TO 'txtms'@'127.0.0.1'; FLUSH PRIVILEGES;"
        & $Mysql --host=127.0.0.1 --port=$Port --user=root -e $sql
        if ($LASTEXITCODE -ne 0) { throw 'database bootstrap failed' }
        $jwt = New-Secret 48
        $envText = "DB_URL=jdbc:mysql://127.0.0.1:$Port/txtms`nDB_USERNAME=txtms`nDB_PASSWORD=$appPw`nTEST_DB_URL=jdbc:mysql://127.0.0.1:$Port/txtms_test`nJWT_SECRET=$jwt`n"
        Write-Utf8NoBom $EnvFile $envText
        Write-Host "Created $EnvFile"
    }
    Write-Host "MySQL running on 127.0.0.1:$Port"
}

function Stop-Db {
    if (-not (Test-Up)) { Write-Host 'MySQL is not running'; return }
    & $Admin --host=127.0.0.1 --port=$Port --user=root shutdown
    Write-Host 'MySQL stopped'
}

switch ($Command) {
    'start' { Start-Db }
    'stop' { Stop-Db }
    'status' { if (Test-Up) { Write-Host "running on $Port" } else { Write-Host 'stopped' } }
    'reset' {
        Stop-Db
        Start-Sleep -Seconds 2
        if (Test-Path $Root) { Remove-Item -Recurse -Force $Root }
        if (Test-Path $EnvFile) { Remove-Item -Force $EnvFile }
        Start-Db
    }
}
