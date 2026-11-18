export const FOOD_ENTITY_INTERPRETATION_RULES = [
  "Return one food item per independently consumed dish, drink, or food component — not one item per ingredient.",
  "A prepared beverage or dish remains ONE food item when it contains multiple ingredients. Ingredients and preparation modifiers belong to the parent food entity.",
  "Examples that MUST each produce exactly one item: milk tea; milk coffee; coffee with milk; coffee with milk and sugar; black coffee; tea with ginger and honey; banana smoothie with milk; rice with chicken and vegetables; chicken salad.",
  "Examples that MUST produce separate items: bread and butter (2); coffee and sandwich (2); eggs and toast (2). These describe independently consumed foods, not ingredients incorporated into one prepared dish.",
  "Use grammar and food context to distinguish a recipe from a list of foods. Phrases such as 'with', 'made with', 'mixed with', 'containing', and ingredient-style modifiers normally describe components of one dish or drink.",
  "A comma or the word 'and' alone does NOT prove that foods are separate. For ambiguous lists such as 'coffee, milk and sugar', use the surrounding context; when it plausibly describes a drink recipe, return one drink rather than splitting its ingredients. Split only when the user clearly lists independently eaten foods.",
  "For each combined dish or drink, estimate the TOTAL nutrition of the complete serving, accounting for the calories, protein, carbohydrates, and fat contributed by its ingredients. Do not estimate only the base ingredient.",
  "Preserve explicit ingredient quantities and units in your nutrition reasoning. The returned item amount should describe the complete serving, and its nutrition values must be the combined total.",
  "Do not emit separate diary items for milk, sugar, ginger, honey, vegetables, sauces, toppings, or other ingredients that are part of a named prepared dish or drink.",
  "Do not merge genuinely separate foods just because they appear in the same sentence or meal."
] as const;


export type FoodIngredientNutrition = {
  name: string;
  amount: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function parseFoodIngredients(value: unknown): FoodIngredientNutrition[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) {
    throw new Error("The AI returned an invalid ingredient breakdown.");
  }
  return value.map((entry): FoodIngredientNutrition => {
    if (!entry || typeof entry !== "object") throw new Error("The AI returned an invalid ingredient.");
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 80) : "";
    const amount = typeof row.amount === "string" ? row.amount.trim().slice(0, 80) : "";
    const number = (input: unknown) => {
      const parsed = typeof input === "number" ? input : Number(input);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) throw new Error("The AI returned invalid ingredient nutrition.");
      return Math.round(parsed * 10) / 10;
    };
    if (!name || !amount) throw new Error("The AI returned an incomplete ingredient.");
    return { name, amount, calories: number(row.calories), protein_g: number(row.protein_g), carbs_g: number(row.carbs_g), fat_g: number(row.fat_g) };
  });
}

export function aggregateIngredientNutrition(ingredients: FoodIngredientNutrition[]) {
  return ingredients.reduce((total, ingredient) => ({
    calories: total.calories + ingredient.calories,
    protein_g: total.protein_g + ingredient.protein_g,
    carbs_g: total.carbs_g + ingredient.carbs_g,
    fat_g: total.fat_g + ingredient.fat_g
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
}
