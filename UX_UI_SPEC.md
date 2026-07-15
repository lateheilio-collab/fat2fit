# UX_UI_SPEC.md: Fat2Fit UX/UI-Suunnitteludokumentti

Tämä dokumentti määrittelee Fat2Fit-sovelluksen ulkoasun, teeman, navigoinnin ja keskeiset käyttöliittymäkomponentit.

## 1. Visuaalinen Ilme ja Teema
* **Tyyli**: Moderni, rauhallinen, luettava ja premium-tason ilme. Ei syyllistävä tai liian kliininen.
* **Väripaletti (Sävymaailma)**:
  - **Tumma tila (oletus)**: Syvä tumma tausta (esim. Slate/Zinc 950), lasimaiset kortit (Glassmorphism), hienovaraiset gradientit.
  - **Vaalea tila**: Puhdas, korkeakontrastinen ja raikas (esim. valkoinen tausta, Slate 50 kortit, harmaat reunat).
  - **Tehostevärit**:
    - Ravinto/Kalorit: Smaragdinvihreä / Teal (terveellisyys, energia).
    - Liikunta/Aktiivisuus: Indigo / Violetti (voima, suorituskyky).
    - Varoitukset/Huomautukset: Amber / Oranssi (lempeä huomio, ei kirkkaan punainen syyllistävyys).
* **Typografia**: Google Fonts -kirjasinperhe **Outfit** tai **Inter**. Pääotsikoissa moderni Outfit, leipätekstissä erittäin luettava Inter.

## 2. Navigointi
* **Mobiilinavigaatio (Bottom Navigation Bar)**:
  Kiinteästi ruudun alareunassa puhelimella käytettäessä. Sisältää seuraavat välilehdet:
  1. **Tänään**: Päivittäinen koontinäyttö, pikatoiminnot, tämän päivän tila.
  2. **Chat**: Valmentajan chat-ikkuna ja vuorovaikutus.
  3. **Ateriat**: Päivän ateriat, Fineli-haku, kuva-analyysi ja reseptit.
  4. **Suunnitelma**: 7 päivän viikkosuunnitelma ja 72 tunnin mukautuva treenikalenteri.
  5. **Kehitys**: Edistymiskäyrät, tavoiteura, painotrendit ja viikkoraportit.
* **Työpöytänavigaatio (Sidebar)**:
  Vasemmalla sivulla sijaitseva kiinteä palkki samoilla välilehdillä sekä suorilla linkeillä asetuksiin, mittauksiin ja integraatioihin.
* **Asetukset ja profiili**:
  Avautuu oikean yläkulman avatar- tai valikkopainikkeesta molemmissa näkymissä.

## 3. Keskeiset Komponentit
### 3.1 Tänään-näkymän "Dashboard"
* **Tavoitetilanäyttö**: Näyttää visuaalisen renkaan tai palkin päivän kaloreista ja makroista.
* **Pikatoiminnot**: Pyöristetyt painikkeet, joissa on hienovaraiset mikroanimaatiot (hover/tap).
  - [🖨️ Aamukirjaus] [📸 Kuvaa ateria] [💬 Kysy valmentajalta]
* **Painotrendi-widget**: Näyttää viimeisimmän punnituksen ja 7 päivän tasoitetun keskiarvon hienona pienenä viivakaaviona (Sparkline).

### 3.2 Chatbot-keskusteluikkuna
* **Viestikuplat**: Selkeät ja pyöristetyt. Käyttäjän viestit oikealla (indigotaustalla), AI Coachin viestit vasemmalla (lasimaisella harmaalla taustalla).
* **Työkalukutsujen visualisointi**: Kun AI suorittaa taustalla toimintoja (esim. kirjaa painoa tai muuttaa suunnitelmaa), näyttöön ilmestyy pieni latausanimaatio ja selkeä vihreä kuittausteksti: *"Kirjattu: Paino 92.5 kg. [Kumoa]"*.

### 3.3 Aterian Vahvistusnäkymä (Kuva-analyysi)
* **Korttimainen rakenne**: Vasemmalla/ylhäällä ruokakuva, oikealla/alhaalla Gemini-tulkinnan luonnos.
* **Liukusäätimet (Sliders)**: Annoskoolle (grammoille) minimi- ja maksimirajojen välillä.
* **Valintalistat**: Ehdotetut Fineli-ruoka-aineet match-luottamuksella varustettuna.

### 3.4 Progress-kaavio (Kehitys-näkymä)
* **Recharts-kuvaaja**:
  - Yksittäiset painomittaukset: pienet haaleat pisteet.
  - 7 päivän tasoitettu paino: paksu yhtenäinen viiva.
  - Tavoiteura: ohut katkoviiva.
  - Tavoitealue: haalea taustaväri tavoiteuran ympärillä (varjostusalue).
  - Zoom-painikkeet: `30d`, `90d`, `6kk`, `1v`, `Kaikki`.
