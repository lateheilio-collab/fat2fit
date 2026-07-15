# CALCULATION_RULES.md: Laskentasäännöt ja kaavat

Tämä dokumentti määrittelee sovelluksen matemaattiset ja sääntöpohjaiset kaavat energiantarpeen, kehonkoostumuksen trendien ja tavoiteuran laskentaan.

## 1. Energiantarpeen alkuarvio (Mifflin–St Jeor)

Lepoenergiankulutus (BMR, Basal Metabolic Rate) lasketaan Mifflin–St Jeor -kaavalla:

* **Miehet (Physiological Profile: Male)**:
  $$BMR = (10 \times paino\_kg) + (6.25 \times pituus\_cm) - (5 \times ikä\_vuosina) + 5$$
* **Naiset (Physiological Profile: Female)**:
  $$BMR = (10 \times paino\_kg) + (6.25 \times pituus\_cm) - (5 \times ikä\_vuosina) - 161$$

### Aktiivisuuskerroin (PAL, Physical Activity Level)
Kokonaiskulutus (TDEE, Total Daily Energy Expenditure) lasketaan kertomalla BMR aktiivisuuskertoimella:
$$TDEE = BMR \times PAL$$

Sallitut PAL-kertoimet:
1. **Sedentary** (vähän tai ei ollenkaan liikuntaa, istumatyö): `1.2`
2. **Lightly Active** (kevyt aktiivisuus arjessa, 1–3 kevyttä treeniä/vk): `1.375`
3. **Moderately Active** (keskitason aktiivisuus, 3–5 reipasta treeniä/vk): `1.55`
4. **Very Active** (kova aktiivisuus, raskas työ tai 6–7 kovaa treeniä/vk): `1.725`
5. **Extra Active** (erittäin kova aktiivisuus, urheilijat, 2 treeniä päivässä): `1.9`

---

## 2. Makroravinnesäännöt (Nutrient Targets)

Kun kokonaiskaloritavoite $Target_{kcal}$ on asetettu (esim. $TDEE - vaje$):

1. **Proteiinitavoite**:
   - Painonpudotuksessa ja kehonkoostumuksen muokkauksessa proteiinitavoite asetetaan oletuksena arvoon **2.0g per painokilo** (tasoitetusta painosta).
   - Kaava: $Protein_{g} = 2.0 \times Paino_{trend}$
   - Lasketaan energiaksi: $Protein_{kcal} = Protein_{g} \times 4$
2. **Rasvatavoite**:
   - Rasvan vähimmäistarve fysiologiseen toimintaan on **0.8g per painokilo**.
   - Kaava: $Fat_{g} = 0.9 \times Paino_{trend}$
   - Lasketaan energiaksi: $Fat_{kcal} = Fat_{g} \times 9$
3. **Hiilihydraattitavoite**:
   - Hiilihydraatteihin ohjataan kaikki proteiinin ja rasvan jälkeen jäljelle jäänyt energia.
   - Kaava: $Carbs_{kcal} = Target_{kcal} - (Protein_{kcal} + Fat_{kcal})$
   - Muutetaan grammoiksi: $Carbs_{g} = Carbs_{kcal} / 4$
4. **Kuitutavoite**:
   - Oletus: Naiset vähintään **25g/pv**, Miehet vähintään **35g/pv**.

---

## 3. Painotrendin Tasoitus (7 ja 14 päivän keskiarvot)

Paino heilahtelee päivittäin nestetasapainon ja suoliston sisällön vuoksi. Yksittäisistä punnituksista ei tehdä päätöksiä.
Käytetään **7 päivän eksponentiaalista liikkuvaa keskiarvoa (EMA)** trendin muodostamiseen:

$$EMA_{t} = (Weight_{t} \times \alpha) + (EMA_{t-1} \times (1 - \alpha))$$
Missä tasoituskerroin $\alpha$ on:
$$\alpha = \frac{2}{N + 1} = \frac{2}{7 + 1} = 0.25$$

---

## 4. Trendipohjainen Kaloritavoitteen Kalibrointi
Kaloritavoitetta voidaan mukauttaa tasoitetun painon kehityksen perusteella seuraavilla reunaehdoilla:
* Vaaditaan vähintään **14 päivän** yhtäjaksoinen mittausjakso.
* Kaloritavoitetta mukautetaan enintään **kerran 7 päivässä**.
* Yksittäinen säätö saa olla korkeintaan **min(5% nykyisestä tavoitteesta, 200 kcal/pv)**.
* Laskennallinen painonpudotustahti:
  $$\Delta Weight_{trend} = Weight_{trend, t} - Weight_{trend, t-14}$$
  - Jos tavoite oli pudottaa painoa 0.5 kg viikossa (1.0 kg / 14 pv), mutta toteutunut pudotus oli vain 0.2 kg:
  - Laskennallinen energiavaje oli liian pieni. Tehdään **100 kcal vähennys** päivittäiseen tavoitteeseen, mikäli käyttäjä vahvistaa ehdotuksen.

---

## 5. Liikunnan Energiankulutuksen Käsittely
* Stravasta ja Garminista tuodut aktiivisuuskalerit tallennetaan tietokantaan, mutta niitä **ei lisätä suoraan saman päivän kaloritavoitteeseen** ("eating back workout calories").
* Jos harjoitus on erityisen pitkä (kesto $> 90$ minuuttia) tai intensiivinen, lisätään sääntöpohjaisesti **korkeintaan 50% harjoituksen mitatusta aktiivisesta kulutuksesta** päivän hiilihydraattitavoitteeseen palautumisen optimoimiseksi. Tämä perustellaan käyttäjälle selkeästi sovelluksessa.
