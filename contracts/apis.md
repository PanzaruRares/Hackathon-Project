# API-uri externe

Toate răspunsurile se salvează în `data/cache/` (cheie = API + parametri) și se refolosesc.

| API | La ce folosește | Intrare | Ce păstrăm | Cheie |
|---|---|---|---|---|
| Overpass (OpenStreetMap) | clădiri, drumuri, copaci pentru scena 3D | bbox în jurul panoului | poligoane clădiri (+ `height` / `building:levels`), linii drumuri (+ `lanes`, `oneway`, `maxspeed`), noduri `natural=tree` | fără cheie |
| TomTom Traffic Flow | viteza reală pe segment | lat, lon | `currentSpeed`, `freeFlowSpeed` | `TOMTOM_API_KEY` |
| Google Street View Static | poze din direcțiile de apropiere (Plan A) | lat, lon, heading, pitch, fov | PNG-uri la distanțe de ~150, 100, 60, 30 m | `GOOGLE_MAPS_API_KEY` |
| Google Places (Nearby) | concurenți în jur, distanța până la magazin | lat, lon, rază, tip | nume, coordonate | `GOOGLE_MAPS_API_KEY` |
| Claude API | Vision pe poze + raport | imagini / JSON | JSON după `report.schema.json` | `ANTHROPIC_API_KEY` |

Rezerve dacă un API pică:
- TomTom → `maxspeed` din OSM, altfel 50 km/h în oraș.
- Street View → poze făcute manual și puse în `data/cache/streetview/`.
- Trafic (mașini/zi) → cifra proprietarului panoului sau estimare pe tip de drum.

Exemplu Overpass:

```
[out:json];
(
  way["building"](44.45,26.08,44.46,26.09);
  way["highway"](44.45,26.08,44.46,26.09);
  node["natural"="tree"](44.45,26.08,44.46,26.09);
);
out geom;
```
