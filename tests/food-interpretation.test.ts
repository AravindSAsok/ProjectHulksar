import test from "node:test";
import assert from "node:assert/strict";
import {
  FOOD_ENTITY_INTERPRETATION_RULES,
  parseFoodIngredients,
  aggregateIngredientNutrition
} from "../src/lib/food-interpretation.ts";

test("compound drink ingredients remain one parent entity and aggregate nutrition", () => {
  const ingredients = parseFoodIngredients([
    { name: "Coffee", amount: "150 ml", calories: 2, protein_g: 0.2, carbs_g: 0, fat_g: 0 },
    { name: "Milk", amount: "100 ml", calories: 62, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3 },
    { name: "Sugar", amount: "2 tsp", calories: 32, protein_g: 0, carbs_g: 8, fat_g: 0 }
  ]);
  assert.equal(ingredients?.length, 3);
  assert.deepEqual(aggregateIngredientNutrition(ingredients!), {
    calories: 96, protein_g: 3.4, carbs_g: 12.8, fat_g: 3.3
  });
});

test("single-ingredient foods may omit ingredient breakdown", () => {
  assert.equal(parseFoodIngredients(undefined), undefined);
});

test("invalid or single-entry ingredient breakdowns are rejected", () => {
  assert.throws(() => parseFoodIngredients([{ name: "Milk", amount: "100 ml", calories: 62, protein_g: 3, carbs_g: 5, fat_g: 3 }]));
  assert.throws(() => parseFoodIngredients([
    { name: "Milk", amount: "100 ml", calories: -1, protein_g: 3, carbs_g: 5, fat_g: 3 },
    { name: "Sugar", amount: "1 tsp", calories: 16, protein_g: 0, carbs_g: 4, fat_g: 0 }
  ]));
});

test("shared AI rules include compound foods and independent food examples", () => {
  const prompt = FOOD_ENTITY_INTERPRETATION_RULES.join("\n").toLowerCase();
  for (const phrase of ["milk tea", "milk coffee", "coffee with milk and sugar", "tea with ginger and honey", "banana smoothie with milk", "rice with chicken and vegetables", "chicken salad"]) {
    assert.ok(prompt.includes(phrase), "missing compound example: " + phrase);
  }
  for (const phrase of ["bread and butter", "coffee and sandwich", "eggs and toast"]) {
    assert.ok(prompt.includes(phrase), "missing separate-food example: " + phrase);
  }
  assert.ok(prompt.includes("comma or the word 'and' alone does not prove"));
});
