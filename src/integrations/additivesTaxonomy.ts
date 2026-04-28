import { Additive } from "../types/dto";

const TAXONOMY_URL =
  "https://world.openfoodfacts.org/data/taxonomies/additives.json";

interface TaxonomyEntry {
  name?: Record<string, string>;
  efsa_evaluation_overexposure_risk?: Record<string, string>;
  anses_additives_of_interest?: Record<string, string>;
  efsa_evaluation_exposure_95th_greater_than_adi?: Record<string, string>;
}

const GROUP_LABELS: Record<string, string> = {
  "en:adults":      "Erwachsene",
  "en:elderly":     "Senioren",
  "en:adolescents": "Jugendliche",
  "en:children":    "Kinder",
  "en:toddlers":    "Kleinkinder",
  "en:infants":     "Säuglinge",
};

let taxonomy: Record<string, TaxonomyEntry> = {};

export async function initAdditiveTaxonomy(): Promise<void> {
  try {
    const response = await fetch(TAXONOMY_URL, {
      headers: { "User-Agent": "IngredientAnalyzerAPI/1.0" },
    });
    if (!response.ok) {
      console.warn(`[AdditiveTaxonomy] HTTP ${response.status} — additive risk data unavailable`);
      return;
    }
    taxonomy = (await response.json()) as Record<string, TaxonomyEntry>;
    console.log(`[AdditiveTaxonomy] Loaded ${Object.keys(taxonomy).length} entries`);
  } catch (err) {
    console.warn(`[AdditiveTaxonomy] Fetch failed: ${(err as Error).message}`);
  }
}

function mapRiskLevel(entry: TaxonomyEntry): Additive["risk_level"] {
  const overexposure = entry.efsa_evaluation_overexposure_risk?.en ?? "";
  if (overexposure.includes("high"))     return "Riskant";
  if (overexposure.includes("moderate")) return "Begrenztes Risiko";
  if (entry.anses_additives_of_interest?.en === "yes") return "Begrenztes Risiko";
  return "Kein Risiko";
}

function buildRiskNote(entry: TaxonomyEntry, risk_level: Additive["risk_level"]): string {
  if (risk_level === "Riskant") {
    const raw = entry.efsa_evaluation_exposure_95th_greater_than_adi?.en ?? "";
    const groups = raw
      .split(",")
      .map((g) => GROUP_LABELS[g.trim()] ?? g.trim())
      .filter(Boolean)
      .join(", ");
    return groups
      ? `EFSA: ADI-Grenzwert überschritten bei ${groups}`
      : "EFSA stuft das Überexpositionsrisiko als hoch ein";
  }
  if (risk_level === "Begrenztes Risiko") {
    const overexposure = entry.efsa_evaluation_overexposure_risk?.en ?? "";
    return overexposure.includes("moderate")
      ? "EFSA: Moderates Überexpositionsrisiko"
      : "Von ANSES (französische Lebensmittelbehörde) als kritischer Zusatzstoff eingestuft";
  }
  return "EFSA: Kein bekanntes Überexpositionsrisiko";
}

export function lookupAdditive(tag: string): Additive | null {
  // OFF tags: "en:e322", "en:e322i", "en:e322-lecithins", "en:e322i-lecithin-from-soy"
  const rawId = tag.split("-")[0]; // strip description suffix like "-lecithins"
  const match = rawId.match(/^en:(e\d+[a-z]*)/i);
  if (!match) return null;

  const normalizedKey = `en:${match[1].toLowerCase()}`;
  // Try exact match first, then strip roman-numeral subtype suffix (e322i → e322)
  const entry =
    taxonomy[normalizedKey] ??
    taxonomy[normalizedKey.replace(/(?:i{1,3}v?|vi{1,3}|iv|v|i)$/i, "")];

  if (!entry) return null;

  const id = match[1].toUpperCase();
  const name = entry.name?.de ?? entry.name?.en ?? id;
  const risk_level = mapRiskLevel(entry);
  const risk_note = buildRiskNote(entry, risk_level);

  return { id, name, risk_level, risk_note };
}
