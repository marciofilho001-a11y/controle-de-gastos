import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export const EASE = [0.23, 1, 0.32, 1] as const

// Moldura padrão dos blocos do Dashboard: título com ícone verde à esquerda, ação à direita
export function Painel({
  icon: Icon, titulo, sub, acao, children, className, index: _index = 0, id,
}: {
  icon?: React.ComponentType<{ className?: string }>
  titulo: React.ReactNode
  sub?: React.ReactNode
  acao?: React.ReactNode
  children: React.ReactNode
  className?: string
  index?: number
  id?: string
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: EASE }}
      className={cn("painel flex min-w-0 flex-col rounded-2xl border bg-card p-5", className)}
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <Icon className="size-[18px] shrink-0 text-primary" />}
          <div className="min-w-0">
            <h3 className="font-ui text-[15px] leading-tight font-semibold tracking-tight">{titulo}</h3>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
        {acao && <div className="ml-auto flex items-center gap-2">{acao}</div>}
      </div>
      {children}
    </motion.section>
  )
}

// Botão de link discreto no canto ("Ver todos →")
export function LinkAcao({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="flex items-center gap-1 rounded-md text-xs font-medium text-primary transition-colors hover:text-primary/80"
    >
      {children}
    </button>
  )
}
