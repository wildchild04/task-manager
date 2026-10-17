import { DesignSystemProvider, type ThemeMode } from "@wildchild/design-system";
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

export function AppThemeProvider({ children, initialMode }: { children: React.ReactNode; initialMode: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    document.cookie = `${COOKIE_KEY}=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <DesignSystemProvider mode={mode}>{children}</DesignSystemProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  if (!context) throw new Error("useThemeMode must be used within AppThemeProvider.");
  return context;
}
