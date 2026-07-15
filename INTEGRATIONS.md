# INTEGRATIONS.md: Kolmannen osapuolen integraatiot

Tämä dokumentti kuvaa integraatiot Stravaan ja Garmin Connectiin, OAuth-kulun, webhookit ja tiedostojen tuonnin.

## 1. Strava API -integraatio

Integraation avulla suoritukset synkronoituvat reaaliaikaisesti Fat2Fit-sovellukseen.

### 1.1 OAuth 2.0 -kulku
1. Käyttäjä painaa sovelluksessa *"Yhdistä Strava"*.
2. Sovellus ohjaa käyttäjän Stravan suojatulle sivulle parametreilla:
   - `client_id` (ympäristömuuttujasta)
   - `redirect_uri` (`/api/integrations/strava/callback`)
   - `response_type=code`
   - `scope=activity:read_all`
   - `state` (satunnainen, CSRF-suojattu merkkijono, joka tallennetaan evästeeseen/kantaan ja tarkistetaan callbackissa).
3. Hyväksynnän jälkeen Strava ohjaa takaisin callback-osoitteeseen antaen `code`-parametrin.
4. Next.js Route Handler vaihtaa koodin tokeneihin (`access_token`, `refresh_token`, `expires_at`).
5. Tokenit tallennetaan salattuna `oauth_tokens`-tauluun. Refresh tokenia käytetään taustalla uusimaan access token sen vanhentuessa.

### 1.2 Webhookit (Reaaliaikainen synkronointi)
1. Rekisteröidään webhook-tilaus Stravan API:in osoitteeseen `/api/integrations/strava/webhook`.
2. **Vahvistusvaihe (Subscription Validation)**: Strava tekee GET-pyynnön, johon reitin on vastattava haastekoodilla (`hub.challenge`).
3. **Tapahtumien vastaanotto**: Strava lähettää POST-pyynnön aina kun käyttäjä luo, päivittää tai poistaa suorituksen.
   - Reitti palauttaa heti `HTTP 200 OK`, jotta yhteys ei katkea.
   - Käsittely siirretään taustaprosessiin (Next.js serverless -ympäristössä pyyntö suoritetaan loppuun, tai käytetään taustajonoa).
   - Estetään duplikaattien käsittely tarkistamalla `external_event_id` `integration_events`-taulusta (katso idempotenttisuus).

---

## 2. Garmin Connect -integraatio

Ensimmäisessä vaiheessa Garmin Index -vaa'an ja kellon mittaukset tuodaan tiedostotuonnilla.

### 2.1 Garmin-tiedostojen käsin tuonti
* Sijainti: `Asetukset -> Integraatiot -> Garmin -> Tuo tiedosto`
* Tuetut tiedostomuodot:
  - **CSV**: Garmin Connectista viety paino- ja kehonkoostumushistoria. Parsitaan huomioiden suomalaiset (pilkkulla erotetut) ja englantilaiset desimaalit sekä sarakeotsikot.
  - **FIT**: Suora kellon luoma suoritustiedosto. Parsitaan binäärimuodosta lukien suorituksen pituus, matka, sykkeet ja kalorit.
  - **TCX/GPX**: XML-pohjaiset reitti- ja suoritustiedostot.
  - **ZIP**: Paketti, joka voi sisältää useita edellä mainituista tiedostoista.

### 2.2 Virallinen Garmin API (Placeholder-valmius)
* Feature flag: `GARMIN_OFFICIAL_API_ENABLED=false` (Asetetaan `true` vain jos virallinen yritystunnus ja Garmin Connect Developer Program -hyväksyntä saadaan).
* **Rajapinta (`HealthDataProvider`)**:
  Kaikki terveysdatan lukijat toteuttavat saman rajapinnan, jotta sovelluksen ydinosat eivät ole riippuvaisia siitä, mistä lähteestä data on peräisin (Strava, Garmin-tiedosto tai tuleva virallinen API).

---

## 3. Idempotenttisuus ja duplikaattien esto

Saman aktiviteetin tuominen useasta lähteestä (esim. Strava-synkronointi ja Garmin Connect FIT-tiedoston lataaminen käsin) estetään luomalla suoritukselle yksilöllinen sormenjälki (fingerprint):

```ts
type ActivityFingerprint = {
  userId: string;
  startedAt: string;       // UTC-aika sekunnin tarkkuudella
  durationSeconds: number; // Kesto sekunteina
  activityType: string;    // Laji normalisoituna
}
```

Tietokantaan luodaan uniikki-indeksi näiden kenttien yhdistelmälle. Jos yritetään lisätä suoritusta, jolla on sama sormenjälki, tietokantavirhe estää tallennuksen ja tapahtuma merkitään lokiin tilaksi `ignored_duplicate`.
