using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using KosmoFlot.Core;
using KosmoFlot.Player;
using KosmoFlot.World;
using KosmoFlot.UI;
using KosmoFlot.Meta;

namespace KosmoFlot.EditorTools
{
    /// <summary>
    /// Собирает полностью играбельную сцену KosmoFlot одним кликом:
    /// Меню Unity → KosmoFlot → Build Playable Scene.
    /// Больше ничего вручную настраивать не нужно — жми Play.
    /// </summary>
    public static class SceneBuilder
    {
        private const string ScenePath = "Assets/Scenes/Game.unity";

        [MenuItem("KosmoFlot/Build Playable Scene")]
        public static void Build()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            BuildEnvironment();
            var player = BuildPlayer();
            var generator = BuildManagers(player);
            BuildMetaAndUI();

            Directory.CreateDirectory("Assets/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);
            AddSceneToBuild();

            Debug.Log("KosmoFlot: сцена собрана → " + ScenePath + ". Нажмите Play.");
            EditorUtility.DisplayDialog("KosmoFlot",
                "Играбельная сцена собрана и сохранена:\n" + ScenePath +
                "\n\nНажмите Play, чтобы запустить.", "OK");
        }

        // ---------------- Окружение ----------------
        private static void BuildEnvironment()
        {
            var camGo = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener));
            camGo.tag = "MainCamera";
            var cam = camGo.GetComponent<Camera>();
            cam.fieldOfView = 68f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.02f, 0.024f, 0.06f);
            cam.farClipPlane = 400f;
            camGo.transform.position = new Vector3(0f, 4.4f, 8f);
            camGo.transform.LookAt(new Vector3(0f, 1.4f, -12f));

            var sun = new GameObject("Directional Light", typeof(Light));
            var l = sun.GetComponent<Light>();
            l.type = LightType.Directional;
            l.color = new Color(0.53f, 0.8f, 1f);
            l.intensity = 1.1f;
            sun.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            var fill = new GameObject("Fill Light", typeof(Light));
            var pl = fill.GetComponent<Light>();
            pl.type = LightType.Point;
            pl.color = new Color(0.66f, 0.33f, 0.97f);
            pl.intensity = 1.4f;
            pl.range = 60f;
            fill.transform.position = new Vector3(0f, 6f, -20f);

            RenderSettings.ambientLight = new Color(0.33f, 0.4f, 0.6f);
            RenderSettings.fog = true;
            RenderSettings.fogColor = new Color(0.02f, 0.024f, 0.06f);
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 40f;
            RenderSettings.fogEndDistance = 105f;
        }

        // ---------------- Игрок ----------------
        private static PlayerController BuildPlayer()
        {
            var root = new GameObject("Player");
            root.transform.position = new Vector3(GameConfig.Lanes[1], 0f, 0f);

            var box = root.AddComponent<BoxCollider>();
            box.size = new Vector3(1f, 1.6f, 0.8f);
            box.center = new Vector3(0f, 0.8f, 0f);

            var rb = root.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;

            root.AddComponent<PlayerController>();

            // Визуал: корпус + крылья + свечение двигателя
            var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            body.name = "Body";
            body.transform.SetParent(root.transform, false);
            body.transform.localPosition = new Vector3(0f, 0.9f, 0f);
            body.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            body.transform.localScale = new Vector3(0.7f, 1f, 0.7f);
            Object.DestroyImmediate(body.GetComponent<Collider>());
            Paint(body, new Color(0.22f, 0.91f, 1f), true);

            var wings = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wings.name = "Wings";
            wings.transform.SetParent(root.transform, false);
            wings.transform.localPosition = new Vector3(0f, 0.7f, 0f);
            wings.transform.localScale = new Vector3(2.4f, 0.12f, 0.7f);
            Object.DestroyImmediate(wings.GetComponent<Collider>());
            Paint(wings, new Color(0.66f, 0.33f, 0.97f), true);

            var glow = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            glow.name = "EngineGlow";
            glow.transform.SetParent(root.transform, false);
            glow.transform.localPosition = new Vector3(0f, 0.85f, 0.9f);
            glow.transform.localScale = Vector3.one * 0.35f;
            Object.DestroyImmediate(glow.GetComponent<Collider>());
            Paint(glow, new Color(1f, 0.81f, 0.30f), true);

            return root.GetComponent<PlayerController>();
        }

        // ---------------- Менеджеры ----------------
        private static TrackGenerator BuildManagers(PlayerController player)
        {
            var gm = new GameObject("GameManager");
            var manager = gm.AddComponent<GameManager>();
            var generator = gm.AddComponent<TrackGenerator>();
            manager.player = player;
            manager.generator = generator;
            return generator;
        }

        private static void BuildMetaAndUI()
        {
            var metaGo = new GameObject("MetaController");
            var meta = metaGo.AddComponent<MetaController>();
            var ads = metaGo.AddComponent<RewardedAdManager>();
            meta.ads = ads;

            new GameObject("UIManager").AddComponent<UIManager>();
        }

        // ---------------- Утилиты ----------------
        private static void Paint(GameObject go, Color c, bool emissive)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var m = new Material(shader);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            if (emissive)
            {
                m.EnableKeyword("_EMISSION");
                if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", c * 0.6f);
            }
            go.GetComponent<Renderer>().sharedMaterial = m;
        }

        private static void AddSceneToBuild()
        {
            var scenes = new System.Collections.Generic.List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            if (!scenes.Exists(s => s.path == ScenePath))
                scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
        }
    }
}
