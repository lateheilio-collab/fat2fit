"use client";

import { useState, useEffect } from "react";
import {
  Utensils,
  Search,
  Camera,
  Plus,
  Trash2,
  Check,
  Flame,
  ArrowRight,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getNutritionTargets } from "@/lib/calculations/nutrition";

type LoggedItem = {
  id: string;
  foodName: string;
  amountG: number;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
};

type LoggedMeal = {
  id: string;
  loggedAt: string;
  mealType: string;
  accuracyClass: string;
  items: LoggedItem[];
};

export default function MealsPage() {
  const supabase = supabaseBrowser();
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeal[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Date state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" }));
  
  // Custom nutrition target states
  const [caloriesTarget, setCaloriesTarget] = useState(2200);
  const [proteinTarget, setProteinTarget] = useState(160);
  const [carbsTarget, setCarbsTarget] = useState(220);
  const [fatTarget, setFatTarget] = useState(70);
  const [fiberTarget, setFiberTarget] = useState(30);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSearchFood, setSelectedSearchFood] = useState<any | null>(null);
  const [logAmountG, setLogAmountG] = useState<number>(100);
  const [mealTypeSelector, setMealTypeSelector] = useState<string>("breakfast");

  // Camera / Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDraft, setAnalysisDraft] = useState<any | null>(null);

  // Custom food creation state
  const [showCreateFoodModal, setShowCreateFoodModal] = useState(false);
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodCalories, setNewFoodCalories] = useState("");
  const [newFoodProtein, setNewFoodProtein] = useState("");
  const [newFoodCarbs, setNewFoodCarbs] = useState("");
  const [newFoodFat, setNewFoodFat] = useState("");
  const [newFoodFiber, setNewFoodFiber] = useState("");

  // Load meals and targets for selected date
  const loadTodayMeals = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch active goal and target settings
      const targets = await getNutritionTargets(supabase, user.id);
      setCaloriesTarget(targets.calories);
      setProteinTarget(targets.protein);
      setCarbsTarget(targets.carbs);
      setFatTarget(targets.fat);
      setFiberTarget(targets.fiber);

      // 2. Fetch meals for selected date (Helsinki timezone)
      const offset = new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("GMT+3") || new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("EEST") ? "+03:00" : "+02:00";
      const dateStart = new Date(`${selectedDate}T00:00:00${offset}`);
      const dateEnd = new Date(`${selectedDate}T23:59:59.999${offset}`);

      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select(`
          id,
          logged_at,
          meal_type,
          accuracy_class,
          meal_items (
            id,
            food_name,
            amount_g,
            energy_kcal,
            protein_g,
            carbohydrates_g,
            fat_g,
            fiber_g
          )
        `)
        .eq("user_id", user.id)
        .gte("logged_at", dateStart.toISOString())
        .lte("logged_at", dateEnd.toISOString())
        .order("logged_at", { ascending: true });

      if (mealsError) throw mealsError;

      const formatted = (mealsData || []).map((m: any) => ({
        id: m.id,
        loggedAt: m.logged_at,
        mealType: m.meal_type,
        accuracyClass: m.accuracy_class,
        items: (m.meal_items || []).map((i: any) => ({
          id: i.id,
          foodName: i.food_name,
          amountG: Number(i.amount_g),
          energyKcal: Number(i.energy_kcal),
          proteinG: Number(i.protein_g),
          carbsG: Number(i.carbohydrates_g),
          fatG: Number(i.fat_g),
          fiberG: Number(i.fiber_g || 0),
        })),
      }));

      setLoggedMeals(formatted);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayMeals();
  }, [selectedDate]);

  // Search foods trigger
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Log manual food
  const handleLogManualFood = async () => {
    if (!selectedSearchFood) return;
    setLoading(true);

    try {
      const factor = logAmountG / 100;
      
      const offset = new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("GMT+3") || new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("EEST") ? "+03:00" : "+02:00";
      const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
      const loggedAt = selectedDate === todayStr 
        ? new Date().toISOString()
        : new Date(`${selectedDate}T12:00:00${offset}`).toISOString();

      const payload = {
        mealType: mealTypeSelector,
        loggedAt,
        accuracyClass: "WEIGHED",
        items: [
          {
            foodId: selectedSearchFood.id,
            foodName: selectedSearchFood.name_fi,
            amountG: logAmountG,
            energyKcal: Math.round(selectedSearchFood.energy_kcal * factor),
            proteinG: Number((selectedSearchFood.protein_g * factor).toFixed(1)),
            carbohydratesG: Number((selectedSearchFood.carbohydrates_g * factor).toFixed(1)),
            fatG: Number((selectedSearchFood.fat_g * factor).toFixed(1)),
            fiberG: Number((selectedSearchFood.fiber_g * factor).toFixed(1)),
          },
        ],
      };

      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Reset
      setSelectedSearchFood(null);
      setSearchQuery("");
      setSearchResults([]);
      loadTodayMeals();
    } catch (err: any) {
      alert(err.message || "Kirjaus epäonnistui");
    } finally {
      setLoading(false);
    }
  };

  // Create custom food in reference cache
  const handleCreateCustomFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFoodName.trim()) return;

    try {
      setLoading(true);
      const payload = {
        name_fi: newFoodName.trim(),
        name_en: newFoodName.trim(),
        energy_kcal: parseFloat(newFoodCalories) || 0,
        protein_g: parseFloat(newFoodProtein) || 0,
        carbohydrates_g: parseFloat(newFoodCarbs) || 0,
        fat_g: parseFloat(newFoodFat) || 0,
        fiber_g: parseFloat(newFoodFiber) || 0,
      };

      const { data, error } = await supabase
        .from("food_reference_cache")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Automatically select the new food for logging
      setSelectedSearchFood(data);
      setSearchQuery("");
      setSearchResults([]);
      setShowCreateFoodModal(false);
    } catch (err: any) {
      alert("Elintarvikkeen luonti epäonnistui: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Image Upload and Analysis Handlers
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleStartAnalysis = async () => {
    if (!imagePreview) return;
    setAnalyzing(true);
    setAnalysisDraft(null);

    try {
      const res = await fetch("/api/nutrition/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imagePreview,
          plateProfile: { name: "Iso matala lautanen", diameterCm: 27 },
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAnalysisDraft(data.analysis);
    } catch (err: any) {
      alert(err.message || "Valokuva-analyysi epäonnistui.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Confirm and log analyzed meal
  const handleLogAnalyzedMeal = async () => {
    if (!analysisDraft) return;
    setLoading(true);

    try {
      // Map analysis draft items to database models
      const items = analysisDraft.items.map((item: any) => {
        // Find selected Fineli match or use defaults
        const activeMatch = item.suggestedFineliMatches?.[0] || {};
        const factor = item.estimatedGrams / 100;

        return {
          foodId: activeMatch.fineliId || null,
          foodName: item.detectedName,
          amountG: item.estimatedGrams,
          energyKcal: Math.round((activeMatch.energyKcal || 150) * factor),
          proteinG: Number(((activeMatch.proteinG || 10) * factor).toFixed(1)),
          carbohydratesG: Number(((activeMatch.carbsG || 15) * factor).toFixed(1)),
          fatG: Number(((activeMatch.fatG || 5) * factor).toFixed(1)),
          fiberG: Number(((activeMatch.fiberG || 1) * factor).toFixed(1)),
        };
      });

      const offset = new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("GMT+3") || new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("EEST") ? "+03:00" : "+02:00";
      const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
      const loggedAt = selectedDate === todayStr 
        ? new Date().toISOString()
        : new Date(`${selectedDate}T12:00:00${offset}`).toISOString();

      const payload = {
        mealType: analysisDraft.mealType || "lunch",
        loggedAt,
        accuracyClass: "PHOTO_CONFIRMED",
        items,
      };

      const res = await fetch("/api/nutrition/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Clean up
      setImageFile(null);
      setImagePreview(null);
      setAnalysisDraft(null);
      loadTodayMeals();
    } catch (err: any) {
      alert(err.message || "Tietojen tallennus epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a logged meal
  const handleDeleteMeal = async (mealId: string) => {
    if (!confirm("Haluatko varmasti poistaa tämän aterian?")) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("meals").delete().eq("id", mealId);
      if (error) throw error;
      loadTodayMeals();
    } catch (err: any) {
      alert(err.message || "Poisto epäonnistui.");
    } finally {
      setLoading(false);
    }
  };

  // Calorie & macro calculations
  const totalCalories = loggedMeals.reduce((sum, m) => 
    sum + m.items.reduce((itemSum, i) => itemSum + i.energyKcal, 0), 0
  );
  const totalProtein = loggedMeals.reduce((sum, m) => 
    sum + m.items.reduce((itemSum, i) => itemSum + i.proteinG, 0), 0
  );
  const totalCarbs = loggedMeals.reduce((sum, m) => 
    sum + m.items.reduce((itemSum, i) => itemSum + i.carbsG, 0), 0
  );
  const totalFat = loggedMeals.reduce((sum, m) => 
    sum + m.items.reduce((itemSum, i) => itemSum + i.fatG, 0), 0
  );
  const totalFiber = loggedMeals.reduce((sum, m) => 
    sum + m.items.reduce((itemSum, i) => itemSum + i.fiberG, 0), 0
  );

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Header with Date Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <Utensils className="w-3.5 h-3.5" />
            Ravintoseuranta
          </span>
          <h2 className="text-3xl font-bold tracking-tight font-heading">
            Syödyt ateriat
          </h2>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm glass-panel py-2.5 px-4 rounded-xl border border-border/40 w-fit">
          <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mr-1.5">Tarkasteltava päivä:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-0 text-foreground font-semibold outline-none cursor-pointer text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: LOGGED MEALS */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Daily macro summary (nautitut vs suositellut) */}
          <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-heading font-semibold text-base">Päivän ravintoarvot</h3>
                <p className="text-[11px] text-muted-foreground">Toteuma suhteessa valmentajan asettamiin suosituksiin</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-400">{totalCalories} / {caloriesTarget} kcal</span>
                <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider mt-0.5">kalorit</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Proteiini */}
              <div className="flex flex-col gap-2 bg-secondary/10 p-4 rounded-2xl border border-border/20">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-foreground">Proteiini</span>
                  <span className="text-violet-400">{totalProtein.toFixed(1)}g <span className="text-muted-foreground font-normal text-[10px]">/ {proteinTarget}g</span></span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalProtein / (proteinTarget || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Saavutettu</span>
                  <span>{proteinTarget ? Math.round((totalProtein / proteinTarget) * 100) : 0}%</span>
                </div>
              </div>

              {/* Hiilihydraatit */}
              <div className="flex flex-col gap-2 bg-secondary/10 p-4 rounded-2xl border border-border/20">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-foreground">Hiilihydraatit</span>
                  <span className="text-sky-400">{totalCarbs.toFixed(1)}g <span className="text-muted-foreground font-normal text-[10px]">/ {carbsTarget}g</span></span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalCarbs / (carbsTarget || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Saavutettu</span>
                  <span>{carbsTarget ? Math.round((totalCarbs / carbsTarget) * 100) : 0}%</span>
                </div>
              </div>

              {/* Rasva */}
              <div className="flex flex-col gap-2 bg-secondary/10 p-4 rounded-2xl border border-border/20">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-foreground">Rasva</span>
                  <span className="text-amber-400">{totalFat.toFixed(1)}g <span className="text-muted-foreground font-normal text-[10px]">/ {fatTarget}g</span></span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalFat / (fatTarget || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Saavutettu</span>
                  <span>{fatTarget ? Math.round((totalFat / fatTarget) * 100) : 0}%</span>
                </div>
              </div>

              {/* Kuidut */}
              <div className="flex flex-col gap-2 bg-secondary/10 p-4 rounded-2xl border border-border/20">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-foreground">Kuidut</span>
                  <span className="text-emerald-400">{totalFiber.toFixed(1)}g <span className="text-muted-foreground font-normal text-[10px]">/ {fiberTarget}g</span></span>
                </div>
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalFiber / (fiberTarget || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>Saavutettu</span>
                  <span>{fiberTarget ? Math.round((totalFiber / fiberTarget) * 100) : 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Meals list */}
          <div className="flex flex-col gap-4">
            <h3 className="font-heading font-semibold text-lg">Päivän ateriat</h3>

            {loading && loggedMeals.length === 0 ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : loggedMeals.length === 0 ? (
              <div className="p-8 rounded-2xl glass-panel border border-dashed border-border/40 text-center text-muted-foreground text-sm">
                Kirjaa ensimmäinen ateriasi oikealta hakutoiminnolla tai valokuvaamalla.
              </div>
            ) : (
              loggedMeals.map((meal) => (
                <div key={meal.id} className="rounded-2xl glass-panel border border-border/40 p-5 flex flex-col gap-3 relative group">
                  <button
                    onClick={() => handleDeleteMeal(meal.id)}
                    className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="capitalize text-xs font-bold px-2.5 py-1 rounded-full bg-secondary text-foreground">
                      {meal.mealType === "breakfast" ? "Aamiainen" : 
                       meal.mealType === "lunch" ? "Lounas" : 
                       meal.mealType === "dinner" ? "Päivällinen" : 
                       meal.mealType === "snack" ? "Välipala" : 
                       meal.mealType === "evening_snack" ? "Iltapala" : "Muu"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {new Date(meal.loggedAt).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {meal.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm border-b border-border/20 pb-1.5 last:border-0 last:pb-0">
                        <div>
                          <span className="font-medium text-foreground">{item.foodName}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">({item.amountG}g)</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                          <span>{item.energyKcal} kcal</span>
                          <span className="text-[10px] text-primary">{item.proteinG}g P</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: MANUAL LOGGER & PHOTO ANALYZER */}
        <div className="flex flex-col gap-6">
          
          {/* Tab Selection */}
          <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col gap-5">
            <h3 className="font-heading font-semibold text-lg">Lisää uusi ateria</h3>

            {/* Meal Type selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Ateriatyyppi</label>
              <select
                value={mealTypeSelector}
                onChange={(e) => setMealTypeSelector(e.target.value)}
                className="bg-zinc-900 text-white border border-border/40 rounded-xl p-3 text-sm outline-none w-full"
              >
                <option value="breakfast" className="bg-zinc-900 text-white">Aamiainen</option>
                <option value="lunch" className="bg-zinc-900 text-white">Lounas</option>
                <option value="dinner" className="bg-zinc-900 text-white">Päivällinen</option>
                <option value="snack" className="bg-zinc-900 text-white">Välipala</option>
                <option value="evening_snack" className="bg-zinc-900 text-white">Iltapala</option>
                <option value="other" className="bg-zinc-900 text-white">Muu</option>
              </select>
            </div>

            {/* Food Search (Fineli) */}
            <div className="flex flex-col gap-2 border-t border-border/20 pt-4">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Hae Finelistä</label>
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Esim. Kaurahiutale..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary/30 border border-border/40 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none"
                />
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-2 rounded-xl border border-border/30 bg-background max-h-48 overflow-y-auto divide-y divide-border/20 shadow-lg z-20 relative">
                  {searchResults.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => {
                        setSelectedSearchFood(food);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="w-full text-left p-3 hover:bg-secondary/40 text-xs font-semibold flex justify-between items-center transition-colors"
                    >
                      <span>{food.name_fi}</span>
                      <span className="text-muted-foreground font-medium">{food.energy_kcal} kcal/100g</span>
                    </button>
                  ))}
                </div>
              )}

              {/* No search results fallback to create custom food */}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="mt-2 p-4 rounded-xl border border-border/30 bg-secondary/15 flex flex-col items-center justify-center text-center gap-2.5">
                  <p className="text-xs text-muted-foreground font-medium">Ei tuloksia haulla "{searchQuery}"</p>
                  <button
                    onClick={() => {
                      setNewFoodName(searchQuery);
                      setNewFoodCalories("");
                      setNewFoodProtein("");
                      setNewFoodCarbs("");
                      setNewFoodFat("");
                      setNewFoodFiber("");
                      setShowCreateFoodModal(true);
                    }}
                    className="py-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Luo uusi elintarvike
                  </button>
                </div>
              )}
            </div>

            {/* Manual log amount popup */}
            {selectedSearchFood && (
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 flex flex-col gap-3 animate-fade-in">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-foreground capitalize">{selectedSearchFood.name_fi}</h4>
                  <button onClick={() => setSelectedSearchFood(null)} className="text-xs text-muted-foreground hover:text-foreground">Peruuta</button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={logAmountG}
                    onChange={(e) => setLogAmountG(parseInt(e.target.value) || 0)}
                    className="w-24 bg-background border border-border/40 rounded-xl p-2 text-center text-sm outline-none"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">grammaa</span>
                </div>
                <button
                  onClick={handleLogManualFood}
                  className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-primary/20 w-full"
                >
                  <Check className="w-4 h-4" />
                  Tallenna annos
                </button>
              </div>
            )}

            {/* Camera Photo Analyzer */}
            <div className="flex flex-col gap-3 border-t border-border/20 pt-4">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Tekoäly Kuva-analyysi</label>
              
              {!imagePreview ? (
                <div className="relative group border border-dashed border-border/40 hover:border-primary rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center bg-secondary/5 hover:bg-secondary/15">
                  <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs font-bold">Ota kuva tai valitse tiedosto</span>
                  <span className="text-[10px] text-muted-foreground">JPEG tai PNG tiedostomuoto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="relative rounded-2xl overflow-hidden border border-border/40 max-h-48 aspect-video flex items-center justify-center bg-black">
                    <img src={imagePreview} alt="Ateria" className="object-cover w-full h-full" />
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setAnalysisDraft(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {!analysisDraft && (
                    <button
                      onClick={handleStartAnalysis}
                      disabled={analyzing}
                      className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analysoidaan kuvaa...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Analysoi ruokakuva
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Analysis Draft Confirmation View */}
            {analysisDraft && (
              <div className="p-4 rounded-2xl bg-secondary/30 border border-emerald-500/10 flex flex-col gap-4 animate-fade-in">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  Kuva-analyysin tulos
                </div>

                <div className="flex flex-col gap-2.5">
                  {analysisDraft.items.map((item: any, idx: number) => {
                    const selectedMatch = item.suggestedFineliMatches?.[0] || {};
                    return (
                      <div key={idx} className="flex flex-col gap-1 border-b border-border/10 pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-bold text-foreground">{item.detectedName}</span>
                          <span className="text-xs font-semibold text-muted-foreground">{item.estimatedGrams}g</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                          <span>Fineli: {selectedMatch.name || "Ei vastaavuutta"}</span>
                          {selectedMatch.energyKcal && (
                            <span>{Math.round(selectedMatch.energyKcal * (item.estimatedGrams / 100))} kcal</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleLogAnalyzedMeal}
                  disabled={loading}
                  className="py-3 px-4 rounded-xl bg-emerald-500 text-white font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/25 w-full mt-2"
                >
                  <Check className="w-4 h-4" />
                  Vahvista ja tallenna ateria
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Food Creation Modal */}
      {showCreateFoodModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl glass-panel border border-border/40 p-6 shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Uusi ruoka-aine</span>
                <h3 className="font-heading font-bold text-xl text-foreground mt-1">Luo oma elintarvike</h3>
              </div>
              <button
                onClick={() => setShowCreateFoodModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 bg-secondary/30 rounded-lg cursor-pointer"
              >
                Sulje
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCustomFood} className="flex flex-col gap-4 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Nimi (suomeksi)</label>
                <input
                  type="text"
                  required
                  placeholder="Esim. Kaurapuuro marjoilla"
                  value={newFoodName}
                  onChange={(e) => setNewFoodName(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-sm outline-none w-full text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Energia (kcal / 100g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={newFoodCalories}
                    onChange={(e) => setNewFoodCalories(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-sm outline-none w-full text-foreground"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Proteiini (g / 100g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={newFoodProtein}
                    onChange={(e) => setNewFoodProtein(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-sm outline-none w-full text-foreground"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Hiilihydraatit (g / 100g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={newFoodCarbs}
                    onChange={(e) => setNewFoodCarbs(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-sm outline-none w-full text-foreground"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Rasva (g / 100g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={newFoodFat}
                    onChange={(e) => setNewFoodFat(e.target.value)}
                    className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-sm outline-none w-full text-foreground"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Kuitu (g / 100g) - Valinnainen</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={newFoodFiber}
                  onChange={(e) => setNewFoodFiber(e.target.value)}
                  className="bg-secondary/40 border border-border/40 rounded-xl p-3 text-sm outline-none w-full text-foreground"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 mt-2"
              >
                <Check className="w-4 h-4" />
                Tallenna tietokantaan
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
