# web/ — P4 · Site și pitch

## Dashboard inițial

Deschide `index.html` în browser. Dashboard-ul este împărțit în două secțiuni:

- **Analiza panou:** imaginea reclamei (analiza textului și a lizibilității imaginii va fi separată);
- **Analiza poziție:** selectarea pinurilor pe Google Maps, preț lunar în EUR pentru fiecare poziție și dimensiunea editabilă a panoului (lățime și înălțime în metri, implicit 12 × 4 m).

## Configurarea Google Maps

Selectarea pinurilor necesită o cheie pentru Google Maps JavaScript API. Creează o cheie cu restricții pentru site-ul tău, activează API-ul și configureaz-o local:

1. Copiază `config.example.js` în `config.local.js`.
2. Completează `googleMapsApiKey` în `config.local.js`.
3. Deschide site-ul printr-un server local din folderul `web/` (de exemplu `py -m http.server 8000`), apoi accesează `http://localhost:8000`.

`config.local.js` este ignorat de Git. Restricționează cheia Google Maps la origin-ul site-ului tău. Fără cheie, formularul rămâne disponibil, iar hartă afișează instrucțiunea de configurare. Pozițiile păstrează coordonatele selectate și prețurile, fără să ceară adrese.

## Rezultate demonstrative

Butonul „Trimite spre analiză” deschide `results.html` și transmite local numele fișierului imaginii, dimensiunea panoului, pinurile și prețurile. Pagina de rezultate include o ilustrație statică în perspectivă, un verdict și statistici fictive, marcate ca demonstrative. Selectorul 150 m / 80 m / 30 m schimbă doar eticheta distanței.

Raportul include și o evaluare vizuală locală a creativului: lizibilitate estimată, contrast text–fundal, cantitate de text, aglomerare, ierarhie tipografică, separarea elementelor și calitate tehnică. Fiecare criteriu primește un scor 0–100, iar nota finală este media aritmetică rotunjită a celor șapte scoruri. Sunt afișate și previzualizarea imaginii, paleta dominantă, saturația și variația tonală.

Scorurile sunt euristici calculate din pixeli, margini, culori și rezoluția imaginii — nu folosesc OCR și nu detectează efectiv textul sau caracterele. Prin urmare, cantitatea de text, lizibilitatea, contrastul text–fundal și ierarhia tipografică sunt aproximări vizuale, nu evaluări certe ale conținutului reclamei.

Datele se păstrează în `sessionStorage` pentru sesiunea curentă. Imaginea este redimensionată pentru previzualizare și analiză cromatică în browser; dimensiunea originală este păstrată pentru scorul tehnic. Nimic nu se trimite către server. Ilustrația 3D și statisticile de trafic sunt demonstrative, nu randări Unity sau rezultate calculate de backend.
