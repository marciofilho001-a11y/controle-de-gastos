import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"
type ThemeContextValue = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = "finflow-theme"

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark"
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === "dark" || stored === "light") return stored
  return "dark" // padrão do FinFlow
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitial)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    root.style.colorScheme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value: ThemeContextValue = {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme deve estar dentro de ThemeProvider")
  return ctx
}
