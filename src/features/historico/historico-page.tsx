import { useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  ComposedChart, Bar, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts"
import { BarChart3, Trophy, ThumbsDown, Wallet, Receipt, Sigma, ArrowUpRight, ArrowDownRight } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { PageHeader, SectionTitle } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto, addMonths } from "@/lib/format"
import { receitasDoMes, despesasComContasDoMes, despesasExibicaoDoMes } from "@/lib/selectors"
import {
  useChartColors, fmtAxis, axisProps, gridProps, cursorProps, ChartTooltip, ChartLegend, CHART_ANIM,
} from "@/lib/chart-theme"
import { cn } from "@/lib/utils"
import { CategoriasTempo, type LinhaStack, type Panorama } from "./categorias-tempo"
import { RankingPeriodo } from "./ranking-periodo"

const RANGES = [{ label: "6m", v: 6 }, { label: "12m", v: 12 }, { label: "24m", v: 24 }, { label: "Tudo", v: 0 }]
const EASE = [0.23, 1, 0.32, 1] as const

// Evolução mês a mês: receitas x despesas x sobra, categorias ao longo do tempo,
// ranking do período e sobra acumulada. Só meses com lançamento; nada estimado.
export function HistoricoPage({ mesRef }: { mesRef: string }) {
  const { transacoes, obrigacoes } = useFinData()
  const c = useChartColors()
  const [range, setRange] = useState(12)
  const [catSel, setCatSel] = useState<string | null>(null)

  const d = useMemo(() => {
    const todos = [...new Set(transacoes.map((t) => t.mes_ref))].filter((m) => m <= mesRef).sort()
    const meses = (range > 0 ? todos.slice(-range) : todos)
    const lista = meses.length ? meses : [mesRef]

    // por mês: receita, despesa, sobra, categorias
    const porMes = lista.map((m) => {
      const receita = receitasDoMes(transacoes, m)
      // mesma conta do Dashboard/Fechamento (contas fixas a pagar entram no mês)
      const despesa = despesasComContasDoMes(obrigacoes, transacoes, m)
      const cats = new Map<string, number>()
      // "Cartão" (fatura paga de uma vez, sem itens) não é categoria de gasto: junta com "Faturas a detalhar"
      for (const t of despesasExibicaoDoMes(transacoes, m)) {
        const k = !t.categoria ? "outro" : t.categoria === "cartao" ? "fatura_indefinida" : t.categoria
        cats.set(k, (cats.get(k) || 0) + Number(t.valor))
      }
      return { m, receita, despesa, sobra: receita - despesa, cats }
    })

    // ranking de categorias no período
    const totalCat = new Map<string, number>()
    for (const pm of porMes) for (const [k, v] of pm.cats) totalCat.set(k, (totalCat.get(k) || 0) + v)
    const totalDesp = porMes.reduce((s, x) => s + x.despesa, 0)
    const totalCats = [...totalCat.values()].reduce((s, v) => s + v, 0)
    const ranking = [...totalCat.entries()].map(([k, v]) => ({
      k, total: v, media: v / porMes.length, pct: totalCats > 0 ? (v / totalCats) * 100 : 0,
      serie: porMes.map((pm) => pm.cats.get(k) || 0),
    })).sort((a, b) => b.total - a.total)
    const top = ranking.slice(0, 6).map((r) => r.k)

    const stack = porMes.map((pm) => {
      const row = { mes: fmtMesCurto(pm.m), total: 0 } as LinhaStack
      let outros = 0
      for (const [k, v] of pm.cats) (top.includes(k) ? (row[k] = Math.round(v)) : (outros += v))
      if (outros > 0) row.__outros = Math.round(outros)
      row.total = [...pm.cats.values()].reduce((s, v) => s + v, 0)
      return row
    })

    // panorama do período (tudo dos dados reais) + comparação com o período anterior de mesmo tamanho
    const somaCats = (m: string) => despesasExibicaoDoMes(transacoes, m).reduce((s, t) => s + Number(t.valor), 0)
    const nJan = porMes.length
    const ate = todos.length - (range > 0 ? nJan : 0)
    const prev = range > 0 ? todos.slice(Math.max(0, ate - nJan), ate) : []
    const prevTotal = prev.reduce((s, m) => s + somaCats(m), 0)
    const pctVs = (atual: number, antes: number) => (antes > 0 ? ((atual - antes) / antes) * 100 : null)
    const reais = ranking.filter((r) => r.k !== "fatura_indefinida")
    const base = reais.length ? reais : ranking
    const item = (r?: (typeof ranking)[number]) => (r ? { k: r.k, v: r.total, pct: r.pct } : null)
    const panorama: Panorama = {
      total: totalCats,
      media: totalCats / nJan,
      deltaTotal: prev.length === nJan ? pctVs(totalCats, prevTotal) : null,
      deltaMedia: prev.length > 0 ? pctVs(totalCats / nJan, prevTotal / prev.length) : null,
      maior: item(base[0]),
      menor: item(base[base.length - 1]),
    }

    let acc = 0
    const acumulado = porMes.map((pm) => ({ mes: fmtMesCurto(pm.m), Acumulado: Math.round(acc += pm.sobra) }))

    const n = porMes.length
    const mediaRec = porMes.reduce((s, x) => s + x.receita, 0) / n
    const mediaDesp = totalDesp / n
    const mediaSobra = mediaRec - mediaDesp
    const melhor = porMes.reduce((a, b) => (b.sobra > a.sobra ? b : a), porMes[0])
    const pior = porMes.reduce((a, b) => (b.sobra < a.sobra ? b : a), porMes[0])

    // tendência: média dos últimos 3 vs 3 anteriores
    const ult = porMes.slice(-3), ant = porMes.slice(-6, -3)
    const med = (arr: typeof porMes) => (arr.length ? arr.reduce((s, x) => s + x.despesa, 0) / arr.length : 0)
    const tend = ant.length ? ((med(ult) - med(ant)) / med(ant)) * 100 : null

    return {
      porMes, lista, ranking, top, stack, panorama, acumulado, mediaRec, mediaDesp, mediaSobra, melhor, pior, tend, totalDesp, n,
      grafico: porMes.map((pm) => ({ mes: fmtMesCurto(pm.m), Receitas: Math.round(pm.receita), Despesas: Math.round(pm.despesa), Saldo: Math.round(pm.sobra) })),
    }
  }, [transacoes, obrigacoes, mesRef, range])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Histórico"
        accent={d.n > 1 ? `${fmtMesCurto(d.lista[0])} a ${fmtMesCurto(d.lista[d.lista.length - 1])}` : fmtMesCurto(mesRef)}
        description={`${d.n} ${d.n === 1 ? "mês" : "meses"} com lançamentos. Tudo calculado dos seus dados reais, sem estimativa.`}
        actions={
          <div className="flex gap-0.5 rounded-lg border bg-secondary/50 p-0.5">
            {RANGES.map((r) => (
              <Button key={r.label} size="sm" variant={range === r.v ? "default" : "ghost"} className="h-8 px-3 text-xs" onClick={() => setRange(r.v)}>{r.label}</Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receita média / mês" value={d.mediaRec} icon={Wallet} tone="teal" index={0} spark={d.porMes.map((x) => x.receita)} />
        <StatCard
          label="Despesa média / mês" value={d.mediaDesp} icon={Receipt} tone="danger" index={1} spark={d.porMes.map((x) => x.despesa)}
          trend={d.tend != null ? (
            <span className={cn("flex items-center gap-1", d.tend > 0 ? "text-destructive" : "text-success")}>
              {d.tend > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(d.tend).toFixed(0)}% últimos 3 meses vs 3 anteriores
            </span>
          ) : undefined}
        />
        <StatCard label="Saldo médio / mês" value={d.mediaSobra} icon={Sigma} tone={d.mediaSobra >= 0 ? "teal" : "warning"} index={2} valueClassName={d.mediaSobra < 0 ? "text-destructive" : undefined} spark={d.porMes.map((x) => x.sobra)} />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16, ease: EASE }} className="flex flex-col justify-between gap-2 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[0.8rem] text-muted-foreground"><Trophy className="size-3.5 text-success" /> Melhor mês</span>
            <span className="text-sm font-semibold">{fmtMesCurto(d.melhor.m)} <span className="tnum text-success">{fmtR(d.melhor.sobra)}</span></span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[0.8rem] text-muted-foreground"><ThumbsDown className="size-3.5 text-destructive" /> Pior mês</span>
            <span className="text-sm font-semibold">{fmtMesCurto(d.pior.m)} <span className="tnum text-destructive">{fmtR(d.pior.sobra)}</span></span>
          </div>
          <p className="text-xs text-muted-foreground">Total gasto no período: <span className="tnum font-semibold text-foreground">{fmtR(d.totalDesp)}</span></p>
        </motion.div>
      </div>

      {/* receitas x despesas + sobra */}
      <section>
        <SectionTitle icon={BarChart3} right={<ChartLegend items={[{ color: c.receita, label: "Receitas" }, { color: c.despesa, label: "Despesas" }, { color: c.primary, label: "Saldo" }]} />}>
          Receitas, despesas e saldo
        </SectionTitle>
        <div className="rounded-2xl border bg-card p-5">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.grafico} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4} barCategoryGap="30%">
                <CartesianGrid vertical={false} {...gridProps(c)} />
                <XAxis dataKey="mes" {...axisProps(c)} />
                <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={72} />
                <Tooltip content={<ChartTooltip />} cursor={cursorProps(c)} />
                <Bar dataKey="Receitas" fill={c.receita} fillOpacity={0.85} radius={[6, 6, 2, 2]} maxBarSize={26} animationDuration={CHART_ANIM} />
                <Bar dataKey="Despesas" fill={c.despesa} fillOpacity={0.85} radius={[6, 6, 2, 2]} maxBarSize={26} animationDuration={CHART_ANIM} />
                <Line type="monotone" dataKey="Saldo" stroke={c.primary} strokeWidth={2.5} dot={{ r: 3.5, fill: c.card, strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={CHART_ANIM} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <CategoriasTempo
          stack={d.stack} top={d.top} temOutras={d.stack.some((r) => r.__outros)}
          catSel={catSel} onCatSel={setCatSel} range={range} onRange={setRange}
          panorama={d.panorama} nMeses={d.n}
        />
        <RankingPeriodo ranking={d.ranking} catSel={catSel} onCatSel={setCatSel} />
      </div>

      {/* sobra acumulada */}
      <section>
        <SectionTitle icon={Sigma}>Saldo acumulado no período</SectionTitle>
        <div className="rounded-xl border bg-card p-5">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.acumulado} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="hist-acc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.primary} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} {...gridProps(c)} />
                <XAxis dataKey="mes" {...axisProps(c)} />
                <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={72} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.grid }} />
                <Area type="monotone" dataKey="Acumulado" stroke={c.primary} strokeWidth={2.5} fill="url(#hist-acc)" animationDuration={CHART_ANIM} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Soma dos saldos mês a mês desde {fmtMesCurto(d.lista[0])}. Se a curva cai, o mês fechou no vermelho.
            {d.n > 1 && ` Projetando a média atual, em ${fmtMesCurto(addMonths(mesRef, 12))} você teria ${fmtR((d.acumulado.at(-1)?.Acumulado || 0) + d.mediaSobra * 12)} acumulados.`}
          </p>
        </div>
      </section>
    </div>
  )
}
