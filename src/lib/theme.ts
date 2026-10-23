/**
 * @file lib/theme.ts
 * @description Single typed source of truth for theme state.
 *
 * WHY: Both <ThemeSwitch> (Base UI island) and the terminal's `theme`
 * command need identical apply/read/validate logic. Extracting it here
 * keeps one implementation, and the `isThemeMode` type guard gives
 * commands compile-time + runtime safety on user input.
 *
 * MODES: dark / light ONLY (no "system"). Dark is the site default and
 * the fallback for missing or garbage stored values — including legacy
 * "system" entries written by previous versions, which now resolve to
 * dark. The choice persists in localStorage under the same "theme" key.
 */

export type ThemeMode = "light" | "dark";

export const THEME_MODES: readonly ThemeMode[] = ["light", "dark"] as const;

const STORAGE_KEY = "theme";
const DEFAULT_THEME: ThemeMode = "dark";

/** Runtime guard that narrows arbitrary user input to ThemeMode. */
export function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

/** Apply a theme to <html> and persist it. Client-only. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
  localStorage.setItem(STORAGE_KEY, mode);
}

/** Read the persisted theme, falling back to dark on missing/garbage data. */
export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== null && isThemeMode(stored) ? stored : DEFAULT_THEME;
}
