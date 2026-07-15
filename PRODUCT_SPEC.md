# PRODUCT_SPEC.md: Fat2Fit Tuotemäärittely

## 1. Yleiskuvaus
**Fat2Fit** on henkilökohtaiseen käyttöön tarkoitettu responsiivinen full-stack-verkkosovellus, joka auttaa käyttäjää hallitsemaan painoaan, parantamaan kehonkoostumustaan ja optimoimaan harjoitteluaan sekä ravitsemustaan. Sovelluksen keskiössä on tiedon keräämisen sijasta käytännön valintojen helpottaminen arjessa sekä mukautuvuus käyttäjän senhetkiseen palautumistilaan.

## 2. Kohdekäyttäjä ja Käyttöoikeudet
* **Pääasiallinen kohderyhmä**: Yksi henkilökohtainen käyttäjä (omaan käyttöön).
* **Käyttöoikeudet**: Rajataan ympäristömuuttujalla `ALLOWED_USER_EMAIL`. Jos sähköposti ei täsmää, pääsy evätään. Kaikesta huolimatta sovelluksessa käytetään monen käyttäjän arkkitehtuuria (`user_id` kaikissa tietokantatauluissa ja RLS-säännöt käytössä).

## 3. Keskeiset Toiminnallisuudet
1. **Onboarding**: Kerää perustiedot (ikä, pituus, paino, fysiologia), sanallisen tavoitteen sekä liikunta- ja ravintoasetukset.
2. **Tavoitejärjestelmä**: Muuntaa sanallisen tavoitteen Gemini AI:n avulla rakenteisiksi tavoitteiksi (paino, rasvaprosentti, lihasmassa, aikataulu, reunaehdot) ja mahdollistaa niiden versionnin.
3. **Tänään-näkymä**: Yhteenveto päivän kaloreista, makroista, harjoituksista, unesta, painotrendistä ja kolmesta tärkeimmästä toimenpiteestä.
4. **Aamukirjaus**: Kehon koostumuksen, unen laadun ja subjektiivisen tilan (stressi, väsymys) nopea kirjaaminen.
5. **Ravintoseuranta**:
   - Integroitu Fineli-haku (tallennetaan omaan kantaan).
   - Ruokakuvien Gemini-pohjainen analyysi (ainesosat, määräarviot virhemarginaaleineen) ja vahvistusnäkymä.
   - Reseptien ja suosikkiaterioiden hallinta.
6. **Liikunta ja Suunnittelu**:
   - 7 päivän perussuunnitelma.
   - 72 tunnin mukautuva suunnitelma, joka reagoi uneen, stressiin ja toteumaan.
7. **Chatbot (AI Coach)**: Kontekstitietoinen valmentaja, joka ymmärtää käyttäjän datan, osaa suorittaa tietokantakirjauksia (tool calling), tulkitsee monimutkaisia viestejä ja tukee kumousta (Undo).
8. **Integraatiot**:
   - Strava OAuth 2.0 & Webhookit (aktiviteettien automaattinen haku ja yhdistäminen suunnitelmaan).
   - Garmin Connect -tiedostotuonti (FIT, TCX, GPX, CSV, ZIP) ja valmius viralliselle API:lle.
9. **Raportointi**:
   - Progress-kaavio (toteutunut paino vs. 7 päivän tasoitettu trendi vs. tavoiteura ja tavoitealue).
   - Ennusteet 28 päivän datan regressiomallilla.
   - Automaattiset viikkoraportit.
10. **Muistutukset**: Push-ilmoitukset (Service Worker & Web Push) sekä sovelluksen sisäiset muistutukset aamutoimista, aterioista ja nukkumaanmenosta.

## 4. Rajaukset (Ei toteuteta versiossa 1)
* Ei natiiveja iOS/Android-sovelluksia (käytetään responsiivisena verkkosovelluksena puhelimen selaimella).
* Ei suoria HealthKit/Google Fit -integraatioita (liikuntadata Stravan kautta).
* Ei lääkinnällistä diagnostiikkaa tai syömishäiriöiden hoitoon tarkoitettua ohjausta.
* Ei sosiaalisia ominaisuuksia, kaverilistoja tai julkisia profiileja.
* Ei maksujärjestelmää.
* Ei Garmin Connectin epävirallista scrapausta tai salasanojen kyselyä.
