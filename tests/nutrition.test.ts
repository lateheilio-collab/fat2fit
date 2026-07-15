import { describe, it, expect } from "vitest";
import {
  scaleRecipeIngredients,
  compileShoppingList,
  scoreRecipesForPlan,
  Recipe
} from "../src/lib/calculations/nutrition";

describe("Recipe Ingredient Scaling", () => {
  it("should scale quantities by serving count and portion size factor", () => {
    const ingredients = [
      { name: "Kaurahiutale", amount: 100, unit: "g", category: "Kuiva-aineet" },
      { name: "Maito", amount: 200, unit: "ml", category: "Maitotuotteet" }
    ];
    // 2 servings * 0.8 portion factor = 1.6x multiplier
    const scaled = scaleRecipeIngredients(ingredients, 0.8, 2);
    
    expect(scaled[0].amount).toBe(160);
    expect(scaled[0].unit).toBe("g");
    expect(scaled[1].amount).toBe(320);
  });

  it("should normalize units (e.g., convert 1200g to 1.2kg)", () => {
    const ingredients = [
      { name: "Peruna", amount: 600, unit: "g", category: "Vihannekset" }
    ];
    const scaled = scaleRecipeIngredients(ingredients, 1.0, 2); // 1200g total
    expect(scaled[0].amount).toBe(1.2);
    expect(scaled[0].unit).toBe("kg");
  });
});

describe("Shopping List Compiler", () => {
  it("should merge duplicate ingredients and flag pantry items", () => {
    const meals = [
      {
        ingredients: [
          { name: "Broileri", amount: 400, unit: "g", category: "Liha" },
          { name: "Riisi", amount: 150, unit: "g", category: "Kuiva-aineet" }
        ]
      },
      {
        ingredients: [
          { name: "broileri ", amount: 300, unit: "g", category: "Liha" }, // case and space check
          { name: "Oliiviöljy", amount: 15, unit: "ml", category: "Mausteet" }
        ]
      }
    ];

    const pantry = ["oliiviöljy"];
    const shoppingList = compileShoppingList(meals, pantry);

    expect(shoppingList.length).toBe(3);
    
    const chicken = shoppingList.find(i => i.name === "Broileri");
    expect(chicken?.amount).toBe(700);
    expect(chicken?.inPantry).toBe(false);

    const oil = shoppingList.find(i => i.name === "Oliiviöljy");
    expect(oil?.inPantry).toBe(true);
  });
});

describe("Recipe Score Adaptations", () => {
  const sampleRecipes: Recipe[] = [
    {
      id: "r1",
      name: "Tofukulho",
      ingredients: [{ name: "Tofu", amount: 150, unit: "g", category: "Kasvis" }],
      calories_per_serving: 450,
      protein_per_serving: 25,
      carbohydrates_per_serving: 40,
      fat_per_serving: 15,
      dietary_tags: ["vegetarian", "vegan"],
      allergen_tags: ["soya"],
      meal_type: "lunch",
      cooking_time: 15,
      estimated_cost: "low"
    },
    {
      id: "r2",
      name: "Kanapasta",
      ingredients: [{ name: "Broileri", amount: 200, unit: "g", category: "Liha" }],
      calories_per_serving: 650,
      protein_per_serving: 45,
      carbohydrates_per_serving: 60,
      fat_per_serving: 18,
      dietary_tags: [],
      allergen_tags: ["gluten"],
      meal_type: "dinner",
      cooking_time: 25,
      estimated_cost: "medium"
    }
  ];

  it("should filter out soybean allergen recipes for soy-allergic users", () => {
    const profile = { diet_type: "standard", allergies: ["soya"], cooking_time_limit: 45 };
    const remaining = { calories: 500, protein: 30, carbs: 50, fat: 15 };
    
    const scored = scoreRecipesForPlan(sampleRecipes, profile, remaining);
    expect(scored.length).toBe(1);
    expect(scored[0].recipe.name).toBe("Kanapasta");
  });

  it("should filter out meat recipes for vegetarian users", () => {
    const profile = { diet_type: "vegetarian", allergies: [], cooking_time_limit: 45 };
    const remaining = { calories: 500, protein: 30, carbs: 50, fat: 15 };
    
    const scored = scoreRecipesForPlan(sampleRecipes, profile, remaining);
    expect(scored.length).toBe(1);
    expect(scored[0].recipe.name).toBe("Tofukulho");
  });

  it("should score closest macro matches higher", () => {
    const profile = { diet_type: "standard", allergies: [], cooking_time_limit: 45 };
    const remaining = { calories: 430, protein: 24, carbs: 42, fat: 14 }; // close to Tofukulho (450)
    
    const scored = scoreRecipesForPlan(sampleRecipes, profile, remaining);
    expect(scored[0].recipe.name).toBe("Tofukulho");
  });
});
