import { RawMaterialAnalyzer } from "../interfaces/rawMaterialAnalyzer.interface";
import { Ingredient } from "../types/dto";
import { AppError } from "../types/errors";

const GROQ_API_BASE = process.env.GROQ_API_BASE_URL ?? "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

const SYSTEM_PROMPT =
  "Du bist ein Lebensmittelwissenschaftler. Du erhältst eine Zutatenliste und analysierst jede Zutat, " +
  "um ihre primären Rohstoffe zu identifizieren.\n\n" +
  "Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in diesem Format:\n" +
  '{\n' +
  '  "ingredients": [\n' +
  '    {\n' +
  '      "name": "<bereinigter deutscher Zutatenname>",\n' +
  '      "raw_materials": [\n' +
  '        {\n' +
  '          "name": "<deutscher Rohstoffname>",\n' +
  '          "origin": "<typische Herkunftsregion, z.B. Europa, Westafrika, Südostasien oder Industriell>"\n' +
  '        }\n' +
  '      ]\n' +
  '    }\n' +
  '  ]\n' +
  '}\n\n' +
  "REGELN:\n" +
  "1. Kein Markdown, keine Erklärungen — nur das JSON-Objekt.\n" +
  "2. \"name\" der Zutat: bereinigter deutscher Name, ohne Prozentzahlen, E-Nummern, Klammern.\n" +
  '3. Beispiele: "NOISETTES 13%" → "Haselnüsse", "huile de palme" → "Palmöl"\n' +
  "4. Alle Namen auf Deutsch.\n" +
  "5. origin: typische Herkunftsregion des Rohstoffs, falls sinnvoll bestimmbar. Sonst \"unknown\"."

function parseResponse(content: string): Ingredient[] {
  const parsed = JSON.parse(content) as Record<string, unknown>;

  if (!Array.isArray(parsed.ingredients)) {
    throw new Error("Response missing 'ingredients' array");
  }

  return (parsed.ingredients as Array<Record<string, unknown>>).map((entry) => {
    if (typeof entry.name !== "string") throw new Error("Ingredient missing 'name'");
    if (!Array.isArray(entry.raw_materials)) throw new Error("Ingredient missing 'raw_materials'");

    return {
      name: entry.name,
      raw_materials: (entry.raw_materials as Array<Record<string, unknown>>).map((rm) => {
        return {
          name: String(rm.name ?? "unknown"),
          origin: typeof rm.origin === "string" ? rm.origin : "unknown",
        };
      }),
    };
  });
}

export class GroqAnalyzer implements RawMaterialAnalyzer {
  async analyze(ingredientText: string): Promise<Ingredient[]> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new AppError(503, "GROQ_API_KEY is not configured");

    let response: Response;
    try {
      response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Analysiere folgende Zutaten:\n\n${ingredientText}` },
          ],
          temperature: 0.1,
          max_tokens: 2048,
          response_format: { type: "json_object" },
        }),
      });
    } catch (err) {
      throw new AppError(503, `Groq API not reachable: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new AppError(503, `Groq API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new AppError(502, "Groq returned empty response");

    try {
      const ingredients = parseResponse(content);
      console.log(`[GroqAnalyzer] ${ingredients.length} ingredients parsed`);
      return ingredients;
    } catch (err) {
      throw new AppError(502, `Groq response invalid: ${(err as Error).message}`);
    }
  }
}
