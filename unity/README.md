# KosmoFlot — Unity C# версия

3D-раннер от третьего лица под Android с батлпассом, ежедневной наградой за
вход и наградой за просмотр рекламы. Логика и баланс повторяют веб-прототип
из `../prototype-web`.

> Репозиторий содержит только исходники (`Assets/`, `Packages/`,
> `ProjectSettings/`). Папки `Library/`, `Temp/` и т.п. Unity генерирует сам.

## Быстрый старт

1. **Unity Hub** → *Add project from disk* → выберите папку `unity/KosmoFlot`.
   Рекомендуемая версия — **Unity 2022.3 LTS** (см. `ProjectSettings/ProjectVersion.txt`).
2. Откройте проект. Дождитесь импорта и компиляции скриптов.
3. В верхнем меню: **KosmoFlot → Build Playable Scene**.
   Скрипт `Assets/Scripts/Editor/SceneBuilder.cs` сам создаст сцену
   `Assets/Scenes/Game.unity` (камера, свет, корабль, менеджеры, весь UI)
   и добавит её в Build Settings.
4. Нажмите **Play**. Больше ничего настраивать вручную не нужно.

### Управление
- **← → / A D** — сменить полосу
- **↑ / W / Space / свайп вверх** — прыжок (через низкие барьеры)
- **↓ / S / свайп вниз** — подкат (под висячие балки)
- Полные стены обходятся только сменой полосы.

## Архитектура (`Assets/Scripts`)

| Слой   | Файлы | Роль |
|--------|-------|------|
| Core   | `GameConfig.cs`, `GameManager.cs` | Константы баланса; состояние забега, счёт, скорость, события. |
| Player | `PlayerController.cs` | Ввод (клавиши + свайпы), полосы, прыжок/подкат, обработка столкновений (триггеры). |
| World  | `TrackGenerator.cs`, `Obstacle.cs`, `Coin.cs` | Процедурная генерация коридора, препятствий и кристаллов; скролл и переработка объектов. |
| Meta   | `PlayerData.cs`, `SaveSystem.cs`, `BattlePass.cs`, `DailyReward.cs`, `RewardedAdManager.cs`, `MetaController.cs` | Прогресс, сохранение (PlayerPrefs+JSON), боевой пропуск, ежедневная награда, реклама. |
| UI     | `UIManager.cs` | Строит весь runtime-интерфейс кодом (uGUI): HUD, экраны, панели Battle Pass / Daily, оверлей рекламы. |
| Editor | `SceneBuilder.cs` | Сборка играбельной сцены из меню. |

### Поток данных
```
PlayerController ──ввод/столкновения──▶ GameManager ──событие OnRunFinished──▶ MetaController
       ▲                                    │                                      │
       └────ResetPlayer()───────────────────┘                                      ▼
TrackGenerator ◀──Scroll(dz)── GameManager        BattlePass / DailyReward / RewardedAd
UIManager ◀── события GameManager + MetaController.OnChanged ── перерисовка HUD/панелей
```

## Мета-системы

- **Battle Pass** — 30 уровней, Free/Premium треки, XP за забег
  (`XpPerCoin`·кристаллы + `XpPerMeter`·метры). Премиальные скины на каждом
  5-м уровне. Открытие Premium — заглушка (`BattlePass.BuyPremium`), место
  для интеграции IAP.
- **Ежедневная награда** — серия входов (streak) по календарным дням (UTC),
  цикл наград `50…1000`. Пропуск дня сбрасывает серию.
- **Награда за рекламу** — удвоение добычи забега. Сейчас симуляция показа;
  точка интеграции — `RewardedAdManager`.

## Интеграция реальной рекламы (Unity Ads)

Файл `Assets/Scripts/Meta/RewardedAdManager.cs` изолирует SDK. Внешний
контракт — `ShowRewarded(Action onReward)` — менять не нужно.

1. **Package Manager** → установить **Advertisement** (`com.unity.ads`).
2. **Project Settings → Services** → включить Ads, вставить **Game ID** (Android).
3. Реализовать `IUnityAdsInitializationListener`, `IUnityAdsLoadListener`,
   `IUnityAdsShowListener`; в `OnUnityAdsShowComplete` при
   `UnityAdsShowCompletionState.COMPLETED` вызвать `onReward()`.
4. В `ShowRewarded()` заменить симуляцию на `Advertisement.Show(adUnitId, this)`.

## Сборка под Android

1. **File → Build Settings → Android → Switch Platform**.
2. **Player Settings**:
   - *Company/Product Name*, *Package name* (`com.yourstudio.kosmoflot`).
   - *Minimum API Level* 24+, *Scripting Backend* **IL2CPP**,
     *Target Architectures* **ARM64** (требование Google Play).
3. Установите **Android Build Support** (SDK/NDK/JDK) через Unity Hub.
4. **Build** — `.apk` для теста или **Build App Bundle (.aab)** для Google Play.

## Что можно улучшить дальше
- Заменить примитивы на 3D-модели (корабль, астероиды, станция) и TextMeshPro
  (для корректных эмодзи/иконок в UI).
- Пулинг объектов трека вместо `Instantiate/Destroy`.
- Звук, частицы двигателя, тряска камеры при крушении.
- Серверная валидация прогресса и IAP.
