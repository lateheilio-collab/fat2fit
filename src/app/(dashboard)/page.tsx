import {
  Sparkles,
  Calendar,
  Flame,
  Dumbbell,
  Scale,
  TrendingDown,
  TrendingUp,
  User,
  Heart,
  PlusCircle,
  Camera,
  MessageSquare,
  Clock,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getNutritionTargets } from "@/lib/calculations/nutrition";
export const dynamic = "force-dynamic";

function getHelsinkiMidnight(): Date {
  const dateStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  
  const tzString = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Helsinki",
    timeZoneName: "longOffset"
  }).format(new Date());
  
  const match = tzString.match(/GMT([+-]\d+)/);
  let offset = "+03:00";
  if (match) {
    const val = match[1];
    offset = val.includes(":") ? val : `${val}:00`;
  }
  
  return new Date(`${dateStr}T00:00:00${offset}`);
}

export default async function TodayPage() {
  const supabase = await supabaseServer();

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[50vh]">
        <p className="text-muted-foreground">Kirjaudu sisään nähdäksesi kojelaudan.</p>
        <Link href="/login" className="mt-4 py-2.5 px-5 bg-primary text-primary-foreground font-semibold rounded-2xl">
          Kirjaudu sisään
        </Link>
      </div>
    );
  }

  // 2. Fetch profile name
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const userGreeting = `Moi ${profile?.display_name || "Käyttäjä"}`;

  // 3. Fetch latest weight measurement
  const { data: latestWeightData } = await supabase
    .from("body_measurements")
    .select("value, measured_at")
    .eq("user_id", user.id)
    .eq("metric", "weight")
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentWeight = latestWeightData ? Number(latestWeightData.value) : 85.0;

  // 4. Calculate 7-day weight trend and average
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentWeights } = await supabase
    .from("body_measurements")
    .select("value")
    .eq("user_id", user.id)
    .eq("metric", "weight")
    .gte("measured_at", sevenDaysAgo.toISOString())
    .order("measured_at", { ascending: false });

  let weightDiff = 0.0;
  let avgWeight = currentWeight;
  if (recentWeights && recentWeights.length > 0) {
    const sum = recentWeights.reduce((acc, w) => acc + Number(w.value), 0);
    avgWeight = Number((sum / recentWeights.length).toFixed(1));
    
    if (recentWeights.length > 1) {
      const latestVal = Number(recentWeights[0].value);
      const oldestVal = Number(recentWeights[recentWeights.length - 1].value);
      weightDiff = Number((latestVal - oldestVal).toFixed(1));
    }
  }

  // 4.5 Fetch active goal to get target weight and calculate projection
  const { data: activeGoal } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  let targetWeight = 85.0;
  if (activeGoal) {
    const { data: goalVersion } = await supabase
      .from("goal_versions")
      .select("target_weight_kg")
      .eq("goal_id", activeGoal.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goalVersion?.target_weight_kg) {
      targetWeight = Number(goalVersion.target_weight_kg);
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: trendWeights } = await supabase
    .from("body_measurements")
    .select("value, measured_at")
    .eq("user_id", user.id)
    .eq("metric", "weight")
    .gte("measured_at", thirtyDaysAgo.toISOString())
    .order("measured_at", { ascending: true });

  let projectedDateStr = "Tarvitaan lisää mittauksia";
  if (trendWeights && trendWeights.length >= 2) {
    const oldestWeight = Number(trendWeights[0].value);
    const latestWeight = Number(trendWeights[trendWeights.length - 1].value);
    const timeDiffDays = (new Date(trendWeights[trendWeights.length - 1].measured_at).getTime() - new Date(trendWeights[0].measured_at).getTime()) / (24 * 60 * 60 * 1000);

    if (timeDiffDays > 0.5) {
      const ratePerDay = (oldestWeight - latestWeight) / timeDiffDays; // positive = weight loss
      const isLosingTarget = targetWeight < latestWeight;
      
      if (Math.abs(latestWeight - targetWeight) < 0.1) {
        projectedDateStr = "Tavoite saavutettu!";
      } else if (isLosingTarget) {
        if (ratePerDay > 0.005) {
          const daysToTarget = Math.ceil((latestWeight - targetWeight) / ratePerDay);
          const projectedDate = new Date();
          projectedDate.setDate(projectedDate.getDate() + daysToTarget);
          projectedDateStr = projectedDate.toLocaleDateString("fi-FI");
        } else {
          projectedDateStr = "Ei saavuteta nykyisellä vauhdilla";
        }
      } else {
        if (ratePerDay < -0.005) {
          const daysToTarget = Math.ceil((targetWeight - latestWeight) / Math.abs(ratePerDay));
          const projectedDate = new Date();
          projectedDate.setDate(projectedDate.getDate() + daysToTarget);
          projectedDateStr = projectedDate.toLocaleDateString("fi-FI");
        } else {
          projectedDateStr = "Ei saavuteta nykyisellä vauhdilla";
        }
      }
    }
  }

  // 5. Fetch daily calories/macros target (custom or calculated)
  const targets = await getNutritionTargets(supabase, user.id, currentWeight || 86.3);
  const caloriesTarget = targets.calories;
  const proteinTarget = targets.protein;
  const carbsTarget = targets.carbs;
  const fatTarget = targets.fat;
  const fiberTarget = targets.fiber;

  // 6. Fetch meals logged today
  const todayStart = getHelsinkiMidnight();

  const { data: mealsToday } = await supabase
    .from("meals")
    .select("id, meal_items(*)")
    .eq("user_id", user.id)
    .gte("logged_at", todayStart.toISOString());

  let caloriesConsumed = 0;
  let proteinConsumed = 0;
  let carbsConsumed = 0;
  let fatConsumed = 0;

  if (mealsToday) {
    mealsToday.forEach((meal) => {
      if (meal.meal_items) {
        meal.meal_items.forEach((item: any) => {
          caloriesConsumed += Number(item.energy_kcal || 0);
          proteinConsumed += Number(item.protein_g || 0);
          carbsConsumed += Number(item.carbohydrates_g || 0);
          fatConsumed += Number(item.fat_g || 0);
        });
      }
    });
  }

  caloriesConsumed = Math.round(caloriesConsumed);
  proteinConsumed = Math.round(proteinConsumed);
  carbsConsumed = Math.round(carbsConsumed);
  fatConsumed = Math.round(fatConsumed);

  // 6.5 Fetch today's activities to get burned calories
  const { data: activitiesToday } = await supabase
    .from("activities")
    .select("calories_kcal")
    .eq("user_id", user.id)
    .gte("started_at", todayStart.toISOString());

  let caloriesBurnedToday = 0;
  if (activitiesToday) {
    caloriesBurnedToday = activitiesToday.reduce((sum, act) => sum + Number(act.calories_kcal || 0), 0);
  }
  caloriesBurnedToday = Math.round(caloriesBurnedToday);

  // 7. Fetch today's planned workout
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayWorkouts } = await supabase
    .from("planned_workouts")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", todayStr)
    .limit(1);

  const todayWorkout = todayWorkouts && todayWorkouts.length > 0 ? todayWorkouts[0] : null;

  // 8. Fetch today's morning check-in
  const { data: checkInToday } = await supabase
    .from("daily_check_ins")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", todayStr)
    .maybeSingle();

  const todayDate = new Date().toLocaleDateString("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-8 pb-8 animate-fade-in">
      {/* 1. Header with greeting and date */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Tervetuloa takaisin
          </span>
          <h2 className="text-3xl font-bold tracking-tight font-heading">
            {userGreeting}!
          </h2>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm glass-panel py-2 px-4 rounded-xl border border-border/40 w-fit">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="capitalize">{todayDate}</span>
        </div>
      </div>

      {/* 2. Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Link
          href="/chat"
          className="flex flex-col items-center justify-center p-4 rounded-2xl glass-panel hover:bg-secondary/40 border border-border/40 transition-all duration-200 text-center gap-2.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold">Tee aamukirjaus</span>
        </Link>
        <Link
          href="/meals"
          className="flex flex-col items-center justify-center p-4 rounded-2xl glass-panel hover:bg-secondary/40 border border-border/40 transition-all duration-200 text-center gap-2.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold">Kuvaa ateria</span>
        </Link>
        <Link
          href="/meals"
          className="flex flex-col items-center justify-center p-4 rounded-2xl glass-panel hover:bg-secondary/40 border border-border/40 transition-all duration-200 text-center gap-2.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold">Kirjaa ateria</span>
        </Link>
        <Link
          href="/chat"
          className="flex flex-col items-center justify-center p-4 rounded-2xl glass-panel hover:bg-secondary/40 border border-border/40 transition-all duration-200 text-center gap-2.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
            <User className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold">AI Valmentaja</span>
        </Link>
      </div>

      {/* 3. Nutrition & Weight Summary Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calorie Card */}
        <div className="lg:col-span-2 rounded-3xl glass-panel border border-border/40 p-6 flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-emerald-400" />
              <h3 className="font-heading font-semibold text-lg">Päivän ravinto</h3>
            </div>
            <span className="text-xs text-muted-foreground font-medium">Suositus: {caloriesTarget} kcal</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Circle Progress Indicator */}
            <div className="flex flex-col items-center justify-center gap-2 relative">
              <div className="w-36 h-36 rounded-full border-[10px] border-secondary flex flex-col items-center justify-center relative">
                <span className="text-3xl font-extrabold tracking-tight">
                  {Math.max(0, caloriesTarget + caloriesBurnedToday - caloriesConsumed)}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">kcal jäljellä</span>
              </div>
              <div className="flex gap-4 text-xs font-medium text-muted-foreground mt-2">
                <p>
                  Syöty: <span className="text-foreground font-semibold">{caloriesConsumed} kcal</span>
                </p>
                <p>
                  Aktiiviset: <span className="text-emerald-400 font-semibold">+{caloriesBurnedToday} kcal</span>
                </p>
              </div>
            </div>

            {/* Macro Sliders */}
            <div className="flex flex-col gap-4">
              {/* Protein */}
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Proteiini</span>
                  <span>{proteinConsumed}g / {proteinTarget}g</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${Math.min(100, (proteinConsumed / proteinTarget) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Carbs */}
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Hiilihydraatit</span>
                  <span>{carbsConsumed}g / {carbsTarget}g</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ width: `${Math.min(100, (carbsConsumed / carbsTarget) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Fat */}
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Rasva</span>
                  <span>{fatConsumed}g / {fatTarget}g</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${Math.min(100, (fatConsumed / fatTarget) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weight & Body Comp Card */}
        <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Scale className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-lg">Aamun paino</h3>
            </div>
            <span className="text-xs text-muted-foreground font-medium">Tavoiteuralla</span>
          </div>

          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-5xl font-extrabold tracking-tight mb-2 font-heading flex items-baseline">
              {currentWeight.toFixed(1)}
              <span className="text-lg font-bold text-muted-foreground ml-1">kg</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              weightDiff <= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {weightDiff <= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              <span>{weightDiff > 0 ? `+${weightDiff}` : weightDiff} kg (7 pv muunta)</span>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 flex flex-col gap-2.5 text-xs font-medium text-left">
            <div className="flex justify-between">
              <span className="text-muted-foreground">7 pv tasoitettu keskiarvo</span>
              <span className="font-semibold text-foreground">{avgWeight.toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Viimeisin mittaus</span>
              <span className="font-semibold text-foreground">
                {latestWeightData 
                  ? new Date(latestWeightData.measured_at).toLocaleDateString("fi-FI") 
                  : "Ei kirjauksia"}
              </span>
            </div>
            <div className="flex justify-between border-t border-border/20 pt-2 mt-1 flex-col gap-0.5">
              <span className="text-[10px] uppercase font-bold text-primary tracking-wide">Tavoite-ennuste</span>
              <span className="text-foreground font-semibold">
                Tavoitteesi {targetWeight} kg täyttyy nykyisellä vauhdilla arviolta{" "}
                <span className="text-primary">{projectedDateStr}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Workout Planner Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Planned Workout */}
        <div className="lg:col-span-2 rounded-3xl glass-panel border border-border/40 p-6 flex flex-col justify-between gap-5 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Dumbbell className="w-5 h-5 text-indigo-400" />
              <h3 className="font-heading font-semibold text-lg">Päivän liikunta</h3>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {todayWorkout ? (todayWorkout.status === "completed" ? "Tehty" : "Suunniteltu") : "Lepo"}
            </span>
          </div>

          {todayWorkout ? (
            <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
              todayWorkout.status === "completed"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-secondary/30 border-border/20"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                todayWorkout.status === "completed"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-indigo-500/10 text-indigo-400"
              }`}>
                <Dumbbell className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold text-sm ${todayWorkout.status === "completed" ? "text-emerald-400" : ""}`}>{todayWorkout.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Kesto: <span className="font-semibold">{todayWorkout.duration_minutes} min</span> • Intensiteetti: <span className={`font-semibold capitalize ${todayWorkout.status === "completed" ? "text-emerald-400" : "text-indigo-400"}`}>{todayWorkout.intensity}</span>
                </p>
                {todayWorkout.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {todayWorkout.description}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-secondary/25 border border-dashed border-border/40 text-center text-muted-foreground text-xs font-semibold">
              Ei suunniteltuja harjoituksia tälle päivälle. Lepopäivä!
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{todayWorkout ? "Tälle päivälle" : "Lepopäivä"}</span>
            </div>
            {todayWorkout && todayWorkout.status !== "completed" && (
              <Link href="/plan" className="text-primary hover:text-primary/80 transition-colors">
                Katso suunnitelma
              </Link>
            )}
          </div>
        </div>

        {/* Health status & sleep */}
        <div className="rounded-3xl glass-panel border border-border/40 p-6 flex flex-col justify-between gap-5 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Heart className="w-5 h-5 text-red-400" />
              <h3 className="font-heading font-semibold text-lg">Palautuminen & Uni</h3>
            </div>
            <span className="text-xs text-muted-foreground font-medium">Tila</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-2xl bg-secondary/20 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Uni</span>
              <p className="text-xl font-bold mt-1">
                {checkInToday ? `${checkInToday.sleep_hours} h` : "-"}
              </p>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {checkInToday ? `Laatu ${checkInToday.sleep_quality}/5` : "Ei kirjattu"}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-secondary/20 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Stressi</span>
              <p className="text-xl font-bold mt-1">
                {checkInToday ? (checkInToday.stress_level <= 2 ? "Matala" : checkInToday.stress_level === 3 ? "Normaali" : "Korkea") : "-"}
              </p>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {checkInToday ? `Taso ${checkInToday.stress_level}/5` : "Ei kirjattu"}
              </span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center bg-secondary/10 p-3 rounded-xl border border-border/20">
            {checkInToday && checkInToday.notes 
              ? `"${checkInToday.notes}"`
              : `"Muista tehdä aamukirjaus seurataksesi palautumistasi ja untasi."`}
          </div>
        </div>
      </div>
    </div>
  );
}
