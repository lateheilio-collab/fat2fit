# IMPLEMENTATION_PLAN.md: Toteutussuunnitelma ja vaiheistus

Tämä dokumentti kuvaa Fat2Fit-sovelluksen kehitysvaiheet, tehtävät ja aikataulun.

## 1. Kehitysmetodologia ja vaiheet
Projekti toteutetaan 9 vaiheessa (Vaihe 0 – Vaihe 8). Jokaisen vaiheen jälkeen suoritetaan linter-tarkistukset, tyyppitarkistukset ja testit ennen seuraavaan vaiheeseen siirtymistä.

---

## 2. Vaihekohtaiset Tehtävät

### Vaihe 0: Määrittely ja arkkitehtuuri (Nykyinen vaihe)
* [x] Vaatimusmäärittely (`PRODUCT_SPEC.md`)
* [x] Käyttäjäpolut (`USER_FLOWS.md`)
* [x] UI/UX-määrittely (`UX_UI_SPEC.md`)
* [x] Järjestelmäarkkitehtuuri (`ARCHITECTURE.md`)
* [x] Tietokantamalli (`DATA_MODEL.md`)
* [x] Tekoälymäärittely (`AI_ARCHITECTURE.md`, `AI_TOOL_CONTRACTS.md`)
* [x] Laskentasäännöt (`CALCULATION_RULES.md`)
* [x] Mukautussäännöt (`PLAN_ADAPTATION_RULES.md`)
* [x] Integraatiomäärittely (`INTEGRATIONS.md`)
* [x] Tietoturva ja tietosuoja (`PRIVACY_SECURITY.md`)
* [x] Testisuunnitelma (`TEST_PLAN.md`)
* [x] Kehitysohjeet (`AGENTS.md`, `CONTEXT.md`, `USER_GUIDE.md`)

### Vaihe 1: Projektipohja ja käyttäjähallinta
* [ ] Next.js-projektin alustus Tailwind CSS- ja TypeScript strict-tilassa.
* [ ] Supabase CLI -kehitysympäristön pystytys (paikallinen Docker-tietokanta).
* [ ] Kirjautumissivun ja profiilinhallinnan toteutus.
* [ ] `ALLOWED_USER_EMAIL` -tarkistuksen käyttöönotto middleware-tasolla.
* [ ] Perusnavigaation rakentaminen (Mobile Bottom Nav & Desktop Sidebar).

### Vaihe 2: Tavoitteet ja aamukirjaus
* [ ] Onboarding-kyselyvaiheiden toteutus.
* [ ] Sanallisen tavoitteen Gemini-pohjainen tulkintarajapinta.
* [ ] Tavoitteiden vahvistus- ja muokkausnäkymä.
* [ ] Aamukirjauslomakkeen (paino, uni, stressi jne.) ja tietojen tallennuksen toteutus.

### Vaihe 3: Ravintoseuranta
* [ ] Fineli-elintarviketietokannan import-skripti Supabaseen.
* [ ] Fineli-pikahaku ja manuaalinen ruokien kirjaus.
* [ ] Ruokakuvan Gemini-pohjainen analyysirajapinta (multimodal).
* [ ] Aterioiden vahvistussivu ja päivittäiset kalorilaskennat.

### Vaihe 4: Liikunta ja suunnittelu
* [ ] Suosikkiliikuntamuotojen ja harjoituspohjien luonti.
* [ ] 7 päivän viikoittaisen perussuunnitelman hallintakortit.
* [ ] 72 tunnin mukautuvan suunnitelman sääntömoottorin toteutus.
* [ ] Suunnitelmien versiointilokin tallennus tietokantaan.

### Vaihe 5: Chatbot (AI Coach)
* [ ] Gemini Chatbot -integraatio ja keskusteluhistorialokin tallennus.
* [ ] Työkalukutsut (Function calling) tietojen lukemiseen ja kirjoittamiseen.
* [ ] Usean kirjauksen tulkinta yhdestä chat-viestistä.
* [ ] Kumoa-toiminto (Undo) chatbotin tekemille tietokantamuutoksille.

### Vaihe 6: Integraatiot
* [ ] Strava OAuth 2.0 -kirjautumisreitit ja token-salaus.
* [ ] Strava webhook-vastaanotin (idempotenttisuuden ja duplikaattien estolla).
* [ ] Garmin CSV- ja FIT-tiedostojen tuontiparsija.
* [ ] Yhteisen `HealthDataProvider`-rajapinnan ja provider-luokkien alustus.

### Vaihe 7: Raportointi ja muistutukset
* [ ] Progress-kaavio (toteutunut paino, trendi, tavoitealue ja -ura) Rechartsilla.
* [ ] Painon regression ja ennusteiden laskentakerros (28d EMA).
* [ ] Automaattiset viikkoraportit.
* [ ] Push-ilmoitukset ja Service Worker -integraatio muistutuksille.

### Vaihe 8: Auditointi ja julkaisu
* [ ] Yksikkötestien kirjoitus laskentasäännöille.
* [ ] Supabase pgTAP RLS-testien kirjoitus.
* [ ] E2E-testien suorittaminen Playwrightilla kriittisille poluille.
* [ ] Vercel-julkaisuohjeiden testaus ja sovelluksen vienti tuotantoon.
* [ ] Lopullinen walkthrough.
