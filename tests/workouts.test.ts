import { describe, it, expect } from "vitest";
import { validateWeeklyWorkoutPlan } from "../src/lib/calculations/planning";

describe("Kuntosaliohjelmien viikkosuunnittelulogiikka ja kuormitustarkastukset", () => {

  // Test 1: Ei raskasta kyykkyä peräkkäisinä päivinä
  it("Testi 1: Ei raskasta kyykkyä peräkkäisinä päivinä", () => {
    const workouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Kyykkypainotteinen jalkatreeni",
        intensity: "hard",
        description: {
          isStrength: true,
          warmup: { name: "Lämmittely", exercises: [{ name: "Kehonpainokyykky" }] }
        }
      },
      {
        date: "2026-07-14",
        activityType: "Kuntosali",
        title: "Kyykky ja etureidet",
        intensity: "hard",
        description: {
          isStrength: true,
          warmup: { name: "Lämmittely", exercises: [{ name: "Kehonpainokyykky" }] }
        }
      }
    ];

    const result = validateWeeklyWorkoutPlan(workouts, "keskitaso");
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("Raskas kyykkyliike suunniteltu peräkkäisille päiville"))).toBe(true);
  });

  // Test 2: Sama päälihasryhmä ei kuormitu raskaasti peräkkäin
  it("Testi 2: Sama päälihasryhmä ei kuormitu raskaasti peräkkäin", () => {
    const workouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Alavartalo - Voima",
        intensity: "hard",
        description: {
          isStrength: true,
          warmup: { name: "Alavartalon lämmittely", exercises: [{ name: "Lonkan avaukset" }] }
        }
      },
      {
        date: "2026-07-14",
        activityType: "Kuntosali",
        title: "Alakroppa - Takaketju",
        intensity: "hard",
        description: {
          isStrength: true,
          warmup: { name: "Takapakaran lämmittely", exercises: [{ name: "Pakarasillat" }] }
        }
      }
    ];

    const result = validateWeeklyWorkoutPlan(workouts, "keskitaso");
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("Sama päälihasryhmä (alavartalo) kuormittuu raskaasti"))).toBe(true);
  });

  // Test 3: Kolmen kuntosalipäivän viikko
  it("Testi 3: Kolmen kuntosalipäivän viikko", () => {
    const badWorkouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Kyykky",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Kyykky" }] } }
      },
      {
        date: "2026-07-15",
        activityType: "Kuntosali",
        title: "Lantiosarana",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Lantionnosto" }] } }
      },
      {
        date: "2026-07-17",
        activityType: "Kuntosali",
        title: "Askelkyykky",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Kyykky" }] } }
      }
    ];

    const badResult = validateWeeklyWorkoutPlan(badWorkouts, "keskitaso");
    expect(badResult.isValid).toBe(false);
    expect(badResult.errors.some(e => e.includes("Kolmen kuntosalipäivän viikossa ei tulisi olla vain alavartalotreeniä"))).toBe(true);

    const goodWorkouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Alavartalo",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Lonkan avaukset" }] } }
      },
      {
        date: "2026-07-15",
        activityType: "Kuntosali",
        title: "Ylävartalo",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Kiertäjäkalvosin" }] } }
      },
      {
        date: "2026-07-17",
        activityType: "Kuntosali",
        title: "Koko keho",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Soutu" }, { name: "Kyykky" }] } }
      }
    ];

    const goodResult = validateWeeklyWorkoutPlan(goodWorkouts, "keskitaso");
    expect(goodResult.isValid).toBe(true);
    expect(goodResult.errors.length).toBe(0);
  });

  // Test 4: Neljän kuntosalipäivän viikko
  it("Testi 4: Neljän kuntosalipäivän viikko", () => {
    const badWorkouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Ylävartalo työntö",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Kiertäjäkalvosin" }] } }
      },
      {
        date: "2026-07-14",
        activityType: "Kuntosali",
        title: "Ylävartalo veto",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Lapavedot" }] } }
      },
      {
        date: "2026-07-16",
        activityType: "Kuntosali",
        title: "Ylävartalo pumppi",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Olkapäät" }] } }
      },
      {
        date: "2026-07-17",
        activityType: "Kuntosali",
        title: "Ylävartalo kädet",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Olkapäät" }] } }
      }
    ];

    const badResult = validateWeeklyWorkoutPlan(badWorkouts, "keskitaso");
    expect(badResult.isValid).toBe(false);
    expect(badResult.errors.some(e => e.includes("Neljän kuntosalipäivän viikolla tulisi olla tasapainoinen ylävartalo/alavartalo-jako"))).toBe(true);

    const goodWorkouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Alavartalo A",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Lonkan avaukset" }] } }
      },
      {
        date: "2026-07-14",
        activityType: "Kuntosali",
        title: "Ylävartalo A",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Kiertäjäkalvosin" }] } }
      },
      {
        date: "2026-07-16",
        activityType: "Kuntosali",
        title: "Alavartalo B",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Nilkan liikkuvuus" }] } }
      },
      {
        date: "2026-07-17",
        activityType: "Kuntosali",
        title: "Ylävartalo B",
        intensity: "moderate",
        description: { isStrength: true, warmup: { name: "Lämmittely", exercises: [{ name: "Lapatyönnöt" }] } }
      }
    ];

    const goodResult = validateWeeklyWorkoutPlan(goodWorkouts, "keskitaso");
    expect(goodResult.isValid).toBe(true);
    expect(goodResult.errors.length).toBe(0);
  });

  // Test 5: Lämmittely alavartalopäivälle
  it("Testi 5: Lämmittely alavartalopäivälle", () => {
    const workouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Alavartalon voimatreeni",
        intensity: "moderate",
        description: {
          isStrength: true,
          warmup: {
            name: "Yläkropan pyörittelyt",
            purpose: "Lämmittää olkapäät",
            exercises: [{ name: "Käsien pyörittely" }]
          }
        }
      }
    ];

    const result = validateWeeklyWorkoutPlan(workouts, "keskitaso");
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("Alavartalotreenin 'Alavartalon voimatreeni' lämmittely ei sisällä alavartaloa valmistelevaa liikettä"))).toBe(true);
  });

  // Test 6: Lämmittely ylävartalopäivälle
  it("Testi 6: Lämmittely ylävartalopäivälle", () => {
    const workouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Ylävartalon penkkipunnerrus",
        intensity: "moderate",
        description: {
          isStrength: true,
          warmup: {
            name: "Polvien avaukset",
            purpose: "Polvien ja nilkkojen pyörittelyt",
            exercises: [{ name: "Polvipyörittely" }]
          }
        }
      }
    ];

    const result = validateWeeklyWorkoutPlan(workouts, "keskitaso");
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("Ylävartalotreenin 'Ylävartalon penkkipunnerrus' lämmittely ei sisällä ylävartaloa valmistelevaa liikettä"))).toBe(true);
  });

  // Test 7: Lämmittely näkyy käyttöliittymässä (tietomallitarkastus)
  it("Testi 7: Lämmittely näkyy käyttöliittymässä (tietomallitarkastus)", () => {
    const workouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Alavartalo kyykky",
        intensity: "moderate",
        description: {
          isStrength: true,
          warmup: {
            name: "Lämmittely, 8-12 min",
            durationMinutes: 10,
            purpose: "Valmistelee etureidet ja pakarat kyykkyyn",
            exercises: [
              { name: "Kuntopyörä", sets: 1, reps: "5 min", instructions: "Kevyt vauhti" }
            ]
          }
        }
      }
    ];

    const result = validateWeeklyWorkoutPlan(workouts, "keskitaso");
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  // Test 8: Käyttäjän taso huomioidaan
  it("Testi 8: Käyttäjän taso huomioidaan", () => {
    const workouts = [
      {
        date: "2026-07-13",
        activityType: "Kuntosali",
        title: "Koko keho perusliikkeet",
        intensity: "very_hard",
        description: {
          isStrength: true,
          warmup: {
            name: "Koko kehon lämmittely",
            exercises: [{ name: "Kuntopyörä" }, { name: "Käsien pyörittely" }]
          }
        }
      }
    ];

    const result = validateWeeklyWorkoutPlan(workouts, "aloittelija");
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("Aloittelijan viikko-ohjelma sisältää liian kuormittavan"))).toBe(true);
  });

});
