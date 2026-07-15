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
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL("/settings?strava=error", request.url));
    }

    if (!code) {
      return NextResponse.json({ error: "Authorization code missing" }, { status: 400 });
    }

    // 3. Exchange code for token
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.errors || !tokenData.access_token) {
      throw new Error(tokenData.message || "Token exchange failed");
    }

    const { access_token, refresh_token, expires_at } = tokenData;

    // 4. Save tokens to DB
    const { error: upsertError } = await supabase
      .from("oauth_tokens")
      .upsert({
        user_id: user.id,
        provider: "strava",
        access_token,
        refresh_token,
        expires_at: new Date(expires_at * 1000).toISOString(),
      });

    if (upsertError) throw upsertError;

    // 5. Redirect back to settings page
    return NextResponse.redirect(new URL("/settings?strava=connected", request.url));
  } catch (error: any) {
    console.error("Error in Strava callback:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe token-käsittelyssä." },
      { status: 500 }
    );
  }
}
