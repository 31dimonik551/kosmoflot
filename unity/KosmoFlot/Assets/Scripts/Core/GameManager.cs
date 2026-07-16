using System;
using UnityEngine;
using KosmoFlot.World;
using KosmoFlot.Player;
using KosmoFlot.Meta;

namespace KosmoFlot.Core
{
    public enum GameState { Menu, Run, Over }

    /// <summary>
    /// Центральный координатор забега: состояние, счёт, скорость,
    /// связка игрока / генератора / UI / мета-систем.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Ссылки на сцену")]
        public PlayerController player;
        public TrackGenerator generator;

        public GameState State { get; private set; } = GameState.Menu;
        public float Speed { get; private set; }
        public float Distance { get; private set; }
        public int Coins { get; private set; }
        public int Best { get; private set; }

        // События для UI и мета-систем
        public event Action OnRunStarted;
        public event Action<int, int> OnRunFinished;      // distance, coins
        public event Action<int, int, float> OnHudUpdated; // distance, coins, speed

        private const string BestKey = "kf_best";

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            Best = PlayerPrefs.GetInt(BestKey, 0);
        }

        private void Update()
        {
            if (State != GameState.Run) return;

            float dt = Time.deltaTime;

            Speed = Mathf.Min(GameConfig.MaxSpeed, Speed + GameConfig.Accel * dt);
            float dz = Speed * dt;
            Distance += dz;

            generator.Scroll(dz, Distance);
            OnHudUpdated?.Invoke(Mathf.FloorToInt(Distance), Coins, Speed);
        }

        public void StartRun()
        {
            Coins = 0;
            Distance = 0f;
            Speed = GameConfig.StartSpeed;

            generator.ResetTrack();
            player.ResetPlayer();

            State = GameState.Run;
            OnRunStarted?.Invoke();
        }

        public void AddCoin(int amount = 1)
        {
            Coins += amount;
        }

        public void GameOver()
        {
            if (State != GameState.Run) return;
            State = GameState.Over;

            int dist = Mathf.FloorToInt(Distance);
            if (dist > Best)
            {
                Best = dist;
                PlayerPrefs.SetInt(BestKey, Best);
                PlayerPrefs.Save();
            }

            // Начисление кристаллов и XP батлпасса
            MetaController.Instance?.OnRunFinished(dist, Coins);

            OnRunFinished?.Invoke(dist, Coins);
        }
    }
}
