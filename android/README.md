# KosmoFlot — Android APK (WebView-обёртка)

Упаковывает веб-версию игры (`../prototype-web/dist/kosmoflot.html`) в
установочный APK: одно `Activity` c `WebView` на весь экран, игра лежит в
`assets/` и работает **полностью офлайн**.

- **Пакет:** `com.kosmoflot.game` · **Версия:** 1.0
- **Мин. Android:** 7.0 (API 24) · **Target:** API 33
- **Подпись:** APK Signature Scheme v2 (`verified=true`)

## Установка на телефон
1. Скопируй `out/kosmoflot.apk` на устройство.
2. Включи «Установка из неизвестных источников» для файлового менеджера/браузера.
3. Открой файл и подтверди установку.

## Как это собрано (без Android SDK и без Gradle)

В этой среде заблокирован `dl.google.com` (Android SDK, `aapt2`, `d8`, AGP,
AndroidX). Поэтому сборка сделана на автономных инструментах, доступных с
Maven Central / GitHub, без инфраструктуры Google:

| Инструмент | Роль | Источник |
|-----------|------|----------|
| `aapt2` (linux) | компиляция ресурсов + бинарный манифест | извлечён из `org.apktool:apktool-lib` (Maven Central) |
| `android.jar` (API 33) | classpath для `javac` и `-I` для `aapt2` | зеркало `Sable/android-platforms` (GitHub) |
| `dalvik-dx` | `.class` → `classes.dex` | `com.jakewharton.android.repackaged:dalvik-dx` (Maven Central) |
| `apksig` | подпись APK (v2) | `com.android.tools.build:apksig` (Maven Central) |
| `javac`, `keytool` | компиляция, ключ | JDK 21 |

### Конвейер (`build-apk.sh`)
```
aapt2 compile (res) → aapt2 link (manifest+res+assets → base.apk)
javac (--release 8) → dalvik-dx (classes.dex) → zip в APK
keytool (ключ) → apksig (подпись v2 + проверка) → out/kosmoflot.apk
```

## Пересборка
```bash
# После изменения игры сначала пересобери веб-версию:
cd ../prototype-web && node -e '...'   # см. историю; собирает dist/kosmoflot.html
# Затем APK (инструменты ищутся в $TOOLS, по умолчанию — каталог scratchpad):
cd ../android && TOOLS=/path/к/инструментам bash build-apk.sh
```
Каталог `$TOOLS` должен содержать: `aapt2bin`, `android33.jar`,
`dalvik-dx.jar`, `apksig.jar` (см. таблицу выше, откуда их взять).

## Файлы
- `app/AndroidManifest.xml` — манифест (пакет, activity, sdk, иконка).
- `app/src/com/kosmoflot/game/MainActivity.java` — WebView-обёртка.
- `app/res/mipmap-*/ic_launcher.png` — иконки (5 плотностей).
- `app/res/values/strings.xml` — название приложения.
- `signer/Sign.java` — подпись через apksig.
- `build-apk.sh` — весь конвейер сборки.

## Ограничение
APK собран, подписан и структурно проверен (`aapt2 dump badging`,
`ApkVerifier`), но **не запускался на реальном устройстве/эмуляторе** —
в этой среде нет Android-runtime. Игра внутри — та же, что проверена в
браузере.
