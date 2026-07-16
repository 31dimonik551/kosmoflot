/* ============================================================
   KosmoFlot — мета-системы (прототип)
   • Battle Pass (Free / Premium трек, XP по забегам)
   • Ежедневная награда (серия входов / streak)
   • Награда за рекламу (удвоение добычи; заглушка провайдера)
   Хранение: localStorage. Валюта: кристаллы.
   ============================================================ */
(function () {
  'use strict';

  // ---------- Конфиг ----------
  const STORE_KEY = 'kf_meta_v1';
  const BP_TIERS = 30;
  const BP_XP_PER_TIER = 100;
  const XP_PER_COIN = 10;                 // XP за 1 кристалл в забеге
  const XP_PER_METER = 1;                 // XP за 1 метр
  const DAILY_CYCLE = [50, 75, 100, 150, 200, 300, 500, 1000]; // награды дней 1..8

  // Награды батлпасса (генерируются один раз)
  const BP = buildBattlePass();

  // ---------- Состояние ----------
  const state = load();

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const dom = {
    wallet: $('#wallet'), walletC: $('#wallet-crystals'),
    bpBtnTier: $('#bp-btn-tier'),
    dailyBtnState: $('#daily-btn-state'), dailyBadge: $('#daily-badge'),
    modalRoot: $('#modal-root'),
    panelBp: $('#panel-bp'), panelDaily: $('#panel-daily'),
    bpLevel: $('#bp-level'), bpFill: $('#bp-fill'),
    bpXpCur: $('#bp-xp-cur'), bpXpMax: $('#bp-xp-max'),
    bpTrack: $('#bp-track'), bpBuy: $('#bp-buy'), bpCta: $('#bp-premium-cta'),
    dailyGrid: $('#daily-grid'), dailyClaim: $('#daily-claim'), dailyMsg: $('#daily-msg'),
    overReward: $('#over-reward'), overEarned: $('#over-earned'), overXp: $('#over-xp'),
    btnDouble: $('#btn-double'),
    adOverlay: $('#ad-overlay'), adTimer: $('#ad-timer'),
    btnPlay: $('#btn-play'), btnRetry: $('#btn-retry'), btnHome: $('#btn-home'),
    btnBp: $('#btn-battlepass'), btnDaily: $('#btn-daily'),
    screenStart: $('#screen-start'), screenOver: $('#screen-over'),
  };

  // Ожидающая награда забега (для удвоения по рекламе)
  let pending = null;

  // ============================================================
  //  Хранилище
  // ============================================================
  function defaults() {
    return {
      crystals: 0, bpXp: 0, bpPremium: false,
      bpClaimedFree: [], bpClaimedPrem: [],
      dailyLast: null, dailyStreak: 0,
    };
  }
  function load() {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
    catch { return defaults(); }
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  // ============================================================
  //  Battle Pass
  // ============================================================
  function buildBattlePass() {
    const tiers = [];
    for (let i = 1; i <= BP_TIERS; i++) {
      const free = { crystals: 20 + i * 5 };
      const isMilestone = i % 5 === 0;
      const prem = isMilestone
        ? { crystals: 100 + i * 15, item: '★ Скин #' + (i / 5) }
        : { crystals: 60 + i * 10 };
      tiers.push({ tier: i, free, prem });
    }
    return tiers;
  }
  const bpLevel = () => Math.min(BP_TIERS, Math.floor(state.bpXp / BP_XP_PER_TIER) + 1);
  const bpXpInLevel = () => state.bpXp % BP_XP_PER_TIER;

  function renderBattlePass() {
    const lvl = bpLevel();
    dom.bpLevel.textContent = lvl;
    dom.bpXpCur.textContent = bpXpInLevel();
    dom.bpXpMax.textContent = BP_XP_PER_TIER;
    dom.bpFill.style.width = (bpXpInLevel() / BP_XP_PER_TIER * 100) + '%';
    dom.bpBtnTier.textContent = 'Ур. ' + lvl;
    dom.bpCta.classList.toggle('owned', state.bpPremium);
    dom.bpBuy.textContent = state.bpPremium ? 'Premium активен' : 'Открыть Premium';
    dom.bpBuy.disabled = state.bpPremium;

    dom.bpTrack.innerHTML = '';
    for (const t of BP) {
      const unlocked = lvl >= t.tier;
      const row = document.createElement('div');
      row.className = 'bp-tier';
      row.appendChild(cell('bp-tier-no', String(t.tier)));

      row.appendChild(rewardCell('free', t, unlocked));
      row.appendChild(rewardCell('prem', t, unlocked));
      dom.bpTrack.appendChild(row);
    }
  }
  function cell(cls, txt) { const d = document.createElement('div'); d.className = cls; d.textContent = txt; return d; }

  function rewardCell(track, t, unlocked) {
    const isPrem = track === 'prem';
    const rw = isPrem ? t.prem : t.free;
    const claimedArr = isPrem ? state.bpClaimedPrem : state.bpClaimedFree;
    const claimed = claimedArr.includes(t.tier);
    const label = (rw.item ? rw.item + '\n' : '') + '+' + rw.crystals + ' 💎';

    const d = document.createElement('div');
    d.className = 'bp-reward' + (isPrem ? ' premium' : '');
    d.textContent = label;

    const lockedByPremium = isPrem && !state.bpPremium;
    if (claimed) d.classList.add('claimed');
    else if (unlocked && !lockedByPremium) {
      d.classList.add('claimable');
      d.addEventListener('click', () => claimBp(track, t.tier));
    } else d.classList.add('locked');
    return d;
  }

  function claimBp(track, tier) {
    const isPrem = track === 'prem';
    if (isPrem && !state.bpPremium) return;
    if (bpLevel() < tier) return;
    const arr = isPrem ? state.bpClaimedPrem : state.bpClaimedFree;
    if (arr.includes(tier)) return;
    const rw = (isPrem ? BP[tier - 1].prem : BP[tier - 1].free);
    arr.push(tier);
    grantCrystals(rw.crystals);
    save();
    renderBattlePass();
  }

  function buyPremium() {
    if (state.bpPremium) return;
    state.bpPremium = true;      // прототип: без реальной оплаты
    save();
    renderBattlePass();
  }

  // ============================================================
  //  Ежедневная награда
  // ============================================================
  const todayStr = () => new Date().toISOString().slice(0, 10);
  function daysBetween(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  }
  function dailyClaimable() { return state.dailyLast !== todayStr(); }

  // Индекс дня (0..cycle-1), который будет получен при следующем клейме
  function nextDayIndex() {
    if (!state.dailyLast) return 0;
    const gap = daysBetween(state.dailyLast, todayStr());
    if (gap === 1) return state.dailyStreak % DAILY_CYCLE.length; // продолжаем серию
    if (gap === 0) return (state.dailyStreak - 1 + DAILY_CYCLE.length) % DAILY_CYCLE.length; // уже забрано сегодня
    return 0; // серия прервана
  }

  function renderDaily() {
    const claimable = dailyClaimable();
    dom.dailyBadge.classList.toggle('hidden', !claimable);
    dom.dailyBtnState.textContent = claimable ? 'Забрать!' : 'Завтра';

    const idx = nextDayIndex();
    dom.dailyGrid.innerHTML = '';
    DAILY_CYCLE.forEach((amt, i) => {
      const c = document.createElement('div');
      c.className = 'daily-cell';
      if (claimable && i === idx) c.classList.add('today');
      if (!claimable && i === idx) c.classList.add('claimed');
      c.innerHTML = `<div class="d-day">День ${i + 1}</div><div class="d-amt">${amt}💎</div>`;
      dom.dailyGrid.appendChild(c);
    });

    dom.dailyClaim.disabled = !claimable;
    dom.dailyClaim.textContent = claimable ? 'Забрать награду' : 'Уже забрано сегодня';
    dom.dailyMsg.textContent = '';
  }

  function claimDaily() {
    if (!dailyClaimable()) return;
    const gap = state.dailyLast ? daysBetween(state.dailyLast, todayStr()) : null;
    state.dailyStreak = (gap === 1) ? state.dailyStreak + 1 : 1;   // серия или сброс
    const idx = (state.dailyStreak - 1) % DAILY_CYCLE.length;
    const amt = DAILY_CYCLE[idx];
    state.dailyLast = todayStr();
    grantCrystals(amt);
    save();
    renderDaily();
    dom.dailyMsg.textContent = `+${amt} 💎 получено! Серия: ${state.dailyStreak} дн.`;
  }

  // ============================================================
  //  Награда за рекламу (заглушка провайдера)
  // ============================================================
  // Реальный SDK (AdMob/Unity Ads) заменит эту функцию: колбэк onReward.
  function showRewardedAd(onReward) {
    let t = 3;
    dom.adTimer.textContent = t;
    dom.adOverlay.classList.remove('hidden');
    const iv = setInterval(() => {
      t--;
      dom.adTimer.textContent = t;
      if (t <= 0) {
        clearInterval(iv);
        dom.adOverlay.classList.add('hidden');
        onReward();
      }
    }, 700);
  }

  function doubleViaAd() {
    if (!pending || pending.doubled) return;
    showRewardedAd(() => {
      grantCrystals(pending.crystals);   // ещё раз столько же кристаллов
      state.bpXp += pending.xp;          // и XP
      pending.doubled = true;
      save();
      dom.btnDouble.disabled = true;
      dom.btnDouble.textContent = '✓ Награда удвоена';
      dom.overReward.classList.add('claimed');
      renderBattlePass();
    });
  }

  // ============================================================
  //  Общее
  // ============================================================
  function grantCrystals(n) { state.crystals += n; updateWallet(); }
  function updateWallet() { dom.walletC.textContent = state.crystals; }

  function showWallet(v) { dom.wallet.classList.toggle('hidden', !v); }

  function openModal(panel) {
    dom.modalRoot.classList.remove('hidden');
    dom.panelBp.classList.add('hidden');
    dom.panelDaily.classList.add('hidden');
    panel.classList.remove('hidden');
  }
  function closeModal() { dom.modalRoot.classList.add('hidden'); }

  // Хук из game.js — вызывается по завершении забега
  window.KosmoFlot.onRunFinished = function (res) {
    const xp = res.coins * XP_PER_COIN + Math.floor(res.distance) * XP_PER_METER;
    state.crystals += res.coins;
    state.bpXp += xp;
    pending = { crystals: res.coins, xp, doubled: false };
    save();
    updateWallet();
    showWallet(true);
    // экран game over
    dom.overEarned.textContent = res.coins;
    dom.overXp.textContent = xp;
    dom.overReward.classList.remove('claimed');
    dom.btnDouble.disabled = res.coins === 0;
    dom.btnDouble.textContent = '📺 Смотреть рекламу — удвоить награду';
    dom.bpBtnTier.textContent = 'Ур. ' + bpLevel();
  };

  // ============================================================
  //  Проводка событий
  // ============================================================
  function wire() {
    dom.btnBp.addEventListener('click', () => { renderBattlePass(); openModal(dom.panelBp); });
    dom.btnDaily.addEventListener('click', () => { renderDaily(); openModal(dom.panelDaily); });
    dom.bpBuy.addEventListener('click', buyPremium);
    dom.dailyClaim.addEventListener('click', claimDaily);
    dom.btnDouble.addEventListener('click', doubleViaAd);

    // Кнопка «В меню» на экране game over
    dom.btnHome.addEventListener('click', () => {
      dom.screenOver.classList.add('hidden');
      dom.screenStart.classList.remove('hidden');
      showWallet(true);
    });

    // Прячем кошелёк на время забега
    dom.btnPlay.addEventListener('click', () => showWallet(false));
    dom.btnRetry.addEventListener('click', () => showWallet(false));

    // Закрытие модалок
    dom.modalRoot.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-close')) closeModal();
    });
  }

  // ---------- Init ----------
  function init() {
    wire();
    updateWallet();
    showWallet(true);
    dom.bpBtnTier.textContent = 'Ур. ' + bpLevel();
    dom.dailyBadge.classList.toggle('hidden', !dailyClaimable());
    dom.dailyBtnState.textContent = dailyClaimable() ? 'Забрать!' : 'Завтра';
  }
  init();
})();
