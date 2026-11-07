# web/ — P4 · Site și pitch

## Dashboard inițial

Dashboard-ul este împărțit în două secțiuni:

- **Analiza panou:** imaginea reclamei (analiza textului și a lizibilității imaginii va fi separată);
- **Analiza poziție:** selectarea pinurilor pe o hartă Leaflet cu date OpenStreetMap, preț lunar în EUR pentru fiecare poziție și dimensiunea editabilă a panoului (lățime și înălțime în metri, implicit 12 × 4 m).

## Harta și selectarea pozițiilor

Harta folosește biblioteca Leaflet și dalele publice OpenStreetMap. Nu necesită cheie API, cont sau configurare locală. Este necesară o conexiune la internet pentru a încărca biblioteca și harta.

Pornește un server din folderul `web/` (de exemplu `py -m http.server 8000`) și accesează `http://localhost:8000`. Harta pornește centrată pe București, dar poate fi deplasată și mărită oriunde; poți adăuga pinuri pe orice stradă. Coordonatele reale alese pe hartă sunt păstrate. Pentru fiecare poziție poți introduce prețul lunar sau o poți șterge din listă.

Dalele hărții sunt furnizate de OpenStreetMap și afișează atribuirea cerută către contributorii OSM. Serverele publice de tile-uri au politici de utilizare și nu oferă garanție de disponibilitate; pentru trafic mare sau utilizare de producție trebuie ales un furnizor de tile-uri potrivit.

## Rezultate demonstrative

Butonul „Trimite spre analiză” deschide `results.html` și transmite local numele fișierului imaginii, dimensiunea panoului, pinurile și prețurile. Pagina de rezultate include o ilustrație statică în perspectivă, un verdict și statistici fictive, marcate ca demonstrative. Selectorul 150 m / 80 m / 30 m schimbă doar eticheta distanței.

## Analiza reclamei

Pagina de rezultate trimite imaginea la `POST /analiza-reclama` și afișează scorul calculat local de algoritmul din `scoring/analiza_panou/`: OCR (EasyOCR) și OpenCV, fără API-uri externe. Sunt 6 criterii:

| Criteriu | Pondere |
|---|---|
| Lizibilitate | 25% |
| Contrast text–fundal | 20% |
| Cantitate de text | 15% |
| Aglomerare | 15% |
| Ierarhie tipografică | 15% |
| Separarea elementelor | 10% |

Fiecare criteriu are un scor 0–100 și o explicație scurtă. Scorul general e media ponderată a criteriilor evaluate; cele neevaluabile apar ca N/A. Pagina mai arată textul detectat și maximum 3 recomandări. Analiza durează ~10–30 s.

Pornește site-ul cu serverul care include analiza (din rădăcina repo-ului):

```
python scoring/analiza_panou/server_site.py
```

Apoi deschide `http://localhost:8000`. Serverul servește și `POST /score`, ca `scoring/server.py`.

Dacă serverul de analiză nu răspunde, pagina afișează în locul scorului o estimare euristică din browser, fără OCR, marcată ca atare. Paleta dominantă, saturația și variația tonală se calculează mereu în browser și sunt doar descriptive.

Datele se păstrează în `sessionStorage` pentru sesiunea curentă. Se păstrează o previzualizare de 640 px și o copie de până la 1600 px pentru analiza OCR. Ilustrația 3D este demonstrativă, nu o randare Unity.
