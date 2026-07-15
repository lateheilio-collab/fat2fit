export type SubjectiveCheckIn = {
  sleepHours?: number;
  sleepQuality?: number; // 1-5
  energyLevel?: number; // 1-5
  stressLevel?: number; // 1-5
  sorenessLevel?: number; // 1-5
};

export type PlannedWorkout = {
  id: string;
  date: string;
  activityType: string;
  title: string;
  durationMinutes: number;
  intensity: "recovery" | "easy" | "moderate" | "hard" | "very_hard";
  status: string;
};

export type AdjustmentProposal = {
  workoutId: string;
  workoutTitle: string;
  action: "modify" | "skip" | "move";
  reasonCode: string;
  reasonText: string;
  changes: {
    durationMinutes?: number;
    intensity?: "recovery" | "easy" | "moderate" | "hard" | "very_hard";
    date?: string;
    status?: string;
  };
};

/**
 * Calculates adaptive plan changes for the next 72 hours based on subjective check-in data.
 */
export function calculatePlanAdaptations(
  checkIn: SubjectiveCheckIn,
  upcomingWorkouts: PlannedWorkout[]
): AdjustmentProposal[] {
  const proposals: AdjustmentProposal[] = [];

  // 1. Check for bad sleep + low energy
  const isSleepDeprived = checkIn.sleepHours !== undefined && checkIn.sleepHours < 6.0;
  const isEnergyLow = checkIn.energyLevel !== undefined && checkIn.energyLevel <= 2;

  if (isSleepDeprived || isEnergyLow) {
    // Find hard workouts in the list
    upcomingWorkouts.forEach((workout) => {
      if (workout.status === "planned" && (workout.intensity === "hard" || workout.intensity === "very_hard")) {
        proposals.push({
          workoutId: workout.id,
          workoutTitle: workout.title,
          action: "modify",
          reasonCode: isSleepDeprived ? "LOW_SLEEP" : "LOW_ENERGY",
          reasonText: `Nukuit vain ${checkIn.sleepHours || "vähän"} tuntia ja energiatasosi on matala. Kevennetään tämän päivän kovaa treeniä palautumisesi optimoimiseksi.`,
          changes: {
            durationMinutes: Math.round(workout.durationMinutes * 0.6), // Reduce duration by 40%
            intensity: "easy", // Change intensity to easy
          },
        });
      }
    });
  }

  // 2. Check for high muscle soreness
  const isSorenessHigh = checkIn.sorenessLevel !== undefined && checkIn.sorenessLevel >= 4;
  if (isSorenessHigh && proposals.length === 0) {
    upcomingWorkouts.forEach((workout) => {
      // If it's a strenuous workout (moderate/hard)
      if (workout.status === "planned" && (workout.intensity === "moderate" || workout.intensity === "hard")) {
        proposals.push({
          workoutId: workout.id,
          workoutTitle: workout.title,
          action: "modify",
          reasonCode: "HIGH_SORENESS",
          reasonText: "Lihasarkuutesi on korkea. Vaihdetaan päivän harjoitus palauttavaksi ja huolletaan kehoa.",
          changes: {
            durationMinutes: Math.min(workout.durationMinutes, 30),
            intensity: "recovery",
          },
        });
      }
    });
  }

  return proposals;
}

export type WorkoutValidationResult = {
  isValid: boolean;
  errors: string[];
};

function isLowerBodyWorkout(title: string): boolean {
  const t = title.toLowerCase();
  const lowerKeywords = ["ala", "jalka", "kyykky", "maastaveto", "lower", "lantio", "sarana", "pakara", "takaketju", "takareisi", "hip", "hinge", "glute", "hamstring"];
  return lowerKeywords.some(kw => t.includes(kw));
}

function isUpperBodyWorkout(title: string): boolean {
  const t = title.toLowerCase();
  const upperKeywords = ["ylä", "rinta", "selkä", "penkki", "pysty", "hartia", "olka", "upper", "chest", "back", "press", "row", "shoulder", "arm", "hauis", "ojentaja", "veto", "työntö"];
  return upperKeywords.some(kw => t.includes(kw));
}

function isFullBodyWorkout(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("koko keho") || t.includes("koko vartalo") || t.includes("full body");
}

export function validateWeeklyWorkoutPlan(
  workouts: {
    date: string;
    activityType: string;
    title: string;
    intensity: string;
    description?: any; // parsed JSON
  }[],
  userFitnessLevel: "aloittelija" | "keskitaso" | "kokenut"
): WorkoutValidationResult {
  const errors: string[] = [];
  
  // Sort workouts by date
  const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  
  // Rule 1 & 2: No heavy squats or lower body on consecutive days
  for (let i = 0; i < sortedWorkouts.length - 1; i++) {
    const w1 = sortedWorkouts[i];
    const w2 = sortedWorkouts[i + 1];
    
    const d1 = new Date(w1.date);
    const d2 = new Date(w2.date);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      const isStrength1 = w1.activityType.toLowerCase().includes("sali") || w1.activityType.toLowerCase().includes("lihaskunto") || w1.activityType.toLowerCase().includes("strength") || w1.activityType.toLowerCase().includes("voima");
      const isStrength2 = w2.activityType.toLowerCase().includes("sali") || w2.activityType.toLowerCase().includes("lihaskunto") || w2.activityType.toLowerCase().includes("strength") || w2.activityType.toLowerCase().includes("voima");
      
      if (isStrength1 && isStrength2) {
        const title1 = w1.title.toLowerCase();
        const title2 = w2.title.toLowerCase();
        
        // Check for consecutive heavy squats
        if (title1.includes("kyykky") && title2.includes("kyykky")) {
          errors.push(`Raskas kyykkyliike suunniteltu peräkkäisille päiville (${w1.date} ja ${w2.date}).`);
        }
        
        // Check for consecutive heavy lower body
        const isLower1 = isLowerBodyWorkout(w1.title);
        const isLower2 = isLowerBodyWorkout(w2.title);
        
        if (isLower1 && isLower2 && (w1.intensity === "hard" || w1.intensity === "very_hard" || w2.intensity === "hard" || w2.intensity === "very_hard")) {
          errors.push(`Sama päälihasryhmä (alavartalo) kuormittuu raskaasti peräkkäisinä päivinä (${w1.date} ja ${w2.date}).`);
        }
      }
    }
  }
  
  // Rule 3 & 4: Workout split matching workout count.
  const strengthWorkouts = sortedWorkouts.filter(w => {
    const act = w.activityType.toLowerCase();
    return act.includes("sali") || act.includes("lihaskunto") || act.includes("strength") || act.includes("voima");
  });
  
  if (strengthWorkouts.length === 3) {
    const lowerBodyOnlyCount = strengthWorkouts.filter(w => isLowerBodyWorkout(w.title) && !isUpperBodyWorkout(w.title) && !isFullBodyWorkout(w.title)).length;
    if (lowerBodyOnlyCount === 3) {
      errors.push("Kolmen kuntosalipäivän viikossa ei tulisi olla vain alavartalotreeniä; treenit tulisi jakaa tasapainoisesti (koko keho tai ylä/ala-jako).");
    }
  }

  if (strengthWorkouts.length === 4) {
    const lowerCount = strengthWorkouts.filter(w => isLowerBodyWorkout(w.title) || isFullBodyWorkout(w.title)).length;
    const upperCount = strengthWorkouts.filter(w => isUpperBodyWorkout(w.title) || isFullBodyWorkout(w.title)).length;
    if (lowerCount === 0 || upperCount === 0) {
      errors.push("Neljän kuntosalipäivän viikolla tulisi olla tasapainoinen ylävartalo/alavartalo-jako.");
    }
  }

  // Rule 7 & 8: Check if user fitness level is respected.
  if (userFitnessLevel === "aloittelija") {
    const tooHard = strengthWorkouts.filter(w => w.intensity === "very_hard");
    if (tooHard.length > 0) {
      errors.push("Aloittelijan viikko-ohjelma sisältää liian kuormittavan (very_hard) harjoituksen.");
    }
  }
  
  // Warmup checks: each strength workout description must contain a warmup section supporting its muscle focus.
  strengthWorkouts.forEach(w => {
    if (w.description) {
      const parsed = typeof w.description === "string" ? JSON.parse(w.description) : w.description;
      if (!parsed.warmup) {
        errors.push(`Kuntosaliharjoituksesta '${w.title}' (${w.date}) puuttuu lämmittelyosio.`);
      } else {
        const warmup = parsed.warmup;
        if (!warmup.name || !warmup.exercises || !Array.isArray(warmup.exercises) || warmup.exercises.length === 0) {
          errors.push(`Kuntosaliharjoituksen '${w.title}' lämmittelyosio on puutteellinen.`);
        }
        
        const titleLower = w.title.toLowerCase();
        const warmupDesc = (warmup.purpose || "") + " " + (warmup.name || "") + " " + warmup.exercises.map((e: any) => e.name).join(" ");
        const warmupLower = warmupDesc.toLowerCase();
        
        if (isLowerBodyWorkout(w.title)) {
          const legWarmups = ["kyykky", "lonkka", "lonka", "pyörä", "nilkka", "nilka", "pakar", "hip", "squat", "bike", "leg", "kävely", "matto", "polvi", "polve"];
          const hasLegWarmup = legWarmups.some(m => warmupLower.includes(m));
          if (!hasLegWarmup) {
            errors.push(`Alavartalotreenin '${w.title}' lämmittely ei sisällä alavartaloa valmistelevaa liikettä.`);
          }
        }
        
        if (isUpperBodyWorkout(w.title)) {
          const armWarmups = ["soutu", "lapa", "kiert", "olka", "puna", "face pull", "row", "scapula", "shoulder", "arm", "pushup", "chest", "rinta", "penkki", "pysty"];
          const hasArmWarmup = armWarmups.some(m => warmupLower.includes(m));
          if (!hasArmWarmup) {
            errors.push(`Ylävartalotreenin '${w.title}' lämmittely ei sisällä ylävartaloa valmistelevaa liikettä.`);
          }
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
