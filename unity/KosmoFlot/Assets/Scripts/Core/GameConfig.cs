using UnityEngine;

namespace KosmoFlot.Core
{
    /// <summary>
    /// Единые игровые константы (баланс). Значения совпадают с веб-прототипом.
    /// </summary>
    public static class GameConfig
    {
        // Полосы
        public static readonly float[] Lanes = { -2.4f, 0f, 2.4f };
        public const float LaneSwitchSpeed = 12f;

        // Движение / прыжок
        public const float Gravity = -55f;
        public const float JumpVelocity = 17f;
        public const float SlideTime = 0.62f;

        // Скорость забега
        public const float StartSpeed = 18f;
        public const float MaxSpeed = 46f;
        public const float Accel = 0.55f;

        // Генерация мира
        public const float SpawnAhead = 120f;
        public const float TileLength = 20f;

        // Экономика / мета
        public const int XpPerCoin = 10;
        public const int XpPerMeter = 1;
    }
}
