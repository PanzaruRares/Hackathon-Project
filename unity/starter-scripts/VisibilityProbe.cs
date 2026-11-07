using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

/// <summary>
/// Măsoară, în fiecare cadru, cât din panou vede șoferul și dacă textul se poate citi.
/// Pune scriptul pe Main Camera, lângă DriverCamera. La final scrie results.json
/// după contracts/results.example.json.
/// </summary>
[RequireComponent(typeof(Camera))]
public class VisibilityProbe : MonoBehaviour
{
    [Header("Panou")]
    public Transform billboard;
    [Tooltip("Lățime × înălțime panou, în metri.")]
    public Vector2 billboardSizeMeters = new Vector2(12f, 4f);
    [Tooltip("Numără doar când șoferul e în fața panoului (nu din spate).")]
    public bool checkFacing = true;
    [Tooltip("Bifat pentru Quad (fața vizibilă e spre -Z). Debifat pentru Cube orientat cu +Z spre drum.")]
    public bool frontIsNegativeZ = true;

    [Header("Grilă de raze")]
    [Range(2, 20)] public int gridX = 8;
    [Range(2, 10)] public int gridY = 4;

    [Header("Praguri")]
    [Tooltip("Panoul contează ca vizibil dacă cel puțin acest procent din puncte se vede.")]
    [Range(0f, 1f)] public float visibleThreshold = 0.5f;
    [Tooltip("Ce fracțiune din înălțimea panoului ocupă literele textului principal.")]
    [Range(0.02f, 0.5f)] public float letterHeightFraction = 0.12f;
    [Tooltip("Sub această înălțime în pixeli, textul e considerat ilizibil (la 1080p). De calibrat.")]
    public float minReadableLetterPx = 14f;

    [Header("Ieșire")]
    public string locationId = "A";
    public string direction = "N-S";
    [Tooltip("Calea de la folderul proiectului Unity până la rădăcina repo-ului.")]
    public string repoRootFromProject = "../..";
    public string outputFile = "data/results_A.json";
    public string framesDir = "data/frames/A";

    // Valori curente, citite de SimHud
    public float CurrentVisiblePct { get; private set; }
    public float CurrentLetterPx { get; private set; }
    public float CurrentDistance { get; private set; }
    public float VisibleSeconds { get; private set; }
    public bool IsVisible => CurrentVisiblePct >= visibleThreshold * 100f;
    public bool IsReadable => IsVisible && CurrentLetterPx >= minReadableLetterPx;

    Camera cam;
    DriverCamera driver;
    readonly List<FrameRecord> frames = new List<FrameRecord>();
    float occlusionSum; int occlusionSamples;
    float firstVisibleDistance = -1f;
    float minLetter = float.MaxValue, maxLetter = 0f;
    bool written;

    void Awake()
    {
        cam = GetComponent<Camera>();
        driver = GetComponent<DriverCamera>();
    }

    void LateUpdate()
    {
        if (billboard == null || (driver != null && driver.Finished)) return;

        Vector3 camPos = transform.position;
        Vector3 normal = frontIsNegativeZ ? -billboard.forward : billboard.forward;
        CurrentDistance = Vector3.Distance(camPos, billboard.position);

        int total = gridX * gridY, inView = 0, seen = 0;
        for (int ix = 0; ix < gridX; ix++)
        for (int iy = 0; iy < gridY; iy++)
        {
            float u = (ix + 0.5f) / gridX - 0.5f;
            float v = (iy + 0.5f) / gridY - 0.5f;
            Vector3 p = billboard.position
                        + billboard.right * (u * billboardSizeMeters.x)
                        + billboard.up * (v * billboardSizeMeters.y);

            Vector3 vp = cam.WorldToViewportPoint(p);
            bool inFrustum = vp.z > 0f && vp.x >= 0f && vp.x <= 1f && vp.y >= 0f && vp.y <= 1f;
            bool facing = !checkFacing || Vector3.Dot(normal, camPos - p) > 0f;
            if (!inFrustum || !facing) continue;

            inView++;
            Vector3 dir = p - camPos;
            float dist = dir.magnitude;
            bool blocked = false;
            if (Physics.Raycast(camPos, dir / dist, out RaycastHit hit, dist - 0.05f))
                blocked = hit.transform != billboard && !hit.transform.IsChildOf(billboard);
            if (!blocked) seen++;
        }

        CurrentVisiblePct = 100f * seen / total;
        if (inView > 0)
        {
            occlusionSum += 100f * (inView - seen) / inView;
            occlusionSamples++;
        }

        // Înălțimea panoului pe ecran → înălțimea literelor în pixeli
        Vector3 top = cam.WorldToScreenPoint(billboard.position + billboard.up * billboardSizeMeters.y * 0.5f);
        Vector3 bottom = cam.WorldToScreenPoint(billboard.position - billboard.up * billboardSizeMeters.y * 0.5f);
        float panelPx = (top.z > 0f && bottom.z > 0f) ? Vector2.Distance(top, bottom) : 0f;
        // Normalizare la 1080p, ca pragul să nu depindă de rezoluția ferestrei
        CurrentLetterPx = panelPx * letterHeightFraction * (1080f / Screen.height);

        if (IsVisible)
        {
            VisibleSeconds += Time.deltaTime;
            if (firstVisibleDistance < 0f) firstVisibleDistance = CurrentDistance;
            minLetter = Mathf.Min(minLetter, CurrentLetterPx);
            maxLetter = Mathf.Max(maxLetter, CurrentLetterPx);
        }

        frames.Add(new FrameRecord
        {
            file = $"{frames.Count + 1:D4}.png",
            t_s = driver != null ? driver.ElapsedSeconds : Time.timeSinceLevelLoad,
            distance_m = CurrentDistance,
            visible_pct = CurrentVisiblePct,
            letter_px = CurrentLetterPx
        });
    }

    public void WriteResults()
    {
        if (written) return;
        written = true;

        var result = new Results
        {
            location_id = locationId,
            source = "unity",
            approaches = new List<Approach>
            {
                new Approach
                {
                    direction = direction,
                    visible_seconds = Round(VisibleSeconds, 2),
                    occluded_pct = Round(occlusionSamples > 0 ? occlusionSum / occlusionSamples : 100f, 1),
                    first_visible_distance_m = Round(Mathf.Max(firstVisibleDistance, 0f), 1),
                    min_letter_px = Round(minLetter == float.MaxValue ? 0f : minLetter, 1),
                    max_letter_px = Round(maxLetter, 1),
                    frames_dir = $"{framesDir}/{direction}",
                    frames = frames
                }
            }
        };

        string root = Path.GetFullPath(Path.Combine(Application.dataPath, "..", repoRootFromProject));
        string path = Path.Combine(root, outputFile);
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        File.WriteAllText(path, JsonUtility.ToJson(result, true));
        Debug.Log($"VisibilityProbe: am scris {path} (vizibil {VisibleSeconds:F1} s)");
    }

    void OnApplicationQuit() => WriteResults();

    static float Round(float v, int digits) => (float)Math.Round(v, digits);

    [Serializable] public class FrameRecord { public string file; public float t_s; public float distance_m; public float visible_pct; public float letter_px; }
    [Serializable] public class Approach { public string direction; public float visible_seconds; public float occluded_pct; public float first_visible_distance_m; public float min_letter_px; public float max_letter_px; public string frames_dir; public List<FrameRecord> frames; }
    [Serializable] public class Results { public string location_id; public string source; public List<Approach> approaches; }

    void OnDrawGizmosSelected()
    {
        if (billboard == null) return;
        Gizmos.color = Color.yellow;
        Gizmos.matrix = Matrix4x4.TRS(billboard.position, billboard.rotation, Vector3.one);
        Gizmos.DrawWireCube(Vector3.zero, new Vector3(billboardSizeMeters.x, billboardSizeMeters.y, 0.1f));
    }
}
