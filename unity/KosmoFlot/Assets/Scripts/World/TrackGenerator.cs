using System.Collections.Generic;
using UnityEngine;
using KosmoFlot.Core;

namespace KosmoFlot.World
{
    /// <summary>
    /// Процедурная генерация бесконечного коридора. Объекты создаются
    /// примитивами в рантайме, едут к игроку и перерабатываются позади.
    /// Логика повторяет веб-прототип.
    /// </summary>
    public class TrackGenerator : MonoBehaviour
    {
        [Header("Цвета")]
        public Color floorColor = new Color(0.08f, 0.10f, 0.20f);
        public Color stripColor = new Color(0.22f, 0.91f, 1f);
        public Color lowColor  = new Color(1f, 0.30f, 0.43f);
        public Color highColor = new Color(1f, 0.65f, 0.30f);
        public Color wallColor = new Color(0.66f, 0.33f, 0.97f);
        public Color coinColor = new Color(1f, 0.81f, 0.30f);

        private readonly List<Transform> _tiles = new List<Transform>();
        private readonly List<Transform> _obstacles = new List<Transform>();
        private readonly List<Transform> _coins = new List<Transform>();

        private float _spawnCursor;
        private Transform _container;

        private void Awake()
        {
            _container = new GameObject("TrackContainer").transform;
            _container.SetParent(transform, false);
        }

        // ---------------- Публичный API ----------------
        public void ResetTrack()
        {
            foreach (var t in _tiles) if (t) Destroy(t.gameObject);
            foreach (var o in _obstacles) if (o) Destroy(o.gameObject);
            foreach (var c in _coins) if (c) Destroy(c.gameObject);
            _tiles.Clear(); _obstacles.Clear(); _coins.Clear();

            _spawnCursor = 0f;
            EnsureTiles();
            GenerateAhead(0f);
        }

        public void Scroll(float dz, float distance)
        {
            for (int i = _obstacles.Count - 1; i >= 0; i--)
            {
                var o = _obstacles[i];
                o.position += Vector3.forward * dz;
                if (o.position.z > 14f) { Destroy(o.gameObject); _obstacles.RemoveAt(i); }
            }
            for (int i = _coins.Count - 1; i >= 0; i--)
            {
                var c = _coins[i];
                c.position += Vector3.forward * dz;
                if (c.position.z > 14f) { Destroy(c.gameObject); _coins.RemoveAt(i); }
            }
            foreach (var t in _tiles)
            {
                t.position += Vector3.forward * dz;
                if (t.position.z > 30f)
                {
                    float minZ = float.MaxValue;
                    foreach (var x in _tiles) minZ = Mathf.Min(minZ, x.position.z);
                    var p = t.position; p.z = minZ - GameConfig.TileLength; t.position = p;
                }
            }

            GenerateAhead(distance);
        }

        // ---------------- Генерация ----------------
        private void EnsureTiles()
        {
            while (_tiles.Count < 12)
            {
                float lastZ = _tiles.Count > 0 ? _tiles[_tiles.Count - 1].position.z : 10f;
                BuildTile(lastZ - GameConfig.TileLength);
            }
        }

        private void GenerateAhead(float distance)
        {
            while (_spawnCursor < distance + GameConfig.SpawnAhead)
            {
                float z = -(_spawnCursor - distance);
                float roll = Random.value;

                if (_spawnCursor > 30f && roll < 0.55f)
                {
                    if (Random.value < 0.5f)
                    {
                        var type = (ObstacleType)Random.Range(0, 3);
                        BuildObstacle(type, RndLane(), z);
                    }
                    else
                    {
                        int open = RndLane();
                        for (int l = 0; l < 3; l++)
                            if (l != open) BuildObstacle(ObstacleType.Wall, l, z);
                        for (int k = 0; k < 3; k++) BuildCoin(open, z + k * 2.2f, 1.1f);
                    }
                }
                else if (roll < 0.85f)
                {
                    int lane = RndLane();
                    bool arc = Random.value < 0.4f;
                    for (int k = 0; k < 5; k++)
                    {
                        float y = arc ? 1.1f + Mathf.Sin(k / 4f * Mathf.PI) * 2.2f : 1.1f;
                        BuildCoin(lane, z - k * 2.2f, y);
                    }
                }

                _spawnCursor += 8f + Random.value * 6f;
            }
            EnsureTiles();
        }

        private int RndLane() => Random.Range(0, 3);

        // ---------------- Постройка примитивов ----------------
        private void BuildTile(float z)
        {
            var tile = new GameObject("Tile").transform;
            tile.SetParent(_container, false);
            tile.position = new Vector3(0f, 0f, z);

            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Floor";
            floor.transform.SetParent(tile, false);
            floor.transform.localPosition = new Vector3(0f, -0.25f, 0f);
            floor.transform.localScale = new Vector3(9f, 0.5f, GameConfig.TileLength);
            Paint(floor, floorColor);
            Destroy(floor.GetComponent<Collider>());

            foreach (float gx in new[] { -3.6f, 3.6f })
            {
                var strip = GameObject.CreatePrimitive(PrimitiveType.Cube);
                strip.name = "Strip";
                strip.transform.SetParent(tile, false);
                strip.transform.localPosition = new Vector3(gx, 0.03f, 0f);
                strip.transform.localScale = new Vector3(0.12f, 0.14f, GameConfig.TileLength);
                PaintEmissive(strip, stripColor);
                Destroy(strip.GetComponent<Collider>());
            }
            _tiles.Add(tile);
        }

        private void BuildObstacle(ObstacleType type, int lane, float z)
        {
            float w, h, y; Color col;
            switch (type)
            {
                case ObstacleType.Low:  w = 1.8f; h = 1.0f; y = 0.5f; col = lowColor; break;
                case ObstacleType.High: w = 1.9f; h = 1.1f; y = 2.5f; col = highColor; break;
                default:                w = 1.9f; h = 3.4f; y = 1.7f; col = wallColor; break;
            }

            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = "Obstacle_" + type;
            go.transform.SetParent(_container, false);
            go.transform.position = new Vector3(GameConfig.Lanes[lane], y, z);
            go.transform.localScale = new Vector3(w, h, 0.8f);
            Paint(go, col);

            var col3 = go.GetComponent<BoxCollider>();
            col3.isTrigger = true;
            go.AddComponent<Obstacle>().type = type;

            _obstacles.Add(go.transform);
        }

        private void BuildCoin(int lane, float z, float y)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "Coin";
            go.transform.SetParent(_container, false);
            go.transform.position = new Vector3(GameConfig.Lanes[lane], y, z);
            go.transform.localScale = new Vector3(0.6f, 0.6f, 0.2f);
            PaintEmissive(go, coinColor);

            var col = go.GetComponent<Collider>();
            col.isTrigger = true;
            go.AddComponent<Coin>();

            _coins.Add(go.transform);
        }

        // ---------------- Материалы (кросс-пайплайн) ----------------
        private static Shader _litShader;
        private static Shader LitShader
        {
            get
            {
                if (_litShader == null)
                    _litShader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                return _litShader;
            }
        }

        private void Paint(GameObject go, Color c)
        {
            var m = new Material(LitShader);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            go.GetComponent<Renderer>().sharedMaterial = m;
        }

        private void PaintEmissive(GameObject go, Color c)
        {
            var m = new Material(LitShader);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
            m.EnableKeyword("_EMISSION");
            if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", c * 0.8f);
            go.GetComponent<Renderer>().sharedMaterial = m;
        }
    }
}
