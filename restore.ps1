# Skrypt PowerShell do przywracania bazy danych z backupu
param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile,
    [string]$ContainerName = "neptun-leads-app"
)

$backupDir = ".\backups"

# Jeśli nie podano pliku, pokaż listę dostępnych backupów
if ([string]::IsNullOrEmpty($BackupFile)) {
    Write-Host "Dostępne backupy:" -ForegroundColor Cyan
    $backups = Get-ChildItem -Path $backupDir -Filter "leads_backup_*.db" | 
        Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "Brak dostępnych backupów w katalogu $backupDir" -ForegroundColor Red
        exit
    }
    
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $backup = $backups[$i]
        $size = [math]::Round($backup.Length / 1KB, 2)
        Write-Host "[$i] $($backup.Name) - $size KB - $($backup.LastWriteTime)" -ForegroundColor Yellow
    }
    
    $selection = Read-Host "`nWybierz numer backupu do przywrócenia (lub 'q' aby anulować)"
    
    if ($selection -eq 'q') {
        Write-Host "Anulowano" -ForegroundColor Yellow
        exit
    }
    
    if ($selection -match '^\d+$' -and [int]$selection -lt $backups.Count) {
        $BackupFile = $backups[[int]$selection].FullName
    } else {
        Write-Host "Nieprawidłowy wybór" -ForegroundColor Red
        exit
    }
}

if (!(Test-Path $BackupFile)) {
    Write-Host "Plik backupu nie istnieje: $BackupFile" -ForegroundColor Red
    exit
}

Write-Host "`nPrzywracanie backupu: $BackupFile" -ForegroundColor Green
$confirmation = Read-Host "Czy na pewno chcesz przywrócić ten backup? Obecna baza zostanie nadpisana! (tak/nie)"

if ($confirmation -ne "tak") {
    Write-Host "Anulowano" -ForegroundColor Yellow
    exit
}

# Sprawdź czy kontener działa
$containerRunning = docker ps --filter "name=$ContainerName" --format "{{.Names}}"

if ($containerRunning -eq $ContainerName) {
    Write-Host "Zatrzymywanie kontenera..." -ForegroundColor Yellow
    docker-compose stop
    Start-Sleep -Seconds 2
}

# Skopiuj backup jako aktualną bazę danych
Write-Host "Kopiowanie pliku backupu..." -ForegroundColor Yellow
Copy-Item $BackupFile ".\leads.db" -Force

Write-Host "Uruchamianie kontenera..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "✓ Backup przywrócony pomyślnie!" -ForegroundColor Green
Write-Host "Aplikacja dostępna pod: http://localhost:5000" -ForegroundColor Cyan
