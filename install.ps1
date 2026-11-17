$ErrorActionPreference = "Stop"

Write-Host "Closing Medal..." -ForegroundColor Cyan
Stop-Process -Name "Medal" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Install Bun automatically if missing
$env:Path += ";$env:USERPROFILE\.bun\bin"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Bun..." -ForegroundColor Cyan
    $bunInstall = Join-Path $env:TEMP "bun-install.ps1"
    Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -OutFile $bunInstall
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $bunInstall
    Remove-Item $bunInstall -Force -ErrorAction SilentlyContinue
    $env:Path += ";$env:USERPROFILE\.bun\bin"
}

# Download and extract the latest repo ZIP from GitHub (no Git required)
$dir = "$env:USERPROFILE\mepluh"
$zip = "$env:TEMP\mepluh.zip"
$extractTemp = "$env:TEMP\mepluh-extract"

Write-Host "Downloading latest Mepluh build..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "https://github.com/fr1zs/mepluh/archive/refs/heads/main.zip" -OutFile $zip

Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $extractTemp -Force

# Replace old code while keeping user settings/themes if present
New-Item -ItemType Directory -Path $dir -Force | Out-Null
Copy-Item -Path "$extractTemp\mepluh-main\*" -Destination $dir -Recurse -Force

Remove-Item $zip -Force -ErrorAction SilentlyContinue
Remove-Item $extractTemp -Recurse -Force -ErrorAction SilentlyContinue

# Install dependencies and patch Medal
Set-Location $dir
Write-Host "Installing dependencies and patching Medal..." -ForegroundColor Cyan
bun install --no-progress
bun run inject

# Record the installed commit SHA so the in-app updater knows we are up to date
try {
    $commitInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/fr1zs/mepluh/commits/main" -Headers @{ "User-Agent" = "Mepluh-Installer" }
    if ($commitInfo.sha) {
        $mepluhData = Join-Path $env:APPDATA "Mepluh"
        New-Item -ItemType Directory -Path $mepluhData -Force | Out-Null
        Set-Content -Path (Join-Path $mepluhData ".installed-commit") -Value $commitInfo.sha.Trim() -NoNewline
    }
} catch {
    # Non-fatal if rate-limited; in-app updater will sync on next check
}

Write-Host "`nDone! You can reopen Medal now." -ForegroundColor Green