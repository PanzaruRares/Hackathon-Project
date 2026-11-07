# Contracte JSON

Formatele prin care se leagă modulele. Le modifică doar P2, după ce anunță echipa. Unități: metri, secunde, km/h, grade, EUR.

## 1. Cererea de la site → backend (`POST /analyze`)

```json
{
  "creative_png": "data/creative.png",
  "creative_text": "Pizza fierbinte livrată în 20 de minute",
  "billboard_size_m": { "width": 12, "height": 4 },
  "locations": [
    { "location_id": "A", "address": "Calea Dorobanților 100, București", "monthly_price_eur": 3000 }
  ]
}
```

## 2. `data/scene_config_<id>.json` — backend → Unity

```json
{
  "location_id": "A",
  "address": "Calea Dorobanților 100, București",
  "lat": 44.4600,
  "lon": 26.0900,
  "billboard": { "elevation_m": 6, "width_m": 12, "height_m": 4, "facing_deg": 210 },
  "approach": { "direction": "N-S", "speed_kmh": 42, "start_distance_m": 200 },
  "scene_source": "cesium",
  "creative_png": "data/creative.png",
  "panorama_distances_m": [150, 80, 30],
  "panorama_out_dir": "data/panoramas/A"
}
```

`scene_source`: `"cesium"` (Google Photorealistic 3D Tiles) sau `"osm"` (rezervă).

## 3. `data/results_<id>.json` — Unity → scoring

```json
{
  "location_id": "A",
  "visible_seconds": 2.1,
  "occluded_pct": 35,
  "first_visible_distance_m": 140,
  "min_letter_px": 9,
  "max_letter_px": 31,
  "panoramas": [
    { "distance_m": 150, "file": "data/panoramas/A/150.png", "visible_pct": 40, "readable": false },
    { "distance_m": 80, "file": "data/panoramas/A/80.png", "visible_pct": 75, "readable": false },
    { "distance_m": 30, "file": "data/panoramas/A/30.png", "visible_pct": 90, "readable": true }
  ]
}
```

## 4. `data/traffic_<id>.json` — backend/scoring

```json
{
  "location_id": "A",
  "road_type": "primary",
  "lanes": 4,
  "speed_kmh": 42,
  "free_flow_speed_kmh": 55,
  "daily_cars_est": 30000,
  "daily_cars_source": "estimare dupa tipul drumului, ajustata cu TomTom"
}
```

## 5. Răspunsul către site (scor + Claude)

```json
{
  "best_location_id": "B",
  "verdict": "2-3 propoziții scrise de Claude, doar cu cifrele de mai jos",
  "locations": [
    {
      "location_id": "A",
      "address": "Calea Dorobanților 100, București",
      "daily_cars_est": 30000,
      "visible_seconds": 2.1,
      "occluded_pct": 35,
      "readable_words": 4,
      "total_words": 9,
      "real_impressions_month": 0,
      "cost_per_real_impression_eur": 0,
      "rank": 2,
      "panoramas": [
        { "distance_m": 150, "file": "panoramas/A/150.png", "visible_pct": 40, "readable": false }
      ]
    }
  ],
  "creative_suggestions": [
    { "issue": "textul cere mai mult timp decât e vizibil panoul", "suggestion": "scurtează la 4 cuvinte", "shortened_text": "Pizza în 20 de minute" }
  ]
}
```

Cifrele din exemple sunt valori de test.
