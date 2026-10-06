import { motion } from "motion/react"
import { Wallet, Plus } from "@/lib/icons"
import { TABS, type TabId } from "@/components/layout/nav"
import { useChatUI } from "@/features/chat/chat-assistente"
import { cn } from "@/lib/utils"

// Barra lateral do desktop: seções agrupadas (como nos apps grandes) + lançamento rápido no rodapé
const GRUPOS: { titulo: string; ids: TabId[] }[] = [
  { titulo: "Principal", ids: ["dashboard", "transacoes", "cartoes", "obrigacoes"] },
  { titulo: "Análise", ids: ["projecao", "historico", "relatorio"] },
  { titulo: "Gestão", ids: ["fechamento"] },
]
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const

export const SIDEBAR_W = 232

export function Sidebar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const abrirChat = useChatUI((s) => s.setAberto)
  return (
    <aside
      className="sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar md:flex"
      style={{ width: SIDEBAR_W }}
      aria-label="Navegação"
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-primary text-primary-foreground">
          <Wallet className="size-[1.1rem]" weight="fill" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-[-0.02em]">FinFlow <span className="text-primary">Pro</span></p>
          <p className="text-[0.68rem] text-muted-foreground">Controle financeiro pessoal</p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pt-2">
        {GRUPOS.map((g) => (
          <div key={g.titulo}>
            <p className="mb-1 px-3 text-[0.68rem] font-semibold tracking-wide text-muted-foreground/80 uppercase">{g.titulo}</p>
            <div className="flex flex-col gap-0.5">
              {g.ids.map((id) => {
                const t = TABS.find((x) => x.id === id)!
                const Icon = t.icon
                const isActive = active === id
                return (
                  <button
                    key={id}
                    onClick={() => onChange(id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "press relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {isActive && <motion.span layoutId="sidebar-pill" transition={SPRING} className="absolute inset-0 rounded-lg bg-sidebar-accent" />}
                    <Icon className={cn("relative size-[1.1rem]", isActive && "text-primary")} weight={isActive ? "fill" : "regular"} />
                    <span className="relative">{id === "dashboard" ? "Início" : t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3">
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-2 text-[0.68rem] font-semibold tracking-wide text-muted-foreground/80 uppercase">Lançamento rápido</p>
          <button
            onClick={() => abrirChat(true)}
            className="press flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" weight="bold" /> Lançar despesa
          </button>
        </div>
      </div>
    </aside>
  )
}
