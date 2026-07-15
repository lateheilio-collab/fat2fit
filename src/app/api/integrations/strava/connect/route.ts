import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { StravaActivityProvider } from "@/lib/providers";

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Generate authorization URL using Strava provider
    const provider = new StravaActivityProvider();
    const result = await provider.connect(user.id);

    if (result.authUrl) {
      return NextResponse.redirect(result.authUrl);
    }

    return NextResponse.json({ error: "Could not create auth URL" }, { status: 500 });
  } catch (error: any) {
    console.error("Error in Strava connect:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe Strava-yhdistämisessä." },
      { status: 500 }
    );
  }
}
