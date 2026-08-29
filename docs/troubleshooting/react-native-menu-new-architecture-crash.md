# react-native-menu New Architecture Crash

## Symptom

On iOS with React Native New Architecture, rendering `MenuView` crashes the app:

```
*** Terminating app due to uncaught exception 'NSInvalidArgumentException',
reason: '-[MenuView setActionsHash:]: unrecognized selector sent to instance'
```

The crash happens as soon as a screen renders a native menu, for example the transaction list rows or the template card ellipsis menus.

## Cause

`@react-native-menu/menu` 1.2.2 ships a New Architecture Fabric component, but its `codegenConfig` is missing the `componentProvider` entry. Without it, React Native codegen never registers `MenuView` in `RCTThirdPartyComponentsProvider`, so the component falls back to the legacy interop path. That path sets the `actionsHash` prop through a `setActionsHash:` selector, which the Fabric `MenuView` class does not implement.

## Project Fix

The permanent fix is tracked at:

```text
patches/@react-native-menu+menu+1.2.2.patch
```

It adds the missing codegen component provider to the dependency's `package.json`:

```json
"codegenConfig": {
  "name": "RNMenuViewSpec",
  "type": "components",
  "jsSrcsDir": "src",
  "ios": {
    "componentProvider": {
      "MenuView": "MenuView"
    }
  }
}
```

`patch-package` applies it through the root `postinstall` script.

## Apply and Rebuild

```bash
npm install
npx patch-package
jq '.codegenConfig.ios' node_modules/@react-native-menu/menu/package.json
cd ios
pod install
cd ..
npx expo run:ios
```

## Verification

Confirm `MenuView` is registered as a Fabric component:

```bash
rg "MenuView" ios/build/generated/ios/ReactCodegen/RCTThirdPartyComponentsProvider.mm
```

Expected result contains:

```text
@"MenuView": NSClassFromString(@"MenuView"),
```

Then verify the app launches and a screen containing native menus renders without a crash report.

## Upgrade Note

This crash is fixed upstream in `@react-native-menu/menu` 2.0.0, which declares the component provider. When upgrading, check whether the new version includes the `componentProvider` entry and delete this patch rather than carrying it forward if it does.
