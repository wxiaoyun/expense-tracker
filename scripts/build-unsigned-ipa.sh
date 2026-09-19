#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
archive_path="$root_dir/build/VibeTracker.xcarchive"
ipa_path="$root_dir/build/VibeTracker-unsigned.ipa"
payload_dir="$(mktemp -d)"

trap 'rm -rf "$payload_dir"' EXIT

cd "$root_dir"
echo "[build][stage=prebuild][target=ios][status=started] Generating native configuration"
CI=1 npx expo prebuild --platform ios

echo "[build][stage=archive][target=$archive_path][status=started] Building Release archive"
xcodebuild \
  -workspace "$root_dir/ios/VibeTracker.xcworkspace" \
  -scheme VibeTracker \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive_path" \
  archive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM=''

app_path="$archive_path/Products/Applications/VibeTracker.app"
echo "[build][stage=validate_scene_lifecycle][target=$app_path][status=started] Checking iOS scene configuration"
/usr/libexec/PlistBuddy -c 'Print :UIApplicationSceneManifest:UISceneConfigurations:UIWindowSceneSessionRoleApplication:0:UISceneDelegateClassName' "$app_path/Info.plist"

echo "[build][stage=package][target=$ipa_path][status=started] Packaging unsigned IPA"
mkdir -p "$payload_dir/Payload"
cp -R "$app_path" "$payload_dir/Payload/"
ditto -c -k --sequesterRsrc --keepParent "$payload_dir/Payload" "$ipa_path"

echo "Created $ipa_path"
