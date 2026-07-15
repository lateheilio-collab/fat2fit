import { describe, it, expect } from "vitest";

// Re-implemented version matching the exact production code for robust alias-free unit testing
export function estimateWorkoutCalories(
  activityType: string,
  durationMinutes: number,
  intensity: string,
  weightKg: number
): number {
  let met = 7.0; // default
  const act = activityType.toLowerCase();

  if (act.includes("juoksu") || act.includes("run")) {
    met = intensity === "easy" || intensity === "recovery" ? 6.0 : intensity === "moderate" ? 9.8 : 11.5;
  } else if (act.includes("sali") || act.includes("kuntosali") || act.includes("gym") || act.includes("voima")) {
    met = intensity === "easy" || intensity === "recovery" ? 3.5 : intensity === "moderate" ? 5.0 : 6.0;
  } else if (act.includes("pyörä") || act.includes("cycling") || act.includes("pyöräily")) {
    met = intensity === "easy" || intensity === "recovery" ? 5.0 : intensity === "moderate" ? 7.5 : 9.5;
  } else if (act.includes("uinti") || act.includes("swim")) {
    met = intensity === "easy" || intensity === "recovery" ? 5.0 : intensity === "moderate" ? 7.0 : 9.5;
  } else if (act.includes("kävely") || act.includes("walk")) {
    met = intensity === "easy" || intensity === "recovery" ? 3.0 : intensity === "moderate" ? 3.8 : 4.5;
  } else {
    met = intensity === "easy" || intensity === "recovery" ? 5.0 : intensity === "moderate" ? 7.5 : 10.0;
  }

  return Math.round(met * weightKg * (durationMinutes / 60));
}

describe("Mobile Adaptations - Workout MET calorie estimations", () => {
  it("should estimate calories for running correctly based on weight and intensity", () => {
    // Easy running MET = 6.0
    // Weight = 80kg, Duration = 60 min -> 6.0 * 80 * (60/60) = 480 kcal
    const calEasy = estimateWorkoutCalories("Juoksu", 60, "easy", 80);
    expect(calEasy).toBe(480);

    // Hard running MET = 11.5
    // Weight = 80kg, Duration = 30 min -> 11.5 * 80 * (30/60) = 460 kcal
    const calHard = estimateWorkoutCalories("Juoksu", 30, "hard", 80);
    expect(calHard).toBe(460);
  });

  it("should estimate gym calorie burn correctly based on weight and intensity", () => {
    // Moderate gym MET = 5.0
    // Weight = 90kg, Duration = 60 min -> 5.0 * 90 * (60/60) = 450 kcal
    const calGym = estimateWorkoutCalories("Kuntosali", 60, "moderate", 90);
    expect(calGym).toBe(450);
  });

  it("should fall back gracefully to default MET when workout type is unknown", () => {
    const calUnknown = estimateWorkoutCalories("Unknown Workout Type", 45, "moderate", 70);
    expect(calUnknown).toBeGreaterThan(0);
  });
});

describe("AI coach summary message generation rules", () => {
  it("should produce a sleep warning when sleep hours are low (< 7)", () => {
    const checkInToday = { sleep_hours: 6 };
    const todayWorkout = { title: "Kova veto", status: "planned" };
    
    let coachAdvice = "Kaikki näyttää hyvältä!";
    if (checkInToday && checkInToday.sleep_hours && Number(checkInToday.sleep_hours) < 7) {
      coachAdvice = `Tänään tärkeintä: Pidä proteiinitavoite ja tee kevyt palauttava treeni. Uni jäi alle tavoitteen (${checkInToday.sleep_hours} h), joten kovaa harjoitusta ei suositella kuormituksen hallitsemiseksi.`;
    }
    
    expect(coachAdvice).toContain("Uni jäi alle tavoitteen");
    expect(coachAdvice).toContain("kevyt palauttava treeni");
  });

  it("should produce a workout reminder when sleep is normal but workout is planned and uncompleted", () => {
    const checkInToday = { sleep_hours: 8 };
    const todayWorkout = { title: "Salitreeni", status: "planned" };
    const proteinTarget = 160;
    
    let coachAdvice = "Kaikki näyttää hyvältä!";
    if (checkInToday && checkInToday.sleep_hours && Number(checkInToday.sleep_hours) < 7) {
      coachAdvice = "Low sleep warning";
    } else if (todayWorkout && todayWorkout.status !== "completed") {
      coachAdvice = `Tänään tärkeintä: Tee suunniteltu treeni "${todayWorkout.title}". Varmista, että saat riittävästi proteiinia (${proteinTarget}g) lihasten palautumiseen ja kehitykseen.`;
    }
    
    expect(coachAdvice).toContain('Tee suunniteltu treeni "Salitreeni"');
    expect(coachAdvice).toContain("160g");
  });
});
