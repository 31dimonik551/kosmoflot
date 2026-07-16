using UnityEngine;
using KosmoFlot.Core;
using KosmoFlot.World;

namespace KosmoFlot.Player
{
    /// <summary>
    /// Управление кораблём: смена полос, прыжок, подкат.
    /// Игрок стоит на месте (z=0), мир едет к нему. Триггеры на
    /// препятствиях/монетах ловятся через OnTriggerEnter.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    [RequireComponent(typeof(BoxCollider))]
    public class PlayerController : MonoBehaviour
    {
        private int _lane = 1;
        private float _velY;
        private bool _onGround = true;
        private bool _sliding;
        private float _slideTimer;

        private Vector3 _baseScale = Vector3.one;
        private Vector2 _touchStart;
        private bool _touching;

        // Порог высоты, выше которого игрок «перепрыгнул» низкое препятствие
        private const float JumpClearHeight = 1.4f;

        private void Awake()
        {
            var rb = GetComponent<Rigidbody>();
            rb.isKinematic = true;                 // двигаем трансформом, не физикой
            rb.useGravity = false;
            _baseScale = transform.localScale;
        }

        public void ResetPlayer()
        {
            _lane = 1;
            _velY = 0f;
            _onGround = true;
            _sliding = false;
            _slideTimer = 0f;
            var p = transform.position;
            transform.position = new Vector3(GameConfig.Lanes[_lane], 0f, p.z);
            transform.localScale = _baseScale;
        }

        private void Update()
        {
            if (GameManager.Instance == null || GameManager.Instance.State != GameState.Run)
                return;

            HandleInput();
            Move(Time.deltaTime);
        }

        // ---------------- Ввод ----------------
        private void HandleInput()
        {
            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) MoveLane(-1);
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) MoveLane(1);
            if (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.Space)) Jump();
            if (Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S)) Slide();

            HandleSwipe();
        }

        private void HandleSwipe()
        {
            if (Input.touchCount == 0) { _touching = false; return; }
            Touch t = Input.GetTouch(0);
            if (t.phase == TouchPhase.Began) { _touchStart = t.position; _touching = true; }
            else if (t.phase == TouchPhase.Ended && _touching)
            {
                _touching = false;
                Vector2 d = t.position - _touchStart;
                if (d.magnitude < 40f) return;
                if (Mathf.Abs(d.x) > Mathf.Abs(d.y)) MoveLane(d.x > 0 ? 1 : -1);
                else if (d.y > 0) Jump(); else Slide();
            }
        }

        private void MoveLane(int dir) => _lane = Mathf.Clamp(_lane + dir, 0, 2);

        private void Jump()
        {
            if (!_onGround) return;
            _velY = GameConfig.JumpVelocity;
            _onGround = false;
            _sliding = false;
        }

        private void Slide()
        {
            if (!_onGround) return;
            _sliding = true;
            _slideTimer = GameConfig.SlideTime;
        }

        // ---------------- Движение ----------------
        private void Move(float dt)
        {
            Vector3 p = transform.position;

            // Плавное перестроение по X
            float targetX = GameConfig.Lanes[_lane];
            p.x = Mathf.MoveTowards(p.x, targetX, GameConfig.LaneSwitchSpeed * dt * Mathf.Max(1f, Mathf.Abs(targetX - p.x)));

            // Гравитация / прыжок
            _velY += GameConfig.Gravity * dt;
            p.y += _velY * dt;
            if (p.y <= 0f) { p.y = 0f; _velY = 0f; _onGround = true; }

            transform.position = p;

            // Крен корабля при манёвре
            float roll = (targetX - p.x) * -8f;
            transform.rotation = Quaternion.Euler(0f, 0f, roll);

            // Подкат — сжимаем по Y
            Vector3 s = transform.localScale;
            if (_sliding)
            {
                _slideTimer -= dt;
                s.y = _baseScale.y * 0.5f;
                if (_slideTimer <= 0f) _sliding = false;
            }
            else
            {
                s.y = Mathf.MoveTowards(s.y, _baseScale.y, 6f * dt);
            }
            transform.localScale = s;
        }

        // ---------------- Столкновения ----------------
        public bool IsSliding => _sliding;
        public float Height => transform.position.y;

        private void OnTriggerEnter(Collider other)
        {
            if (GameManager.Instance == null || GameManager.Instance.State != GameState.Run) return;

            var coin = other.GetComponent<Coin>();
            if (coin != null)
            {
                GameManager.Instance.AddCoin();
                coin.Collect();
                return;
            }

            var ob = other.GetComponent<Obstacle>();
            if (ob != null && HitsObstacle(ob))
            {
                GameManager.Instance.GameOver();
            }
        }

        private bool HitsObstacle(Obstacle ob)
        {
            switch (ob.type)
            {
                case ObstacleType.Low:  return Height < JumpClearHeight;   // не перепрыгнул
                case ObstacleType.High: return !_sliding && Height < 1.5f; // не поднырнул
                case ObstacleType.Wall: return true;                       // только смена полосы
                default: return true;
            }
        }
    }
}
