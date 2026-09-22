import { useEffect, useState } from "react"
import { fmtR } from "@/lib/format"

// ---------------------------------------------------------------------------
// Tema único dos gráficos. Todas as cores vêm dos tokens do tema (dark/light)
// e são resolvidas em runtime, pra poderem ser usadas em gradientes, alpha etc.
// Semântica fixa em todo o app:
//   receita  -> success (verde)      despesa/obrigação -> destructive (vermelho)
//   sobra/patrimônio -> primary (teal)
//   previsto -> series-previsto (azul)  real -> series-real (rosa)  [só no comparativo]
// ---------------------------------------------------------------------------

const VARS = {
  previsto: "--series-previsto",
  real: "--series-real",
  receita: "--success",
  despesa: "--destructive",
  primary: "--primary",
  warning: "--warning",
  grid: "--border",
  text: "--muted-foreground",
  fg: "--foreground",
  card: "--card",
  muted: "--muted",
} as const

export type ChartColors = Record<keyof typeof VARS, string>

const FALLBACK: ChartColors = {
  previsto: "#5b8def", real: "#ec6fa3", receita: "#22c55e", despesa: "#ef4444",
  primary: "#14b8a6", warning: "#f59e0b", grid: "#2a2f3a", text: "#8b93a7",
  fg: "#e5e7eb", card: "#12151c", muted: "#1c2029",
}

function read(): ChartColors {
  if (typeof window === "undefined") return FALLBACK
  const cs = getComputedStyle(document.documentElement)
  const out = { ...FALLBACK }
  for (const k of Object.keys(VARS) as (keyof typeof VARS)[]) {
    const v = cs.getPropertyValue(VARS[k]).trim()
    if (v) out[k] = v
  }
  return out
}

// Reage à troca de tema (classe dark/light no <html>)
export function useChartColors(): ChartColors {
  const [c, setC] = useState<ChartColors>(read)
  useEffect(() => {
    setC(read())
    const obs = new MutationObserver(() => setC(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return c
}

// Eixo monetário curto com separador de milhar: R$ 1.500
export const fmtAxis = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR")

export const CHART_ANIM = 600

// props padrão de eixo (sem linha, sem tick, texto discreto)
export const axisProps = (c: ChartColors) => ({
  tick: { fill: c.text, fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
})

export const gridProps = (c: ChartColors) => ({
  stroke: c.grid,
  strokeDasharray: "3 6",
})

export const cursorProps = (c: ChartColors) => ({ fill: c.muted, opacity: 0.45 })

// Tooltip único (título = eixo X, uma linha por série)
export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label != null && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}:{" "}
          <span className="tnum font-medium text-foreground">{fmtR(Number(p.value))}</span>
        </p>
      ))}
    </div>
  )
}

// Legenda inline (bolinha + rótulo) usada acima dos gráficos
export function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
