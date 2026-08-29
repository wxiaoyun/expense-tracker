# react-native-date-picker iOS New Architecture Crash

## Symptoms

The iOS app builds successfully, then crashes immediately at launch when using:

- React Native New Architecture
- React Native 0.79 or newer
- `react-native-date-picker` 5.0.13

The crash reports that `RNDatePickerManager` does not conform to the `RCTModuleProvider` protocol.

## Cause

`react-native-date-picker` 5.0.13 declares an outdated iOS `modulesProvider` entry in its `codegenConfig`:

```json
"ios": {
  "componentProvider": {
    "RNDatePicker": "RNDatePicker"
  },
  "modulesProvider": {
    "RNDatePicker": "RNDatePickerManager"
  }
}
```

Modern React Native autolinking treats `RNDatePickerManager` as a module provider. The legacy manager does not implement the required provider protocol, so native startup crashes before React renders.

## Project Fix

The permanent fix is tracked at:

```text
patches/react-native-date-picker+5.0.13.patch
```

The patch removes only `codegenConfig.ios.modulesProvider`. It keeps the Fabric `componentProvider` entry:

```json
"ios": {
  "componentProvider": {
    "RNDatePicker": "RNDatePicker"
  }
}
```

Do not restore the previous workaround that modified `RNDatePickerManager.h` and `RNDatePickerManager.mm` to implement `NativeRNDatePickerSpec`. That workaround does not stop autolinking from registering the manager as an `RCTModuleProvider`.

`patch-package` is already installed and the root `package.json` runs it through `postinstall`.

## Apply and Rebuild

After installing dependencies, confirm the patch applies:

```bash
npm install
npx patch-package
jq '.codegenConfig.ios' node_modules/react-native-date-picker/package.json
```

Expected iOS configuration:

```json
{
  "componentProvider": {
    "RNDatePicker": "RNDatePicker"
  }
}
```

Regenerate CocoaPods code and rebuild:

```bash
cd ios
pod install
cd ..
npx expo run:ios
```

## Current Usage and Verification

The active transaction and template editors render `@react-native-community/datetimepicker`. The `react-native-date-picker` dependency and patch are retained for v3 branch compatibility; the dependency may still be loaded by compatible v3 code paths even though it is not the date control on the current editor screens.

Confirm generated module-provider code does not contain `RNDatePickerManager`:

```bash
rg "RNDatePickerManager" ios/build/generated/ios/ReactCodegen/RCTModuleProviders.mm
```

Expected result is no match.

Then verify:

1. iOS build succeeds.
2. App process remains running after launch.
3. No new `VibeTracker` crash report appears in `~/Library/Logs/DiagnosticReports`.

This fix was validated locally with `react-native-date-picker` 5.0.13 and React Native 0.86.2 on an iPhone 17 Pro simulator. That validation covered patch application, native generation, build, and launch stability. Rendering a `react-native-date-picker` control on a current screen was not part of the accepted verification.

## Upgrade Note

When upgrading `react-native-date-picker`, check whether upstream removed the invalid `modulesProvider` entry. If fixed upstream, delete this patch rather than carrying it into a newer package version.
