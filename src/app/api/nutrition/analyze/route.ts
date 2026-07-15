import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { analyzeMealImage } from "@/lib/gemini";

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
    const { imageBase64, plateProfile, description } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }

    // 3. Call Gemini Multimodal analysis
    const analysis = await analyzeMealImage(
      imageBase64,
      plateProfile,
      description
    );

    // 4. Enrich analysis items with real Fineli macro data from our database
    const enrichedItems = await Promise.all(
      analysis.items.map(async (item) => {
        // Find best match in our database cache using first search term
        const searchTerm = item.fineliSearchTerms?.[0] || item.detectedName;
        
        const { data: dbMatches } = await supabase
          .from("food_reference_cache")
          .select("id, name_fi, energy_kcal, protein_g, carbohydrates_g, fat_g, fiber_g")
          .ilike("name_fi", `%${searchTerm}%`)
          .limit(3);

        const suggestedMatches = dbMatches?.map((match) => ({
          fineliId: match.id,
          name: match.name_fi,
          matchConfidence: 0.9,
          // Attaching the macros to make confirmation faster in frontend
          energyKcal: match.energy_kcal,
          proteinG: match.protein_g,
          carbsG: match.carbohydrates_g,
          fatG: match.fat_g,
          fiberG: match.fiber_g,
        })) || [];

        // If no match was found, offer standard fallback fields
        return {
          ...item,
          suggestedFineliMatches: [...suggestedMatches, ...item.suggestedFineliMatches],
        };
      })
    );

    return NextResponse.json({
      analysis: {
        ...analysis,
        items: enrichedItems,
      },
    });
  } catch (error: any) {
    console.error("Error analyzing meal image:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe kuva-analyysissä." },
      { status: 500 }
    );
  }
}
