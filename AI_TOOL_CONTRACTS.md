# AI_TOOL_CONTRACTS.md: AI Tool Contracts (Työkalukutsut)

Tämä dokumentti määrittelee chatbotin (AI Coach) käytössä olevien työkalujen (Function Calling) rajapinnat ja parametrit TypeScript-tyyppeinä.

## 1. Lukutyökalut (Read Tools)

### `getUserProfile`
Hakee kirjautuneen käyttäjän perustiedot ja asetukset.
* **Parametrit**: Ei ole.
* **Paluuarvo**:
  ```ts
  type UserProfileResult = {
    id: string;
    displayName: string;
    birthYear: number;
    heightCm: number;
    gender: string;
    timezone: string;
    coachingStyle: string[];
    nutritionStyle: string;
  }
  ```

### `getActiveGoals`
Hakee käyttäjän tämänhetkiset aktiiviset tavoitteet ja tavoiteversion.
* **Parametrit**: Ei ole.
* **Paluuarvo**:
  ```ts
  type ActiveGoalsResult = {
    goalId: string;
    primaryObjective: string;
    primaryObjectiveLabel: string;
    targetWeightKg?: number;
    targetBodyFatPercentage?: number;
    targetMuscleMassKg?: number;
    targetDate?: string;
    weeklyExerciseCountTarget?: number;
  }
  ```

### `getTodaySummary`
Hakee koonnin tämän päivän toteumista (kalorit, makrot, treenit, uni).
* **Parametrit**: Ei ole.
* **Paluuarvo**:
  ```ts
  type TodaySummaryResult = {
    date: string;
    weightKg?: number;
    caloriesTarget: number;
    caloriesConsumed: number;
    proteinTargetG: number;
    proteinConsumedG: number;
    carbsTargetG: number;
    carbsConsumedG: number;
    fatTargetG: number;
    fatConsumedG: number;
    plannedWorkouts: Array<{ id: string; title: string; duration: number; status: string }>;
    completedWorkouts: Array<{ id: string; title: string; duration: number }>;
  }
  ```

### `getWeightTrend`
Hakee painotiedot trendianalyysiä varten.
* **Parametrit**:
  - `days` (number, default: 30) - Päivien lukumäärä.
* **Paluuarvo**:
  ```ts
  type WeightTrendResult = {
    latestRawWeightKg?: number;
    latest7DayAverageKg?: number;
    latest14DayAverageKg?: number;
    trendDirection: "decrease" | "increase" | "maintain";
    measurements: Array<{ date: string; value: number; is7DayAverage: boolean }>;
  }
  ```

### `searchFineliFoods`
Etsii elintarvikkeita sovelluksen omasta Fineli-kannasta.
* **Parametrit**:
  - `query` (string) - Hakusana.
  - `limit` (number, default: 5) - Tulosten maksimimäärä.
* **Paluuarvo**:
  ```ts
  type FoodSearchResult = Array<{
    id: string;
    name: string;
    energyKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
  }>
  ```

---

## 2. Kirjoitustyökalut (Write Tools)

### `logBodyMeasurement`
Tallentaa painon, rasvaprosentin tai muun kehonkoostumusmittauksen.
* **Parametrit**:
  - `metric` (string: "weight" | "body_fat_pct" | "muscle_mass_kg" | "waist_cm")
  - `value` (number) - Mittaustulos.
  - `measuredAt` (string, ISO-8601 UTC) - Vapaaehtoinen mittausaika (oletus: nyt).
* **Paluuarvo**: `{ success: boolean; measurementId: string; normalizedValue: number }`

### `logMorningCheckIn`
Kirjaa aamukirjauksen subjektiiviset tilat.
* **Parametrit**:
  - `sleepHours` (number)
  - `sleepQuality` (number, 1-5)
  - `energyLevel` (number, 1-5)
  - `stressLevel` (number, 1-5)
  - `sorenessLevel` (number, 1-5)
* **Paluuarvo**: `{ success: boolean; checkInId: string }`

### `createMealDraftFromText`
Luo vapaamuotoisesta tekstistä ehdotuksen ateriaksi.
* **Parametrit**:
  - `text` (string) - Esim. "söin kaurapuuroa 100g ja maitolasin 2dl".
  - `mealType` (string: "breakfast" | "lunch" | "dinner" | "snack")
* **Paluuarvo**:
  ```ts
  type MealDraftResult = {
    draftId: string;
    mealType: string;
    items: Array<{
      foodName: string;
      amountG: number;
      estimatedEnergyKcal: number;
      suggestedFineliId?: string;
    }>;
    requiresConfirmation: boolean;
  }
  ```

### `confirmMeal`
Vahvistaa ateriayhteenvedon ja tallentaa sen virallisesti tietokantaan.
* **Parametrit**:
  - `draftId` (string)
* **Paluuarvo**: `{ success: boolean; mealId: string }`

### `createPlanAdjustmentProposal`
Luo ehdotuksen 72h suunnitelman mukautuksesta.
* **Parametrit**:
  - `reasonCode` (string: "LOW_SLEEP" | "HIGH_SORENESS" | "MISSED_WORKOUT" | "USER_REQUEST")
  - `description` (text) - Perustelu käyttäjälle.
  - `modifications` (Array<{ plannedWorkoutId: string; action: "modify" | "skip" | "move"; newDuration?: number; newIntensity?: string }>)
* **Paluuarvo**: `{ proposalId: string; details: string }`

### `applyPlanAdjustment`
Oikaisee ja ottaa käyttöön ehdotetun mukautuksen.
* **Parametrit**:
  - `proposalId` (string)
* **Paluuarvo**: `{ success: boolean; appliedAdjustmentId: string }`

### `undoLastUserAction`
Peruuttaa edellisen käyttäjän tai valmentajan tekemän kirjoitustoiminnon.
* **Parametrit**: Ei ole.
* **Paluuarvo**: `{ success: boolean; message: string }`
