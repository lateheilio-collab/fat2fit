import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { ai } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    const model = process.env.GEMINI_REASONING_MODEL || "gemini-1.5-pro";

    const systemInstruction = `
Sinä olet senior-tasoinen terveys-, ravinto- ja urheiluvalmentaja, työnimeltäsi Fat2Fit Coach.
Tehtäväsi on ottaa uusi käyttäjä vastaan (onboarding) ja selvittää ystävällisen keskustelun kautta hänen lähtötietonsa ja tavoitteensa, jotta hänelle voidaan luoda yksilöllinen suunnitelma.

Keskustelun tavoitteena on selvittää seuraavat tiedot:
1. Käyttäjän kutsumanimi (displayName)
2. Sukupuoli/profiili (gender: male/female/other)
3. Syntymävuosi (birthYear), pituus (heightCm) ja nykyinen paino (currentWeightKg)
4. Tavoitteet (esim. painonpudotus/tavoitepaino tai kunnon kohottaminen) ja viikoittainen treenimäärä (weeklyExerciseCount)
5. Arjen rutiinit: nukkumaanmenoaika (bedTime) ja heräämisaika (wakeUpTime)
6. Valmennustyyli (coachingStyle: lempeä/suora/analyyttinen/tiivis)

Ohjeet vastaamiseen:
- Ole erittäin ystävällinen, asiantunteva ja kannustava.
- Esitä kysymyksiä luonnollisesti keskustelun edetessä. Älä kysy kaikkia kysymyksiä kerralla, vaan etene 1-2 kysymystä kerrallaan.
- Tunnista käyttäjän vastauksista nämä tiedot ja täytä ne parsedInfo-objektiin.
- Jos jokin tieto (esim. pituus tai paino) on jo mainittu aiemmin keskustelussa, täytä se parsedInfo-objektiin ja siirry eteenpäin muihin kysymyksiin.
- Kun kaikki tiedot on kerätty ja parsedInfo on täydellinen, toivota käyttäjä lämpimästi tervetulleeksi ja kerro, että profiili on valmis tallennettavaksi alhaalta!
`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        reply: {
          type: "STRING",
          description: "Valmentajan ystävällinen ja asiantunteva vastaus sekä jatkokysymykset suomeksi."
        },
        parsedInfo: {
          type: "OBJECT",
          description: "Keskustelusta tähän mennessä poimitut käyttäjän tiedot. Aseta arvot vain jos ne on selvästi mainittu tai jos voit luotettavasti päätellä ne.",
          properties: {
            displayName: { type: "STRING" },
            birthYear: { type: "INTEGER" },
            heightCm: { type: "INTEGER" },
            currentWeightKg: { type: "NUMBER" },
            gender: { type: "STRING", enum: ["male", "female", "other"] },
            targetWeightKg: { type: "NUMBER" },
            weeklyExerciseCount: { type: "INTEGER" },
            wakeUpTime: { type: "STRING", description: "Heräämisaika muodossa HH:MM" },
            bedTime: { type: "STRING", description: "Nukkumaanmenoaika muodossa HH:MM" },
            coachingStyle: { 
              type: "ARRAY", 
              items: { type: "STRING", enum: ["lempeä", "suora", "analyyttinen", "tiivis"] } 
            },
            primaryObjective: { type: "STRING", enum: ["weight_loss", "weight_maintenance", "muscle_gain", "fitness_improvement"] },
            targetDate: { type: "STRING", description: "Tavoitteen saavuttamisen arvioitu päivämäärä muodossa YYYY-MM-DD. Esim. 3 kuukauden päähän aloituksesta." }
          }
        }
      },
      required: ["reply", "parsedInfo"]
    };

    // Format contents for Gemini SDK
    const contents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Tyhjä vastaus tekoälyltä.");
    }

    const parsedJson = JSON.parse(resultText);
    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error("Error in onboarding chat API:", error);
    return NextResponse.json({ error: error.message || "Virhe tekoälykeskustelussa." }, { status: 500 });
  }
}
