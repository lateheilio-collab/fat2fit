/**
 * Reusable calculations for recipe scaling, shopping lists compiling,
 * recipe scoring, and macro adaptation.
 */

export type Ingredient = {
  name: string;
  amount: number;
  unit: string;
  category: string;
  optional?: boolean;
};

export type Recipe = {
  id: string;
  name: string;
  ingredients: Ingredient[];
  calories_per_serving: number;
  protein_per_serving: number;
  carbohydrates_per_serving: number;
  fat_per_serving: number;
  dietary_tags?: string[];
  allergen_tags?: string[];
  meal_type: string;
  cooking_time: number;
  estimated_cost: "low" | "medium" | "high";
  instructions?: string;
};

/**
 * Scales a recipe's ingredient list based on portion size factor and number of servings.
 */
export function scaleRecipeIngredients(
  ingredients: Ingredient[],
  portionFactor: number,
  servings: number
): Ingredient[] {
  const scale = portionFactor * servings;
  return ingredients.map((ing) => {
    let amount = Number((ing.amount * scale).toFixed(1));
    let unit = ing.unit;

    // Normalise units for practical cooking
    if (unit === "g" && amount >= 1000) {
      amount = Number((amount / 1000).toFixed(2));
      unit = "kg";
    } else if (unit === "ml" && amount >= 1000) {
      amount = Number((amount / 1000).toFixed(2));
      unit = "l";
    } else if (unit === "ml" && amount === 15) {
      amount = 1;
      unit = "rkl";
    } else if (unit === "ml" && amount === 5) {
      amount = 1;
      unit = "tl";
    }

    return {
      ...ing,
      amount,
      unit,
    };
  });
}

/**
 * Merges a list of ingredients from planned meals, aggregates quantities,
 * normalises units, and subtracts items already in the pantry.
 */
export function compileShoppingList(
  meals: { ingredients: Ingredient[] }[],
  pantry: string[]
): { name: string; amount: number; unit: string; category: string; inPantry: boolean }[] {
  const merged: { [key: string]: { amount: number; unit: string; category: string } } = {};

  meals.forEach((meal) => {
    meal.ingredients.forEach((ing) => {
      // Normalize key
      const key = ing.name.trim().toLowerCase();
      if (!merged[key]) {
        merged[key] = { amount: 0, unit: ing.unit, category: ing.category || "Muut" };
      }

      // Convert unit if mismatch (simple conversion)
      let addAmount = ing.amount;
      if (ing.unit === "kg" && merged[key].unit === "g") {
        addAmount = ing.amount * 1000;
      } else if (ing.unit === "g" && merged[key].unit === "kg") {
        merged[key].unit = "g";
        merged[key].amount = merged[key].amount * 1000;
      } else if (ing.unit === "l" && merged[key].unit === "ml") {
        addAmount = ing.amount * 1000;
      } else if (ing.unit === "ml" && merged[key].unit === "l") {
        merged[key].unit = "ml";
        merged[key].amount = merged[key].amount * 1000;
      }

      merged[key].amount += addAmount;
    });
  });

  const pantrySet = new Set(pantry.map((p) => p.trim().toLowerCase()));

  return Object.keys(merged).map((name) => {
    const item = merged[name];
    const isPantry = pantrySet.has(name);
    
    // Capitalize name
    const capName = name.charAt(0).toUpperCase() + name.slice(1);
    
    return {
      name: capName,
      amount: Number(item.amount.toFixed(1)),
      unit: item.unit,
      category: item.category,
      inPantry: isPantry,
    };
  });
}

/**
 * Scores and filters a list of recipes according to the user's macros, diet, and constraints.
 */
export function scoreRecipesForPlan(
  recipes: Recipe[],
  profile: {
    diet_type?: string;
    allergies?: string[];
    avoided_ingredients?: string[];
    cooking_time_limit?: number;
    budget_preference?: "low" | "medium" | "high";
  },
  remainingMacros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): { recipe: Recipe; score: number }[] {
  const diet = profile.diet_type || "standard";
  const allergies = new Set((profile.allergies || []).map((a) => a.trim().toLowerCase()));
  const avoided = new Set((profile.avoided_ingredients || []).map((i) => i.trim().toLowerCase()));
  const timeLimit = profile.cooking_time_limit || 45;
  const budgetPref = profile.budget_preference || "medium";

  return recipes
    .filter((recipe) => {
      // 1. Filter by Diet type
      if (diet === "vegetarian" && !recipe.dietary_tags?.includes("vegetarian") && !recipe.dietary_tags?.includes("vegan")) {
        return false;
      }
      if (diet === "vegan" && !recipe.dietary_tags?.includes("vegan")) {
        return false;
      }

      // 2. Filter by Allergies
      const hasAllergen = recipe.allergen_tags?.some((tag) => allergies.has(tag.trim().toLowerCase()));
      if (hasAllergen) return false;

      // 3. Filter by Avoided ingredients
      const containsAvoided = recipe.ingredients.some((ing) => avoided.has(ing.name.trim().toLowerCase()));
      if (containsAvoided) return false;

      // 4. Hard cooking time limit
      if (recipe.cooking_time > timeLimit + 10) return false;

      return true;
    })
    .map((recipe) => {
      let score = 100;

      // Score macro proximity (calories, protein)
      const calDiff = Math.abs(recipe.calories_per_serving - remainingMacros.calories);
      score -= (calDiff / remainingMacros.calories) * 30; // up to -30 pts for calorie mismatch

      const protDiff = Math.abs(recipe.protein_per_serving - remainingMacros.protein);
      score -= (protDiff / remainingMacros.protein) * 20; // up to -20 pts for protein mismatch

      // Bonus for high protein density if weight loss or muscle gain
      if (recipe.protein_per_serving >= 30) {
        score += 15;
      }

      // Cooking time score
      if (recipe.cooking_time <= 20) score += 10;

      // Budget preference score
      if (recipe.estimated_cost === budgetPref) {
        score += 15;
      } else if (budgetPref === "low" && recipe.estimated_cost === "high") {
        score -= 25; // penalty for expensive meals when budget is low
      }

      return {
        recipe,
        score: Number(Math.max(0, score).toFixed(0)),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Backwards compatible helper to retrieve daily nutrition targets (deficit, BMR, macros)
 * for the dashboard and log meal pages.
 */
export async function getNutritionTargets(
  supabase: any,
  userId: string,
  weight: number = 85.0
): Promise<{ calories: number; protein: number; carbs: number; fat: number; fiber: number }> {
  // Load user details
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const birthYear = profile?.birth_year || 1990;
  const heightCm = Number(profile?.height_cm || 180);
  const gender = profile?.gender || "male";

  // Load target goal
  const { data: goal } = await supabase.from("goals").select("id").eq("user_id", userId).eq("status", "active").maybeSingle();
  let weeklyExerciseTarget = 3;
  if (goal) {
    const { data: ver } = await supabase
      .from("goal_versions")
      .select("weekly_exercise_count_target")
      .eq("goal_id", goal.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ver?.weekly_exercise_count_target) {
      weeklyExerciseTarget = ver.weekly_exercise_count_target;
    }
  }

  // BMR & TDEE Calculations using Mifflin-St Jeor
  const age = new Date().getFullYear() - birthYear;
  let bmr = 10 * weight + 6.25 * heightCm - 5 * age;
  if (gender === "male") bmr += 5;
  else if (gender === "female") bmr -= 161;
  else bmr -= 78;

  let pal = 1.2;
  if (weeklyExerciseTarget >= 5) pal = 1.725;
  else if (weeklyExerciseTarget >= 3) pal = 1.55;
  else if (weeklyExerciseTarget >= 1) pal = 1.375;

  const tdee = Math.round(bmr * pal);
  const calories = Math.round(tdee - 500); // 500 kcal default deficit
  const protein = Math.round(weight * 2.0); // 2g per kg
  const fat = Math.round(weight * 0.9); // 0.9g per kg
  const carbs = Math.round((calories - (protein * 4) - (fat * 9)) / 4);

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: 30
  };
}

/**
 * Backwards compatible helper to save updated nutrition targets (stub).
 */
export async function saveNutritionTargets(
  supabase: any,
  userId: string,
  targets: { calories?: number; protein?: number; carbs?: number; fat?: number; fiber?: number }
): Promise<void> {
  console.log(`Saving custom nutrition targets for ${userId}:`, targets);
}

export const MEAL_DISTRIBUTIONS: Record<number, { type: string; pct: number }[]> = {
  3: [
    { type: 'breakfast', pct: 0.25 },
    { type: 'lunch', pct: 0.35 },
    { type: 'dinner', pct: 0.40 }
  ],
  4: [
    { type: 'breakfast', pct: 0.22 },
    { type: 'lunch', pct: 0.30 },
    { type: 'snack', pct: 0.15 },
    { type: 'dinner', pct: 0.33 }
  ],
  5: [
    { type: 'breakfast', pct: 0.20 },
    { type: 'snack', pct: 0.10 },
    { type: 'lunch', pct: 0.28 },
    { type: 'snack', pct: 0.12 },
    { type: 'dinner', pct: 0.30 }
  ]
};

export function calculatePlannedDayNutrition(activeMeals: any[]) {
  if (!activeMeals || activeMeals.length === 0) {
    return { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0, mealCount: 0 };
  }
  
  let calories = 0;
  let protein = 0;
  let carbohydrates = 0;
  let fat = 0;
  let fiber = 0;

  activeMeals.forEach(meal => {
    calories += meal.calories || 0;
    protein += meal.protein || 0;
    carbohydrates += meal.carbs || meal.carbohydrates || 0;
    fat += meal.fat || 0;
    fiber += meal.fiber || 0;
  });

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbohydrates: Math.round(carbohydrates),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
    mealCount: activeMeals.length
  };
}

export function redistributePlanCalories(
  planDays: any[],
  targets: { calories: number; protein: number; carbs: number; fat: number },
  mealsCount: number,
  lockedMealIds: Set<string>,
  recipes: any[]
): any[] {
  const distributions = MEAL_DISTRIBUTIONS[mealsCount];
  if (!distributions) throw new Error("Virheellinen ateriamäärä.");

  const updatedDays = planDays.map(day => {
    const plannedMeals = day.planned_meals || [];
    
    // 1. Identify locked meals
    const lockedMeals = plannedMeals.filter((m: any) => lockedMealIds.has(m.id));
    if (lockedMeals.length > mealsCount) {
      throw new Error(`Päivältä on lukittu ${lockedMeals.length} ateriaa, joten suunnitelmaa ei voida muuttaa ${mealsCount} ateriaan poistamatta lukitusta.`);
    }

    // 2. Build active meals array of size mealsCount
    const activeMeals: any[] = [];
    const remainingSlots = [...distributions];
    
    // Allocate locked meals first
    lockedMeals.forEach((locked: any) => {
      let idx = remainingSlots.findIndex(s => s.type === locked.meal_type);
      if (idx === -1) idx = 0; // fallback
      
      activeMeals.push({
        ...locked,
        is_locked: true
      });
      remainingSlots.splice(idx, 1);
    });

    // Fill remaining slots using non-locked meals or default recipes
    remainingSlots.forEach((slot, i) => {
      const existingNonLocked = plannedMeals.find((m: any) => 
        m.meal_type === slot.type && 
        !lockedMealIds.has(m.id) &&
        !activeMeals.some(am => am.id === m.id)
      );

      if (existingNonLocked) {
        activeMeals.push({
          ...existingNonLocked,
          meal_type: slot.type
        });
      } else {
        const recipeList = recipes.filter(r => r.meal_type === slot.type || (slot.type === 'snack' && r.meal_type === 'snack'));
        const recipe = recipeList[i % recipeList.length] || recipes[0];
        
        activeMeals.push({
          id: `pm-${day.date}-${activeMeals.length + 1}`,
          meal_type: slot.type,
          recipe_id: recipe.id,
          recipe_name: recipe.name,
          portion_size_factor: 1.0,
          household_servings: 1,
          calories: recipe.calories_per_serving || recipe.calories || 400,
          protein: recipe.protein_per_serving || recipe.protein || 30,
          carbs: recipe.carbohydrates_per_serving || recipe.carbs || 40,
          fat: recipe.fat_per_serving || recipe.fat || 10,
          ingredients_snapshot: recipe.ingredients || [],
          instructions: recipe.instructions || "",
          is_locked: false,
          is_leftover: false
        });
      }
    });

    // Sort to keep types in order: breakfast, snack, lunch, snack, dinner
    activeMeals.sort((a, b) => {
      const order = ['breakfast', 'snack', 'lunch', 'evening_snack', 'dinner'];
      return order.indexOf(a.meal_type) - order.indexOf(b.meal_type);
    });

    // 3. Redistribute calories
    const lockedSum = lockedMeals.reduce((acc: number, m: any) => acc + m.calories, 0);
    const dayTarget = day.is_workout_day ? targets.calories + 200 : targets.calories;
    const remainingTarget = Math.max(100, dayTarget - lockedSum);

    const nonLockedIndices: number[] = [];
    activeMeals.forEach((m, idx) => {
      if (!lockedMealIds.has(m.id)) {
        nonLockedIndices.push(idx);
      }
    });

    const nonLockedPctSum = nonLockedIndices.reduce((acc, idx) => {
      const m = activeMeals[idx];
      // match type to distribution pct
      const dist = distributions.find(d => d.type === m.meal_type) || distributions[0];
      return acc + dist.pct;
    }, 0);

    nonLockedIndices.forEach(idx => {
      const meal = activeMeals[idx];
      const dist = distributions.find(d => d.type === meal.meal_type) || distributions[0];
      const pct = dist.pct;
      const targetMealCalories = Math.max(100, Math.round(remainingTarget * (pct / (nonLockedPctSum || 1))));

      const recipe = recipes.find(r => r.id === meal.recipe_id) || meal;
      const standardCalories = recipe.calories_per_serving || recipe.calories || 400;
      const standardProtein = recipe.protein_per_serving || recipe.protein || 30;
      const standardCarbs = recipe.carbohydrates_per_serving || recipe.carbs || 40;
      const standardFat = recipe.fat_per_serving || recipe.fat || 10;

      const scale = targetMealCalories / standardCalories;
      meal.portion_size_factor = Number(scale.toFixed(2));
      meal.calories = targetMealCalories;
      meal.protein = Math.round(standardProtein * scale);
      meal.carbs = Math.round(standardCarbs * scale);
      meal.fat = Math.round(standardFat * scale);
    });

    const dayTotals = calculatePlannedDayNutrition(activeMeals);
    
    return {
      ...day,
      day_calories: dayTotals.calories,
      day_protein: dayTotals.protein,
      day_carbs: dayTotals.carbohydrates,
      day_fat: dayTotals.fat,
      planned_meals: activeMeals
    };
  });

  return updatedDays;
}

// -------------------------------------------------------------
// Advanced Weekly Plan Generation, Scoring & Variety Rules
// -------------------------------------------------------------

export function generateWeeklyPlan(
  userId: string,
  profile: any,
  targets: { calories: number; protein: number; carbs: number; fat: number },
  recipes: any[],
  interactions: any[],
  workoutDates: Set<string>,
  monday: Date
) {
  const leftoversPref = profile?.leftovers_preference || 'two_days';
  const mealsPerDay = profile?.daily_meals_count || 4;

  const planDays: any[] = [];
  const usedRecipeIds = new Map<string, number>();
  const lastUsedMainIngredients = new Set<string>();
  const lastUsedPrepMethods = new Set<string>();

  const interactionMap = new Map<string, any>();
  interactions?.forEach((inter) => {
    interactionMap.set(inter.recipe_id, inter);
  });

  let pendingLeftoverMeal: any = null;
  let leftoverDaysLeft = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const isWorkout = workoutDates.has(dateStr);

    const dayCalories = isWorkout ? targets.calories + 200 : targets.calories;
    const dayProtein = isWorkout ? targets.protein + 10 : targets.protein;
    const dayCarbs = isWorkout ? targets.carbs + 30 : targets.carbs;
    const dayFat = targets.fat;

    const dayMeals: any[] = [];

    // Slot 1: Breakfast
    const breakfastAlternatives = recipes.filter(r => r.meal_type === 'breakfast');
    const selectedBreakfast = selectAteriatyyppiRecipe(
      breakfastAlternatives,
      interactionMap,
      usedRecipeIds,
      3, // Allow up to 3 times repetition for breakfasts
      i,
      dayProtein / 4
    );
    dayMeals.push(buildPlannedMeal(`pm-${dateStr}-1`, 'breakfast', selectedBreakfast, dateStr));

    // Slot 2: Lunch (Leftover or Fresh)
    let selectedLunch: any = null;
    if (leftoversPref === 'two_days' && pendingLeftoverMeal && leftoverDaysLeft > 0) {
      selectedLunch = pendingLeftoverMeal;
      leftoverDaysLeft--;
      const plannedMeal = buildPlannedMeal(`pm-${dateStr}-2`, 'lunch', selectedLunch, dateStr);
      plannedMeal.is_leftover = true;
      plannedMeal.source_meal_id = `pm-${new Date(d.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]}-4`;
      plannedMeal.repetition_reason = 'Hyödynnetään tähteet';
      dayMeals.push(plannedMeal);
    } else {
      const lunchAlternatives = recipes.filter(r => r.meal_type === 'lunch');
      selectedLunch = selectMainRecipe(
        lunchAlternatives,
        interactionMap,
        usedRecipeIds,
        lastUsedMainIngredients,
        lastUsedPrepMethods,
        dayProtein / 3,
        i
      );
      dayMeals.push(buildPlannedMeal(`pm-${dateStr}-2`, 'lunch', selectedLunch, dateStr));
    }

    // Slot 3: Snack
    if (mealsPerDay >= 3) {
      const snackAlternatives = recipes.filter(r => r.meal_type === 'snack');
      const selectedSnack = selectAteriatyyppiRecipe(
        snackAlternatives,
        interactionMap,
        usedRecipeIds,
        3,
        i,
        dayProtein / 6
      );
      dayMeals.push(buildPlannedMeal(`pm-${dateStr}-3`, 'snack', selectedSnack, dateStr));
    }

    // Slot 4: Dinner
    const dinnerAlternatives = recipes.filter(r => r.meal_type === 'dinner');
    const selectedDinner = selectMainRecipe(
      dinnerAlternatives,
      interactionMap,
      usedRecipeIds,
      lastUsedMainIngredients,
      lastUsedPrepMethods,
      dayProtein / 3,
      i
    );
    const dinnerPlanned = buildPlannedMeal(`pm-${dateStr}-4`, 'dinner', selectedDinner, dateStr);
    if (leftoversPref === 'two_days') {
      pendingLeftoverMeal = selectedDinner;
      leftoverDaysLeft = 1;
    }
    dayMeals.push(dinnerPlanned);

    // Slot 5: Evening Snack / Other
    if (mealsPerDay >= 5) {
      const eveningSnackAlternatives = recipes.filter(r => r.meal_type === 'snack' || r.meal_type === 'breakfast');
      const selectedEveSnack = selectAteriatyyppiRecipe(
        eveningSnackAlternatives,
        interactionMap,
        usedRecipeIds,
        3,
        i + 1,
        dayProtein / 6
      );
      dayMeals.push(buildPlannedMeal(`pm-${dateStr}-5`, 'evening_snack', selectedEveSnack, dateStr));
    }

    const actualCalories = dayMeals.reduce((acc, m) => acc + m.calories, 0);
    const actualProtein = dayMeals.reduce((acc, m) => acc + m.protein, 0);
    const actualCarbs = dayMeals.reduce((acc, m) => acc + m.carbs, 0);
    const actualFat = dayMeals.reduce((acc, m) => acc + m.fat, 0);

    planDays.push({
      id: `day-${dateStr}`,
      date: dateStr,
      is_workout_day: isWorkout,
      day_calories: actualCalories,
      day_protein: actualProtein,
      day_carbs: actualCarbs,
      day_fat: actualFat,
      planned_meals: dayMeals
    });
  }

  autoCorrectVariety(planDays, recipes, interactionMap);

  return planDays;
}

export function selectAteriatyyppiRecipe(
  alternatives: any[],
  interactionMap: Map<string, any>,
  usedRecipeIds: Map<string, number>,
  maxReps: number,
  dayIndex: number,
  targetProtein: number
) {
  const scored = alternatives.map(rec => {
    let score = 100;
    const inter = interactionMap.get(rec.id);
    
    if (inter?.is_favorite) {
      if (inter.favorite_frequency === 'always') score += 50;
      else if (inter.favorite_frequency === 'frequent') score += 35;
      else if (inter.favorite_frequency === 'weekly') score += 20;
      else if (inter.favorite_frequency === 'occasional') score += 10;
    }
    if (inter?.rejected_by_user) score = 0;

    const count = usedRecipeIds.get(rec.id) || 0;
    if (count >= maxReps) score -= 80;
    else score -= count * 25;

    const protDiff = Math.abs(rec.protein_per_serving - targetProtein);
    score -= protDiff * 2;

    return { rec, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0]?.rec || alternatives[dayIndex % alternatives.length];
  usedRecipeIds.set(best.id, (usedRecipeIds.get(best.id) || 0) + 1);
  return best;
}

export function selectMainRecipe(
  alternatives: any[],
  interactionMap: Map<string, any>,
  usedRecipeIds: Map<string, number>,
  lastUsedMainIngredients: Set<string>,
  lastUsedPrepMethods: Set<string>,
  targetProtein: number,
  dayIndex: number
) {
  const scored = alternatives.map(rec => {
    let score = 100;
    const inter = interactionMap.get(rec.id);

    if (inter?.is_favorite) {
      if (inter.favorite_frequency === 'always') score += 50;
      else if (inter.favorite_frequency === 'frequent') score += 35;
      else if (inter.favorite_frequency === 'weekly') score += 20;
      else if (inter.favorite_frequency === 'occasional') score += 10;
    }
    if (inter?.rejected_by_user) score = 0;

    const count = usedRecipeIds.get(rec.id) || 0;
    if (count > 0) score -= 80;

    const mainIng = getRecipeMainIngredient(rec);
    if (lastUsedMainIngredients.has(mainIng)) {
      score -= 40;
    }

    const prep = getRecipePrepMethod(rec);
    if (lastUsedPrepMethods.has(prep)) {
      score -= 20;
    }

    const protDiff = Math.abs(rec.protein_per_serving - targetProtein);
    score -= protDiff * 2;

    return { rec, score, mainIng, prep };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0]?.rec || alternatives[dayIndex % alternatives.length];
  
  usedRecipeIds.set(best.id, (usedRecipeIds.get(best.id) || 0) + 1);
  
  const mainIng = getRecipeMainIngredient(best);
  lastUsedMainIngredients.add(mainIng);
  if (lastUsedMainIngredients.size > 2) {
    const first = Array.from(lastUsedMainIngredients)[0];
    lastUsedMainIngredients.delete(first);
  }

  const prep = getRecipePrepMethod(best);
  lastUsedPrepMethods.add(prep);
  if (lastUsedPrepMethods.size > 2) {
    const first = Array.from(lastUsedPrepMethods)[0];
    lastUsedPrepMethods.delete(first);
  }

  return best;
}

export function getRecipeMainIngredient(rec: any): string {
  const name = rec.name.toLowerCase();
  if (name.includes("kana") || name.includes("broileri")) return "broileri";
  if (name.includes("lohi") || name.includes("kala")) return "kala";
  if (name.includes("tofu")) return "tofu";
  if (name.includes("nauta") || name.includes("jauheliha")) return "nauta";
  if (name.includes("muna")) return "kananmuna";
  if (name.includes("linssi") || name.includes("pavu")) return "palkokasvi";
  return "kasvis";
}

export function getRecipePrepMethod(rec: any): string {
  const name = rec.name.toLowerCase();
  if (name.includes("uuni") || name.includes("laatikko")) return "uuni";
  if (name.includes("pannu") || name.includes("paistettu")) return "pannu";
  if (name.includes("keitto") || name.includes("pata")) return "pata";
  if (name.includes("salaatti")) return "salaatti";
  if (name.includes("kulho")) return "kulho";
  return "muu";
}

export function buildPlannedMeal(id: string, type: string, rec: any, dateStr: string): any {
  return {
    id,
    meal_type: type,
    recipe_id: rec.id,
    recipe_name: rec.name,
    portion_size_factor: 1.0,
    household_servings: 1,
    calories: rec.calories_per_serving || rec.calories,
    protein: rec.protein_per_serving || rec.protein,
    carbs: rec.carbohydrates_per_serving || rec.carbs,
    fat: rec.fat_per_serving || rec.fat,
    ingredients_snapshot: rec.ingredients,
    instructions: rec.instructions,
    preparation_time: rec.preparation_time || rec.cooking_time || 15,
    cooking_time: rec.cooking_time || 15,
    is_locked: false,
    is_leftover: false,
    repetition_reason: null,
    source_meal_id: null,
    regeneration_count: 0
  };
}

export function autoCorrectVariety(planDays: any[], recipes: any[], interactionMap: Map<string, any>) {
  const proteinCounts = new Map<string, number>();
  
  planDays.forEach(day => {
    day.planned_meals?.forEach((meal: any) => {
      if ((meal.meal_type === 'lunch' || meal.meal_type === 'dinner') && !meal.is_leftover && !meal.is_locked) {
        const prot = getRecipeMainIngredient({ name: meal.recipe_name });
        proteinCounts.set(prot, (proteinCounts.get(prot) || 0) + 1);
      }
    });
  });

  proteinCounts.forEach((count, prot) => {
    if (count > 3) {
      for (let i = 0; i < planDays.length; i++) {
        const day = planDays[i];
        const mealToReplace = day.planned_meals?.find((m: any) => 
          (m.meal_type === 'lunch' || m.meal_type === 'dinner') && 
          !m.is_leftover && 
          !m.is_locked && 
          getRecipeMainIngredient({ name: m.recipe_name }) === prot
        );

        if (mealToReplace) {
          const prevDay = planDays[i - 1];
          const nextDay = planDays[i + 1];
          const prevMeal = prevDay?.planned_meals?.find((m: any) => m.meal_type === mealToReplace.meal_type);
          const nextMeal = nextDay?.planned_meals?.find((m: any) => m.meal_type === mealToReplace.meal_type);

          const alt = recipes.find(r => 
            r.meal_type === mealToReplace.meal_type && 
            getRecipeMainIngredient(r) !== prot && 
            r.id !== prevMeal?.recipe_id &&
            r.id !== nextMeal?.recipe_id &&
            !interactionMap.get(r.id)?.rejected_by_user
          );

          if (alt) {
            const oldId = mealToReplace.id;
            mealToReplace.recipe_id = alt.id;
            mealToReplace.recipe_name = alt.name;
            mealToReplace.calories = alt.calories_per_serving || alt.calories;
            mealToReplace.protein = alt.protein_per_serving || alt.protein;
            mealToReplace.carbs = alt.carbohydrates_per_serving || alt.carbs;
            mealToReplace.fat = alt.fat_per_serving || alt.fat;
            mealToReplace.ingredients_snapshot = alt.ingredients;
            mealToReplace.instructions = alt.instructions;
            mealToReplace.preparation_time = alt.preparation_time || alt.cooking_time || 15;
            mealToReplace.cooking_time = alt.cooking_time || 15;

            // Update matching leftovers
            planDays.forEach(d => {
              const leftover = d.planned_meals?.find((m: any) => m.source_meal_id === oldId);
              if (leftover) {
                leftover.recipe_id = alt.id;
                leftover.recipe_name = alt.name;
                leftover.calories = alt.calories_per_serving || alt.calories;
                leftover.protein = alt.protein_per_serving || alt.protein;
                leftover.carbs = alt.carbohydrates_per_serving || alt.carbs;
                leftover.fat = alt.fat_per_serving || alt.fat;
                leftover.ingredients_snapshot = alt.ingredients;
                leftover.instructions = alt.instructions;
                leftover.preparation_time = alt.preparation_time || alt.cooking_time || 15;
                leftover.cooking_time = alt.cooking_time || 15;
              }
            });
            break;
          }
        }
      }
    }
  });
}
