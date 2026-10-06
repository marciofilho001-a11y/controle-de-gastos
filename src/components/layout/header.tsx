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
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-primary text-primary-foreground">
          <Wallet className="size-[1.1rem]" />
        </div>
        <div className="hidden leading-tight sm:block">
          <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">
            FinFlow <span className="text-primary">Pro</span>
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <MonthNav mesRef={mesRef} onChange={onMonthChange} />
        <ThemeToggle />
      </div>
    </header>
  )
}
