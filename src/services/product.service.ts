import { fetchProductByEan } from "../integrations/openFoodFactsClient";
import { lookupAdditive } from "../integrations/additivesTaxonomy";
import { RawMaterialAnalyzer } from "../interfaces/rawMaterialAnalyzer.interface";
import { Additive, Ingredient, OpenFoodFactsProduct, ProductMeta, ProductResponse } from "../types/dto";
import { AppError } from "../types/errors";

function extractIngredientText(product: OpenFoodFactsProduct): string {
  if (product.ingredients_text_de?.trim()) return product.ingredients_text_de.trim();
  if (product.ingredients_text?.trim()) return product.ingredients_text.trim();
  if (product.ingredients && product.ingredients.length > 0) {
    return product.ingredients
      .map((i) => i.text ?? i.id ?? "")
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function extractProductName(product: OpenFoodFactsProduct): string {
  return product.product_name_de?.trim() || product.product_name?.trim() || "Unknown Product";
}

function isAllergenIngredient(name: string, product: OpenFoodFactsProduct): boolean {
  const normalizedName = name.toLowerCase();
  const tags = product.allergens_tags ?? [];

  const hasTag = (tag: string) => tags.includes(tag);

  if (hasTag("en:milk") && /(milch|molke|butter|lactose|laktose)/i.test(normalizedName)) {
    return true;
  }

  if (hasTag("en:nuts") && /(haselnuss|haselnüsse|mandel|walnuss|cashew|pistazie)/i.test(normalizedName)) {
    return true;
  }

  if (hasTag("en:soybeans") && /(soja|sojabohne|lecithin|lecithine)/i.test(normalizedName)) {
    return true;
  }

  if (hasTag("en:gluten") && /(weizen|roggen|gerste|hafer|dinkel|gluten)/i.test(normalizedName)) {
    return true;
  }

  if (hasTag("en:eggs") && /(ei|eier|eigelb|eiweiß)/i.test(normalizedName)) {
    return true;
  }

  return false;
}

function enrichIngredients(
  ingredients: Ingredient[],
  product: OpenFoodFactsProduct,
): Ingredient[] {
  return ingredients.map((ingredient) => ({
    ...ingredient,
    is_allergen: isAllergenIngredient(ingredient.name, product),
    raw_materials: ingredient.raw_materials.map((rawMaterial) => ({
      ...rawMaterial
    })),
  }));
}

function extractAdditives(product: OpenFoodFactsProduct): Additive[] {
  if (!product.additives_tags) return [];
  return product.additives_tags
    .map(lookupAdditive)
    .filter((a): a is Additive => a !== null);
}

function extractMeta(product: OpenFoodFactsProduct): ProductMeta {
  const novaRaw = product.nova_groups;
  const novaGroup = novaRaw ? parseInt(novaRaw, 10) : undefined;

  return {
    brand: product.brands?.split(",")[0]?.trim() || undefined,
    quantity: product.quantity?.trim() || undefined,
    nutriscore_grade: product.nutriscore_grade?.toLowerCase() || undefined,
    nova_group: Number.isNaN(novaGroup) ? undefined : novaGroup,
    ecoscore_grade: product.ecoscore_grade?.toLowerCase() || undefined,
    nutriments: product.nutriments
      ? {
          energy_kcal_100g: product.nutriments["energy-kcal_100g"],
          fat_100g: product.nutriments.fat_100g,
          saturated_fat_100g: product.nutriments["saturated-fat_100g"],
          carbohydrates_100g: product.nutriments.carbohydrates_100g,
          sugars_100g: product.nutriments.sugars_100g,
          fiber_100g: product.nutriments.fiber_100g,
          proteins_100g: product.nutriments.proteins_100g,
          salt_100g: product.nutriments.salt_100g,
        }
      : undefined,
  };
}

export class ProductService {
  constructor(private readonly analyzer: RawMaterialAnalyzer) {}

  async getEnrichedProduct(ean: string): Promise<ProductResponse> {
    const rawProduct = await fetchProductByEan(ean);
    const name = extractProductName(rawProduct);
    const ingredientText = extractIngredientText(rawProduct);

    if (!ingredientText) {
      throw new AppError(422, `Product "${name}" has no ingredient data`);
    }

    console.log(`[ProductService] Analyzing EAN ${ean} — "${name}"`);

    const analyzedIngredients = await this.analyzer.analyze(ingredientText);
    const ingredients = enrichIngredients(analyzedIngredients, rawProduct);
    const additives = extractAdditives(rawProduct);

    const meta = extractMeta(rawProduct);

    return { product: { ean, name, ingredients, additives, meta } };
  }
}
