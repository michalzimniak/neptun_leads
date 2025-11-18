# Simple Docker test script
Write-Host "==========================================================

" -ForegroundColor Cyan
Write-Host "Testing Docker Environment for Neptun LEADs" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Test Docker
Write-Host ""
Write-Host "Checking Docker..." -ForegroundColor Yellow
$docker = docker --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: $docker" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Docker not found" -ForegroundColor Red
    Write-Host "  Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Test Docker Compose
Write-Host ""
Write-Host "Checking Docker Compose..." -ForegroundColor Yellow
$compose = docker-compose --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: $compose" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Docker Compose not found" -ForegroundColor Red
    exit 1
}

# Test Docker Daemon
Write-Host ""
Write-Host "Checking Docker daemon..." -ForegroundColor Yellow
docker ps > $null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: Docker daemon is running" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Docker daemon not responding" -ForegroundColor Red
    Write-Host "  Please start Docker Desktop" -ForegroundColor Yellow
    exit 1
}

# Test files
Write-Host ""
Write-Host "Checking application files..." -ForegroundColor Yellow
$files = @("app.py", "Dockerfile", "docker-compose.yml", "requirements.txt")
$missing = @()
foreach ($f in $files) {
    if (!(Test-Path $f)) {
        $missing += $f
    }
}
if ($missing.Count -eq 0) {
    Write-Host "  OK: All required files present" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Missing files: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

# Test port 5000
Write-Host ""
Write-Host "Checking port 5000..." -ForegroundColor Yellow
try {
    $port = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
    if ($port) {
        Write-Host "  WARNING: Port 5000 is already in use" -ForegroundColor Yellow
        Write-Host "  Run: docker-compose down" -ForegroundColor Cyan
    } else {
        Write-Host "  OK: Port 5000 is available" -ForegroundColor Green
    }
} catch {
    Write-Host "  OK: Port 5000 is available" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application, run:" -ForegroundColor Cyan
Write-Host "  docker-compose up -d --build" -ForegroundColor White
Write-Host ""
Write-Host "Or use the interactive menu:" -ForegroundColor Cyan  
Write-Host "  .\start.ps1" -ForegroundColor White
Write-Host ""
