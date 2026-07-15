# Fat2Fit Vercel- ja Supabase-julkaisuohje

Tämä dokumentti ohjaa Fat2Fit-sovelluksen julkaisussa Supabaseen ja Verceliin.

---

## 1. Ympäristömuuttujat (.env)

Määritä seuraavat ympäristömuuttujat Vercelin hallintapaneelissa (Settings -> Environment Variables) sekä paikallisessa `.env.local`-tiedostossa:

```env
# Supabase Asetukset
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Gemini AI (Google AI SDK) Asetukset
GEMINI_API_KEY=your-gemini-api-key
GEMINI_REASONING_MODEL=gemini-1.5-pro
GEMINI_CHUNKY_MODEL=gemini-1.5-flash

# Pääsynhallinta (Vain sallitulle sähköpostille)
ALLOWED_USER_EMAIL=kayttaja@esimerkki.fi

# Strava Integraatio (Valinnainen)
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_WEBHOOK_VERIFY_TOKEN=your-random-webhook-token
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
```

---

## 2. Supabase Tietokannan Alustus

Koska paikallista Docker-pohjaista Supabase-instanssia ei käytetä, suorita tietokantamigraatiot suoraan etäprojektiin:

1. **Yhdistä paikallinen CLI etäprojektiin**:
   ```bash
   npx supabase link --project-ref <your-supabase-project-reference-id>
   ```
2. **Aja tietokantataulut ja RLS-säännöt**:
   ```bash
   npx supabase db push
   ```
3. **Syötä Finelin peruselintarvikkeet**:
   Avaa Supabase Dashboardin **SQL Editor**, kopioi tiedoston `supabase/seed.sql` sisältö ja suorita se ("Run").

---

## 3. Julkaisu Verceliin

1. Yhdistä GitHub-repositoriosi Vercel-tiliisi.
2. Luo uusi projekti ja valitse **Next.js**-esiasetukset.
3. Syötä kohdassa *1* luetellut ympäristömuuttujat.
4. Klikkaa **Deploy**. Vercel kääntää sovelluksen automaattisesti tuotantoon.

---

## 4. Kehityspalvelimen Käynnistäminen Paikallisesti

Jos haluat ajaa sovellusta paikallisesti kehitystilassa:
```bash
# Varmista että Node.js on käytössä ja aja:
npm run dev
```
Avaa selaimessa: [http://localhost:3000](http://localhost:3000)
