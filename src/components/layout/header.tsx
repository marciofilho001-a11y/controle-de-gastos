import { Wallet } from "@/lib/icons"
import { MonthNav } from "@/components/layout/month-nav"
import { ThemeToggle } from "@/components/theme-toggle"

export function Header({
  mesRef,
  onMonthChange,
  titulo,
}: {
  mesRef: string
  onMonthChange: (delta: number) => void
  titulo?: string
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      {/* celular: logo; desktop: a barra lateral já tem o logo, aqui vai só a seção atual */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-primary text-primary-foreground md:hidden">
          <Wallet className="size-[1.1rem]" weight="fill" />
        </div>
        <h1 className="sr-only">{titulo}</h1>
      </div>
      <div className="flex items-center gap-1.5">
        <MonthNav mesRef={mesRef} onChange={onMonthChange} />
        <ThemeToggle />
      </div>
    </header>
  )
}
