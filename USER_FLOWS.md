# USER_FLOWS.md: Fat2Fit Käyttäjäpolut

Tämä dokumentti kuvaa sovelluksen tärkeimmät käyttäjäpolut (User Flows) ja niiden askeleet.

## 1. Onboarding ja Tavoitteen Asettaminen
1. **Kirjautuminen**: Käyttäjä kirjautuu sisään Supabase Auth -sivulla. Jos sähköposti täsmää `ALLOWED_USER_EMAIL`-muuttujan kanssa, hän pääsee eteenpäin.
2. **Perustietolomake**: Käyttäjä syöttää nimensä, ikänsä, pituutensa, painonsa ja sukupuolensa (fysiologisen profiilin).
3. **Sanallinen tavoite**: Käyttäjä kirjoittaa vapaasti tavoitteensa (esim. "Haluan laihtua 90 kiloon jouluun mennessä, mutta pitää lihakset").
4. **Tavoitteen tulkinta**: Gemini API käsittelee tekstin taustalla ja palauttaa rakenteisen `GoalInterpretation`-objektin.
5. **Vahvistussivu**: Käyttäjä näkee tulkinnan ja voi korjata tavoitepäivää, painoa, sallittua tahtia tai AI:n tekemiä oletuksia.
6. **Tallennus**: Järjestelmä tallentaa tavoitteen aktiiviseksi versioksi ja luo tavoiteuran.

## 2. Aamurutiini (Aamukirjaus)
1. **Aloitus**: Käyttäjä avaa sovelluksen ja näkee Tänään-näkymässä kehotteen: "Et ole vielä kirjannut aamun painoa. Tee aamukirjaus tästä."
2. **Kirjaaminen (Lomake / Chat / Puhe)**:
   - Käyttäjä avaa lomakkeen, joka näyttää edellisen päivän oletusarvot.
   - Hän syöttää painon (esim. 92.5 kg), unen laadun (4/5) ja stressitason (2/5).
   - Vaihtoehtoisesti hän sanoo chatissa: "Paino 92.5 kg, nukahdin helposti ja uni oli hyvää."
3. **Päivitys**: Järjestelmä tallentaa mittaukset ja päivittää Tänään-näkymän painotrendin sekä 72h mukautuvan suunnitelman (tarvittaessa).

## 3. Ruoan Kirjaaminen Valokuvalla
1. **Kuvaus**: Käyttäjä ottaa lautasestaan kuvan tai valitsee valmiin kuvan puhelimestaan.
2. **Esikäsittely**: Käyttäjä valitsee lautasprofiilin (esim. "iso ruokalautanen 27cm") ja kirjoittaa halutessaan lisätekstin ("kanaa ja riisiä sekä vähän salaattia").
3. **AI-analyysi**: Gemini analysoi kuvan ja lautasprofiilin suhteessa annoskokoon, arvioi ainesosat ja grammamäärät (minimi, todennäköisin, maksimi) ja etsii Fineli-tietokannasta parhaat vastaavuudet.
4. **Vahvistus ja Korjaus**: Käyttäjä näkee analyysin erittelyn. Hän voi muuttaa määriä tai vaihtaa ehdotettua Fineli-tuotetta.
5. **Tallennus**: Ateria tallennetaan ja päivän kalori- sekä makrokertymät lasketaan uudelleen.

## 4. Liikuntasuorituksen Synkronointi (Strava Webhook)
1. **Suoritus**: Käyttäjä tekee juoksulenkkeilyn Garmin-kellollaan, joka synkronoituu automaattisesti Stravan kanssa.
2. **Webhook**: Strava lähettää webhook-tapahtuman `fat2fit`-palvelimelle.
3. **Prosessi**: Järjestelmä tarkistaa duplikaatit, noutaa aktiviteetin tarkat tiedot Stravan API:sta ja normalisoi ne.
4. **Sovitus**: Järjestelmä etsii sille suunnitellun harjoituksen (Planned Workout) ja merkitsee sen toteutuneeksi (Completed) automaattisesti, jos kesto ja laji täsmäävät.
5. **Chat-ilmoitus/Tänään-päivitys**: Käyttäjä saa ilmoituksen "Toteutunut juoksu (5.2 km) yhdistetty suunnitelmaasi."

## 5. Keskustelu Valmentajan Kanssa ja Muutosten Kumous (Undo)
1. **Kysymys**: Käyttäjä kirjoittaa chattiin: "Olo on todella väsynyt ja jalat ovat jumissa eilisen kyykkytreenin jäljiltä."
2. **AI Coach -analyysi**: Gemini lukee käyttäjäkontekstin (aktiivinen tavoite, viimeaikaiset treenit, aamun kirjaus) ja ehdottaa 72 tunnin suunnitelmaan kevennystä (`createPlanAdjustmentProposal`).
3. **Vahvistus**: Chatbot kysyy: "Haluatko, että vaihdan tämän päivän kovan voimaharjoituksen 30 minuutin kevyeksi liikkuvuusharjoitukseksi?"
4. **Hyväksyntä**: Käyttäjä vastaa: "Kyllä, tee niin."
5. **Kumous (Undo)**: Jos käyttäjä katuu tai teki virheen, hän voi sanoa chattiin "kumoa" tai painaa kumouspainiketta, jolloin edellinen tietokantamuutos palautetaan alkutilaan.
