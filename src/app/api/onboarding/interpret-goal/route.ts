import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { interpretUserGoal } from "@/lib/gemini";

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
    const { verbalGoal, demographics } = body;

    if (!verbalGoal || typeof verbalGoal !== "string") {
      return NextResponse.json({ error: "verbalGoal is required" }, { status: 400 });
    }

    // 3. Call Gemini helper
    const interpretation = await interpretUserGoal(
      verbalGoal,
      demographics || {}
    );

    return NextResponse.json({ interpretation });
  } catch (error: any) {
    console.error("Error interpreting goal:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe tavoitteen tulkinnassa." },
      { status: 500 }
    );
  }
}
