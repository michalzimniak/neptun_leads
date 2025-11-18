# Użyj oficjalnego obrazu Python
FROM python:3.11-slim

# Ustaw katalog roboczy
WORKDIR /app

# Skopiuj plik requirements
COPY requirements.txt .

# Zainstaluj zależności
RUN pip install --no-cache-dir -r requirements.txt

# Skopiuj całą aplikację
COPY . .

# Utwórz katalog na bazę danych
RUN mkdir -p /app/data

# Ustaw zmienne środowiskowe
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Eksponuj port 5000
EXPOSE 5000

# Uruchom aplikację
CMD ["python", "app.py"]
