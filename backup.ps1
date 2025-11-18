# Skrypt PowerShell do backupu bazy danych
param(
    [string]$BackupDir = ".\backups",
    [string]$ContainerName = "neptun-leads-app",
    [int]$RetentionDays = 30
)

# Utwórz katalog backupów jeśli nie istnieje
if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

# Wygeneruj nazwę pliku z datą
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "leads_backup_$timestamp.db"

Write-Host "Tworzenie backupu bazy danych..." -ForegroundColor Green

# Sprawdź czy kontener działa
$containerRunning = docker ps --filter "name=$ContainerName" --format "{{.Names}}"

if ($containerRunning -eq $ContainerName) {
    # Skopiuj bazę danych z kontenera
    docker cp "${ContainerName}:/app/leads.db" $backupFile
    
    if ($LASTEXITCODE -eq 0) {
        $size = (Get-Item $backupFile).Length / 1KB
        Write-Host "✓ Backup utworzony: $backupFile ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
        
        # Usuń stare backupy
        $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
        Get-ChildItem -Path $BackupDir -Filter "leads_backup_*.db" | 
            Where-Object { $_.LastWriteTime -lt $cutoffDate } | 
            ForEach-Object {
                Write-Host "Usuwanie starego backupu: $($_.Name)" -ForegroundColor Yellow
                Remove-Item $_.FullName
            }
    } else {
        Write-Host "✗ Błąd podczas tworzenia backupu" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Kontener $ContainerName nie jest uruchomiony" -ForegroundColor Red
    Write-Host "Próba backupu lokalnej bazy danych..." -ForegroundColor Yellow
    
    if (Test-Path ".\leads.db") {
        Copy-Item ".\leads.db" $backupFile
        Write-Host "✓ Backup lokalnej bazy utworzony: $backupFile" -ForegroundColor Green
    } else {
        Write-Host "✗ Nie znaleziono lokalnej bazy danych" -ForegroundColor Red
    }
}

# Pokaż listę backupów
Write-Host "`nDostępne backupy:" -ForegroundColor Cyan
Get-ChildItem -Path $BackupDir -Filter "leads_backup_*.db" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object Name, @{Name="Rozmiar (KB)";Expression={[math]::Round($_.Length/1KB, 2)}}, LastWriteTime | 
    Format-Table -AutoSize
