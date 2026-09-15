import { Wallet } from "lucide-react"
import { MonthNav } from "@/components/layout/month-nav"
import { ThemeToggle } from "@/components/theme-toggle"

export function Header({
  mesRef,
  onMonthChange,
}: {
  mesRef: string
  onMonthChange: (delta: number) => void
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
          <Wallet className="size-5" />
        </div>
        <div className="leading-tight">
          <h1 className="font-display text-xl font-semibold">
            FinFlow <span className="text-primary">Pro</span>
          </h1>
          <p className="text-xs text-muted-foreground">Controle financeiro pessoal</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MonthNav mesRef={mesRef} onChange={onMonthChange} />
        <ThemeToggle />
      </div>
    </header>
  )
}
