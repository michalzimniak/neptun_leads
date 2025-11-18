# Mapa Leadów

Prosta aplikacja WWW do zarządzania leadami z interaktywną mapą.

## Funkcje

- 📍 Interaktywna mapa z możliwością dodawania lokalizacji (miejscowości i osiedli)
- 📊 Rejestrowanie leadów i odmów dla każdej lokalizacji z datą
- 💡 Tooltipsy pokazujące dane po najechaniu na lokalizację
- 📅 Filtrowanie danych według daty
- 📈 Panel ze statystykami

## Technologie

- **Backend**: Flask (Python)
- **Baza danych**: SQLite
- **Frontend**: HTML, CSS, JavaScript
- **Mapa**: Leaflet.js (darmowa, OpenStreetMap)
- **UI**: Bootstrap 5

## Instalacja

1. Zainstaluj zależności:
```bash
pip install -r requirements.txt
```

2. Uruchom aplikację:
```bash
python app.py
```

3. Otwórz przeglądarkę i przejdź do:
```
http://localhost:5000
```

## Jak używać

1. **Dodawanie lokalizacji**: Kliknij przycisk "+" w prawym dolnym rogu, podaj nazwę i kliknij na mapie, aby wybrać lokalizację.

2. **Dodawanie danych**: Kliknij na marker lokalizacji na mapie, aby otworzyć formularz. Wprowadź datę, liczbę leadów i liczbę odmów.

3. **Tooltipsy**: Najedź kursorem na marker, aby zobaczyć szczegóły lokalizacji i dane.

4. **Filtrowanie**: Użyj filtra daty w prawym górnym rogu, aby wyświetlić dane tylko dla wybranej daty.

5. **Statystyki**: Kliknij przycisk "Statystyki" w górnym pasku, aby zobaczyć podsumowanie.

## Struktura projektu

```
Map/
├── app.py                 # Backend Flask
├── requirements.txt       # Zależności Python
├── leads.db              # Baza danych SQLite (tworzona automatycznie)
├── templates/
│   └── index.html        # Strona HTML
└── static/
    └── app.js            # JavaScript dla mapy i interakcji
```

## API Endpoints

- `GET /api/locations` - Pobierz wszystkie lokalizacje
- `POST /api/locations` - Dodaj nową lokalizację
- `DELETE /api/locations/<id>` - Usuń lokalizację
- `GET /api/lead-data` - Pobierz dane leadów
- `POST /api/lead-data` - Dodaj/zaktualizuj dane leadów
- `DELETE /api/lead-data/<id>` - Usuń dane leadów
