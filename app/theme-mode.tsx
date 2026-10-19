import { DesignSystemProvider, type ThemeMode, tokens } from "@wildchild/design-system";
import type { CSSProperties } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const COOKIE_KEY = "ntm_theme_mode";

type ThemeModeContextValue = { mode: ThemeMode; setMode: (mode: ThemeMode) => void };

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

/** Reads the theme mode cookie so the server renders the chosen mode. */
export function readThemeCookie(cookieHeader: string | null): ThemeMode | null {
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_KEY}=`))
    ?.slice(COOKIE_KEY.length + 1);
  return value === "light" || value === "dark" ? value : null;
}

/**
 * A few of the design system's semantic colours as CSS variables, for app styles
 * written in CSS (editor boxes) rather than through components.
 */
function surfaceVariables(mode: ThemeMode): CSSProperties {
  const color = tokens.semantic.default[mode].color;
  return {
    "--ds-surface-lowest": color.surfaceContainerLowest,
    "--ds-outline-variant": color.outlineVariant,
    "--ds-primary": color.primary,
    "--ds-warning": color.warning,
    "--ds-warning-container": color.warningContainer,
  } as CSSProperties;
}

export function AppThemeProvider({ children, initialMode }: { children: React.ReactNode; initialMode: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    document.cookie = `${COOKIE_KEY}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <DesignSystemProvider mode={mode}>
        <div className="theme-vars" style={surfaceVariables(mode)}>
          {children}
        </div>
      </DesignSystemProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  if (!context) throw new Error("useThemeMode must be used within AppThemeProvider.");
  return context;
}
