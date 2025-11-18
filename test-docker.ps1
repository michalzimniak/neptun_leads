# Test instalacji Docker i aplikacji
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     Test Srodowiska - Neptun LEADs Docker                " -ForegroundColor Cyan  
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Test 1: Docker Desktop
Write-Host ""
Write-Host "[1/5] Sprawdzanie Docker Desktop..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK Docker zainstalowany: $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker nie dziala"
    }
} catch {
    Write-Host "  BLAD Docker nie jest zainstalowany lub nie dziala" -ForegroundColor Red
    Write-Host "    Pobierz z: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    $allGood = $false
}

# Test 2: Docker Compose
Write-Host ""
Write-Host "[2/5] Sprawdzanie Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version
    if ($composeVersion) {
        Write-Host "  ✓ Docker Compose zainstalowany: $composeVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Docker Compose nie znaleziony" -ForegroundColor Red
    $allGood = $false
}

# Test 3: Pliki aplikacji
Write-Host ""
Write-Host "[3/5] Sprawdzanie plików aplikacji..." -ForegroundColor Yellow
$requiredFiles = @(
    "app.py",
    "Dockerfile",
    "docker-compose.yml",
    "requirements.txt",
    "templates/index.html",
    "static/app.js"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host "  ✓ Wszystkie wymagane pliki obecne" -ForegroundColor Green
} else {
    Write-Host "  ✗ Brakujące pliki:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    $allGood = $false
}

# Test 4: Docker daemon
Write-Host ""
Write-Host "[4/5] Sprawdzanie Docker daemon..." -ForegroundColor Yellow
try {
    docker ps > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker daemon działa" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Docker daemon nie odpowiada" -ForegroundColor Red
        Write-Host "    Uruchom Docker Desktop" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "  ✗ Nie można połączyć się z Docker" -ForegroundColor Red
    $allGood = $false
}

# Test 5: Port 5000
Write-Host ""
Write-Host "[5/5] Sprawdzanie dostępności portu 5000..." -ForegroundColor Yellow
try {
    $port5000 = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
    if ($port5000) {
        Write-Host "  ⚠ Port 5000 jest już zajęty" -ForegroundColor Yellow
        Write-Host "    Proces: $(Get-Process -Id $port5000.OwningProcess | Select-Object -ExpandProperty ProcessName)" -ForegroundColor Yellow
        Write-Host "    Możesz zatrzymać istniejący kontener: docker-compose down" -ForegroundColor Cyan
    } else {
        Write-Host "  ✓ Port 5000 jest wolny" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✓ Port 5000 jest wolny" -ForegroundColor Green
}

# Podsumowanie
Write-Host ""
Write-Host ("="*55) -ForegroundColor Cyan
if ($allGood) {
    Write-Host ""
    Write-Host "✓ Środowisko gotowe do uruchomienia!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Aby uruchomić aplikację, wpisz:" -ForegroundColor Cyan
    Write-Host "  .\start.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "lub manualnie:" -ForegroundColor Cyan
    Write-Host "  docker-compose up -d --build" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "✗ Wykryto problemy - napraw je przed uruchomieniem" -ForegroundColor Red
}
Write-Host ""

# Dodatkowe informacje
Write-Host "Dokumentacja:" -ForegroundColor Cyan
Write-Host "  - Szybki start: QUICKSTART.md" -ForegroundColor White
Write-Host "  - Pełna dokumentacja: README_DOCKER.md" -ForegroundColor White
Write-Host ""
