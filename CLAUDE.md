# SightLine — context pentru agenții AI

Acest fișier e citit automat de Claude Code. Fiecare membru al echipei pornește Claude Code în folderul lui (`unity/`, `backend/`, `ai/`, `web/`), dar toți agenții pornesc de la acest context comun.

## Ce construim

SightLine testează o campanie pe panouri stradale (outdoor/OOH) **înainte** ca firma să plătească panoul. Pentru fiecare locație propusă spune:

- câte secunde vede un șofer panoul și cât e acoperit (clădiri, copaci);
- dacă reclama se poate citi din mașină, la viteza reală;
- cât din atenție cade pe panou (saliență);
- costul real pe impresie și clasamentul locațiilor după valoare;
- sugestii concrete pentru reclamă.

Hackathon de marketing, juriu Adobe, 10 ore, 4 persoane. Demo: o stradă reală din București, 2–3 panouri, o reclamă de pizzerie.

## Strategia: două drumuri

- **Plan A (obligatoriu până la ora 5):** analiză pe poze Street View de pe drumul spre panou. Merge cap-coadă fără Unity.
- **Plan B (în paralel):** simulare 3D în Unity din datele OpenStreetMap. La ora 7 decidem dacă intră în demo.

## Echipa și folderele

| Persoană | Folder | Răspunde de | Predă |
|---|---|---|---|
| P1 Victoria | `unity/` | Scena 3D din OSM, camera pe drum, raze de vizibilitate, mărimea literelor în pixeli, export cadre | `results.json` + cadre PNG |
| P2 | `backend/` | Chei API, clienți Overpass / TomTom / Street View / Places, cache, endpoint `/analyze`, integrare | `scene_config.json` + poze Street View |
| P3 | `ai/` | Saliență OpenCV, lizibilitate, Claude Vision, formule de cost, raport Claude | `analysis.json` + raport |
| P4 | `web/` | Interfața (hartă, upload reclamă, preț, pagina de raport), pitch, demo | Interfața + pitch |

## Fluxul de date

```
web  ──(adresă, reclamă, preț)──►  backend  ◄──►  API-uri externe (Overpass, TomTom, Street View, Places)
                                      │
                                      ├──(scene_config.json)──►  unity  ──(cadre + results.json)──►  ai
                                      │                                                              │
                                      └──(poze Street View, Plan A)────────────────────────────────►  ai
                                                                                                     │
web  ◄────────────────────────────(raport: JSON cu schemă fixă + text)───────────────────────────────┘
```

Modulele comunică prin **fișiere JSON cu format fix**. Exemplele sunt în `contracts/`. Fiecare lucrează pe ele de la primul minut, fără să aștepte după ceilalți.

## Contracte

- `contracts/scene_config.example.json` — backend → unity
- `contracts/results.example.json` — unity → ai
- `contracts/analysis.example.json` — ai → raport / web
- `contracts/report.schema.json` — schema JSON a raportului generat de Claude
- `contracts/apis.md` — ce API-uri folosim și ce întorc

**Formule:**

```
impresii_reale_lună = mașini_pe_zi × 30 × procent_vizibil × scor_atenție
cost_real_pe_impresie = preț_lunar / impresii_reale_lună
```

## Reguli pentru agenți (obligatorii)

1. **Modifică doar folderul persoanei care te-a pornit.** Nu edita alte foldere.
2. **Nu modifica nimic în `contracts/`.** Contractele le schimbă doar P2. Dacă un contract trebuie schimbat, spune-i omului și oprește-te.
3. Respectă exact numele câmpurilor și unitățile din contracte (metri, secunde, km/h, grade, EUR).
4. Sarcini mici (20–40 min), fiecare cu un test sau un script de verificare la final.
5. Orice răspuns de la un API extern se salvează în `data/cache/` și se refolosește. Demo-ul trebuie să meargă și fără internet.
6. **Niciodată chei API în cod sau în commit-uri.** Se citesc din `.env` (vezi `.env.example`).
7. Cifrele din raport vin din calcule, nu inventate de model. Claude primește datele și răspunde în JSON după `report.schema.json`.
8. Fără imagini generate cu AI în produs. Reclama vine de la utilizator.

## Stack

- **unity/**: Unity LTS, C#, Newtonsoft.Json. Coordonate: lat/lon convertite în metri locali față de `center` (proiecție echirectangulară simplă).
- **backend/**: Python 3.11, FastAPI, requests, python-dotenv.
- **ai/**: Python 3.11, opencv-contrib-python (`cv2.saliency`), numpy, `anthropic` SDK. Modele: `claude-sonnet-5-5` pentru imagini și raport, `claude-haiku-5-5` pentru sarcini mici.
- **web/**: Vite + React (sau HTML simplu), Leaflet pentru hartă.

## Checkpoint-uri

- **Ora 5:** Plan A complet cap-coadă (Street View → analiză → raport → interfață).
- **Ora 7:** decizia pentru 3D.
- **Ora 9:** cod înghețat, doar fix-uri și repetiții.

## Git

- Pull înainte să începi, commit după fiecare sarcină care merge, push des.
- Mesaje de commit scurte, cu prefixul folderului: `backend: client TomTom cu cache`.
