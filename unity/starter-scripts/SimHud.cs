using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// HUD peste imagine: viteză, distanță, secunde vizibile, procent vizibil, lizibilitate.
/// Se construiește singur (Canvas + texte) la Start, deci nu trebuie configurat nimic în scenă.
/// Pune scriptul pe Main Camera, lângă DriverCamera și VisibilityProbe.
/// Unity Recorder (sursa Game View) înregistrează și HUD-ul.
/// </summary>
public class SimHud : MonoBehaviour
{
    public string title = "SightLine · Locația A";
    public int fontSize = 30;

    DriverCamera driver;
    VisibilityProbe probe;
    Text left, right, status;

    static readonly Color Good = new Color(0.30f, 0.85f, 0.45f);
    static readonly Color Bad = new Color(0.95f, 0.35f, 0.30f);
    static readonly Color Neutral = new Color(1f, 1f, 1f, 0.95f);

    void Start()
    {
        driver = GetComponent<DriverCamera>();
        probe = GetComponent<VisibilityProbe>();

        var canvasGo = new GameObject("SightLine HUD", typeof(Canvas), typeof(CanvasScaler));
        var canvas = canvasGo.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = canvasGo.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        Font font = LoadFont();
        CreatePanel(canvasGo.transform, new Vector2(0, 1), new Vector2(24, -24), new Vector2(620, 170));
        left = CreateText(canvasGo.transform, font, new Vector2(0, 1), new Vector2(44, -36), new Vector2(600, 160), TextAnchor.UpperLeft);
        CreatePanel(canvasGo.transform, new Vector2(1, 1), new Vector2(-24, -24), new Vector2(520, 170));
        right = CreateText(canvasGo.transform, font, new Vector2(1, 1), new Vector2(-44, -36), new Vector2(500, 160), TextAnchor.UpperRight);
        status = CreateText(canvasGo.transform, font, new Vector2(0.5f, 0), new Vector2(0, 60), new Vector2(1200, 70), TextAnchor.MiddleCenter);
        status.fontSize = fontSize + 10;
        status.fontStyle = FontStyle.Bold;
    }

    void LateUpdate()
    {
        if (left == null || probe == null) return;

        float speed = driver != null ? driver.SpeedKmh : 0f;
        left.text = $"<b>{title}</b>\n" +
                    $"Viteză: {speed:F0} km/h\n" +
                    $"Distanță până la panou: {probe.CurrentDistance:F0} m\n" +
                    $"Timp vizibil total: {probe.VisibleSeconds:F1} s";
        left.color = Neutral;

        right.text = $"Panou vizibil acum: {probe.CurrentVisiblePct:F0}%\n" +
                     $"Litere: {probe.CurrentLetterPx:F0} px\n" +
                     (probe.IsReadable ? "Text: se citește" : "Text: nu se citește");
        right.color = probe.IsReadable ? Good : (probe.IsVisible ? Neutral : Bad);

        if (!probe.IsVisible)
        {
            status.text = probe.CurrentVisiblePct > 0f ? "PANOU PARȚIAL ACOPERIT" : "PANOU ASCUNS";
            status.color = Bad;
        }
        else
        {
            status.text = probe.IsReadable ? "PANOU VIZIBIL · TEXT LIZIBIL" : "PANOU VIZIBIL · TEXT PREA MIC";
            status.color = probe.IsReadable ? Good : Neutral;
        }
    }

    Text CreateText(Transform parent, Font font, Vector2 anchor, Vector2 pos, Vector2 size, TextAnchor align)
    {
        var go = new GameObject("HUD Text", typeof(RectTransform), typeof(Text), typeof(Outline));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
        var t = go.GetComponent<Text>();
        t.font = font;
        t.fontSize = fontSize;
        t.alignment = align;
        t.supportRichText = true;
        t.horizontalOverflow = HorizontalWrapMode.Overflow;
        t.verticalOverflow = VerticalWrapMode.Overflow;
        go.GetComponent<Outline>().effectColor = new Color(0, 0, 0, 0.6f);
        return t;
    }

    void CreatePanel(Transform parent, Vector2 anchor, Vector2 pos, Vector2 size)
    {
        var go = new GameObject("HUD Panel", typeof(RectTransform), typeof(Image));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
        go.GetComponent<Image>().color = new Color(0, 0, 0, 0.45f);
    }

    static Font LoadFont()
    {
        Font f = null;
        try { f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { }
        if (f == null) { try { f = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { } }
        return f;
    }
}
