export interface RawMaterial {
  name: string;
  origin?: string;
}

export interface Ingredient {
  name: string;
  is_allergen?: boolean;
  raw_materials: RawMaterial[];
}

export interface Additive {
  id: string;
  name: string;
  risk_level: "Kein Risiko" | "Begrenztes Risiko" | "Riskant";
  risk_note: string;
}

export interface ProductMeta {
  brand?: string;
  quantity?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  ecoscore_grade?: string;
  nutriments?: {
    energy_kcal_100g?: number;
    fat_100g?: number;
    saturated_fat_100g?: number;
    carbohydrates_100g?: number;
    sugars_100g?: number;
    fiber_100g?: number;
    proteins_100g?: number;
    salt_100g?: number;
  };
}

export interface ProductResponse {
  product: {
    ean: string;
    name: string;
    ingredients: Ingredient[];
    additives: Additive[];
    meta: ProductMeta;
  };
}

export interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_de?: string;
  ingredients_text?: string;
  ingredients_text_de?: string;
  ingredients?: Array<{ text?: string; id?: string }>;
  allergens_tags?: string[];
  additives_tags?: string[];
  brands?: string;
  quantity?: string;
  nutriscore_grade?: string;
  nova_groups?: string;
  ecoscore_grade?: string;
  image_url?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    fat_100g?: number;
    "saturated-fat_100g"?: number;
    carbohydrates_100g?: number;
    sugars_100g?: number;
    fiber_100g?: number;
    proteins_100g?: number;
    salt_100g?: number;
  };
}

export interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}