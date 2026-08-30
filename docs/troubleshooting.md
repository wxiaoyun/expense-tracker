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
