using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using KosmoFlot.Core;
using KosmoFlot.Meta;

namespace KosmoFlot.UI
{
    /// <summary>
    /// Строит и обслуживает весь runtime-интерфейс кодом (uGUI):
    /// HUD, стартовый экран, game over, Battle Pass, Daily, оверлей рекламы.
    /// Подписывается на события GameManager и MetaController.
    /// </summary>
    public class UIManager : MonoBehaviour
    {
        // Цвета (в тон веб-версии)
        private static readonly Color Neon = new Color(0.22f, 0.91f, 1f);
        private static readonly Color Purple = new Color(0.66f, 0.33f, 0.97f);
        private static readonly Color Gold = new Color(1f, 0.81f, 0.30f);
        private static readonly Color Danger = new Color(1f, 0.30f, 0.43f);
        private static readonly Color Text0 = new Color(0.92f, 0.95f, 1f);
        private static readonly Color PanelBg = new Color(0.05f, 0.07f, 0.16f, 0.98f);
        private static readonly Color Backdrop = new Color(0.01f, 0.012f, 0.04f, 0.75f);

        private Canvas _canvas;

        // HUD
        private Text _score, _coins, _wallet;
        private GameObject _hud, _walletGo;
        // Start / Over
        private GameObject _startPanel, _overPanel;
        private Text _overScore, _overCoins, _overBest, _overReward;
        private Button _doubleBtn;
        private Text _bpBtnLabel, _dailyBtnLabel;
        private GameObject _dailyBadge;
        // Modals
        private GameObject _modalRoot, _bpPanel, _dailyPanel, _adOverlay;
        private Text _bpLevel, _bpXpText, _adTimer, _dailyMsg;
        private Slider _bpBar;
        private RectTransform _bpContent, _dailyGrid;
        private Button _bpBuyBtn;

        private void Start()
        {
            EnsureEventSystem();
            BuildCanvas();
            BuildWallet();
            BuildHud();
            BuildStart();
            BuildOver();
            BuildBpPanel();
            BuildDailyPanel();
            BuildAdOverlay();

            var gm = GameManager.Instance;
            gm.OnHudUpdated += OnHud;
            gm.OnRunStarted += OnRunStarted;
            gm.OnRunFinished += OnRunFinished;
            if (MetaController.Instance != null)
                MetaController.Instance.OnChanged += RefreshMeta;

            ShowStart();
            RefreshMeta();
        }

        // =========================================================
        //  HUD / состояния
        // =========================================================
        private void OnHud(int dist, int coins, float speed)
        {
            _score.text = dist + " м";
            _coins.text = coins.ToString();
        }

        private void OnRunStarted()
        {
            _startPanel.SetActive(false);
            _overPanel.SetActive(false);
            _walletGo.SetActive(false);
            _hud.SetActive(true);
        }

        private void OnRunFinished(int dist, int coins)
        {
            _hud.SetActive(false);
            _walletGo.SetActive(true);
            _overScore.text = dist.ToString();
            _overCoins.text = coins.ToString();
            _overBest.text = "Рекорд: " + GameManager.Instance.Best + " м";

            var meta = MetaController.Instance;
            int xp = meta != null ? meta.PendingXp : 0;
            _overReward.text = "+" + coins + " кристаллов · +" + xp + " XP";
            _doubleBtn.interactable = coins > 0;
            SetLabel(_doubleBtn, "📺 Реклама — удвоить награду");
            _overPanel.SetActive(true);
            RefreshMeta();
        }

        private void ShowStart()
        {
            _startPanel.SetActive(true);
            _overPanel.SetActive(false);
            _hud.SetActive(false);
            _walletGo.SetActive(true);
        }

        private void RefreshMeta()
        {
            var meta = MetaController.Instance;
            if (meta == null) return;
            _wallet.text = meta.Crystals.ToString();
            _bpBtnLabel.text = "Battle Pass · Ур. " + meta.BattlePass.Level;
            bool claimable = meta.Daily.Claimable;
            _dailyBadge.SetActive(claimable);
            _dailyBtnLabel.text = claimable ? "Награда дня: забрать!" : "Награда дня: завтра";
        }

        // =========================================================
        //  Кнопочные обработчики
        // =========================================================
        private void OnPlay() => GameManager.Instance.StartRun();
        private void OnHome() => ShowStart();

        private void OnDouble()
        {
            var meta = MetaController.Instance;
            if (meta == null) return;
            _adOverlay.SetActive(true);
            int left = Mathf.CeilToInt(meta.ads != null ? meta.ads.simulatedDuration : 3f);
            _adTimer.text = left.ToString();
            meta.DoubleViaAd(() =>
            {
                _adOverlay.SetActive(false);
                _doubleBtn.interactable = false;
                SetLabel(_doubleBtn, "✓ Награда удвоена");
                RefreshMeta();
            });
            StartCoroutine(AdCountdown());
        }

        private System.Collections.IEnumerator AdCountdown()
        {
            var ads = MetaController.Instance.ads;
            float t = ads != null ? ads.simulatedDuration : 3f;
            while (t > 0f && _adOverlay.activeSelf)
            {
                _adTimer.text = Mathf.CeilToInt(t).ToString();
                yield return new WaitForSecondsRealtime(0.2f);
                t -= 0.2f;
            }
        }

        private void OpenBp() { RefreshBp(); _modalRoot.SetActive(true); _bpPanel.SetActive(true); _dailyPanel.SetActive(false); }
        private void OpenDaily() { RefreshDaily(); _modalRoot.SetActive(true); _dailyPanel.SetActive(true); _bpPanel.SetActive(false); }
        private void CloseModal() { _modalRoot.SetActive(false); }

        // =========================================================
        //  Battle Pass панель
        // =========================================================
        private void RefreshBp()
        {
            var meta = MetaController.Instance;
            var bp = meta.BattlePass;
            _bpLevel.text = "Ур. " + bp.Level;
            _bpBar.value = bp.XpInLevel / (float)BattlePass.XpPerTier;
            _bpXpText.text = bp.XpInLevel + "/" + BattlePass.XpPerTier + " XP";
            _bpBuyBtn.interactable = !meta.Data.bpPremium;
            SetLabel(_bpBuyBtn, meta.Data.bpPremium ? "Premium активен" : "Открыть Premium");

            for (int i = _bpContent.childCount - 1; i >= 0; i--)
                Destroy(_bpContent.GetChild(i).gameObject);

            foreach (var tier in bp.Table)
            {
                var row = NewRow(_bpContent, 46);
                MakeText(row.transform, tier.tier.ToString(), 16, Text0, TextAnchor.MiddleCenter)
                    .rectTransform.sizeDelta = new Vector2(34, 40);

                AddClaimButton(row.transform, bp, tier.tier, false);
                AddClaimButton(row.transform, bp, tier.tier, true);
            }
        }

        private void AddClaimButton(Transform parent, BattlePass bp, int tier, bool prem)
        {
            var rw = prem ? bp.Table[tier - 1].prem : bp.Table[tier - 1].free;
            string label = (rw.item != null ? rw.item + "  " : "") + "+" + rw.crystals + "💎";
            var color = prem ? Gold : Neon;

            bool claimed = bp.IsClaimed(tier, prem);
            bool claimable = bp.IsClaimable(tier, prem);

            var btn = MakeButton(parent, label, () =>
            {
                if (MetaController.Instance.ClaimBp(tier, prem) > 0) RefreshBp();
            });
            var le = btn.gameObject.AddComponent<LayoutElement>();
            le.flexibleWidth = 1;
            var img = btn.GetComponent<Image>();
            img.color = claimed ? new Color(color.r, color.g, color.b, 0.25f)
                       : claimable ? new Color(color.r, color.g, color.b, 0.55f)
                       : new Color(1, 1, 1, 0.06f);
            btn.interactable = claimable;
            if (claimed) SetLabel(btn, "✓ " + label);
        }

        // =========================================================
        //  Daily панель
        // =========================================================
        private void RefreshDaily()
        {
            var meta = MetaController.Instance;
            var daily = meta.Daily;
            for (int i = _dailyGrid.childCount - 1; i >= 0; i--)
                Destroy(_dailyGrid.GetChild(i).gameObject);

            int idx = daily.NextDayIndex;
            bool claimable = daily.Claimable;
            for (int i = 0; i < DailyReward.Cycle.Length; i++)
            {
                var cell = new GameObject("Day" + (i + 1), typeof(RectTransform), typeof(Image));
                cell.transform.SetParent(_dailyGrid, false);
                var cimg = cell.GetComponent<Image>();
                bool hi = i == idx;
                cimg.color = (claimable && hi) ? new Color(Neon.r, Neon.g, Neon.b, 0.35f)
                           : (!claimable && hi) ? new Color(Neon.r, Neon.g, Neon.b, 0.15f)
                           : new Color(1, 1, 1, 0.05f);
                var t = MakeText(cell.transform, "День " + (i + 1) + "\n" + DailyReward.Cycle[i] + "💎",
                    16, Gold, TextAnchor.MiddleCenter);
                Stretch(t.rectTransform);
            }

            _dailyMsg.text = "";
        }

        private void OnClaimDaily()
        {
            int got = MetaController.Instance.ClaimDaily();
            if (got > 0) _dailyMsg.text = "+" + got + " 💎! Серия: " + MetaController.Instance.Daily.Streak + " дн.";
            RefreshDaily();
            RefreshMeta();
        }

        // =========================================================
        //  Построение UI
        // =========================================================
        private void BuildCanvas()
        {
            var go = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            _canvas = go.GetComponent<Canvas>();
            _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0.5f;
        }

        private void BuildWallet()
        {
            _walletGo = NewPanel("Wallet", new Vector2(0, 1), new Vector2(0, 1),
                new Vector2(30, -30), new Vector2(280, 90), new Color(0.04f, 0.05f, 0.12f, 0.6f));
            _wallet = MakeText(_walletGo.transform, "0", 40, Gold, TextAnchor.MiddleCenter);
            Stretch(_wallet.rectTransform);
        }

        private void BuildHud()
        {
            _hud = new GameObject("HUD", typeof(RectTransform));
            _hud.transform.SetParent(_canvas.transform, false);
            Stretch(_hud.GetComponent<RectTransform>());

            _score = MakeText(_hud.transform, "0 м", 46, Text0, TextAnchor.UpperCenter);
            Anchor(_score.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -40), new Vector2(400, 80));

            _coins = MakeText(_hud.transform, "0", 44, Gold, TextAnchor.UpperRight);
            Anchor(_coins.rectTransform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-40, -40), new Vector2(300, 80));
            _hud.SetActive(false);
        }

        private void BuildStart()
        {
            _startPanel = NewFullOverlay("StartPanel", Backdrop);
            var title = MakeText(_startPanel.transform, "KOSMOFLOT", 96, Neon, TextAnchor.MiddleCenter);
            Anchor(title.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 380), new Vector2(900, 140));

            var sub = MakeText(_startPanel.transform, "Космический раннер", 32, Text0, TextAnchor.MiddleCenter);
            Anchor(sub.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 270), new Vector2(700, 60));

            var play = MakeButton(_startPanel.transform, "В ПОЛЁТ", OnPlay);
            play.GetComponent<Image>().color = Neon;
            SetLabelColor(play, new Color(0.02f, 0.07f, 0.1f));
            Anchor(play.GetComponent<RectTransform>(), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 90), new Vector2(460, 120));

            var bpBtn = MakeButton(_startPanel.transform, "Battle Pass", OpenBp);
            _bpBtnLabel = bpBtn.GetComponentInChildren<Text>();
            Anchor(bpBtn.GetComponent<RectTransform>(), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-160, -70), new Vector2(300, 100));

            var dailyBtn = MakeButton(_startPanel.transform, "Награда дня", OpenDaily);
            _dailyBtnLabel = dailyBtn.GetComponentInChildren<Text>();
            Anchor(dailyBtn.GetComponent<RectTransform>(), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(160, -70), new Vector2(300, 100));

            _dailyBadge = new GameObject("Badge", typeof(RectTransform), typeof(Image));
            _dailyBadge.transform.SetParent(dailyBtn.transform, false);
            _dailyBadge.GetComponent<Image>().color = Danger;
            Anchor(_dailyBadge.GetComponent<RectTransform>(), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-6, -6), new Vector2(34, 34));

            var hint = MakeText(_startPanel.transform,
                "← → / A D — полосы   ·   ↑ / свайп вверх — прыжок   ·   ↓ / свайп вниз — подкат",
                24, new Color(0.7f, 0.75f, 0.85f), TextAnchor.MiddleCenter);
            Anchor(hint.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -230), new Vector2(1000, 60));
        }

        private void BuildOver()
        {
            _overPanel = NewFullOverlay("OverPanel", Backdrop);
            var t = MakeText(_overPanel.transform, "КРУШЕНИЕ", 84, Danger, TextAnchor.MiddleCenter);
            Anchor(t.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 360), new Vector2(900, 120));

            _overScore = MakeText(_overPanel.transform, "0", 60, Neon, TextAnchor.MiddleCenter);
            Anchor(_overScore.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-180, 200), new Vector2(320, 90));
            var l1 = MakeText(_overPanel.transform, "метров", 24, Text0, TextAnchor.MiddleCenter);
            Anchor(l1.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-180, 150), new Vector2(320, 40));

            _overCoins = MakeText(_overPanel.transform, "0", 60, Gold, TextAnchor.MiddleCenter);
            Anchor(_overCoins.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(180, 200), new Vector2(320, 90));
            var l2 = MakeText(_overPanel.transform, "кристаллов", 24, Text0, TextAnchor.MiddleCenter);
            Anchor(l2.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(180, 150), new Vector2(320, 40));

            _overBest = MakeText(_overPanel.transform, "Рекорд: 0 м", 28, Text0, TextAnchor.MiddleCenter);
            Anchor(_overBest.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 80), new Vector2(700, 50));

            _overReward = MakeText(_overPanel.transform, "", 28, Gold, TextAnchor.MiddleCenter);
            Anchor(_overReward.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 20), new Vector2(800, 50));

            _doubleBtn = MakeButton(_overPanel.transform, "📺 Реклама — удвоить награду", OnDouble);
            _doubleBtn.GetComponent<Image>().color = Gold;
            SetLabelColor(_doubleBtn, new Color(0.22f, 0.14f, 0));
            Anchor(_doubleBtn.GetComponent<RectTransform>(), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -70), new Vector2(680, 100));

            var retry = MakeButton(_overPanel.transform, "ЕЩЁ РАЗ", OnPlay);
            retry.GetComponent<Image>().color = Neon;
            SetLabelColor(retry, new Color(0.02f, 0.07f, 0.1f));
            Anchor(retry.GetComponent<RectTransform>(), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-160, -190), new Vector2(300, 100));

            var home = MakeButton(_overPanel.transform, "В меню", OnHome);
            Anchor(home.GetComponent<RectTransform>(), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(160, -190), new Vector2(300, 100));
        }

        private void BuildBpPanel()
        {
            _modalRoot = NewFullOverlay("ModalRoot", Backdrop);
            var closeArea = _modalRoot.AddComponent<Button>();
            closeArea.transition = Selectable.Transition.None;
            closeArea.onClick.AddListener(CloseModal);
            _modalRoot.SetActive(false);

            _bpPanel = NewPanel("BpPanel", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, new Vector2(960, 1500), PanelBg);
            _bpPanel.transform.SetParent(_modalRoot.transform, false);

            var head = MakeText(_bpPanel.transform, "Battle Pass · Сезон 1", 40, Neon, TextAnchor.UpperLeft);
            Anchor(head.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -30), new Vector2(700, 60));
            MakeCloseX(_bpPanel.transform);

            _bpLevel = MakeText(_bpPanel.transform, "Ур. 1", 30, Neon, TextAnchor.MiddleLeft);
            Anchor(_bpLevel.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -120), new Vector2(200, 50));

            _bpBar = MakeSlider(_bpPanel.transform);
            Anchor(_bpBar.GetComponent<RectTransform>(), new Vector2(0, 1), new Vector2(0, 1), new Vector2(240, -135), new Vector2(560, 22));

            _bpXpText = MakeText(_bpPanel.transform, "0/100 XP", 22, Text0, TextAnchor.MiddleRight);
            Anchor(_bpXpText.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(560, -175), new Vector2(360, 40));

            _bpBuyBtn = MakeButton(_bpPanel.transform, "Открыть Premium", () =>
            {
                if (MetaController.Instance.BuyPremium()) RefreshBp();
            });
            _bpBuyBtn.GetComponent<Image>().color = Gold;
            SetLabelColor(_bpBuyBtn, new Color(0.22f, 0.14f, 0));
            Anchor(_bpBuyBtn.GetComponent<RectTransform>(), new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -215), new Vector2(340, 80));

            // Заголовки треков
            var lf = MakeText(_bpPanel.transform, "FREE", 22, new Color(1,1,1,0.5f), TextAnchor.MiddleCenter);
            Anchor(lf.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(360, -310), new Vector2(260, 40));
            var lp = MakeText(_bpPanel.transform, "PREMIUM", 22, new Color(1,1,1,0.5f), TextAnchor.MiddleCenter);
            Anchor(lp.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(660, -310), new Vector2(260, 40));

            // ScrollRect со списком уровней
            _bpContent = MakeScroll(_bpPanel.transform, new Vector2(20, 40), 350);
        }

        private void BuildDailyPanel()
        {
            _dailyPanel = NewPanel("DailyPanel", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                Vector2.zero, new Vector2(900, 900), PanelBg);
            _dailyPanel.transform.SetParent(_modalRoot.transform, false);

            var head = MakeText(_dailyPanel.transform, "Ежедневная награда", 40, Neon, TextAnchor.UpperLeft);
            Anchor(head.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -30), new Vector2(700, 60));
            MakeCloseX(_dailyPanel.transform);

            var sub = MakeText(_dailyPanel.transform, "Заходи каждый день — награда растёт. Пропуск сбрасывает серию.",
                24, new Color(0.7f, 0.75f, 0.85f), TextAnchor.UpperLeft);
            Anchor(sub.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -110), new Vector2(820, 60));

            var gridGo = new GameObject("DailyGrid", typeof(RectTransform), typeof(GridLayoutGroup));
            gridGo.transform.SetParent(_dailyPanel.transform, false);
            _dailyGrid = gridGo.GetComponent<RectTransform>();
            Anchor(_dailyGrid, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -190), new Vector2(820, 420));
            var grid = gridGo.GetComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(190, 190);
            grid.spacing = new Vector2(16, 16);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 4;

            var claim = MakeButton(_dailyPanel.transform, "Забрать награду", OnClaimDaily);
            claim.GetComponent<Image>().color = Neon;
            SetLabelColor(claim, new Color(0.02f, 0.07f, 0.1f));
            Anchor(claim.GetComponent<RectTransform>(), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 150), new Vector2(560, 110));

            _dailyMsg = MakeText(_dailyPanel.transform, "", 26, Neon, TextAnchor.MiddleCenter);
            Anchor(_dailyMsg.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 70), new Vector2(800, 50));
        }

        private void BuildAdOverlay()
        {
            _adOverlay = NewFullOverlay("AdOverlay", new Color(0.01f, 0.012f, 0.04f, 0.95f));
            var tag = MakeText(_adOverlay.transform, "РЕКЛАМА", 24, new Color(1,1,1,0.5f), TextAnchor.MiddleCenter);
            Anchor(tag.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 120), new Vector2(600, 50));
            var icon = MakeText(_adOverlay.transform, "📡", 100, Neon, TextAnchor.MiddleCenter);
            Anchor(icon.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 0), new Vector2(300, 150));
            var lbl = MakeText(_adOverlay.transform, "Награда через", 30, Text0, TextAnchor.MiddleCenter);
            Anchor(lbl.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -140), new Vector2(600, 50));
            _adTimer = MakeText(_adOverlay.transform, "3", 60, Neon, TextAnchor.MiddleCenter);
            Anchor(_adTimer.rectTransform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -210), new Vector2(200, 80));
            _adOverlay.SetActive(false);
        }

        // =========================================================
        //  Фабрики / хелперы UI
        // =========================================================
        private static Font _font;
        private static Font UiFont
        {
            get
            {
                if (_font == null)
                {
                    _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                    if (_font == null) _font = Resources.GetBuiltinResource<Font>("Arial.ttf");
                    if (_font == null) _font = Font.CreateDynamicFontFromOSFont("Arial", 16);
                }
                return _font;
            }
        }

        private void EnsureEventSystem()
        {
            if (Object.FindObjectOfType<UnityEngine.EventSystems.EventSystem>() == null)
            {
                new GameObject("EventSystem",
                    typeof(UnityEngine.EventSystems.EventSystem),
                    typeof(UnityEngine.EventSystems.StandaloneInputModule));
            }
        }

        private Text MakeText(Transform parent, string s, int size, Color c, TextAnchor anchor)
        {
            var go = new GameObject("Text", typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>();
            t.font = UiFont; t.text = s; t.fontSize = size; t.color = c;
            t.alignment = anchor; t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        private Button MakeButton(Transform parent, string label, UnityEngine.Events.UnityAction onClick)
        {
            var go = new GameObject("Button", typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>();
            img.color = new Color(0.13f, 0.16f, 0.32f, 0.95f);
            var btn = go.GetComponent<Button>();
            btn.onClick.AddListener(onClick);
            var t = MakeText(go.transform, label, 26, Text0, TextAnchor.MiddleCenter);
            Stretch(t.rectTransform);
            return btn;
        }

        private void MakeCloseX(Transform panel)
        {
            var x = MakeButton(panel, "✕", CloseModal);
            x.GetComponent<Image>().color = new Color(1, 1, 1, 0.08f);
            Anchor(x.GetComponent<RectTransform>(), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-20, -20), new Vector2(70, 70));
        }

        private Slider MakeSlider(Transform parent)
        {
            var go = new GameObject("Slider", typeof(RectTransform), typeof(Slider));
            go.transform.SetParent(parent, false);
            var slider = go.GetComponent<Slider>();

            var bg = new GameObject("BG", typeof(RectTransform), typeof(Image));
            bg.transform.SetParent(go.transform, false);
            bg.GetComponent<Image>().color = new Color(1, 1, 1, 0.12f);
            Stretch(bg.GetComponent<RectTransform>());

            var fillArea = new GameObject("FillArea", typeof(RectTransform));
            fillArea.transform.SetParent(go.transform, false);
            Stretch(fillArea.GetComponent<RectTransform>());
            var fill = new GameObject("Fill", typeof(RectTransform), typeof(Image));
            fill.transform.SetParent(fillArea.transform, false);
            fill.GetComponent<Image>().color = Neon;
            var fr = fill.GetComponent<RectTransform>();
            fr.anchorMin = new Vector2(0, 0); fr.anchorMax = new Vector2(1, 1);
            fr.offsetMin = Vector2.zero; fr.offsetMax = Vector2.zero;

            slider.fillRect = fr;
            slider.direction = Slider.Direction.LeftToRight;
            slider.minValue = 0; slider.maxValue = 1; slider.value = 0;
            slider.interactable = false;
            return slider;
        }

        private RectTransform MakeScroll(Transform parent, Vector2 pad, float bottom)
        {
            var scrollGo = new GameObject("Scroll", typeof(RectTransform), typeof(Image),
                typeof(ScrollRect), typeof(Mask));
            scrollGo.transform.SetParent(parent, false);
            scrollGo.GetComponent<Image>().color = new Color(1, 1, 1, 0.02f);
            var srt = scrollGo.GetComponent<RectTransform>();
            srt.anchorMin = new Vector2(0, 0); srt.anchorMax = new Vector2(1, 1);
            srt.offsetMin = new Vector2(pad.x, pad.y);
            srt.offsetMax = new Vector2(-pad.x, -bottom);

            var content = new GameObject("Content", typeof(RectTransform),
                typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
            content.transform.SetParent(scrollGo.transform, false);
            var crt = content.GetComponent<RectTransform>();
            crt.anchorMin = new Vector2(0, 1); crt.anchorMax = new Vector2(1, 1);
            crt.pivot = new Vector2(0.5f, 1);
            crt.offsetMin = new Vector2(0, crt.offsetMin.y);
            crt.offsetMax = new Vector2(0, crt.offsetMax.y);
            var vlg = content.GetComponent<VerticalLayoutGroup>();
            vlg.spacing = 8; vlg.childControlWidth = true; vlg.childControlHeight = false;
            vlg.childForceExpandWidth = true; vlg.childForceExpandHeight = false;
            var fitter = content.GetComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.Fit.PreferredSize;

            var sr = scrollGo.GetComponent<ScrollRect>();
            sr.content = crt; sr.horizontal = false; sr.vertical = true;
            sr.movementType = ScrollRect.MovementType.Clamped;
            return crt;
        }

        private GameObject NewRow(Transform parent, float height)
        {
            var row = new GameObject("Row", typeof(RectTransform), typeof(HorizontalLayoutGroup), typeof(LayoutElement));
            row.transform.SetParent(parent, false);
            var h = row.GetComponent<HorizontalLayoutGroup>();
            h.spacing = 8; h.childControlWidth = true; h.childControlHeight = true;
            h.childForceExpandHeight = true;
            row.GetComponent<LayoutElement>().preferredHeight = height;
            return row;
        }

        private GameObject NewPanel(string name, Vector2 aMin, Vector2 aMax, Vector2 pos, Vector2 size, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(_canvas.transform, false);
            go.GetComponent<Image>().color = color;
            Anchor(go.GetComponent<RectTransform>(), aMin, aMax, pos, size);
            return go;
        }

        private GameObject NewFullOverlay(string name, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(_canvas.transform, false);
            go.GetComponent<Image>().color = color;
            Stretch(go.GetComponent<RectTransform>());
            return go;
        }

        private static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
        }

        private static void Anchor(RectTransform rt, Vector2 aMin, Vector2 aMax, Vector2 pos, Vector2 size)
        {
            rt.anchorMin = aMin; rt.anchorMax = aMax; rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos; rt.sizeDelta = size;
        }

        private static void SetLabel(Button b, string s)
        {
            var t = b.GetComponentInChildren<Text>();
            if (t != null) t.text = s;
        }
        private static void SetLabelColor(Button b, Color c)
        {
            var t = b.GetComponentInChildren<Text>();
            if (t != null) t.color = c;
        }
    }
}
