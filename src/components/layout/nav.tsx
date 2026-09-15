import {
  LayoutDashboard,
  ListChecks,
  CreditCard,
  ArrowLeftRight,
  TrendingUp,
  BarChart3,
  Landmark,
  Gauge,
  FileText,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type TabId =
  | "dashboard" | "obrigacoes" | "cartoes" | "transacoes"
  | "projecao" | "graficos" | "investimentos" | "limites" | "relatorio"

export const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "obrigacoes", label: "Obrigações", icon: ListChecks },
  { id: "cartoes", label: "Cartões", icon: CreditCard },
  { id: "transacoes", label: "Transações", icon: ArrowLeftRight },
  { id: "projecao", label: "Projeção", icon: TrendingUp },
  { id: "graficos", label: "Gráficos", icon: BarChart3 },
  { id: "investimentos", label: "Investimentos", icon: Landmark },
  { id: "limites", label: "Limites", icon: Gauge },
  { id: "relatorio", label: "Relatório", icon: FileText },
]

export function NavBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto rounded-xl border bg-card/60 p-1.5 backdrop-blur">
      {TABS.map((t) => {
        const Icon = t.icon
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150",
              isActive
                ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/25"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-4" />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
