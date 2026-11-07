# backend/ — P2 · Backend și date

FastAPI. Endpoint principal: `POST /analyze` (format în `contracts/README.md`).

- **Geocodare:** Nominatim (OSM) — max o cerere/secundă, User-Agent propriu, rezultat în cache.
- **Strada:** Overpass (OSM) — tipul drumului, benzi, `maxspeed`, `oneway`.
- **Trafic:** TomTom Traffic Flow — viteză curentă și viteză fără trafic (cheie în `.env`).
- Scrie `data/scene_config_<id>.json` pentru Unity, citește `data/results_<id>.json`, cheamă `scoring/`, întoarce răspunsul către site.
- Toate răspunsurile externe în `data/cache/`. Demo-ul merge și din cache.
