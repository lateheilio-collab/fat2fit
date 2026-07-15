import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { ai } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const { workoutId } = await request.json();
    if (!workoutId) {
      return NextResponse.json({ error: "workoutId on pakollinen" }, { status: 400 });
    }

    // 3. Fetch planned workout details
    const { data: workout, error: fetchErr } = await supabase
      .from("planned_workouts")
      .select("*")
      .eq("id", workoutId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !workout) {
      return NextResponse.json({ error: "Harjoitusta ei löytynyt." }, { status: 404 });
    }

    // 3.5 Check if it is a strength workout
    const isStrengthWorkout = 
      workout.activity_type.toLowerCase().includes("kuntosali") ||
      workout.activity_type.toLowerCase().includes("lihaskunto") ||
      workout.activity_type.toLowerCase().includes("strength") ||
      workout.activity_type.toLowerCase().includes("voimaharjoittelu") ||
      workout.title.toLowerCase().includes("alakroppa") ||
      workout.title.toLowerCase().includes("yläkroppa") ||
      workout.title.toLowerCase().includes("kokovartalo") ||
      workout.title.toLowerCase().includes("voima");

    // Fetch past completed strength workouts to extract exercise logs
    const pastLogs: any[] = [];
    if (isStrengthWorkout) {
      const { data: pastCompletedWorkouts } = await supabase
        .from("planned_workouts")
        .select("description, date")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(10);

      if (pastCompletedWorkouts) {
        pastCompletedWorkouts.forEach(w => {
          if (w.description && w.description.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(w.description);
              if (parsed.isStrength && parsed.exercises) {
                pastLogs.push({
                  date: w.date,
                  exercises: parsed.exercises.map((ex: any) => ({
                    name: ex.name,
                    sets: (ex.sets || []).map((s: any) => ({
                      setNum: s.setNum,
                      suggestedWeight: s.suggestedWeight,
                      actualWeight: s.actualWeight,
                      actualReps: s.actualReps,
                      completed: s.completed
                    }))
                  }))
                });
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        });
      }
    }

    // 4. Generate instructions using Gemini 2.5 Flash
    let prompt = "";
    if (isStrengthWorkout) {
      prompt = `
Olet Fat2Fit Coach -tekoälyvalmentaja. Luo kuntosaliharjoitus (kuntosaliohjelma) käyttäjälle (paino 86,3 kg, mies).
Treenin tiedot:
- Otsikko: ${workout.title}
- Arvioitu kesto: ${workout.duration_minutes} minuuttia
- Tavoiterasitus: ${workout.intensity}

Käyttäjän kuntosalihistoria (aiemmat toteutuneet painot ja toistot):
${JSON.stringify(pastLogs, null, 2)}

Tehtäväsi on luoda kuntosaliohjelma, joka koostuu 4-8 eri liikkeestä. Jokaiselle liikkeelle tulee ehdottaa sarjamääriä (esim. 3-5 sarjaa), kohdetoistomääriä (esim. "6-10", "12" tai "8-12") ja sopivaa ehdotettua painomäärää (suggestedWeight) kullekin sarjalle.

Käytä progressiivisen ylikuormituksen (progressive overload) periaatetta painojen ehdottamisessa:
1. Katso käyttäjän kuntosalihistoriasta, onko hän tehnyt saman nimistä liikettä aiemmin.
2. Jos käyttäjä teki viimeksi kaikki ehdotetut toistot sarjoissa (esim. teki 4 sarjaa x 12 toistoa painolla 58 kg): Ehdota tähän treeniin korotettua painoa (+1.25 kg - +2.5 kg käsipainoille, +2.5 kg - +5 kg laitteille tai tangoille).
3. Jos toistot tai sarjat jäivät edellisellä kerralla vajaaksi tai treeni epäonnistui: Ehdota samaa painoa kuin viimeksi.
4. Jos liikettä ei löydy historiasta, ehdota turvallista ja järkevää aloituspainoa (esim. penkkipunnerrus käsipainoilla: 15-20 kg per käsi, kyykky: 40-50 kg, pystypunnerrus käsipainoilla: 10-15 kg per käsi, hauiskääntö käsipainoilla: 7.5-10 kg, pushdown: 25-35 kg, alatalja: 40-50 kg) olettaen että kyseessä on 86,3 kg painoinen mies, tai aseta nollaksi/null kehonpainoliikkeille tai jos et ole varma.

Palaa ainoastaan validina JSON-muotoisena objektina, joka vastaa täsmällisesti seuraavaa rakennetta. Älä lisää mitään selittävää tekstiä, markdown-merkintöjä tai koodilohkoja ennen tai jälkeen JSON-objektin.
Luo kuntosaliharjoitukselle myös sen päälihasryhmiä tukeva alkulämmittelyosion tiedot (esim. alavartalolle kuntopyörä + kehonpainokyykyt + lonkanavaukset, ylävartalolle soutulaite + lapalämmittelyt + ulkokierrot):

{
  "isStrength": true,
  "durationMinutes": ${workout.duration_minutes},
  "warmup": {
    "name": "Lämmittely alavartalolle, 8-12 min",
    "durationMinutes": 10,
    "purpose": "Valmistelee lonkat, polvet ja kohdelihakset kyykkyliikkeisiin.",
    "exercises": [
      { "name": "Kuntopyörä", "sets": 1, "reps": "5 min", "instructions": "Kevyt nousujohteinen tahti." },
      { "name": "Kehonpainokyykky", "sets": 2, "reps": "10", "instructions": "Rauhallinen tempo, keskity polvilinjojen hallintaan." }
    ]
  },
  "exercises": [
    {
      "name": "Pystypunnerrus Smith-laitteessa",
      "instruction": "Aseta penkki lähes pystyyn. Työnnä tanko pään yläpuolelle pitäen kyynärpäät osoittamassa hieman etuviistoon. Laske hitaasti takaisin lähtöasentoon.",
      "targetSets": 5,
      "targetReps": "6-10",
      "sets": [
        { "setNum": 1, "suggestedWeight": 45, "actualWeight": null, "actualReps": null, "completed": false },
        { "setNum": 2, "suggestedWeight": 45, "actualWeight": null, "actualReps": null, "completed": false },
        { "setNum": 3, "suggestedWeight": 45, "actualWeight": null, "actualReps": null, "completed": false },
        { "setNum": 4, "suggestedWeight": 45, "actualWeight": null, "actualReps": null, "completed": false },
        { "setNum": 5, "suggestedWeight": 45, "actualWeight": null, "actualReps": null, "completed": false }
      ]
    }
  ]
}
      `;
    } else {
      prompt = `
Olet Fat2Fit Coach -tekoälyvalmentaja. Luo selkeä, jäsennelty ja erittäin tiivis suoritusohje seuraavalle harjoitukselle:
- Harjoitustyyppi: ${workout.activity_type}
- Otsikko: ${workout.title}
- Suunniteltu kesto: ${workout.duration_minutes} minuuttia
- Rasitustaso: ${workout.intensity}

Kirjoita ohje suomeksi. Noudata seuraavia tärkeitä sääntöjä:
1. Jäsennä ohje selkeisiin, loogisiin vaiheisiin:
   - Lämmittely (Warm-up)
   - Työosuus (Main Workout)
   - Jäähdyttely (Cool-down)
2. ÄLÄ käytä mitään kannustavia lauseita, kehuja tai tyhjää small-talkia (esim. EI lauseita kuten "Hienoa työtä!", "Olen ylpeä sinusta", "Olet suoriutunut upeasti"). Keskity puhtaasti siihen, mitä käyttäjän pitää tehdä.
3. Kirjoita ohjeet ajatuksella, että treenaaja lukee ohjeen ENNEN suoritusta ja lähtee sitten tekemään sitä. Älä oleta tai kehu suorituksen suorittamisesta ohjeen sisällä (esim. älä sano "Olet suoriutunut aerobisesta lenkistäsi upeasti"), vaan anna suorat toimintaohjeet (esim. "Juoksun jälkeen kävele kevyesti...").
4. Pidä teksti mahdollisimman vähäsanaisenä, helposti puhelimen näytöltä muistettavana ja selkeänä listana.
5. Älä käytä monimutkaista markdownia (käytä vain viivoja, otsikoita ja selkeitä rivinvaihtoja).
      `;
    }

    const modelName = process.env.GEMINI_CHUNKY_MODEL || "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: isStrengthWorkout ? { responseMimeType: "application/json" } : undefined
    });

    let instructions = response.text || (isStrengthWorkout ? "{}" : "Valitettavasti ohjeiden luominen epäonnistui.");

    // Clean up markdown block wraps if Gemini wraps json in ```json ... ```
    if (isStrengthWorkout) {
      instructions = instructions.trim();
      if (instructions.startsWith("```")) {
        instructions = instructions.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
    }

    // 5. Save back to the planned_workouts table (updates the description column)
    const { error: updateErr } = await supabase
      .from("planned_workouts")
      .update({ description: instructions })
      .eq("id", workoutId)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("Error updating description column. Ensure you run the SQL migration to add 'description' to 'planned_workouts'.", updateErr);
      return NextResponse.json({ 
        description: instructions,
        warning: "Ohjeet generoitiin, mutta niitä ei voitu tallentaa tietokantaan. Varmista, että olet lisännyt 'description'-sarakkeen planned_workouts-tauluun." 
      });
    }

    return NextResponse.json({ description: instructions });
  } catch (error: any) {
    console.error("Error generating workout instructions:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe ohjeiden luonnissa." },
      { status: 500 }
    );
  }
}
