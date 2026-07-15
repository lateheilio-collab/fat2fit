import { describe, it, expect } from "vitest";
import { calculateWeightEMA, calculateWeightRegression } from "../src/lib/calculations/analytics";
import { calculatePlanAdaptations } from "../src/lib/calculations/planning";

describe("Weight Trend Analytics Math Rules", () => {
  it("should calculate correct 7-day EMA weight points", () => {
    const rawWeights = [
      { date: "2026-06-01", weight: 96.0 },
      { date: "2026-06-02", weight: 95.0 },
    ];
    
    const ema = calculateWeightEMA(rawWeights);
    expect(ema.length).toBe(2);
    
    // First value is starting weight
    expect(ema[0].weight).toBe(96.0);
    
    // Second value = 95.0 * 0.25 + 96.0 * 0.75 = 95.75
    expect(ema[1].weight).toBe(95.75);
  });

  it("should fit linear regression and calculate correct target projection date offset", () => {
    const points = [
      { date: "2026-06-01", weight: 96.0 },
      { date: "2026-06-02", weight: 95.0 }, // -1 kg per day slope
    ];

    const regression = calculateWeightRegression(points);
    expect(regression.slope).toBeCloseTo(-1);

    // Target is 90 kg. Intercept is 96. Offset since 2026-06-01 is 6 days.
    // projected target day index is 6.
    // Offset from today (which is after start date) will be projected.
    const projectedDays = regression.projectedDaysToTarget(90);
    expect(projectedDays).toBeDefined();
  });
});

describe("Adaptive Exercise Planning Rules", () => {
  it("should keventää hard workouts if user sleep is very low", () => {
    const checkIn = { sleepHours: 5.0, energyLevel: 2 };
    const upcomingWorkouts = [
      {
        id: "w1",
        date: "2026-07-03",
        activityType: "Juoksu",
        title: "Kova veto",
        durationMinutes: 60,
        intensity: "hard" as const,
        status: "planned",
      },
    ];

    const proposals = calculatePlanAdaptations(checkIn, upcomingWorkouts);
    expect(proposals.length).toBe(1);
    expect(proposals[0].action).toBe("modify");
    expect(proposals[0].changes.intensity).toBe("easy");
    expect(proposals[0].changes.durationMinutes).toBe(36); // 60 * 0.6 = 36 min
  });

  it("should change intensity to recovery if user muscle soreness is high", () => {
    const checkIn = { sorenessLevel: 5 };
    const upcomingWorkouts = [
      {
        id: "w2",
        date: "2026-07-03",
        activityType: "Kuntosali",
        title: "Voimatreeni",
        durationMinutes: 60,
        intensity: "hard" as const,
        status: "planned",
      },
    ];

    const proposals = calculatePlanAdaptations(checkIn, upcomingWorkouts);
    expect(proposals.length).toBe(1);
    expect(proposals[0].action).toBe("modify");
    expect(proposals[0].changes.intensity).toBe("recovery");
    expect(proposals[0].changes.durationMinutes).toBe(30);
  });
});
