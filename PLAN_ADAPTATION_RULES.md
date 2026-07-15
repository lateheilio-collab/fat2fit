# PLAN_ADAPTATION_RULES.md: Suunnitelman mukautussäännöt

Tämä dokumentti kuvaa säännöt, joiden perusteella 72 tunnin mukautuvaa suunnitelmaa päivitetään käyttäjän antaman palautteen, suoritusten ja mittausten pohjalta.

## 1. Yleisperiaatteet
* Suunnitelman mukautus ei perustu pelkkään kielimallin (Gemini) vapaaseen päättelyyn.
* Käytetään **hybridimallia**:
  1. **Sääntömoottori** havaitsee poikkeamat ja rajaa sallitut toimenpiteet (esim. siirto, kevennys, peruminen).
  2. **Gemini** muotoilee muutoksesta käyttäjälle ymmärrettävän, kannustavan perustelun.
  3. Käyttäjä vahvistaa merkittävät muutokset (kuten treenien poistot tai kaloritavoitteen pysyvät muutokset).

---

## 2. Mukautusskenaariot ja Säännöt

### 2.1 Huono uni ja matala energiataso
* **Laukaisija**: Aamukirjauksessa `sleep_hours < 6.0` tai `sleep_quality <= 2` TAI `energy_level <= 2`.
* **Sääntö**:
  - Jos tälle päivälle on suunniteltu "Hard" tai "Very Hard" harjoitus:
    - Muutetaan harjoituksen tyyppi "Recovery" tai "Easy" -harjoitukseksi.
    - Lyhennetään kestoa 30–50 %.
    - Vaihtoehtoisesti siirretään kova harjoitus seuraavalle päivälle (edellyttäen, että seuraava päivä on lepopäivä ja viikon kokonaiskuormitus ei ylity).
    - Älä peruta harjoitusta kokonaan, ellei käyttäjä sitä erikseen pyydä.
  - Ravintotavoitetta **ei muuteta** (ei vähennetä kaloreita unettomuuden takia, sillä se voi lisätä stressiä ja heikentää palautumista edelleen).

### 2.2 Korkea lihasarkuus (Soreness)
* **Laukaisija**: Aamukirjauksessa `soreness_level >= 4`.
* **Sääntö**:
  - Tarkistetaan suunnitellun harjoituksen tyyppi. Jos kyseessä on saman lihasryhmän kuntosalitreeni:
    - Siirretään treeniä 24 tunnilla eteenpäin.
    - Ehdotetaan tilalle palauttavaa kävelyä tai liikkuvuusharjoitusta.
  - Jos kyseessä on kevyt aerobinen harjoitus, pidetään se ennallaan, mutta lisätään huomautus: *"Tee harjoitus rauhallisesti lihaksia verrytellen."*

### 2.3 Väliin jäänyt harjoitus (Missed Workout)
* **Laukaisija**: Suunnitellun harjoituksen alkamisaika on ohitettu $> 12$ tuntia ilman toteutunutta aktiviteettilinkitystä.
* **Sääntö**:
  - Ei syyllistävää palautetta.
  - Kysytään chatin kautta: *"Huomasin, että eilinen juoksulenkki jäi välistä. Haluatko siirtää sen tälle päivälle, korvata sen lyhyemmällä versiolla vai jättää kokonaan väliin tältä viikolta?"*
  - Jos käyttäjä ei vastaa, treeni merkitään tilaksi `skipped` ja viikon kokonaiskuorma päivitetään. Kovia harjoituksia ei koskaan kasata peräkkäisille päiville.

### 2.4 Suunnitelman ylittänyt syöminen (Calorie Surplus Deviation)
* **Laukaisija**: Päivittäinen energiansaanti ylittää tavoitteen $> 400$ kcal.
* **Sääntö**:
  - **ÄLÄ** määrää rangaistuspaastoa seuraavalle päivälle.
  - **ÄLÄ** lisää automaattisesti kovaa rangaistusliikuntaa.
  - Ohjeistetaan palamaan normaaliin suunnitelmaan heti seuraavalla aterialla.
  - Jos ylitys toistuu usein, Gemini ehdottaa peruskaloritavoitteen nostamista (esim. liian tiukan vajeen löysäämistä), jotta nälänhallinta helpottuu.

---

## 3. Versioinnin säännöt
Aina kun suunnitelmaan (`plans`) tehdään mukautuksia:
1. Luodaan uusi rivi `plan_adjustments`-tauluun, johon kirjataan syy (`reason_code`), vanha tila ja uusi tila.
2. Alkuperäinen suunniteltu harjoitus pidetään tallessa tilassa `moved` tai `cancelled`, ja luodaan uusi korvaava `PlannedWorkout`.
3. Käyttäjä voi perua mukautuksen `undoPlanAdjustment`-kutsulla, jolloin uusi suunnitelmarivi poistetaan ja edellinen palautetaan aktiiviseksi.
