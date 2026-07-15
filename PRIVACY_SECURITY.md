# PRIVACY_SECURITY.md: Tietosuoja ja tietoturva

Tämä dokumentti kuvaa, miten sovelluksessa käsitellään, suojataan ja valvotaan käyttäjän arkaluonteisia terveys-, ravinto- ja sijaintitietoja.

## 1. Tietojen luokittelu ja suojaus
Kaikki käyttäjän syöttämät ja integraatioista haetut tiedot (paino, kehonkoostumus, unianalyysi, syke, ruokakuvat ja GPS-reitit) luokitellaan **arkaluonteisiksi henkilötiedoiksi** (GDPR artikla 9 mukaiset erityiset henkilötietoryhmät).

* **OAuth-tokenit**: Stravan access ja refresh tokenit tallennetaan tietokannan `oauth_tokens`-tauluun salattuna (esim. käyttäen AES-256-GCM -salausta ja sovelluksen palvelinpuolella säilytettävää salaisuusavainta `ENCRYPTION_SECRET`).
* **Storage-suojaus**: Ruokakuvat ja Garmin-tuontitiedostot ladataan yksityisiin Supabase Storage -koreihin (Bucket). Niitä ei koskaan jaeta julkisesti. Selaimelle kuvat välitetään lyhytikäisten allekirjoitettujen URL-osoitteiden avulla (Signed URLs, voimassaoloaika max 15 minuuttia).

## 2. Row Level Security (RLS) ja käyttöoikeudet
* Jokaisessa PostgreSQL-taulussa, joka sisältää käyttäjäkohtaista tietoa, on pakotettu Row Level Security (RLS).
* RLS-säännöt varmistavat, että käyttäjä (auth.uid()) voi lukea ja kirjoittaa vain omia rivejään.
* Service role -avainta (`service_role` / `SUPABASE_SERVICE_ROLE_KEY`) käytetään vain ja ainoastaan turvallisessa palvelinympäristössä (Next.js API-reiteissä) taustatehtäviin, kuten webhookien käsittelyyn tai migraatioihin. Sitä ei koskaan altisteta selaimelle.

## 3. Minimoidut lokitukset (Logging Constraints)
Jotta arkaluonteisia tietoja ei vuoda ulkoisiin lokijärjestelmiin (kuten Vercel Logs tai Axiom):
* Lokeihin **EI** saa koskaan tulostaa:
  - Käyttäjän painotietoja, kehonkoostumuslukuja tai uniarvoja.
  - Chatin viestien sisältöjä tai syötettyjä ruokatekstejä.
  - OAuth-tunnuksia, salasanoja tai API-avaimia.
  - Ruokakuvien binääri- tai base64-tietoa.
* Lokeihin kirjataan vain tekniset virheet, pyyntöjen reitit (ilman arkaluonteisia parametreja) sekä suoritusajat. Virhelokeissa käytetään anonyymejä tunnisteita.

## 4. Tekoälyturvallisuus ja Prompt Injection
* **Kontekstin rajaus**: Geminille lähetetään vain kulloisenkin tehtävän suorittamiseen tarvittava vähimmäiskonteksti. Esimerkiksi ruokakuvan analyysiin ei lähetetä käyttäjän koko chat-historiaa tai painotrendejä.
* **Prompt Injection**: Käyttäjän syöttämä teksti käsitellään aina epäluotettavana tietona. Järjestelmäohjeet (System Instructions) erotetaan selkeästi käyttäjän syötteestä.
* **Validointi**: Tekoälyn tekemät työkalukutsut (Function Calls) validoidaan palvelinpäässä ennen suoritusta. Esimerkiksi Gemini ei voi lukea tai muuttaa toisen käyttäjän tietoja, sillä tietokantatasolla pyyntö sidotaan aina istunnon todelliseen `user_id`-arvoon.

## 5. Käyttäjän oikeudet (GDPR-työkalut)
Käyttäjälle tarjotaan Profiili-näkymässä suorat toiminnot omien tietojensa hallintaan:
1. **Vie tiedot (JSON/CSV)**: Noutaa kaikki käyttäjän tietokantarivit ja muodostaa niistä ladattavan tiedotteen.
2. **Lataa kuvat**: Lataa ZIP-arkistossa kaikki käyttäjän lataamat ruokakuvat.
3. **Katkaise integraatiot**: Poistaa Stravan tokenit ja webhook-tapahtumat.
4. **Poista tili ja tiedot**: Suorittaa tietokannassa `DELETE FROM auth.users WHERE id = user_id`, mikä kaskadin (`ON DELETE CASCADE`) myötä poistaa pysyvästi kaikki käyttäjän mittaukset, ateriat, suunnitelmat ja kuvat.
5. **Suostumuksen hallinta**: Käyttäjä voi peruuttaa suostumuksensa tekoälypohjaiseen tietojenkäsittelyyn milloin tahansa, jolloin Gemini-ominaisuudet kytkeytyvät pois päältä.
