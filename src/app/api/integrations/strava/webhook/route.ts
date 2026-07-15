import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { syncActivityToPlannedWorkout } from "@/lib/workout-utils";

// 1. GET: Webhook Subscription Validation
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Strava Webhook subscription validated successfully.");
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// 2. POST: Process Webhook Events
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { aspect_type, event_time, object_id, object_type, owner_id, updates } = payload;

    // We only care about activity events
    if (object_type !== "activity") {
      return NextResponse.json({ status: "ignored" });
    }

    const eventId = `${aspect_type}_${object_id}`;
    
    // We use the admin client because webhooks don't contain user session headers
    const supabase = supabaseAdmin();

    // 2.1 Check for duplicate webhook events
    const { data: existingEvent } = await supabase
      .from("integration_events")
      .select("id, status")
      .eq("provider", "strava")
      .eq("external_event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({ status: "ignored_duplicate" });
    }

    // 2.2 Record event as received
    const { data: recordedEvent } = await supabase
      .from("integration_events")
      .insert({
        provider: "strava",
        external_event_id: eventId,
        event_type: aspect_type,
        payload_hash: eventId, // simplistic hash representation
        status: "received",
      })
      .select()
      .single();

    // 2.3 Process event in background
    // Look up user OAuth token by Stravan owner_id (stored in user meta or integrations connections)
    // For local mockup we can resolve the single allowed user profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (userProfile && aspect_type === "create") {
      // Create a completed workout record in our database
      const startedAt = new Date(event_time * 1000).toISOString();
      
      const { error: activityError } = await supabase
        .from("activities")
        .insert({
          user_id: userProfile.id,
          provider: "strava",
          external_id: object_id.toString(),
          activity_type: "Juoksu",
          started_at: startedAt,
          duration_seconds: 2700, // 45 min
          distance_meters: 5000, // 5 km
          calories_kcal: 400,
        });

      if (!activityError) {
        // Sync to planned workouts
        await syncActivityToPlannedWorkout(
          supabase,
          userProfile.id,
          {
            activity_type: "Juoksu",
            started_at: startedAt,
            duration_seconds: 2700,
            calories_kcal: 400,
          },
          true // Matches planned workout today if exists
        );

        // Update webhook status
        await supabase
          .from("integration_events")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("id", recordedEvent.id);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("Error handling Strava webhook:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
