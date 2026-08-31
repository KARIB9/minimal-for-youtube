#!/bin/sh
# Собирает архивы для Chrome Web Store и AMO — по одному на магазин.
#
# Зачем два, а не один. Фоновый скрипт в манифесте объявлен дважды:
# service_worker понимает Chrome, scripts — Firefox, и каждый браузер
# игнорирует чужой ключ. Работает и так, но на проверке магазин видит
# в манифесте лишнее. Поэтому здесь под каждый магазин собирается свой
# манифест: Chrome получает service_worker без gecko-раздела, Firefox —
# scripts вместе с ним. Исходный manifest.json держит оба ключа, чтобы
# расширение грузилось из папки в любом браузере при разработке.
#
# Список файлов ЯВНЫЙ, а не "всё кроме лишнего": в архив не попадёт ничего,
# о чём мы не подумали, — ни .DS_Store, ни .claude с локальными настройками,
# ни сам этот скрипт, ни icons/youtube-logo.svg (чужой товарный знак,
# в коде не используется). Обратная сторона: добавили файл в расширение —
# впишите его сюда.
#
# Запуск:  sh tools/build.sh

set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
out="build"

mkdir -p "$out"

for target in chrome firefox; do
    stage="$out/stage-$target"
    archive="$out/minimal-for-youtube-$version-$target.zip"

    rm -rf "$stage"
    mkdir -p "$stage/icons"

    cp early.js content.js timer.js styles.css "$stage/"
    cp -R popup _locales "$stage/"
    cp icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png "$stage/icons/"

    python3 - "$target" > "$stage/manifest.json" <<'PY'
import json
import sys

target = sys.argv[1]

with open("manifest.json", encoding="utf-8") as source:
    manifest = json.load(source)

if target == "chrome":
    manifest["background"] = {"service_worker": manifest["background"]["service_worker"]}
    manifest.pop("browser_specific_settings", None)
else:
    manifest["background"] = {"scripts": manifest["background"]["scripts"]}

print(json.dumps(manifest, indent=2, ensure_ascii=False))
PY

    rm -f "$archive"
    (cd "$stage" && zip -r -q "../$(basename "$archive")" . -x '*.DS_Store')
    rm -rf "$stage"

    echo "Собрано: $archive"
done

echo
for target in chrome firefox; do
    archive="$out/minimal-for-youtube-$version-$target.zip"
    echo "--- $target: background и gecko-раздел ---"
    unzip -p "$archive" manifest.json | python3 -c "
import json, sys
manifest = json.load(sys.stdin)
print('background:', manifest['background'])
print('browser_specific_settings:', manifest.get('browser_specific_settings', 'нет'))
"
done
