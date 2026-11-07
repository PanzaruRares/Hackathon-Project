# Video „ce vede șoferul” — pornire rapidă

Trei scripturi, toate puse pe **Main Camera**:

| Script | Ce face |
|---|---|
| `DriverCamera.cs` | Mută camera pe traseu, cu viteza reală, la 1,2 m înălțime. La final oprește Play Mode. |
| `VisibilityProbe.cs` | Trage raze spre o grilă de puncte de pe panou: procent vizibil, secunde vizibile, mărimea literelor în pixeli. La final scrie `data/results_A.json` (format din `contracts/results.example.json`). |
| `SimHud.cs` | Desenează HUD-ul peste imagine (viteză, distanță, vizibil/acoperit, text lizibil sau nu). Se construiește singur. |

## 1. Copiază scripturile (2 min)

Copiază cele 3 fișiere `.cs` în `Assets/Scripts/` din proiectul Unity (creat în `unity/`).

## 2. Scenă de test, înainte de OSM (10 min)

Ca să vezi că totul merge, înainte să ai orașul:

1. **Drumul:** un Plane, scalat lung (de exemplu 2 × 1 × 30, adică 20 × 300 m).
2. **Clădirile:** câteva Cube-uri înalte de-a lungul drumului. Primitivele au deja collider.
3. **Copacii:** un Cylinder + o Sphere. Colliderele lor blochează razele, adică exact ce vrem.
4. **Panoul:** un **Quad** scalat la 12 × 4, ridicat la ~6 m, întors spre drum. Pune pe el un material cu reclama ca textură (drag & drop PNG pe Quad).
5. **Traseul:** un GameObject gol `Path`, cu 4–6 copii goi puși pe drum, în ordinea mersului, începând la ~200 m de panou.
6. Pe **Main Camera**: Add Component → `DriverCamera` (trage `Path` în *Path Root*, setează *Speed Kmh*), `VisibilityProbe` (trage Quad-ul în *Billboard*) și `SimHud`.
7. Apasă **Play**. Camera merge pe drum, HUD-ul se schimbă, iar la final apare în Console mesajul cu calea fișierului `results_A.json`.

**Dacă panoul apare mereu „ASCUNS”:** debifează *Front Is Negative Z* sau rotește Quad-ul cu 180°. Contează din ce parte îl vede șoferul.

## 3. În scena reală din OSM

- Clădirile generate din OSM au nevoie de **MeshCollider**, altfel razele trec prin ele.
- Punctele traseului se pun pe drumul real, în direcția de mers.
- Viteza o iei din `scene_config.json` → `approaches[].speed_kmh`.

## 4. Înregistrarea video (5 min)

1. **Window → Package Manager → Unity Registry → Recorder → Install.**
2. **Window → General → Recorder → Recorder Window.**
3. **Add Recorder → Movie.**
   - Source: **Game View**
   - Output resolution: **1920 × 1080** (setează și Game View la 1920×1080)
   - Format: **MP4**
   - Frame rate: **30**, Playback: **Constant**, bifează **Cap** (simularea rulează la timp fix, cifrele sunt stabile)
   - Output file: `../../data/videos/A_<Take>` (`data/frames/` și `data/videos/` nu se urcă pe Git; video-urile finale pentru demo le copiați în `web/`)
4. Recording Mode: **Manual**, apoi **START RECORDING**. Intră singur în Play Mode, iar `DriverCamera` oprește la final și închide fișierul.
5. Repetă pentru fiecare locație (schimbă *Billboard*, *Path*, *Location Id* și *Output File*).

Opțional, pentru P3: un al doilea recorder **Image Sequence** (PNG) în `data/frames/A/N-S`, ca să ruleze saliența pe cadre.

## 5. În site

```html
<video src="videos/A.mp4" controls muted playsinline></video>
```

## Calibrare

- `minReadableLetterPx` (14 px la 1080p) și `letterHeightFraction` (0,12) sunt praguri de pornire. Ajustați-le după reclama reală: deschideți PNG-ul și măsurați ce fracțiune din înălțime au literele textului principal.
- Prezentați rezultatele ca **comparații între locații**, nu ca valori absolute.
