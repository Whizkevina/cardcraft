import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    // Check system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    // Persist to backend if signed in
    apiRequest("PATCH", "/api/auth/theme", { theme: next }).catch(() => {});
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
