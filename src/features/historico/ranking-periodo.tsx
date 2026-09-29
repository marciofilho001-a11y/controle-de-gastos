import { motion } from "motion/react"
import { TrendingUp } from "lucide-react"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LedPanel, LedIcon } from "./led-panel"

const EASE = [0.23, 1, 0.32, 1] as const

export type ItemRanking = { k: string; total: number; media: number; pct: number }

export function RankingPeriodo({
  ranking, catSel, onCatSel,
}: { ranking: ItemRanking[]; catSel: string | null; onCatSel: (k: string | null) => void }) {
  const itens = ranking.slice(0, 10)
  const max = itens[0]?.total || 1
  return (
    <LedPanel className="flex h-full flex-col gap-4 p-5" cor="#8b5cf6" forte>
      <div className="flex items-center gap-3">
        <LedIcon icon={TrendingUp} cor="#8b5cf6" size={44} />
        <div>
          <h3 className="font-display text-base font-bold uppercase tracking-wide">No que mais gastei no período</h3>
          <p className="text-xs text-muted-foreground">Ranking das categorias por valor gasto.</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {itens.map((r, i) => {
          const I = catInfo(r.k).icon; const cor = catColor(r.k)
          const ativo = catSel === r.k
          return (
            <motion.button
              key={r.k}
              onClick={() => onCatSel(ativo ? null : r.k)}
              aria-pressed={ativo}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.035, ease: EASE }}
              whileHover={{ x: 2 }}
              className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                ativo ? "bg-secondary/60" : "bg-background/30 hover:bg-secondary/40",
                catSel && !ativo && "opacity-60")}
              style={{ borderColor: ativo ? `color-mix(in srgb, ${cor} 60%, transparent)` : "color-mix(in srgb, var(--border) 80%, transparent)", boxShadow: ativo ? `0 0 18px -4px color-mix(in srgb, ${cor} 55%, transparent)` : undefined }}
            >
              <span className="tnum grid size-7 shrink-0 place-items-center rounded-full border bg-background/50 text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <LedIcon icon={I} cor={cor} size={38} redondo />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{catInfo(r.k).l}</p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--foreground) 9%, transparent)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${cor} 65%, transparent), ${cor})`, boxShadow: `0 0 10px color-mix(in srgb, ${cor} 80%, transparent)` }}
                    initial={{ width: 0 }} animate={{ width: `${Math.max((r.total / max) * 100, 2)}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.04, ease: EASE }}
                  />
                </div>
              </div>
              <div className="w-[142px] shrink-0 text-right leading-tight">
                <p className="tnum text-sm font-bold">{fmtR(r.total)}</p>
                <p className="tnum mt-0.5 text-[0.7rem] text-muted-foreground">{fmtR(r.media)}/mês • {r.pct.toFixed(0)}%</p>
              </div>
            </motion.button>
          )
        })}
        {itens.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">Sem despesas no período</p>}
      </div>
    </LedPanel>
  )
}
