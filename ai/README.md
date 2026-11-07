# ai/ — P3 · AI și analiză

Intrare: poze Street View (Plan A) sau cadre Unity + `results.json`.
Ieșire: `analysis.json` după `contracts/analysis.example.json`, apoi raportul Claude după `contracts/report.schema.json`.

Componente: saliență `cv2.saliency` (opencv-contrib), cuvinte citibile din mărimea literelor, Claude Vision (panouri concurente, aglomerație), formulele din `CLAUDE.md`.
