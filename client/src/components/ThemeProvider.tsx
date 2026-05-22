import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; toggle: () => void }>({
  theme: "dark",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    // Brand default is dark; logged-in preference loads from API below.
    return "dark";
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    if (theme === "light") document.documentElement.classList.add("light");
  }, [theme]);

  // Load theme from backend on mount (if user is logged in)
  useEffect(() => {
    apiRequest("GET", "/api/auth/me").then(r => r.json()).then(data => {
      if (data?.user?.theme) {
        setTheme(data.user.theme);
      }
    }).catch(() => {});
  }, []);

  const applyTheme = (next: Theme) => {
    setTheme(next);
    apiRequest("PATCH", "/api/auth/theme", { theme: next }).catch(() => {});
  };

  const toggle = () => applyTheme(theme === "dark" ? "light" : "dark");

  return <ThemeContext.Provider value={{ theme, setTheme: applyTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
