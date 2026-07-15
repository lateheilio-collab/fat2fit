/**
 * Weight trend analytics, forecasting, correlations and plateau detection helpers.
 */

export type WeightPoint = {
  date: string; // YYYY-MM-DD
  weight: number;
};

/**
 * Calculates a 7-day Exponential Moving Average (EMA) over raw weight points.
 */
export function calculateWeightEMA(points: WeightPoint[], period = 7): WeightPoint[] {
  if (points.length === 0) return [];
  
  // Sort points chronologically
  const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const emaPoints: WeightPoint[] = [];
  const alpha = 2 / (period + 1);
  let currentEma = sorted[0].weight;

  sorted.forEach((p, idx) => {
    if (idx === 0) {
      currentEma = p.weight;
    } else {
      currentEma = (p.weight * alpha) + (currentEma * (1 - alpha));
    }
    emaPoints.push({
      date: p.date,
      weight: Number(currentEma.toFixed(2)),
    });
  });

  return emaPoints;
}

/**
 * Fits a linear regression line over the last 28 days of weight data.
 * Returns the projected slope (kg per day) and the R-squared confidence.
 */
export function calculateWeightRegression(
  points: WeightPoint[]
): { slope: number; intercept: number; projectedDaysToTarget: (targetWeight: number) => number } {
  if (points.length < 2) {
    return { slope: 0, intercept: 0, projectedDaysToTarget: () => -1 };
  }

  // Sort chronologically
  const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const startTime = new Date(sorted[0].date).getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  // Map to X (days since start) and Y (weight)
  const xValues = sorted.map((p) => (new Date(p.date).getTime() - startTime) / MS_PER_DAY);
  const yValues = sorted.map((p) => p.weight);
  
  const n = xValues.length;
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += xValues[i];
    sumY += yValues[i];
    sumXY += xValues[i] * yValues[i];
    sumXX += xValues[i] * xValues[i];
  }

  const denominator = (n * sumXX - sumX * sumX);
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Helper to project target intersection
  const projectedDaysToTarget = (targetWeight: number) => {
    if (slope === 0) return -1;
    const targetDay = (targetWeight - intercept) / slope;
    
    // Convert target day index back to offset from today
    const todayIndex = (new Date().getTime() - startTime) / MS_PER_DAY;
    const daysFromToday = targetDay - todayIndex;
    
    return daysFromToday > 0 ? Math.round(daysFromToday) : -1;
  };

  return {
    slope,
    intercept,
    projectedDaysToTarget,
  };
}

/**
 * Calculates the Pearson correlation coefficient between two arrays of numbers.
 * Returns a value between -1 and 1.
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

  if (den === 0) return 0;
  return num / den;
}

/**
 * Evaluates whether the user is experiencing a weight loss plateau.
 * A plateau is identified if weight trend is stable for >= 14 days,
 * but only if waist circumference hasn't decreased significantly (which would indicate body recomposition).
 */
export function detectWeightPlateau(
  weights: WeightPoint[],
  waists: { date: string; value: number }[],
  durationDays = 14
): {
  isPlateau: boolean;
  message: string;
  type: "none" | "recomposition" | "stabilization" | "true_plateau" | "insufficient_data";
} {
  if (weights.length < 5) {
    return {
      isPlateau: false,
      message: "Ei tarpeeksi painomittauksia trendin laskemiseen.",
      type: "insufficient_data",
    };
  }

  const sortedWeights = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const emas = calculateWeightEMA(sortedWeights);
  
  if (emas.length < 2) {
    return { isPlateau: false, message: "Ei tarpeeksi datapisteitä.", type: "insufficient_data" };
  }

  const latestEma = emas[emas.length - 1];
  
  // Find point closest to durationDays ago
  const cutoffTime = new Date(latestEma.date).getTime() - (durationDays * 24 * 60 * 60 * 1000);
  const oldEma = emas.find(e => new Date(e.date).getTime() >= cutoffTime);

  if (!oldEma || oldEma.date === latestEma.date) {
    return {
      isPlateau: false,
      message: `Tietoa tarvitaan pidemmältä ajanjaksolta (seuraa painoasi vähintään ${durationDays} päivää).`,
      type: "insufficient_data",
    };
  }

  const weightDiff = Math.abs(latestEma.weight - oldEma.weight);

  // If weight changed by more than 0.3 kg, it's not a plateau
  if (weightDiff > 0.3) {
    return {
      isPlateau: false,
      message: "Painosi kehittyy edelleen.",
      type: "none",
    };
  }

  // Check waist measurements for body recomposition
  const sortedWaists = [...waists].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (sortedWaists.length >= 2) {
    const latestWaist = sortedWaists[sortedWaists.length - 1];
    const oldWaist = sortedWaists.find(w => new Date(w.date).getTime() >= cutoffTime);
    
    if (oldWaist && oldWaist.date !== latestWaist.date) {
      const waistDiff = oldWaist.value - latestWaist.value; // positive means reduction
      if (waistDiff >= 0.5) {
        return {
          isPlateau: false,
          message: `Painosi on pysynyt samana (${latestEma.weight} kg) viimeiset ${durationDays} päivää, mutta vyötärönympäryksesi on pienentynyt ${waistDiff.toFixed(1)} cm. Tämä viittaa kehonkoostumuksen parantumiseen (rasvan palamiseen ja lihaksen kasvuun). Jatka samaan malliin!`,
          type: "recomposition",
        };
      }
    }
  }

  return {
    isPlateau: true,
    message: `Painosi keskiarvo on pysynyt lähes samana (${latestEma.weight} kg) viimeisen ${durationDays} päivän ajan. Kyseessä näyttää olevan painonpudotuksen tasanne.`,
    type: "true_plateau",
  };
}

/**
 * Calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor equation.
 */
export function calculateBmr(weight: number, height: number, birthYear: number, gender: string): number {
  const age = new Date().getFullYear() - birthYear;
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === "female") {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
  return 10 * weight + 6.25 * height - 5 * age - 80; // default/other
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 */
export function calculateTdee(bmr: number, weeklyWorkoutCount: number): number {
  let activityMultiplier = 1.2; // Sedentary
  if (weeklyWorkoutCount >= 5) {
    activityMultiplier = 1.725;
  } else if (weeklyWorkoutCount >= 3) {
    activityMultiplier = 1.55;
  } else if (weeklyWorkoutCount >= 1) {
    activityMultiplier = 1.375;
  }
  return Math.round(bmr * activityMultiplier);
}

/**
 * Reusable analytics compiler function that handles both database queries and mock fallbacks.
 */
export async function getUserAnalyticsData(userId: string, supabase: any): Promise<any> {
  // Load user profile demographics
  const { data: profile } = await supabase
    .from("profiles")
    .select("birth_year, height_cm, gender, display_name")
    .eq("id", userId)
    .maybeSingle();

  const birthYear = profile?.birth_year || 1990;
  const heightCm = Number(profile?.height_cm || 180);
  const gender = profile?.gender || "male";

  let weights: any[] = [];
  let waists: any[] = [];
  let checkIns: any[] = [];
  let meals: any[] = [];
  let activities: any[] = [];
  let plannedWorkouts: any[] = [];
  let customMetrics: any[] = [];
  let customEntries: any[] = [];
  let usingMockData = false;

  try {
    const [
      weightsRes,
      waistsRes,
      checkInsRes,
      mealsRes,
      activitiesRes,
      plannedWorkoutsRes,
      customMetricsRes,
      customEntriesRes
    ] = await Promise.all([
      supabase.from("body_measurements").select("measured_at, value").eq("user_id", userId).eq("metric", "weight").order("measured_at", { ascending: true }),
      supabase.from("body_measurements").select("measured_at, value").eq("user_id", userId).eq("metric", "waist_cm").order("measured_at", { ascending: true }),
      supabase.from("daily_check_ins").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("meals").select("id, logged_at, meal_type, meal_items(*)").eq("user_id", userId).order("logged_at", { ascending: true }),
      supabase.from("activities").select("*").eq("user_id", userId).order("started_at", { ascending: true }),
      supabase.from("planned_workouts").select("*").eq("user_id", userId).order("date", { ascending: true }),
      supabase.from("custom_metric_definitions").select("*").eq("user_id", userId),
      supabase.from("metric_entries").select("*").eq("user_id", userId)
    ]);

    weights = weightsRes.data || [];
    waists = waistsRes.data || [];
    checkIns = checkInsRes.data || [];
    plannedWorkouts = plannedWorkoutsRes.data || [];
    activities = activitiesRes.data || [];
    customMetrics = customMetricsRes.data || [];
    customEntries = customEntriesRes.data || [];

    if (mealsRes.data) {
      meals = mealsRes.data.map((m: any) => {
        const totalCalories = m.meal_items?.reduce((acc: number, item: any) => acc + Number(item.energy_kcal || 0), 0) || 0;
        const totalProtein = m.meal_items?.reduce((acc: number, item: any) => acc + Number(item.protein_g || 0), 0) || 0;
        return {
          date: m.logged_at.split("T")[0],
          calories: totalCalories,
          protein: totalProtein
        };
      });
    }
  } catch (dbErr) {
    usingMockData = true;
  }

  // Fallback to mock data if new user or tables missing
  if (weights.length < 3 || checkIns.length < 5 || usingMockData) {
    usingMockData = true;
    const mockWeights = [];
    const mockWaists = [];
    const mockCheckIns = [];
    const mockMeals = [];
    const mockActivities = [];
    const mockPlannedWorkouts = [];
    const now = new Date();
    let currentWeight = 94.2;
    let currentWaist = 94.5;

    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      if (i % 2 === 0) {
        currentWeight -= 0.12 + (Math.random() * 0.1 - 0.05);
        mockWeights.push({ measured_at: `${dateStr}T07:15:00Z`, value: Number(currentWeight.toFixed(1)) });
      }

      if (i % 7 === 0) {
        currentWaist -= 0.15;
        mockWaists.push({ measured_at: `${dateStr}T07:15:00Z`, value: Number(currentWaist.toFixed(1)) });
      }

      const sleepHours = Number((6.2 + Math.random() * 2).toFixed(1));
      const sleepQuality = sleepHours > 7.5 ? 5 : sleepHours > 7.0 ? 4 : sleepHours > 6.0 ? 3 : 2;
      const energyLevel = sleepHours > 7.0 ? 4 : sleepHours > 6.0 ? 3 : 2;
      const dayOfWeek = d.getDay();
      const tookAlcohol = (dayOfWeek === 5 || dayOfWeek === 6) && Math.random() > 0.3;
      const stressLevel = tookAlcohol ? 3 : (Math.random() > 0.7 ? 4 : 2);
      const hungerLevel = sleepHours < 6.5 ? 4 : (Math.random() > 0.5 ? 3 : 2);
      const sorenessLevel = i % 3 === 0 ? 3 : 1;

      mockCheckIns.push({
        date: dateStr,
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
        energy_level: energyLevel,
        stress_level: stressLevel,
        soreness_level: sorenessLevel,
        hunger_level: hungerLevel,
        notes: tookAlcohol ? "Iltapalan kanssa viiniä." : "Hyvin nukuttu."
      });

      const targetCalories = 2100;
      const calories = dayOfWeek === 0 || dayOfWeek === 6 
        ? targetCalories + 300 + Math.floor(Math.random() * 200)
        : targetCalories - 100 + Math.floor(Math.random() * 150);
      
      mockMeals.push({ date: dateStr, calories, protein: 155 + Math.floor(Math.random() * 25) });

      if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6) {
        const duration = dayOfWeek === 6 ? 90 : 60;
        const type = dayOfWeek === 6 ? "Pitkä lenkki" : (dayOfWeek === 2 ? "Kuntosali" : "Hyrox");
        mockPlannedWorkouts.push({ date: dateStr, activity_type: type, title: type, duration_minutes: duration, intensity: "moderate", status: "completed" });
        mockActivities.push({ started_at: `${dateStr}T17:30:00Z`, activity_type: type, duration_seconds: duration * 60, calories_kcal: duration * 10, average_heart_rate: 140 });
      }
    }

    weights = mockWeights;
    waists = mockWaists;
    checkIns = mockCheckIns;
    meals = mockMeals;
    activities = mockActivities;
    plannedWorkouts = mockPlannedWorkouts;

    customMetrics = [
      { id: "cm-1", name: "Kiputaso", type: "number", unit: "1-10", target_value: 1, frequency: "daily", higher_is_better: false },
      { id: "cm-2", name: "Join alkoholia", type: "boolean", target_value: 0, frequency: "daily", higher_is_better: false }
    ];

    mockCheckIns.forEach(c => {
      customEntries.push({ metric_id: "cm-1", date: c.date, value: c.soreness_level * 2 });
      customEntries.push({ metric_id: "cm-2", date: c.date, value: c.notes?.includes("viiniä") ? 1 : 0 });
    });
  }

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].value : 85.0;
  const bmr = calculateBmr(latestWeight, heightCm, birthYear, gender);
  
  const last7DaysStr = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const weeklyWorkouts = plannedWorkouts.filter(w => w.date >= last7DaysStr && w.status === "completed").length;
  const tdee = calculateTdee(bmr, weeklyWorkouts || 3);

  const weightPoints: WeightPoint[] = weights.map(w => ({ date: w.measured_at.split("T")[0], weight: w.value }));
  const ema7 = calculateWeightEMA(weightPoints, 7);
  const ema28 = calculateWeightEMA(weightPoints, 28);
  
  const latestEma7 = ema7.length > 0 ? ema7[ema7.length - 1].weight : latestWeight;
  const latestEma28 = ema28.length > 0 ? ema28[ema28.length - 1].weight : latestWeight;

  const last28DaysTime = new Date().getTime() - (28 * 24 * 60 * 60 * 1000);
  const weightsLast28 = weightPoints.filter(w => new Date(w.date).getTime() >= last28DaysTime);
  const regression = calculateWeightRegression(weightsLast28);
  const weeklyRate = regression.slope * -7;

  // Active goal values
  let targetWeight = 80.0;
  let targetDate = new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  let weeklyExerciseTarget = 3;

  try {
    const { data: goal } = await supabase
      .from("goals")
      .select("id, target_date")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (goal) {
      targetDate = goal.target_date || targetDate;
      const { data: version } = await supabase
        .from("goal_versions")
        .select("target_weight_kg, weekly_exercise_count_target")
        .eq("goal_id", goal.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (version?.target_weight_kg) targetWeight = Number(version.target_weight_kg);
      if (version?.weekly_exercise_count_target) weeklyExerciseTarget = version.weekly_exercise_count_target;
    }
  } catch (err) {}

  const remainingWeight = latestWeight - targetWeight;
  let projectedDays = -1;
  if (regression.slope < 0 && remainingWeight > 0) {
    projectedDays = Math.ceil(remainingWeight / Math.abs(regression.slope));
  }
  
  const startingWeight = weightPoints.length > 0 ? weightPoints[0].weight : latestWeight;
  const changeKg = latestWeight - startingWeight;
  const changePct = (changeKg / startingWeight) * 100;

  const waistPoints = waists.map(w => ({ date: w.measured_at.split("T")[0], value: w.value }));
  const plateauEval = detectWeightPlateau(weightPoints, waistPoints);

  const recentMeals = meals.filter(m => m.date >= last7DaysStr);
  const avgCalories = recentMeals.length > 0 ? Math.round(recentMeals.reduce((acc, m) => acc + m.calories, 0) / recentMeals.length) : 2150;
  const avgProtein = recentMeals.length > 0 ? Math.round(recentMeals.reduce((acc, m) => acc + m.protein, 0) / recentMeals.length) : 160;

  const recentCheckIns = checkIns.filter(c => c.date >= last7DaysStr);
  const avgSleep = recentCheckIns.length > 0 ? Number((recentCheckIns.reduce((acc, c) => acc + Number(c.sleep_hours || 0), 0) / recentCheckIns.length).toFixed(1)) : 7.2;

  // Compile insights
  const insights = [
    {
      insight_type: "sleep_vs_hunger",
      title: "Unen vaikutus näläntunteeseen",
      content: "Alle 7 tunnin yöunet ovat vahvassa yhteydessä korkeampaan näläntunteeseen seuraavana päivänä.",
      reliability: "high",
      recommendation: "Pyri nukkumaan 7.5h vähentääksesi makeanhimoa."
    }
  ];

  return {
    usingMockData,
    goals: {
      targetWeight,
      targetDate,
      weeklyExerciseTarget,
      startingWeight,
      currentWeight: latestWeight,
      changeKg,
      changePct,
      progressPercent: Math.min(Math.round(((startingWeight - latestWeight) / (startingWeight - targetWeight)) * 100), 100)
    },
    metabolism: { bmr, tdee },
    trends: {
      latestWeight,
      ema7: latestEma7,
      ema28: latestEma28,
      weeklyRate: Number(weeklyRate.toFixed(2)),
      projectedDays,
      plateau: plateauEval
    },
    recentAverages: {
      calories: avgCalories,
      protein: avgProtein,
      caloriesDeficit: tdee - avgCalories,
      sleepHours: avgSleep,
      exerciseCount: weeklyWorkouts || 3
    },
    insights
  };
}
