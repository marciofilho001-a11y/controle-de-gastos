import { motion } from "motion/react"
import { ClipboardCheck, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CheckFechamento } from "@/lib/checklist-fechamento"
import { cn } from "@/lib/utils"
import { Painel, EASE } from "./painel"

// Resumo do checklist de fechamento (a lista completa fica na aba Fechamento)
export function ChecklistResumo({ checks, onVerTodos, index }: { checks: CheckFechamento[]; onVerTodos: () => void; index?: number }) {
  const feitos = checks.filter((c) => c.ok).length
  const pct = checks.length ? (feitos / checks.length) * 100 : 0
  const metade = Math.ceil(checks.length / 2)
  const colunas = [checks.slice(0, metade), checks.slice(metade)]
  return (
    <Painel
      icon={ClipboardCheck} index={index}
      titulo="Checklist de fechamento"
      sub={
        <span className="flex items-center gap-3">
          <span className="tnum">{feitos} / {checks.length} concluídos</span>
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary sm:w-48">
            <motion.span className="block h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.35, ease: EASE }} />
          </span>
        </span>
      }
      acao={<Button size="sm" variant="outline" className="h-8 text-xs" onClick={onVerTodos}>Ver todos</Button>}
    >
      <div className="grid gap-x-6 sm:grid-cols-2">
        {colunas.map((col, ci) => (
          <div key={ci} className={cn("flex flex-col", ci === 1 && "sm:border-l sm:pl-6")}>
            {col.map((c) => (
              <button
                key={c.id} type="button" onClick={onVerTodos} title={c.detalhe}
                className="flex items-center gap-3 border-b border-border/60 py-2.5 text-left text-sm last:border-b-0 hover:text-foreground"
              >
                {c.ok ? (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" strokeWidth={3} /></span>
                ) : (
                  <span className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                )}
                <span className={cn("min-w-0 flex-1 truncate", c.ok ? "text-foreground" : "text-muted-foreground")}>{c.titulo}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Painel>
  )
}
