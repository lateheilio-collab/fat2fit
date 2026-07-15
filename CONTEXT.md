# CONTEXT.md: Projektin kehitys- ja ajoympäristön konteksti

Tämä dokumentti auttaa kehittäjää ja tekoälyagentteja ymmärtämään koodikannan rakenteen ja ajonaikaisen kontekstin.

## 1. Kehitysympäristö ja Riippuvuudet
* **Kieli**: TypeScript strict-tilassa.
* **Kehys**: Next.js (App Router), React 19.
* **Tyylittely**: Tailwind CSS & shadcn/ui.
* **Tietokanta**: Supabase (PostgreSQL, Auth, Storage, Edge Functions, pg_cron).
* **Tekoäly**: Google Gemini API SDK (`@google/genai`).
* **Kaaviot**: Recharts (responsiiviset, kontrastirikkaat ja esteettömät).
* **Testaus**: Vitest, React Testing Library ja Playwright.

---

## 2. Hakemistorakenne (Tärkeimmät sijainnit)
* `/src/app/` - Next.js-reitit ja sivukomponentit.
* `/src/components/` - Uudelleenkäytettävät käyttöliittymäkomponentit.
* `/src/lib/` - Taustalogiikka, matemaattiset kaavat, integraatioiden hallinta ja tekoälyn SDK-kutsut.
* `/supabase/migrations/` - SQL-migraatiotietokannan tauluille ja RLS-säännöille.
* `/tests/` - Vitest- ja Playwright-testitiedostot.

---

## 3. Ajonaikaiset oletukset ja normalisointi
* **Aikavyöhyke**: `Europe/Helsinki` (ajankohdat tallennetaan UTC-muodossa, mutta käsitellään ja näytetään tässä aikavyöhykkeessä).
* **Oletusyksiköt**:
  - Paino: `kg`
  - Pituus ja vyötärö: `cm`
  - Energia: `kcal`
  - Makroravinteet: `g`
  - Etäisyys: `km`
  - Kesto: `minuutit`
  - Neste: `ml` tai `l`
* Yksiköiden normalisointi tehdään omassa testatussa kerroksessaan (`src/lib/calculations/normalization.ts`).

---

## 4. Kehitysputki (Workflow)
Kehittäjän tai agentin tulee noudattaa seuraavaa rutiinia jokaisen koodimuutoksen jälkeen:
1. Aja `npm run lint` (linter).
2. Aja `npm run typecheck` (TypeScript-tarkistus).
3. Aja testit (`npm run test:unit`).
4. Varmista toimivuus selaimessa.
5. Päivitä `docs/CHANGELOG.md` tehdyistä muutoksista.
