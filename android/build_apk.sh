#!/usr/bin/env bash
# Gera o APK de Android TV sem Android Studio/Gradle: aapt2 + javac + d8 + zipalign + apksig.
# Uso: SDK=/caminho/das/ferramentas ./android/build_apk.sh
#   O diretório SDK precisa ter: android.jar (API 30), build-tools/aapt2, build-tools/zipalign,
#   build-tools/apksigner.jar e r8.jar (d8). Veja o LEIA-ME do projeto para onde baixar cada um.
set -euo pipefail
cd "$(dirname "$0")/.."
SDK=${SDK:?defina SDK}
OUT=android/build
rm -rf "$OUT" && mkdir -p "$OUT/assets/www" "$OUT/classes" "$OUT/res"

echo "1/6 build do app web"
npx vite build >/dev/null
cp -r dist/. "$OUT/assets/www/"
rm -f "$OUT/assets/www/sw.js" # no APK não precisa de service worker

echo "2/6 recursos"
"$SDK/build-tools/aapt2" compile --dir android/res -o "$OUT/res.zip"
"$SDK/build-tools/aapt2" link -o "$OUT/unsigned.apk" -I "$SDK/android.jar" \
  --manifest android/AndroidManifest.xml --min-sdk-version 21 --target-sdk-version 30 \
  -A "$OUT/assets" "$OUT/res.zip" --auto-add-overlay

echo "3/6 java"
javac -source 8 -target 8 -nowarn -bootclasspath "$SDK/android.jar" -d "$OUT/classes" \
  android/src/br/tvgeise/escolhe/MainActivity.java 2>&1 | grep -v "warning" || true

echo "4/6 dex"
java -cp "$SDK/r8.jar" com.android.tools.r8.D8 --release --min-api 21 --lib "$SDK/android.jar" \
  --output "$OUT" $(find "$OUT/classes" -name '*.class')
(cd "$OUT" && zip -q unsigned.apk classes.dex)

echo "5/6 alinhamento"
"$SDK/build-tools/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "6/6 assinatura"
KS=android/escolhe.p12
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass escolhe -keypass escolhe \
    -alias escolhe -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Escolhe pra Mim" >/dev/null 2>&1
fi
cp "$OUT/aligned.apk" "$OUT/escolhe-pra-mim.apk"
java -jar "$SDK/build-tools/apksigner.jar" sign --ks "$KS" --ks-pass pass:escolhe --min-sdk-version 21 "$OUT/escolhe-pra-mim.apk"
java -jar "$SDK/build-tools/apksigner.jar" verify --min-sdk-version 21 --print-certs "$OUT/escolhe-pra-mim.apk" | head -2
ls -la "$OUT/escolhe-pra-mim.apk"
