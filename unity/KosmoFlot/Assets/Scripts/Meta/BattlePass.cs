using System.Collections.Generic;
using UnityEngine;

namespace KosmoFlot.Meta
{
    public struct BpReward
    {
        public int crystals;
        public string item;   // необязательный особый предмет (скин)
    }

    public struct BpTier
    {
        public int tier;
        public BpReward free;
        public BpReward prem;
    }

    /// <summary>
    /// Логика боевого пропуска: таблица наград, уровень по XP, выдача.
    /// Работает поверх PlayerData; сохранение — снаружи (MetaController).
    /// </summary>
    public class BattlePass
    {
        public const int Tiers = 30;
        public const int XpPerTier = 100;

        public readonly List<BpTier> Table = new List<BpTier>();
        private readonly PlayerData _data;

        public BattlePass(PlayerData data)
        {
            _data = data;
            for (int i = 1; i <= Tiers; i++)
            {
                var free = new BpReward { crystals = 20 + i * 5 };
                bool milestone = i % 5 == 0;
                var prem = milestone
                    ? new BpReward { crystals = 100 + i * 15, item = "★ Скин #" + (i / 5) }
                    : new BpReward { crystals = 60 + i * 10 };
                Table.Add(new BpTier { tier = i, free = free, prem = prem });
            }
        }

        public int Level => Mathf.Min(Tiers, _data.bpXp / XpPerTier + 1);
        public int XpInLevel => _data.bpXp % XpPerTier;

        public void AddXp(int xp) => _data.bpXp += Mathf.Max(0, xp);

        public bool IsClaimed(int tier, bool premium) =>
            (premium ? _data.bpClaimedPrem : _data.bpClaimedFree).Contains(tier);

        public bool IsClaimable(int tier, bool premium)
        {
            if (Level < tier) return false;
            if (premium && !_data.bpPremium) return false;
            return !IsClaimed(tier, premium);
        }

        /// <summary>Возвращает выданные кристаллы (0 — если нельзя забрать).</summary>
        public int Claim(int tier, bool premium)
        {
            if (!IsClaimable(tier, premium)) return 0;
            var list = premium ? _data.bpClaimedPrem : _data.bpClaimedFree;
            list.Add(tier);
            var rw = premium ? Table[tier - 1].prem : Table[tier - 1].free;
            _data.crystals += rw.crystals;
            return rw.crystals;
        }

        public bool BuyPremium()
        {
            if (_data.bpPremium) return false;
            _data.bpPremium = true;   // прототип: без реальной покупки
            return true;
        }
    }
}
