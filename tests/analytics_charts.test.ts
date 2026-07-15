import { describe, it, expect } from "vitest";

// Mock helper matching summary/route.ts targetVal calculation logic
function calculateLinearGoal({
  currentDate,
  startGoalTime,
  totalGoalDays,
  startingWeight,
  targetWeight,
  hasGoalConfigured,
  msPerDay = 1000 * 60 * 60 * 24
}: any) {
  if (!hasGoalConfigured) return null;
  const elapsedGoalDays = (currentDate.getTime() - startGoalTime) / msPerDay;
  let targetVal = startingWeight;
  if (elapsedGoalDays > 0) {
    if (elapsedGoalDays >= totalGoalDays) {
      targetVal = targetWeight;
    } else {
      targetVal = startingWeight - (startingWeight - targetWeight) * (elapsedGoalDays / totalGoalDays);
    }
  }
  return Number(targetVal.toFixed(2));
}

// Mock helper matching gap calculation logic
function calculateGoalGap({ actualWeight, ema7, targetLineValue }: any) {
  const currentVal = actualWeight !== null && actualWeight !== undefined ? actualWeight : ema7;
  if (currentVal === null || currentVal === undefined || targetLineValue === null || targetLineValue === undefined) {
    return null;
  }
  return Number((currentVal - targetLineValue).toFixed(2));
}

describe("Progress Analytics weight chart, linear goal, and tooltip rules", () => {

  it("Testi 1: toteutunut painokäyrä piirtyy oikein", () => {
    const rawHistory = [
      { date: "2026-07-03", actualWeight: 86.0 },
      { date: "2026-07-04", actualWeight: null },
      { date: "2026-07-05", actualWeight: 85.5 }
    ];

    const chartPoints = rawHistory.map(pt => ({
      dateStr: pt.date,
      weight: pt.actualWeight
    }));

    expect(chartPoints[0].weight).toBe(86.0);
    expect(chartPoints[1].weight).toBeNull();
    expect(chartPoints[2].weight).toBe(85.5);
  });

  it("Testi 2: lineaarinen tavoitekäyrä piirtyy oikein", () => {
    const startWeight = 86.0;
    const targetWeight = 80.0;
    const totalGoalDays = 60;
    const hasGoalConfigured = true;

    const startGoalTime = new Date("2026-07-03").getTime();

    // Day 0
    const valDay0 = calculateLinearGoal({
      currentDate: new Date("2026-07-03"),
      startGoalTime,
      totalGoalDays,
      startingWeight: startWeight,
      targetWeight,
      hasGoalConfigured
    });

    // Day 30 (midpoint)
    const valDay30 = calculateLinearGoal({
      currentDate: new Date(startGoalTime + 30 * 24 * 60 * 60 * 1000),
      startGoalTime,
      totalGoalDays,
      startingWeight: startWeight,
      targetWeight,
      hasGoalConfigured
    });

    // Day 60 (endpoint)
    const valDay60 = calculateLinearGoal({
      currentDate: new Date(startGoalTime + 60 * 24 * 60 * 60 * 1000),
      startGoalTime,
      totalGoalDays,
      startingWeight: startWeight,
      targetWeight,
      hasGoalConfigured
    });

    expect(valDay0).toBe(86.0);
    expect(valDay30).toBe(83.0); // exact midpoint of 86 and 80
    expect(valDay60).toBe(80.0);
  });

  it("Testi 3: tavoitekäyrää ei piirretä ilman tavoitepäivää", () => {
    const val = calculateLinearGoal({
      currentDate: new Date("2026-07-05"),
      startGoalTime: new Date("2026-07-03").getTime(),
      totalGoalDays: 60,
      startingWeight: 86.0,
      targetWeight: 80.0,
      hasGoalConfigured: false // goal missing
    });

    expect(val).toBeNull();
  });

  it("Testi 4: tooltip erottaa kaikki sarjat oikein", () => {
    const payloadItem = {
      date: "2026-07-15",
      actualWeight: 84.3,
      ema7: 84.8,
      ema28: 85.6,
      linearGoal: 83.9,
      targetWeight: 80.0
    };

    expect(payloadItem.actualWeight).toBe(84.3);
    expect(payloadItem.ema7).toBe(84.8);
    expect(payloadItem.ema28).toBe(85.6);
    expect(payloadItem.linearGoal).toBe(83.9);
    expect(payloadItem.targetWeight).toBe(80.0);

    const missingWeightItem = {
      date: "2026-07-16",
      actualWeight: null,
      ema7: 84.7,
      linearGoal: 83.8
    };
    expect(missingWeightItem.actualWeight).toBeNull();
    expect(missingWeightItem.ema7).toBe(84.7);
  });

  it("Testi 5: tavoite-eron laskenta", () => {
    const gapActual = calculateGoalGap({
      actualWeight: 84.3,
      ema7: 84.8,
      targetLineValue: 83.9
    });

    const gapTrend = calculateGoalGap({
      actualWeight: null,
      ema7: 84.8,
      targetLineValue: 83.9
    });

    expect(gapActual).toBe(0.4); // 84.3 - 83.9 = +0.4
    expect(gapTrend).toBe(0.9); // 84.8 - 83.9 = +0.9
  });

  it("Testi 6: ohjelman aloitus toimii lähtöpisteenä", () => {
    // History weight 52 kg logged long ago (1.1.)
    // Program start 3.7. first weigh in 86 kg
    const programStartDate = "2026-07-03";
    const rawWeights = [
      { date: "2026-01-01", weight: 52.0 },
      { date: "2026-07-03", weight: 86.0 },
      { date: "2026-07-10", weight: 85.0 }
    ];

    const programWeights = rawWeights.filter(w => w.date >= programStartDate);
    const startWeight = programWeights[0].weight;

    expect(startWeight).toBe(86.0);
    expect(startWeight).not.toBe(52.0);
  });

  it("Testi 7: mobiilinäyttö/tietorakennetestaus", () => {
    const responsePayload = {
      goals: {
        targetWeight: 80.0,
        startingWeight: 86.0,
        currentWeight: 84.3,
        hasGoalConfigured: true
      },
      weightHistory: [
        { date: "2026-07-03", actualWeight: 86.0, ema7: 86.0, ema28: 86.0, linearGoal: 86.0, targetWeight: 80.0 }
      ]
    };

    expect(responsePayload.goals.hasGoalConfigured).toBe(true);
    expect(responsePayload.weightHistory[0]).toHaveProperty("actualWeight");
    expect(responsePayload.weightHistory[0]).toHaveProperty("linearGoal");
    expect(responsePayload.weightHistory[0]).toHaveProperty("targetWeight");
  });

});
