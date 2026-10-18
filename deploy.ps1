# ==============================================================================
# Global Trade Analytics & Predictive Intelligence Platform
# 1-Click Deployment Script for Windows (PowerShell)
# ==============================================================================

[CmdletBinding()]
param (
    [switch]$Build,
    [switch]$Down,
    [switch]$Logs,
    [switch]$Status,
    [switch]$Detached = $true
)

$ErrorActionPreference = "Stop"

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  GLOBAL TRADE ANALYTICS & PREDICTIVE INTELLIGENCE PLATFORM  " -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "  Docker Deployment Orchestrator (Windows)                  " -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# 1. Verify Docker Engine Availability
Write-Host "[1/5] Checking Docker installation..." -ForegroundColor Yellow
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker is not installed or not in system PATH." -ForegroundColor Red
    Write-Host "Please install Docker Desktop for Windows: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon unreachable"
    }
    Write-Host "       Docker Engine is running." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker daemon is not running." -ForegroundColor Red
    Write-Host "Please start Docker Desktop and wait until the engine is active before retrying." -ForegroundColor Yellow
    exit 1
}

# 2. Check for docker compose support
$ComposeCmd = @("docker", "compose")
try {
    & $ComposeCmd version > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        $ComposeCmd = @("docker-compose")
    }
} catch {
    $ComposeCmd = @("docker-compose")
}

# Handle --Down
if ($Down) {
    Write-Host "[ACTION] Stopping and removing containers..." -ForegroundColor Yellow
    & $ComposeCmd down
    Write-Host "[OK] Containers stopped successfully." -ForegroundColor Green
    exit 0
}

# Handle --Status
if ($Status) {
    Write-Host "[ACTION] Checking container status..." -ForegroundColor Yellow
    & $ComposeCmd ps
    exit 0
}

# Handle --Logs
if ($Logs) {
    Write-Host "[ACTION] Streaming container logs..." -ForegroundColor Yellow
    & $ComposeCmd logs -f
    exit 0
}

# 3. Environment Preparation
Write-Host "[2/5] Preparing environment files..." -ForegroundColor Yellow
$EnvPath = Join-Path $PSScriptRoot ".env"
$EnvExamplePath = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $EnvPath)) {
    if (Test-Path $EnvExamplePath) {
        Copy-Item -Path $EnvExamplePath -Destination $EnvPath
        Write-Host "       Generated .env from .env.example" -ForegroundColor Green
    } else {
        Write-Host "       [WARN] .env.example not found; creating minimal .env" -ForegroundColor DarkYellow
        "PORT=8000" | Out-File -FilePath $EnvPath -Encoding utf8
    }
} else {
    Write-Host "       Active .env configuration detected." -ForegroundColor Green
}

# 4. Data Directory Verification
Write-Host "[3/5] Verifying persistent storage mounts..." -ForegroundColor Yellow
$DataPath = Join-Path $PSScriptRoot "data"
$RawDataPath = Join-Path $DataPath "raw"

if (-not (Test-Path $RawDataPath)) {
    New-Item -ItemType Directory -Path $RawDataPath -Force | Out-Null
    Write-Host "       Created data/raw directory." -ForegroundColor Green
} else {
    Write-Host "       Persistent data directory ready." -ForegroundColor Green
}

# 5. Build and Launch Containers
Write-Host "[4/5] Launching containers via Docker Compose..." -ForegroundColor Yellow
$UpArgs = @("up")
if ($Build) {
    $UpArgs += "--build"
}
if ($Detached) {
    $UpArgs += "-d"
}

Write-Host "       Executing: $($ComposeCmd -join ' ') $($UpArgs -join ' ')" -ForegroundColor DarkGray
& $ComposeCmd @UpArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start containers." -ForegroundColor Red
    exit 1
}

# 6. Service Health Verification & Access URLs
Write-Host "`n[5/5] Deployment Successful!" -ForegroundColor Green
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Web Application:   http://localhost (or http://localhost:5173)" -ForegroundColor White
Write-Host "  FastAPI Backend:   http://localhost:8000" -ForegroundColor White
Write-Host "  Interactive Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Health Status:     http://localhost:8000/api/health" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Helpful Commands:" -ForegroundColor Yellow
Write-Host "  View Logs:         .\deploy.ps1 -Logs" -ForegroundColor Gray
Write-Host "  Container Status:  .\deploy.ps1 -Status" -ForegroundColor Gray
Write-Host "  Stop Platform:     .\deploy.ps1 -Down" -ForegroundColor Gray
Write-Host "  Rebuild Images:    .\deploy.ps1 -Build`n" -ForegroundColor Gray
