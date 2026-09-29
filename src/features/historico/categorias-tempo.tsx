import { useState } from "react"
import { motion } from "motion/react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList,
} from "recharts"
import { CalendarClock, BarChart3, Wallet, Trophy, TrendingDown, ArrowUp, ArrowDown, Check } from "lucide-react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { useChartColors, fmtAxis, axisProps, gridProps, CHART_ANIM } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"
import { LedPanel, LedIcon } from "./led-panel"

const EASE = [0.23, 1, 0.32, 1] as const

export type LinhaStack = Record<string, number | string> & { mes: string; total: number }
export type Panorama = {
  total: number; media: number
  deltaTotal: number | null; deltaMedia: number | null
  maior: { k: string; v: number; pct: number } | null
  menor: { k: string; v: number; pct: number } | null
}

const PERIODOS = [
  { v: "6", l: "Últimos 6 meses" }, { v: "12", l: "Últimos 12 meses" },
  { v: "24", l: "Últimos 24 meses" }, { v: "0", l: "Todo o período" },
]

const rs0 = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR")

// segmento da barra: cantos de cima arredondados só no último segmento visível + brilho na cor da categoria
function Seg({ x, y, width, height, fill, cor, topo, opacidade }: any) {
  if (!height || height <= 0.5) return null
  const r = topo ? Math.min(9, width / 2, height) : 0
  const d = `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
  return (
    <path
      d={d} fill={fill} stroke="var(--card)" strokeWidth={1.25} opacity={opacidade}
      style={{ filter: `drop-shadow(0 0 7px color-mix(in srgb, ${cor} 55%, transparent))`, transition: "opacity .2s" }}
    />
  )
}

function TooltipEmpilhado({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const itens = payload.filter((p: any) => p.dataKey !== "total" && Number(p.value) > 0).sort((a: any, b: any) => b.value - a.value)
  const total = Number(payload[0]?.payload?.total) || itens.reduce((s: number, p: any) => s + Number(p.value), 0)
  return (
    <div className="min-w-[190px] rounded-xl border bg-popover/95 px-3.5 py-3 text-xs shadow-xl backdrop-blur"
      style={{ boxShadow: "0 0 24px -6px color-mix(in srgb, var(--primary) 40%, transparent)" }}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="font-display text-sm font-semibold">{label}</p>
        <p className="tnum font-bold" style={{ color: "var(--primary)" }}>{fmtR(total)}</p>
      </div>
      <div className="flex flex-col gap-1">
        {itens.map((p: any) => (
          <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 shrink-0 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
            <span className="flex-1">{p.name}</span>
            <span className="tnum font-medium text-foreground">{fmtR(Number(p.value))}</span>
            <span className="tnum w-9 text-right text-[0.68rem]">{total > 0 ? Math.round((Number(p.value) / total) * 100) : 0}%</span>
          </p>
        ))}
      </div>
    </div>
  )
}

export function CategoriasTempo({
  stack, top, temOutras, catSel, onCatSel, range, onRange, panorama, nMeses,
}: {
  stack: LinhaStack[]
  top: string[]
  temOutras: boolean
  catSel: string | null
  onCatSel: (k: string | null) => void
  range: number
  onRange: (v: number) => void
  panorama: Panorama
  nMeses: number
}) {
  const c = useChartColors()
  const [hover, setHover] = useState<number | null>(null)
  const chaves = temOutras ? [...top, "__outros"] : top
  const corDe = (k: string) => (k === "__outros" ? "#94a3b8" : catColor(k))
  const topoDe = (row: any) => { for (let i = chaves.length - 1; i >= 0; i--) if (Number(row?.[chaves[i]]) > 0) return chaves[i]; return null }

  return (
    <LedPanel className="flex flex-col gap-4 p-5" forte>
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center gap-3">
        <LedIcon icon={CalendarClock} cor="#6366f1" size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold uppercase tracking-wide">Categorias ao longo do tempo</h3>
          <p className="text-xs text-muted-foreground">Evolução dos seus gastos por categoria nos {nMeses > 1 ? `últimos ${nMeses} meses` : "meses com lançamento"}.</p>
        </div>
        <Select value={String(range)} onValueChange={(v) => onRange(Number(v))}>
          <SelectTrigger className="h-9 w-[180px] border-primary/30 bg-background/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>{PERIODOS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* legenda clicável */}
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border bg-background/30 p-1.5">
        {chaves.map((k) => {
          const cor = corDe(k); const ativo = catSel === k
          const nome = k === "__outros" ? "Outras" : catInfo(k).l
          return (
            <button
              key={k}
              disabled={k === "__outros"}
              onClick={() => onCatSel(ativo ? null : k)}
              aria-pressed={ativo}
              className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                catSel && !ativo && "opacity-50")}
              style={ativo ? { background: `color-mix(in srgb, ${cor} 22%, transparent)`, boxShadow: `0 0 0 1px color-mix(in srgb, ${cor} 55%, transparent), 0 0 14px -2px color-mix(in srgb, ${cor} 55%, transparent)` } : undefined}
            >
              <span className="size-2.5 rounded-full" style={{ background: cor, boxShadow: `0 0 8px ${cor}` }} />
              {nome}
            </button>
          )
        })}
      </div>

      {/* gráfico */}
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={stack} margin={{ top: 30, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%"
            onMouseMove={(s: any) => setHover(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              {chaves.map((k) => (
                <linearGradient key={k} id={`hg-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={corDe(k)} stopOpacity={1} />
                  <stop offset="100%" stopColor={corDe(k)} stopOpacity={0.62} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} {...gridProps(c)} />
            <XAxis dataKey="mes" {...axisProps(c)} />
            <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={76} domain={[0, (mx: number) => Math.max(500, Math.ceil((mx * 1.12) / 500) * 500)]} />
            <Tooltip content={<TooltipEmpilhado />} cursor={{ fill: "var(--primary)", opacity: 0.07, radius: 10 }} />
            {chaves.map((k) => (
              <Bar
                key={k} dataKey={k} name={k === "__outros" ? "Outras" : catInfo(k).l} stackId="a"
                fill={`url(#hg-${k})`} maxBarSize={64} animationDuration={CHART_ANIM}
                shape={(p: any) => {
                  const dimHover = hover != null && p.index !== hover
                  const dimCat = catSel && catSel !== k
                  return <Seg {...p} cor={corDe(k)} topo={topoDe(p.payload) === k} opacidade={dimCat ? 0.16 : dimHover ? 0.5 : 1} />
                }}
              />
            ))}
            {/* linha invisível só pra ancorar o total no topo de cada pilha */}
            <Line dataKey="total" stroke="none" dot={false} activeDot={false} legendType="none" tooltipType="none" animationDuration={CHART_ANIM}>
              <LabelList
                dataKey="total"
                content={(p: any) => {
                  const row = stack[p.index]
                  if (!row) return null
                  const txt = rs0(Number(row.total))
                  const w = 14 + txt.length * 6.4
                  const cx = Number(p.x)
                  const ativo = hover === p.index
                  return (
                    <g opacity={hover != null && !ativo ? 0.55 : 1} style={{ transition: "opacity .2s" }}>
                      <rect x={cx - w / 2} y={Number(p.y) - 30} width={w} height={22} rx={11}
                        fill="var(--card)" stroke="var(--primary)" strokeOpacity={ativo ? 0.95 : 0.45}
                        style={{ filter: ativo ? "drop-shadow(0 0 8px color-mix(in srgb, var(--primary) 65%, transparent))" : undefined }} />
                      <text x={cx} y={Number(p.y) - 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--foreground)">{txt}</text>
                    </g>
                  )
                }}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* panorama do período — números reais */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CardPanorama
          icon={BarChart3} cor="#6366f1" titulo="Total no período" valor={fmtR(panorama.total)}
          rodape={<Delta pct={panorama.deltaTotal} />} delay={0}
        />
        <CardPanorama
          icon={Wallet} cor="#10b981" titulo="Média mensal" valor={fmtR(panorama.media)}
          rodape={<Delta pct={panorama.deltaMedia} />} delay={0.05}
        />
        <CardPanorama
          icon={Trophy} cor={panorama.maior ? catColor(panorama.maior.k) : "#a855f7"} titulo="Maior gasto"
          destaque={panorama.maior ? catInfo(panorama.maior.k).l : "—"} valor={panorama.maior ? fmtR(panorama.maior.v) : "—"}
          rodape={panorama.maior ? <span className="text-xs text-muted-foreground">{panorama.maior.pct.toFixed(0)}% do total</span> : null} delay={0.1}
        />
        <CardPanorama
          icon={TrendingDown} cor={panorama.menor ? catColor(panorama.menor.k) : "#0ea5e9"} titulo="Menor gasto"
          destaque={panorama.menor ? catInfo(panorama.menor.k).l : "—"} valor={panorama.menor ? fmtR(panorama.menor.v) : "—"}
          rodape={panorama.menor ? <span className="text-xs text-muted-foreground">{panorama.menor.pct.toFixed(1)}% do total</span> : null} delay={0.15}
        />
      </div>
    </LedPanel>
  )
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">sem período anterior</span>
  const subiu = pct > 0.05, caiu = pct < -0.05
  // gasto que sobe é ruim (vermelho); gasto que cai é bom (verde)
  const cls = subiu ? "text-destructive" : caiu ? "text-success" : "text-muted-foreground"
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className={cn("flex items-center gap-0.5 font-semibold", cls)}>
        {subiu ? <ArrowUp className="size-3.5" /> : caiu ? <ArrowDown className="size-3.5" /> : <Check className="size-3.5" />}
        {Math.abs(pct).toFixed(0)}%
      </span>
      <span className="text-muted-foreground">vs. período anterior</span>
    </span>
  )
}

function CardPanorama({
  icon, cor, titulo, destaque, valor, rodape, delay,
}: {
  icon: React.ComponentType<{ className?: string }>; cor: string; titulo: string; destaque?: string; valor: string; rodape?: React.ReactNode; delay: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay, ease: EASE }}>
      <LedPanel cor={cor} className="flex h-full flex-col gap-2.5 p-4">
        <LedIcon icon={icon} cor={cor} size={38} redondo />
        <div className="leading-tight">
          <p className="text-xs text-muted-foreground">{titulo}</p>
          {destaque && <p className="mt-1 truncate font-display text-base font-semibold">{destaque}</p>}
          <p className={cn("tnum font-display font-bold tracking-tight", destaque ? "text-lg" : "mt-1 text-xl")}>{valor}</p>
        </div>
        <div className="mt-auto">{rodape}</div>
      </LedPanel>
    </motion.div>
  )
}
