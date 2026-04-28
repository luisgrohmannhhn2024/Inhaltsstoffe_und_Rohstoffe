# Service Inhaltsstoffe & Rohstoffe

## Anleitung

### 1) Docker installieren und starten

### 2) Groq API Key erstellen ([console.groq.com](https://console.groq.com))

### 3) .env im Projektordner anlegen

```bash
# 1) in Projektverzeichnis navigieren
cd /Inhaltsstoffe_und_Rohstoffe
# 2) .env anlegen
cp .env.example .env
# 3) GROQ_API_KEY in .env eintragen
GROQ_API_KEY=
```

### 4) Service in/mit Docker starten
```bash
# 1) In Projektverzeichnis navigieren
cd /Inhaltsstoffe_und_Rohstoffe
# 2) Docker compose up
docker compose up --build
```


Service läuft danach auf `http://localhost:3000`.

Alternativ ohne Compose:
```bash
docker build -t ingredient-api .
docker run -e GROQ_API_KEY=<key> -p 3000:3000 ingredient-api
```

---

## Endpunkte

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/products/:ean` | JSON-Output mit EAN (8–14 Stellen) |
| `GET` | `/api-docs` | Swagger UI |
| `GET` | `/api-docs.json` | OpenAPI 3.0 Spec |

**Fehlercodes:**

| Status | Bedeutung |
|---|---|
| 400 | Ungültiges EAN-Format |
| 404 | Produkt nicht in Open Food Facts gefunden |
| 422 | Produkt gefunden, aber keine Zutatendaten vorhanden |
| 503 | Groq API nicht erreichbar / `GROQ_API_KEY` fehlt |

## JSON-Struktur

**Beispiel mit Zusatzstoffen** — `GET /api/products/5449000000996` (Coca-Cola):

```json
{
  "product": {
    "ean": "5449000000996",
    "name": "Coca-Cola",
    "ingredients": [
      {
        "name": "Wasser",
        "raw_materials": [{ "name": "Wasser", "origin": "unknown" }],
        "is_allergen": false
      },
      {
        "name": "Zuckerkulör",
        "raw_materials": [{ "name": "Zucker", "origin": "unknown" }],
        "is_allergen": false
      }
    ],
    "additives": [
      {
        "id": "en:e150d",
        "name": "Zuckerkulör (Ammoniumsulfit-Prozess)",
        "risk_level": "Begrenztes Risiko",
        "risk_note": "Kann bei empfindlichen Personen Reaktionen auslösen"
      },
      {
        "id": "en:e338",
        "name": "Phosphorsäure",
        "risk_level": "Begrenztes Risiko",
        "risk_note": "Hoher Konsum kann die Calciumaufnahme beeinträchtigen"
      }
    ],
    "meta": {
      "brand": "Coca-Cola",
      "quantity": "330ml",
      "nutriscore_grade": "e",
      "nova_group": 4,
      "ecoscore_grade": "c",
      "nutriments": {
        "energy_kcal_100g": 42,
        "fat_100g": 0,
        "saturated_fat_100g": 0,
        "carbohydrates_100g": 10.6,
        "sugars_100g": 10.6,
        "fiber_100g": 0,
        "proteins_100g": 0,
        "salt_100g": 0
      }
    }
  }
}
```