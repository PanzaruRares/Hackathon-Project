# scoring/ — P3 · Trafic, scor și Claude

- **Trafic:** `daily_cars_est` din tipul drumului + benzi (OSM), ajustat cu aglomerarea TomTom. Marcat ca estimare.
- **Scor:** formulele din `docs/scor.md` (`SECUNDE_PE_CUVANT` configurabil).
- **Claude:** primește cifrele calculate și întoarce JSON cu `verdict` și `creative_suggestions` (schema în `contracts/README.md`). Nu calculează și nu inventează cifre.
