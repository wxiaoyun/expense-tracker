# Troubleshooting

## Metro reports an installed package file is missing

Metro may report that a package exists but its entry file cannot be resolved after reinstalling `node_modules`. For example:

```text
InvalidPackageError: strict-uri-encode/package.json was found, but index.js could not be resolved
```

If the reported file exists on disk, Metro likely cached its dependency graph while the package installation was incomplete. Deleting `node_modules`, `ios/Pods`, `ios/build`, or Xcode DerivedData does not reset a running Metro process or its cache.

Stop Metro in its terminal with `Ctrl+C`, then start it with a clean cache:

```bash
npx expo start --clear --dev-client
```

If an orphaned Metro process still owns port 8081, stop that listener first:

```bash
pids=$(lsof -tiTCP:8081 -sTCP:LISTEN)
[ -z "$pids" ] || kill $pids
npx expo start --clear --dev-client
```

Wait for Metro to report that it is running, then reopen the development client. Clean Pods or rebuild the iOS app only when the failure involves native compilation, linking, native module registration, or an actual native crash.

## Archive fails with "virtual filesystem overlay file ... not found"

The archive output ends with several failing targets but no useful message. Search the full `xcodebuild` log for `error:` instead. If it reports:

```text
error: virtual filesystem overlay file '/old/path/ios/Pods/React-Core-prebuilt/React-VFS.yaml' not found
```

CocoaPods baked an absolute path into `ios/Pods` and the repository has since moved or been renamed. Regenerate the Pods from the new location:

```bash
cd ios && pod install
```

Then archive again. Deleting DerivedData alone does not help because the stale path lives in the generated Pods xcconfig files.
