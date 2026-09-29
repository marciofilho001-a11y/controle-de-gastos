import { motion } from "motion/react"
import { TrendingUp } from "lucide-react"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LedPanel, LedIcon } from "./led-panel"
import { fmtPct } from "./categorias-tempo"

const EASE = [0.23, 1, 0.32, 1] as const

export type ItemRanking = { k: string; total: number; media: number; pct: number }

export function RankingPeriodo({
  ranking, catSel, onCatSel,
}: { ranking: ItemRanking[]; catSel: string | null; onCatSel: (k: string | null) => void }) {
  const itens = ranking.slice(0, 10)
  const max = itens[0]?.total || 1
  return (
    <LedPanel tone="violet" className="flex h-full flex-col gap-5 p-6">
      <div className="flex items-center gap-4">
        <LedIcon icon={TrendingUp} cor="#8b5cf6" size={56} />
        <div>
          <h3 className="font-ui text-[18px] font-semibold uppercase leading-tight tracking-[0.03em]">No que mais gastei no período</h3>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Ranking das categorias por valor gasto.</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
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
              className={cn("led-row flex items-center gap-4 px-4 py-3 text-left transition-[opacity,box-shadow,border-color]",
                catSel && !ativo && "opacity-55")}
              style={ativo ? { borderColor: `color-mix(in srgb, ${cor} 60%, transparent)`, boxShadow: `0 0 20px -5px ${cor}` } : undefined}
            >
              <span className="tnum grid size-10 shrink-0 place-items-center rounded-full border bg-black/10 text-[15px] font-medium dark:bg-black/30" style={{ letterSpacing: 0, fontFamily: "Inter, sans-serif" }}>{i + 1}</span>
              <LedIcon icon={I} cor={cor} size={50} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium leading-tight">{catInfo(r.k).l}</p>
                <div className="mt-2.5 h-[7px] overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: cor, boxShadow: `0 0 10px color-mix(in srgb, ${cor} 70%, transparent)` }}
                    initial={{ width: 0 }} animate={{ width: `${Math.max((r.total / max) * 100, 2)}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.04, ease: EASE }}
                  />
                </div>
              </div>
              <div className="w-[128px] shrink-0 text-right leading-tight">
                <p className="tnum text-[17px] font-bold">{fmtR(r.total)}</p>
                <p className="mt-1 text-[14.5px] text-muted-foreground">{fmtPct(r.pct)} do total</p>
              </div>
            </motion.button>
          )
        })}
        {itens.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">Sem despesas no período</p>}
      </div>
    </LedPanel>
  )
}
