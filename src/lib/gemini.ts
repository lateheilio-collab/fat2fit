import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not defined.");
}

export const ai = new GoogleGenAI({ apiKey });

// 1. Zod schema for Goal Interpretation
export const PerformanceTargetSchema = z.object({
  metric: z.string(),
  targetValue: z.string(),
  timeframe: z.string().optional(),
});

export const GoalInterpretationSchema = z.object({
  primaryObjective: z.enum([
    "weight_loss",
    "weight_maintenance",
    "muscle_gain",
    "body_recomposition",
    "fitness_improvement",
    "wellbeing_improvement",
    "custom",
  ]),
  primaryObjectiveLabel: z.string(),
  secondaryObjectives: z.array(z.string()),
  motivations: z.array(z.string()),
  constraints: z.array(z.string()),
  priorities: z.array(z.string()),
  
  startWeightKg: z.number().optional(),
  targetWeightKg: z.number().optional(),
  targetWeightMinKg: z.number().optional(),
  targetWeightMaxKg: z.number().optional(),
  
  startBodyFatPercentage: z.number().optional(),
  targetBodyFatPercentage: z.number().optional(),
  bodyFatDirection: z.enum(["decrease", "maintain", "increase"]).optional(),
  
  startMuscleMassKg: z.number().optional(),
  targetMuscleMassKg: z.number().optional(),
  muscleMassDirection: z.enum(["decrease", "maintain", "increase"]).optional(),
  
  targetWaistCm: z.number().optional(),
  targetDate: z.string().optional(), // YYYY-MM-DD
  
  desiredWeeklyExerciseCount: z.number().optional(),
  performanceTargets: z.array(PerformanceTargetSchema),
  
  suggestedPace: z.enum(["slow", "moderate", "fast", "not_applicable"]),
  interpretationConfidence: z.number(), // 0.0 to 1.0
  assumptions: z.array(z.string()),
  unresolvedQuestions: z.array(z.string()),
});

export type GoalInterpretation = z.infer<typeof GoalInterpretationSchema>;

// Helper to call Gemini for Goal Interpretation
export async function interpretUserGoal(
  userText: string,
  userDemographics: {
    birthYear?: number;
    heightCm?: number;
    currentWeightKg?: number;
    gender?: string;
  }
): Promise<GoalInterpretation> {
  const model = process.env.GEMINI_REASONING_MODEL || "gemini-1.5-pro";

  const systemInstruction = `
Sinä olet senior-tasoinen terveys-, ravinto- ja urheiluvalmentaja. Tehtäväsi on tulkita käyttäjän kirjoittama sanallinen tavoite rakenteelliseksi JSON-muodoksi.
Käytä apuna käyttäjän perustietoja (sukupuoli, ikä, pituus, paino) jos ne on annettu.

Säännöt tulkinnalle:
1. Päättele päätavoite (primaryObjective) annettujen vaihtoehtojen joukosta.
2. Arvioi tavoitepaino tai painoalue sekä muut kehonkoostumustavoitteet käyttäjän tekstistä. Jos niitä ei ole mainittu, mutta päätavoite on painonpudotus, ehdota maltillista ja turvallista pudotusta (esim. 0.5 kg per viikko) ja laske tavoitepaino sekä tavoitepäivämäärä tämän pohjalta.
3. Kirjaa ylös oletuksesi (assumptions) ja avoimet kysymykset (unresolvedQuestions), joihin käyttäjän tulisi vastata.
4. Älä tee oletuksia vaarallisista tai äärimmäisistä painonpudotustahdeista. Suositeltava tahti on 0.2 - 0.8 kg viikossa.
  `;

  const prompt = `
Käyttäjän sanallinen tavoite:
"${userText}"

Käyttäjän perustiedot:
- Syntymävuosi: ${userDemographics.birthYear || "Ei tiedossa"}
- Pituus: ${userDemographics.heightCm || "Ei tiedossa"} cm
- Nykyinen paino: ${userDemographics.currentWeightKg || "Ei tiedossa"} kg
- Sukupuoli/Profiili: ${userDemographics.gender || "Ei tiedossa"}
  `;

  // Define JSON Schema matching the Zod schema for Gemini API
  const responseSchema = {
    type: "OBJECT",
    properties: {
      primaryObjective: {
        type: "STRING",
        enum: [
          "weight_loss",
          "weight_maintenance",
          "muscle_gain",
          "body_recomposition",
          "fitness_improvement",
          "wellbeing_improvement",
          "custom"
        ]
      },
      primaryObjectiveLabel: { type: "STRING" },
      secondaryObjectives: { type: "ARRAY", items: { type: "STRING" } },
      motivations: { type: "ARRAY", items: { type: "STRING" } },
      constraints: { type: "ARRAY", items: { type: "STRING" } },
      priorities: { type: "ARRAY", items: { type: "STRING" } },
      startWeightKg: { type: "NUMBER" },
      targetWeightKg: { type: "NUMBER" },
      targetWeightMinKg: { type: "NUMBER" },
      targetWeightMaxKg: { type: "NUMBER" },
      startBodyFatPercentage: { type: "NUMBER" },
      targetBodyFatPercentage: { type: "NUMBER" },
      bodyFatDirection: { type: "STRING", enum: ["decrease", "maintain", "increase"] },
      startMuscleMassKg: { type: "NUMBER" },
      targetMuscleMassKg: { type: "NUMBER" },
      muscleMassDirection: { type: "STRING", enum: ["decrease", "maintain", "increase"] },
      targetWaistCm: { type: "NUMBER" },
      targetDate: { type: "STRING" },
      desiredWeeklyExerciseCount: { type: "INTEGER" },
      performanceTargets: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            metric: { type: "STRING" },
            targetValue: { type: "STRING" },
            timeframe: { type: "STRING" }
          },
          required: ["metric", "targetValue"]
        }
      },
      suggestedPace: { type: "STRING", enum: ["slow", "moderate", "fast", "not_applicable"] },
      interpretationConfidence: { type: "NUMBER" },
      assumptions: { type: "ARRAY", items: { type: "STRING" } },
      unresolvedQuestions: { type: "ARRAY", items: { type: "STRING" } }
    },
    required: [
      "primaryObjective",
      "primaryObjectiveLabel",
      "secondaryObjectives",
      "motivations",
      "constraints",
      "priorities",
      "performanceTargets",
      "suggestedPace",
      "interpretationConfidence",
      "assumptions",
      "unresolvedQuestions"
    ]
  };

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      // @ts-ignore: responseSchema type mismatch in SDK typings but fully supported by the API
      responseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned empty text response.");
  }

  const parsed = JSON.parse(text);
  return GoalInterpretationSchema.parse(parsed);
}

// 2. Zod schemas for Multimodal Meal Image Analysis
export const SuggestedFineliMatchSchema = z.object({
  fineliId: z.string(),
  name: z.string(),
  matchConfidence: z.number(),
});

export const MealItemAnalysisSchema = z.object({
  detectedName: z.string(),
  preparationMethod: z.string().optional(),
  estimatedGrams: z.number(),
  minimumGrams: z.number(),
  maximumGrams: z.number(),
  fineliSearchTerms: z.array(z.string()),
  suggestedFineliMatches: z.array(SuggestedFineliMatchSchema),
  visibleIngredients: z.array(z.string()),
  possibleHiddenIngredients: z.array(z.string()),
  confidence: z.number(),
  requiresConfirmation: z.boolean(),
  uncertaintyReasons: z.array(z.string()),
});

export const DetectedDrinkSchema = z.object({
  name: z.string(),
  estimatedMilliliters: z.number(),
  confidence: z.number(),
});

export const MealImageAnalysisSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "evening_snack", "other"]),
  capturedAt: z.string(),
  items: z.array(MealItemAnalysisSchema),
  detectedDrinks: z.array(DetectedDrinkSchema),
  unansweredQuestions: z.array(z.string()),
  overallConfidence: z.number(),
});

export type MealImageAnalysis = z.infer<typeof MealImageAnalysisSchema>;

// Helper to analyze meal images using Gemini Multimodal
export async function analyzeMealImage(
  base64ImageWithHeader: string, // data:image/jpeg;base64,...
  plateProfile?: {
    name: string;
    diameterCm?: number;
    volumeMl?: number;
  },
  userDescription?: string
): Promise<MealImageAnalysis> {
  const model = process.env.GEMINI_CHUNKY_MODEL || "gemini-1.5-flash";

  // Split header from raw base64 data
  const match = base64ImageWithHeader.match(/^data:([^;]+);base64,(.+)$/);
  let mimeType = "image/jpeg";
  let base64Data = base64ImageWithHeader;

  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const systemInstruction = `
Sinä olet senior-tasoinen terveys-, ravinto- ja ruoka-analyytikko. Tehtäväsi on analysoida käyttäjän lähettämä valokuva ateriasta ja muodostaa siitä tarkka arvio ainesosista, grammamääristä ja mahdollisista Fineli-hakusanoista.

Säännöt analyysille:
1. Tunnista kaikki valokuvassa näkyvät ruoka-aineet (items) ja juomat (detectedDrinks).
2. Arvioi kunkin ruoka-aineen grammamäärä. Koska valokuvasta arvioiminen sisältää aina epävarmuutta, määritä todennäköisimmän grammamäärän (estimatedGrams) lisäksi minimi (minimumGrams) ja maksimi (maximumGrams) vaihteluvälit.
3. Hyödynnä annettua astiaprofiilia (lautasprofiilia) koon arvioinnin apuna. Jos käyttäjä ilmoittaa lautasen koon olevan 27 cm, suhteuta ruoan tilavuus ja pinta-ala tähän halkaisijaan.
4. Tunnista mahdolliset piilossa olevat ainesosat (esim. kastikkeet, paistoöljy, voi puurossa).
5. Anna jokaiselle elintarvikkeelle suomenkieliset hakusanat (fineliSearchTerms) elintarviketietokannasta hakua varten (esim. ["kaurapuuro", "maito", "mansikka"]).
6. Ehdota parhaita Fineli-tunnisteita ja nimiä (suggestedFineliMatches), jos tiedossasi on yleisiä Fineli-vastineita.
7. Kirjaa ylös epävarmuustekijät (uncertaintyReasons) ja mahdolliset tarkentavat kysymykset käyttäjälle (unresolvedQuestions).
  `;

  let prompt = "Analysoi tämän kuvan ruoka-annos.";
  if (plateProfile) {
    prompt += `\nKäytetty lautanen/astia: ${plateProfile.name} ${
      plateProfile.diameterCm ? `(halkaisija ${plateProfile.diameterCm} cm)` : ""
    } ${plateProfile.volumeMl ? `(tilavuus ${plateProfile.volumeMl} ml)` : ""}.`;
  }
  if (userDescription) {
    prompt += `\nKäyttäjän lisäkuvaus: "${userDescription}".`;
  }

  const responseSchema = {
    type: "OBJECT",
    properties: {
      mealType: {
        type: "STRING",
        enum: ["breakfast", "lunch", "dinner", "snack", "evening_snack", "other"]
      },
      capturedAt: { type: "STRING" },
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            detectedName: { type: "STRING" },
            preparationMethod: { type: "STRING" },
            estimatedGrams: { type: "NUMBER" },
            minimumGrams: { type: "NUMBER" },
            maximumGrams: { type: "NUMBER" },
            fineliSearchTerms: { type: "ARRAY", items: { type: "STRING" } },
            suggestedFineliMatches: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  fineliId: { type: "STRING" },
                  name: { type: "STRING" },
                  matchConfidence: { type: "NUMBER" }
                },
                required: ["fineliId", "name", "matchConfidence"]
              }
            },
            visibleIngredients: { type: "ARRAY", items: { type: "STRING" } },
            possibleHiddenIngredients: { type: "ARRAY", items: { type: "STRING" } },
            confidence: { type: "NUMBER" },
            requiresConfirmation: { type: "BOOLEAN" },
            uncertaintyReasons: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: [
            "detectedName",
            "estimatedGrams",
            "minimumGrams",
            "maximumGrams",
            "fineliSearchTerms",
            "suggestedFineliMatches",
            "visibleIngredients",
            "possibleHiddenIngredients",
            "confidence",
            "requiresConfirmation",
            "uncertaintyReasons"
          ]
        }
      },
      detectedDrinks: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            estimatedMilliliters: { type: "NUMBER" },
            confidence: { type: "NUMBER" }
          },
          required: ["name", "estimatedMilliliters", "confidence"]
        }
      },
      unansweredQuestions: { type: "ARRAY", items: { type: "STRING" } },
      overallConfidence: { type: "NUMBER" }
    },
    required: [
      "mealType",
      "capturedAt",
      "items",
      "detectedDrinks",
      "unansweredQuestions",
      "overallConfidence"
    ]
  };

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
      prompt,
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      // @ts-ignore: responseSchema type mismatch in SDK typings but fully supported by the API
      responseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned empty text response.");
  }

  const parsed = JSON.parse(text);
  return MealImageAnalysisSchema.parse(parsed);
}

