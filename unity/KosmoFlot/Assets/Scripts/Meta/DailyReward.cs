using System;
using System.Globalization;

namespace KosmoFlot.Meta
{
    /// <summary>
    /// Ежедневная награда за вход: серия (streak) по календарным дням.
    /// Пропуск дня сбрасывает серию. Награда растёт по циклу.
    /// </summary>
    public class DailyReward
    {
        public static readonly int[] Cycle = { 50, 75, 100, 150, 200, 300, 500, 1000 };

        private readonly PlayerData _data;
        public DailyReward(PlayerData data) => _data = data;

        private static string Today =>
            DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        private static int DaysBetween(string a, string b)
        {
            var da = DateTime.ParseExact(a, "yyyy-MM-dd", CultureInfo.InvariantCulture);
            var db = DateTime.ParseExact(b, "yyyy-MM-dd", CultureInfo.InvariantCulture);
            return (int)Math.Round((db - da).TotalDays);
        }

        public bool Claimable => _data.dailyLast != Today;

        /// <summary>Индекс дня (0..Cycle-1), который будет выдан следующим клеймом.</summary>
        public int NextDayIndex
        {
            get
            {
                if (string.IsNullOrEmpty(_data.dailyLast)) return 0;
                int gap = DaysBetween(_data.dailyLast, Today);
                if (gap == 1) return _data.dailyStreak % Cycle.Length;
                if (gap == 0) return (_data.dailyStreak - 1 + Cycle.Length) % Cycle.Length;
                return 0;
            }
        }

        public int Streak => _data.dailyStreak;

        /// <summary>Забрать награду. Возвращает выданные кристаллы (0 — нельзя).</summary>
        public int Claim()
        {
            if (!Claimable) return 0;
            int gap = string.IsNullOrEmpty(_data.dailyLast) ? -1 : DaysBetween(_data.dailyLast, Today);
            _data.dailyStreak = (gap == 1) ? _data.dailyStreak + 1 : 1;
            int idx = (_data.dailyStreak - 1) % Cycle.Length;
            int amt = Cycle[idx];
            _data.dailyLast = Today;
            _data.crystals += amt;
            return amt;
        }
    }
}
