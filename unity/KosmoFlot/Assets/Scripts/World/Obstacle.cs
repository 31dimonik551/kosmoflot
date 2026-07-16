using UnityEngine;

namespace KosmoFlot.World
{
    public enum ObstacleType
    {
        Low,   // низкий барьер — надо прыгать
        High,  // висячая балка — надо подкат
        Wall   // полная стена — надо сменить полосу
    }

    /// <summary>Маркер препятствия. Тип определяет способ обхода.</summary>
    public class Obstacle : MonoBehaviour
    {
        public ObstacleType type;
    }
}
