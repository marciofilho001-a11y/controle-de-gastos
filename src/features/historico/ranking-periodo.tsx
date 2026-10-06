import { motion } from "motion/react"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LedPanel, LedIcon } from "./led-panel"
import { fmtPct } from "./categorias-tempo"


export type ItemRanking = { k: string; total: number; media: number; pct: number }

export function RankingPeriodo({
  ranking, catSel, onCatSel,
}: { ranking: ItemRanking[]; catSel: string | null; onCatSel: (k: string | null) => void }) {
  const itens = ranking.slice(0, 10)
  const max = itens[0]?.total || 1
  return (
    <LedPanel tone="violet" className="flex h-full flex-col gap-4 p-5">
      <div>
        <h3 className="font-display text-base font-semibold leading-tight tracking-[-0.015em]">No que mais gastei</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Ranking das categorias no período · toque pra destacar no gráfico</p>
      </div>

      <div className="-mx-2 flex flex-1 flex-col">
        {itens.map((r, i) => {
          const I = catInfo(r.k).icon; const cor = catColor(r.k)
          const ativo = catSel === r.k
          const semCategoria = r.k === "fatura_indefinida"
          return (
            <button
              key={r.k}
              onClick={() => onCatSel(ativo ? null : r.k)}
              aria-pressed={ativo}
              className={cn("led-row flex items-center gap-3 px-2 py-2.5 text-left transition-[opacity,background-color] hover:bg-secondary/50",
                ativo && "bg-secondary/70", catSel && !ativo && "opacity-50")}
            >
              <span className="tnum w-4 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <LedIcon icon={I} cor={cor} size={34} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium leading-tight", semCategoria && "text-muted-foreground")}>
                  {catInfo(r.k).l}
                  {semCategoria && <span className="ml-1.5 text-xs font-normal">· sem categoria ainda</span>}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: cor }}
                    initial={{ width: 0 }} animate={{ width: `${Math.max((r.total / max) * 100, 2)}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  />
                </div>
              </div>
              <div className="w-24 shrink-0 text-right leading-tight">
                <p className="tnum text-sm font-semibold">{fmtR(r.total)}</p>
                <p className="tnum mt-0.5 text-xs text-muted-foreground">{fmtPct(r.pct)}</p>
              </div>
            </button>
          )
        })}
        {itens.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">Sem despesas no período</p>}
      </div>
    </LedPanel>
  )
}
