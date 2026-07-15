"use client";

import { useState, useEffect } from "react";
import {
  Utensils,
  Calendar,
  BookOpen,
  ShoppingCart,
  User,
  Plus,
  Scale,
  Sparkles,
  Search,
  CheckCircle,
  PlusCircle,
  FileDown,
  ArrowRight,
  TrendingUp,
  Dumbbell,
  AlertCircle,
  Loader2,
  Clock,
  Euro,
  Users,
  Eye,
  RefreshCw,
  Copy,
  Lock,
  Unlock,
  Check,
  CheckSquare,
  Square,
  ChevronRight
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { calculatePlannedDayNutrition } from "@/lib/calculations/nutrition";

type Tab = "tanaan" | "viikko" | "reseptit" | "kauppa" | "profiili";

export default function NutritionPlanPage() {
  const supabase = supabaseBrowser();
  const [activeTab, setActiveTab] = useState<Tab>("tanaan");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [recipes, setRecipes] = useState<any[]>([]);

  // Weekly plan options
  const [mealsCount, setMealsCount] = useState<number>(4);
  const [lockedMeals, setLockedMeals] = useState<Set<string>>(new Set());
  const [selectedDetailMeal, setSelectedDetailMeal] = useState<any>(null);

  // Advanced detail modal states
  const [detailServings, setDetailServings] = useState<number>(2);
  const [detailUserMultiplier, setDetailUserMultiplier] = useState<number>(1.0);
  const [detailIsFavorite, setDetailIsFavorite] = useState<boolean>(false);
  const [detailFavoriteFrequency, setDetailFavoriteFrequency] = useState<string>("weekly");

  useEffect(() => {
    if (selectedDetailMeal) {
      setDetailServings(selectedDetailMeal.household_servings || 2);
      setDetailUserMultiplier(Number(selectedDetailMeal.portion_size_factor || 1.0));
      
      const matchingRecipe = recipes.find(r => r.id === selectedDetailMeal.recipe_id);
      setDetailIsFavorite(matchingRecipe?.is_favorite || false);
      setDetailFavoriteFrequency(matchingRecipe?.favorite_frequency || "weekly");
    }
  }, [selectedDetailMeal, recipes]);

  // Recipes search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dietFilter, setDietFilter] = useState("all");
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [recipeServings, setRecipeServings] = useState<number>(2);
  const [ownPortionFactor, setOwnPortionFactor] = useState<number>(1.0);
  const [isFamilySeparated, setIsFamilySeparated] = useState(false);

  // Profile preferences
  const [dietType, setDietType] = useState("standard");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState("");
  const [householdSize, setHouseholdSize] = useState(1);
  const [budgetPreference, setBudgetPreference] = useState("medium");
  const [pantry, setPantry] = useState<string[]>(["suola", "pippuri", "oliiviöljy", "riisi"]);
  const [newPantryItem, setNewPantryItem] = useState("");
  const [leftoversPreference, setLeftoversPreference] = useState("two_days");

  // Shopping list checkboxes
  const [boughtItems, setBoughtItems] = useState<Set<string>>(new Set());

  // Macro matcher proposal states
  const [macroAlternatives, setMacroAlternatives] = useState<any[]>([]);
  const [swappingMealId, setSwappingMealId] = useState<string | null>(null);

  const fetchNutritionData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Plan
      const res = await fetch("/api/nutrition/plan");
      const planData = await res.json();
      setData(planData);

      // Initialize profile states
      if (planData.profile) {
        setDietType(planData.profile.diet_type || "standard");
        setAllergies(planData.profile.allergies || []);
        setHouseholdSize(planData.profile.household_size || 1);
        setBudgetPreference(planData.profile.budget_preference || "medium");
        setPantry(planData.profile.pantry || []);
        setLeftoversPreference(planData.profile.leftovers_preference || "two_days");
        setMealsCount(planData.profile.daily_meals_count || 4);
      }

      // Initialize locked meals
      if (planData.plan) {
        const locked = new Set<string>();
        planData.plan.forEach((day: any) => {
          day.planned_meals?.forEach((meal: any) => {
            if (meal.is_locked) {
              locked.add(meal.id);
            }
          });
        });
        setLockedMeals(locked);
      }

      // 2. Fetch Recipes
      const recRes = await fetch("/api/nutrition/recipes");
      const recData = await recRes.json();
      setRecipes(recData.recipes || []);
      if (recData.recipes?.length > 0) {
        setSelectedRecipe(recData.recipes[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNutritionData();
  }, []);

  // Update profile handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/nutrition/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          profileData: {
            diet_type: dietType,
            allergies,
            household_size: Number(householdSize),
            budget_preference: budgetPreference,
            pantry,
            leftovers_preference: leftoversPreference
          }
        })
      });
      const result = await res.json();
      if (result.success) {
        alert("Ravintoprofiili päivitetty!");
        fetchNutritionData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Log new allergy
  const handleAddAllergy = () => {
    if (!newAllergy.trim()) return;
    setAllergies(prev => [...prev, newAllergy.trim().toLowerCase()]);
    setNewAllergy("");
  };

  // Remove allergy
  const handleRemoveAllergy = (idx: number) => {
    setAllergies(prev => prev.filter((_, i) => i !== idx));
  };

  // Add pantry item
  const handleAddPantryItem = () => {
    if (!newPantryItem.trim()) return;
    setPantry(prev => [...prev, newPantryItem.trim().toLowerCase()]);
    setNewPantryItem("");
  };

  // Remove pantry item
  const handleRemovePantryItem = (idx: number) => {
    setPantry(prev => prev.filter((_, i) => i !== idx));
  };

  // Toggle meal locking
  const toggleMealLock = async (mealId: string) => {
    const nextLocked = new Set(lockedMeals);
    const wasLocked = nextLocked.has(mealId);
    if (wasLocked) nextLocked.delete(mealId);
    else nextLocked.add(mealId);
    setLockedMeals(nextLocked);

    try {
      await fetch("/api/nutrition/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_planned_meal",
          mealData: {
            id: mealId,
            is_locked: !wasLocked
          }
        })
      });
    } catch (err) {
      console.error("Lock toggle save error:", err);
    }
  };

  // Suggest meal for remaining macros
  const handleSuggestRemaining = async (mealId: string, currentMeal: any) => {
    setSwappingMealId(mealId);
    try {
      const remaining = {
        calories: data?.targets?.calories - 1200 || 800,
        protein: data?.targets?.protein - 80 || 60,
        carbs: data?.targets?.carbs - 100 || 80,
        fat: data?.targets?.fat - 40 || 30
      };

      const res = await fetch("/api/nutrition/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap_meal",
          remainingMacros: remaining,
          profile: data?.profile,
          currentRecipeId: currentMeal.recipe_id
        })
      });
      const result = await res.json();
      setMacroAlternatives(result.alternatives || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm meal swap
  const handleConfirmSwap = async (alternativeRecipe: any) => {
    if (!swappingMealId) return;
    try {
      const res = await fetch("/api/nutrition/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_planned_meal",
          mealData: {
            id: swappingMealId,
            recipe_id: alternativeRecipe.id,
            recipe_name: alternativeRecipe.name,
            calories: alternativeRecipe.calories_per_serving,
            protein: alternativeRecipe.protein_per_serving,
            carbs: alternativeRecipe.carbohydrates_per_serving,
            fat: alternativeRecipe.fat_per_serving,
            ingredients_snapshot: alternativeRecipe.ingredients
          }
        })
      });
      const result = await res.json();
      if (result.success) {
        alert("Ateria vaihdettu!");
        setSwappingMealId(null);
        setMacroAlternatives([]);
        fetchNutritionData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavoriteDetail = async () => {
    const nextFav = !detailIsFavorite;
    setDetailIsFavorite(nextFav);
    try {
      const res = await fetch("/api/nutrition/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_favorite",
          recipeId: selectedDetailMeal.recipe_id,
          isFavorite: nextFav,
          favoriteFrequency: detailFavoriteFrequency
        })
      });
      const result = await res.json();
      if (result.success) {
        fetchNutritionData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFavoriteFrequencyChange = async (freq: string) => {
    setDetailFavoriteFrequency(freq);
    try {
      const res = await fetch("/api/nutrition/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_favorite",
          recipeId: selectedDetailMeal.recipe_id,
          isFavorite: detailIsFavorite,
          favoriteFrequency: freq
        })
      });
      const result = await res.json();
      if (result.success) {
        fetchNutritionData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMealPlanSettings = async () => {
    try {
      const scale = detailServings / (selectedDetailMeal.household_servings || 1);
      const multScale = detailUserMultiplier / (selectedDetailMeal.portion_size_factor || 1.0);
      
      const res = await fetch("/api/nutrition/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_planned_meal",
          mealData: {
            id: selectedDetailMeal.id,
            portion_size_factor: detailUserMultiplier,
            household_servings: detailServings,
            calories: Math.round(selectedDetailMeal.calories * scale * multScale),
            protein: Math.round(selectedDetailMeal.protein * scale * multScale),
            carbs: Math.round(selectedDetailMeal.carbs * scale * multScale),
            fat: Math.round(selectedDetailMeal.fat * scale * multScale)
          }
        })
      });
      const result = await res.json();
      if (result.success) {
        alert("Aterian tiedot, annoskoot ja kauppalista päivitetty!");
        setSelectedDetailMeal(null);
        fetchNutritionData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMealsCount = async (cnt: number) => {
    let lockClash = false;
    data?.plan?.forEach((day: any) => {
      const lockedInDay = day.planned_meals?.filter((m: any) => lockedMeals.has(m.id)) || [];
      if (lockedInDay.length > cnt) {
        lockClash = true;
      }
    });

    if (lockClash) {
      alert(`Päivältä on lukittu useita aterioita, joten suunnitelmaa ei voida muuttaa ${cnt} ateriaan poistamatta lukituksia.`);
      return;
    }

    setMealsCount(cnt);
    setLoading(true);
    try {
      const res = await fetch("/api/nutrition/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_meals_count",
          mealsCount: cnt,
          lockedMeals: Array.from(lockedMeals)
        })
      });
      const result = await res.json();
      if (result.success) {
        fetchNutritionData();
      } else {
        alert(result.error || "Virhe ateriamäärän päivityksessä.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compile shopping list
  const getCompiledShoppingList = () => {
    const list: any[] = [];
    const pantrySet = new Set(pantry.map(p => p.toLowerCase().trim()));

    data?.plan?.forEach((day: any) => {
      day.planned_meals?.slice(0, mealsCount).forEach((meal: any) => {
        meal.ingredients_snapshot?.forEach((ing: any) => {
          const key = ing.name.toLowerCase().trim();
          const existing = list.find(l => l.name.toLowerCase().trim() === key);
          
          let factor = meal.portion_size_factor || 1.0;
          let scale = factor * (meal.household_servings || 1);
          
          if (existing) {
            existing.amount += ing.amount * scale;
          } else {
            list.push({
              name: ing.name,
              amount: ing.amount * scale,
              unit: ing.unit,
              category: ing.category || "Muut",
              inPantry: pantrySet.has(key)
            });
          }
        });
      });
    });

    return list;
  };

  const shoppingList = getCompiledShoppingList();

  const toggleBoughtItem = (name: string) => {
    setBoughtItems(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayPlan = data?.plan?.find((d: any) => d.date === todayStr) || data?.plan?.[0];

  const activeTodayMeals = todayPlan?.planned_meals?.slice(0, mealsCount) || [];
  const todayNutrition = calculatePlannedDayNutrition(activeTodayMeals);
  
  const totalConsumedCalories = todayNutrition.calories;
  const remainingCalories = Math.max(0, (data?.targets?.calories || 2000) - totalConsumedCalories);

  // Filtered recipes
  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiet = dietFilter === "all" || r.dietary_tags?.includes(dietFilter);
    return matchesSearch && matchesDiet;
  });

  return (
    <div className="flex flex-col gap-6 pb-12 text-left animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <Utensils className="w-3.5 h-3.5" />
            AI-ravintovalmentaja
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight font-heading">
            Ravinto-ohjelma
          </h2>
        </div>

        {data?.usingMockData && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Käytetään suosituspohjaa
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-secondary/10 border border-border/40 rounded-2xl shrink-0">
        {[
          { id: "tanaan", label: "Tänään", icon: Utensils },
          { id: "viikko", label: "Viikkosuunnitelma", icon: Calendar },
          { id: "reseptit", label: "Reseptit", icon: BookOpen },
          { id: "kauppa", label: "Kauppalista", icon: ShoppingCart },
          { id: "profiili", label: "Ravintoprofiili", icon: User }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* --- TAB CONTENT: TÄNÄÄN --- */}
      {activeTab === "tanaan" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Macros summary ring & bars */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 text-center flex flex-col items-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4">Energiataso</span>
              
              {/* Circular progress simulated */}
              <div className="relative w-36 h-36 flex items-center justify-center rounded-full border-4 border-secondary">
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin-slow opacity-20" />
                <div className="flex flex-col text-center">
                  <span className="text-3xl font-black font-heading">{totalConsumedCalories}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">/ {data?.targets?.calories || 2000} kcal</span>
                </div>
              </div>

              <div className="mt-4 text-xs font-bold text-muted-foreground">
                Jäljellä: <span className="text-emerald-400 font-extrabold text-sm">{remainingCalories} kcal</span>
              </div>
            </div>

            {/* Macro Bars */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-4">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-muted-foreground">Päivän makroasettelu</h4>
              
              <div className="flex flex-col gap-3">
                {/* Protein */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Proteiini</span>
                    <span>{todayNutrition.protein} / {data?.targets?.protein} g</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, Math.round((todayNutrition.protein / (data?.targets?.protein || 1)) * 100))}%` }} />
                  </div>
                </div>

                {/* Carbs */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Hiilihydraatit</span>
                    <span>{todayNutrition.carbohydrates} / {data?.targets?.carbs} g</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, Math.round((todayNutrition.carbohydrates / (data?.targets?.carbs || 1)) * 100))}%` }} />
                  </div>
                </div>

                {/* Fat */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Rasva</span>
                    <span>{todayNutrition.fat} / {data?.targets?.fat} g</span>
                  </div>
                  <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(100, Math.round((todayNutrition.fat / (data?.targets?.fat || 1)) * 100))}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Scheduled Meals list & Swap suggestions */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* AI Highlight Review */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex gap-3 items-start">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-foreground mb-1">AI-ravintovalmentajan katsaus</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {todayPlan?.is_workout_day 
                    ? "Tänään on treenipäivä! Suosittelen nauttimaan lounaan ja välipalan hiilihydraattipainotteisesti ennen harjoitusta suorituskyvyn tukemiseksi."
                    : "Tänään on lepopäivä. Pidetään ravinto hieman kevyempänä, mutta huolehditaan runsaasta proteiininsaannista lihasten palautumisen tueksi."
                  }
                </p>
              </div>
            </div>

            {/* Meals List */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-base">Päivän ateriat</h3>
              
              <div className="flex flex-col gap-4">
                {activeTodayMeals.map((meal: any) => (
                  <div key={meal.id} className="p-4 bg-secondary/15 rounded-xl border border-border/20 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                    <div className="flex flex-col text-left">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-wider w-fit">
                        {meal.meal_type === "breakfast" ? "Aamiainen" : (meal.meal_type === "lunch" ? "Lounas" : (meal.meal_type === "snack" ? "Välipala" : "Päivällinen"))}
                      </span>
                      <span className="font-bold text-foreground text-sm mt-1">{meal.recipe_name}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {meal.calories} kcal | P: {meal.protein}g | H: {meal.carbs}g | R: {meal.fat}g
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedDetailMeal(meal)}
                        className="px-3 py-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Katso ohje
                      </button>
                      <button
                        onClick={() => handleSuggestRemaining(meal.id, meal)}
                        className="px-3 py-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Vaihda ateria
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alternatives Suggestion Modal/Box if swapping */}
            {swappingMealId && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 flex flex-col gap-4">
                <h4 className="font-heading font-bold text-sm text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Ateriaehdotukset tavoitteeseesi
                </h4>
                <p className="text-xs text-muted-foreground">Valitse alta parhaiten sopiva vaihtoehtoinen ateria:</p>

                <div className="flex flex-col gap-3">
                  {macroAlternatives.map((alt: any) => (
                    <div key={alt.recipe.id} className="p-4 bg-slate-900 border border-border/40 rounded-xl flex justify-between items-center gap-4">
                      <div className="text-left">
                        <span className="font-bold text-xs text-foreground">{alt.recipe.name}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {alt.recipe.calories_per_serving} kcal | P: {alt.recipe.protein_per_serving}g | H: {alt.recipe.carbohydrates_per_serving}g | R: {alt.recipe.fat_per_serving}g
                        </p>
                        <span className="inline-flex items-center gap-1 mt-1 text-[8px] font-bold text-emerald-400 uppercase tracking-widest">
                          Yhteensopivuus: {alt.score}%
                        </span>
                      </div>
                      <button
                        onClick={() => handleConfirmSwap(alt.recipe)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:opacity-90 transition-all cursor-pointer"
                      >
                        Valitse
                      </button>
                    </div>
                  ))}
                  {macroAlternatives.length === 0 && (
                    <p className="text-xs text-muted-foreground">Etsitään sopivia reseptejä...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: VIIKKOSUUNNITELMA --- */}
      {activeTab === "viikko" && (
        <div className="flex flex-col gap-6 text-left">
          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-secondary/10 border border-border/30 p-4 rounded-2xl gap-4">
            <div>
              <h4 className="text-xs font-bold">Ateriamäärä suunnitelmassa</h4>
              <p className="text-[10px] text-muted-foreground">Valitse päivittäinen ruokarytmi.</p>
            </div>
            
            <div className="flex bg-secondary/30 rounded-lg p-0.5 border border-border/40">
              {[3, 4, 5].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => handleUpdateMealsCount(cnt)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    mealsCount === cnt 
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cnt} ateriaa/pv
                </button>
              ))}
            </div>
          </div>

          {/* Weekly Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {data?.plan?.map((day: any, idx: number) => {
              const weekDays = ["Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai", "Sunnuntai"];
              return (
                <div key={day.id} className="rounded-2xl glass-panel border border-border/40 p-4 bg-secondary/10 flex flex-col justify-between min-h-[350px]">
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-border/20 pb-2">
                      <span className="font-heading font-black text-xs text-foreground">{weekDays[idx]}</span>
                      {day.is_workout_day ? (
                        <Dumbbell className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Lepo</span>
                      )}
                    </div>

                    {/* Day meals */}
                    <div className="flex flex-col gap-2">
                      {day.planned_meals?.slice(0, mealsCount).map((meal: any) => {
                        const isLocked = lockedMeals.has(meal.id);
                        return (
                          <div 
                            key={meal.id} 
                            onClick={() => setSelectedDetailMeal(meal)}
                            className="p-2 bg-secondary/15 rounded-lg border border-border/10 flex flex-col justify-between h-20 text-[10px] cursor-pointer hover:border-primary/50 hover:bg-secondary/25 transition-all text-left"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-foreground line-clamp-2 max-w-[80%]">{meal.recipe_name}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleMealLock(meal.id); }} 
                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {isLocked ? <Lock className="w-2.5 h-2.5 text-primary" /> : <Unlock className="w-2.5 h-2.5 opacity-40" />}
                              </button>
                            </div>
                            <span className="text-[9px] text-muted-foreground font-semibold">
                              {meal.calories} kcal
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border/20 pt-2 mt-4 text-[9px] font-bold text-muted-foreground flex justify-between">
                    <span>Yhteensä:</span>
                    <span className="text-primary">{calculatePlannedDayNutrition(day.planned_meals?.slice(0, mealsCount)).calories} kcal</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: RESEPTIT --- */}
      {activeTab === "reseptit" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
          {/* Left side: list of recipes with filter */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex items-center gap-2 bg-secondary/40 border border-border/40 rounded-xl px-3 py-2 text-xs">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Hae reseptejä..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none flex-1"
              />
            </div>

            {/* Diet Filter Buttons */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-secondary/20 border border-border/40 rounded-xl">
              {[
                { label: "Kaikki", value: "all" },
                { label: "Kasvis", value: "vegetarian" },
                { label: "Vegaani", value: "vegan" }
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setDietFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    dietFilter === f.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Recipes Scroll area */}
            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredRecipes.map(recipe => (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className={`p-4 bg-secondary/10 border rounded-xl flex gap-3 items-center justify-between cursor-pointer transition-all ${
                    selectedRecipe?.id === recipe.id ? "border-primary" : "border-border/30 hover:border-border/60"
                  }`}
                >
                  <div className="text-left flex-1">
                    <h5 className="font-bold text-xs text-foreground">{recipe.name}</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {recipe.calories_per_serving} kcal | P: {recipe.protein_per_serving}g | Kesto: {recipe.cooking_time} min
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>

          {/* Right side: Selected Recipe Card & portion size scaler */}
          {selectedRecipe && (
            <div className="lg:col-span-7 rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-6">
              {/* Illustrative Food Image Frame */}
              <div className="w-full h-48 rounded-xl bg-gradient-to-tr from-violet-600/30 to-indigo-900/30 border border-border/20 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/10 via-slate-900/40 to-slate-900/90" />
                <Utensils className="w-12 h-12 text-primary/40 relative z-10" />
                <h3 className="font-heading font-black text-lg text-foreground mt-3 relative z-10">{selectedRecipe.name}</h3>
                <span className="px-2 py-0.5 rounded bg-slate-950/80 border border-border/30 text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-2 relative z-10">
                  {selectedRecipe.calories_per_serving} kcal / annos
                </span>
              </div>

              {/* Servings count / own portion factor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-secondary/15 rounded-xl border border-border/20 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-muted-foreground uppercase tracking-wide text-[9px]">Annoksia (Perhe)</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setRecipeServings(Math.max(1, recipeServings - 1))} className="px-2.5 py-1 bg-secondary/40 border border-border/40 rounded-lg font-bold text-sm">-</button>
                    <span className="font-black text-sm">{recipeServings} kpl</span>
                    <button onClick={() => setRecipeServings(recipeServings + 1)} className="px-2.5 py-1 bg-secondary/40 border border-border/40 rounded-lg font-bold text-sm">+</button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-muted-foreground uppercase tracking-wide text-[9px] flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-primary" /> Oma annoskoko (Kerroin)
                  </label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setOwnPortionFactor(Number(Math.max(0.4, ownPortionFactor - 0.1).toFixed(1)))} className="px-2.5 py-1 bg-secondary/40 border border-border/40 rounded-lg font-bold text-sm">-</button>
                    <span className="font-black text-sm">{ownPortionFactor}x</span>
                    <button onClick={() => setOwnPortionFactor(Number(Math.min(2.0, ownPortionFactor + 0.1).toFixed(1)))} className="px-2.5 py-1 bg-secondary/40 border border-border/40 rounded-lg font-bold text-sm">+</button>
                  </div>
                </div>
              </div>

              {/* Ingredients List */}
              <div className="flex flex-col gap-2.5">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground">Ainekset (skaalattu)</h4>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedRecipe.ingredients?.map((ing: any, idx: number) => {
                    const totalAmt = Number((ing.amount * recipeServings * ownPortionFactor).toFixed(1));
                    return (
                      <div key={idx} className="flex justify-between items-center p-2 bg-secondary/5 rounded border border-border/10">
                        <span className="text-muted-foreground">{ing.name}</span>
                        <span className="font-bold">{totalAmt} {ing.unit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructions */}
              <div className="flex flex-col gap-2">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground">Valmistusohjeet</h4>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {selectedRecipe.instructions || "Ei lisättyjä valmistusohjeita."}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2.5 pt-4 border-t border-border/20">
                <button
                  onClick={() => alert("Resepti lisätty kauppalappuun!")}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer"
                >
                  Lisää kauppalistaan
                </button>
                <button
                  onClick={() => alert("Lisätty suosikiksi!")}
                  className="px-4 py-2.5 rounded-xl border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground font-bold text-xs transition-all cursor-pointer"
                >
                  Merkitse suosikiksi
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: KAUPPALISTA --- */}
      {activeTab === "kauppa" && (
        <div className="flex flex-col gap-6 text-left">
          {/* Overview banner */}
          <div className="rounded-2xl bg-secondary/10 border border-border/30 p-5 flex gap-3.5 items-start">
            <ShoppingCart className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-foreground">Normalisoitu ostoslista</h4>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                Kauppalista yhdistää ainesosamäärät automaattisesti, pyöristää ne ostoyksiköihin ja jättää pois ainekset, jotka olet merkinnyt jo löytyväksi kaapistasi (pantry).
              </p>
            </div>
          </div>

          {/* Aggregated List categorized */}
          <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-border/20 pb-3">
              <h3 className="font-heading font-bold text-base">Ostotarpeet</h3>
              <button
                onClick={() => setBoughtItems(new Set())}
                className="text-[10px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
              >
                Nollaa valinnat
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Ostettavat (To Buy) */}
              <div className="flex flex-col gap-3">
                <h4 className="font-bold text-primary uppercase tracking-wide text-[10px] border-b border-border/10 pb-1">Ostettavat tuotteet</h4>
                
                <div className="flex flex-col gap-2">
                  {shoppingList
                    .filter(i => !i.inPantry)
                    .map((item, idx) => {
                      const isBought = boughtItems.has(item.name);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleBoughtItem(item.name)}
                          className={`flex items-center gap-3 p-3 bg-secondary/15 rounded-xl border border-border/10 cursor-pointer transition-all ${
                            isBought ? "opacity-45" : "hover:border-border/30"
                          }`}
                        >
                          {isBought ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                          <span className={isBought ? "line-through text-muted-foreground" : "font-semibold"}>{item.name}</span>
                          <span className="ml-auto font-bold text-primary">{item.amount} {item.unit}</span>
                        </div>
                      );
                    })}
                  {shoppingList.filter(i => !i.inPantry).length === 0 && (
                    <p className="text-xs text-muted-foreground">Kaikki ainekset löytyvät jo kuivavarastostasi!</p>
                  )}
                </div>
              </div>

              {/* Löytyy kaapista (In Pantry) */}
              <div className="flex flex-col gap-3 opacity-70">
                <h4 className="font-bold text-zinc-500 uppercase tracking-wide text-[10px] border-b border-border/10 pb-1">Löytyy kotoa (Kuivakaappi)</h4>
                
                <div className="flex flex-col gap-2">
                  {shoppingList
                    .filter(i => i.inPantry)
                    .map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-secondary/5 rounded-xl border border-border/10">
                        <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          {item.name}
                        </span>
                        <span className="font-bold text-muted-foreground">{item.amount} {item.unit}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: RAVINTOPROFIILI --- */}
      {activeTab === "profiili" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
          {/* Left panel: Preferences form */}
          <div className="lg:col-span-7 rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-6">
            <h3 className="font-heading font-bold text-base flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Ravintovalmennusasetukset
            </h3>
            
            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5 mt-2 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ruokavalio</label>
                <select
                  value={dietType}
                  onChange={e => setDietType(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary text-muted-foreground"
                >
                  <option value="standard" className="bg-slate-900 text-foreground">Seka- eli tavallinen ruokavalio</option>
                  <option value="vegetarian" className="bg-slate-900 text-foreground">Kasvisruokavalio</option>
                  <option value="vegan" className="bg-slate-900 text-foreground">Vegaaniruokavalio</option>
                  <option value="pescatarian" className="bg-slate-900 text-foreground">Pescovegetaarinen (kala ja kasvis)</option>
                  <option value="gluten_free" className="bg-slate-900 text-foreground">Gluteeniton ruokavalio</option>
                  <option value="lactose_free" className="bg-slate-900 text-foreground">Laktoositon ruokavalio</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ruokailijoiden määrä (Perhe)</label>
                  <input
                    type="number"
                    value={householdSize}
                    onChange={e => setHouseholdSize(Number(e.target.value))}
                    className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Budjettitaso</label>
                  <select
                    value={budgetPreference}
                    onChange={e => setBudgetPreference(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary text-muted-foreground"
                  >
                    <option value="low" className="bg-slate-900 text-foreground">Edullinen (opiskelijaystävällinen)</option>
                    <option value="medium" className="bg-slate-900 text-foreground">Normaali (tavanomainen budjetti)</option>
                    <option value="high" className="bg-slate-900 text-foreground">Vapaa (huippulaatu edellä)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tähteiden hyödyntäminen</label>
                <select
                  value={leftoversPreference}
                  onChange={e => setLeftoversPreference(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-primary text-muted-foreground"
                >
                  <option value="none" className="bg-slate-900 text-foreground">Haluan valmistaa joka päivä eri ruokaa</option>
                  <option value="two_days" className="bg-slate-900 text-foreground">Samaa ruokaa voi syödä kaksi kertaa (suositus)</option>
                  <option value="three_days" className="bg-slate-900 text-foreground">Samaa ruokaa voi syödä 2–3 päivää</option>
                  <option value="cook_less" className="bg-slate-900 text-foreground">Haluan valmistaa ruokaa vain muutamana päivänä viikossa</option>
                </select>
              </div>

              <button
                type="submit"
                className="py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer w-fit"
              >
                Tallenna profiili
              </button>
            </form>
          </div>

          {/* Right panel: Allergies & Pantry items Lists */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Allergies */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-sm">Allergiat & vältettävät aineet</h3>
              <p className="text-[10px] text-muted-foreground">Lisää raaka-aineet, joita et halua AI:n koskaan ehdottavan resepteissä.</p>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {allergies.map((allergy, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-bold capitalize">
                    {allergy}
                    <button onClick={() => handleRemoveAllergy(i)} className="hover:text-red-200 cursor-pointer ml-1">×</button>
                  </span>
                ))}
                {allergies.length === 0 && (
                  <span className="text-[10px] text-muted-foreground">Ei asetettuja allergioita.</span>
                )}
              </div>

              <div className="flex gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Esim. maito, kala, soija..."
                  value={newAllergy}
                  onChange={e => setNewAllergy(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 outline-none flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddAllergy}
                  className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 font-bold cursor-pointer"
                >
                  Lisää
                </button>
              </div>
            </div>

            {/* Pantry */}
            <div className="rounded-2xl glass-panel border border-border/40 p-6 bg-secondary/10 flex flex-col gap-4">
              <h3 className="font-heading font-bold text-sm">Kuivakaappi (Ruokavarasto)</h3>
              <p className="text-[10px] text-muted-foreground">Tuotteet, jotka löytyvät jo valmiiksi kotoa. Näitä ei lisätä kauppalistalle ostettavaksi.</p>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {pantry.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary font-bold capitalize">
                    {item}
                    <button onClick={() => handleRemovePantryItem(i)} className="hover:text-primary-200 cursor-pointer ml-1">×</button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Esim. riisi, kaurahiutale, suola..."
                  value={newPantryItem}
                  onChange={e => setNewPantryItem(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 outline-none flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddPantryItem}
                  className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 font-bold cursor-pointer"
                >
                  Lisää
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedDetailMeal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-border/80 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 flex flex-col gap-6 relative shadow-2xl animate-scale-in text-left text-xs">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-widest">
                  {selectedDetailMeal.meal_type === "breakfast" ? "Aamiainen" : (selectedDetailMeal.meal_type === "lunch" ? "Lounas" : (selectedDetailMeal.meal_type === "snack" ? "Välipala" : "Päivällinen"))}
                </span>
                <h3 className="font-heading font-black text-lg text-foreground mt-2">{selectedDetailMeal.recipe_name}</h3>
                {selectedDetailMeal.is_leftover && (
                  <span className="inline-block mt-1 text-[9px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                    Tähteet: {selectedDetailMeal.repetition_reason || "Eväsannos edelliseltä päivältä"}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setSelectedDetailMeal(null)}
                className="text-muted-foreground hover:text-foreground font-black text-xl p-1 bg-secondary/30 rounded-lg cursor-pointer leading-none"
              >
                ×
              </button>
            </div>

            {/* Visual Image Fallback */}
            <div className="w-full h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/30 border border-border/20 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
              <Utensils className="w-10 h-10 text-primary/60" />
              <span className="absolute bottom-2 right-3 text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-wider">AI-valmentajan havainnekuva</span>
            </div>

            {/* Servings Counter and own portion multiplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-secondary/5 rounded-2xl border border-border/10 p-4">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Valmistettava määrä (perhe/ruokailijat)</label>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setDetailServings(s => Math.max(1, s - 1))}
                    className="w-8 h-8 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/70 flex items-center justify-center font-bold text-sm cursor-pointer"
                  >
                    −
                  </button>
                  <span className="font-heading font-black text-xs text-foreground">{detailServings} annosta</span>
                  <button 
                    type="button"
                    onClick={() => setDetailServings(s => s + 1)}
                    className="w-8 h-8 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/70 flex items-center justify-center font-bold text-sm cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Käyttäjän oman annoksen koko</label>
                <select 
                  value={detailUserMultiplier}
                  onChange={e => setDetailUserMultiplier(Number(e.target.value))}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-3 py-2 text-xs outline-none text-muted-foreground w-full cursor-pointer"
                >
                  <option value="0.8">Pienempi annos (80%)</option>
                  <option value="1.0">Normaali annos (100%)</option>
                  <option value="1.2">Suurempi annos (120%)</option>
                  <option value="1.5">Massa-annos (150%)</option>
                </select>
              </div>
            </div>

            {/* Favorite status & User interactions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground font-semibold">Suosikkitila & Toivottu käyttötiheys</label>
                <select 
                  value={detailFavoriteFrequency}
                  onChange={e => handleFavoriteFrequencyChange(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl px-3 py-2 text-xs outline-none text-muted-foreground cursor-pointer"
                >
                  <option value="occasional">Silloin tällöin</option>
                  <option value="weekly">Noin kerran viikossa</option>
                  <option value="frequent">Useita kertoja viikossa</option>
                  <option value="always">Käytä aina sopivassa tilanteessa</option>
                  <option value="never">Älä ehdota toistaiseksi</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Arvostele resepti tai hylkää</label>
                <div className="flex gap-2">
                  <button 
                    onClick={handleToggleFavoriteDetail}
                    className={`flex-1 py-2 px-3 rounded-xl border border-border/40 font-bold transition-all text-center cursor-pointer ${detailIsFavorite ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground'}`}
                  >
                    ★ Suosikki
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        await fetch("/api/nutrition/plan", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "toggle_favorite",
                            recipeId: selectedDetailMeal.recipe_id,
                            isFavorite: false,
                            rejected: true,
                            rejectionReason: "Ei mieleinen ruoka"
                          })
                        });
                        alert("Ruoka hylätty suunnitelmista jatkossa.");
                        setSelectedDetailMeal(null);
                        fetchNutritionData();
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-semibold cursor-pointer"
                  >
                    Hylkää
                  </button>
                </div>
              </div>
            </div>

            {/* Macros Breakdown */}
            <div className="flex flex-col gap-2">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground">Ravintoarvojen erittely</h4>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
                <div className="bg-secondary/10 border border-border/10 p-2.5 rounded-xl flex flex-col justify-between">
                  <span className="text-muted-foreground font-semibold">Perusannos</span>
                  <span className="font-bold mt-1 text-foreground">
                    {Math.round(selectedDetailMeal.calories)} kcal
                  </span>
                </div>
                <div className="bg-primary/5 border border-primary/20 p-2.5 rounded-xl flex flex-col justify-between">
                  <span className="text-primary font-bold">Oma annos ({Math.round(detailUserMultiplier * 100)}%)</span>
                  <span className="font-black mt-1 text-primary">
                    {Math.round(selectedDetailMeal.calories * detailUserMultiplier)} kcal
                  </span>
                </div>
                <div className="bg-secondary/15 border border-border/20 p-2.5 rounded-xl flex flex-col justify-between">
                  <span className="text-muted-foreground font-semibold">Koko valmistus ({detailServings}a)</span>
                  <span className="font-bold mt-1 text-foreground">
                    {Math.round(selectedDetailMeal.calories * detailServings)} kcal
                  </span>
                </div>
              </div>
            </div>

            {/* Ingredients and quantities scaled */}
            <div className="flex flex-col gap-2">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground">Ainesosat ja Ruokamäärät (Skaalattu)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {selectedDetailMeal.ingredients_snapshot?.map((ing: any, idx: number) => {
                  const scale = (detailServings / (selectedDetailMeal.household_servings || 1)) * (detailUserMultiplier / (selectedDetailMeal.portion_size_factor || 1.0));
                  const totalAmt = Number((ing.amount * scale).toFixed(1));
                  return (
                    <div key={idx} className="flex justify-between items-center p-2 bg-secondary/5 rounded border border-border/10">
                      <span className="text-muted-foreground font-semibold">{ing.name}</span>
                      <span className="font-bold text-foreground">{totalAmt} {ing.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cooking Instructions */}
            <div className="flex flex-col gap-2">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground font-black">Vaiheittainen valmistusohje</h4>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-secondary/5 border border-border/10 p-3 rounded-xl max-h-36 overflow-y-auto">
                {selectedDetailMeal.instructions || "1. Valmistele ainesosat kulhoon.\n2. Sekoita ja tarjoile dynaamisena ateriana."}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-4 border-t border-border/20">
              <button
                onClick={handleSaveMealPlanSettings}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer text-center"
              >
                Päivitä suunnitelma & kauppalista
              </button>
              <button
                onClick={() => setSelectedDetailMeal(null)}
                className="px-4 py-3 rounded-xl border border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground font-semibold text-xs transition-all cursor-pointer"
              >
                Sulje
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
