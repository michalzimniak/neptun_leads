# 📱 Instalacja Neptun LEADs jako aplikacja mobilna

Aplikacja Neptun LEADs może być zainstalowana jako natywna aplikacja na telefonie dzięki technologii PWA (Progressive Web App).

## 📥 Jak zainstalować na telefonie?

### Android (Chrome/Edge/Samsung Internet):

1. **Otwórz aplikację w przeglądarce:**
   - Wpisz adres: `http://192.168.1.72:5000`

2. **Zainstaluj aplikację:**
   - Kliknij menu (⋮) w prawym górnym rogu
   - Wybierz **"Dodaj do ekranu głównego"** lub **"Zainstaluj aplikację"**
   - Potwierdź instalację

3. **Gotowe!**
   - Ikona aplikacji pojawi się na ekranie głównym
   - Aplikacja uruchomi się w trybie pełnoekranowym
   - Działa jak natywna aplikacja

### iPhone/iPad (Safari):

1. **Otwórz aplikację w Safari:**
   - Wpisz adres: `http://192.168.1.72:5000`

2. **Zainstaluj aplikację:**
   - Kliknij przycisk **Udostępnij** (□↑) na dolnym pasku
   - Przewiń w dół i wybierz **"Dodaj do ekranu początkowego"**
   - Zmień nazwę jeśli chcesz
   - Kliknij **"Dodaj"**

3. **Gotowe!**
   - Ikona pojawi się na ekranie głównym
   - Aplikacja uruchomi się w trybie pełnoekranowym

## 🌟 Zalety instalacji jako aplikacja:

✅ **Szybki dostęp** - ikona na ekranie głównym
✅ **Tryb pełnoekranowy** - bez paska przeglądarki
✅ **Działa offline** - podstawowe funkcje dostępne bez internetu
✅ **Lepsze doświadczenie** - jak natywna aplikacja
✅ **Automatyczne aktualizacje** - zawsze najnowsza wersja

## 🔄 Praca offline

Po zainstalowaniu aplikacja będzie działać częściowo offline:
- Przeglądanie mapy
- Dostęp do wcześniej załadowanych danych
- Interfejs użytkownika

**Uwaga:** Dodawanie nowych danych wymaga połączenia z internetem.

## 🗑️ Jak odinstalować?

### Android:
1. Długo przytrzymaj ikonę aplikacji
2. Wybierz **"Odinstaluj"** lub przeciągnij do kosza

### iOS:
1. Długo przytrzymaj ikonę aplikacji
2. Wybierz **"Usuń aplikację"**
3. Potwierdź usunięcie

## ⚠️ Wymagania

- Aplikacja musi być dostępna przez sieć (WiFi)
- Adres IP serwera: `192.168.1.72`
- Port: `5000`
- Przeglądarka wspierająca PWA (Chrome, Edge, Safari)

## 🔧 Dla administratorów

### Aktualizacja Service Worker:

Po zmianach w aplikacji, zaktualizuj wersję cache w `static/sw.js`:

```javascript
const CACHE_NAME = 'neptun-leads-v2'; // Zmień wersję
```

### Regeneracja ikon:

```powershell
python generate_icons.py
```

### Własne ikony:

Zamień wygenerowane ikony w katalogu `static/` na własne:
- icon-72.png
- icon-96.png
- icon-128.png
- icon-144.png
- icon-152.png
- icon-192.png
- icon-384.png
- icon-512.png

Format: PNG, kwadratowe, przezroczyste tło opcjonalne.

## 📊 Statystyki instalacji

Sprawdź w Chrome DevTools:
1. Otwórz DevTools (F12)
2. Zakładka **Application**
3. Sekcja **Manifest** - sprawdź konfigurację
4. Sekcja **Service Workers** - sprawdź status

## ❓ Rozwiązywanie problemów

### Nie widzę opcji "Dodaj do ekranu głównego"

- Upewnij się, że używasz HTTPS lub localhost
- Sprawdź czy manifest.json jest dostępny: `/manifest.json`
- Sprawdź czy Service Worker działa
- Odśwież stronę (Ctrl+F5 lub Cmd+Shift+R)

### Aplikacja nie działa offline

- Poczekaj chwilę po pierwszym otwarciu (cache się buduje)
- Sprawdź w DevTools > Application > Cache Storage
- Service Worker musi być aktywny

### Ikona nie wyświetla się poprawnie

- Sprawdź czy wszystkie ikony istnieją w `static/`
- Przebuduj cache Service Worker (zmień wersję)
- Wyczyść cache przeglądarki

## 🚀 Deployment dla produkcji

Dla pełnego wsparcia PWA w produkcji:

1. **Użyj HTTPS** (wymagane dla większości funkcji PWA)
2. **Skonfiguruj CDN** dla szybszego ładowania
3. **Zoptymalizuj ikony** (kompresja PNG)
4. **Dodaj offline fallback** dla wszystkich tras
5. **Włącz push notifications** (opcjonalnie)

## 📚 Więcej informacji

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Manifest Generator](https://www.simicart.com/manifest-generator.html/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
