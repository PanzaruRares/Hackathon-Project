# SightLine — context pentru agenții AI

Claude Code citește automat acest fișier. Fiecare membru al echipei pornește Claude Code în folderul lui (`unity/`, `backend/`, `scoring/`, `web/`), dar toți agenții pornesc de la acest context comun.

## Ce construim

Un **site minimalist** (o singură pagină) care primește o reclamă și o listă de adrese de panouri publicitare, fiecare cu preț lunar și dimensiune. Ca răspuns, spune **care adresă aduce cele mai multe impresii reale pe euro**. Pentru fiecare adresă arată **panorame 360°** randate în Unity din punctul de vedere al șoferului: clientul stă pe loc și se rotește cu mouse-ul ca să vadă ce vede șoferul la 150 m, 80 m și 30 m de panou.

- Hackathon de marketing, juriu Adobe, 10 ore, 4 persoane.
- Demo: 3 adrese reale pe **Calea Dorobanților, București**, reclamă de pizzerie.
- **Nu facem:** login, conturi, plăți, istoric, export PDF.

Detalii: `docs/produs.md` (intrare/ieșire), `docs/scor.md` (formule), `contracts/README.md` (formatele JSON).

## Fluxul

```
site (web/) ──(reclamă, text, adrese, preț, dimensiune)──► backend (backend/)
backend ──► Nominatim (adresă → coordonate), Overpass (tip drum, benzi), TomTom (viteză, aglomerare)
backend ──(scene_config.json pentru fiecare adresă)──► Unity (unity/)
Unity ──(results.json + panorame 360° PNG)──► calcul scor (backend/ + scoring/)
scoring ──(cifre calculate)──► Claude ──(verdict + sugestii)──► site
```

Modulele comunică prin **fișiere JSON cu format fix** (vezi `contracts/README.md`). Fiecare lucrează pe exemplele de acolo de la primul minut, fără să aștepte după ceilalți.

## Echipa și folderele

| Persoană | Folder | Răspunde de |
|---|---|---|
| P1 Victoria | `unity/` | Scena 3D (Cesium + Google Photorealistic 3D Tiles pe Dorobanți; rezervă OSM), camera șoferului, raze de vizibilitate, panorame 360° (150 / 80 / 30 m), `results.json` |
| P2 | `backend/` | Repo, chei API, geocodare, Overpass, TomTom, cache, `scene_config.json`, endpoint `/analyze`, integrare |
| P3 | `scoring/` | Estimarea traficului, formula de scor, verdictul și sugestiile cu Claude |
| P4 | `web/` | Site-ul (formular, hartă, clasament, vizualizator 360° cu Pannellum), pitch, demo |

## Reguli pentru agenți (obligatorii)

1. **Modifică doar folderul persoanei care te-a pornit.** Nu edita alte foldere.
2. **Nu modifica `contracts/` și nici acest fișier.** Le schimbă doar P2, după ce anunță echipa. Dacă un contract trebuie schimbat, spune-i omului și oprește-te.
3. Respectă exact numele câmpurilor și unitățile din contracte: metri, secunde, km/h, grade, EUR.
4. Sarcini mici (20–40 min), fiecare cu un test sau un script de verificare la final.
5. Orice răspuns de la un API extern se salvează în `data/cache/` și se refolosește. Demo-ul trebuie să meargă și fără internet. **Excepție:** tile-urile Google 3D nu se salvează pe disc (interzis de termenii Google).
6. **Niciodată chei API în cod sau în commit-uri.** Se citesc din `.env` (vezi `.env.example`).
7. **Claude nu calculează cifre.** Primește cifrele deja calculate de `scoring/` și scrie doar verdictul și sugestiile, în JSON după schema din `contracts/README.md`.
8. Fără imagini generate cu AI. Reclama vine de la client.
9. Nominatim: maximum o cerere pe secundă și un User-Agent propriu al aplicației.

## Stack

| Folder | Tehnologii |
|---|---|
| `unity/` | Unity (URP), C#, Cesium for Unity + Google Photorealistic 3D Tiles prin Cesium ion, `Camera.RenderToCubemap` → panoramă equirectangulară PNG |
| `backend/` | Python 3.11, FastAPI, requests, python-dotenv |
| `scoring/` | Python 3.11, SDK-ul `anthropic` (`claude-sonnet-5-5` pentru verdict, `claude-haiku-5-5` pentru sarcini mici) |
| `web/` | HTML/React + Leaflet pentru hartă + **Pannellum** pentru panoramele 360° (rotire cu mouse-ul, butoane 150 / 80 / 30 m) |

## Checkpoint-uri

- **Ora 5:** o adresă merge cap-coadă (formular → date → Unity → scor → Claude → site).
- **Ora 7:** toate 3 adresele.
- **Ora 9:** cod înghețat, doar fix-uri și repetiții.

## Rezerve

- Unity nu poate fi pornit automat de backend → panoramele și `results.json` pentru adresele din demo se generează manual și backend-ul le citește din `data/`.
- Cesium / 3D Tiles nu merge în 45 de minute → clădiri din OpenStreetMap (Overpass) + copaci puși manual după Street View.
- TomTom nu merge → viteza din OSM (`maxspeed`) sau 50 km/h; traficul doar din tipul drumului.
- Internetul pică la prezentare → totul din cache + video înregistrat al demo-ului.

## Git

- Pull înainte să începi, commit după fiecare sarcină care merge, push des.
- Mesaje de commit scurte, cu prefixul folderului: `backend: geocodare Nominatim cu cache`.
