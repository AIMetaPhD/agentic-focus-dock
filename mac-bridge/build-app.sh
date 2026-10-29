#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

swift build -c release

APP=".build/FocusDockBridge.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp ".build/release/FocusDockBridge" "$APP/Contents/MacOS/FocusDockBridge"
cp "Info.plist" "$APP/Contents/Info.plist"
chmod +x "$APP/Contents/MacOS/FocusDockBridge"

# Ad-hoc signature only. This build is not notarized and is not a
# double-click installer for non-developers.
codesign --force --sign - "$APP" >/dev/null 2>&1 || true

echo "Built $APP"
echo "Run: open \"$PWD/$APP\" --args --backend http://127.0.0.1:4317"
echo "Token: $HOME/Library/Application Support/FocusDock/runtime/bridge-token"
echo "NOTE: ad-hoc signed, not notarized; real-device verification is still required."
