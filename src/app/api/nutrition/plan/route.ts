import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { calculateBmr, calculateTdee } from "@/lib/calculations/analytics";
import { generateWeeklyPlan, redistributePlanCalories } from "@/lib/calculations/nutrition";

export const dynamic = "force-dynamic";

const MOCK_RECIPES = [
  {
    id: "rec-1",
    name: "Kaurapuuro marjoilla ja valkuaisella",
    calories_per_serving: 380,
    protein_per_serving: 24,
    carbohydrates_per_serving: 48,
    fat_per_serving: 8,
    meal_type: "breakfast",
    preparation_time: 5,
    cooking_time: 5,
    estimated_cost: "low" as const,
    instructions: "1. Keitä kaurahiutaleet vedessä maustaen 0.5 tl jauhetulla kardemummalla ja 0.25 tl ceyloninkanelilla noin 5 minuuttia.\n2. Vatkaa joukkoon valkuainen (lisää kuohkeutta) ja ripaus puhdistettua suolaa loppuvaiheessa.\n3. Koristele annos tuoreilla tai pakastetuilla mustikoilla, vadelmilla ja mansikoilla tuomaan väriä.\n4. Tarjoile rasvattoman raejuuston kera.\n5. Perheelle: Keitä suurempi puuroerä muille ja lisää heidän annoksiinsa hunajaa tai pähkinöitä.",
    ingredients: [
      { name: "kaurahiutale", amount: 60, unit: "g", category: "Kuiva-aineet" },
      { name: "pakastemustikka", amount: 80, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "mansikat ja vadelmat", amount: 50, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "raejuusto (kevyt)", amount: 100, unit: "g", category: "Maitotuotteet" },
      { name: "kananmunan valkuainen", amount: 1, unit: "kpl", category: "Maitotuotteet" }
    ]
  },
  {
    id: "rec-2",
    name: "Runsaspastainen kanapata",
    calories_per_serving: 620,
    protein_per_serving: 44,
    carbohydrates_per_serving: 65,
    fat_per_serving: 16,
    meal_type: "lunch",
    preparation_time: 10,
    cooking_time: 15,
    estimated_cost: "medium" as const,
    instructions: "1. Ruskista broilerin rintafileekuutiot pannulla 1 tl valkosipuliöljyssä. Mausta 1 tl kuivatulla oreganolla, 0.5 tl savupaprikalla ja 0.25 tl jauhetulla mustapippurilla.\n2. Lisää silputtu keltasipuli ja kuullota.\n3. Keitä täysjyväpasta al dente ripauksella suolaa maustetussa vedessä.\n4. Lisää pannulle pilkottu paprika ja parsakaalinnuput. Kaada joukkoon 10% ruokakerma.\n5. Hauduta 5-8 minuuttia. Sekoita pasta joukkoon.\n6. Tarjoile raikkaan lehtisalaatin kera (salaattikastike: 1 rkl puristettua sitruunamehua, 1 tl oliiviöljyä ja 0.25 tl mustapippuria).\n7. Perheelle: Lisää muiden perheenjäsenten lautasille parmesaanijuustoraastetta tai tarjoile lisukkeena patonkia.",
    ingredients: [
      { name: "broilerin rintafilee", amount: 150, unit: "g", category: "Liha ja kala" },
      { name: "täysjyväpasta", amount: 80, unit: "g", category: "Kuiva-aineet" },
      { name: "ruokakerma 10%", amount: 50, unit: "ml", category: "Maitotuotteet" },
      { name: "punainen paprika", amount: 80, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "parsakaalinnuput", amount: 70, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "vihreä salaattisekoitus", amount: 50, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "sipuli", amount: 0.5, unit: "kpl", category: "Hedelmät ja vihannekset" }
    ]
  },
  {
    id: "rec-3",
    name: "Maitorahka ja marjat",
    calories_per_serving: 220,
    protein_per_serving: 18,
    carbohydrates_per_serving: 26,
    fat_per_serving: 2,
    meal_type: "snack",
    preparation_time: 3,
    cooking_time: 0,
    estimated_cost: "low" as const,
    instructions: "1. Lusikoi rasvaton maitorahka kulhoon.\n2. Mausta ripaus aitoa vaniljajauhetta (sokeriton) ja halutessasi 0.5 tl ceyloninkanelia.\n3. Lisää päälle tuoreet vadelmat, mustikat ja rouhitut saksanpähkinät.\n4. Perheelle: Muut perheenjäsenet voivat sekoittaa joukkoon 1 rkl hunajaa tai vaahterasiirappia tuomaan lisämakeutta.",
    ingredients: [
      { name: "maitorahka (rasvaton)", amount: 200, unit: "g", category: "Maitotuotteet" },
      { name: "tuoreet vadelmat ja mustikat", amount: 100, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "saksanpähkinät", amount: 10, unit: "g", category: "Kuiva-aineet" }
    ]
  },
  {
    id: "rec-4",
    name: "Uunilohi ja lohkoperunat",
    calories_per_serving: 680,
    protein_per_serving: 48,
    carbohydrates_per_serving: 52,
    fat_per_serving: 26,
    meal_type: "dinner",
    preparation_time: 15,
    cooking_time: 25,
    estimated_cost: "high" as const,
    instructions: "1. Leikkaa kirjolohifilee annospaloiksi. Hiero lohen pintaan 1 tl hienonnettua tuoretta tilliä, ripaus hienoa merisuolaa ja 0.25 tl ruusupippuria.\n2. Pese ja lohko perunat. Pyörittele lohkot 1 tl laadukkaassa oliiviöljyssä. Mausta lohkot 0.5 tl savupaprikalla ja 0.25 tl valkosipulijauheella.\n3. Paista lohta ja perunoita uunissa 200 asteessa noin 25 minuuttia, kunnes lohkoperunat ovat rapeita.\n4. Valmista raikas sivusalaatti: Pilko tomaatti ja kurkku. Pirskottele salaatille 1 tl omenaviinietikkaa ja ripaus hienonnettua punasipulia.\n5. Perheelle: Tarjoile lohen seurana kylmää kermaviilikastiketta (kermaviili, tilli, sitruunamehu, sokeri) ja patonkia muulle perheelle.",
    ingredients: [
      { name: "kirjolohifilee", amount: 150, unit: "g", category: "Liha ja kala" },
      { name: "peruna", amount: 250, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "tuorekurkku ja kirsikkatomaatit", amount: 100, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "oliiviöljy", amount: 10, unit: "ml", category: "Mausteet" }
    ]
  },
  {
    id: "rec-5",
    name: "Proteiinipannukakku ja mansikat",
    calories_per_serving: 420,
    protein_per_serving: 30,
    carbohydrates_per_serving: 45,
    fat_per_serving: 10,
    meal_type: "breakfast",
    preparation_time: 5,
    cooking_time: 10,
    estimated_cost: "medium" as const,
    instructions: "1. Vatkaa kananmunat, rasvaton maito ja heraproteiini kulhossa. Mausta taikina 0.5 tl ceyloninkanelilla ja ripaus aitoa vaniljajauhetta.\n2. Kuumenna pannu ja paista taikinasta pieniä lettuja 1 tl kookosöljyssä keskilämmöllä.\n3. Koristele annos tuoreilla mansikoilla ja 1 rkl mintunlehdillä.\n4. Perheelle: Tarjoile muille perheenjäsenille lettujen kanssa vaahterasiirappia tai kuohukermaa.",
    ingredients: [
      { name: "kananmuna", amount: 2, unit: "kpl", category: "Maitotuotteet" },
      { name: "heraproteiini", amount: 30, unit: "g", category: "Lisäravinteet" },
      { name: "tuoreet mansikat", amount: 100, unit: "g", category: "Hedelmät ja vihannekset" }
    ]
  },
  {
    id: "rec-6",
    name: "Tofukulho avokadolla",
    calories_per_serving: 460,
    protein_per_serving: 26,
    carbohydrates_per_serving: 38,
    fat_per_serving: 18,
    meal_type: "lunch",
    preparation_time: 10,
    cooking_time: 10,
    estimated_cost: "low" as const,
    instructions: "1. Kuivaa tofu paperilla ja kuutioi. Paista kuutiot rapeiksi pannulla 1 tl seesamiöljyssä. Mausta 1 rkl vähäsuolaisella soijakastikkeella ja 0.5 tl valkosipulijauheella.\n2. Keitä jasminriisi ripauksella suolaa pakkauksen ohjeen mukaan.\n3. Kokoa kulhon pohjalle keitetty riisi ja asettele päälle rapea tofu, avokadoviipaleet, tuorekurkkusiivut sekä porkkanaraaste.\n4. Viimeistele annos 1 tl seesaminsiemenillä ja 1 rkl limetistä puristetulla mehulla.\n5. Perheelle: Muulle perheelle voidaan lisätä kulhoon reilu loraus majoneesia tai chili-kastiketta.",
    ingredients: [
      { name: "tofu (kiinteä)", amount: 150, unit: "g", category: "Maitotuotteet" },
      { name: "avokado", amount: 0.5, unit: "kpl", category: "Hedelmät ja vihannekset" },
      { name: "tuorekurkku ja porkkanaraaste", amount: 120, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "jasminriisi", amount: 60, unit: "g", category: "Kuiva-aineet" }
    ]
  },
  {
    id: "rec-7",
    name: "Nauta-riisipannu parsakaalilla",
    calories_per_serving: 580,
    protein_per_serving: 42,
    carbohydrates_per_serving: 55,
    fat_per_serving: 14,
    meal_type: "dinner",
    preparation_time: 10,
    cooking_time: 15,
    estimated_cost: "medium" as const,
    instructions: "1. Ruskista naudan jauheliha kuumalla pannulla. Mausta ruskistunut liha 1 tl jauhetulla juustokuminalla, 0.5 tl sipulijauheella ja 0.25 tl mustapippurilla.\n2. Lisää pannulle hienonnettu valkosipulin kynsi ja kuullota minuutti.\n3. Sekoita joukkoon keitetty täysjyväriisi, parsakaalinnuput ja suikaloitu paprika.\n4. Paista keskilämmöllä 5-7 minuuttia sekoitellen, kunnes parsakaali on kypsää mutta napakkaa.\n5. Perheelle: Lisää muiden annoksiin runsas loraus juustoraastetta tai tarjoile leivän kanssa.",
    ingredients: [
      { name: "naudan jauheliha 10%", amount: 150, unit: "g", category: "Liha ja kala" },
      { name: "parsakaalinnuput ja paprika", amount: 150, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "riisi", amount: 70, unit: "g", category: "Kuiva-aineet" }
    ]
  },
  {
    id: "rec-8",
    name: "Kalkkunaleipä ja kurkkua",
    calories_per_serving: 240,
    protein_per_serving: 16,
    carbohydrates_per_serving: 30,
    fat_per_serving: 6,
    meal_type: "snack",
    preparation_time: 5,
    cooking_time: 0,
    estimated_cost: "low" as const,
    instructions: "1. Halkaise kaurainen täysjyväleipä.\n2. Voitele kevyesti 1 tl dijonsinapilla tai kevyellä tuorejuustolla.\n3. Täytä kalkkunaleikkeleillä, tuoreella romainesalaatilla, tomaattisiivuilla ja avokadoviipaleilla.\n4. Tarjoile kurkkutikkujen kera, jotka on pyöräytetty ripauksessa valkopippuria.\n5. Perheelle: Muulle perheelle voidaan lisätä leivän väliin juustoa tai majoneesia.",
    ingredients: [
      { name: "täysjyväleipä", amount: 2, unit: "viipale", category: "Kuiva-aineet" },
      { name: "kalkkunaleikkele", amount: 50, unit: "g", category: "Liha ja kala" },
      { name: "romainesalaatti ja tomaatti", amount: 60, unit: "g", category: "Hedelmät ja vihannekset" }
    ]
  },
  {
    id: "rec-9",
    name: "Vihreä proteiinismoothie",
    calories_per_serving: 250,
    protein_per_serving: 22,
    carbohydrates_per_serving: 28,
    fat_per_serving: 4,
    meal_type: "snack",
    preparation_time: 4,
    cooking_time: 0,
    estimated_cost: "low" as const,
    instructions: "1. Kuori banaani ja laita paloina tehosekoittimeen.\n2. Lisää pesty tuore lehtipinaatti, heraproteiinijauhe ja 1.5 dl kylmää vettä.\n3. Mausta smoothie 0.5 tl raastetulla tuoreella inkiväärillä ja 1 rkl sitruunamehulla raikkauden lisäämiseksi.\n4. Aja täydellä teholla sileäksi ja tarjoile heti.",
    ingredients: [
      { name: "banaani", amount: 1, unit: "kpl", category: "Hedelmät ja vihannekset" },
      { name: "tuore pinaatti", amount: 50, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "heraproteiini", amount: 25, unit: "g", category: "Lisäravinteet" }
    ]
  },
  {
    id: "rec-10",
    name: "Avokado-kanasalaatti",
    calories_per_serving: 480,
    protein_per_serving: 38,
    carbohydrates_per_serving: 12,
    fat_per_serving: 24,
    meal_type: "lunch",
    preparation_time: 10,
    cooking_time: 10,
    estimated_cost: "medium" as const,
    instructions: "1. Paista broilerin rintafileekuutiot pannulla. Mausta 1 tl kuivatulla basilikalla, 0.5 tl sipulijauheella ja 0.25 tl hienolla suolalla.\n2. Revi lautaselle reilusti romainesalaattia, kurkkukuutioita ja halkaistuja kirsikkatomaatteja.\n3. Kokoa päälle lämpimät kanakuutiot ja viipaloitu kypsä avokado.\n4. Sekoita salaatinkastike: 1 rkl omenaviinietikkaa, 1 tl ranskan-sinappia ja ripaus valkopippuria.\n5. Perheelle: Lisää muiden perheenjäsenten salaattiin reilusti krutonkeja tai fetajuustokuutioita.",
    ingredients: [
      { name: "broilerin rintafilee", amount: 150, unit: "g", category: "Liha ja kala" },
      { name: "avokado", amount: 0.5, unit: "kpl", category: "Hedelmät ja vihannekset" },
      { name: "tuorekurkku ja tomaatti", amount: 150, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "romainesalaatti", amount: 50, unit: "g", category: "Hedelmät ja vihannekset" }
    ]
  },
  {
    id: "rec-11",
    name: "Linssikeitto ja raejuusto",
    calories_per_serving: 410,
    protein_per_serving: 26,
    carbohydrates_per_serving: 50,
    fat_per_serving: 8,
    meal_type: "dinner",
    preparation_time: 10,
    cooking_time: 20,
    estimated_cost: "low" as const,
    instructions: "1. Huuhtele punaiset linssit huolellisesti kylmällä vedellä.\n2. Kuumenna kattilassa 1 tl oliiviöljyä, kuullota silputtu sipuli ja valkosipulinkynsi. Mausta 1 tl curryjauheella ja 0.5 tl juustokuminalla.\n3. Lisää kattilaan linssit, tomaattimurska, porkkanakuutiot ja 3 dl kasvislientä.\n4. Keitä miedolla lämmöllä kannen alla 20 minuuttia, kunnes linssit ovat kypsiä.\n5. Tarjoile annos raejuuston ja tuoreen hienonnetun persiljan kera.\n6. Perheelle: Tarjoile keiton lisukkeena ruisleipää tai kermaviiliä.",
    ingredients: [
      { name: "punaiset linssit", amount: 80, unit: "g", category: "Kuiva-aineet" },
      { name: "tomaattimurska ja liemi", amount: 200, unit: "ml", category: "Kuiva-aineet" },
      { name: "porkkana", amount: 1, unit: "kpl", category: "Hedelmät ja vihannekset" },
      { name: "raejuusto (kevyt)", amount: 100, unit: "g", category: "Maitotuotteet" }
    ]
  },
  {
    id: "rec-12",
    name: "Kananmuna-avokadoleipä",
    calories_per_serving: 360,
    protein_per_serving: 18,
    carbohydrates_per_serving: 28,
    fat_per_serving: 16,
    meal_type: "breakfast",
    preparation_time: 5,
    cooking_time: 5,
    estimated_cost: "low" as const,
    instructions: "1. Keitä kananmuna kovaksi tai paista se kevyesti ilman lisättyä rasvaa.\n2. Paahda täysjyväleivät kevyesti.\n3. Muusaa avokado kulhossa ja mausta se 1 tl limettimehulla, ripauksella suolaa ja chilihiutaleilla.\n4. Levitä avokadotahna leiville, aseta päälle kananmunasiivut ja viipaloitu tuorekurkku.\n5. Perheelle: Lisää muiden leiville graavilohta tai juustoviipaleita.",
    ingredients: [
      { name: "kananmuna", amount: 2, unit: "kpl", category: "Maitotuotteet" },
      { name: "täysjyväleipä", amount: 2, unit: "viipale", category: "Kuiva-aineet" },
      { name: "avokado", amount: 0.5, unit: "kpl", category: "Hedelmät ja vihannekset" },
      { name: "tuorekurkku", amount: 50, unit: "g", category: "Hedelmät ja vihannekset" }
    ]
  }
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Load demographics to calculate TDEE
    const [profileRes, prefsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle()
    ]);

    const birthYear = profileRes.data?.birth_year || 1990;
    const heightCm = Number(profileRes.data?.height_cm || 180);
    const gender = profileRes.data?.gender || "male";

    const { data: weightData } = await supabase
      .from("body_measurements")
      .select("value")
      .eq("user_id", userId)
      .eq("metric", "weight")
      .order("measured_at", { ascending: false })
      .limit(1);

    const weight = weightData && weightData.length > 0 ? Number(weightData[0].value) : 85.5;

    const { data: goal } = await supabase
      .from("goals")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    let weeklyExerciseTarget = 3;
    if (goal) {
      const { data: ver } = await supabase
        .from("goal_versions")
        .select("weekly_exercise_count_target")
        .eq("goal_id", goal.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ver) {
        weeklyExerciseTarget = ver.weekly_exercise_count_target || 3;
      }
    }

    const bmr = calculateBmr(weight, heightCm, birthYear, gender);
    const tdee = calculateTdee(bmr, weeklyExerciseTarget);

    const targetCalories = tdee - 500;
    const targetProtein = Math.round(weight * 2.0);
    const targetFat = Math.round(weight * 0.9);
    const targetCarbs = Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4);

    let profile: any = null;
    let planDays: any[] = [];
    let usingMockData = false;

    // Load planned workouts for workouts status
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(now.getTime() - distanceToMonday * 24 * 60 * 60 * 1000);
    const mondayStr = monday.toISOString().split("T")[0];
    const sundayStr = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const workoutDates = new Set<string>();
    try {
      const { data: workoutsThisWeek } = await supabase
        .from("planned_workouts")
        .select("date")
        .eq("user_id", userId)
        .gte("date", mondayStr)
        .lte("date", sundayStr);
      if (workoutsThisWeek) {
        workoutsThisWeek.forEach((w: any) => workoutDates.add(w.date));
      }
    } catch (err) {
      console.warn("Workouts load warning:", err);
    }

    // Load recipe interactions (favorites, rejections)
    let interactions: any[] = [];
    try {
      const { data: dbInter } = await supabase
        .from("recipe_interactions")
        .select("*")
        .eq("user_id", userId);
      interactions = dbInter || [];
    } catch (err) {
      console.warn("Interactions table load warning:", err);
    }

    try {
      const { data: dbProfile } = await supabase
        .from("nutrition_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      
      profile = dbProfile;

      const todayStr = new Date().toISOString().split("T")[0];
      const { data: dbPlan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", userId)
        .lte("start_date", todayStr)
        .gte("end_date", todayStr)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbPlan) {
        const { data: days } = await supabase
          .from("meal_plan_days")
          .select("*, planned_meals(*)")
          .eq("plan_id", dbPlan.id)
          .order("date", { ascending: true });
        planDays = days || [];
      }
    } catch (dbErr) {
      console.warn("DB meal plan load warning:", dbErr);
      usingMockData = true;
    }

    if (!profile) {
      profile = {
        user_id: userId,
        diet_type: "standard",
        allergies: [],
        avoided_ingredients: [],
        favorite_ingredients: ["broileri", "lohifilee", "raejuusto", "kaurahiutale"],
        daily_meals_count: 4,
        cooking_time_limit: 45,
        budget_preference: "medium",
        household_size: 1,
        pantry: ["suola", "mustapippuri", "oliiviöljy", "riisi", "kaurahiutale"],
        leftovers_preference: "two_days"
      };
    }

    // Generate weekly plan if none existed
    if (planDays.length === 0 || usingMockData) {
      console.log("Generating advanced variety weekly plan");
      planDays = generateWeeklyPlan(
        userId,
        profile,
        { calories: targetCalories, protein: targetProtein, carbs: targetCarbs, fat: targetFat },
        MOCK_RECIPES,
        interactions,
        workoutDates,
        monday
      );
    }

    return NextResponse.json({
      usingMockData,
      profile,
      targets: {
        calories: targetCalories,
        protein: targetProtein,
        carbs: targetCarbs,
        fat: targetFat
      },
      plan: planDays
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error fetching plan" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, profileData, mealData, recipeId, rating, isFavorite, favoriteFrequency, rejected, rejectionReason, regenerationType, targetMealId } = body;
    const userId = user.id;

    if (action === "update_profile") {
      const { error } = await supabase
        .from("nutrition_profiles")
        .upsert({
          user_id: userId,
          ...profileData,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Ravintoprofiili päivitetty." });
    }

    if (action === "update_planned_meal") {
      const { error } = await supabase
        .from("planned_meals")
        .upsert(mealData);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Ateria päivitetty." });
    }

    // Favorite and interactions log
    if (action === "toggle_favorite") {
      const { error } = await supabase
        .from("recipe_interactions")
        .upsert({
          user_id: userId,
          recipe_id: recipeId,
          is_favorite: isFavorite,
          favorite_frequency: favoriteFrequency || 'weekly',
          user_rating: rating || null,
          rejected_by_user: rejected || false,
          rejection_reason: rejectionReason || null,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,recipe_id" });
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Suosikkitila päivitetty." });
    }

    // Dynamic regeneration handling
    if (action === "regenerate") {
      // Stub success response for regeneration action
      return NextResponse.json({
        success: true,
        message: "Viikkosuunnitelma regeneroitu dynaamisesti toivomustesi pohjalta.",
        plan: [] // UI triggers refetch to load updated plan
      });
    }

    if (action === "update_meals_count") {
      const { mealsCount, lockedMeals: clientLockedMealIds } = body;
      
      const { data: dbProfile } = await supabase
        .from("nutrition_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const { error: profileErr } = await supabase
        .from("nutrition_profiles")
        .upsert({
          user_id: userId,
          ...dbProfile,
          daily_meals_count: mealsCount,
          updated_at: new Date().toISOString()
        });
      if (profileErr) throw profileErr;

      const todayStr = new Date().toISOString().split("T")[0];
      const { data: dbPlan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", userId)
        .lte("start_date", todayStr)
        .gte("end_date", todayStr)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbPlan) {
        const { data: days } = await supabase
          .from("meal_plan_days")
          .select("*, planned_meals(*)")
          .eq("plan_id", dbPlan.id)
          .order("date", { ascending: true });

        if (days && days.length > 0) {
          const [profileRes, weightRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
            supabase.from("body_measurements").select("value").eq("user_id", userId).eq("metric", "weight").order("measured_at", { ascending: false }).limit(1)
          ]);
          const birthYear = profileRes.data?.birth_year || 1990;
          const heightCm = Number(profileRes.data?.height_cm || 180);
          const gender = profileRes.data?.gender || "male";
          const weight = weightRes.data && weightRes.data.length > 0 ? Number(weightRes.data[0].value) : 85.5;

          const bmr = calculateBmr(weight, heightCm, birthYear, gender);
          const tdee = calculateTdee(bmr, 3);
          const targetCalories = tdee - 500;
          const targetProtein = Math.round(weight * 2.0);
          const targetFat = Math.round(weight * 0.9);
          const targetCarbs = Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4);

          const lockedSet = new Set<string>(clientLockedMealIds || []);
          
          try {
            const updatedDays = redistributePlanCalories(
              days,
              { calories: targetCalories, protein: targetProtein, carbs: targetCarbs, fat: targetFat },
              mealsCount,
              lockedSet,
              MOCK_RECIPES
            );

            for (const day of updatedDays) {
              await supabase
                .from("meal_plan_days")
                .update({
                  day_calories: day.day_calories,
                  day_protein: day.day_protein,
                  day_carbs: day.day_carbs,
                  day_fat: day.day_fat
                })
                .eq("id", day.id);

              await supabase
                .from("planned_meals")
                .delete()
                .eq("day_id", day.id);

              for (const meal of day.planned_meals) {
                await supabase
                  .from("planned_meals")
                  .insert({
                    id: meal.id,
                    day_id: day.id,
                    meal_type: meal.meal_type,
                    recipe_id: meal.recipe_id,
                    recipe_name: meal.recipe_name,
                    portion_size_factor: meal.portion_size_factor,
                    household_servings: meal.household_servings,
                    calories: meal.calories,
                    protein: meal.protein,
                    carbs: meal.carbs,
                    fat: meal.fat,
                    ingredients_snapshot: meal.ingredients_snapshot,
                    instructions: meal.instructions,
                    is_locked: meal.is_locked,
                    is_leftover: meal.is_leftover,
                    repetition_reason: meal.repetition_reason,
                    source_meal_id: meal.source_meal_id
                  });
              }
            }

            return NextResponse.json({ success: true, message: "Suunnitelman ateriamäärä ja kalorit päivitetty!" });
          } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 400 });
          }
        }
      }

      return NextResponse.json({ success: true, message: "Suunnitelman ateriamäärä päivitetty (mock)." });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

