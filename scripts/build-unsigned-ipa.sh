#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
archive_path="$root_dir/build/VibeTracker.xcarchive"
ipa_path="$root_dir/build/VibeTracker-unsigned.ipa"
payload_dir="$(mktemp -d)"

trap 'rm -rf "$payload_dir"' EXIT

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

mkdir -p "$payload_dir/Payload"
cp -R "$archive_path/Products/Applications/VibeTracker.app" "$payload_dir/Payload/"
ditto -c -k --sequesterRsrc --keepParent "$payload_dir/Payload" "$ipa_path"

echo "Created $ipa_path"
