# AI_ARCHITECTURE.md: Tekoälyarkkitehtuuri ja mallien hallinta

Tämä dokumentti määrittelee Fat2Fit-sovelluksen tekoälyarkkitehtuurin, käytetyt mallit, promptien versioinnin sekä API-kutsut.

## 1. Yleisperiaatteet
* **Valittu SDK**: Virallinen Google GenAI SDK (`@google/genai`).
* **Sertifiointi ja laatu**: Tekoälyn palauttamat tiedot validoidaan aina Zod-skeemoilla. Mallin palauttamaa vapaamuotoista tekstiä ei koskaan luoteta suoraan numeeriseen laskentaan.
* **Mallikonfiguraatio**: Mallien nimiä ja versioita ei kovakoodata koodiin. Niitä hallinnoidaan ympäristömuuttujilla:
  - `GEMINI_CHUNKY_MODEL` (esim. `gemini-1.5-flash` aamukirjauksiin, ruokakuva-analyyseihin ja nopeisiin chatteihin).
  - `GEMINI_REASONING_MODEL` (esim. `gemini-1.5-pro` tavoitteiden tulkintaan ja monimutkaiseen valmennuskeskusteluun).
  - `GEMINI_API_KEY` (Gemini API-avain).

## 2. Toiminnalliset tekoäly-yhteydet

### 2.1 Onboarding ja tavoitteen tulkinta
* **Tarkoitus**: Muuttaa käyttäjän vapaamuotoinen sanallinen tavoite rakenteelliseksi tiedoksi.
* **Malli**: `GEMINI_REASONING_MODEL`
* **Vastaustyyppi**: Structured Output (`responseSchema` konfiguroitu Gemini SDK:ssa).
* **Tiedonkulku**:
  1. Käyttäjä syöttää tavoitetekstin.
  2. Next.js Route Handler kutsuu Geminiä lähettäen tavoitteen ja järjestelmäohjeen.
  3. Gemini palauttaa JSON-rakenteen, joka validoidaan Zod-skeemaan `GoalInterpretation`.
  4. Käyttäjälle näytetään vahvistusnäyttö.

### 2.2 Ruokakuvan analyysi
* **Tarkoitus**: Tunnistaa aterian ainesosat, grammat ja ehdottaa Fineli-vastineita.
* **Malli**: `GEMINI_CHUNKY_MODEL` (monikielinen, tukee kuvansyöttöä).
* **Syötteet**: Ruokakuva (tallennetaan väliaikaisesti ja poistetaan metatiedot), käyttäjän vapaa lisäkuvaus, lautasen tai astian halkaisija/tilavuusprofiili.
* **Prosessi**:
  1. Gemini saa kuvan ja astiatiedon.
  2. Gemini tunnistaa ainesosat ja laskee todennäköisimmän grammamäärän sekä minimi- ja maksimivaihteluvälit.
  3. Järjestelmä hakee Finelistä vastaavat elintarvikkeet Gemini-hakusanoilla.
  4. Vahvistussivulla käyttäjä voi muuttaa arvoja.

### 2.3 Coach Chatbot ja työkalukutsut (Function Calling)
* **Tarkoitus**: Käyttäjän henkilökohtainen AI Coach, joka voi lukea ja kirjoittaa käyttäjän tietoja.
* **Malli**: `GEMINI_REASONING_MODEL`
* **Työkalujen toiminta**:
  - Gemini käyttää **Function Calling** -ominaisuutta ilmoittaakseen halustaan lukea tai kirjoittaa kantaan.
  - Esimerkiksi jos käyttäjä sanoo *"Paino oli aamulla 91.8 kg"*, Gemini palauttaa työkalukutsun `logBodyMeasurement(metric="weight", value=91.8, source="chat")`.
  - Next.js API-reitti suorittaa tietokantakyselyn, palauttaa tuloksen Geminille, ja Gemini vastaa käyttäjälle vahvistuksella.
* **Kontekstin lataaminen**: Jokaisessa chat-viestissä Geminille syötetään "Conversation System Context", johon ladataan käyttäjän nykyinen profiili, aktiiviset tavoitteet, tämän päivän kalori- ja treenitilanne sekä viimeisin paino.

## 3. Prompt-versiointi ja auditointi
Jokaisesta AI-analyysistä ja chatin työkalukutsusta tallennetaan tietokantaan loki (`ai_analysis_results` tai `ai_tool_calls`), joka sisältää:
- Käytetty malli ja versio.
- Promptin versionumero (hallinnoidaan koodissa).
- Käyttäjän antama palaute (`ai_feedback` - peukku ylös/alas ja kommentti).
- Syötteen tiiviste (`input_data_hash`) duplikaattikutsujen ehkäisemiseksi.
