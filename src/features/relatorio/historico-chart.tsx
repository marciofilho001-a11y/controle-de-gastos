import { useMemo, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionTitle } from "@/components/page-header"
import type { Transacao } from "@/lib/supabase"
import { fmtMesCurto } from "@/lib/format"
import { receitasDoMes, despesasDoMes } from "@/lib/selectors"
import {
  useChartColors, fmtAxis, axisProps, gridProps, cursorProps, ChartTooltip, ChartLegend, CHART_ANIM,
} from "@/lib/chart-theme"

const RANGES = [
  { label: "3m", v: 3 }, { label: "6m", v: 6 }, { label: "12m", v: 12 }, { label: "Tudo", v: 0 },
]

// Receitas x Despesas mês a mês (só meses com lançamento; sem estimativa)
export function HistoricoChart({ transacoes, mesRef }: { transacoes: Transacao[]; mesRef: string }) {
  const c = useChartColors()
  const [range, setRange] = useState(6)

  const data = useMemo(() => {
    const meses = [...new Set(transacoes.map((t) => t.mes_ref))].sort()
    const sel = range > 0 ? meses.slice(-range) : meses
    return (sel.length ? sel : [mesRef]).map((m) => ({
      mes: fmtMesCurto(m),
      Receitas: Math.round(receitasDoMes(transacoes, m)),
      Despesas: Math.round(despesasDoMes(transacoes, m)),
    }))
  }, [transacoes, mesRef, range])

  return (
    <section>
      <SectionTitle
        icon={BarChart3}
        right={
          <div className="flex gap-0.5 rounded-lg border bg-secondary/50 p-0.5">
            {RANGES.map((r) => (
              <Button
                key={r.label} size="sm" variant={range === r.v ? "default" : "ghost"}
                className="h-7 px-2.5 text-xs" onClick={() => setRange(r.v)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      >
        Histórico — Receitas x Despesas
      </SectionTitle>
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex justify-end">
          <ChartLegend items={[{ color: c.receita, label: "Receitas" }, { color: c.despesa, label: "Despesas" }]} />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={4} barCategoryGap="32%">
              <CartesianGrid vertical={false} {...gridProps(c)} />
              <XAxis dataKey="mes" {...axisProps(c)} />
              <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={70} />
              <Tooltip content={<ChartTooltip />} cursor={cursorProps(c)} />
              <Bar dataKey="Receitas" fill={c.receita} radius={[6, 6, 2, 2]} maxBarSize={34} animationDuration={CHART_ANIM} />
              <Bar dataKey="Despesas" fill={c.despesa} radius={[6, 6, 2, 2]} maxBarSize={34} animationDuration={CHART_ANIM} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
