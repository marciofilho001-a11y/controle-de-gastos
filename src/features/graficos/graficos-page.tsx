import { useMemo, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell,
} from "recharts"
import { PieChart as PieIcon, BarChart3, Shapes } from "lucide-react"
import { CategoryDonut, type DonutSlice } from "@/features/dashboard/category-donut"
import { Button } from "@/components/ui/button"
import { useFinData } from "@/hooks/use-fin-data"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtMesCurto, fmtMesLongo } from "@/lib/format"
import {
  txDoMes, receitasDoMes, despesasDoMes, obrigacoesAtivasNoMes,
  obrigacaoPagaNoMes, totalCartoesNoMes,
} from "@/lib/selectors"
import { cn } from "@/lib/utils"

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tnum font-medium text-foreground">{fmtR(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

const RANGES = [
  { label: "3m", v: 3 }, { label: "6m", v: 6 }, { label: "12m", v: 12 }, { label: "Tudo", v: 0 },
]

export function GraficosPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes } = useFinData()
  const [range, setRange] = useState(6)

  const dados = useMemo(() => {
    const despesasMes = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "despesa")
    const porCat = new Map<string, number>()
    for (const t of despesasMes) {
      const k = t.categoria || "outro"
      porCat.set(k, (porCat.get(k) || 0) + Number(t.valor))
    }
    const donutDespesas: DonutSlice[] = [...porCat.entries()]
      .map(([catKey, value]) => ({ catKey, label: catInfo(catKey).l, value }))
      .sort((a, b) => b.value - a.value)
    const totalDespesas = despesasDoMes(transacoes, mesRef)

    // composição da renda
    const receita = receitasDoMes(transacoes, mesRef)
    const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
    const obrPagas =
      ativas.filter((o) => obrigacaoPagaNoMes(transacoes, o.id, mesRef)).reduce((s, o) => s + Number(o.valor), 0) +
      totalCartoesNoMes(cartoes, transacoes, mesRef)
    const gastosLivres = Math.max(0, totalDespesas - obrPagas)
    const sobra = Math.max(0, receita - totalDespesas)
    const composicao: DonutSlice[] = [
      { catKey: "obrigacoes-fixas", label: "Obrigações fixas", value: obrPagas },
      { catKey: "gastos-livres", label: "Gastos livres", value: gastosLivres },
      { catKey: "sobra", label: "Sobra", value: sobra },
    ].filter((s) => s.value > 0)

    // histórico receitas x despesas
    const todosMeses = [...new Set(transacoes.map((t) => t.mes_ref))].sort()
    const mesesRange = range > 0 ? todosMeses.slice(-range) : todosMeses
    const hist = (mesesRange.length ? mesesRange : [mesRef]).map((m) => ({
      mes: fmtMesCurto(m),
      Receitas: Math.round(receitasDoMes(transacoes, m)),
      Despesas: Math.round(despesasDoMes(transacoes, m)),
    }))

    // obrigações por categoria (barras horizontais)
    const obrPorCat = new Map<string, number>()
    for (const o of ativas) {
      const k = o.categoria || "outro"
      obrPorCat.set(k, (obrPorCat.get(k) || 0) + Number(o.valor))
    }
    const barrasObr = [...obrPorCat.entries()]
      .map(([catKey, value]) => ({ catKey, label: catInfo(catKey).l, value }))
      .sort((a, b) => b.value - a.value)

    return { donutDespesas, totalDespesas, receita, composicao, hist, barrasObr }
  }, [obrigacoes, cartoes, transacoes, mesRef, range])

  const compositionColors: Record<string, string> = {
    "obrigacoes-fixas": "var(--series-real)",
    "gastos-livres": "var(--warning)",
    "sobra": "var(--primary)",
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-semibold">
        Análise Gráfica <span className="text-primary">— {fmtMesLongo(mesRef)}</span>
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <PieIcon className="size-3.5" /> Despesas por Categoria
          </div>
          <CategoryDonut slices={dados.donutDespesas} centerLabel="Total de gastos" centerValue={dados.totalDespesas} />
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <PieIcon className="size-3.5" /> Composição da Renda
          </div>
          <CompositionDonut slices={dados.composicao} total={dados.receita} colors={compositionColors} />
        </div>
      </div>

      {/* Histórico receitas x despesas */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="size-3.5" /> Histórico: Receitas x Despesas
          </div>
          <div className="flex gap-1 rounded-lg border bg-secondary/50 p-0.5">
            {RANGES.map((r) => (
              <Button
                key={r.label} size="sm" variant={range === r.v ? "default" : "ghost"}
                className="h-7 px-2.5 text-xs" onClick={() => setRange(r.v)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados.hist} margin={{ top: 8, right: 8, bottom: 8, left: 8 }} barGap={4}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => "R$" + v} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Receitas" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={38} />
              <Bar dataKey="Despesas" fill="var(--series-real)" radius={[5, 5, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Obrigações por categoria */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Shapes className="size-3.5" /> Obrigações por Categoria
        </div>
        {dados.barrasObr.length === 0 ? (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">Sem obrigações ativas neste mês</div>
        ) : (
          <div style={{ height: Math.max(180, dados.barrasObr.length * 56) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.barrasObr} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 90 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(v) => "R$" + v} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={84} tick={{ fill: "var(--foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                <Bar dataKey="value" name="Total" radius={5} barSize={22}>
                  {dados.barrasObr.map((b) => (
                    <Cell key={b.catKey} fill={catColor(b.catKey)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

// donut de composição com cores próprias (não por categoria)
function CompositionDonut({
  slices, total, colors,
}: {
  slices: DonutSlice[]
  total: number
  colors: Record<string, string>
}) {
  if (!slices.length) {
    return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Sem dados</div>
  }
  return (
    <div className="relative h-64">
      <DonutSvg slices={slices} colors={colors} total={total} />
    </div>
  )
}

import { PieChart, Pie, Cell as PieCell, Tooltip as PieTooltip } from "recharts"
function DonutSvg({ slices, colors, total }: { slices: DonutSlice[]; colors: Record<string, string>; total: number }) {
  return (
    <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
            {slices.map((s) => (
              <PieCell key={s.catKey} fill={colors[s.catKey] || "var(--muted-foreground)"} />
            ))}
          </Pie>
          <PieTooltip content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null
            const p = payload[0]
            return (
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.payload.fill }} /><span className="font-medium">{p.payload.label}</span></p>
                <p className="tnum mt-0.5 text-muted-foreground">{fmtR(p.value)}</p>
              </div>
            )
          }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Total do mês</p>
          <p className={cn("tnum mt-0.5 text-lg font-semibold")}>{fmtR(total)}</p>
        </div>
      </div>
    </div>
  )
}
