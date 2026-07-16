using UnityEngine;

namespace KosmoFlot.World
{
    /// <summary>Кристалл. Вращается и деактивируется при сборе.</summary>
    public class Coin : MonoBehaviour
    {
        public bool Collected { get; private set; }

        private void Update()
        {
            transform.Rotate(0f, 220f * Time.deltaTime, 0f, Space.World);
        }

        public void Collect()
        {
            Collected = true;
            gameObject.SetActive(false);
        }

        public void Revive()
        {
            Collected = false;
            gameObject.SetActive(true);
        }
    }
}
