export const getSystemTheme = () => {
  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const onSystemThemeChange = (
  callback: (theme: "light" | "dark") => void,
) => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const listener = (e: MediaQueryListEvent) => {
    callback(e.matches ? "dark" : "light");
  };

  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
};
