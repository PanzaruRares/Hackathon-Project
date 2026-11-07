# unity/ — P1 Victoria · Simulare 3D și panorame 360°

**Intrare:** `data/scene_config_<id>.json` (vezi `contracts/README.md`).
**Ieșire:** `data/results_<id>.json` + panorame PNG în `data/panoramas/<id>/<distanță>.png`.

## Scena

- **Principal:** Cesium for Unity + Google Photorealistic 3D Tiles (prin Cesium ion), pe Calea Dorobanților.
  - Proiect URP; Cesium > Cesium > Connect to Cesium ion > Quick Add „Google Photorealistic 3D Tiles”.
  - CesiumGeoreference = coordonatele locului (din Google Maps).
  - Pe tileset: **Create Physics Meshes** bifat, altfel razele trec prin clădiri și copaci.
  - Creditele Google afișate (Show Credits On Screen). Tile-urile nu se salvează pe disc.
  - Câteva secunde de încărcare înainte de calcul și randare, ca tile-urile să fie detaliate.
- **Rezervă:** clădiri din OpenStreetMap (Overpass) cu MeshCollider + copaci puși manual după Street View.

## Calculul de vizibilitate

- Camera la 1,2 m, pe traseul de apropiere, cu viteza din `approach.speed_kmh`.
- Grilă de puncte pe panou (ex. 8 × 4); în fiecare cadru, raze de la cameră spre puncte → procent vizibil / acoperit.
- Înălțimea literelor în pixeli → lizibilitate.
- Rezultatele (secunde vizibile, procent acoperit) merg în `results_<id>.json`.

## Panoramele 360°

- În punctele de pe traseu aflate la 150 m, 80 m și 30 m de panou (`panorama_distances_m`), camera la 1,2 m.
- `Camera.RenderToCubemap(renderTexture)` → `RenderTexture.ConvertToEquirect(...)` → PNG equirectangular (raport 2:1, ex. 4096 × 2048).
- Pentru fiecare panoramă se notează în `results_<id>.json` procentul vizibil și dacă textul se citește de acolo.
- Site-ul le afișează cu Pannellum; utilizatorul stă pe loc și se rotește.
