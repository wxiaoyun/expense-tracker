import { useColorScheme } from "react-native";

const lightColors = {
  text: "#000000",
  secondaryText: "#6E6E73",
  background: "#FFFFFF",
  groupedBackground: "#F2F2F7",
  surface: "#FFFFFF",
  separator: "#8E8E93",
  fill: "#F2F2F7",
  input: "#FFFFFF",
  placeholder: "#6E6E73",
  primary: "#0062CC",
  onPrimary: "#FFFFFF",
  primaryBackground: "#E5F1FF",
  destructive: "#D70015",
  destructiveBackground: "#FFE5E5",
  warning: "#B25000",
  success: "#1F7A36",
  overlay: "rgba(242,242,247,0.86)",
  chartTrack: "#8E8E93",
} as const;

export type ThemeColorKey = keyof typeof lightColors;
export type ThemeColors = Record<ThemeColorKey, string>;

const darkColors: ThemeColors = {
  text: "#FFFFFF",
  secondaryText: "#AEAEB2",
  background: "#000000",
  groupedBackground: "#000000",
  surface: "#1C1C1E",
  separator: "#68686D",
  fill: "#2C2C2E",
  input: "#2C2C2E",
  placeholder: "#98989D",
  primary: "#0A84FF",
  onPrimary: "#000000",
  primaryBackground: "#001D33",
  destructive: "#FF6961",
  destructiveBackground: "#4A1111",
  warning: "#FF9F0A",
  success: "#30D158",
  overlay: "rgba(28,28,30,0.86)",
  chartTrack: "#68686D",
};

export const useThemeColors = (): ThemeColors =>
  useColorScheme() === "dark" ? darkColors : lightColors;

export const useThemeColor = (key: ThemeColorKey) => useThemeColors()[key];
