"""Verificare scor. Rulare: python scoring/test_score.py (sau pytest)."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from score import (Location, advantage_ratio, best_location, rank_locations,  # noqa: E402
                   readable_words, visibility_factor)


def test_formula_manual():
    # 7 cuvinte * 0.3 = 2.1 s necesare; 2.1 s vizibile -> factor timp 1; 35% acoperit -> 0.65
    assert math.isclose(visibility_factor(2.1, 35, 7), 0.65)
    ranked = rank_locations([Location("A", 1, 2, 3000, 30000, 2.1, 35)], "a b c d e f g")
    s = ranked[0]
    assert s["real_impressions_month"] == round(30000 * 30 * 0.65)
    assert math.isclose(s["cost_per_real_impression_eur"], 3000 / (30000 * 30 * 0.65))


def test_winner_is_cheapest_per_impression():
    locs = [
        Location("scump", 44.0, 26.0, 5000, 30000, 3, 0),
        Location("ieftin", 44.1, 26.1, 1000, 30000, 3, 0),
    ]
    best = best_location(rank_locations(locs, "Pizza buna"))
    assert best["location_id"] == "ieftin"
    assert (best["lat"], best["lon"]) == (44.1, 26.1)


def test_price_range_uses_midpoint():
    locs = [
        Location("interval", 0, 0, (1000, 3000), 10000, 5, 0),  # mijloc 2000
        Location("fix", 0, 0, 2500, 10000, 5, 0),
    ]
    ranked = rank_locations(locs, "unu doi")
    assert ranked[0]["location_id"] == "interval"
    lo, hi = ranked[0]["cost_range_eur"]
    assert lo < ranked[0]["cost_per_real_impression_eur"] < hi


def test_invisible_goes_last():
    locs = [
        Location("ascuns", 0, 0, 100, 50000, 0, 100),
        Location("vizibil", 0, 0, 9000, 1000, 1, 50),
    ]
    ranked = rank_locations(locs, "text")
    assert ranked[0]["location_id"] == "vizibil"
    assert ranked[-1]["cost_per_real_impression_eur"] is None
    assert best_location(rank_locations([locs[0]], "text")) is None


def test_readable_words_and_ratio():
    assert readable_words(1.2, 9) == 4
    assert readable_words(10, 9) == 9
    assert readable_words(0, 9) == 0
    ranked = rank_locations([
        Location("A", 0, 0, 1000, 10000, 5, 0),
        Location("B", 0, 0, 3000, 10000, 5, 0),
    ], "x")
    assert math.isclose(advantage_ratio(ranked), 3.0)


# ---------- traffic.py (fara internet) ----------
from traffic import (estimate_daily_cars, estimate_visible_seconds, lane_count,  # noqa: E402
                     nearest_road, parse_maxspeed)


def test_traffic_estimates():
    assert parse_maxspeed("60") == 60
    assert parse_maxspeed("RO:urban") == 50
    assert parse_maxspeed(None) is None
    assert lane_count({"highway": "primary", "lanes": "6"}) == 6
    assert lane_count({"highway": "primary"}) == 4
    assert lane_count({"highway": "primary", "oneway": "yes"}) == 2
    assert estimate_daily_cars({"highway": "primary", "lanes": "6"}) == 60000
    assert estimate_daily_cars({"highway": "secondary_link", "lanes": "2"}) == 14000
    assert math.isclose(estimate_visible_seconds(54, 4), 10.0)   # 150 m la 15 m/s


def test_nearest_road():
    lat, lon = 44.0, 26.0
    aproape = {"tags": {"name": "aproape"}, "geometry": [{"lat": 44.0001, "lon": 25.999}, {"lat": 44.0001, "lon": 26.001}]}
    departe = {"tags": {"name": "departe"}, "geometry": [{"lat": 44.001, "lon": 25.999}, {"lat": 44.001, "lon": 26.001}]}
    assert nearest_road(lat, lon, [departe, aproape])["tags"]["name"] == "aproape"


def test_billboard_prefers_main_road_nearby():
    from traffic import billboard_road
    lat, lon = 44.0, 26.0
    # strada mica la ~11 m, bulevard la ~22 m -> panoul e pentru bulevard
    mica = {"tags": {"name": "mica", "highway": "residential"},
            "geometry": [{"lat": 44.0001, "lon": 25.999}, {"lat": 44.0001, "lon": 26.001}]}
    bulevard = {"tags": {"name": "bulevard", "highway": "primary", "lanes": "6"},
                "geometry": [{"lat": 43.9998, "lon": 25.999}, {"lat": 43.9998, "lon": 26.001}]}
    departe = {"tags": {"name": "autostrada", "highway": "motorway", "lanes": "6"},
               "geometry": [{"lat": 44.001, "lon": 25.999}, {"lat": 44.001, "lon": 26.001}]}
    assert billboard_road(lat, lon, [mica, bulevard, departe])["tags"]["name"] == "bulevard"


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print("OK", t.__name__)
    print(f"{len(tests)} teste trecute")
