/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a9396';
const tintColorDark = '#d7e3fc';
export const Success = "#34C759";
export const InfoDark = "#007AFF"
export const InfoLight = "#007AFF"
export const CriticalDark = "#e63946"
export const CriticalLight = "#c1121f"

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    destructive: CriticalLight,
    success: Success,
    info: InfoLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    destructive: CriticalDark,
    success: Success,
    info: InfoDark,
  },
};
