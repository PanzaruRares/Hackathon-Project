using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Mută camera de-a lungul unui traseu (waypoints) cu viteza reală a traficului,
/// la înălțimea ochilor unui șofer. Pune scriptul pe Main Camera.
/// </summary>
public class DriverCamera : MonoBehaviour
{
    [Header("Traseu")]
    [Tooltip("Obiect gol ale cărui copii sunt punctele traseului, în ordine. Alternativ, completează lista Waypoints.")]
    public Transform pathRoot;
    public List<Transform> waypoints = new List<Transform>();

    [Header("Mișcare")]
    [Tooltip("Viteza în km/h (din scene_config.json → approaches[].speed_kmh).")]
    public float speedKmh = 42f;
    [Tooltip("Înălțimea ochilor șoferului deasupra drumului, în metri.")]
    public float eyeHeight = 1.2f;
    [Tooltip("Cât de lin se întoarce camera în curbe.")]
    public float turnSmoothing = 4f;
    [Tooltip("Oprește Play Mode la final (util cu Unity Recorder).")]
    public bool stopPlayModeAtEnd = true;

    public bool Finished { get; private set; }
    public float SpeedKmh => speedKmh;
    public float ElapsedSeconds { get; private set; }

    readonly List<Vector3> points = new List<Vector3>();
    int segment;
    float segmentProgress; // metri parcurși pe segmentul curent

    void Start()
    {
        if (pathRoot != null && waypoints.Count == 0)
            foreach (Transform child in pathRoot) waypoints.Add(child);

        foreach (var w in waypoints)
            if (w != null) points.Add(w.position + Vector3.up * eyeHeight);

        if (points.Count < 2)
        {
            Debug.LogError("DriverCamera: ai nevoie de cel puțin 2 waypoints.");
            enabled = false;
            return;
        }

        transform.position = points[0];
        transform.rotation = Quaternion.LookRotation(points[1] - points[0], Vector3.up);
    }

    void Update()
    {
        if (Finished) return;

        float metersThisFrame = speedKmh / 3.6f * Time.deltaTime;
        ElapsedSeconds += Time.deltaTime;

        while (metersThisFrame > 0f && segment < points.Count - 1)
        {
            Vector3 a = points[segment], b = points[segment + 1];
            float segLen = Vector3.Distance(a, b);
            float remaining = segLen - segmentProgress;

            if (metersThisFrame < remaining)
            {
                segmentProgress += metersThisFrame;
                metersThisFrame = 0f;
            }
            else
            {
                metersThisFrame -= remaining;
                segment++;
                segmentProgress = 0f;
            }
        }

        if (segment >= points.Count - 1)
        {
            transform.position = points[points.Count - 1];
            Finished = true;
            OnFinished();
            return;
        }

        Vector3 from = points[segment], to = points[segment + 1];
        float len = Mathf.Max(Vector3.Distance(from, to), 0.001f);
        transform.position = Vector3.Lerp(from, to, segmentProgress / len);

        Vector3 dir = (to - from).normalized;
        if (dir.sqrMagnitude > 0f)
        {
            Quaternion target = Quaternion.LookRotation(dir, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, target, 1f - Mathf.Exp(-turnSmoothing * Time.deltaTime));
        }
    }

    void OnFinished()
    {
        var probe = GetComponent<VisibilityProbe>();
        if (probe != null) probe.WriteResults();

#if UNITY_EDITOR
        if (stopPlayModeAtEnd) UnityEditor.EditorApplication.isPlaying = false;
#endif
    }

    void OnDrawGizmos()
    {
        var list = new List<Transform>(waypoints);
        if (pathRoot != null && list.Count == 0) foreach (Transform c in pathRoot) list.Add(c);
        Gizmos.color = Color.cyan;
        for (int i = 0; i < list.Count - 1; i++)
            if (list[i] != null && list[i + 1] != null)
                Gizmos.DrawLine(list[i].position, list[i + 1].position);
    }
}
