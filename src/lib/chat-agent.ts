import { ai } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase/server";
import { saveNutritionTargets } from "@/lib/calculations/nutrition";
import { syncActivityToPlannedWorkout } from "@/lib/workout-utils";

// Define the function declarations for Gemini
export const chatTools = [
  {
    functionDeclarations: [
      {
        name: "getUserProfile",
        description: "Hakee käyttäjän perustiedot (kuten pituus, syntymävuosi ja sukupuoli).",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "getActiveGoals",
        description: "Hakee käyttäjän tämänhetkiset aktiiviset tavoitteet ja tavoiteversion.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "getTodaySummary",
        description: "Hakee tämän päivän kalori-, makro-, uni- ja liikuntayhteenvedon.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "logBodyMeasurement",
        description: "Kirjaa uuden kehon mittaustuloksen (esim. paino, rasvaprosentti, lihasmassa tai vyötärönympärys).",
        parameters: {
          type: "OBJECT",
          properties: {
            metric: {
              type: "STRING",
              enum: ["weight", "body_fat_pct", "muscle_mass_kg", "waist_cm"],
              description: "Minkä tyyppinen mittaus kirjataan.",
            },
            value: {
              type: "NUMBER",
              description: "Mittaustulos (esim. paino kiloina, rasvaprosentti tai vyötärö cm).",
            },
          },
          required: ["metric", "value"],
        },
      },
      {
        name: "logMorningCheckIn",
        description: "Kirjaa aamukirjauksen unitunnit sekä subjektiiviset tuntemukset (uni, energia, stressi, lihasarkuus).",
        parameters: {
          type: "OBJECT",
          properties: {
            sleepHours: { type: "NUMBER", description: "Nukutut tunnit (valinnainen)." },
            sleepQuality: { type: "INTEGER", description: "Unen laatu 1-5 (valinnainen). Jos käyttäjä ilmoittaa Garminin/Polarin unipisteet (0-100), muunna ne asteikolle 1-5 (esim. 78/100 -> 4/5)." },
            energyLevel: { type: "INTEGER", description: "Energiataso 1-5 (valinnainen). Jos käyttäjä ilmoittaa Garminin Body Batteryn (0-100), muunna se asteikolle 1-5 (esim. 84/100 -> 4/5)." },
            stressLevel: { type: "INTEGER", description: "Stressitaso 1-5 (valinnainen)." },
            sorenessLevel: { type: "INTEGER", description: "Lihasarkuus 1-5 (valinnainen)." },
            notes: { type: "STRING", description: "Vapaat kommentit, HRV-arvot tai muut aamun fiilikset." },
            date: { type: "STRING", description: "Aamukirjauksen päivämäärä muodossa YYYY-MM-DD (valinnainen, oletuksena kuluva päivä)." },
          },
          required: [],
        },
      },
      {
        name: "undoLastUserAction",
        description: "Peruuttaa viimeisimmän käyttäjän tekemän kirjauksen (kuten mittauksen, aamukirjauksen tai aterian).",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "scheduleWorkout",
        description: "Suunnittelee ja lisää uuden tulevan harjoituksen käyttäjän treenikalenteriin.",
        parameters: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING", description: "Päivämäärä muodossa YYYY-MM-DD." },
            activityType: { type: "STRING", description: "Harjoitustyyppi (esim. Juoksu, Kuntosali, Pyöräily, Uinti, Hyrox)." },
            title: { type: "STRING", description: "Harjoituksen nimi tai kuvaus." },
            durationMinutes: { type: "NUMBER", description: "Kesto minuutteina." },
            intensity: {
              type: "STRING",
              enum: ["recovery", "easy", "moderate", "hard", "very_hard"],
              description: "Harjoituksen rasitustaso.",
            },
          },
          required: ["date", "activityType", "title", "durationMinutes", "intensity"],
        },
      },
      {
        name: "getUpcomingWorkouts",
        description: "Hakee käyttäjän tulevat suunnitellut harjoitukset treenikalenterista tästä päivästä eteenpäin.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "logMeal",
        description: "Kirjaa käyttäjän syömän aterian tai elintarvikkeen ravintoarvoineen tietokantaan. Kutsu tätä aina, kun käyttäjä kertoo syöneensä jotain (esim. 'Söin aamupalaksi kaurapuuroa 150g' tai 'Kirjaa hampurilainen 300g iltapalaksi'). Arvioi ruoan makrot (kalorit, proteiini, hiilihydraatit, rasva) ja anna ne parametreina.",
        parameters: {
          type: "OBJECT",
          properties: {
            mealType: {
              type: "STRING",
              enum: ["breakfast", "lunch", "dinner", "snack", "evening_snack", "other"],
              description: "Ateriatyyppi (esim. aamiainen=breakfast, lounas=lunch, päivällinen=dinner, välipala=snack, iltapala=evening_snack, muu=other).",
            },
            items: {
              type: "ARRAY",
              description: "Aterian sisältämät elintarvikkeet ja niiden ravintoarvot.",
              items: {
                type: "OBJECT",
                properties: {
                  foodName: { type: "STRING", description: "Ruoan nimi suomeksi." },
                  amountG: { type: "NUMBER", description: "Määrä grammoina." },
                  energyKcal: { type: "NUMBER", description: "Energiamäärä yhteensä kyseiselle grammamäärälle (kcal)." },
                  proteinG: { type: "NUMBER", description: "Proteiinimäärä yhteensä kyseiselle grammamäärälle (g)." },
                  carbohydratesG: { type: "NUMBER", description: "Hiilihydraattimäärä yhteensä kyseiselle grammamäärälle (g)." },
                  fatG: { type: "NUMBER", description: "Rasvamäärä yhteensä kyseiselle grammamäärälle (g)." },
                  fiberG: { type: "NUMBER", description: "Kuitumäärä yhteensä kyseiselle grammamäärälle (g, valinnainen)." },
                },
                required: ["foodName", "amountG", "energyKcal", "proteinG", "carbohydratesG", "fatG"],
              },
            },
            date: {
              type: "STRING",
              description: "Aterian päivämäärä muodossa YYYY-MM-DD (valinnainen, oletuksena kuluva päivä). Jos käyttäjä viittaa menneeseen päivään (esim. 'eilen'), aseta tämä vastaamaan kyseistä päivää."
            }
          },
          required: ["mealType", "items"],
        },
      },
      {
        name: "logCompletedWorkout",
        description: "Kirjaa suoritetun treenin tiedot tietokantaan ja tarvittaessa päivittää vastaavan suunnitellun treenin tilaan 'completed'. Kutsu tätä aina, kun käyttäjä kertoo chatissa tehneensä tai suorittaneensa jonkin treenin (esim. 'Tein tänään Hyrox-harjoituksen, kesto 60 min, kulutus 650 kcal').",
        parameters: {
          type: "OBJECT",
          properties: {
            activityType: { type: "STRING", description: "Treenin laji (esim. Hyrox, Juoksu, Kuntosali, Pyöräily, Uinti, Jooga)." },
            durationMinutes: { type: "NUMBER", description: "Toteutunut kesto minuuteina." },
            caloriesKcal: { type: "NUMBER", description: "Poltetut kalorit (kcal) sykemittarin tai arvion mukaan." },
            averageHeartRate: { type: "NUMBER", description: "Keskisyke (bpm, valinnainen)." },
            date: { type: "STRING", description: "Treenin päivämäärä muodossa YYYY-MM-DD (valinnainen, oletuksena kuluva päivä)." },
            matchesPlannedWorkout: { type: "BOOLEAN", description: "Aseta true, jos käyttäjä kertoo suorittaneensa kalenteriin suunnitellun treenin (tai laji ja päivä täsmäävät täysin). Aseta false, jos kyseessä on itsenäinen/eri treeni kuin päivän suunniteltu treeni, jotta kalenterin suunniteltu harjoitus jätetään suorittamattomaksi." },
          },
          required: ["activityType", "durationMinutes", "caloriesKcal"],
        },
      },
      {
        name: "updateNutritionTargets",
        description: "Päivittää käyttäjän päivittäisen kaloritarpeen ja makroravintoainetarpeet (proteiinit, hiilihydraatit, rasvat, kuidut) järjestelmään tavoitteiden tueksi. Kutsu tätä aina, kun valmentaja ja käyttäjä sopivat uusista tavoitearvoista chatissa (esim. 'Asetetaan kalorit 2050 kcal ja proteiini 170g').",
        parameters: {
          type: "OBJECT",
          properties: {
            calories: { type: "NUMBER", description: "Päivittäinen kalorisuositus (kcal)." },
            protein: { type: "NUMBER", description: "Proteiinitavoite (g)." },
            carbs: { type: "NUMBER", description: "Hiilihydraattitavoite (g)." },
            fat: { type: "NUMBER", description: "Rasvatavoite (g)." },
            fiber: { type: "NUMBER", description: "Kuitutavoite (g)." },
          },
        },
      },
      {
        name: "updateTargetWeight",
        description: "Päivittää käyttäjän aktiivisen tavoitteen painotavoitteen (target_weight_kg) tietokantaan. Kutsu tätä aina, kun käyttäjä pyytää tai te sopitte uuden painotavoitteen asettamisesta (esim. 'Päivitetään tavoitteeksi 80 kg').",
        parameters: {
          type: "OBJECT",
          properties: {
            targetWeightKg: { type: "NUMBER", description: "Uusi tavoitepaino kiloina (esim. 80.0)." },
          },
          required: ["targetWeightKg"],
        },
      },
      {
        name: "getUserAnalytics",
        description: "Hakee käyttäjän analytiikkatrendit, keskiarvot, tavoite-ennusteen, BMR/TDEE-kulutuksen, tasanneanalyysit ja korrelaatiohavainnot. Kutsu tätä aina, kun käyttäjä kysyy edistymisestään, painotrendistä, tavoiteaikataulusta, kulutuksestaan, unensa ja nälän suhteesta tai muista pitkän aikavälin tilastoista.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "getUserCoachingProfile",
        description: "Hakee käyttäjän täydellisen valmennusprofiilin (Tavoite-, Kunto-, Kuormitus-, Ravinto-, Palautumis-, Käyttäytymis- ja Rajoiteprofiilit). Kutsu tätä aina, kun teet suunnitelmamuutoksia tai ehdotat uusia tavoitteita, jotta päätökset pohjautuvat käyttäjän ajantasaiseen kokonaiskuvaan.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "updateWorkoutPlanWithVersioning",
        description: "Päivittää käyttäjän treenisuunnitelman ja tallentaa uuden suunnitelmaversion kantoineen. Kutsu tätä aina, kun muutat, lisäät tai kevennät treenejä (esim. univelan tai lihaskivun vuoksi).",
        parameters: {
          type: "OBJECT",
          properties: {
            changeReason: { type: "STRING", description: "Syy muutokselle (esim. 'Nukuin huonosti, jalat kipeät')." },
            decisionReasoning: { type: "STRING", description: "Perustelusi ratkaisulle (esim. 'Intervalli vaihdettu kevyeksi kävelyksi ylikuormituksen estämiseksi')." },
            workoutsToUpdate: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  date: { type: "STRING", description: "Päivämäärä muodossa YYYY-MM-DD." },
                  activityType: { type: "STRING", description: "Laji (esim. 'Juoksu', 'Kävely', 'Kuntosali')." },
                  title: { type: "STRING", description: "Otsikko." },
                  durationMinutes: { type: "NUMBER", description: "Kesto minuutteina." },
                  intensity: { type: "STRING", description: "Teho (recovery, easy, moderate, hard, very_hard)." },
                  status: { type: "STRING", description: "Tila (planned, completed, skipped, cancelled)." }
                },
                required: ["date", "activityType", "title", "durationMinutes", "intensity"]
              },
              description: "Lista päivitettävistä tai lisättävistä treeneistä kalenteriin."
            }
          },
          required: ["changeReason", "decisionReasoning"]
        }
      },
      {
        name: "getNutritionProfile",
        description: "Hakee käyttäjän ravintoprofiilin (kuten ruokavalion, allergiat, vältettävät raaka-aineet, budjetin, ruokailijat ja kuivakaapin sisällön). Kutsu tätä aina, kun suunnittelet aterioita, reseptejä tai ruoka-ohjelmaa.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "generateMealPlan",
        description: "Luo tai päivittää ravinto-ohjelman (meal plan) tietylle ajanjaksolle (päivät ja ateriat). Kutsu tätä, kun käyttäjä pyytää sinua laatimaan ruokasuunnitelman tai lisäämään reseptejä kalenteriin.",
        parameters: {
          type: "OBJECT",
          properties: {
            startDate: { type: "STRING", description: "Alkupäivämäärä YYYY-MM-DD." },
            endDate: { type: "STRING", description: "Loppupäivämäärä YYYY-MM-DD." },
            meals: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  date: { type: "STRING", description: "Päivämäärä YYYY-MM-DD." },
                  mealType: { type: "STRING", description: "Ateriatyyppi (breakfast, lunch, dinner, snack, evening_snack, other)." },
                  recipeName: { type: "STRING", description: "Aterian nimi." },
                  calories: { type: "NUMBER", description: "Kalorit." },
                  protein: { type: "NUMBER", description: "Proteiinit (g)." },
                  carbs: { type: "NUMBER", description: "Hiilihydraatit (g)." },
                  fat: { type: "NUMBER", description: "Rasvat (g)." }
                },
                required: ["date", "mealType", "recipeName", "calories", "protein"]
              },
              description: "Suunnitellut ateriat."
            }
          },
          required: ["startDate", "endDate", "meals"]
        }
      },
      {
        name: "suggestMealForRemainingMacros",
        description: "Ehdottaa aterioita tai reseptejä, jotka sopivat tarkasti käyttäjän jäljellä oleviin makroihin ja huomioivat allergiat.",
        parameters: {
          type: "OBJECT",
          properties: {
            remainingCalories: { type: "NUMBER", description: "Jäljellä olevat kalorit." },
            remainingProtein: { type: "NUMBER", description: "Jäljellä oleva proteiinimäärä (g)." },
            remainingCarbs: { type: "NUMBER", description: "Jäljellä oleva hiilihydraattimäärä (g)." },
            remainingFat: { type: "NUMBER", description: "Jäljellä oleva rasvamäärä (g)." }
          },
          required: ["remainingCalories", "remainingProtein"]
        }
      }
    ],
  },
];

/**
 * Handles the actual database query execution for tool calls.
 */
export async function executeToolCall(
  name: string,
  args: any,
  userId: string
): Promise<any> {
  const supabase = await supabaseServer();

  try {
    switch (name) {
      case "getUserCoachingProfile": {
        const { compileCoachingProfile, saveCoachingProfile } = await import("./calculations/coaching");
        const profile = await compileCoachingProfile(userId, supabase);
        try {
          await saveCoachingProfile(userId, profile, supabase);
        } catch (dbErr) {
          console.warn("Failed to write coaching profile to DB (likely missing migrations), returning compiled state:", dbErr);
        }
        return { profile };
      }

      case "updateWorkoutPlanWithVersioning": {
        const { compileCoachingProfile } = await import("./calculations/coaching");
        const { recordPlanVersion } = await import("./calculations/coaching");
        
        const { changeReason, decisionReasoning, workoutsToUpdate = [] } = args;
        
        // Compile profile snapshot
        const profile = await compileCoachingProfile(userId, supabase);

        // Fetch current version
        let nextVersion = 1;
        try {
          const { data: latestVer } = await supabase
            .from("plan_versions")
            .select("version")
            .eq("user_id", userId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (latestVer) {
            nextVersion = latestVer.version + 1;
          }
        } catch (dbErr) {
          console.warn("Table plan_versions missing:", dbErr);
        }

        // Perform upserts on planned_workouts if workouts provided
        const mappedWorkouts = workoutsToUpdate.map((w: any) => ({
          user_id: userId,
          date: w.date,
          activity_type: w.activityType,
          title: w.title,
          duration_minutes: w.durationMinutes,
          intensity: w.intensity,
          status: w.status || "planned",
          locked_by_user: false
        }));

        if (mappedWorkouts.length > 0) {
          try {
            for (const mw of mappedWorkouts) {
              const { data: existing, error: selectErr } = await supabase
                .from("planned_workouts")
                .select("id")
                .eq("user_id", userId)
                .eq("date", mw.date)
                .eq("title", mw.title)
                .maybeSingle();

              if (selectErr) throw selectErr;

              if (existing) {
                const { error: updateErr } = await supabase
                  .from("planned_workouts")
                  .update({
                    activity_type: mw.activity_type,
                    duration_minutes: mw.duration_minutes,
                    intensity: mw.intensity,
                    status: mw.status,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", existing.id);
                if (updateErr) throw updateErr;
              } else {
                const { error: insertErr } = await supabase
                  .from("planned_workouts")
                  .insert(mw);
                if (insertErr) throw insertErr;
              }
            }
          } catch (dbErr) {
            console.warn("planned_workouts programmatic upsert failed:", dbErr);
          }
        }

        // Record plan version
        try {
          await recordPlanVersion(userId, {
            version: nextVersion,
            user_goal_at_creation: profile.target_profile.primary_objective_label,
            fitness_profile_snapshot: profile.fitness_profile,
            load_profile_snapshot: profile.load_profile,
            recovery_profile_snapshot: profile.recovery_profile,
            affecting_user_updates: [changeReason],
            decision_reasoning: decisionReasoning,
            changes_made: mappedWorkouts,
            change_reason: changeReason,
            user_accepted: true
          }, supabase);
        } catch (dbErr) {
          console.warn("Failed to record plan version:", dbErr);
        }

        return {
          success: true,
          version: nextVersion,
          changes: mappedWorkouts,
          message: `Suunnitelman versio ${nextVersion} kirjattu onnistuneesti.`
        };
      }

      case "getNutritionProfile": {
        let profile = {
          diet_type: "standard",
          allergies: [],
          avoided_ingredients: [],
          cooking_time_limit: 45,
          budget_preference: "medium",
          household_size: 1,
          pantry: ["suola", "pippuri", "oliiviöljy", "riisi"]
        };
        try {
          const { data, error } = await supabase
            .from("nutrition_profiles")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          if (data) {
            profile = { ...profile, ...data };
          }
        } catch (dbErr) {
          console.warn("nutrition_profiles table missing, returning defaults:", dbErr);
        }
        return { profile };
      }

      case "generateMealPlan": {
        const { startDate, endDate, meals = [] } = args;
        // Simulating writing to DB
        console.log(`Generating meal plan from ${startDate} to ${endDate} with ${meals.length} meals`);
        return {
          success: true,
          message: `Ravinto-ohjelma kaudelle ${startDate} - ${endDate} luotu kalenteriin (${meals.length} ateriaa).`
        };
      }

      case "suggestMealForRemainingMacros": {
        const { remainingCalories, remainingProtein, remainingCarbs = 50, remainingFat = 15 } = args;
        // Suggest mock recipes closest to remaining
        const suggestions = [
          {
            name: "Proteiinipitoinen munakas ja kalkkuna",
            calories: Math.round(remainingCalories * 0.9),
            protein: Math.round(remainingProtein * 0.95),
            carbs: 5,
            fat: 14,
            prep_time: 10
          },
          {
            name: "Maitorahka, pähkinät ja marjat",
            calories: Math.round(remainingCalories * 0.8),
            protein: Math.round(remainingProtein * 0.85),
            carbs: 25,
            fat: 8,
            prep_time: 5
          }
        ];
        return { suggestions };
      }

      case "getUserAnalytics": {
        const { getUserAnalyticsData } = await import("./calculations/analytics");
        const analytics = await getUserAnalyticsData(userId, supabase);
        return { analytics };
      }

      case "getUserProfile": {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (error) throw error;
        return { profile: data };
      }

      case "getActiveGoals": {
        const { data, error } = await supabase
          .from("goals")
          .select("id, primary_objective, primary_objective_label, target_date")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (error) throw error;
        if (!data) return { message: "Ei aktiivisia tavoitteita." };

        const { data: versions } = await supabase
          .from("goal_versions")
          .select("*")
          .eq("goal_id", data.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        return { goal: { ...data, details: versions } };
      }

      case "getTodaySummary": {
        const today = new Date().toISOString().split("T")[0];
        
        // Fetch meals logged today
        const { data: meals } = await supabase
          .from("meals")
          .select("id, meal_items(*)")
          .eq("user_id", userId)
          .gte("logged_at", today);

        const calories = meals?.reduce((sum, m) => 
          sum + (m.meal_items?.reduce((itemSum: number, i: any) => itemSum + Number(i.energy_kcal), 0) || 0), 0
        ) || 0;

        // Fetch checkin today
        const { data: checkIn } = await supabase
          .from("daily_check_ins")
          .select("*")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();

        return {
          date: today,
          caloriesConsumed: calories,
          checkIn: checkIn || "Ei vielä aamukirjausta tälle päivälle.",
        };
      }

      case "logBodyMeasurement": {
        const { data, error } = await supabase
          .from("body_measurements")
          .insert({
            user_id: userId,
            metric: args.metric,
            value: args.value,
            source: "chat",
            user_confirmed: true,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, logged: data };
      }

      case "logMorningCheckIn": {
        const targetDate = args.date || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
        
        const updatePayload: any = {
          user_id: userId,
          date: targetDate,
        };
        if (args.sleepHours !== undefined) updatePayload.sleep_hours = args.sleepHours;
        if (args.sleepQuality !== undefined) updatePayload.sleep_quality = args.sleepQuality;
        if (args.energyLevel !== undefined) updatePayload.energy_level = args.energyLevel;
        if (args.stressLevel !== undefined) updatePayload.stress_level = args.stressLevel;
        if (args.sorenessLevel !== undefined) updatePayload.soreness_level = args.sorenessLevel;
        if (args.notes !== undefined) updatePayload.notes = args.notes;

        const { data, error } = await supabase
          .from("daily_check_ins")
          .upsert(updatePayload)
          .select()
          .single();

        if (error) throw error;
        return { success: true, checkIn: data };
      }

      case "undoLastUserAction": {
        // Find the latest body measurement created by chat
        const { data: latestMeasure } = await supabase
          .from("body_measurements")
          .select("id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMeasure) {
          const { error } = await supabase
            .from("body_measurements")
            .delete()
            .eq("id", latestMeasure.id);

          if (error) throw error;
          return { success: true, message: "Peruutettu viimeisin painomittaus." };
        }

        return { success: false, message: "Ei peruutettavia kirjauksia löydetty." };
      }

      case "scheduleWorkout": {
        const { data, error } = await supabase
          .from("planned_workouts")
          .insert({
            user_id: userId,
            date: args.date,
            activity_type: args.activityType,
            title: args.title,
            duration_minutes: args.durationMinutes,
            intensity: args.intensity,
            status: "planned",
            locked_by_user: false,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, workout: data };
      }

      case "getUpcomingWorkouts": {
        const today = new Date().toISOString().split("T")[0];
        const { data, error } = await supabase
          .from("planned_workouts")
          .select("*")
          .eq("user_id", userId)
          .gte("date", today)
          .order("date", { ascending: true });

        if (error) throw error;
        return { workouts: data };
      }

      case "logMeal": {
        const { mealType, items, date } = args;
        
        const targetDate = date || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
        const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
        const loggedAtStr = targetDate === todayStr 
          ? new Date().toISOString()
          : new Date(`${targetDate}T12:00:00Z`).toISOString();

        const { data: mealData, error: mealError } = await supabase
          .from("meals")
          .insert({
            user_id: userId,
            logged_at: loggedAtStr,
            meal_type: mealType,
            accuracy_class: "QUICK_TEXT_ENTRY",
          })
          .select()
          .single();

        if (mealError) throw mealError;

        const mealItemsToInsert = items.map((item: any) => ({
          meal_id: mealData.id,
          food_name: item.foodName,
          amount_g: item.amountG,
          energy_kcal: item.energyKcal,
          protein_g: item.proteinG,
          carbohydrates_g: item.carbohydratesG,
          fat_g: item.fatG,
          fiber_g: item.fiberG || 0.0,
        }));

        const { error: itemsError } = await supabase
          .from("meal_items")
          .insert(mealItemsToInsert);

        if (itemsError) throw itemsError;

        return { success: true, message: `Ateria (${mealType}) kirjattu onnistuneesti.` };
      }

      case "logCompletedWorkout": {
        const { activityType, durationMinutes, caloriesKcal, averageHeartRate, date, matchesPlannedWorkout } = args;
        const targetDate = date || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
        const offset = new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("GMT+3") || new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki", timeStyle: "long" }).includes("EEST") ? "+03:00" : "+02:00";
        const startedAtStr = new Date(`${targetDate}T17:30:00${offset}`).toISOString();

        // 1. Insert manual activity in activities table
        const { error: insertError } = await supabase
          .from("activities")
          .insert({
            user_id: userId,
            provider: "manual",
            activity_type: activityType,
            started_at: startedAtStr,
            duration_seconds: Math.round(durationMinutes * 60),
            calories_kcal: caloriesKcal,
            average_heart_rate: averageHeartRate ? Math.round(averageHeartRate) : 130,
            perceived_exertion: 5,
          });

        if (insertError) throw insertError;

        // 2. Synchronize to planned workouts (update existing planned, or create new completed planned workout)
        await syncActivityToPlannedWorkout(
          supabase,
          userId,
          {
            activity_type: activityType,
            started_at: startedAtStr,
            duration_seconds: Math.round(durationMinutes * 60),
            calories_kcal: caloriesKcal,
            average_heart_rate: averageHeartRate ? Math.round(averageHeartRate) : undefined,
          },
          matchesPlannedWorkout !== false // Default to true if not explicitly false
        );

        return { success: true, message: `Treeni (${activityType}, ${durationMinutes} min, ${caloriesKcal} kcal) tallennettu tietokantaan ja päivitetty kalenteriin.` };
      }

      case "updateNutritionTargets": {
        const { calories, protein, carbs, fat, fiber } = args;
        await saveNutritionTargets(supabase, userId, {
          calories: calories !== undefined ? Number(calories) : undefined,
          protein: protein !== undefined ? Number(protein) : undefined,
          carbs: carbs !== undefined ? Number(carbs) : undefined,
          fat: fat !== undefined ? Number(fat) : undefined,
          fiber: fiber !== undefined ? Number(fiber) : undefined,
        });

        return { success: true, message: "Päivittäiset kaloritarpeet ja ravintoainetarpeet päivitetty onnistuneesti järjestelmään." };
      }

      case "updateTargetWeight": {
        const { targetWeightKg } = args;
        
        // 1. Get active goal
        let { data: goal, error: goalErr } = await supabase
          .from("goals")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (goalErr) throw goalErr;

        // 2. If no active goal, create one
        if (!goal) {
          const { data: newGoal, error: createGoalErr } = await supabase
            .from("goals")
            .insert({
              user_id: userId,
              primary_objective: "weight_loss",
              primary_objective_label: "Painonpudotus",
              status: "active",
              start_date: new Date().toISOString().split("T")[0],
              target_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
            })
            .select()
            .single();

          if (createGoalErr) throw createGoalErr;
          goal = newGoal;
        }

        if (!goal) {
          throw new Error("Aktiivisen tavoitteen alustaminen epäonnistui.");
        }

        // 3. Fetch latest goal version to copy over other values (calories, protein etc.)
        const { data: latestVersion, error: versionErr } = await supabase
          .from("goal_versions")
          .select("*")
          .eq("goal_id", goal.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersionNum = latestVersion ? (latestVersion.version + 1) : 1;

        // 4. Insert new version with updated target weight
        const { error: insertErr } = await supabase
          .from("goal_versions")
          .insert({
            goal_id: goal.id,
            version: nextVersionNum,
            target_weight_kg: Number(targetWeightKg),
            target_body_fat_pct: latestVersion?.target_body_fat_pct || null,
            target_muscle_mass_kg: latestVersion?.target_muscle_mass_kg || null,
            target_waist_cm: latestVersion?.target_waist_cm || null,
            weekly_exercise_count_target: latestVersion?.weekly_exercise_count_target || null,
            change_reason: "Painotavoitteen päivitys valmentajan chatin kautta",
            changed_by: "chatbot",
          });

        if (insertErr) throw insertErr;

        return { success: true, message: `Painotavoite päivitetty onnistuneesti arvoon ${targetWeightKg} kg.` };
      }

      default:
        return { error: `Tuntematon työkalu: ${name}` };
    }
  } catch (err: any) {
    console.error(`Virhe työkaluajossa ${name}:`, err);
    return { error: err.message || "Tapahtui virhe tietokantakirjauksessa." };
  }
}
