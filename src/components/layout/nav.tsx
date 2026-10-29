import { useState } from "react"
import { motion } from "motion/react"
import {
  LayoutDashboard, ListChecks, CreditCard, ArrowLeftRight, TrendingUp,
  FileText, CalendarCheck, History, MoreHorizontal, Inbox, Landmark, type LucideIcon,
} from "@/lib/icons"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFinData } from "@/hooks/use-fin-data"
import { contarParaRevisar } from "@/features/revisar/automatico"
import { cn } from "@/lib/utils"

export type TabId =
  | "dashboard" | "obrigacoes" | "cartoes" | "transacoes"
  | "projecao" | "fechamento" | "historico" | "relatorio" | "revisar" | "bancos"

export const TABS: { id: TabId; label: string; curto: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", curto: "Início", icon: LayoutDashboard },
  { id: "obrigacoes", label: "Obrigações", curto: "Obrigações", icon: ListChecks },
  { id: "cartoes", label: "Cartões", curto: "Cartões", icon: CreditCard },
  { id: "transacoes", label: "Transações", curto: "Transações", icon: ArrowLeftRight },
  { id: "revisar", label: "Revisar", curto: "Revisar", icon: Inbox },
  { id: "bancos", label: "Bancos", curto: "Bancos", icon: Landmark },
  { id: "projecao", label: "Projeção", curto: "Projeção", icon: TrendingUp },
  { id: "fechamento", label: "Fechamento", curto: "Fechamento", icon: CalendarCheck },
  { id: "historico", label: "Histórico", curto: "Histórico", icon: History },
  { id: "relatorio", label: "Relatório", curto: "Relatório", icon: FileText },
]

// mola criticamente amortecida (sem quique) — o indicador desliza até a aba tocada
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const

// Abas do desktop/tablet: segmentado com indicador que desliza
export function NavBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="scrollbar-none -mx-1 flex gap-0.5 overflow-x-auto px-1" aria-label="Seções">
      {TABS.map((t) => {
        const Icon = t.icon
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "press relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && (
              <motion.span layoutId="nav-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-secondary ring-1 ring-border" />
            )}
            <Icon className={cn("relative size-4", isActive && "text-primary")} weight={isActive ? "fill" : "regular"} />
            <span className="relative">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// Celular: barra inferior com as 4 seções mais usadas + "Mais"
const PRINCIPAIS: TabId[] = ["dashboard", "transacoes", "revisar", "cartoes"]

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const [menu, setMenu] = useState(false)
  const aRevisar = useFinData((s) => contarParaRevisar(s.extrato))
  const outras = TABS.filter((t) => !PRINCIPAIS.includes(t.id))
  const outraAtiva = outras.find((t) => t.id === active)
  return (
    <nav className="tab-bar fixed inset-x-0 bottom-0 z-40 md:hidden" aria-label="Seções">
      <div className="grid grid-cols-5 px-1 pt-1.5 pb-1">
        {PRINCIPAIS.map((id) => {
          const t = TABS.find((x) => x.id === id)!
          const Icon = t.icon
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={cn("press flex flex-col items-center gap-0.5 rounded-lg py-1 text-[0.68rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", isActive ? "text-primary" : "text-muted-foreground")}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative">
                <Icon className="size-[1.35rem]" weight={isActive ? "fill" : "regular"} />
                {id === "revisar" && aRevisar > 0 && (
                  <span className="tnum absolute -top-1 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.6rem] leading-4 font-bold text-primary-foreground ring-2 ring-background">{aRevisar > 99 ? "99+" : aRevisar}</span>
                )}
              </span>
              {t.curto}
            </button>
          )
        })}
        <DropdownMenu open={menu} onOpenChange={setMenu}>
          <DropdownMenuTrigger asChild>
            <button className={cn("press flex flex-col items-center gap-0.5 rounded-lg py-1 text-[0.68rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", outraAtiva ? "text-primary" : "text-muted-foreground")}>
              {outraAtiva ? <outraAtiva.icon className="size-[1.35rem]" weight="fill" /> : <MoreHorizontal className="size-[1.35rem]" />}
              {outraAtiva ? outraAtiva.curto : "Mais"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={10} className="min-w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
            {outras.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => onChange(t.id)} className={cn("gap-3 py-2.5", active === t.id && "text-primary")}>
                <t.icon className="size-4" /> {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
