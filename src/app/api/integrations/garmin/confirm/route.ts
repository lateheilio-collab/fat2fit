import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { syncActivityToPlannedWorkout } from "@/lib/workout-utils";

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
    const { records, type } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Ei tallennettavia rivejä" }, { status: 400 });
    }

    if (type === "csv") {
      // Insert weight body measurements
      const measurementsToInsert = records.map((r: any) => ({
        user_id: user.id,
        measured_at: r.measuredAt,
        metric: r.metric,
        value: r.value,
        source: "csv_import",
        user_confirmed: true,
      }));

      const { error } = await supabase
        .from("body_measurements")
        .insert(measurementsToInsert);

      if (error) throw error;
      return NextResponse.json({ success: true, count: measurementsToInsert.length });
    }

    if (type === "activity_file") {
      // Insert activities
      const activitiesToInsert = records.map((r: any) => ({
        user_id: user.id,
        provider: "file_import",
        external_id: r.externalId,
        activity_type: r.activityType,
        started_at: r.startedAt,
        duration_seconds: r.durationSeconds,
        distance_meters: r.distanceMeters,
        calories_kcal: r.caloriesKcal,
      }));

      const { error } = await supabase
        .from("activities")
        .insert(activitiesToInsert);

      if (error) throw error;

      // Sync imported activities to planned workouts
      for (const act of activitiesToInsert) {
        await syncActivityToPlannedWorkout(
          supabase,
          user.id,
          {
            activity_type: act.activity_type,
            started_at: act.started_at,
            duration_seconds: act.duration_seconds,
            calories_kcal: act.calories_kcal,
          },
          true // Matches planned workout today if exists
        );
      }

      return NextResponse.json({ success: true, count: activitiesToInsert.length });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("Error confirming import:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe tietojen tallennuksessa." },
      { status: 500 }
    );
  }
}
