# scoring/ — P3 · Trafic, scor și Claude

- **Trafic:** `daily_cars_est` din tipul drumului + benzi (OSM), ajustat cu aglomerarea TomTom. Marcat ca estimare.
- **Scor:** formulele din `docs/scor.md` (`SECUNDE_PE_CUVANT` configurabil).
- **Claude:** primește cifrele calculate și întoarce JSON cu `verdict` și `creative_suggestions` (schema în `contracts/README.md`). Nu calculează și nu inventează cifre.

## Analiza reclamei (`analiza_panou/`)

**Outdoor Ad Quality Score.** Singurul input obligatoriu e imaginea reclamei (JPG sau PNG). Rezultatul: un scor din 100, scorul și măsurătorile fiecărui criteriu, textul detectat, recomandări legate de problema măsurată, avertismente, nivelul de acoperire a evaluării și, separat, informațiile tehnice despre fișier.

Totul rulează local, fără API extern: OCR cu **EasyOCR** (RapidOCR ca rezervă), plus OpenCV și NumPy. Scorul e calculat determinist în Python; nu se folosește Claude și nu se antrenează modele. La prima rulare, EasyOCR își descarcă modelele (~100 MB) o singură dată; după aceea merge offline.

```
pip install -r requirements.txt
python -m analiza_panou reclama.jpg
python -m analiza_panou reclama.jpg --json
python -m analiza_panou reclama.jpg --out rezultat.json
python -m analiza_panou reclama.jpg --dimensiune 12x4         # opțional, doar pentru avertismentul de format
python -m analiza_panou reclama.jpg --ocr rapidocr            # alt motor OCR local
python -m analiza_panou.test_analiza                          # testele automate (imagini sintetice)
python -m analiza_panou.verificare_reale <folder>             # verificare calitativă pe reclame reale
```

### Etapa 1: OCR și măsurători

1. Imaginea se încarcă la dimensiunile originale; pentru OCR se scalează fără deformare (max. 1600 px; imaginile sub 640 px se măresc până la ~1000 px).
2. Dacă încrederea medie e sub 0,5 sau imaginea e mică, se mai face o trecere OCR pe o versiune cu contrast egalizat (CLAHE). Detecțiile duplicate se elimină după suprapunere (IoU), includere și similaritate textuală.
3. Pentru fiecare regiune se păstrează `text`, `bbox`, `poligon`, `confidence`, `relative_height`, `relative_area`, `char_height_rel` și `local_contrast`.
4. **Înălțimea caracterelor** e mediana componentelor conexe de mărimea unei litere din regiune, nu înălțimea cutiei OCR. Dacă nu se pot separa literele, e estimată (60% din cutie) și marcată.
5. **Watermark / metadate**: băncile de imagini (shutterstock, istock etc., cu toleranță la greșeli OCR) și ID-urile numerice lângă ele sunt excluse din scor și raportate. Un URL sau un domeniu obișnuit rămâne text publicitar.
6. Detecțiile de un singur caracter sunt ignorate: de obicei sunt forme confundate cu litere (cerc → „O”). Textul cu încredere OCR sub 0,6 e marcat ca incert. Încrederea OCR nu e folosită direct ca scor de lizibilitate.

### Criteriile

Toate pragurile sunt în [`config.py`](analiza_panou/config.py), ca parametri orientativi și configurabili. La criteriile de text, scorul e 60% textul dominant și 40% media tuturor regiunilor, ponderată cu importanța lor: (caracter / caracterul dominant)^1,5.

| Criteriu | Pondere | Cum se calculează |
|---|---|---|
| Lizibilitatea textului | 25% | 40% dimensiunea caracterelor raportată la √(lățime·înălțime); 35% cât din text se mai recunoaște prin OCR la lățimi de 800 / 500 / 300 px (recuperarea caracterelor față de textul original); 25% claritatea locală (separarea literelor de fundal, panta muchiilor, contrastul local). Raportul numește textele greu de citit și motivul. Fără distanțe în metri. |
| Contrastul text–fundal | 20% | Pe fiecare regiune, în mai multe zone: literele și fundalul se separă cu Otsu. Fundalul = pixelii non-text din zonă + inelul din jurul regiunii. Se ia percentila 20 a raportului de luminanță pe zone. Repere: < 2:1 slab, 2–3 modest, 3–4,5 acceptabil, 4,5–7 bun, > 7 foarte bun. Formula WCAG e doar un reper orientativ. |
| Cantitatea de text | 15% | Cuvinte după deduplicare; un telefon, un preț sau un procent contează ca un element. Bază: 1–7 cuvinte = 100, 8–12 = 85, 13–18 = 65, 19–25 = 40, 26–35 = 20, > 35 = 10. Ajustare de maximum ±10 după numărul de rânduri, numărul de cuvinte din textul dominant și proporția textului secundar. Fără text: neaplicabil. |
| Aglomerarea vizuală | 15% | Canny (800 px): 35% densitatea detaliilor în jurul textului important; 25% fracția ocupată de text și elemente; 20% câte din cele 16 celule (4×4) sunt încărcate; 20% numărul de regiuni vizuale distincte (muchii închise morfologic, deci o fotografie nu devine sute de elemente). O fotografie complexă nu primește automat zero. |
| Ierarhia tipografică | 15% | Blocul dominant e ales după dimensiune, suprafață, contrast și poziție. 50% raportul dintre caracterele lui și mediana celorlalte blocuri (reper 1,5–2×); 30% structura pe niveluri de mărime (penalizare dacă titlul e fragmentat); 20% lipsa blocurilor concurente (≥ 85% din mărimea titlului). Un singur bloc nu e penalizat. |
| Separarea elementelor | 10% | Pe conturul real al literelor, în înălțimi de caracter: 45% distanța până la cel mai apropiat bloc; 30% coliziuni (sub 0,15 caractere); 25% marginea față de marginea imaginii (textul complet vizibil, chiar aproape de margine, ia cel puțin ~55). |

**Scorul general** = suma (scor × pondere) pe criteriile evaluate. Criteriile neaplicabile se exclud și ponderile se renormalizează; `coverage_pct` arată cât din evaluare s-a putut face. Sub 60% acoperire, `score` e `null` și se raportează doar `score_provisional` (de exemplu, la o reclamă fără text). Criteriile cu măsurători nesigure sunt marcate `incert` și explicate în avertismente.

### Calitatea tehnică (nu intră în scor)

Raportată separat în `technical`: rezoluția, raportul de aspect și formatul apropiat, blurul (varianța Laplacian, muchiile puternice), compresia (raportul pe grila 8×8, calitatea JPEG estimată din tabelul de cuantizare). Detectează și o posibilă **fotografie a unui panou deja instalat** (un cadru patrulater mare care conține textul, cu o scenă în jur) și avertizează că pentru un scor corect trebuie folosită grafica originală. Nu se presupun dimensiunile panoului; `--dimensiune` e opțional și servește doar pentru avertismentul de format.

### Teste

`test_analiza.py` generează determinist 12 imagini sintetice și verifică atât valorile, cât și direcția schimbării scorurilor:

- minimalist;
- multe cuvinte;
- alb pe negru;
- gri deschis pe alb;
- text peste fundal complex;
- fără text;
- cu watermark;
- aceeași reclamă la 2000 și 1000 px;
- titlu dominant + text secundar;
- blocuri lipite;
- titluri concurente;
- reproductibilitate: două rulări dau același rezultat.

Reclamele reale se verifică separat, calitativ, cu `verificare_reale.py`. Ponderile nu se ajustează pentru o singură fotografie.

### Limitări cunoscute

- Pe imagini foarte mici (de ex. 260 px lățime), EasyOCR poate rata textul mărunt. Cantitatea de text iese atunci prea bună. Testul de redimensionare nu se poate face sub 300 px, iar criteriul e marcat incert.
- Fonturile foarte stilizate pot fi citite greșit sau fragmentat (de ex. „OUTLAW” → „AW”, „UIL”). Încrederea scăzută e semnalată.
- Pragurile sunt calibrate pe un set mic: 12 imagini sintetice și câteva reclame. Un set mai mare de reclame evaluate de oameni ar îmbunătăți calibrarea.
- O rulare durează ~10–30 s pe CPU: 4–5 treceri OCR.
