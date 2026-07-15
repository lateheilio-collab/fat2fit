import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { scoreRecipesForPlan, Recipe } from "@/lib/calculations/nutrition";

export const dynamic = "force-dynamic";

// Static database of healthy recipes (Fineli-compliant)
const DEFAULT_RECIPES: Recipe[] = [
  {
    id: "rec-1",
    name: "Kaurapuuro marjoilla ja valkuaisella",
    calories_per_serving: 380,
    protein_per_serving: 24,
    carbohydrates_per_serving: 48,
    fat_per_serving: 8,
    dietary_tags: ["vegetarian"],
    allergen_tags: ["gluten"],
    meal_type: "breakfast",
    cooking_time: 10,
    estimated_cost: "low",
    instructions: "1. Keitä kaurahiutaleet vedessä tai kasvimaidossa ripauksella suolaa noin 5 minuuttia.\n2. Sekoita joukkoon marjat ja raejuusto tuomaan väriä ja proteiinia.\n3. Nauti heti!",
    ingredients: [
      { name: "kaurahiutale", amount: 60, unit: "g", category: "Kuiva-aineet" },
      { name: "pakastemustikka", amount: 80, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "mansikat ja vadelmat", amount: 50, unit: "g", category: "Hedelmät ja vihannekset" },
      { name: "raejuusto (kevyt)", amount: 100, unit: "g", category: "Maitotuotteet" }
    ]
  },
  {
    id: "rec-2",
    name: "Runsaspastainen kanapata",
    calories_per_serving: 620,
    protein_per_serving: 44,
    carbohydrates_per_serving: 65,
    fat_per_serving: 16,
    dietary_tags: [],
    allergen_tags: [],
    meal_type: "lunch",
    cooking_time: 25,
    estimated_cost: "medium",
    instructions: "1. Paista broilerin rintafileesuikaleet oliiviöljyssä sipulin ja valkosipulin kanssa.\n2. Keitä pasta kattilassa.\n3. Sekoita kerma, pasta ja broileri pannulla. Lisää joukkoon parsakaali ja paprika tuomaan väriä ja vitamiineja.\n4. Hauduta 5 minuuttia ja tarjoile vihreän salaatin kera.",
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
    dietary_tags: ["vegetarian", "gluten_free"],
    allergen_tags: ["lactose"],
    meal_type: "snack",
    cooking_time: 5,
    estimated_cost: "low",
    instructions: "1. Lusikoi maitorahka kulhoon.\n2. Lisää päälle tuoreet vadelmat, mustikat ja saksanpähkinät tuomaan kuitua ja terveellisiä rasvoja.",
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
    dietary_tags: ["gluten_free", "lactose_free"],
    allergen_tags: ["fish"],
    meal_type: "dinner",
    cooking_time: 35,
    estimated_cost: "high",
    instructions: "1. Leikkaa lohi annospaloiksi, mausta suolalla ja tillillä.\n2. Pese ja lohko perunat, pyöräytä oliiviöljyssä.\n3. Paista lohta ja perunoita uunissa 200 asteessa noin 25 minuuttia.\n4. Tarjoile raikkaan tomaatti-kurkkusalaatin kera.",
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
    dietary_tags: ["vegetarian", "gluten_free"],
    allergen_tags: ["egg"],
    meal_type: "dinner",
    cooking_time: 15,
    estimated_cost: "medium",
    instructions: "1. Vatkaa kananmunat ja heraproteiini kulhossa tasaiseksi taikinaksi.\n2. Paista pannulla molemmin puolin miedolla lämmöllä.\n3. Tarjoile tuoreiden mansikoiden ja mustikoiden kera.",
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
    dietary_tags: ["vegetarian", "vegan", "gluten_free"],
    allergen_tags: ["soya"],
    meal_type: "lunch",
    cooking_time: 15,
    estimated_cost: "low",
    instructions: "1. Kuutioi ja paista tofu rapeaksi pannulla.\n2. Keitä jasminriisi pakkauksen ohjeen mukaan.\n3. Kokoa kulhoon riisi, tofu, avokado, kurkku ja raastettu porkkana. Mausta seesaminsiemenillä.",
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
    dietary_tags: ["gluten_free", "lactose_free"],
    allergen_tags: [],
    meal_type: "dinner",
    cooking_time: 20,
    estimated_cost: "medium",
    instructions: "1. Ruskista jauheliha pannulla valkosipulin kanssa.\n2. Lisää pannulle keitetty riisi, parsakaalinnuput ja paprika suikaloituna.\n3. Paista vielä 5-7 minuuttia, kunnes kasvikset ovat sopivan rapeita.",
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
    dietary_tags: ["gluten_free", "lactose_free"],
    allergen_tags: [],
    meal_type: "snack",
    cooking_time: 5,
    estimated_cost: "low",
    instructions: "1. Halkaise täysjyväleipä.\n2. Täytä kalkkunaleikkeleellä, romainesalaatin lehdillä, tomaattisiivuilla ja avokadolla.",
    ingredients: [
      { name: "täysjyväleipä", amount: 2, unit: "viipale", category: "Kuiva-aineet" },
      { name: "kalkkunaleikkele", amount: 50, unit: "g", category: "Liha ja kala" },
      { name: "romainesalaatti ja tomaatti", amount: 60, unit: "g", category: "Hedelmät ja vihannekset" }
    ]
  }
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // Fetch custom database recipes
    let customRecipes: any[] = [];
    try {
      const { data } = await supabase.from("recipes").select("*");
      customRecipes = data || [];
    } catch (dbErr) {
      console.warn("Recipes table missing, using default presets");
    }

    // Merge default preset recipes with user custom recipes
    const allRecipes = [...DEFAULT_RECIPES, ...customRecipes];

    return NextResponse.json({ recipes: allRecipes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, remainingMacros, profile, currentRecipeId } = body;

    let customRecipes: any[] = [];
    try {
      const { data } = await supabase.from("recipes").select("*");
      customRecipes = data || [];
    } catch (dbErr) {}

    const allRecipes = [...DEFAULT_RECIPES, ...customRecipes];

    if (action === "swap_meal") {
      // Find scored recipes matching remaining macros
      const scored = scoreRecipesForPlan(allRecipes, profile, remainingMacros);
      // Filter out the currently selected recipe
      const alternatives = scored.filter(s => s.recipe.id !== currentRecipeId);

      return NextResponse.json({ alternatives: alternatives.slice(0, 3) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
