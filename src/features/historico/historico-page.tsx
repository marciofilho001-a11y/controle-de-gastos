import { useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  ComposedChart, Bar, Line, Area, AreaChart, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts"
import { BarChart3, Layers, TrendingUp, Trophy, ThumbsDown, Wallet, Receipt, Sigma, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader, SectionTitle } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { useFinData } from "@/hooks/use-fin-data"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtMesCurto, addMonths } from "@/lib/format"
import { receitasDoMes, despesasDoMes, despesasExibicaoDoMes } from "@/lib/selectors"
import {
  useChartColors, fmtAxis, axisProps, gridProps, cursorProps, ChartTooltip, ChartLegend, CHART_ANIM,
} from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

const RANGES = [{ label: "6m", v: 6 }, { label: "12m", v: 12 }, { label: "24m", v: 24 }, { label: "Tudo", v: 0 }]
const EASE = [0.23, 1, 0.32, 1] as const

// Evolução mês a mês: receitas x despesas x sobra, categorias ao longo do tempo,
// ranking do período e sobra acumulada. Só meses com lançamento; nada estimado.
export function HistoricoPage({ mesRef }: { mesRef: string }) {
  const { transacoes } = useFinData()
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
      const despesa = despesasDoMes(transacoes, m)
      const cats = new Map<string, number>()
      for (const t of despesasExibicaoDoMes(transacoes, m)) cats.set(t.categoria || "outro", (cats.get(t.categoria || "outro") || 0) + Number(t.valor))
      return { m, receita, despesa, sobra: receita - despesa, cats }
    })

    // ranking de categorias no período
    const totalCat = new Map<string, number>()
    for (const pm of porMes) for (const [k, v] of pm.cats) totalCat.set(k, (totalCat.get(k) || 0) + v)
    const totalDesp = porMes.reduce((s, x) => s + x.despesa, 0)
    const ranking = [...totalCat.entries()].map(([k, v]) => ({
      k, total: v, media: v / porMes.length, pct: totalDesp > 0 ? (v / totalDesp) * 100 : 0,
      serie: porMes.map((pm) => pm.cats.get(k) || 0),
    })).sort((a, b) => b.total - a.total)
    const top = ranking.slice(0, 6).map((r) => r.k)

    const stack = porMes.map((pm) => {
      const row: Record<string, number | string> = { mes: fmtMesCurto(pm.m) }
      let outros = 0
      for (const [k, v] of pm.cats) (top.includes(k) ? (row[k] = Math.round(v)) : (outros += v))
      if (outros > 0) row.__outros = Math.round(outros)
      return row
    })

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
      porMes, lista, ranking, top, stack, acumulado, mediaRec, mediaDesp, mediaSobra, melhor, pior, tend, totalDesp, n,
      grafico: porMes.map((pm) => ({ mes: fmtMesCurto(pm.m), Receitas: Math.round(pm.receita), Despesas: Math.round(pm.despesa), Sobra: Math.round(pm.sobra) })),
    }
  }, [transacoes, mesRef, range])

  const serieSel = catSel ? d.ranking.find((r) => r.k === catSel) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Histórico e evolução"
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
        <StatCard label="Sobra média / mês" value={d.mediaSobra} icon={Sigma} tone={d.mediaSobra >= 0 ? "teal" : "warning"} index={2} valueClassName={d.mediaSobra >= 0 ? "text-success" : "text-destructive"} spark={d.porMes.map((x) => x.sobra)} />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15, ease: EASE }} className="flex flex-col justify-between gap-2 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground"><Trophy className="size-3.5 text-success" /> Melhor mês</span>
            <span className="text-sm font-semibold">{fmtMesCurto(d.melhor.m)} <span className="tnum text-success">{fmtR(d.melhor.sobra)}</span></span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground"><ThumbsDown className="size-3.5 text-destructive" /> Pior mês</span>
            <span className="text-sm font-semibold">{fmtMesCurto(d.pior.m)} <span className="tnum text-destructive">{fmtR(d.pior.sobra)}</span></span>
          </div>
          <p className="text-xs text-muted-foreground">Total gasto no período: <span className="tnum font-semibold text-foreground">{fmtR(d.totalDesp)}</span></p>
        </motion.div>
      </div>

      {/* receitas x despesas + sobra */}
      <section>
        <SectionTitle icon={BarChart3} right={<ChartLegend items={[{ color: c.receita, label: "Receitas" }, { color: c.despesa, label: "Despesas" }, { color: c.primary, label: "Sobra" }]} />}>
          Receitas x Despesas x Sobra
        </SectionTitle>
        <div className="rounded-xl border bg-card p-5">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={d.grafico} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4} barCategoryGap="30%">
                <CartesianGrid vertical={false} {...gridProps(c)} />
                <XAxis dataKey="mes" {...axisProps(c)} />
                <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={72} />
                <Tooltip content={<ChartTooltip />} cursor={cursorProps(c)} />
                <Bar dataKey="Receitas" fill={c.receita} radius={[6, 6, 2, 2]} maxBarSize={30} animationDuration={CHART_ANIM} />
                <Bar dataKey="Despesas" fill={c.despesa} radius={[6, 6, 2, 2]} maxBarSize={30} animationDuration={CHART_ANIM} />
                <Line type="monotone" dataKey="Sobra" stroke={c.primary} strokeWidth={2.5} dot={{ r: 3.5, fill: c.card, strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={CHART_ANIM} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* categorias ao longo do tempo */}
        <section>
          <SectionTitle icon={Layers}>Categorias ao longo do tempo</SectionTitle>
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {d.top.map((k) => (
                <button
                  key={k} onClick={() => setCatSel(catSel === k ? null : k)} aria-pressed={catSel === k}
                  className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", catSel === k ? "border-transparent text-white" : "text-muted-foreground hover:text-foreground")}
                  style={catSel === k ? { background: catColor(k) } : undefined}
                >
                  <span className="size-2 rounded-full" style={{ background: catColor(k) }} /> {catInfo(k).l}
                </button>
              ))}
              {d.stack.some((r) => r.__outros) && <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-muted-foreground/50" /> Outras</span>}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.stack} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} {...gridProps(c)} />
                  <XAxis dataKey="mes" {...axisProps(c)} />
                  <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={72} />
                  <Tooltip content={<ChartTooltip />} cursor={cursorProps(c)} />
                  {d.top.map((k, i) => (
                    <Bar
                      key={k} dataKey={k} name={catInfo(k).l} stackId="a" fill={catColor(k)}
                      fillOpacity={catSel && catSel !== k ? 0.18 : 1}
                      radius={i === d.top.length - 1 && !d.stack.some((r) => r.__outros) ? [6, 6, 0, 0] : 0}
                      maxBarSize={34} animationDuration={CHART_ANIM}
                    />
                  ))}
                  {d.stack.some((r) => r.__outros) && (
                    <Bar dataKey="__outros" name="Outras" stackId="a" fill={c.text} fillOpacity={catSel ? 0.18 : 0.5} radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={CHART_ANIM} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {serieSel && (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{catInfo(serieSel.k).l}</span>: {fmtR(serieSel.total)} no período · média {fmtR(serieSel.media)}/mês · {serieSel.pct.toFixed(0)}% das despesas
              </p>
            )}
          </div>
        </section>

        {/* ranking do período */}
        <section>
          <SectionTitle icon={TrendingUp}>No que mais gastei no período</SectionTitle>
          <div className="rounded-xl border bg-card p-2">
            <div className="flex flex-col">
              {d.ranking.slice(0, 10).map((r, i) => {
                const I = catInfo(r.k).icon; const cor = catColor(r.k)
                const max = d.ranking[0]?.total || 1
                return (
                  <motion.button
                    key={r.k} onClick={() => setCatSel(catSel === r.k ? null : r.k)}
                    initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, delay: i * 0.03, ease: EASE }}
                    className={cn("flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/50", catSel === r.k && "bg-secondary/70")}
                  >
                    <span className="tnum w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${cor}22`, color: cor }}><I className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{catInfo(r.k).l}</p>
                        <p className="tnum text-sm font-bold">{fmtR(r.total)}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <motion.div className="h-full rounded-full" style={{ background: cor }} initial={{ width: 0 }} animate={{ width: `${(r.total / max) * 100}%` }} transition={{ duration: 0.6, delay: 0.1 + i * 0.03, ease: EASE }} />
                        </div>
                        <span className="tnum w-32 shrink-0 text-right text-[0.7rem] text-muted-foreground">{fmtR(r.media)}/mês · {r.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
              {d.ranking.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Sem despesas no período</p>}
            </div>
          </div>
        </section>
      </div>

      {/* sobra acumulada */}
      <section>
        <SectionTitle icon={Sigma}>Sobra acumulada no período</SectionTitle>
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
            Soma das sobras mês a mês desde {fmtMesCurto(d.lista[0])}. Se a curva cai, o mês fechou no vermelho.
            {d.n > 1 && ` Projetando a média atual, em ${fmtMesCurto(addMonths(mesRef, 12))} você teria ${fmtR((d.acumulado.at(-1)?.Acumulado || 0) + d.mediaSobra * 12)} acumulados.`}
          </p>
        </div>
      </section>
    </div>
  )
}
