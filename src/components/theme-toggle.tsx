import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  // transição curta de cor ao trocar de tema (evita o "flash" de brilho)
  const trocar = () => {
    const html = document.documentElement
    html.classList.add("theme-fade")
    toggle()
    window.setTimeout(() => html.classList.remove("theme-fade"), 260)
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={trocar}
      aria-label={theme === "dark" ? "Mudar para claro" : "Mudar para escuro"}
      className="press relative size-9 overflow-hidden rounded-full"
    >
      <Sun className="size-[1.05rem] rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-[1.05rem] rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
