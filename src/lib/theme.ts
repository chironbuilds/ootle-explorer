export type Theme = "dark" | "light";

const STORAGE_KEY = "veil-theme";

/** Applies the theme to <html> so the CSS-variable overrides in index.css take effect. */
function apply(theme: Theme) {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/** Reads the persisted preference, defaulting to dark (the brand's native look). */
export function initialTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Sets the preference and applies it immediately. */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / storage disabled -- still apply for this session.
  }
  apply(theme);
}

// Applied once at module load so a reload with a saved light preference never flashes dark
// before React mounts.
apply(initialTheme());
