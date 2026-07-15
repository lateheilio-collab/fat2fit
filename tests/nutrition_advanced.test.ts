import { describe, it, expect } from "vitest";
import { 
  generateWeeklyPlan, 
  getRecipeMainIngredient, 
  getRecipePrepMethod, 
  calculatePlannedDayNutrition,
  redistributePlanCalories
} from "../src/lib/calculations/nutrition";

const TEST_RECIPES = [
  {
    id: "rec-1",
    name: "Kaurapuuro marjoilla ja valkuaisella",
    calories_per_serving: 380,
    protein_per_serving: 24,
    carbohydrates_per_serving: 48,
    fat_per_serving: 8,
    meal_type: "breakfast",
    cooking_time: 5,
    estimated_cost: "low" as const,
    ingredients: []
  },
  {
    id: "rec-2",
    name: "Runsaspastainen kanapata",
    calories_per_serving: 620,
    protein_per_serving: 44,
    carbohydrates_per_serving: 65,
    fat_per_serving: 16,
    meal_type: "lunch",
    cooking_time: 15,
    estimated_cost: "medium" as const,
    ingredients: []
  },
  {
    id: "rec-3",
    name: "Maitorahka ja marjat",
    calories_per_serving: 220,
    protein_per_serving: 18,
    carbohydrates_per_serving: 26,
    fat_per_serving: 2,
    meal_type: "snack",
    cooking_time: 0,
    estimated_cost: "low" as const,
    ingredients: []
  },
  {
    id: "rec-4",
    name: "Uunilohi ja lohkoperunat",
    calories_per_serving: 680,
    protein_per_serving: 48,
    carbohydrates_per_serving: 52,
    fat_per_serving: 26,
    meal_type: "dinner",
    cooking_time: 25,
    estimated_cost: "high" as const,
    ingredients: []
  },
  {
    id: "rec-5",
    name: "Tofukulho avokadolla",
    calories_per_serving: 460,
    protein_per_serving: 26,
    carbohydrates_per_serving: 38,
    fat_per_serving: 18,
    meal_type: "lunch",
    cooking_time: 10,
    estimated_cost: "low" as const,
    ingredients: []
  },
  {
    id: "rec-6",
    name: "Nauta-riisipannu parsakaalilla",
    calories_per_serving: 580,
    protein_per_serving: 42,
    carbohydrates_per_serving: 55,
    fat_per_serving: 14,
    meal_type: "dinner",
    cooking_time: 15,
    estimated_cost: "medium" as const,
    ingredients: []
  }
];

describe("Advanced Nutrition Coach Generation & Variety Rules", () => {
  it("should extract correct main ingredient and cooking style", () => {
    expect(getRecipeMainIngredient({ name: "Kermainen kanavuoka" })).toBe("broileri");
    expect(getRecipeMainIngredient({ name: "Uunilohifilee" })).toBe("kala");
    expect(getRecipePrepMethod({ name: "Runsaspastainen kanapata" })).toBe("pata");
    expect(getRecipePrepMethod({ name: "Uunilohi" })).toBe("uuni");
  });

  it("should honor leftovers_preference two_days by copying dinner to next lunch", () => {
    const profile = { leftovers_preference: "two_days", daily_meals_count: 4 };
    const targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 };
    const workoutDates = new Set<string>();
    const monday = new Date("2026-07-06");

    const plan = generateWeeklyPlan("user-1", profile, targets, TEST_RECIPES, [], workoutDates, monday);

    expect(plan.length).toBe(7);

    const monDinner = plan[0].planned_meals.find((m: any) => m.meal_type === "dinner");
    const tueLunch = plan[1].planned_meals.find((m: any) => m.meal_type === "lunch");

    expect(tueLunch.is_leftover).toBe(true);
    expect(tueLunch.recipe_id).toBe(monDinner.recipe_id);
    expect(tueLunch.repetition_reason).toBe("Hyödynnetään tähteet");
  });

  it("should penalize and avoid repeated recipes within same category on consecutive days when leftovers=none", () => {
    const profile = { leftovers_preference: "none", daily_meals_count: 4 };
    const targets = { calories: 2000, protein: 150, carbs: 200, fat: 70 };
    const workoutDates = new Set<string>();
    const monday = new Date("2026-07-06");

    const plan = generateWeeklyPlan("user-1", profile, targets, TEST_RECIPES, [], workoutDates, monday);

    const monDinner = plan[0].planned_meals.find((m: any) => m.meal_type === "dinner");
    const tueDinner = plan[1].planned_meals.find((m: any) => m.meal_type === "dinner");

    expect(monDinner.recipe_id).not.toBe(tueDinner.recipe_id);
  });
});

describe("Meals Count Recalculation & Summing Bugs", () => {
  it("Testi 1: kolme ateriaa", () => {
    const meals = [
      { calories: 420, protein: 30, carbs: 40, fat: 12 },
      { calories: 620, protein: 40, carbs: 60, fat: 18 },
      { calories: 250, protein: 15, carbs: 30, fat: 5 }
    ];
    const sumResult = calculatePlannedDayNutrition(meals);
    expect(sumResult.calories).toBe(1290);
    expect(sumResult.mealCount).toBe(3);
  });

  it("Testi 2: neljä ateriaa", () => {
    const meals = [
      { calories: 420, protein: 30, carbs: 40, fat: 12 },
      { calories: 620, protein: 40, carbs: 60, fat: 18 },
      { calories: 250, protein: 15, carbs: 30, fat: 5 },
      { calories: 680, protein: 45, carbs: 70, fat: 22 }
    ];
    const sumResult = calculatePlannedDayNutrition(meals);
    expect(sumResult.calories).toBe(1970);
    expect(sumResult.mealCount).toBe(4);
  });

  it("Testi 3: viisi ateriaa", () => {
    const meals = [
      { calories: 350, protein: 25, carbs: 35, fat: 10 },
      { calories: 180, protein: 12, carbs: 20, fat: 4 },
      { calories: 550, protein: 38, carbs: 55, fat: 15 },
      { calories: 220, protein: 15, carbs: 25, fat: 6 },
      { calories: 600, protein: 42, carbs: 60, fat: 20 }
    ];
    const sumResult = calculatePlannedDayNutrition(meals);
    expect(sumResult.calories).toBe(1900);
    expect(sumResult.mealCount).toBe(5);
  });

  it("Testi 4: vaihto kolmesta viiteen", () => {
    const mockPlanDays = [
      {
        date: "2026-07-06",
        planned_meals: [
          { id: "pm-1", meal_type: "breakfast", recipe_id: "rec-1", calories: 400 },
          { id: "pm-2", meal_type: "lunch", recipe_id: "rec-2", calories: 600 },
          { id: "pm-3", meal_type: "dinner", recipe_id: "rec-4", calories: 800 }
        ]
      }
    ];

    const targets = { calories: 1800, protein: 120, carbs: 180, fat: 60 };
    const updated = redistributePlanCalories(mockPlanDays, targets, 5, new Set(), TEST_RECIPES);

    expect(updated[0].planned_meals.length).toBe(5);
    expect(updated[0].day_calories).toBe(1800);
  });

  it("Testi 5: vaihto viidestä kolmeen", () => {
    const mockPlanDays = [
      {
        date: "2026-07-06",
        planned_meals: [
          { id: "pm-1", meal_type: "breakfast", recipe_id: "rec-1", calories: 400 },
          { id: "pm-2", meal_type: "snack", recipe_id: "rec-3", calories: 200 },
          { id: "pm-3", meal_type: "lunch", recipe_id: "rec-2", calories: 500 },
          { id: "pm-4", meal_type: "snack", recipe_id: "rec-3", calories: 200 },
          { id: "pm-5", meal_type: "dinner", recipe_id: "rec-4", calories: 600 }
        ]
      }
    ];

    const targets = { calories: 1800, protein: 120, carbs: 180, fat: 60 };
    const updated = redistributePlanCalories(mockPlanDays, targets, 3, new Set(), TEST_RECIPES);

    expect(updated[0].planned_meals.length).toBe(3);
    expect(updated[0].day_calories).toBe(1800);
  });

  it("Testi 6: perheresepti", () => {
    const meal = {
      portion_size_factor: 1.0,
      household_servings: 4,
      calories: 600 // user portion
    };
    const sumResult = calculatePlannedDayNutrition([meal]);
    expect(sumResult.calories).toBe(600); // sum only user portion, not 2400 (600 * 4)
  });

  it("Testi 7: lukittu ateria", () => {
    const mockPlanDays = [
      {
        date: "2026-07-06",
        planned_meals: [
          { id: "pm-1", meal_type: "breakfast", recipe_id: "rec-1", calories: 500 }, // locked
          { id: "pm-2", meal_type: "lunch", recipe_id: "rec-2", calories: 500 },
          { id: "pm-3", meal_type: "dinner", recipe_id: "rec-4", calories: 800 }
        ]
      }
    ];

    const targets = { calories: 1800, protein: 120, carbs: 180, fat: 60 };
    const updated = redistributePlanCalories(mockPlanDays, targets, 4, new Set(["pm-1"]), TEST_RECIPES);

    const lockedMeal = updated[0].planned_meals.find((m: any) => m.id === "pm-1");
    expect(lockedMeal.calories).toBe(500); // kept at 500
    expect(updated[0].day_calories).toBe(1800); // total is still redistributed to targets
  });
});
