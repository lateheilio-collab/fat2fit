import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { mealType, loggedAt, accuracyClass, items } = body;

    if (!mealType || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Virheelliset ateriatiedot" }, { status: 400 });
    }

    // 3. Insert meal header
    const { data: mealData, error: mealError } = await supabase
      .from("meals")
      .insert({
        user_id: user.id,
        logged_at: loggedAt || new Date().toISOString(),
        meal_type: mealType,
        accuracy_class: accuracyClass || "WEIGHED",
      })
      .select()
      .single();

    if (mealError) throw mealError;

    // 4. Insert meal items
    const mealItemsToInsert = items.map((item: any) => ({
      meal_id: mealData.id,
      food_id: item.foodId || null,
      food_name: item.foodName,
      amount_g: item.amountG,
      energy_kcal: item.energyKcal,
      protein_g: item.proteinG,
      carbohydrates_g: item.carbohydratesG,
      fat_g: item.fatG,
      fiber_g: item.fiberG,
    }));

    const { error: itemsError } = await supabase
      .from("meal_items")
      .insert(mealItemsToInsert);

    if (itemsError) throw itemsError;

    return NextResponse.json({ success: true, mealId: mealData.id });
  } catch (error: any) {
    console.error("Error logging meal:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe aterian kirjaamisessa." },
      { status: 500 }
    );
  }
}
