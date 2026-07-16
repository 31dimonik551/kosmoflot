using System;
using UnityEngine;
using KosmoFlot.Core;

namespace KosmoFlot.Meta
{
    /// <summary>
    /// Владелец мета-прогресса: связывает PlayerData, BattlePass,
    /// DailyReward и рекламу. Начисляет награду за забег и хранит
    /// «ожидающую» добычу для удвоения по рекламе.
    /// </summary>
    public class MetaController : MonoBehaviour
    {
        public static MetaController Instance { get; private set; }

        [Header("Реклама")]
        public RewardedAdManager ads;

        public PlayerData Data { get; private set; }
        public BattlePass BattlePass { get; private set; }
        public DailyReward Daily { get; private set; }

        // Ожидающая награда последнего забега (для удвоения)
        public int PendingCrystals { get; private set; }
        public int PendingXp { get; private set; }
        public bool PendingDoubled { get; private set; }

        public event Action OnChanged;   // UI перерисовывается по этому событию

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;

            Data = SaveSystem.Load();
            BattlePass = new BattlePass(Data);
            Daily = new DailyReward(Data);
        }

        public int Crystals => Data.crystals;

        private void Persist() { SaveSystem.Save(Data); OnChanged?.Invoke(); }

        // ---------------- Забег ----------------
        public void OnRunFinished(int distance, int coins)
        {
            int xp = coins * GameConfig.XpPerCoin + distance * GameConfig.XpPerMeter;
            Data.crystals += coins;
            BattlePass.AddXp(xp);

            PendingCrystals = coins;
            PendingXp = xp;
            PendingDoubled = false;
            Persist();
        }

        // ---------------- Реклама: удвоение ----------------
        public void DoubleViaAd(Action onDone = null)
        {
            if (PendingDoubled || PendingCrystals == 0 || ads == null) return;
            ads.ShowRewarded(() =>
            {
                Data.crystals += PendingCrystals;
                BattlePass.AddXp(PendingXp);
                PendingDoubled = true;
                Persist();
                onDone?.Invoke();
            });
        }

        // ---------------- Battle Pass ----------------
        public int ClaimBp(int tier, bool premium)
        {
            int got = BattlePass.Claim(tier, premium);
            if (got > 0) Persist();
            return got;
        }

        public bool BuyPremium()
        {
            bool ok = BattlePass.BuyPremium();
            if (ok) Persist();
            return ok;
        }

        // ---------------- Daily ----------------
        public int ClaimDaily()
        {
            int got = Daily.Claim();
            if (got > 0) Persist();
            return got;
        }
    }
}
