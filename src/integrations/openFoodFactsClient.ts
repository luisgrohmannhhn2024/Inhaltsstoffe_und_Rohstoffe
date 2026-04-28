import { InMemoryCache } from "../cache/inMemoryCache";
import { OpenFoodFactsProduct, OpenFoodFactsResponse } from "../types/dto";
import { AppError } from "../types/errors";

const BASE_URL =
  process.env.OPEN_FOOD_FACTS_BASE_URL ?? "https://world.openfoodfacts.org";

const cache = new InMemoryCache<OpenFoodFactsProduct>(
  Number(process.env.CACHE_TTL_SECONDS ?? 300),
);

/**
 * Fetches product data from the OpenFoodFacts API with German locale preference.
 * Requests lc=de so the API returns German-localized fields where available.
 */
export async function fetchProductByEan(
  ean: string,
): Promise<OpenFoodFactsProduct> {
  const cached = cache.get(ean);
  if (cached) {
    console.log(`[OpenFoodFacts] Cache hit for EAN ${ean}`);
    return cached;
  }

  // lc=de requests German-localized data; fields like ingredients_text_de are always included
  const url = `${BASE_URL}/api/v0/product/${encodeURIComponent(ean)}.json?lc=de`;
  console.log(`[OpenFoodFacts] Fetching ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "IngredientAnalyzerAPI/1.0" },
    });
  } catch (err) {
    throw new AppError(502, `OpenFoodFacts unreachable: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new AppError(502, `OpenFoodFacts returned HTTP ${response.status}`);
  }

  let data: OpenFoodFactsResponse;
  try {
    data = (await response.json()) as OpenFoodFactsResponse;
  } catch {
    throw new AppError(502, "OpenFoodFacts returned invalid JSON");
  }

  if (data.status !== 1 || !data.product) {
    throw new AppError(404, `Product with EAN "${ean}" not found`);
  }

  const p = data.product;

  const product: OpenFoodFactsProduct = {
    product_name:        p.product_name,
    product_name_de:     p.product_name_de,
    ingredients_text:    p.ingredients_text,
    ingredients_text_de: p.ingredients_text_de,
    ingredients:         p.ingredients,
    additives_tags:      p.additives_tags,
    allergens_tags:      p.allergens_tags,
    brands:              p.brands,
    quantity:            p.quantity,
    nutriscore_grade:    p.nutriscore_grade,
    nova_groups:         p.nova_groups,
    ecoscore_grade:      p.ecoscore_grade,
    nutriments:          p.nutriments,
  };

  cache.set(ean, product);
  return product;
}
