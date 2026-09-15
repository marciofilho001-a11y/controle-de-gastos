import { TrendingUp, Check, Minus, ChevronRight } from "lucide-react"
import { motion } from "motion/react"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { StatusPrevisto } from "@/lib/selectors"

export type CatLinha = {
  catKey: string
  label: string
  previsto: number
  origemPrevisto: string | null
  real: number
  diff: number
  st: StatusPrevisto
}

const pillStyles: Record<StatusPrevisto, string> = {
  ok: "bg-success/12 text-success",
  critico: "bg-destructive/12 text-destructive",
  vazio: "bg-muted text-muted-foreground",
}
const pillIcon = { ok: Check, critico: TrendingUp, vazio: Minus }
const pillText = { ok: "dentro do previsto", critico: "acima do previsto", vazio: "sem previsto" }

export function CatCard({ linha, index = 0 }: { linha: CatLinha; index?: number }) {
  const info = catInfo(linha.catKey)
  const Icon = info.icon
  const cor = catColor(linha.catKey)
  const PillIcon = pillIcon[linha.st]
  const pctBarra =
    linha.previsto > 0 ? Math.min(100, (linha.real / linha.previsto) * 100) : linha.real > 0 ? 100 : 0
  const barColor =
    linha.st === "critico" ? "var(--destructive)" : linha.st === "vazio" ? "var(--muted-foreground)" : "var(--success)"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col gap-3.5 rounded-xl border bg-card p-4.5"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${cor}1f`, color: cor, border: `1px solid ${cor}3a` }}
        >
          <Icon className="size-5" />
        </span>
        <span className="flex-1 truncate font-display text-[15px] font-semibold">{linha.label}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
            Previsto
          </span>
          <b className="tnum block text-base font-semibold">
            {linha.previsto > 0 ? fmtR(linha.previsto) : "—"}
          </b>
          {linha.origemPrevisto && (
            <span className="mt-1 inline-block rounded border bg-secondary px-1.5 py-px text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground">
              {linha.origemPrevisto}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
            Real
          </span>
          <b
            className={cn(
              "tnum block text-base font-semibold",
              linha.st === "critico" && "text-destructive",
              linha.st === "ok" && "text-success"
            )}
          >
            {fmtR(linha.real)}
          </b>
        </div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pctBarra}%` }}
          transition={{ duration: 0.5, delay: index * 0.04 + 0.1, ease: [0.2, 0, 0, 1] }}
        />
      </div>

      {/* pill de status — flex sem truncar: texto sempre completo */}
      <div className={cn("mt-auto flex items-center gap-1.5 rounded-[0.7rem] px-3 py-2 text-xs font-semibold", pillStyles[linha.st])}>
        <PillIcon className="size-3.5 shrink-0" />
        <span className="whitespace-nowrap">{pillText[linha.st]}</span>
        <span className="tnum ml-auto shrink-0 font-bold">
          {linha.previsto > 0 ? (linha.diff >= 0 ? "+" : "") + fmtR(linha.diff) : "—"}
        </span>
      </div>
    </motion.div>
  )
}
