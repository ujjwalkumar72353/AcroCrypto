import { createContext, useContext, useEffect, useMemo, useState } from "react";

const PreferencesContext = createContext(null);

const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export function PreferencesProvider({ children }) {
  const [currency, setCurrency] = useState(() =>
    read("acro.currency", "inr") === "usd" ? "usd" : "inr"
  );
  const [theme, setTheme] = useState(() => read("acro.theme", "dark"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("acro.theme", theme);
      localStorage.setItem("acro.currency", currency);
    } catch {}
  }, [theme, currency]);

  const value = useMemo(
    () => ({ currency, setCurrency, theme, setTheme }),
    [currency, theme]
  );
  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => useContext(PreferencesContext);
