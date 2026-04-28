# Ingredient Analyzer API

Backend-Service der per EAN-Nummer Produktdaten aus Open Food Facts abruft und die Zutatenliste via LLM auf Rohstoffe analysiert.

---

## Inhaltsverzeichnis

1. [Technologie-Stack](#1-technologie-stack)
2. [Architektur](#2-architektur)
3. [Projektstruktur](#3-projektstruktur)
4. [Datenfluss](#4-datenfluss)
5. [Open Food Facts](#5-open-food-facts)
6. [GroqAnalyzer](#6-groqanalyzer)
7. [API-Referenz](#7-api-referenz)
8. [Datenmodell (DTOs)](#8-datenmodell-dtos)
9. [Setup & Quickstart](#9-setup--quickstart)
10. [Umgebungsvariablen](#10-umgebungsvariablen)
11. [Backend-Integration](#11-backend-integration)

---

## 1. Technologie-Stack

| Komponente | Technologie |
|---|---|
| Sprache | **TypeScript** |
| Runtime | **Node.js** |
| Framework | **Express** |
| KI-Provider | **Groq API** (Llama 3.3 70B) |
| Externe Daten | **Open Food Facts API** |
| API-Dokumentation | **Swagger UI** |
| Umgebungsvariablen | **dotenv** |

---

## 2. Architektur

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────┐
│         Controller Layer            │
│   ProductController (Express Router)│
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│          Service Layer              │
│         ProductService              │
└──────┬──────────────────────────────┘
       │
       ├──────────────────────────────────────────┐
       ▼                                          ▼
┌──────────────────────┐            ┌─────────────────────────┐
│   Integration Layer  │            │       AI Layer           │
│  OpenFoodFactsClient │            │  GroqAnalyzer            │
│  + In-Memory-Cache   │            │  (RawMaterialAnalyzer)   │
└──────────────────────┘            └─────────────────────────┘
                  │
                  ▼
        HTTP Response (JSON)
```

Der `GroqAnalyzer` ist über das `RawMaterialAnalyzer`-Interface austauschbar – ein anderer KI-Provider lässt sich einbinden ohne andere Schichten anzufassen.

---

## 3. Projektstruktur

```
nodejs_prototype/
├── .env                          ← Lokale Umgebungsvariablen (nicht im Git)
├── .env.example                  ← Vorlage für neue Entwickler
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts
    ├── app.ts                    ← Express-Setup, Swagger, Dependency Injection
    │
    ├── controllers/
    │   └── product.controller.ts ← GET /api/products/:ean
    │
    ├── services/
    │   └── product.service.ts
    │
    ├── integrations/
    │   ├── openFoodFactsClient.ts
    │   └── groqAnalyzer.ts
    │
    ├── interfaces/
    │   └── rawMaterialAnalyzer.interface.ts
    │
    ├── cache/
    │   └── inMemoryCache.ts
    │
    ├── middleware/
    │   └── errorHandler.ts
    │
    └── types/
        ├── dto.ts
        └── errors.ts
```

---

## 4. Datenfluss

Beispiel: `GET /api/products/3017620422003` (Nutella)

```
Schritt 1: Validierung
─────────────────────────────────────────────────────
  GET /api/products/3017620422003
  └─► EAN-Regex: /^\d{8,14}$/  ✓


Schritt 2: Produkt abrufen
─────────────────────────────────────────────────────
  openFoodFactsClient.fetchProductByEan("3017620422003")
  ├─► Cache-Check → miss → HTTP GET Open Food Facts
  └─► Rückgabe: { product_name_de, ingredients_text_de, brands, ... }


Schritt 3: Zutatentext extrahieren
─────────────────────────────────────────────────────
  Priorität 1: ingredients_text_de
  Priorität 2: ingredients_text
  Priorität 3: ingredients[].text

  Ergebnis: "Zucker, Palmöl, HASELNÜSSE 13%, fettarmer Kakao 7,4%, ..."


Schritt 4: KI-Analyse
─────────────────────────────────────────────────────
  GroqAnalyzer.analyze(ingredientText)
  ├─► POST https://api.groq.com/openai/v1/chat/completions
  │   model: llama-3.3-70b-versatile, temperature: 0.1
  │   response_format: { type: "json_object" }
  └─► Rückgabe: { "ingredients": [{ "name": ..., "raw_materials": [...] }] }


Schritt 5: Response
─────────────────────────────────────────────────────
  { product: { ean, name, ingredients, meta } }
```

---

## 5. Open Food Facts

API-Call:
```
GET https://world.openfoodfacts.org/api/v0/product/{EAN}.json?lc=de
```

Abgerufene Felder:

| Feld | Verwendung |
|---|---|
| `product_name_de` / `product_name` | Produktname |
| `ingredients_text_de` | Zutatenliste auf Deutsch (bevorzugt) |
| `ingredients_text` | Zutatenliste Originalsprache (Fallback) |
| `ingredients[]` | Strukturierte Zutatenliste (letzter Fallback) |
| `brands` | Markenname |
| `quantity` | Packungsgröße |
| `nutriscore_grade` | Nutri-Score (a–e) |
| `nova_groups` | NOVA-Gruppe (1–4) |
| `ecoscore_grade` | Eco-Score |

`lc=de` sorgt dafür, dass `ingredients_text_de` befüllt wird, sofern in der Datenbank vorhanden. Fehlt das Feld, wird `ingredients_text` an den GroqAnalyzer übergeben – der System Prompt weist das Modell an, den Text selbst ins Deutsche zu übersetzen.

OFF-Responses werden **5 Minuten im Arbeitsspeicher gecacht** (`CACHE_TTL_SECONDS`).

---

## 6. GroqAnalyzer

Verwendet das OpenAI-kompatible Chat Completions Format mit `response_format: { type: "json_object" }`.

**System Prompt:**
```
Du bist ein Lebensmittelwissenschaftler. Du erhältst eine Zutatenliste und analysierst
jede Zutat, um ihre primären Rohstoffe zu identifizieren.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in diesem Format:
{
  "ingredients": [
    {
      "name": "<bereinigter deutscher Zutatenname>",
      "raw_materials": [
        {
          "name": "<deutscher Rohstoffname>",
          "category": "<plant | animal | mineral | synthetic | unknown>"
        }
      ]
    }
  ]
}

REGELN:
1. Kein Markdown, keine Erklärungen — nur das JSON-Objekt.
2. "name" der Zutat: bereinigter deutscher Name, ohne Prozentzahlen, E-Nummern, Klammern.
3. Beispiele: "NOISETTES 13%" → "Haselnüsse", "huile de palme" → "Palmöl"
4. Alle Namen auf Deutsch.
5. category: nur plant, animal, mineral, synthetic, unknown.
```

**Parsing & Validierung:**
- `ingredients` muss ein Array sein
- Jedes Element braucht `name` (String) und `raw_materials` (Array)
- Ungültige `category`-Werte werden auf `"unknown"` normalisiert
- Strukturell ungültige Antwort → HTTP 502

**Fehlerverhalten:** Kein `GROQ_API_KEY` oder API nicht erreichbar → HTTP 503, kein Fallback.

---

## 7. API-Referenz

### `GET /api/products/:ean`

**Parameter:**
- `ean` (path, required): 8–14-stellige numerische EAN

**200:**
```json
{
  "product": {
    "ean": "3017620422003",
    "name": "Nutella",
    "ingredients": [
      {
        "name": "Zucker",
        "raw_materials": [
          { "name": "Zuckerrübe", "category": "plant" }
        ]
      },
      {
        "name": "Palmöl",
        "raw_materials": [
          { "name": "Ölpalme", "category": "plant" }
        ]
      }
    ],
    "meta": {
      "brand": "Nutella",
      "quantity": "400 g",
      "nutriscore_grade": "e",
      "nova_group": 4,
      "ecoscore_grade": "d"
    }
  }
}
```

**Fehlercodes:**

| Status | Bedeutung |
|---|---|
| 400 | Ungültiges EAN-Format |
| 404 | Produkt nicht in Open Food Facts gefunden |
| 422 | Produkt gefunden, aber keine Zutatendaten vorhanden |
| 503 | Groq API nicht erreichbar oder `GROQ_API_KEY` fehlt |

---

### `GET /api-docs`

Swagger UI – Endpunkte direkt im Browser testbar.

### `GET /api-docs.json`

OpenAPI 3.0 Spec als JSON – für die Backend-Integration (siehe Abschnitt 11).

---

## 8. Datenmodell (DTOs)

```typescript
interface RawMaterial {
  name: string;
  category: "plant" | "animal" | "mineral" | "synthetic" | "unknown";
}

interface Ingredient {
  name: string;
  raw_materials: RawMaterial[];
}

interface ProductMeta {
  brand?: string;
  quantity?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  ecoscore_grade?: string;
}

interface ProductResponse {
  product: {
    ean: string;
    name: string;
    ingredients: Ingredient[];
    meta: ProductMeta;
  };
}
```

---

## 9. Setup & Quickstart

**Voraussetzungen:**
- Node.js ≥ 18
- Groq API-Key ([console.groq.com](https://console.groq.com))

```cmd
copy .env.example .env
rem GROQ_API_KEY in .env eintragen
npm install
npm run dev
```

- **http://localhost:3000/api/products/3017620422003** – Beispiel (Nutella)
- **http://localhost:3000/api-docs** – Swagger UI

**Skripte:**

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Server mit ts-node starten |
| `npm run dev:watch` | Mit Auto-Reload |
| `npm run build` | TypeScript nach `dist/` kompilieren |
| `npm start` | Kompilierten Server starten |

---

## 10. Umgebungsvariablen

| Variable | Pflicht | Standard | Beschreibung |
|---|---|---|---|
| `GROQ_API_KEY` | **Ja** | – | API-Key für die Groq API |
| `GROQ_API_BASE_URL` | Nein | `https://api.groq.com/openai/v1` | API-Endpunkt |
| `GROQ_MODEL` | Nein | `llama-3.3-70b-versatile` | Modellname |
| `PORT` | Nein | `3000` | HTTP-Port |
| `OPEN_FOOD_FACTS_BASE_URL` | Nein | `https://world.openfoodfacts.org` | OFF-Basis-URL |
| `CACHE_TTL_SECONDS` | Nein | `300` | Cache-Lebensdauer in Sekunden |

---

## 11. Backend-Integration

Die geplante Architektur:

```
Handy-App → Backend → Dieser Service → Open Food Facts + Groq
```

Der Service läuft als eigenständiger Docker-Container im Backend-Netz und ist von außen nicht direkt erreichbar.

**Was das Backend-Team bekommt:**

- `Dockerfile` – liegt im Repo-Root
- OpenAPI-Spec – abrufbar unter `GET /api-docs.json`
- `GROQ_API_KEY` – wird separat als Secret übergeben

**Container starten:**

```bash
docker build -t ingredient-api .
docker run -e GROQ_API_KEY=xxx -p 3000:3000 ingredient-api
```
