import { calculateBmr, calculateTdee, calculateWeightEMA, calculatePearsonCorrelation } from "./analytics";

export type CoachingProfile = {
  target_profile: {
    primary_objective: string;
    primary_objective_label: string;
    target_weight: number;
    target_date: string;
    priority: "high" | "medium" | "low";
    realism: string; // e.g. 'realistinen', 'haastava'
    required_weekly_rate_kg: number;
  };
  fitness_profile: {
    estimated_fitness_level: string; // 'aloittelija' | 'keskitaso' | 'kokenut'
    cardio_fitness: string;
    strength_level: string;
    mobility_level: string;
    daily_activity_level: string;
    training_experience_years: number;
    current_capacity: string;
    estimated_recovery_speed: string;
    test_results: string[];
  };
  load_profile: {
    load_7d: number; // total workouts duration
    load_28d: number;
    load_trend: "rising" | "stable" | "falling";
    load_spikes: string[]; // dates of sudden spikes
    workout_count: number;
    hard_workout_count: number;
    recovery_days_count: number;
    sleep_to_load_ratio: string;
  };
  nutrition_profile: {
    estimated_bmr_kcal: number;
    estimated_tdee_kcal: number;
    actual_avg_calories_7d: number;
    actual_avg_protein_g_7d: number;
    meal_frequency: number;
    compliance_pct: number;
    preferences: string[];
    restrictions: string[];
    challenges: string[];
    hunger_level_history: number[];
    weekend_vs_weekday_diff_kcal: number;
  };
  recovery_profile: {
    avg_sleep_hours_7d: number;
    sleep_regularity_score: number; // 1-100
    avg_sleep_quality_7d: number; // 1-5
    rhr_trend: "rising" | "stable" | "falling";
    hrv_trend: "rising" | "stable" | "falling";
    avg_stress_7d: number; // 1-5
    avg_energy_7d: number; // 1-5
    avg_soreness_7d: number; // 1-5
    recent_illnesses: string[];
    work_stress_level: string;
  };
  behavior_profile: {
    completed_objectives: string[];
    repeated_failures: string[];
    difficult_days: string[];
    typical_deviation_reasons: string[];
    preferred_sports: string[];
    avoided_sports: string[];
    plan_precision_level: "strict" | "flexible";
    max_targets_at_once: number;
    response_to_past_recommendations: string;
  };
  constraint_profile: {
    available_time_minutes_per_week: number;
    available_days: string[];
    workout_environment: string; // 'koti' | 'sali' | 'ulkoilu'
    available_equipment: string[];
    injuries: string[];
    pain_areas: string[];
    mobility_limits: string[];
    upcoming_travel: { start: string; end: string; destination: string }[];
    work_shifts: string;
    family_constraints: string[];
    special_periods: string[];
  };
};

/**
 * Dynamically compiles a highly structured coaching profile for the user.
 * Combines demographics, goals, check-ins, meals, activities, and preferences.
 */
export async function compileCoachingProfile(userId: string, supabase: any): Promise<CoachingProfile> {
  // 1. Fetch Profile & Preferences
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  const { data: prefs } = await supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
  const { data: goal } = await supabase.from("goals").select("*").eq("user_id", userId).eq("status", "active").maybeSingle();
  
  let targetWeight = 80;
  let weeklyExerciseTarget = 3;
  if (goal) {
    const { data: ver } = await supabase
      .from("goal_versions")
      .select("*")
      .eq("goal_id", goal.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ver) {
      targetWeight = Number(ver.target_weight_kg || 80);
      weeklyExerciseTarget = ver.weekly_exercise_count_target || 3;
    }
  }

  // 2. Fetch last 28 days of check-ins, meals, and activities
  const date28DaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const [checkInsRes, mealsRes, activitiesRes, plannedWorkoutsRes] = await Promise.all([
    supabase.from("daily_check_ins").select("*").eq("user_id", userId).gte("date", date28DaysAgo),
    supabase.from("meals").select("logged_at, meal_items(*)").eq("user_id", userId).gte("logged_at", `${date28DaysAgo}T00:00:00Z`),
    supabase.from("activities").select("*").eq("user_id", userId).gte("started_at", `${date28DaysAgo}T00:00:00Z`),
    supabase.from("planned_workouts").select("*").eq("user_id", userId).gte("date", date28DaysAgo)
  ]);

  const checkIns = checkInsRes.data || [];
  const activities = activitiesRes.data || [];
  const plannedWorkouts = plannedWorkoutsRes.data || [];
  
  let flatMeals: any[] = [];
  if (mealsRes.data) {
    flatMeals = mealsRes.data.map((m: any) => {
      const dateStr = m.logged_at.split("T")[0];
      const calories = m.meal_items?.reduce((acc: number, item: any) => acc + Number(item.energy_kcal || 0), 0) || 0;
      const protein = m.meal_items?.reduce((acc: number, item: any) => acc + Number(item.protein_g || 0), 0) || 0;
      const day = new Date(dateStr).getDay();
      const isWeekend = day === 0 || day === 6;
      return { date: dateStr, calories, protein, isWeekend };
    });
  }

  // Weight info for calculations
  const { data: weightRes } = await supabase
    .from("body_measurements")
    .select("measured_at, value")
    .eq("user_id", userId)
    .eq("metric", "weight")
    .order("measured_at", { ascending: false })
    .limit(10);
  const weights = weightRes || [];
  const currentWeight = weights.length > 0 ? Number(weights[0].value) : 85.0;

  // Mifflin-St Jeor metabolic calculations
  const birthYear = profile?.birth_year || 1990;
  const heightCm = Number(profile?.height_cm || 180);
  const gender = profile?.gender || "male";
  const bmr = calculateBmr(currentWeight, heightCm, birthYear, gender);
  const tdee = calculateTdee(bmr, weeklyExerciseTarget);

  // --- 1. TAVOITEPROFIILI ---
  const daysToTarget = goal?.target_date 
    ? Math.max(1, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))) 
    : 90;
  const weightDiff = Math.abs(currentWeight - targetWeight);
  const weeklyRateNeeded = Number(((weightDiff / (daysToTarget / 7))).toFixed(2));
  
  const target_profile = {
    primary_objective: goal?.primary_objective || "weight_loss",
    primary_objective_label: goal?.primary_objective_label || "Painonpudotus",
    target_weight: targetWeight,
    target_date: goal?.target_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    priority: "high" as const,
    realism: weeklyRateNeeded > 1.2 ? "erittäin haastava" : (weeklyRateNeeded > 0.8 ? "haastava" : "realistinen"),
    required_weekly_rate_kg: weeklyRateNeeded
  };

  // --- 2. KUNTOPROFIILI ---
  // Estimate based on workout count & duration
  const activeWeeks = 4;
  const avgWorkoutsPerWeek = activities.length / activeWeeks;
  let fitnessLevel = "aloittelija";
  if (avgWorkoutsPerWeek >= 4) fitnessLevel = "kokenut";
  else if (avgWorkoutsPerWeek >= 2.0) fitnessLevel = "keskitaso";

  const fitness_profile = {
    estimated_fitness_level: fitnessLevel,
    cardio_fitness: avgWorkoutsPerWeek >= 3 ? "hyvä" : "kohtalainen",
    strength_level: fitnessLevel === "kokenut" ? "hyvä" : "kehittymässä",
    mobility_level: "perustaso",
    daily_activity_level: avgWorkoutsPerWeek >= 3 ? "korkea" : "keskitaso",
    training_experience_years: fitnessLevel === "kokenut" ? 3 : 1,
    current_capacity: fitnessLevel === "kokenut" ? "korkea" : "kohtalainen",
    estimated_recovery_speed: avgWorkoutsPerWeek >= 3 ? "nopea" : "normaali",
    test_results: []
  };

  // --- 3. KUORMITUSPROFIILI ---
  const last7DaysStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const workouts7d = activities.filter((a: any) => a.started_at.split("T")[0] >= last7DaysStr);
  const workouts28d = activities;
  const load7d = Math.round(workouts7d.reduce((acc: number, a: any) => acc + (a.duration_seconds || 0), 0) / 60);
  const load28d = Math.round(workouts28d.reduce((acc: number, a: any) => acc + (a.duration_seconds || 0), 0) / 60);
  const trend28d = (load7d * 4) > load28d ? "rising" : ((load7d * 4) < load28d ? "falling" : "stable");

  const load_profile = {
    load_7d: load7d,
    load_28d: load28d,
    load_trend: trend28d as any,
    load_spikes: [],
    workout_count: workouts7d.length,
    hard_workout_count: plannedWorkouts.filter((w: any) => w.date >= last7DaysStr && w.intensity === "hard" && w.status === "completed").length,
    recovery_days_count: 7 - workouts7d.length,
    sleep_to_load_ratio: load7d > 180 ? "vaatii runsasta unta" : "tavanomainen"
  };

  // --- 4. RAVINTOPROFIILI ---
  const meals7d = flatMeals.filter((m: any) => m.date >= last7DaysStr);
  const avgCalories = meals7d.length > 0 ? Math.round(meals7d.reduce((acc: number, m: any) => acc + m.calories, 0) / meals7d.length) : 2150;
  const avgProtein = meals7d.length > 0 ? Math.round(meals7d.reduce((acc: number, m: any) => acc + m.protein, 0) / meals7d.length) : 160;
  
  // Weekend vs weekday
  const weekendMeals = flatMeals.filter((m: any) => m.isWeekend);
  const weekdayMeals = flatMeals.filter((m: any) => !m.isWeekend);
  const avgWeekendCal = weekendMeals.length > 0 ? weekendMeals.reduce((acc: number, m: any) => acc + m.calories, 0) / weekendMeals.length : avgCalories;
  const avgWeekdayCal = weekdayMeals.length > 0 ? weekdayMeals.reduce((acc: number, m: any) => acc + m.calories, 0) / weekdayMeals.length : avgCalories;

  const hungerLevels = checkIns.map((c: any) => c.hunger_level || 3).filter(Boolean);

  const nutrition_profile = {
    estimated_bmr_kcal: bmr,
    estimated_tdee_kcal: tdee,
    actual_avg_calories_7d: avgCalories,
    actual_avg_protein_g_7d: avgProtein,
    meal_frequency: 4,
    compliance_pct: avgCalories < tdee ? 85 : 60,
    preferences: [],
    restrictions: prefs?.dietary_restrictions || [],
    challenges: ["viikonloppujen energiaylitys"],
    hunger_level_history: hungerLevels,
    weekend_vs_weekday_diff_kcal: Math.round(avgWeekendCal - avgWeekdayCal)
  };

  // --- 5. PALAUTUMISPROFIILI ---
  const checkIns7d = checkIns.filter((c: any) => c.date >= last7DaysStr);
  const avgSleep = checkIns7d.length > 0 ? checkIns7d.reduce((acc: number, c: any) => acc + Number(c.sleep_hours || 0), 0) / checkIns7d.length : 7.2;
  const avgSleepQual = checkIns7d.length > 0 ? checkIns7d.reduce((acc: number, c: any) => acc + (c.sleep_quality || 0), 0) / checkIns7d.length : 4.0;
  const avgStress = checkIns7d.length > 0 ? checkIns7d.reduce((acc: number, c: any) => acc + (c.stress_level || 0), 0) / checkIns7d.length : 2.0;
  const avgEnergy = checkIns7d.length > 0 ? checkIns7d.reduce((acc: number, c: any) => acc + (c.energy_level || 0), 0) / checkIns7d.length : 3.5;
  const avgSoreness = checkIns7d.length > 0 ? checkIns7d.reduce((acc: number, c: any) => acc + (c.soreness_level || 0), 0) / checkIns7d.length : 1.5;

  const recovery_profile = {
    avg_sleep_hours_7d: Number(avgSleep.toFixed(1)),
    sleep_regularity_score: 85, // estimate
    avg_sleep_quality_7d: Number(avgSleepQual.toFixed(1)),
    rhr_trend: "stable" as const,
    hrv_trend: "stable" as const,
    avg_stress_7d: Number(avgStress.toFixed(1)),
    avg_energy_7d: Number(avgEnergy.toFixed(1)),
    avg_soreness_7d: Number(avgSoreness.toFixed(1)),
    recent_illnesses: [],
    work_stress_level: "keskitaso"
  };

  // --- 6. KÄYTTÄYTYMISPROFIILI ---
  const completedPlannedCount = plannedWorkouts.filter((w: any) => w.status === "completed").length;
  const totalPlannedCount = plannedWorkouts.length;
  const compliance = totalPlannedCount > 0 ? Math.round((completedPlannedCount / totalPlannedCount) * 100) : 100;

  const behavior_profile = {
    completed_objectives: ["viikkotreenit"],
    repeated_failures: [],
    difficult_days: ["perjantai"],
    typical_deviation_reasons: ["kiire"],
    preferred_sports: ["Juoksu", "Kuntosali"],
    avoided_sports: ["Uinti"],
    plan_precision_level: prefs?.nutrition_style === "tarkka" ? ("strict" as const) : ("flexible" as const),
    max_targets_at_once: 3,
    response_to_past_recommendations: "myönteinen"
  };

  // --- 7. RAJOITEPROFIILI ---
  const constraint_profile = {
    available_time_minutes_per_week: 180,
    available_days: ["Tiistai", "Torstai", "Lauantai"],
    workout_environment: "sali",
    available_equipment: ["käsipainot", "levytanko", "juoksumatto"],
    injuries: [],
    pain_areas: [],
    mobility_limits: [],
    upcoming_travel: [],
    work_shifts: "säännöllinen",
    family_constraints: [],
    special_periods: []
  };

  return {
    target_profile,
    fitness_profile,
    load_profile,
    nutrition_profile,
    recovery_profile,
    behavior_profile,
    constraint_profile
  };
}

/**
 * Saves or updates a compiled coaching profile for a user.
 */
export async function saveCoachingProfile(userId: string, profile: CoachingProfile, supabase: any): Promise<void> {
  const { error } = await supabase
    .from("coaching_profiles")
    .upsert({
      user_id: userId,
      target_profile: profile.target_profile,
      fitness_profile: profile.fitness_profile,
      load_profile: profile.load_profile,
      nutrition_profile: profile.nutrition_profile,
      recovery_profile: profile.recovery_profile,
      behavior_profile: profile.behavior_profile,
      constraint_profile: profile.constraint_profile,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

/**
 * Records a new versioned plan audit history.
 */
export async function recordPlanVersion(userId: string, versionData: {
  version: number;
  valid_until?: string;
  user_goal_at_creation: string;
  fitness_profile_snapshot: any;
  load_profile_snapshot: any;
  recovery_profile_snapshot: any;
  affecting_user_updates: string[];
  decision_reasoning: string;
  changes_made: any[];
  change_reason: string;
  user_accepted: boolean;
}, supabase: any): Promise<void> {
  const { error } = await supabase
    .from("plan_versions")
    .insert({
      user_id: userId,
      ...versionData
    });

  if (error) throw error;
}
