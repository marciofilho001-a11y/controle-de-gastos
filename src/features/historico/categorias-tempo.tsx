import { useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LabelList,
  useYAxisScale, usePlotArea,
} from "recharts"
import {
  CalendarClock, BarChart3, Wallet, Trophy, TrendingDown, ArrowUp, ArrowDown, Check, ChartColumnStacked, ChartSpline,
} from "lucide-react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { CHART_ANIM } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"
import { LedPanel, LedCard, LedIcon } from "./led-panel"

const EASE = [0.23, 1, 0.32, 1] as const

export type LinhaStack = Record<string, number | string> & { mes: string; total: number }
export type Panorama = {
  total: number; media: number
  deltaTotal: number | null; deltaMedia: number | null
  maior: { k: string; v: number; pct: number } | null
  menor: { k: string; v: number; pct: number } | null
}

type Modelo = "barras" | "linhas"

const PERIODOS = [
  { v: "6", l: "Últimos 6 meses" }, { v: "12", l: "Últimos 12 meses" },
  { v: "24", l: "Últimos 24 meses" }, { v: "0", l: "Todo o período" },
]

const COR_TOTAL = "#5eead4"            // linha de total (ciano-menta do print)
const COR_TOTAL_LINHA = "#67e8f9"
const COR_OUTRAS = "#b6c0d0"
const corDe = (k: string) => (k === "__outros" ? COR_OUTRAS : catColor(k))
const nomeDe = (k: string) => (k === "__outros" ? "Outras" : catInfo(k).l)

const rs0 = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR")
export const fmtPct = (v: number) =>
  v >= 1 ? `${Math.round(v)}%` : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

// eixo Y "redondo" (R$ 0, 500, 1.000...) com folga em cima
function escalaY(max: number) {
  const alvo = Math.max(max, 1) * 1.1
  const passos = [100, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 250000]
  const passo = passos.find((s) => alvo / s <= 7) ?? 500000
  const teto = Math.max(passo * 2, Math.ceil(alvo / passo) * passo)
  const ticks: number[] = []
  for (let v = 0; v <= teto; v += passo) ticks.push(v)
  return { teto, ticks }
}
const fmtTick = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR")

// ---- barras ---------------------------------------------------------------
// segmento: cantos de cima arredondados só no último segmento visível + brilho na cor da categoria
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

// pílula de valor (total do mês / final da linha)
function Pilula({ x, y, txt, cor, ativo = false, alpha = 1, forte = false }: {
  x: number; y: number; txt: string; cor?: string; ativo?: boolean; alpha?: number; forte?: boolean
}) {
  const w = 16 + txt.length * 6.7
  const borda = cor ?? COR_TOTAL
  return (
    <g opacity={alpha} style={{ transition: "opacity .2s" }}>
      <rect
        x={x} y={y} width={w} height={23} rx={8}
        fill={forte && cor ? `color-mix(in srgb, ${cor} 14%, var(--card))` : "var(--card)"}
        stroke={borda} strokeOpacity={ativo ? 0.95 : forte ? 0.7 : 0.45} strokeWidth={1.2}
        style={{ filter: ativo ? `drop-shadow(0 0 8px ${borda})` : undefined }}
      />
      <text x={x + w / 2} y={y + 16} textAnchor="middle" fontSize={12.5} fontWeight={600} fill={forte && cor ? cor : "var(--foreground)"} style={{ fontFamily: "Inter, sans-serif" }}>
        {txt}
      </text>
    </g>
  )
}
const larg = (txt: string) => 16 + txt.length * 6.7

// rótulos à direita do fim de cada linha, sem se sobreporem
function FimLabels({ itens, n, padR }: { itens: { k: string; v: number }[]; n: number; padR: number }) {
  const escY = useYAxisScale()
  const area = usePlotArea()
  if (!escY || !area || !itens.length) return null
  const xUlt = n > 1 ? area.x + area.width - padR : area.x + area.width / 2
  const H = 24
  const pos = itens
    .map((i) => ({ ...i, y: Number(escY(i.v)) - H / 2 }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < pos.length; i++) if (pos[i].y - pos[i - 1].y < H) pos[i].y = pos[i - 1].y + H
  const fundo = area.y + area.height - H
  const excesso = pos.length ? pos[pos.length - 1].y - fundo : 0
  if (excesso > 0) for (const p of pos) p.y -= excesso
  return (
    <g>
      {pos.map((p) => (
        <Pilula key={p.k} x={xUlt + 14} y={p.y} txt={rs0(p.v)} cor={corDe(p.k)} forte />
      ))}
    </g>
  )
}

function TooltipCat({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const itens = payload
    .filter((p: any) => p.dataKey !== "total" && Number(p.value) > 0)
    .sort((a: any, b: any) => b.value - a.value)
  const total = Number(payload[0]?.payload?.total) || itens.reduce((s: number, p: any) => s + Number(p.value), 0)
  return (
    <div className="font-ui min-w-[200px] rounded-2xl border bg-popover/95 px-4 py-3 text-xs shadow-xl backdrop-blur"
      style={{ borderColor: "rgb(20 184 166 / .4)", boxShadow: "0 0 26px -6px rgb(20 184 166 / .45)" }}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold">{label}</p>
        <p className="tnum text-sm font-bold" style={{ color: COR_TOTAL }}>{fmtR(total)}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {itens.map((p: any) => {
          const cor = corDe(String(p.dataKey))
          return (
            <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor, boxShadow: `0 0 7px ${cor}` }} />
              <span className="flex-1">{p.name}</span>
              <span className="tnum font-medium text-foreground">{fmtR(Number(p.value))}</span>
              <span className="tnum w-10 text-right text-[0.68rem]">{total > 0 ? fmtPct((Number(p.value) / total) * 100) : ""}</span>
            </p>
          )
        })}
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
  const [modelo, setModelo] = useState<Modelo>("barras")
  const [hover, setHover] = useState<number | null>(null)
  const chaves = temOutras ? [...top, "__outros"] : top
  const topoDe = (row: any) => { for (let i = chaves.length - 1; i >= 0; i--) if (Number(row?.[chaves[i]]) > 0) return chaves[i]; return null }
  const { teto, ticks } = useMemo(() => escalaY(Math.max(0, ...stack.map((r) => Number(r.total)))), [stack])
  const dados = useMemo(() => stack.map((r) => { const o: any = { ...r }; for (const k of chaves) o[k] = Number(r[k]) || 0; return o }), [stack, chaves.join("|")]) // eslint-disable-line react-hooks/exhaustive-deps
  const linhas = modelo === "linhas"
  const padR = 26
  const ultimo = stack[stack.length - 1]
  const esmaece = (k: string) => (catSel && catSel !== k ? 0.16 : 1)

  const tickFill = "color-mix(in srgb, var(--foreground) 82%, transparent)"
  const eixo = { tick: { fill: tickFill, fontSize: 12.5, style: { fontFamily: "Inter, sans-serif" } }, tickLine: false as const }
  const linhaEixo = "rgb(20 184 166 / .35)"

  return (
    <LedPanel tone="teal" className="flex flex-col gap-5 p-6">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center gap-4">
        <LedIcon icon={CalendarClock} cor="#6b70ff" size={56} />
        <div className="min-w-0 flex-1 basis-[260px]">
          <h3 className="font-ui text-[18px] font-semibold uppercase leading-tight tracking-[0.03em]">Categorias ao longo do tempo</h3>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Evolução dos seus gastos por categoria nos últimos {nMeses > 1 ? `${nMeses} meses` : "meses"}.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Select value={String(range)} onValueChange={(v) => onRange(Number(v))}>
            <SelectTrigger className="font-ui h-11 w-[190px] rounded-full bg-transparent px-4 text-[14.5px] [&_svg]:!text-[#2dd4bf] [&_svg]:!opacity-100" style={{ borderColor: "rgb(20 184 166 / .5)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>{PERIODOS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* legenda clicável */}
      <div className="flex items-center gap-3 rounded-2xl border bg-black/10 py-2 pl-2 pr-2.5 dark:bg-black/25" style={{ borderColor: "rgb(20 184 166 / .22)" }}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-0.5 gap-y-0.5">
        {linhas && (
          <span className="flex items-center gap-2 px-2.5 py-1 text-[13.5px] text-foreground/85">
            <span className="size-3 rounded-full" style={{ background: COR_TOTAL_LINHA, boxShadow: `0 0 9px ${COR_TOTAL_LINHA}` }} /> Total
          </span>
        )}
        {chaves.map((k) => {
          const cor = corDe(k); const ativo = catSel === k
          return (
            <button
              key={k}
              disabled={k === "__outros"}
              onClick={() => onCatSel(ativo ? null : k)}
              aria-pressed={ativo}
              className={cn("flex items-center gap-2 rounded-full px-2.5 py-1 text-[13.5px] text-foreground/85 transition-all hover:text-foreground disabled:cursor-default",
                catSel && !ativo && "opacity-45")}
              style={ativo ? { background: `color-mix(in srgb, ${cor} 20%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 55%, transparent), 0 0 14px -3px ${cor}` } : undefined}
            >
              <span className="size-3 rounded-full" style={{ background: cor, boxShadow: `0 0 9px color-mix(in srgb, ${cor} 80%, transparent)` }} />
              {nomeDe(k)}
            </button>
          )
        })}
      </div>
        <div role="group" aria-label="Modelo do gráfico" className="flex shrink-0 items-center gap-0.5 rounded-full border p-0.5" style={{ borderColor: "rgb(20 184 166 / .35)" }}>
            {([["barras", "Barras", ChartColumnStacked], ["linhas", "Linhas", ChartSpline]] as const).map(([v, l, I]) => (
              <button
                key={v} onClick={() => setModelo(v)} aria-pressed={modelo === v}
                className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium transition-all",
                  modelo === v ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                style={modelo === v ? { background: "rgb(20 184 166 / .2)", boxShadow: "inset 0 0 0 1px rgb(20 184 166 / .6), 0 0 14px -3px rgb(20 184 166 / .6)" } : undefined}
              >
                <I className="size-4" /> {l}
              </button>
            ))}
          </div>
      </div>

      {/* gráfico */}
      <div className="relative min-h-[340px] flex-1">
        <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={dados}
            margin={{ top: 38, right: linhas ? 100 : 10, bottom: 0, left: 0 }}
            barCategoryGap="28%"
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
              {chaves.map((k) => (
                <linearGradient key={`l${k}`} id={`lg-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={corDe(k)} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={corDe(k)} stopOpacity={0} />
                </linearGradient>
              ))}
              <linearGradient id="lg-total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR_TOTAL_LINHA} stopOpacity={0.32} />
                <stop offset="100%" stopColor={COR_TOTAL_LINHA} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgb(148 163 184 / .16)" strokeDasharray="3 6" vertical={linhas} />
            <XAxis
              dataKey="mes" {...eixo} axisLine={{ stroke: linhaEixo }} tickMargin={10}
              padding={linhas ? { left: 30, right: padR } : undefined}
            />
            <YAxis
              {...eixo} axisLine={{ stroke: linhaEixo }} tickFormatter={fmtTick} width={76}
              domain={[0, teto]} ticks={ticks} interval={0}
            />
            <Tooltip
              content={<TooltipCat />}
              cursor={linhas
                ? { stroke: COR_TOTAL_LINHA, strokeOpacity: 0.4, strokeDasharray: "4 4" }
                : { fill: "rgb(20 184 166)", opacity: 0.07, radius: 10 }}
            />

            {!linhas && chaves.map((k) => (
              <Bar
                key={k} dataKey={k} name={nomeDe(k)} stackId="a"
                fill={`url(#hg-${k})`} maxBarSize={64} animationDuration={CHART_ANIM}
                shape={(p: any) => (
                  <Seg {...p} cor={corDe(k)} topo={topoDe(p.payload) === k}
                    opacidade={catSel && catSel !== k ? 0.16 : hover != null && p.index !== hover ? 0.5 : 1} />
                )}
              />
            ))}

            {linhas && <Area dataKey="total" type="monotone" stroke="none" fill="url(#lg-total)" tooltipType="none" legendType="none" activeDot={false} animationDuration={CHART_ANIM} />}
            {linhas && chaves.map((k) => (
              <Area key={`a${k}`} dataKey={k} type="monotone" stroke="none" fill={`url(#lg-${k})`} opacity={esmaece(k)}
                tooltipType="none" legendType="none" activeDot={false} animationDuration={CHART_ANIM} />
            ))}
            {linhas && chaves.map((k) => (
              <Line
                key={k} dataKey={k} name={nomeDe(k)} type="monotone" stroke={corDe(k)} strokeWidth={2.4}
                strokeOpacity={esmaece(k)} legendType="none" animationDuration={CHART_ANIM}
                style={{ filter: `drop-shadow(0 0 5px color-mix(in srgb, ${corDe(k)} 55%, transparent))` }}
                dot={(p: any) => (
                  <circle key={`${k}-${p.index}`} cx={p.cx} cy={p.cy} r={4.2} fill={corDe(k)} stroke="rgba(255,255,255,.92)" strokeWidth={1.6}
                    opacity={esmaece(k)} style={{ filter: `drop-shadow(0 0 5px ${corDe(k)})` }} />
                )}
                activeDot={{ r: 6.5, fill: corDe(k), stroke: "#fff", strokeWidth: 2 }}
              />
            ))}

            {/* total do mês: linha ciano no modo linhas; âncora invisível no modo barras */}
            <Line
              dataKey="total" name="Total" type="monotone"
              stroke={linhas ? COR_TOTAL_LINHA : "none"} strokeWidth={linhas ? 2.6 : 0} legendType="none" tooltipType="none"
              animationDuration={CHART_ANIM}
              style={linhas ? { filter: `drop-shadow(0 0 6px ${COR_TOTAL_LINHA})` } : undefined}
              dot={linhas ? (p: any) => (
                <circle key={`t-${p.index}`} cx={p.cx} cy={p.cy} r={5} fill={COR_TOTAL_LINHA} stroke="#fff" strokeWidth={2}
                  style={{ filter: `drop-shadow(0 0 7px ${COR_TOTAL_LINHA})` }} />
              ) : false}
              activeDot={linhas ? { r: 7, fill: COR_TOTAL_LINHA, stroke: "#fff", strokeWidth: 2 } : false}
            >
              <LabelList
                dataKey="total"
                content={(p: any) => {
                  const row = stack[p.index]
                  if (!row) return null
                  const txt = rs0(Number(row.total))
                  const ativo = hover === p.index
                  return (
                    <Pilula
                      x={Number(p.x) - larg(txt) / 2} y={Number(p.y) - (linhas ? 40 : 34)} txt={txt} ativo={ativo}
                      alpha={hover != null && !ativo ? 0.55 : 1}
                    />
                  )
                }}
              />
            </Line>

            {linhas && ultimo && (
              <FimLabels
                n={stack.length} padR={padR}
                itens={chaves.filter((k) => Number(ultimo[k]) > 0).map((k) => ({ k, v: Number(ultimo[k]) }))}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* panorama do período — números reais */}
      <div className="grid grid-cols-2 gap-3.5 2xl:grid-cols-4">
        <CardPanorama
          icon={BarChart3} cor="#6b70ff" titulo="Total no período" valor={fmtR(panorama.total)}
          rodape={<Delta pct={panorama.deltaTotal} />} delay={0}
        />
        <CardPanorama
          icon={Wallet} cor="#22c55e" titulo="Média mensal" valor={fmtR(panorama.media)}
          rodape={<Delta pct={panorama.deltaMedia} />} delay={0.05}
        />
        <CardPanorama
          icon={Trophy} cor="#6b70ff" titulo="Maior gasto"
          destaque={panorama.maior ? catInfo(panorama.maior.k).l : "—"} valor={panorama.maior ? fmtR(panorama.maior.v) : "—"}
          rodape={panorama.maior ? <span className="text-[14px] text-muted-foreground">{fmtPct(panorama.maior.pct)} do total</span> : null} delay={0.1}
        />
        <CardPanorama
          icon={TrendingDown} cor="#22d3ee" titulo="Menor gasto"
          destaque={panorama.menor ? catInfo(panorama.menor.k).l : "—"} valor={panorama.menor ? fmtR(panorama.menor.v) : "—"}
          rodape={panorama.menor ? <span className="text-[14px] text-muted-foreground">{fmtPct(panorama.menor.pct)} do total</span> : null} delay={0.15}
        />
      </div>
    </LedPanel>
  )
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-[13.5px] leading-snug text-muted-foreground">sem período anterior</span>
  const subiu = pct > 0.05, caiu = pct < -0.05
  // gasto que sobe é ruim (vermelho); gasto que cai é bom (verde)
  const cls = subiu ? "text-destructive" : caiu ? "text-success" : "text-muted-foreground"
  return (
    <span className="flex items-center gap-1.5 text-[14px]">
      <span className={cn("flex items-center gap-0.5 font-semibold", cls)}>
        {subiu ? <ArrowUp className="size-4" /> : caiu ? <ArrowDown className="size-4" /> : <Check className="size-4" />}
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
      <LedCard cor={cor} className="flex h-full min-h-[190px] flex-col gap-3 p-5">
        <LedIcon icon={icon} cor={cor} size={50} />
        <div className="leading-tight">
          <p className="text-[14.5px] text-muted-foreground">{titulo}</p>
          {destaque && <p className="mt-1.5 truncate text-[21px] font-semibold tracking-[-0.01em]">{destaque}</p>}
          <p className={cn("whitespace-nowrap font-bold tracking-[-0.015em]", destaque ? "mt-1 text-[22px]" : "mt-1.5 text-[25px]", valor.length > 12 ? "!text-[19px]" : valor.length > 10 && "!text-[21.5px]")}>{valor}</p>
        </div>
        <div className="mt-auto pt-2">{rodape}</div>
      </LedCard>
    </motion.div>
  )
}
