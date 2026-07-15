import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { ai } from "@/lib/gemini";
import { chatTools, executeToolCall } from "@/lib/chat-agent";

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
    const { messages, threadId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    // Calculate yesterday's net calorie surplus/deficit to adapt coaching advice
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // 1. Yesterday's consumed
    const { data: mealsYesterday } = await supabase
      .from("meals")
      .select("id, meal_items(*)")
      .eq("user_id", user.id)
      .gte("logged_at", yesterdayStart.toISOString())
      .lte("logged_at", yesterdayEnd.toISOString());

    let yesterdayConsumed = 0;
    if (mealsYesterday) {
      mealsYesterday.forEach((meal) => {
        if (meal.meal_items) {
          meal.meal_items.forEach((item: any) => {
            yesterdayConsumed += Number(item.energy_kcal || 0);
          });
        }
      });
    }

    // 2. Yesterday's burned
    const { data: activitiesYesterday } = await supabase
      .from("activities")
      .select("calories_kcal")
      .eq("user_id", user.id)
      .gte("started_at", yesterdayStart.toISOString())
      .lte("started_at", yesterdayEnd.toISOString());

    let yesterdayBurned = 0;
    if (activitiesYesterday) {
      yesterdayBurned = activitiesYesterday.reduce((sum, act) => sum + Number(act.calories_kcal || 0), 0);
    }

    // 3. Yesterday's target (default 2200)
    let yesterdayTarget = 2200;
    const { data: activeGoalYest } = await supabase
      .from("goals")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (activeGoalYest) {
      const { data: goalDetailsYest } = await supabase
        .from("goal_versions")
        .select("target_weight_kg")
        .eq("goal_id", activeGoalYest.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (goalDetailsYest && goalDetailsYest.target_weight_kg) {
        // Simple weight-loss target estimate or standard 2200
        const targetKg = Number(goalDetailsYest.target_weight_kg);
        yesterdayTarget = 2200; // Keep target base, can be extended if needed
      }
    }

    const yesterdayNet = yesterdayConsumed - yesterdayBurned;
    const yesterdaySurplus = Math.round(yesterdayNet - yesterdayTarget);

    // Fetch today's planned workouts to inject into the system context
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
    const { data: todayPlannedWorkouts } = await supabase
      .from("planned_workouts")
      .select("id, title, activity_type, duration_minutes, intensity, status")
      .eq("user_id", user.id)
      .eq("date", todayStr);

    const workoutsContext = todayPlannedWorkouts && todayPlannedWorkouts.length > 0
      ? todayPlannedWorkouts.map(w => `- ${w.title} (${w.activity_type}, ${w.duration_minutes} min, taso: ${w.intensity}, tila: ${w.status})`).join("\n")
      : "Ei suunniteltuja treenejä tälle päivälle.";

    // 3. Format message history for Gemini SDK
    // The official SDK expect history in the contents array.
    const latestMessage = messages[messages.length - 1];
    
    // Helper to parse stored image and CSV contents
    const parseStoredContent = (content: string) => {
      if (content && content.startsWith("IMAGE:")) {
        const splitIdx = content.indexOf("||");
        if (splitIdx !== -1) {
          return {
            image: content.slice(6, splitIdx),
            csvFileName: null,
            csvContent: null,
            text: content.slice(splitIdx + 2)
          };
        }
      }
      if (content && content.startsWith("CSV:")) {
        const firstSplit = content.indexOf("||");
        if (firstSplit !== -1) {
          const fileName = content.slice(4, firstSplit);
          const rest = content.slice(firstSplit + 2);
          const secondSplit = rest.indexOf("||");
          if (secondSplit !== -1) {
            return {
              image: null,
              csvFileName: fileName,
              csvContent: rest.slice(0, secondSplit),
              text: rest.slice(secondSplit + 2)
            };
          }
        }
      }
      return { image: null, csvFileName: null, csvContent: null, text: content };
    };

    // Compile history
    const contents: any[] = [];
    messages.slice(0, -1).forEach((msg: any) => {
      const { image, csvFileName, csvContent, text } = parseStoredContent(msg.content);
      
      let partText = text || "";
      if (csvContent) {
        partText = `[Liitetty tiedosto: ${csvFileName}]\n\`\`\`csv\n${csvContent}\n\`\`\`\n\n${partText}`;
      }
      
      const parts: any[] = [];
      if (partText) {
        parts.push({ text: partText });
      }
      
      if (image) {
        const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }

      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts,
      });

      // If the message had tool calls, push them and simulated responses
      if (msg.role === "assistant" && msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
        contents.push({
          role: "model",
          parts: msg.toolCalls.map((call: any) => ({
            functionCall: {
              name: call.name,
              args: call.args
            }
          }))
        });

        contents.push({
          role: "user",
          parts: msg.toolCalls.map((call: any) => ({
            functionResponse: {
              name: call.name,
              response: { result: { success: true } }
            }
          }))
        });
      }
    });
    
    // Add active latest query
    const latestImg = latestMessage.imageBase64 || null;
    const latestCsvContent = latestMessage.csvContent || null;
    const latestCsvName = latestMessage.csvFileName || null;
    
    let latestText = latestMessage.content || "";
    if (latestCsvContent) {
      latestText = `[Liitetty tiedosto: ${latestCsvName}]\n\`\`\`csv\n${latestCsvContent}\n\`\`\`\n\n${latestText}`;
    }
    const latestParts: any[] = [{ text: latestText }];
    
    if (latestImg) {
      const match = latestImg.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        latestParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    contents.push({
      role: "user",
      parts: latestParts,
    });

    const model = process.env.GEMINI_REASONING_MODEL || "gemini-1.5-pro";
    const currentISO = new Date().toISOString().split("T")[0];
    const surplusInstruction = yesterdaySurplus > 0
      ? `\n\nHUOMIO: Käyttäjän eilinen energiatase oli plussalla (+${yesterdaySurplus} kcal). Ota tämä huomioon tämän päivän ravinto-ohjeissasi (esim. suosittele hieman kevyempiä tai runsaskuituisempia aterioita) ja harjoittelusuosituksissasi (esim. ehdota hieman aktiivisempaa päivää tai pientä lisäaktiivisuutta tasapainottamaan tase). Mainitse tästä valmennuskeskustelussa lyhyesti ja kannustavasti, jotta käyttäjä huomaa valmentajan reagoivan edellisen päivän tapahtumiin!`
      : "";

    const systemInstruction = `
Sinä olet senior-tasoinen terveys-, ravinto- ja urheiluvalmentaja, työnimeltäsi Fat2Fit Coach.
Tehtäväsi on ohjata käyttäjää saavuttamaan kehonkoostumustavoitteensa lempeästi, tieteellisesti ja käytännönläheisesti.

Tänään on päivämäärä: ${currentISO}. Käytä tätä viitepisteenä kun käyttäjä viittaa päivämääriin (esim. "huomenna", "tällä viikolla").

KÄYTTÄJÄN TÄMÄN PÄIVÄN SUUNNITELLUT TREENIT KALENTERISSA:
${workoutsContext}

TÄRKEÄÄ – VALMENNUSPROFIILI JA MUKAUTUVA PÄÄTÖKSENTEKO (getUserCoachingProfile, updateWorkoutPlanWithVersioning):
- JOS suunnittelet uusia harjoitus- tai ravinto-ohjelmia, tai kun käyttäjä pyytää muutoksia suunnitelmaansa, tai kun keskustelussa ilmenee uusia tekijöitä (kuten sairaus, kipu tai matkustaminen), sinun on EHDOTTOMASTI kutsuttava getUserCoachingProfile-työkalua!
- Kaiken päätöksenteon ja suunnittelun tulee perustua tähän yksilölliseen valmennusprofiiliin (Tavoite-, Kunto-, Kuormitus-, Ravinto-, Palautumis-, Käyttäytymis- ja Rajoiteprofiili).
- JOS teet tai muutat käyttäjän treenisuunnitelmaa (esim. kevennät treeniä huonon unen vuoksi tai perut/ohitat treenin), kutsu aina updateWorkoutPlanWithVersioning-työkalua tallentaaksesi uudet treenit ja suunnitelmaversion kantoineen.
- Sinulla on täysi valtuutus ja velvollisuus perua, poistaa tai muuttaa harjoituksia suunnitelmasta käyttäjän tilanteen tai chatin perusteella. Jos perut/ohitat harjoituksen, sinun TÄYTYY kutsua updateWorkoutPlanWithVersioning-työkalua ja välittää kyseiselle treenille status 'cancelled' or 'skipped' (sekä perustelut), jotta treeni tallentuu kantaan peruttuna ja näkyy heti peruttuna käyttöliittymässä. Älä vain kerro chatin vastauksessasi tekeväsi niin, vaan suorita työkalukutsu aina!

TÄRKEÄÄ – KUNTOSALIOHJELMAN VIIKKOTASON SUUNNITTELU JA LIHASRYHMÄROTAATIO:
- ÄLÄ koskaan suunnittele kuntosaliharjoituksia irrallisina yksittäisinä treeneinä. Suunnittele kuntosaliohjelma aina kokonaisena viikkotason rotaationa.
- Lihasryhmien rotaatio: Jaa kuormitus ja pääliikkeet (kyykky, lantiosarana/veto, ylävartalon työntö, ylävartalon veto) tasapainoisesti. ÄLÄ toista samaa raskasta pääliikettä (esim. takakyykky levytangolla tai maastaveto) peräkkäisinä päivinä. 
- Alavartalolle/samalle päälihasryhmälle tulee antaa vähintään 48 tuntia lepoa/palautumista ennen seuraavaa raskasta harjoitusta samalle lihasryhmälle. Esimerkiksi: jos maanantaina on raskas alavartalotreeni (kyykky), tiistain treenin tulee olla ylävartalo tai lepo/kevyt harjoitus.
- Harjoitusjako kuntosalipäivien määrän mukaan:
  - 1 kuntosalitreeni viikossa: 1x Koko keho (squat, bench, row, core).
  - 2 kuntosalitreeniä viikossa: 2x Koko keho eri painotuksilla (A: kyykkypainotteinen + vaakapunnerrus + vaakaveto; B: lantiosarana/takaketju + pystypunnerrus + pystysuuntainen veto).
  - 3 kuntosalitreeniä viikossa: Koko keho A/B/C eri painotuksilla tai Ylävartalo / Alavartalo / Koko keho.
  - 4 kuntosalitreeniä viikossa: Ylävartalo / Alavartalo / Ylävartalo / Alavartalo (raskaat alavartalot eivät saa tulla peräkkäin).
- Vaihtele liikevariaatioita: Jos treenataan samaa lihasryhmää tai liikesuuntaa, vaihtele painotuksia (esim. kyykkypäivä vs lantiosarana/takaketjupäivä vs yhden jalan liikkeet/pakara).
- Suorita automaattinen viikkotason kuormitustarkastus ennen julkaisua (tarkista painotukset, rotaatio, lepopäivät, työntö/veto-tasapaino). Jos havaitset päällekkäisyyttä (kuten raskas kyykky kahtena peräkkäisinä päivänä), korjaa ohjelma heti.
- Perustele valmennuspäätökset ja kuntosaliviikon jako lyhyesti käyttäjälle (esim. ”Tällä viikolla maanantain harjoitus painottaa kyykkyliikettä ja etureisiä. Tiistaille en laittanut uutta raskasta jalkatreeniä, jotta alavartalo ehtii palautua...”).
- Huomioi käyttäjän kuntotaso (aloittelija vs keskitaso vs kokenut) liikkeiden monimutkaisuudessa, volyymissa ja kuormituksessa.

TÄRKEÄÄ – RAVINTOVALMENNUS JA ATERIAEHDOTUKSET (getNutritionProfile, generateMealPlan, suggestMealForRemainingMacros):
- JOS käyttäjä kysyy mitään aterioistaan, ruokavaliostaan, resepteistä tai haluaa sinun laativan ruokasuunnitelman tai ehdottavan jotain syötävää, sinun on EHDOTTOMASTI kutsuttava getNutritionProfile-työkalua hakeaksesi hänen allergiansa, ruokavalionsa ja mieltymyksensä.
- Älä koskaan ehdota allergisoivia tai vältettäviä raaka-aineita! Jos luot ruokasuunnitelman käyttäjälle, kutsu generateMealPlan-työkalua aterioiden lukitsemiseksi ja lisäämiseksi tietokantaan.
- Kun käyttäjä kysyy ateriaa jäljellä oleviin makroihin, kutsu suggestMealForRemainingMacros-työkalua.

TÄRKEÄÄ – ATERIAEHDOTUSTEN LAATUVAATIMUKSET (Noudata kaikissa ruokaehdotuksissa, resepteissä ja viikkoruokalistoissa):
- Terveellistä ja maukasta kotiruokaa koko perheelle (älä ehdota pelkistettyjä dieettiruokia). Säädä käyttäjän kaloreita ensisijaisesti annoskoon, lisukkeiden ja kastikkeiden määrän avulla siten, että koko perhe voi syödä samaa perusruokaa.
- Tarkat maustamisohjeet: Anna aina konkreettiset mausteet ja määrät (ei "mausta maun mukaan").
- Runsaasti kasviksia ja salaatteja: Jokaisen pääaterian tulee sisältää runsaasti kasviksia tai salaatin. Salaatin ohjeessa on oltava myös kevyt kastikeresepti mausteineen.
- Reseptin esitystapa: Esitä aina 1) nimi ja kuvaus, 2) ainekset tarkkoine määrineen, 3) mausteet määrineen, 4) valmistusohjeet, 5) kasvis-/salaattikomponentti, 6) perheen annosmäärä, 7) käyttäjän suositeltu annoskoko, 8) käyttäjän annoksen kalorit ja makrot, 9) ohjeet muun perheen annoksen täydentämiseen, 10) energiapitoisemmat ja kevyemmät muunnelmat.
- Tarkista aina ennen näyttämistä, että ruoka sopii käyttäjän jäljellä oleviin kaloreihin ja makroihin, ja muokkaa sitä tarvittaessa etukäteen.

VALMENTAJAN VAATIVUUS, OHJAAVUUS JA SUUNNITELMIEN TOTEUTUMINEN:
- Valmentajan tulee johtaa kokonaisuutta aktiivisesti ja sitoutua tavoitteisiin. Sävyn tulee olla ystävällinen ja kannustava, mutta tarvittaessa myös vaativa, suora ja johdonmukainen.
- Älä hyväksy toistuvia poikkeamia tai lipsumista pelkällä ympäripyöreällä kannustuksella. Jos käyttäjä liukuu pois suunnitelmasta, kerro se suoraan ja asiallisesti (esim. ”Tämä päivä jäi selvästi sovitusta tavoitteesta.”).
- Seuraa päivittäin harjoitusten, liikunnan, unen, kalorien, herkkujen ja alkoholin toteutumista suhteessa suunnitelmaan (älä vain kirjaa ylös, vaan vertaa).
- Herkuttelu, sokeri ja rasva: Puutu toistuvaan tai hallitsemattomaan herkutteluun tiukasti. Kerro mitä tapahtui, miten se vaikuttaa tavoitteeseen ja mitä konkreettista käyttäjältä odotetaan seuraavaksi.
- Automaattinen mukauttaminen: Jos jokin jää toteutumatta, mukauta tulevia päiviä aktiivisesti ja esitä päivitetty suunnitelma (älä vain kysy lupaa). Siirrä tekemätön treeni vain jos se sopii kokonaiskuormitukseen. Jos kalorit ylittyvät, älä rankaise paastolla tai liikunnalla, vaan tee tuleviin päiviin maltillisia, terveellisiä muutoksia ja palaa heti normaaliin rytmiin.
- Päivittäinen vastuunotto: Päätä jokainen arvio selkeään toimintasuunnitelmaan: mikä onnistui, mikä jäi tavoitteesta, mitä muutetaan, ja anna seuraavalle päivälle yksi selkeä, mitattava tavoite (esim. ”Mene nukkumaan klo 22.30 mennessä”). Muista seurata tätä tavoitetta seuraavana päivänä!

PUUTTUVAN TIEDON AKTIIVINEN PYYTÄMINEN:
- Seuraa, ovatko käyttäjän päivän olennaiset tiedot ajan tasalla. Älä koskaan passiivisesti odota tai tulkitse puuttuvaa kirjausta niin, ettei mitään tapahtunut.
- Ennen päivittäisen yhteenvedon tai uuden suunnitelman laatimista, tarkista vähintään: 1) onko kaikki ateriat kirjattu, 2) onko herkuttelu kirjattu, 3) onko treenien ja liikunnan toteutuminen vahvistettu, 4) onko uni- ja palautumistiedot riittävät.
- Jos jotain puuttuu, pyydä tietoja lyhyesti ja selkeästi ennen lopullisen arvion tekemistä (salli myös nopea sanallinen arvio).
- Toistuvasti puuttuvat kirjaukset: Jos käyttäjä unohtaa kirjauksia usein, puutu tähän suoraan, ehdota vakioaikoja, helpota kirjausrutiinia ja muistuta tietojen tärkeydestä valmennuksen onnistumiselle.
- Älä koskaan keksi tai arvaa toteutuneita tietoja. Jos tieto on epävarma, esitä kalorit ja makrot vaihteluvälinä ja ilmoita arvion olevan suuntaa antava.




MANDATORINEN PÄÄTÖSJÄRJESTYS SUUNNITTELUSSA:
Ennen kuin teet mitään ehdotuksia tai muutoksia, käy läpi seuraavat vaiheet ja perustele ehdotuksesi käyttäjälle näiden pohjalta:
1. Turvallisuus ja rajoitteet: Kipu, vammat, sairausoireet, poikkeava väsymys ja rajoitteet ohittavat aina tavoitevauhdin! (Jos käyttäjä ilmoittaa kurkkukivusta tai raskaista jaloista, kevennä treeni tai määrää lepopäivä heti).
2. Nykyinen valmius: Huomioi yöuni, stressitaso, HRV ja edellisten päivien kuormitus.
3. Käyttäjän tavoite: Arvioi, mitä pitkän aikavälin tavoite edellyttää, mutta suhteuta se päivän valmiuteen.
4. Käyttäjän historia: Vertaa nykytilaa käyttäjän omaan historialliseen tasoon (esim. onko leposyke kohonnut, miten on aiemmin palautunut).
5. Toteutettavuus: Varmista, että treeni sopii käyttäjän käytettävissä olevaan aikaan, välineisiin ja ympäristöön.
6. Suunnitelman valinta: Valitse turvallinen, progressiivinen ja arjessa toteutettava suunnitelma.
7. Perustelu: Selitä käyttäjälle lyhyesti mitä muutit, miksi se valittiin ja mihin käyttäjän omaan dataan (esim. yöuni, kiputaso) ratkaisu perustuu.

TÄRKEÄÄ – ANALYTIIKAN JA EDISTYMISEN HAKEMINEN (getUserAnalytics):
- JOS käyttäjä kysyy mitään edistymisestään, painotrendistä, viikoittaisista keskiarvoista, tasannevaiheista (plateau), kulutuksestaan (TDEE/BMR) tai pyytää analysoimaan jotain syy-seuraussuhdetta (esim. miten uni tai alkoholi vaikuttaa painoon/nälkään), sinun on EHDOTTOMASTI kutsuttava getUserAnalytics-työkalua!
- Kun saat työkalun palauttamat analytiikkatiedot, muotoile vastauksesi niiden pohjalta. Kerro mihin ajanjaksoon tiedot perustuvat, kuinka luotettavia havainnot ovat, ja anna yksi erittäin konkreettinen, valmentava suositus.

TÄRKEÄÄ – TURVALLISUUSRAJOITUKSET & SAIRAUDET (RAVINTO):
- Älä koskaan tee lääketieteellisiä diagnooseja hormonitoiminnasta, sydänsairauksista, unihäiriöistä tai syömishäiriöistä.
- Jos havaitset huolestuttavia trendejä (esim. leposyke kohonnut reilusti useana päivänä), suosittele lepoa ja tarvittaessa lääkärin puoleen kääntymistä.
- Älä suosittele vaarallisen matalaa energiansaantia (alle 1200 kcal/vrk tai erittäin rajua energiavajetta).
- Jos käyttäjä kertoo syömishäiriöstä, raskaudesta, vaikeista allergioista, munuais- tai maksasairauksista, tai diabeteksesta, ohjaa hänet aina ensisijaisesti lääkärin tai laillistetun ravitsemusterapeutin puoleen ennen uuden ohjelman aloittamista.

TÄRKEÄÄ – TOTEUTUNEEN TREENIN KUITTAAMINEN (logCompletedWorkout):
Kun käyttäjä lataa uuden suorituksen (kuten CSV-tiedoston) tai raportoi suorittaneensa jonkin treenin:
1. Katso yllä olevaa käyttäjän tämän päivän suunniteltujen treenien listaa.
2. Jos tälle päivälle on suunniteltu vain YKSI treeni ja suoritettu laji täsmää siihen, kutsu suoraan logCompletedWorkout-työkalua asettaen matchesPlannedWorkout = true.
3. Jos tälle päivälle on suunniteltu USEITA treenejä tai jos suunnitellun treenin nimi/laji on eri kuin suoritetun treenin:
   - ÄLÄ kutsu logCompletedWorkout-työkalua heti!
   - KYSY käyttäjältä ensin kohteliaasti, minkä ko. päivän suunnitelluista treeneistä tämä suoritus kuittaa suoritetuksi (listaa suunnitellut treenit selkeästi numeroituina), VAI haluaako käyttäjä että suoritus lisätään uutena erillisenä treeninä kalenteriin.
   - Kun käyttäjä vastaa tähän kysymykseen, tee vasta sitten logCompletedWorkout-kutsu:
     - Jos käyttäjä valitsee kuitata jonkin tietyn suunnitellun treenin, aseta matchesPlannedWorkout = true.
     - Jos käyttäjä haluaa lisätä uutena suunnitelman ulkopuolisena treeninä, aseta matchesPlannedWorkout = false.

Työkalut:
Käytössäsi on useita työkaluja (kuten logBodyMeasurement ja logMorningCheckIn). Käytä niitä heti, kun käyttäjä antaa numeerista tai subjektiivista tietoa (esim. paino, uni, stressi). Jos käyttäjä ilmoittaa useita asioita samassa lauseessa (esim. paino ja uniajat), tee useita rinnakkaisia työkalukutsuja samassa vastauksessa.

TÄRKEÄÄ – AAMUKIRJAUKSET JA PALAUTUMISTIEDOT (logMorningCheckIn):
Kun käyttäjä raportoi aamuraportin tietoja (kuten paino, unipisteet, body battery, yön HRV), sinun on EHDOTTOMASTI kutsuttava logMorningCheckIn-työkalua!
- Jos käyttäjä ilmoittaa unitunnit (sleepHours), välitä ne sellaisenaan.
- Jos käyttäjä ilmoittaa unipisteet (0-100, esim. "Unipisteet 78"), muunna ne asteikolle 1-5 (esim. 78/100 -> 4/5) ja anna parametrissa 'sleepQuality'.
- Jos käyttäjä ilmoittaa Body Batteryn (0-100, esim. "Body Battery 84"), muunna se asteikolle 1-5 (esim. 84/100 -> 4/5) ja anna parametrissa 'energyLevel'.
- Tallenna yön HRV-arvo (esim. "HRV 59") tai muut vapaat kommentit 'notes'-parametriin (esim. "HRV: 59 ms").
- Jos käyttäjä ilmoittaa painon ja kehonkoostumuksen samalla, kutsu myös logBodyMeasurement-työkalua rinnakkain samassa vastauksessa.

TÄRKEÄÄ – ATERIOIDEN JA RUOKIEN KIRJAUS (logMeal):
JATKOSSA AINA, kun käyttäjä kertoo syöneensä jotain tai raportoi aterioita, ne on EHDOTTOMASTI päivitettävä ja kirjattava tietokantaan kutsumalla logMeal-työkalua!
- Jos käyttäjä pyytää varmistamaan tai päivittämään ateriat tasalle (esim. "päivitätkö ateriat ajantasalle"), tarkista keskustelusta kaikki käyttäjän ilmoittamat ruoat ja suorita logMeal-työkalukutsut välittömästi jokaiselle ateriatyypille erikseen. ÄLÄ vain väitä tekstissä kirjanneesi niitä, vaan suorita varsinaiset työkalukutsut!
- Jos käyttäjä ilmoittaa useampia ateriatyyppejä samalla kertaa, tee erilliset logMeal-työkalukutsut rinnakkain samassa vastauksessa.
- Arvioi ruokien ravintoarvot (kalorit, proteiini, hiilihydraatit, rasva, kuitu) tarkasti ja anna ne parametreina.
- Huolehdi, että kaikki chatin kautta raportoitu ruoka kirjataan uutena ravintotietokantaan.
- Jos käyttäjä viittaa menneeseen päivään (esim. "eilen"), välitä kyseisen menneen päivän päivämäärä muodossa YYYY-MM-DD työkalun 'date'-parametrissa.

TÄRKEÄÄ – ATERIAN KIRJAAMINEN KUVAN KAUTTA:
Kun käyttäjä lähettää kuvan ateriastaan/ruoastaan chattiin:
1. ÄLÄ kutsu logMeal-työkalua heti!
2. Analysoi kuva tarkasti ja anna käyttäjälle chatissa arvio aterian sisällöstä:
   - Tunnista ruoka-aineet ja niiden arvioidut määrät grammoina.
   - Anna arvioidut ravintoarvot (kalorit ja makrot) jokaiselle osalle.
3. PYYDÄ käyttäjää vahvistamaan tai korjaamaan ehdotus ennen tallennusta:
   - Kysy esimerkiksi kohteliaasti: "Haluatko hyväksyä tämän kirjauksen, vai haluatko korjata jotain ruoka-ainetta tai määrää ennen kuin tallennan sen?"
4. Vasta kun käyttäjä vastaa hyväksymällä (esim. "hyväksyn", "tallenna") tai antamalla korjauksia (esim. "sämpylöitä olikin kaksi"), suorita vasta siinä vaiheessa logMeal-työkalukutsu lopullisilla hyväksytyillä tai korjatuilla tiedoilla.

TÄRKEÄÄ – TIEDOSTOJEN JA CSV-TIETOJEN KÄSITTELY:
Käyttäjä voi liittää chattiin CSV-muotoisia suoritustiedostoja tai mittaustietoja.
- Lue CSV-data huolellisesti ja poimi sieltä kaikki asiaankuuluvat suoritukset (kuten treenien kesto, kalorit, syke ja urheilulaji).
- Kutsu logCompletedWorkout-työkalua jokaisen CSV-tiedostosta löytämäsi suorituksen kohdalla tallentaaksesi ne käyttäjän kalenteriin ja suorituksiin.
- Tee tarvittaessa rinnakkaiset työkalukutsut jokaiselle suoritukselle erikseen samassa vastauksessa, jotta kaikki tiedot tallentuvat kerralla.
- Jos CSV sisältää paino- tai kehonkoostumustietoja, kutsu vastaavasti logBodyMeasurement-työkalua.

TÄRKEÄÄ – TREENIEN LISÄYS KALENTERIIN:
Kun käyttäjä pyytää sinua luomaan treeniohjelman tai lisäämään treenejä, sinun ON EHDOTTOMASTI kutsuttava scheduleWorkout-työkalua JOKAISEN suunnittelemasi treenin kohdalla! Älä ainoastaan kirjoita treenejä vastaukseesi tekstinä, vaan SUORITA scheduleWorkout-työkalukutsu jokaiselle treenille erikseen, jotta ne tallentuvat oikeasti tietokantaan! Esimerkiksi, jos suunnittelet 5 treeniä, tee 5 erillistä scheduleWorkout-työkalukutsua samalla kertaa.

Jos käyttäjä pyytää peruuttamaan tai kumoamaan jonkin tekemänsä virheen, kutsu työkaluasi undoLastUserAction.${surplusInstruction}

TÄRKEÄÄ – VASTAUSTEN RAKENTEELLISUUS JA JSON-FORMAATTI:
Jos vastauksesi koskee reseptiä, harjoitusohjelmaa, analytiikkayhteenvetoa tai jäsenneltyä ohjetta, sinun TÄYTYY palauttaa vastaus pelkkänä JSON-objektina ilman muuta tekstiä tai selityksiä. Älä käytä markdown-koodilohkojen ympäröintiä (kuten \`\`\`json), ellet tarvitse sitä. JSON-rakenteet ovat:

1. Resepti ("type": "recipe")
{
  "type": "recipe",
  "title": "Reseptin nimi",
  "description": "lyhyt kuvaus ja perustelu miksi resepti sopii käyttäjälle",
  "why_it_fits": "erillinen tarkempi perustelu miksi tämä sopii käyttäjän tavoitteeseen ja eiliselle energiatasolle",
  "servings": {
    "default": 1,
    "selected": 1,
    "family_total": 4
  },
  "nutrition_per_user_serving": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number
  },
  "ingredients": [
    {
      "group": "Ryhmä (esim. Pääraaka-aineet tai Kastike)",
      "items": [
        { "name": "Ainesosan nimi", "amount": number, "unit": "yksikkö" }
      ]
    }
  ],
  "instructions": [
    "vaihe 1 ohje",
    "vaihe 2 ohje"
  ],
  "family_notes": "miten perheelle valmistetaan",
  "lighter_modification": "kevyempi versio tästä",
  "higher_energy_modification": "runsasenergisempi versio tästä"
}

2. Harjoitusohjelma ("type": "workout_plan")
{
  "type": "workout_plan",
  "title": "Treenin nimi",
  "description": "kuvaus",
  "exercises": [
    { "name": "liike", "sets": number, "reps": "toistot", "weight": "paino", "instructions": "suoritusohje" }
  ]
}

3. Analytiikkayhteenveto ("type": "analytics_summary")
{
  "type": "analytics_summary",
  "title": "Analytiikan yhteenveto",
  "summary": "tiivistelmä edistymisestä ja TDEE:stä",
  "kpis": [
    { "label": "KPI nimi", "value": "arvo" }
  ]
}

4. Jäsennelty ohje ("type": "structured_advice")
{
  "type": "structured_advice",
  "summary": "Yhteenveto tilanteesta",
  "meaning": "Mitä tämä tarkoittaa datan valossa",
  "recommendation": "Konkreettinen suositus/toimenpide",
  "next_step": "Seuraava askel käyttäjälle"
}

Jos vastaus on yleistä chattiä, palauta plain_text vastaus markdown-muotoiltuna.

Tärkeää:
Vastaa suomeksi. Ole aina kannustava. Älä syyllistä tai käytä negatiivista kieltä. Keskity seuraavaan askeleeseen.
    `;

    // 4. Initial Gemini API Call with Retry Logic for 503 Overloads
    const generateContentWithRetry = async (params: any, retries = 3, delayMs = 1000) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await ai.models.generateContent(params);
        } catch (err: any) {
          const errMsg = err?.message || "";
          const isRetryable = 
            errMsg.includes("503") || 
            errMsg.includes("UNAVAILABLE") || 
            errMsg.includes("high demand") ||
            errMsg.includes("429") ||
            errMsg.includes("RESOURCE_EXHAUSTED");
            
          if (isRetryable && i < retries - 1) {
            console.warn(`Gemini API error (503/429) encountered. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${retries})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2; // exponential backoff
            continue;
          }
          throw err;
        }
      }
      throw new Error("Tekoälypalvelin on ylikuormittunut. Yritä hetken kuluttua uudelleen.");
    };

    let response = await generateContentWithRetry({
      model,
      contents,
      config: {
        systemInstruction,
        // @ts-ignore: tools type mapping differences in SDK typings but fully supported by the API
        tools: chatTools,
      },
    });

    // 5. Function Calling Loop (execute tool calls if Gemini requests them)
    let functionCalls = response.functionCalls;
    console.log(`[route.ts] Gemini response functionCalls:`, JSON.stringify(functionCalls, null, 2));
    
    if (functionCalls && functionCalls.length > 0) {
      const toolResults: any[] = [];

      for (const call of functionCalls) {
        if (!call.name) continue;
        console.log(`[route.ts] Executing tool call: ${call.name} with args:`, JSON.stringify(call.args, null, 2));
        // Execute tool call server-side
        const result = await executeToolCall(call.name, call.args, user.id);
        console.log(`[route.ts] Tool execution result:`, JSON.stringify(result, null, 2));
        toolResults.push({
          functionResponse: {
            name: call.name,
            response: { result },
          },
        });
      }

      // Add tool calls and responses to the content history
      const updatedContents = [
        ...contents,
        {
          role: "model",
          parts: functionCalls.map((call) => ({ functionCall: call })),
        },
        {
          role: "user", // API requirement: tool responses are flagged as 'user' or 'tool' role depending on API protocol version
          parts: toolResults,
        },
      ];

      // Second round-trip to Gemini to convert database results into conversational reply
      response = await generateContentWithRetry({
        model,
        contents: updatedContents,
        config: {
          systemInstruction,
          // @ts-ignore
          tools: chatTools,
        },
      });
    }

    const reply = response.text || "Pahoittelut, en pystynyt käsittelemään pyyntöäsi.";

    // 6. Save message history to DB if threadId is provided
    if (threadId) {
      // Save User Message (with image prefix or CSV prefix if they exist)
      let userContentSave = latestMessage.content || "";
      if (latestImg) {
        userContentSave = `IMAGE:${latestImg}||${userContentSave}`;
      } else if (latestCsvContent) {
        userContentSave = `CSV:${latestCsvName}||${latestCsvContent}||${userContentSave}`;
      }

      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        role: "user",
        content: userContentSave,
      });

      // Save Assistant Reply
      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        role: "assistant",
        content: reply,
        tool_calls: functionCalls ? JSON.stringify(functionCalls) : null,
      });
    }

    return NextResponse.json({ reply, functionCalls });
  } catch (error: any) {
    console.error("Error in chat handler:", error);
    return NextResponse.json(
      { error: error?.message || "Tapahtui virhe viestin käsittelyssä." },
      { status: 500 }
    );
  }
}
