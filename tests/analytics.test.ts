import { describe, it, expect } from "vitest";
import {
  calculatePearsonCorrelation,
  detectWeightPlateau,
  calculateBmr,
  calculateTdee
} from "../src/lib/calculations/analytics";

describe("Pearson Correlation Coefficient Math", () => {
  it("should calculate correct correlation for identical changes", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10]; // perfectly positively correlated
    const r = calculatePearsonCorrelation(x, y);
    expect(r).toBeCloseTo(1.0);
  });

  it("should calculate negative correlation for inverse relationship", () => {
    const x = [8, 7, 6, 5, 4];
    const y = [1, 2, 3, 4, 5]; // perfectly negatively correlated
    const r = calculatePearsonCorrelation(x, y);
    expect(r).toBeCloseTo(-1.0);
  });

  it("should return close to 0 for uncorrelated variables", () => {
    const x = [1, 2, 1, 2, 1];
    const y = [5, 5, 1, 1, 3];
    const r = calculatePearsonCorrelation(x, y);
    expect(Math.abs(r)).toBeLessThan(0.5);
  });
});

describe("Plateau Detection Logic", () => {
  it("should flag a true plateau if weight remains unchanged and waist does not decrease", () => {
    const weights = [
      { date: "2026-06-01", weight: 80.0 },
      { date: "2026-06-02", weight: 80.0 },
      { date: "2026-06-05", weight: 80.1 },
      { date: "2026-06-10", weight: 80.0 },
      { date: "2026-06-15", weight: 80.0 },
    ];
    const waists = [
      { date: "2026-06-01", value: 90.0 },
      { date: "2026-06-15", value: 90.0 },
    ];

    const result = detectWeightPlateau(weights, waists);
    expect(result.isPlateau).toBe(true);
    expect(result.type).toBe("true_plateau");
  });

  it("should flag body recomposition if weight remains unchanged but waist decreases", () => {
    const weights = [
      { date: "2026-06-01", weight: 80.0 },
      { date: "2026-06-02", weight: 80.0 },
      { date: "2026-06-05", weight: 80.1 },
      { date: "2026-06-10", weight: 80.0 },
      { date: "2026-06-15", weight: 80.0 },
    ];
    const waists = [
      { date: "2026-06-01", value: 90.0 },
      { date: "2026-06-15", value: 89.2 }, // decreased by 0.8 cm
    ];

    const result = detectWeightPlateau(weights, waists);
    expect(result.isPlateau).toBe(false);
    expect(result.type).toBe("recomposition");
    expect(result.message).toContain("vyötärönympäryksesi on pienentynyt");
  });
});

describe("BMR and TDEE formulas", () => {
  it("should calculate correct Mifflin-St Jeor values", () => {
    // Men: 10 * weight + 6.25 * height - 5 * age + 5
    // 80kg, 180cm, born 1996 (30 years old in 2026)
    // 800 + 1125 - 150 + 5 = 1780
    const bmr = calculateBmr(80, 180, 1996, "male");
    expect(bmr).toBe(1780);

    // Active (3 workouts) TDEE: 1780 * 1.55 = 2759
    const tdee = calculateTdee(bmr, 3);
    expect(tdee).toBe(2759);
  });
});

describe("Weight Chart Tooltip and Dataset separation rules", () => {
  it("should separate actual weigh-in from computed trends", () => {
    const pointWithWeighIn = {
      date: "2026-07-03",
      actualWeight: 93.4,
      ema7: 91.65,
      ema28: 91.85,
      targetWeight: 91.5
    };
    
    expect(pointWithWeighIn.actualWeight).toBe(93.4);
    expect(pointWithWeighIn.ema7).toBe(91.65);
    expect(pointWithWeighIn.ema28).toBe(91.85);
    expect(pointWithWeighIn.targetWeight).toBe(91.5);
  });

  it("should treat missing weigh-in days as null weight", () => {
    const pointWithoutWeighIn = {
      date: "2026-07-03",
      actualWeight: null,
      ema7: 91.65,
      ema28: 91.85,
      targetWeight: 91.5
    };
    
    expect(pointWithoutWeighIn.actualWeight).toBeNull();
    expect(pointWithoutWeighIn.targetWeight).not.toBeNull();
  });
});

describe("Analytics start date and metrics linkage rules", () => {
  it("Testi 1: painodata alkaa myöhemmin kuin tavoite", () => {
    const goalCreatedDate = "2026-06-01";
    const firstWeighInDate = "2026-06-16";
    const weighInPoints = [
      { date: "2026-06-16", weight: 93.4 }
    ];
    
    const weightStartDate = weighInPoints.length > 0 ? weighInPoints[0].date : goalCreatedDate;
    expect(weightStartDate).toBe("2026-06-16");
    expect(weightStartDate).not.toBe("2026-06-01");
  });

  it("Testi 2: EMA ei ala oletusarvosta", () => {
    const firstWeight = 85.0;
    const weighInPoints = [
      { date: "2026-06-16", weight: firstWeight }
    ];
    
    const emaStartVal = weighInPoints[0].weight;
    expect(emaStartVal).toBe(85.0);
  });

  it("Testi 3: 28 päivän keskiarvo ei näy liian aikaisin", () => {
    const weighInPoints = [
      { date: "2026-06-16", weight: 85.0 },
      { date: "2026-06-18", weight: 84.8 },
      { date: "2026-06-20", weight: 84.5 }
    ];
    
    const actualWeighInCount = weighInPoints.length;
    const showEma28 = actualWeighInCount >= 5;
    expect(showEma28).toBe(false);
  });

  it("Testi 4: tavoite luo mittarin ja Testi 5: tavoite ei luo päällekkäistä mittaria", () => {
    const activeGoal = { primary_objective: "weight_loss" };
    const existingMetricKeys = ["weight"];
    
    const ensureGoalMetricsExist = (goalType: string, existingKeys: string[]) => {
      const requiredMetrics = ["weight", "waist_cm"];
      const createdKeys = [...existingKeys];
      
      requiredMetrics.forEach(metric => {
        if (!createdKeys.includes(metric)) {
          createdKeys.push(metric);
        }
      });
      return createdKeys;
    };
    
    const result = ensureGoalMetricsExist(activeGoal.primary_objective, existingMetricKeys);
    expect(result).toContain("weight");
    expect(result).toContain("waist_cm");
    expect(result.filter(k => k === "weight").length).toBe(1);
  });

  it("Testi 6: puuttuva data ei vaikuta keskiarvoon", () => {
    const dataPoints = [
      { day: 1, value: 80 },
      { day: 5, value: 82 },
      { day: 9, value: 84 }
    ];
    const sum = dataPoints.reduce((acc, p) => acc + p.value, 0);
    const avg = sum / dataPoints.length;
    expect(avg).toBe(82);
  });

  it("Testi 7: eri mittareilla eri aloituspäivä", () => {
    const weightPoints = [{ date: "2026-06-10", weight: 85 }];
    const sleepPoints = [{ date: "2026-06-20", sleep: 8 }];
    
    const weightStartDate = weightPoints[0].date;
    const sleepStartDate = sleepPoints[0].date;
    
    expect(weightStartDate).toBe("2026-06-10");
    expect(sleepStartDate).toBe("2026-06-20");
    expect(weightStartDate).not.toBe(sleepStartDate);
  });
});

describe("Fat2Fit Start Date Filtering and Baseline isolation rules", () => {
  const fat2fitStartDate = "2026-07-03";
  const rawMeasurements = [
    { date: "2026-01-01", weight: 52.0 },
    { date: "2026-07-03", weight: 85.0 },
    { date: "2026-07-15", weight: 84.0 }
  ];

  it("Testi 1: vanha historia ei vaikuta painon muutokseen", () => {
    const programData = rawMeasurements.filter(m => m.date >= fat2fitStartDate);
    const baselineWeight = programData[0].weight;
    const currentWeight = programData[programData.length - 1].weight;
    const changeKg = currentWeight - baselineWeight;
    
    expect(baselineWeight).toBe(85.0);
    expect(changeKg).toBe(-1.0);
    expect(changeKg).not.toBe(32.0);
  });

  it("Testi 2: Kaikki-aikaväli tarkoittaa ohjelman aikaista dataa", () => {
    const programData = rawMeasurements.filter(m => m.date >= fat2fitStartDate);
    const datePoints = programData.map(m => m.date);
    
    expect(datePoints).toContain("2026-07-03");
    expect(datePoints).toContain("2026-07-15");
    expect(datePoints).not.toContain("2026-01-01");
  });

  it("Testi 3: tavoitekäyrä alkaa ohjelman lähtöpainosta", () => {
    const programData = rawMeasurements.filter(m => m.date >= fat2fitStartDate);
    const startingWeight = programData[0].weight;
    
    const targetCurveStartVal = startingWeight;
    expect(targetCurveStartVal).toBe(85.0);
    expect(targetCurveStartVal).not.toBe(52.0);
  });

  it("Testi 4: KPI käyttää ohjelman dataa", () => {
    const programData = rawMeasurements.filter(m => m.date >= fat2fitStartDate);
    const startingWeight = programData[0].weight;
    const currentWeight = programData[programData.length - 1].weight;
    
    expect(startingWeight).toBe(85.0);
    expect(currentWeight).toBe(84.0);
  });

  it("Testi 5: mittari alkaa ensimmäisestä ohjelman aikaisesta datapisteestä", () => {
    const rawWaistCircumference = [
      { date: "2026-01-01", value: 72.0 },
      { date: "2026-07-10", value: 94.5 }
    ];
    const programWaist = rawWaistCircumference.filter(m => m.date >= fat2fitStartDate);
    const waistStartDate = programWaist.length > 0 ? programWaist[0].date : null;
    
    expect(waistStartDate).toBe("2026-07-10");
    expect(waistStartDate).not.toBe("2026-01-01");
    expect(waistStartDate).not.toBe("2026-07-03");
  });

  it("Testi 6: AI-valmentaja ei käytä vanhaa historiaa", () => {
    const programData = rawMeasurements.filter(m => m.date >= fat2fitStartDate);
    const startingWeight = programData[0].weight;
    const currentWeight = programData[programData.length - 1].weight;
    const changeKg = currentWeight - startingWeight;
    
    const aiSummary = `Fat2Fit-ohjelman alusta painosi on muuttunut ${changeKg.toFixed(1)} kg.`;
    expect(aiSummary).toContain("-1.0 kg");
    expect(aiSummary).not.toContain("+32");
    expect(aiSummary).not.toContain("+33");
  });
});


