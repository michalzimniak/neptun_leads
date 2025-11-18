# 🚀 SZYBKI START - Neptun LEADs

## Pierwsze uruchomienie

1. **Upewnij się, że Docker Desktop jest uruchomiony**
   - Otwórz Docker Desktop
   - Poczekaj aż w lewym dolnym rogu pojawi się zielony status

2. **Uruchom aplikację:**
   ```powershell
   .\start.ps1
   ```
   Wybierz opcję **1** (development) lub **2** (production)

3. **Otwórz przeglądarkę:**
   - http://localhost:5000

## Pierwsze logowanie

1. Kliknij **"Zarejestruj się"**
2. Utwórz konto (min 3 znaki username, min 6 znaków hasło)
3. Po rejestracji zostaniesz automatycznie zalogowany

## Codzienne użytkowanie

### Uruchomienie aplikacji:
```powershell
.\start.ps1
# Wybierz opcję 1
```

### Zatrzymanie aplikacji:
```powershell
.\start.ps1
# Wybierz opcję 3
```

### Backup przed ważnymi zmianami:
```powershell
.\start.ps1
# Wybierz opcję 7
```

### W razie problemów:
```powershell
.\start.ps1
# Wybierz opcję 5 (zobacz logi)
```

## Podstawowe komendy

| Komenda | Opis |
|---------|------|
| `.\start.ps1` | Menu zarządzania |
| `.\backup.ps1` | Szybki backup |
| `.\restore.ps1` | Przywróć backup |
| `docker-compose ps` | Status kontenera |
| `docker-compose logs -f` | Zobacz logi na żywo |

## Dostęp z innych urządzeń w sieci

Aplikacja jest dostępna pod adresem:
- **Z tego komputera:** http://localhost:5000
- **Z innych urządzeń:** http://192.168.1.72:5000

## Backup i bezpieczeństwo

### Automatyczny backup (zalecane):
1. Uruchom `.\start.ps1`
2. Wybierz opcję 7
3. Backupy są zapisywane w katalogu `backups/`
4. Stare backupy (>30 dni) są automatycznie usuwane

### Zaplanuj automatyczne backupy:
Zobacz sekcję "Zaplanowane backupy" w README_DOCKER.md

## Rozwiązywanie problemów

### Problem: "Kontener nie może się uruchomić"
```powershell
docker-compose down
docker-compose up -d --build
```

### Problem: "Port 5000 już zajęty"
```powershell
# Sprawdź co używa portu
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess

# Zatrzymaj istniejący kontener
docker-compose down
```

### Problem: "Baza danych uszkodzona"
```powershell
.\restore.ps1
# Wybierz najnowszy backup
```

### Problem: "Aplikacja działa wolno"
Użyj wersji production z Gunicorn:
```powershell
docker-compose -f docker-compose.production.yml up -d --build
```

## Aktualizacja aplikacji

1. Zatrzymaj kontener: `docker-compose down`
2. Utwórz backup: `.\backup.ps1`
3. Pobierz nowe pliki aplikacji
4. Uruchom ponownie: `docker-compose up -d --build`

## Wsparcie

- **Logi aplikacji:** `docker-compose logs -f`
- **Wejdź do kontenera:** `docker exec -it neptun-leads-app /bin/bash`
- **Sprawdź bazę:** `docker exec -it neptun-leads-app ls -lh /app/leads.db`

## Produkcja - dodatkowe kroki

Dla wdrożenia produkcyjnego zaleca się:

1. **Zmień domyślny klucz sesji:**
   - Edytuj `app.py`
   - Zmień `app.secret_key` na losowy 64-znakowy ciąg

2. **Użyj HTTPS:**
   - Skonfiguruj nginx jako reverse proxy
   - Zainstaluj certyfikat SSL (Let's Encrypt)

3. **Włącz firewall:**
   - Zezwól tylko na port 80/443
   - Zablokuj bezpośredni dostęp do portu 5000

4. **Regularne backupy:**
   - Skonfiguruj Task Scheduler
   - Kopiuj backupy do lokalizacji zewnętrznej

## Wydajność

### Development (Dockerfile):
- Flask development server
- Debug mode
- Dobre do testowania

### Production (Dockerfile.production):
- Gunicorn WSGI server
- 4 worker processes
- Timeout 120s
- Lepsze dla wielu użytkowników

## Konfiguracja zaawansowana

Zobacz plik `.env.example` dla dostępnych opcji konfiguracji.
