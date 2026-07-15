import { SupabaseClient } from "@supabase/supabase-js";

export async function syncActivityToPlannedWorkout(
  supabase: SupabaseClient,
  userId: string,
  activity: {
    activity_type: string;
    started_at: string;
    duration_seconds: number;
    calories_kcal: number;
    average_heart_rate?: number;
  },
  matchesPlannedWorkout: boolean = true
) {
  // 1. Get the date of started_at in Helsinki timezone
  const dateStr = new Date(activity.started_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });

  let matchingWorkoutId: string | null = null;

  // 2. Find if there is an upcoming planned workout today to link/complete (ONLY if matchesPlannedWorkout is true)
  if (matchesPlannedWorkout) {
    const { data: matchingWorkouts, error: fetchError } = await supabase
      .from("planned_workouts")
      .select("id")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .eq("status", "planned")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching matching planned workouts:", fetchError);
    } else if (matchingWorkouts && matchingWorkouts.length > 0) {
      matchingWorkoutId = matchingWorkouts[0].id;
    }
  }

  if (matchingWorkoutId) {
    // Update planned workout to completed
    const { error: updateError } = await supabase
      .from("planned_workouts")
      .update({ status: "completed" })
      .eq("id", matchingWorkoutId);

    if (updateError) {
      console.error("Error updating planned workout to completed:", updateError);
    }
  } else {
    // No planned workout found or matchesPlannedWorkout is false. Create a new completed one!
    const { error: insertError } = await supabase
      .from("planned_workouts")
      .insert({
        user_id: userId,
        date: dateStr,
        activity_type: activity.activity_type,
        title: activity.activity_type, // e.g. "Kävely" or "Juoksu"
        duration_minutes: Math.round(activity.duration_seconds / 60),
        intensity: activity.calories_kcal > 400 ? "moderate" : "recovery",
        status: "completed",
        description: `Suoritettu lisäharjoitus. Kalorit: ${Math.round(activity.calories_kcal)} kcal. Keskisyke: ${activity.average_heart_rate ? Math.round(activity.average_heart_rate) : "-"} bpm.`
      });

    if (insertError) {
      console.error("Error inserting manual completed workout:", insertError);
    }
  }
}
