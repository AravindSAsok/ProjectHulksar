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
