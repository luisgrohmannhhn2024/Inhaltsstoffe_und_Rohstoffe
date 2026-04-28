import { Ingredient } from "../types/dto";

export interface RawMaterialAnalyzer {
  analyze(ingredientText: string): Promise<Ingredient[]>;
}
