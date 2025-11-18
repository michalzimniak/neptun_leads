# Szybkie uruchomienie aplikacji Neptun LEADs
Write-Host "
╔═══════════════════════════════════════════════════╗
║         NEPTUN LEADs - Docker Manager             ║
╚═══════════════════════════════════════════════════╝
" -ForegroundColor Cyan

Write-Host "Wybierz opcję:" -ForegroundColor Yellow
Write-Host "1. Uruchom aplikację (development)" -ForegroundColor Green
Write-Host "2. Uruchom aplikację (production z Gunicorn)" -ForegroundColor Green
Write-Host "3. Zatrzymaj aplikację" -ForegroundColor Red
Write-Host "4. Restart aplikacji" -ForegroundColor Yellow
Write-Host "5. Zobacz logi" -ForegroundColor Cyan
Write-Host "6. Status kontenera" -ForegroundColor Cyan
Write-Host "7. Backup bazy danych" -ForegroundColor Magenta
Write-Host "8. Przywróć backup" -ForegroundColor Magenta
Write-Host "9. Wyjdź" -ForegroundColor Gray

$choice = Read-Host "`nWybór"

switch ($choice) {
    "1" {
        Write-Host "`nUruchamianie w trybie development..." -ForegroundColor Green
        docker-compose up -d --build
        Start-Sleep -Seconds 3
        Write-Host "`n✓ Aplikacja uruchomiona!" -ForegroundColor Green
        Write-Host "URL: http://localhost:5000" -ForegroundColor Cyan
        Write-Host "Sieć: http://192.168.1.72:5000" -ForegroundColor Cyan
    }
    "2" {
        Write-Host "`nUruchamianie w trybie production..." -ForegroundColor Green
        docker-compose -f docker-compose.production.yml up -d --build
        Start-Sleep -Seconds 3
        Write-Host "`n✓ Aplikacja uruchomiona (Gunicorn)!" -ForegroundColor Green
        Write-Host "URL: http://localhost:5000" -ForegroundColor Cyan
    }
    "3" {
        Write-Host "`nZatrzymywanie aplikacji..." -ForegroundColor Yellow
        docker-compose down
        docker-compose -f docker-compose.production.yml down
        Write-Host "✓ Aplikacja zatrzymana" -ForegroundColor Green
    }
    "4" {
        Write-Host "`nRestart aplikacji..." -ForegroundColor Yellow
        docker-compose restart
        Write-Host "✓ Aplikacja zrestartowana" -ForegroundColor Green
    }
    "5" {
        Write-Host "`nLogi (Ctrl+C aby zakończyć):" -ForegroundColor Cyan
        docker-compose logs -f
    }
    "6" {
        Write-Host "`nStatus kontenerów:" -ForegroundColor Cyan
        docker-compose ps
        Write-Host "`nStatystyki zasobów:" -ForegroundColor Cyan
        docker stats --no-stream
    }
    "7" {
        Write-Host "`nTworzenie backupu..." -ForegroundColor Magenta
        & .\backup.ps1
    }
    "8" {
        Write-Host "`nPrzywracanie backupu..." -ForegroundColor Magenta
        & .\restore.ps1
    }
    "9" {
        Write-Host "Do widzenia!" -ForegroundColor Gray
        exit
    }
    default {
        Write-Host "Nieprawidłowy wybór" -ForegroundColor Red
    }
}

Write-Host "`nNaciśnij Enter aby kontynuować..."
Read-Host
