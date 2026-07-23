const STORAGE_KEY = "novelcraft_theme";

export const DEFAULT_THEME = "native";

export interface ThemeDefinition {
  name: string;
  description: string;
  variables: Record<string, string>;
}

export const THEMES: Record<string, ThemeDefinition> = {
  native: {
    name: "Native",
    description: "Simple dark theme",
    variables: {
      "--bg": "#1a1a2e",
      "--bg-secondary": "#16213e",
      "--text": "#e0e0e0",
      "--text-muted": "#888",
      "--accent": "#4fc3f7",
      "--accent-hover": "#81d4fa",
      "--border": "#2a2a4a",
      "--focus-bg": "rgba(79, 195, 247, 0.08)",
      "--font-mono": '"SF Mono", "Fira Code", monospace',
      "--font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif',
      "--font-size": "15px",
    },
  },
  light: {
    name: "Light",
    description: "Clean light theme",
    variables: {
      "--bg": "#f5f5f5",
      "--bg-secondary": "#ffffff",
      "--text": "#1a1a1a",
      "--text-muted": "#6b7280",
      "--accent": "#0284c7",
      "--accent-hover": "#0ea5e9",
      "--border": "#e5e7eb",
      "--focus-bg": "rgba(2, 132, 199, 0.08)",
      "--font-mono": '"SF Mono", "Fira Code", monospace',
      "--font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif',
      "--font-size": "15px",
    },
  },
};

export function loadTheme(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES[stored]) return stored;
  } catch (e) {
    console.warn("Failed to load theme:", e);
  }
  return DEFAULT_THEME;
}

export function saveTheme(themeId: string): void {
  try {
    if (!THEMES[themeId]) return;
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch (e) {
    console.error("Failed to save theme:", e);
  }
}

export function applyTheme(themeId: string): void {
  const theme = THEMES[themeId];
  if (!theme) return;

  const root = document.documentElement;
  Object.entries(theme.variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  document.body.className = document.body.className
    .split(" ")
    .filter((cls) => !cls.startsWith("theme-"))
    .join(" ") + ` theme-${themeId}`;

  saveTheme(themeId);
}

export function getCurrentTheme(): string {
  return loadTheme();
}

export function getThemeInfo(themeId: string): ThemeDefinition | null {
  return THEMES[themeId] ?? null;
}

export function getAllThemes(): Record<string, ThemeDefinition> {
  return THEMES;
}

export function initializeTheme(): string {
  const themeId = loadTheme();
  applyTheme(themeId);
  return themeId;
}
