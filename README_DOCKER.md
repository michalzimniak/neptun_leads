# Neptun LEADs - Docker Deployment

## 🚀 Szybki Start

**Najłatwiejsza metoda - użyj skryptu menedżera:**

```powershell
.\start.ps1
```

Skrypt oferuje interaktywne menu do:
- Uruchamiania aplikacji (dev/production)
- Zatrzymywania i restartowania
- Przeglądania logów
- Tworzenia i przywracania backupów
- Sprawdzania statusu

## Wymagania
- Docker Desktop zainstalowany na Windows
- Docker Compose (wchodzi w skład Docker Desktop)

## Uruchomienie aplikacji

### ⭐ Metoda 1: Interaktywny Manager (zalecane)

```powershell
.\start.ps1
```

### Metoda 2: Docker Compose (manualnie)

1. **Zbuduj i uruchom kontener:**
```powershell
docker-compose up -d --build
```

2. **Aplikacja będzie dostępna pod adresem:**
- http://localhost:5000
- http://192.168.1.72:5000 (z innych urządzeń w sieci)

3. **Sprawdź status kontenera:**
```powershell
docker-compose ps
```

4. **Zobacz logi aplikacji:**
```powershell
docker-compose logs -f neptun-leads
```

5. **Zatrzymaj aplikację:**
```powershell
docker-compose down
```

### Metoda 3: Production z Gunicorn

**Dla środowiska produkcyjnego użyj:**

```powershell
docker-compose -f docker-compose.production.yml up -d --build
```

Ta wersja używa Gunicorn (4 workery) dla lepszej wydajności i stabilności.

### Opcja 4: Bezpośrednio Docker

1. **Zbuduj obraz:**
```powershell
docker build -t neptun-leads .
```

2. **Uruchom kontener:**
```powershell
docker run -d -p 5000:5000 --name neptun-leads-app -v ${PWD}/leads.db:/app/leads.db neptun-leads
```

3. **Zatrzymaj kontener:**
```powershell
docker stop neptun-leads-app
docker rm neptun-leads-app
```

## Zarządzanie danymi

Baza danych SQLite (`leads.db`) jest montowana jako volume, więc dane przetrwają restart kontenera.

### 🔄 Automatyczne backupy (zalecane):

**Utwórz backup:**
```powershell
.\backup.ps1
```

**Przywróć backup:**
```powershell
.\restore.ps1
```

Skrypt backupu:
- Automatycznie tworzy katalog `backups`
- Dodaje timestamp do nazwy pliku
- Usuwa backupy starsze niż 30 dni
- Pokazuje listę wszystkich backupów

### Manualne backupy:
```powershell
docker cp neptun-leads-app:/app/leads.db ./backup_leads_$(Get-Date -Format "yyyyMMdd_HHmmss").db
```

### Przywracanie bazy danych:
```powershell
docker cp ./backup_leads.db neptun-leads-app:/app/leads.db
docker-compose restart
```

### 📅 Zaplanowane backupy (Windows Task Scheduler)

Utwórz zadanie w Harmonogramie zadań Windows:
1. Otwórz Task Scheduler
2. Utwórz podstawowe zadanie
3. Trigger: Codziennie o 2:00
4. Akcja: Uruchom program
   - Program: `powershell.exe`
   - Argumenty: `-File "C:\Users\mzimn\OneDrive\Documents\Map\backup.ps1"`

## Monitoring i Debugging

1. **Pobierz najnowszy kod**
2. **Przebuduj i uruchom:**
```powershell
docker-compose down
docker-compose up -d --build
```

## Debugging

### Wejdź do kontenera:
```powershell
docker exec -it neptun-leads-app /bin/bash
```

### Zobacz logi w czasie rzeczywistym:
```powershell
docker-compose logs -f
```

### Sprawdź zużycie zasobów:
```powershell
docker stats
```

### Health check:
```powershell
docker inspect neptun-leads-prod | Select-String -Pattern "Health"
```

## Aktualizacja aplikacji

Możesz dostosować konfigurację przez plik `.env`:

```
FLASK_ENV=production
SECRET_KEY=your-secret-key-here
DATABASE_PATH=/app/data/leads.db
```

## Producja

Dla produkcyjnego wdrożenia zalecane jest:
1. Użycie serwera WSGI (Gunicorn)
2. Proxy nginx przed aplikacją
3. HTTPS z certyfikatem SSL
4. Regularne backupy bazy danych

### Przykład z Gunicorn:

Dodaj do `requirements.txt`:
```
gunicorn==21.2.0
```

Zmień `CMD` w Dockerfile:
```dockerfile
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```
