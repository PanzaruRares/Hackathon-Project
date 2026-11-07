/* SightLine · vederea șoferului (P1 Victoria)
 *
 * Se leagă de pagina lui P4 (results.html) fără să-i schimbe codul:
 *  - citește campania din sessionStorage["sightline-campaign"] (pinuri, dimensiune panou, reclama);
 *  - pune în caseta ".scene" poze reale Street View cu panoul desenat la coordonatele pinului;
 *  - ascultă butoanele existente [data-distance] (150 / 80 / 30 m);
 *  - calculează cât din panou e acoperit de clădiri și copaci (OpenStreetMap), la 1,2 m (ochii șoferului).
 *
 * Rezultatul vizibilității se pune în sessionStorage["sightline-visibility"] (pe id-ul pinului),
 * ca scoring/ să-l poată folosi în locul valorii implicite.
 *
 * Cheia Google se citește din web/config.local.js (window.SIGHTLINE_CONFIG.googleMapsApiKey), nu se scrie în cod.
 * Pozele Google nu se salvează; răspunsurile OpenStreetMap se păstrează în localStorage.
 */
(function () {
  "use strict";

  const DISTANCES = [150, 80, 30];
  const APPROACH_M = 220;     // cât mergem înapoi pe stradă de la panou
  const EYE_H = 1.2;          // ochii șoferului
  const CAM_H = 2.5;          // camera Street View e pe acoperișul mașinii Google
  const IMG_W = 640, IMG_H = 480, FOV = 70;
  const TREE_R = 3.5, TREE_LOW = 3, TREE_TOP = 12;   // coroana unui copac de stradă
  const DEFAULT_BUILDING_H = 12;
  const MOUNTS = { unipol: "Unipol", two: "2 stâlpi", wall: "Pe clădire" };

  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (a, s) => ({ x: a.x * s, y: a.y * s }), len = a => Math.hypot(a.x, a.y);
  const norm = a => mul(a, 1 / (len(a) || 1)), dot2 = (a, b) => a.x * b.x + a.y * b.y;

  // ---------------------------------------------------------------- OpenStreetMap
  const osmMem = {};
  let osmQueue = Promise.resolve();
  function overpass(lat, lon) {   // una câte una: Overpass refuză (429) cererile în paralel
    const job = osmQueue.then(() => overpassNow(lat, lon));
    osmQueue = job.catch(() => null);
    return job;
  }
  async function overpassNow(lat, lon) {
    const key = `sl_osm_${lat.toFixed(5)}_${lon.toFixed(5)}`;
    if (osmMem[key]) return osmMem[key];
    try { const c = localStorage.getItem(key); if (c) return (osmMem[key] = JSON.parse(c)); } catch (e) {}
    const q = `[out:json][timeout:40];(
      way(around:${APPROACH_M + 40},${lat},${lon})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];
      way(around:${APPROACH_M + 20},${lat},${lon})["building"];
      node(around:${APPROACH_M + 20},${lat},${lon})["natural"="tree"];
      way(around:${APPROACH_M + 20},${lat},${lon})["natural"="tree_row"];
    );out geom;`;
    const eps = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
                 "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
    for (let i = 0; i < 6; i++) {
      const ep = eps[i % eps.length];
      if (i >= eps.length) await new Promise(r => setTimeout(r, 3000));
      try {
        const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q),
          headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        if (!r.ok) continue;
        const json = await r.json();
        osmMem[key] = json;
        try { localStorage.setItem(key, JSON.stringify(json)); } catch (e) {}
        return json;
      } catch (e) {}
    }
    throw new Error("OpenStreetMap (Overpass) nu răspunde");
  }

  function buildingHeight(tags) {
    const h = parseFloat(tags.height);
    if (Number.isFinite(h) && h > 0) return h;
    const lv = parseFloat(tags["building:levels"]);
    if (Number.isFinite(lv) && lv > 0) return lv * 3.2 + 1;
    return DEFAULT_BUILDING_H;
  }

  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  // ---------------------------------------------------------------- Scena: panou + traseul șoferului
  // Totul în metri, față de pin (x = est, y = nord).
  function buildScene(json, pin, size, mount) {
    const kx = 111320 * Math.cos(rad(pin.lat)), ky = 111320;
    const L = g => ({ x: (g.lon - pin.lon) * kx, y: (g.lat - pin.lat) * ky });
    const G = v => ({ lat: pin.lat + v.y / ky, lon: pin.lon + v.x / kx });
    const els = json.elements || [];

    const roadsRaw = els.filter(e => e.type === "way" && e.tags && e.tags.highway && e.geometry && e.geometry.length > 1);
    if (!roadsRaw.length) throw new Error("nicio stradă lângă pin");
    const buildings = els.filter(e => e.type === "way" && e.tags && e.tags.building && e.geometry && e.geometry.length > 2)
      .map(e => ({ poly: e.geometry.map(L), h: buildingHeight(e.tags) }));
    const trees = [];
    els.forEach(e => {
      if (e.type === "node" && e.tags && e.tags.natural === "tree") trees.push(L(e));
      if (e.type === "way" && e.tags && e.tags.natural === "tree_row" && e.geometry) {
        const pts = e.geometry.map(L);
        for (let i = 0; i < pts.length - 1; i++) {
          const n = Math.max(1, Math.round(len(sub(pts[i + 1], pts[i])) / 7));
          for (let k = 0; k < n; k++) trees.push(add(pts[i], mul(sub(pts[i + 1], pts[i]), k / n)));
        }
      }
    });

    const makeWays = flipped => roadsRaw.map(e => {
      const pts = e.geometry.map(L);
      const ow = e.tags.oneway;
      if (ow === "-1") pts.reverse();
      const oneway = ow === "yes" || ow === "-1" || e.tags.junction === "roundabout";
      if (flipped && !oneway) pts.reverse();
      return { tags: e.tags, pts, oneway };
    });
    const nearest = ways => {
      let best = { d: 1e9 };
      ways.forEach((w, wi) => w.pts.slice(0, -1).forEach((a, i) => {
        const b = w.pts[i + 1], ab = sub(b, a), l2 = dot2(ab, ab);
        const t = l2 ? Math.max(0, Math.min(1, -dot2(a, ab) / l2)) : 0;
        const q = add(a, mul(ab, t));
        if (len(q) < best.d) best = { d: len(q), wi, i, q, dir: norm(ab) };
      }));
      return best;
    };

    // mergem înapoi pe stradă (și pe străzile legate) până la 220 m
    function walk(flipped) {
      const ways = makeWays(flipped), best = nearest(ways), road = ways[best.wi];
      const back = [best.q]; let cur = road.pts, idx = best.i, acc = 0; const used = new Set([best.wi]);
      while (acc < APPROACH_M) {
        const last = back[back.length - 1];
        if (idx >= 0) {
          const v = cur[idx], d = len(sub(v, last));
          if (acc + d >= APPROACH_M) { back.push(add(last, mul(sub(v, last), (APPROACH_M - acc) / (d || 1)))); break; }
          if (d > 0.01) { back.push(v); acc += d; }
          idx--; continue;
        }
        // la intersecție continuăm pe aceeași stradă (același nume), cu cea mai mică schimbare de direcție
        const s = cur[0], curName = ways[[...used].pop()].tags.name || "";
        const goingBack = norm(sub(cur[0], cur[1] || cur[0]));   // direcția în care mergem înapoi
        let found = -1, rev = false, bestScore = 1e9;
        ways.forEach((w, wi) => {
          if (used.has(wi)) return;
          let r = null;
          if (len(sub(w.pts[w.pts.length - 1], s)) < 2) r = false;
          else if (!w.oneway && len(sub(w.pts[0], s)) < 2) r = true;
          if (r === null) return;
          const pts = r ? w.pts.slice().reverse() : w.pts;
          const next = pts.length > 1 ? norm(sub(pts[pts.length - 2], s)) : goingBack;
          const turn = deg(Math.acos(Math.max(-1, Math.min(1, dot2(next, goingBack)))));
          const score = turn + ((w.tags.name || "") === curName ? 0 : 1000);
          if (score < bestScore) { bestScore = score; found = wi; rev = r; }
        });
        if (found < 0 || bestScore >= 1000 + 60) break;           // altă stradă și viraj mare: ne oprim
        used.delete(found); used.add(found);
        cur = ways[found].pts.slice(); if (rev) cur.reverse(); idx = cur.length - 2;
      }
      back.reverse();
      // direcția de mers în dreptul panoului: din punctul aflat cu ~30 m înainte până la panou
      const end = back[back.length - 1];
      let from = back[0];
      for (let i = back.length - 2; i >= 0; i--) { from = back[i]; if (len(sub(end, back[i])) >= 30) break; }
      return { best, road, back, dir: norm(sub(end, from)) };
    }
    // circulație pe dreapta: alegem sensul în care pinul e în dreapta șoferului
    let wk = walk(false);
    const leftOfRoad = wk.dir.x * (-wk.best.q.y) - wk.dir.y * (-wk.best.q.x) > 0;
    if (!wk.road.oneway && leftOfRoad) wk = walk(true);
    const { best, road, back, dir } = wk;
    const lanes = Math.min(Math.max(parseInt(road.tags.lanes) || 2, 1), 8);
    const right = { x: dir.y, y: -dir.x };
    const laneOff = road.oneway ? 0 : Math.min(lanes, 4) * 3.5 / 4;
    const drive = back.map((p, i) => {
      const d = i < back.length - 1 ? norm(sub(back[i + 1], p)) : dir;
      return add(p, mul({ x: d.y, y: -d.x }, laneOff));
    });

    // poziția și orientarea panoului
    const roadHalf = lanes * 3.5 / 2;
    let c = { x: 0, y: 0 };                             // panoul stă exact pe pin…
    if (best.d < roadHalf + 1) c = add(best.q, mul(right, roadHalf + 2)); // …doar dacă pinul e pe carosabil, îl mut pe trotuar
    let n = mul(dir, -1);                               // fața spre mașinile care vin
    let mountedOn = null;
    if (mount === "wall") {
      let bw = { d: 30 };
      buildings.forEach((b, bi) => b.poly.forEach((a, i) => {
        const e = b.poly[(i + 1) % b.poly.length], ab = sub(e, a), l2 = dot2(ab, ab);
        if (l2 < 4) return;                           // pereți sub 2 m nu țin un panou
        const t = Math.max(0.05, Math.min(0.95, dot2(sub(c, a), ab) / l2));
        const q = add(a, mul(ab, t)), d = len(sub(c, q));
        if (d < bw.d) bw = { d, q, ab, bi };
      }));
      if (bw.q) {
        let nrm = norm({ x: -bw.ab.y, y: bw.ab.x });
        if (pointInPoly(add(bw.q, mul(nrm, 0.5)), buildings[bw.bi].poly)) nrm = mul(nrm, -1);
        c = add(bw.q, mul(nrm, 0.35)); n = nrm; mountedOn = bw.bi;
      }
    }

    return {
      pin, L, G, c, n, r: { x: -n.y, y: n.x }, drive, buildings, trees, mountedOn,
      W: size.width || 12, H: size.height || 4,
      E: mount === "wall" ? Math.max(6, (size.height || 4) / 2 + 4) : 6, mount,
      roadName: road.tags.name || road.tags.highway, lanes, oneway: road.oneway,
    };
  }

  function viewpoint(S, d) {
    for (let i = 0; i < S.drive.length - 1; i++) {
      const a = S.drive[i], b = S.drive[i + 1];
      for (let s = 0; s <= 40; s++) {
        const p = add(a, mul(sub(b, a), s / 40));
        if (len(sub(p, S.c)) <= d) return p;
      }
    }
    return S.drive[0];
  }

  // ---------------------------------------------------------------- Vizibilitate (raze 2,5D prin clădiri și copaci OSM)
  function facePoints(S, nx, ny) {
    const pts = [];
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const x = ((ix + 0.5) / nx - 0.5) * S.W, z = S.E + S.H / 2 - (iy + 0.5) / ny * S.H;
      pts.push({ p: add(S.c, mul(S.r, x)), z });
    }
    return pts;
  }

  function rayBlocked(S, eye, tgt) {
    const d = sub(tgt.p, eye), L2 = len(d);
    const hAt = t => EYE_H + (tgt.z - EYE_H) * t;
    const tEnd = 1 - 0.6 / (L2 || 1);                 // ultimele 60 cm = peretele pe care stă panoul
    for (const b of S.buildings) {
      const P = b.poly;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], e = sub(P[i + 1], a);
        const den = d.x * e.y - d.y * e.x; if (!den) continue;
        const w = sub(a, eye);
        const t = (w.x * e.y - w.y * e.x) / den, u = (w.x * d.y - w.y * d.x) / den;
        if (t > 0.002 && t < tEnd && u >= 0 && u <= 1 && hAt(t) < b.h) return true;
      }
    }
    for (const tr of S.trees) {
      const t0 = Math.max(0, Math.min(1, dot2(sub(tr, eye), d) / (L2 * L2)));
      if (len(sub(add(eye, mul(d, t0)), tr)) > TREE_R) continue;
      const half = Math.sqrt(Math.max(0, TREE_R * TREE_R - len(sub(add(eye, mul(d, t0)), tr)) ** 2)) / L2;
      const h1 = hAt(Math.max(0, t0 - half)), h2 = hAt(Math.min(tEnd, t0 + half));
      if (Math.max(h1, h2) >= TREE_LOW && Math.min(h1, h2) <= TREE_TOP && t0 < tEnd) return true;
    }
    return false;
  }

  function visibilityAt(S, eye) {
    const cells = facePoints(S, 8, 4);
    if (dot2(sub(eye, S.c), S.n) <= 0) return { pct: 0, cells: cells.map(() => false) };   // îl vezi din spate
    const ok = cells.map(t => !rayBlocked(S, eye, t));
    return { pct: 100 * ok.filter(Boolean).length / ok.length, cells: ok };
  }

  function visibility(S) {
    const byDistance = {};
    DISTANCES.forEach(d => { byDistance[d] = visibilityAt(S, viewpoint(S, d)); });
    // media pe tot traseul (din 10 în 10 m, între 200 și 20 m de panou)
    let sum = 0, n = 0;
    for (let d = 200; d >= 20; d -= 10) { sum += visibilityAt(S, viewpoint(S, d)).pct; n++; }
    const visible = sum / n;
    return { byDistance, visible_pct: visible, occluded_pct: 100 - visible };
  }

  // ---------------------------------------------------------------- Google Street View
  let G = null, svc = null;
  async function loadGoogle(key) {
    if (G) return G;
    await new Promise((res, rej) => {
      window.__slGoogle = res;
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__slGoogle`;
      s.onerror = () => rej(new Error("Google Maps nu s-a încărcat"));
      document.head.appendChild(s);
    });
    G = await google.maps.importLibrary("streetView");
    svc = new G.StreetViewService();
    return G;
  }

  async function findPano(S, d) {
    const vp = S.G(viewpoint(S, d));
    let res = null;
    for (const radius of [12, 25, 40]) {   // întâi strict pe stradă, ca să nu prindem o panoramă de pe o stradă laterală
      const opts = { location: { lat: vp.lat, lng: vp.lon }, radius, preference: G.StreetViewPreference.NEAREST };
      if (G.StreetViewSource && G.StreetViewSource.GOOGLE) opts.sources = [G.StreetViewSource.GOOGLE];
      else opts.source = G.StreetViewSource.OUTDOOR;
      try { res = (await svc.getPanorama(opts)).data; break; } catch (e) {}
    }
    if (!res) throw new Error("fără Street View");
    const pos = S.L({ lat: res.location.latLng.lat(), lon: res.location.latLng.lng() });
    const to = sub(S.c, pos), dist = len(to);
    return {
      pano: res.location.pano, date: res.imageDate, pos, dist,
      heading: (deg(Math.atan2(to.x, to.y)) + 360) % 360,
      pitch: deg(Math.atan2(S.E - CAM_H, dist)) * 0.6,
    };
  }

  // ---------------------------------------------------------------- Desenarea panoului în perspectivă
  function project(v, cam) {
    const h = rad(cam.heading), p = rad(cam.pitch);
    const fwd = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
    const rgt = [Math.cos(h), -Math.sin(h), 0];
    const up = [-Math.sin(h) * Math.sin(p), -Math.cos(h) * Math.sin(p), Math.cos(p)];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = dot(v, fwd); if (z < 0.5) return null;
    const f = (cam.W / 2) / Math.tan(rad(cam.fov) / 2);
    return { x: cam.W / 2 + f * dot(v, rgt) / z, y: cam.H / 2 - f * dot(v, up) / z, z };
  }

  function drawBoard(g, S, cam, img) {
    const { W, H, E } = S, bottom = E - H / 2, top = E + H / 2;
    // x = de-a lungul panoului, z = înălțime de la sol, b = în spatele feței
    const P = (x, z, b) => {
      const q = add(add(S.c, mul(S.r, x)), mul(S.n, -b)), v = sub(q, cam.pos);
      return project([v.x, v.y, z - CAM_H], cam);
    };
    const f = (cam.W / 2) / Math.tan(rad(cam.fov) / 2);
    const quad = (pts, color) => {
      if (pts.some(p => !p)) return;
      g.fillStyle = color; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fill();
    };
    const pole = (x, r) => {
      const a = P(x, 0, 0.5), b = P(x, bottom - 0.2, 0.5); if (!a || !b) return;
      const wa = f * r / a.z, wb = f * r / b.z;
      const gr = g.createLinearGradient(a.x - wa, 0, a.x + wa, 0);
      gr.addColorStop(0, "#43474d"); gr.addColorStop(0.45, "#8a8f96"); gr.addColorStop(1, "#3a3d42");
      g.fillStyle = gr; g.beginPath();
      g.moveTo(a.x - wa * 1.15, a.y); g.lineTo(a.x + wa * 1.15, a.y); g.lineTo(b.x + wb, b.y); g.lineTo(b.x - wb, b.y); g.closePath(); g.fill();
    };
    if (S.mount === "unipol") pole(0, 0.45);
    if (S.mount === "two") { pole(-W / 3, 0.25); pole(W / 3, 0.25); }

    const fr = S.mount === "wall" ? 0.15 : 0.3, depth = S.mount === "wall" ? 0.25 : 0.2;
    quad([P(-W / 2 - fr, top + fr, depth), P(W / 2 + fr, top + fr, depth), P(W / 2 + fr, bottom - fr, depth), P(-W / 2 - fr, bottom - fr, depth)], "#24272c");
    if (S.mount === "unipol") quad([P(-1.5, bottom - 0.2, 0.3), P(1.5, bottom - 0.2, 0.3), P(1.5, bottom - 0.5, 0.3), P(-1.5, bottom - 0.5, 0.3)], "#5b5f66");

    if (dot2(sub(cam.pos, S.c), S.n) <= 0) return;      // din spate se vede doar rama
    const N = 10, iw = img.width, ih = img.height, grid = [];
    for (let j = 0; j <= N; j++) { grid.push([]); for (let i = 0; i <= N; i++) grid[j].push(P(-W / 2 + W * i / N, top - H * j / N, 0)); }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const p00 = grid[j][i], p10 = grid[j][i + 1], p01 = grid[j + 1][i], p11 = grid[j + 1][i + 1];
      if (!p00 || !p10 || !p01 || !p11) continue;
      const s = (a, b) => ({ x: iw * a / N, y: ih * b / N });
      tri(g, img, s(i, j), s(i + 1, j), s(i, j + 1), p00, p10, p01);
      tri(g, img, s(i + 1, j), s(i + 1, j + 1), s(i, j + 1), p10, p11, p01);
    }
  }

  function tri(g, img, s0, s1, s2, d0, d1, d2) {
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
    const grow = p => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { x: p.x + dx / l * 0.6, y: p.y + dy / l * 0.6 }; };
    const e0 = grow(d0), e1 = grow(d1), e2 = grow(d2);
    const u1x = s1.x - s0.x, u1y = s1.y - s0.y, u2x = s2.x - s0.x, u2y = s2.y - s0.y;
    const v1x = d1.x - d0.x, v1y = d1.y - d0.y, v2x = d2.x - d0.x, v2y = d2.y - d0.y;
    const det = u1x * u2y - u2x * u1y; if (!det) return;
    const a = (v1x * u2y - v2x * u1y) / det, c = (v2x * u1x - v1x * u2x) / det;
    const b = (v1y * u2y - v2y * u1y) / det, d = (v2y * u1x - v1y * u2x) / det;
    g.save(); g.beginPath(); g.moveTo(e0.x, e0.y); g.lineTo(e1.x, e1.y); g.lineTo(e2.x, e2.y); g.closePath(); g.clip();
    g.transform(a, b, c, d, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - d * s0.y);
    g.drawImage(img, 0, 0); g.restore();
  }

  function fallbackAd() {
    const c = document.createElement("canvas"); c.width = 1200; c.height = 400;
    const g = c.getContext("2d");
    g.fillStyle = "#c62828"; g.fillRect(0, 0, 1200, 400);
    g.fillStyle = "#fff"; g.font = "bold 120px system-ui"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("RECLAMA TA", 600, 200);
    return c;
  }

  // ---------------------------------------------------------------- Vizibilitate pentru toate pinurile (o folosește scorul)
  let campaign = null;
  try { campaign = JSON.parse(sessionStorage.getItem("sightline-campaign") || "null"); } catch (e) {}
  const store = (() => { try { return JSON.parse(sessionStorage.getItem("sightline-visibility") || "{}"); } catch (e) { return {}; } })();

  // ---------------------------------------------------------------- Vizibilitate prin modelul 3D Google (Cesium)
  // Vede ce nu e în OpenStreetMap: copacii reali, stâlpii, marchizele. Rulează într-un viewer Cesium ascuns (în afara ecranului);
  // tile-urile nu se salvează, se păstrează doar procentele.
  const CESIUM_JS = "https://cesium.com/downloads/cesiumjs/releases/1.120/Build/Cesium/Cesium.js";
  const RAY_SKIP_M = 4;      // primii metri din fața șoferului (mașini parcate, borduri) nu contează
  const RAY_END_M = 1.5;     // ultimul metru și jumătate = peretele / structura panoului
  // În fotogrammetria Google, coroanele copacilor sunt „blocuri” pline până la sol (pe Dorobanți fac un tunel peste drum).
  // În realitate șoferul vede pe sub coroane, printre trunchiuri. De aceea ignorăm lovirile sub 3,5 m de la nivelul drumului
  // și continuăm raza; ce e mai sus (coroana reală, clădiri) blochează. Clădirile joase le prinde oricum OpenStreetMap.
  const CANOPY_BASE_M = 3.5;
  // Deasupra, o lovire în afara oricărei clădiri OSM e un copac. Coroanele din fotogrammetrie sunt umflate și pline,
  // dar frunzișul real lasă să se vadă printre ramuri (și toamna/iarna mult mai mult): un pătrățel din spatele unui copac
  // contează 35% vizibil, nu 0. În spatele unei clădiri contează 0.
  const TREE_SEE = 0.35;
  let cz = null, czQueue = Promise.resolve();

  function cesiumToken() { return (window.SIGHTLINE_CONFIG && window.SIGHTLINE_CONFIG.cesiumIonToken) || ""; }

  async function czInit() {
    if (cz) return cz;
    if (typeof Cesium === "undefined") await new Promise((res, rej) => {
      const sc = document.createElement("script"); sc.src = CESIUM_JS; sc.onload = res;
      sc.onerror = () => rej(new Error("CesiumJS nu s-a încărcat")); document.head.appendChild(sc);
    });
    Cesium.Ion.defaultAccessToken = cesiumToken();
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;left:-12000px;top:0;width:1024px;height:640px;";
    document.body.appendChild(div);
    const viewer = new Cesium.Viewer(div, { globe: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
      navigationHelpButton: false, timeline: false, animation: false, fullscreenButton: false, infoBox: false, selectionIndicator: false });
    const tiles = await Cesium.createGooglePhotorealistic3DTileset();
    tiles.maximumScreenSpaceError = 4;
    tiles.cullRequestsWhileMoving = false;
    viewer.scene.primitives.add(tiles);
    cz = { viewer, tiles };
    return cz;
  }

  async function czWait(maxMs) {
    const frame = () => new Promise(r => requestAnimationFrame(r));
    const t0 = Date.now(); let ok = 0;
    await new Promise(r => setTimeout(r, 800));
    while (Date.now() - t0 < maxMs) { ok = cz.tiles.tilesLoaded ? ok + 1 : 0; if (ok >= 8) break; await frame(); }
  }

  // nivelul drumului (înălțime elipsoidală): din suprafața modelului 3D pe traseu, partea de jos (nu mașini, nu coroane)
  async function czRoadLevel(S) {
    const scene = cz.viewer.scene, pts = S.drive.map(p => S.G(p));
    cz.viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(S.pin.lon, S.pin.lat - 0.0022, 380),
      orientation: { heading: 0, pitch: rad(-50), roll: 0 } });
    await czWait(15000);
    let hs = [];
    for (const p of pts) {   // rază de sus în jos în fiecare punct al traseului
      const top = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 1500), bottom = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, -200);
      const dir = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(bottom, top, new Cesium.Cartesian3()), new Cesium.Cartesian3());
      const hit = scene.pickFromRay(new Cesium.Ray(top, dir));
      if (hit && hit.position) hs.push(Cesium.Cartographic.fromCartesian(hit.position).height);
    }
    if (hs.length < 3) {
      try {
        const res = await scene.sampleHeightMostDetailed(pts.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat)));
        hs = res.map(c => c.height).filter(Number.isFinite);
      } catch (e) {}
    }
    hs.sort((a, b) => a - b);
    return hs.length >= 3 ? hs[Math.floor(hs.length * 0.2)] : null;
  }

  async function czRefine(S, onStep) {
    await czInit();
    const road = await czRoadLevel(S);
    if (road === null) throw new Error("modelul 3D nu are date pe traseu");
    const C3 = Cesium.Cartesian3, scene = cz.viewer.scene;
    const out = {};
    for (const d of DISTANCES) {
      if (onStep) onStep(d);
      const vp = viewpoint(S, d), g = S.G(vp), to = sub(S.c, vp);
      cz.viewer.camera.setView({ destination: C3.fromDegrees(g.lon, g.lat, road + 3),
        orientation: { heading: Math.atan2(to.x, to.y), pitch: Math.atan2(S.E - 3, len(to)), roll: 0 } });
      cz.viewer.camera.frustum.fov = rad(60);
      await czWait(20000);
      const eye = C3.fromDegrees(g.lon, g.lat, road + EYE_H);
      out[d] = facePoints(S, 8, 4).map(t => {
        const tg = S.G(t.p), target = C3.fromDegrees(tg.lon, tg.lat, road + t.z);
        const v = C3.normalize(C3.subtract(target, eye, new C3()), new C3());
        const origin = C3.add(eye, C3.multiplyByScalar(v, RAY_SKIP_M, new C3()), new C3());
        const distT = C3.distance(origin, target);
        let o = origin, travelled = 0;
        for (let k = 0; k < 12; k++) {
          const hit = scene.pickFromRay(new Cesium.Ray(o, v));
          if (!hit || !hit.position) return 1;
          const dHit = travelled + C3.distance(o, hit.position);
          if (dHit >= distT - RAY_END_M) return 1;                          // a ajuns la panou
          const carto = Cesium.Cartographic.fromCartesian(hit.position), hAbove = carto.height - road;
          if (hAbove >= CANOPY_BASE_M) {
            const lp = S.L({ lat: deg(carto.latitude), lon: deg(carto.longitude) });
            const inBuilding = S.buildings.some(b => hAbove < b.h + 2 && pointInPoly(lp, b.poly));
            return inBuilding ? 0 : TREE_SEE;                               // clădire: blocat; copac: parțial
          }
          travelled = dHit + 0.5;                                           // pe sub coroană: continuăm raza
          o = C3.add(origin, C3.multiplyByScalar(v, travelled, new C3()), new C3());
        }
        return 1;
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- Vizibilitate pentru un pin: OSM (clădiri) + Cesium (copaci și restul)
  async function computeFor(loc, mount, onStatus) {
    const size = (campaign && campaign.billboardSize) || {};
    const key = `v2|${loc.lat.toFixed(6)},${loc.lon.toFixed(6)}|${mount}|${size.width || 12}x${size.height || 4}`;
    const json = await overpass(loc.lat, loc.lon);
    const S = buildScene(json, { lat: loc.lat, lon: loc.lon }, size, mount);
    S.locId = loc.id;
    S.vis = visibility(S);
    let source = "osm";
    const prev = store[loc.id];
    let czCells = prev && prev.key === key && prev.source === "osm+cesium" ? prev.cesium_cells : null;
    if (!czCells && cesiumToken()) {
      if (onStatus) onStatus("Caut copacii și obstacolele în modelul 3D Google…");
      const job = czQueue.then(() => czRefine(S, d => onStatus && onStatus(`Modelul 3D Google: raze de la ${d} m…`)));
      czQueue = job.catch(() => null);
      try { czCells = await job; } catch (e) { console.warn("SightLine: vizibilitatea Cesium a eșuat:", e); }
    }
    if (czCells) {
      source = "osm+cesium";
      DISTANCES.forEach(d => {
        const v = S.vis.byDistance[d], cells = v.cells.map((ok, i) => ok ? Number(czCells[d][i]) : 0);
        S.vis.byDistance[d] = { pct: 100 * cells.reduce((a, c) => a + c, 0) / cells.length, cells };
      });
      const visible = DISTANCES.reduce((a, d) => a + S.vis.byDistance[d].pct, 0) / DISTANCES.length;
      S.vis.visible_pct = visible; S.vis.occluded_pct = 100 - visible;
    }
    store[loc.id] = {
      key, source, occluded_pct: Math.round(S.vis.occluded_pct * 10) / 10, mount,
      by_distance: Object.fromEntries(DISTANCES.map(d => [d, Math.round(S.vis.byDistance[d].pct)])),
      cesium_cells: czCells || null,
      road_name: S.roadName, buildings: S.buildings.length, osm_trees: S.trees.length,
    };
    try { sessionStorage.setItem("sightline-visibility", JSON.stringify(store)); } catch (e) {}
    return S;
  }

  // Promisiune pe care o așteaptă results.html înainte de POST /score: { id_pin: { occluded_pct, ... } }.
  // Dacă nu se termină în 2 minute, scorul pleacă fără ea (și scoring/ folosește valoarea lui implicită).
  const readyJobs = {};
  const ready = (campaign && campaign.locations && campaign.locations.length)
    ? Promise.race([
        Promise.all(campaign.locations.map(l => (readyJobs[l.id] = computeFor(l, "unipol").catch(() => null)))),
        new Promise(r => setTimeout(r, 120000)),
      ]).then(() => store)
    : Promise.resolve(store);

  // ---------------------------------------------------------------- Interfața din caseta „Randare 3D”
  const CSS = `
    .slv { position: relative; background: #111; aspect-ratio: 4 / 3; }
    .slv canvas, .slv .slv-live { position: absolute; inset: 0; width: 100%; height: 100%; }
    .slv .slv-live { display: none; } .slv.live .slv-live { display: block; } .slv.live canvas.slv-shot { display: none; }
    .slv canvas.slv-over { pointer-events: none; z-index: 5; display: none; } .slv.live canvas.slv-over { display: block; }
    .slv-bar { position: absolute; z-index: 6; left: 10px; right: 10px; bottom: 10px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .slv-bar select, .slv-bar button { font: 600 11px system-ui, sans-serif; padding: 6px 9px; border-radius: 999px; border: 1px solid rgb(255 255 255 / 55%);
      background: rgb(255 255 255 / 85%); color: #2b3328; cursor: pointer; }
    .slv-vis { margin-left: auto; font: 700 11px system-ui, sans-serif; padding: 6px 10px; border-radius: 999px; background: rgb(20 24 20 / 75%); color: #fff;
      display: flex; gap: 6px; align-items: center; }
    .slv-grid { display: inline-grid; grid-template-columns: repeat(8, 6px); gap: 1px; }
    .slv-grid i { width: 6px; height: 4px; display: block; }
    .slv-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center;
      color: #e8ece6; font: 500 13px system-ui, sans-serif; background: rgb(17 17 17 / 70%); z-index: 4; }
    .slv-msg:empty { display: none; }`;

  function init() {
    const scene = document.querySelector(".scene");
    if (!scene || !campaign || !campaign.locations || !campaign.locations.length) return;

    const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    const box = document.createElement("div"); box.className = "slv";
    box.innerHTML = `<canvas class="slv-shot" width="${IMG_W}" height="${IMG_H}"></canvas><div class="slv-live"></div><canvas class="slv-over"></canvas>
      <div class="slv-msg">Pregătesc vederea șoferului…</div>
      <div class="slv-bar"><select class="slv-pin"></select><select class="slv-mount"></select><button class="slv-livebtn" type="button">Live 360°</button>
      <span class="slv-vis"></span></div>`;
    const svg = scene.querySelector("svg"), overlayLabel = scene.querySelector(".scene-overlay");
    scene.appendChild(box);
    const $ = s => box.querySelector(s), msg = t => { $(".slv-msg").textContent = t || ""; };

    campaign.locations.forEach((l, i) => $(".slv-pin").add(new Option(`Pin ${i + 1}`, l.id)));
    Object.entries(MOUNTS).forEach(([k, v]) => $(".slv-mount").add(new Option(v, k)));

    const img = new Image();
    let ad = fallbackAd();
    if (campaign.creativePreview) { img.onload = () => { ad = img; paint(); }; img.src = campaign.creativePreview; }

    const key = (window.SIGHTLINE_CONFIG && window.SIGHTLINE_CONFIG.googleMapsApiKey) || "";
    let S = null, shots = {}, dist = 150, live = null, run = 0;

    function showVis() {
      const v = S && S.vis; if (!v) { $(".slv-vis").innerHTML = ""; return; }
      const at = v.byDistance[dist];
      const src = store[S.locId] && store[S.locId].source === "osm+cesium" ? "clădiri + copaci (3D Google)" : "doar clădiri OSM";
      $(".slv-vis").innerHTML = `vizibil ${at.pct.toFixed(0)}% la ${dist} m · ${v.visible_pct.toFixed(0)}% în medie · ${src}
        <span class="slv-grid">${at.cells.map(c => `<i style="background:${c === true || c >= 1 ? "#4caf50" : c > 0 ? "#ffb300" : "#e53935"}"></i>`).join("")}</span>`;
    }

    function paint() {
      if (box.classList.contains("live")) { drawLive(); return; }
      const shot = shots[dist], g = $(".slv-shot").getContext("2d");
      g.fillStyle = "#111"; g.fillRect(0, 0, IMG_W, IMG_H);
      if (!shot || !S) return;
      if (shot.error) { msg(shot.error); return; }
      msg("");
      g.drawImage(shot.img, 0, 0, IMG_W, IMG_H);
      drawBoard(g, S, { pos: shot.pos, heading: shot.heading, pitch: shot.pitch, fov: FOV, W: IMG_W, H: IMG_H }, ad);
      g.font = "600 11px system-ui"; g.fillStyle = "rgb(255 255 255 / 85%)";
      g.fillText(`Street View${shot.date ? " " + shot.date : ""} · panorama la ${shot.dist.toFixed(0)} m de panou · panou simulat SightLine`, 12, 20);
    }

    async function load() {
      const my = ++run;
      const loc = campaign.locations.find(l => l.id === $(".slv-pin").value) || campaign.locations[0];
      const mount = $(".slv-mount").value;
      shots = {}; S = null; box.classList.remove("live"); paint(); showVis();
      try {
        msg("Caut strada, clădirile și copacii în OpenStreetMap…");
        const before = store[loc.id] && store[loc.id].occluded_pct;
        if (mount === "unipol" && readyJobs[loc.id]) S = await readyJobs[loc.id];
        if (!S || S.mount !== mount) S = await computeFor(loc, mount, t => { if (my === run) msg(t); });
        if (my !== run) return;
        if (!S) throw new Error("nu am putut calcula scena");
        // tipul panoului schimbă vizibilitatea → recalculăm clasamentul din pagina lui P4
        if (before !== undefined && before !== store[loc.id].occluded_pct && typeof window.loadScore === "function") window.loadScore(campaign);
        window.dispatchEvent(new CustomEvent("sightline:visibility", { detail: { id: loc.id, ...store[loc.id] } }));
        showVis();
        if (!cesiumToken()) $(".slv-vis").title = "Fără token Cesium: vizibilitatea ține cont doar de clădiri și de copacii din OpenStreetMap.";
        if (!key) { msg("Vizibilitatea e calculată. Pentru poze Street View pune cheia Google în web/config.local.js."); return; }
        msg("Încarc pozele Street View…");
        await loadGoogle(key);
        for (const d of DISTANCES) {
          try {
            const p = await findPano(S, d); if (my !== run) return;
            const im = new Image();
            im.src = `https://maps.googleapis.com/maps/api/streetview?size=${IMG_W}x${IMG_H}&pano=${p.pano}&heading=${p.heading.toFixed(1)}&pitch=${p.pitch.toFixed(1)}&fov=${FOV}&return_error_code=true&key=${encodeURIComponent(key)}`;
            await im.decode();
            shots[d] = { ...p, img: im };
          } catch (e) { shots[d] = { error: `Nu există Street View lângă punctul de ${d} m.` }; }
          if (my !== run) return;
          if (d === dist) paint();
        }
        if (svg) svg.style.display = "none";
        if (overlayLabel) overlayLabel.textContent = "Street View + panou SightLine";
        const sub = scene.parentElement && scene.parentElement.querySelector(".caption-sub");
        if (sub) sub.textContent = `Poze reale Street View · ${S.roadName} · vizibilitate: ${store[loc.id] && store[loc.id].source === "osm+cesium" ? "clădiri OSM + model 3D Google" : "clădiri OSM"}`;
        paint();
      } catch (e) { msg("Nu am putut pregăti vederea: " + e.message); }
    }

    // ---- live: panorama Google, panoul desenat deasupra
    function openLive() {
      const shot = shots[dist]; if (!shot || shot.error || !G) return;
      if (box.classList.contains("live")) { box.classList.remove("live"); $(".slv-livebtn").textContent = "Live 360°"; paint(); return; }
      box.classList.add("live"); $(".slv-livebtn").textContent = "Înapoi la poză";
      const pov = { heading: shot.heading, pitch: shot.pitch };
      if (!live) {
        live = new G.StreetViewPanorama($(".slv-live"), { pano: shot.pano, pov, zoom: 1, addressControl: false, fullscreenControl: false,
          motionTracking: false, motionTrackingControl: false, showRoadLabels: false, zoomControl: false, scrollwheel: false, panControl: false });
        ["pov_changed", "zoom_changed", "position_changed"].forEach(ev => live.addListener(ev, () => requestAnimationFrame(drawLive)));
        new ResizeObserver(() => requestAnimationFrame(drawLive)).observe(box);
      } else { live.setPano(shot.pano); live.setPov(pov); live.setZoom(1); }
    }
    function drawLive() {
      if (!live || !S || !box.classList.contains("live")) return;
      const cv = $(".slv-over"), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const p = live.getPosition(), pov = live.getPov(); if (!p) return;
      drawBoard(g, S, { pos: S.L({ lat: p.lat(), lon: p.lng() }), heading: pov.heading, pitch: pov.pitch,
        fov: 180 / Math.pow(2, live.getZoom() || 1), W, H }, ad);
    }

    // butoanele existente 150 / 80 / 30 m din pagina lui P4
    document.querySelectorAll("[data-distance]").forEach(b => b.addEventListener("click", () => {
      dist = +b.dataset.distance;
      if (box.classList.contains("live")) { box.classList.remove("live"); $(".slv-livebtn").textContent = "Live 360°"; }
      paint(); showVis();
    }));
    $(".slv-pin").onchange = load;
    $(".slv-mount").onchange = load;
    $(".slv-livebtn").onclick = openLive;
    load();
  }

  window.SightLineView = { buildScene, visibility, viewpoint, DISTANCES, ready };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
