import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { calculatePlanAdaptations } from "@/lib/calculations/planning";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch latest check-in
    const { data: checkInData, error: checkInError } = await supabase
      .from("daily_check_ins")
      .select("sleep_hours, sleep_quality, energy_level, stress_level, soreness_level")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkInError) throw checkInError;
    if (!checkInData) {
      return NextResponse.json({ proposals: [], message: "Ei aamukirjausta tehty tälle päivälle." });
    }

    // 3. Fetch upcoming planned workouts (next 3 days)
    const today = new Date().toISOString().split("T")[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const endDate = threeDaysLater.toISOString().split("T")[0];

    const { data: workoutsData, error: workoutsError } = await supabase
      .from("planned_workouts")
      .select("id, date, activity_type, title, duration_minutes, intensity, status")
      .eq("user_id", user.id)
      .gte("date", today)
      .lte("date", endDate)
      .eq("status", "planned");

    if (workoutsError) throw workoutsError;

    // Format for engine
    const formattedWorkouts = (workoutsData || []).map((w) => ({
      id: w.id,
      date: w.date,
      activityType: w.activity_type,
      title: w.title,
      durationMinutes: w.duration_minutes,
      intensity: w.intensity as any,
      status: w.status,
    }));

    // 4. Calculate adaptations
    const checkIn = {
      sleepHours: checkInData.sleep_hours ? Number(checkInData.sleep_hours) : undefined,
      sleepQuality: checkInData.sleep_quality,
      energyLevel: checkInData.energy_level,
      stressLevel: checkInData.stress_level,
      sorenessLevel: checkInData.soreness_level,
    };

    const proposals = calculatePlanAdaptations(checkIn, formattedWorkouts);

    // 5. Apply adaptations directly to the database
    if (proposals.length > 0) {
      for (const proposal of proposals) {
        // Record adjustment log
        const { data: adjustment, error: adjError } = await supabase
          .from("plan_adjustments")
          .insert({
            user_id: user.id,
            reason_code: proposal.reasonCode,
            description: proposal.reasonText,
          })
          .select()
          .single();

        if (adjError) throw adjError;

        // Update target workout in DB
        const { error: updateError } = await supabase
          .from("planned_workouts")
          .update({
            duration_minutes: proposal.changes.durationMinutes,
            intensity: proposal.changes.intensity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", proposal.workoutId);

        if (updateError) throw updateError;
      }
    }

    return NextResponse.json({ proposals });
  } catch (error: any) {
    console.error("Error running planning adaptation:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe suunnitelman mukautuksessa." },
      { status: 500 }
    );
  }
}
