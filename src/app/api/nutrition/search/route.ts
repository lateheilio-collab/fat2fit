import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Read query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    // 3. Query Fineli cache in Database
    const { data, error } = await supabase
      .from("food_reference_cache")
      .select("id, name_fi, name_en, energy_kcal, protein_g, carbohydrates_g, fat_g, fiber_g")
      .ilike("name_fi", `%${query.trim()}%`)
      .limit(10);

    if (error) {
      throw error;
    }

    return NextResponse.json({ results: data || [] });
  } catch (error: any) {
    console.error("Error searching food cache:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe elintarvikehaussa." },
      { status: 500 }
    );
  }
}
