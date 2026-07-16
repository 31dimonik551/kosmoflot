#!/usr/bin/env bash
# ============================================================
# KosmoFlot — сборка Android APK из веб-игры без Android SDK/Gradle.
# Использует автономные инструменты (Maven Central / GitHub):
#   aapt2 (из apktool-lib), android.jar (зеркало), dalvik-dx, apksig.
# Пути к инструментам задаются через TOOLS (см. ниже).
# ============================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/app"
BUILD="$HERE/build"
OUT="$HERE/out"

# Каталог с инструментами (переопределяется переменной окружения TOOLS)
TOOLS="${TOOLS:-/tmp/claude-0/-home-user-kosmoflot/cff96a93-5454-5ffc-86d9-5d993f8180b0/scratchpad/tools}"
AAPT2="$TOOLS/aapt2bin"
ANDROID_JAR="$TOOLS/android33.jar"
DALVIK_DX="$TOOLS/dalvik-dx.jar"
APKSIG="$TOOLS/apksig.jar"

GAME_HTML="$HERE/../prototype-web/dist/kosmoflot.html"

echo "==> Проверка инструментов"
for f in "$AAPT2" "$ANDROID_JAR" "$DALVIK_DX" "$APKSIG" "$GAME_HTML"; do
  [ -f "$f" ] || { echo "НЕ НАЙДЕНО: $f"; exit 1; }
done
chmod +x "$AAPT2"

rm -rf "$BUILD" "$OUT"
mkdir -p "$BUILD" "$OUT"

echo "==> Копирую игру в assets"
mkdir -p "$APP/assets"
cp "$GAME_HTML" "$APP/assets/kosmoflot.html"

echo "==> aapt2 compile (ресурсы)"
"$AAPT2" compile --dir "$APP/res" -o "$BUILD/res.zip"

echo "==> aapt2 link (манифест + ресурсы + assets -> base.apk)"
"$AAPT2" link \
  -o "$BUILD/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  -A "$APP/assets" \
  --java "$BUILD/gen" \
  "$BUILD/res.zip"

echo "==> javac (Activity -> .class, target 8)"
mkdir -p "$BUILD/classes"
javac --release 8 -classpath "$ANDROID_JAR" \
  -d "$BUILD/classes" \
  "$APP/src/com/kosmoflot/game/MainActivity.java"

echo "==> dx (.class -> classes.dex)"
java -cp "$DALVIK_DX" com.android.dx.command.Main \
  --dex --output="$BUILD/classes.dex" "$BUILD/classes"

echo "==> Добавляю classes.dex в APK"
( cd "$BUILD" && zip -q base.apk classes.dex )

echo "==> Ключ подписи (создаю при отсутствии)"
KS="$BUILD/kosmoflot.p12"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -storetype PKCS12 -keystore "$KS" \
    -alias kosmoflot -storepass kosmoflot123 -keypass kosmoflot123 \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=KosmoFlot, O=KosmoFlot, C=RU" >/dev/null 2>&1
fi

echo "==> Компиляция подписчика (apksig)"
mkdir -p "$BUILD/signbin"
javac -classpath "$APKSIG" -d "$BUILD/signbin" "$HERE/signer/Sign.java"

echo "==> Подпись APK (v1+v2) и проверка"
java \
  --add-exports java.base/sun.security.x509=ALL-UNNAMED \
  --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
  --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$APKSIG:$BUILD/signbin" Sign \
  "$BUILD/base.apk" "$OUT/kosmoflot.apk" \
  "$KS" kosmoflot123 kosmoflot kosmoflot123

echo "==> Готово: $OUT/kosmoflot.apk"
ls -l "$OUT/kosmoflot.apk"
