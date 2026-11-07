# backend/ — P2 · Backend și date

FastAPI. Endpoint principal: `POST /analyze` (locații, reclamă, preț).
Produce `scene_config.json` și pozele Street View, apelează analiza, întoarce raportul.
Clienți API cu cache în `data/cache/` (vezi `contracts/apis.md`). Cheile din `.env`.
