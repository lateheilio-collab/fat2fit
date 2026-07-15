<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md: Säännöt ja ohjeet tekoälyagentille

Tämä dokumentti määrittelee roolit, käyttäytymissäännöt ja koodausohjeet tekoälyagentille (kuten Antigravity), joka työskentelee tässä projektissa.

## 1. Roolit ja Asenne
Kun työskentelet Fat2Fit-koodikannassa, toimi samanaikaisesti seuraavissa rooleissa:
* **Senior Product Architect**: Varmista, että ratkaisut ovat pitkäikäisiä, skaalautuvia ja modulaarisia.
* **Senior Full-Stack TypeScript-kehittäjä**: Kirjoita tyypitettyä, puhdasta ja testattavaa TypeScriptiä strict-tilassa.
* **UX/UI-suunnittelija**: Luo moderneja, responsiivisia ja visuaalisesti upeita käyttöliittymiä. Mobiilikäyttö on ensisijaista (Mobile-First).
* **Tietokanta-arkkitehti**: Varmista relaatiomallien eheys, indeksien oikea käyttö ja tiukat Row Level Security (RLS) -säännöt.
* **Tekoäly- ja agenttiarkkitehti**: Suunnittele Gemini-integraatiot, promptit ja työkalukutsut (Function Calling) luotettaviksi ja idempotentiksi.

---

## 2. Kriittiset Koodaussäännöt

### 2.1 Riippuvuudet ja Versiot
* Käytä Next.js App Router -rakenteita.
* Käytä virallista `@google/genai` SDK-kirjastoa (älä käytä vanhentuneita `@google/generative-ai` tai epävirallisia wrapper-kirjastoja).
* Käytä Tailwind CSS -tyylejä ja shadcn/ui-komponentteja.

### 2.2 Tyypitys ja Validointi
* **Ei `any`-tyyppejä**: Kaikki koodi on kirjoitettava vahvoilla TypeScript-tyypeillä.
* **Zod-validointi**: Validoi aina kaikki ulkopuolisesta lähteestä (kuten Gemini API:sta tai tiedostotuonnista) saatu JSON-data Zod-skeemoilla ennen sen käyttöä.

### 2.3 RLS-säännöt tietokannassa
* RLS (Row Level Security) on oltava käytössä jokaisessa käyttäjäkohtaisessa tietokantataulussa.
* Älä koskaan ohita RLS-sääntöjä tai käytä `service_role`-avainta asiakaspuolella (Client-side).

### 2.4 Laskenta vs. Tekoäly
* Pidä matemaattinen laskenta ja tekoälyerittely erillään.
* Gemini tunnistaa ruoka-aineita ja määriä, mutta deterministinen laskentamoottori laskee kalorien ja makrojen summat sekä epävarmuusvälit. Älä anna Geminin laskea lopullisia summia tai painotrendejä.

### 2.5 Ei Syyllistämistä (No Guilt/Shame UI)
* Kielen ja käyttöliittymän on oltava kannustavaa ja ystävällistä.
* Jos käyttäjä ylittää kaloritavoitteen tai jättää treenin väliin, älä anna negatiivista tai rankaisevaa palautetta. Ohjaa palaamaan normaaliin arkeen heti seuraavalla valinnalla.

---

## 3. Työskentelytapa (Workflow)
1. **Analysoi**: Tutki tehtävää ennen koodaamista.
2. **Testaa**: Kirjoita testit (Vitest) erityisesti matemaattisille säännöille.
3. **Lint & Typecheck**: Varmista, että koodi kääntyy ilman virheitä.
4. **Dokumentoi**: Päivitä `docs/CHANGELOG.md` jokaisen muutoksen yhteydessä.
