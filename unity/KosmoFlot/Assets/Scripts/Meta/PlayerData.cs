using System;
using System.Collections.Generic;

namespace KosmoFlot.Meta
{
    /// <summary>Сохраняемый прогресс игрока (сериализуется JsonUtility).</summary>
    [Serializable]
    public class PlayerData
    {
        public int crystals;
        public int bpXp;
        public bool bpPremium;
        public List<int> bpClaimedFree = new List<int>();
        public List<int> bpClaimedPrem = new List<int>();
        public string dailyLast;      // "yyyy-MM-dd" последнего клейма
        public int dailyStreak;
    }
}
