# TEST_PLAN.md: Testaussuunnitelma

Tämä dokumentti kuvaa testausstrategian, testitasot, testausympäristöt sekä testien suorittamiseen käytettävät komennot.

## 1. Testausstrategia ja työkalut
Laadunvarmistus on jaettu neljään pääluokkaan:

1. **Yksikkötestit (Unit Tests)**:
   - Kohde: Laskentasäännöt, kaavat (Mifflin–St Jeor, EMA-painotrendi, kalorikalibrointi) ja tiedostoparserit (Garmin CSV/FIT).
   - Työkalu: **Vitest**.
2. **Integraatiotestit (Integration Tests)**:
   - Kohde: API-reitit (esim. Strava-callback, webhook-idempotenttisuus) ja Gemini SDK -kutsut (mockatulla API-vastauksella).
   - Työkalu: **Vitest** + **MSW (Mock Service Worker)**.
3. **Tietokantatestit (RLS-testit)**:
   - Kohde: Row Level Security (RLS) -sääntöjen toiminta ja pääsynesto muiden käyttäjien tietoihin.
   - Työkalu: **Supabase CLI** (`supabase test db`) pgTAP-laajennuksen avulla.
4. **E2E-testit (End-to-End)**:
   - Kohde: Kriittiset käyttäjäpolut (Onboarding, kirjautuminen, aamukirjaus, ruokakuvan vahvistus, chat-kumous).
   - Työkalu: **Playwright**.

---

## 2. Testien suorittaminen (Komennot)

### 2.1 Yksikkö- ja integraatiotestit
Ajetaan paikallisessa kehitysympäristössä:
```bash
# Ajetaan kaikki yksikkötestit kerran
npm run test:unit

# Ajetaan yksikkötestit watch-tilassa kehityksen aikana
npm run test:watch

# Ajetaan testikattavuusraportti (coverage)
npm run test:coverage
```

### 2.2 Supabase RLS -testit
Edellyttää, että paikallinen Supabase CLI ja Docker ovat käynnissä:
```bash
# Käynnistetään paikallinen Supabase
supabase start

# Ajetaan RLS- ja tietokantatestit (pgTAP)
supabase test db
```

Esimerkkitestitapahtuma pgTAP-tiedostossa (`supabase/tests/rls_test.sql`):
```sql
BEGIN;
SELECT plan(3);

-- Testataan RLS-estoa
SELECT lives_ok(
    $$ SELECT * FROM body_measurements $$,
    'Käyttäjä voi lukea omia mittauksiaan'
);

-- Testataan toisen käyttäjän estoa
SELECT throws_like(
    $$ INSERT INTO body_measurements (user_id, metric, value) VALUES ('toinen-uuid', 'weight', 85) $$,
    '%violates row-level security policy%',
    'Ei voi lisätä mittausta toisen käyttäjän ID-tunnuksella'
);

SELECT * FROM finish();
ROLLBACK;
```

### 2.3 Playwright E2E -testit
```bash
# Asennetaan Playwrightin tarvitsemat selaimet (ensimmäisellä kerralla)
npx playwright install

# Ajetaan E2E-testit
npm run test:e2e

# Avataan Playwrightin visuaalinen käyttöliittymä (UI mode)
npm run test:e2e-ui
```

---

## 3. Jatkuva integraatio (CI)
GitHub Actions -työnkulku (`.github/workflows/test.yml`) ajaa automaattisesti jokaisen Pull Requestin ja Pushin yhteydessä:
1. `npm ci` (riippuvuuksien asennus lukitussa tilassa)
2. `npm run lint` (linter-tarkistus)
3. `npm run typecheck` (TypeScript-tyyppitarkistus)
4. `npm run test:unit` (Vitest-yksikkötestit)
5. `supabase start` ja `supabase test db` (RLS-tietokantatestit)
6. `npm run build` (Next.js-tuotantoversion rakennustesti)
