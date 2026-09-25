import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts"
import {
  TrendingUp, Calendar, ListChecks, Layers, ArrowUp, Wallet, Lightbulb,
  ChevronRight, PartyPopper, Settings2, PiggyBank, CalendarCheck, CreditCard, Link as LinkIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { SectionTitle } from "@/components/page-header"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto, proximosMeses } from "@/lib/format"
import { calcularProjecaoMes, obrigacoesAtivasNoMes, faturaDoMes, parcelaNoMes } from "@/lib/selectors"
import {
  useChartColors, fmtAxis, axisProps, gridProps, ChartTooltip, ChartLegend, CHART_ANIM,
} from "@/lib/chart-theme"
import { cn } from "@/lib/utils"
import type { Obrigacao, Cartao, Transacao } from "@/lib/supabase"

const EASE = [0.23, 1, 0.32, 1] as const
// ritmo visual das linhas (decorativo, como na referência)
const ACENTOS = ["#22d3a5", "#38bdf8", "#a78bfa", "#f472b6", "#f87171", "#fbbf24"]

export function ProjecaoPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes, config, saveConfig } = useFinData()
  const c = useChartColors()
  const [horizonte, setHorizonte] = useState("12")
  const [aberto, setAberto] = useState<string | null>(null)

  const dados = useMemo(() => {
    const meses = proximosMeses(parseInt(horizonte), mesRef)
    return meses.map((m) => calcularProjecaoMes(obrigacoes, cartoes, transacoes, config, m))
  }, [obrigacoes, cartoes, transacoes, config, mesRef, horizonte])

  const resumo = useMemo(() => {
    const sobraTotal = dados.reduce((s, d) => s + d.sobra, 0)
    const sugestaoTotal = dados.reduce((s, d) => s + d.sugestao, 0)
    const noAzul = dados.filter((d) => d.sobra > 0).length
    const receitaTotal = dados.reduce((s, d) => s + d.receita, 0)
    const obrTotal = dados.reduce((s, d) => s + d.totalObr, 0)
    return { sobraTotal, sugestaoTotal, noAzul, receitaTotal, obrTotal, n: dados.length }
  }, [dados])

  const chartData = dados.map((d) => ({
    mes: fmtMesCurto(d.mesRef),
    Receita: Math.round(d.receita),
    Obrigações: Math.round(d.totalObr),
    Sobra: Math.round(d.sobra),
  }))

  return (
    <div className="flex flex-col gap-5">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <TrendingUp className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.01em]">Projeção Financeira</h2>
        </div>
        <p className="hidden text-sm text-muted-foreground lg:block">
          Receita, obrigações e sobra estimadas mês a mês a partir de {fmtMesCurto(mesRef)}.
        </p>
        <div className="ml-auto">
          <Select value={horizonte} onValueChange={setHorizonte}>
            <SelectTrigger className="h-10 w-[190px]">
              <Calendar className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="6">Próximos 6 meses</SelectItem>
                <SelectItem value="12">Próximos 12 meses</SelectItem>
                <SelectItem value="24">Próximos 24 meses</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* coluna lateral: resumo + parâmetros */}
        <div className="flex flex-col gap-3">
          <ResumoCard
            icon={Wallet} tone="teal" label={`Sobra acumulada (${resumo.n}m)`}
            valor={resumo.sobraTotal}
            sub={<span className={resumo.sobraTotal >= 0 ? "text-success" : "text-destructive"}>média {fmtR(resumo.sobraTotal / Math.max(1, resumo.n))}/mês</span>}
            index={0}
          />
          <ResumoCard
            icon={PiggyBank} tone="violet" label={`Sugestão p/ investir (${resumo.n}m)`}
            valor={resumo.sugestaoTotal}
            sub={<>{parseFloat(config.pct_investimento) || 0}% da sobra de cada mês</>}
            index={1}
          />
          <ResumoCard
            icon={CalendarCheck} tone="blue" label="Meses no azul"
            valorTexto={`${resumo.noAzul} / ${resumo.n}`}
            barra={resumo.n ? resumo.noAzul / resumo.n : 0}
            index={2}
          />

          <div className="rounded-xl border bg-card p-4">
            <SectionTitle icon={Settings2} className="mb-3">Parâmetros</SectionTitle>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-renda">Renda mensal projetada (R$)</Label>
                <Input
                  id="p-renda" type="number" step="0.01" defaultValue={config.renda_projetada ?? ""}
                  className="tnum" placeholder="0,00"
                  onBlur={(e) => saveConfig("renda_projetada", e.target.value)}
                />
                <span className="text-xs text-muted-foreground">Usada nos meses sem renda lançada</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-pct">% da sobra p/ investir</Label>
                <Input
                  id="p-pct" type="number" step="1" defaultValue={config.pct_investimento ?? "20"}
                  className="tnum" placeholder="20"
                  onBlur={(e) => saveConfig("pct_investimento", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* tabela principal */}
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-xl border bg-card p-2">
            <div className="min-w-[760px]">
              {/* cabeçalho da tabela */}
              <div className="grid grid-cols-[150px_1.1fr_1.3fr_1.3fr_1.3fr_1.3fr_32px] items-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground">
                <Head icon={Calendar}>Mês</Head>
                <Head icon={ListChecks}>Obrigações ativas</Head>
                <Head icon={Layers}>Total obrigações</Head>
                <Head icon={ArrowUp} cor={c.receita}>Receita</Head>
                <Head icon={Wallet} cor={c.primary}>Sobra</Head>
                <Head icon={Lightbulb} cor={c.previsto}>Sugestão investir</Head>
                <span />
              </div>

              <div className="flex flex-col gap-1.5">
                {dados.map((d, i) => {
                  const anteriorQtd = i > 0 ? dados[i - 1].qtdObr : d.qtdObr
                  const terminou = i > 0 && anteriorQtd > d.qtdObr
                  const cor = ACENTOS[i % ACENTOS.length]
                  const atual = i === 0
                  const expandido = aberto === d.mesRef
                  return (
                    <motion.div
                      key={d.mesRef}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(i * 0.025, 0.3), ease: EASE }}
                      className={cn(
                        "relative overflow-hidden rounded-lg border bg-background/40 transition-colors",
                        atual ? "border-primary/40 bg-primary/[0.06] shadow-[0_0_0_1px_var(--primary)_inset,0_0_18px_-6px_var(--primary)]" : "hover:border-primary/30",
                        expandido && "border-primary/30"
                      )}
                    >
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
                      <button
                        onClick={() => setAberto(expandido ? null : d.mesRef)}
                        className="grid w-full grid-cols-[150px_1.1fr_1.3fr_1.3fr_1.3fr_1.3fr_32px] items-center gap-2 px-3 py-2.5 pl-4 text-left"
                        aria-expanded={expandido}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                            <Calendar className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-display text-[15px] font-semibold leading-tight">
                              {fmtMesCurto(d.mesRef)}
                              {terminou && <PartyPopper className="size-3.5 text-primary" />}
                            </span>
                            <span className="block text-[0.7rem] leading-tight text-muted-foreground">{d.mesRef.slice(0, 4)}</span>
                          </span>
                        </span>
                        <span className="tnum text-base font-semibold">{d.qtdObr}</span>
                        <span className="tnum text-base font-semibold text-destructive">{fmtR(d.totalObr)}</span>
                        <span className="tnum text-base font-semibold text-success">
                          {fmtR(d.receita)}{d.estimado && <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">est.</span>}
                        </span>
                        <span className={cn("tnum text-base font-semibold", d.sobra >= 0 ? "text-primary" : "text-destructive")}>{fmtR(d.sobra)}</span>
                        <span className="tnum text-base font-semibold" style={{ color: c.previsto }}>{fmtR(d.sugestao)}</span>
                        <ChevronRight className={cn("size-4 justify-self-end text-muted-foreground transition-transform", expandido && "rotate-90")} />
                      </button>

                      <AnimatePresence initial={false}>
                        {expandido && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <DetalheMes mesRef={d.mesRef} obrigacoes={obrigacoes} cartoes={cartoes} transacoes={transacoes} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* gráfico */}
          <section>
            <SectionTitle
              icon={TrendingUp}
              right={<ChartLegend items={[
                { color: c.receita, label: "Receita" },
                { color: c.despesa, label: "Obrigações" },
                { color: c.primary, label: "Sobra" },
              ]} />}
            >
              Evolução Projetada
            </SectionTitle>
            <div className="rounded-xl border bg-card p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="projSobra" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.primary} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} {...gridProps(c)} />
                    <XAxis dataKey="mes" {...axisProps(c)} />
                    <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={70} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.grid }} />
                    <Area type="monotone" dataKey="Sobra" stroke="none" fill="url(#projSobra)" animationDuration={CHART_ANIM} legendType="none" tooltipType="none" />
                    <Line type="monotone" dataKey="Receita" stroke={c.receita} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                    <Line type="monotone" dataKey="Obrigações" stroke={c.despesa} strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                    <Line type="monotone" dataKey="Sobra" stroke={c.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Head({ icon: Icon, cor, children }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; cor?: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4" style={cor ? { color: cor } : undefined} />
      {children}
    </span>
  )
}

const TONES = {
  teal: "bg-primary/15 text-primary",
  violet: "bg-[#a78bfa]/15 text-[#a78bfa]",
  blue: "bg-[#38bdf8]/15 text-[#38bdf8]",
}

function ResumoCard({
  icon: Icon, tone, label, valor, valorTexto, sub, barra, index,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: keyof typeof TONES
  label: string
  valor?: number
  valorTexto?: string
  sub?: React.ReactNode
  barra?: number
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.05, ease: EASE }}
      className="flex items-center gap-4 rounded-xl border bg-card p-4"
    >
      <span className={cn("grid size-14 shrink-0 place-items-center rounded-xl", TONES[tone])}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("tnum font-display text-2xl font-semibold leading-tight", tone === "teal" && "text-primary")}>
          {valorTexto ?? fmtR(valor || 0)}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        {barra != null && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.round(barra * 100)}%` }} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// detalhe do mês: o que compõe as obrigações (fixas + faturas de cartão)
function DetalheMes({
  mesRef, obrigacoes, cartoes, transacoes,
}: {
  mesRef: string
  obrigacoes: Obrigacao[]
  cartoes: Cartao[]
  transacoes: Transacao[]
}) {
  const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
  const faturas = cartoes
    .filter((c) => c.ativo !== false)
    .map((c) => ({ c, v: faturaDoMes(transacoes, c.id, mesRef) }))
    .filter((f) => f.v > 0)
  const vazio = !ativas.length && !faturas.length
  return (
    <div className="grid gap-2 border-t border-border/60 px-4 py-3 pl-5 sm:grid-cols-2">
      {vazio && <p className="text-sm text-muted-foreground">Nenhuma obrigação ou fatura neste mês.</p>}
      {ativas.map((o) => (
        <div key={`o-${o.id}`} className="flex items-center gap-2.5 rounded-lg bg-secondary/40 px-3 py-2">
          <span className="grid size-7 place-items-center rounded-md bg-[#a78bfa]/15 text-[#a78bfa]"><LinkIcon className="size-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{o.nome}</span>
            <span className="block text-[0.7rem] text-muted-foreground">
              Dia {o.dia_vencimento || "—"} · {o.parcela_total ? `Parcela ${parcelaNoMes(o, mesRef)}/${o.parcela_total}` : "Recorrente"}
            </span>
          </span>
          <span className="tnum text-sm font-semibold text-destructive">{fmtR(Number(o.valor))}</span>
        </div>
      ))}
      {faturas.map(({ c, v }) => (
        <div key={`c-${c.id}`} className="flex items-center gap-2.5 rounded-lg bg-secondary/40 px-3 py-2">
          <span className="grid size-7 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-border">
            {c.logo ? <img src={c.logo} alt="" className="size-full object-contain p-0.5" /> : <CreditCard className="size-3.5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">Fatura {c.nome}</span>
            <span className="block text-[0.7rem] text-muted-foreground">Dia {c.dia_vencimento || "—"} · cartão</span>
          </span>
          <span className="tnum text-sm font-semibold text-destructive">{fmtR(v)}</span>
        </div>
      ))}
    </div>
  )
}
