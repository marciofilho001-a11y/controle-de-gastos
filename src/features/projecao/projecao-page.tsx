import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts"
import {
  TrendingUp, Calendar, Wallet,
  ChevronRight, PartyPopper, Settings2, PiggyBank, CalendarCheck, CreditCard, Link as LinkIcon, ShoppingBag, Info,
} from "@/lib/icons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { PageHeader, SectionTitle } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { SheetDrawer } from "@/components/ui/sheet-drawer"
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto, proximosMeses } from "@/lib/format"
import { calcularProjecaoMes, obrigacoesAtivasNoMes, faturaDoMes, parcelaNoMes } from "@/lib/selectors"
import {
  useChartColors, fmtAxis, axisProps, gridProps, ChartTooltip, ChartLegend, CHART_ANIM,
} from "@/lib/chart-theme"
import { LogoAvatar } from "@/components/logo-avatar"
import { SimuladorCompra } from "./simulador-compra"
import { cn } from "@/lib/utils"
import type { Obrigacao, Cartao, Transacao } from "@/lib/supabase"

const EASE = [0.23, 1, 0.32, 1] as const

export function ProjecaoPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes, config, saveConfig } = useFinData()
  const c = useChartColors()
  const [horizonte, setHorizonte] = useState("12")
  const [aberto, setAberto] = useState<string | null>(null)
  const [simAberto, setSimAberto] = useState(false)

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
    Compromissos: Math.round(d.totalObr),
    Livre: Math.round(d.sobra),
  }))

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projeção"
        accent={`a partir de ${fmtMesCurto(mesRef)}`}
        description="Receita e compromissos (contas fixas + faturas) estimados mês a mês."
        actions={
          <>
            <Button onClick={() => setSimAberto(true)} className="press">
              <ShoppingBag data-icon="inline-start" /> Posso comprar?
            </Button>
            <Select value={horizonte} onValueChange={setHorizonte}>
              <SelectTrigger className="h-9 w-[170px]">
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
          </>
        }
      />

      <SheetDrawer
        open={simAberto} onOpenChange={setSimAberto}
        titulo="Posso comprar?" descricao="Simule a compra antes de fazer — nada é gravado."
      >
        <SimuladorCompra mesRef={mesRef} embutido />
      </SheetDrawer>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* coluna lateral: resumo + parâmetros (no celular vem depois do gráfico e da tabela) */}
        <div className="order-2 flex flex-col gap-3 lg:order-1">
          <ResumoCard
            icon={Wallet} tone="teal" label={`Livre acumulado (${resumo.n}m)`}
            valor={resumo.sobraTotal}
            sub={<>média {fmtR(resumo.sobraTotal / Math.max(1, resumo.n))}/mês</>}
            index={0}
          />
          <ResumoCard
            icon={PiggyBank} tone="violet" label={`Sugestão p/ investir (${resumo.n}m)`}
            valor={resumo.sugestaoTotal}
            sub={<>{parseFloat(config.pct_investimento) || 0}% do livre de cada mês</>}
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
                <Label htmlFor="p-pct">% do livre p/ investir</Label>
                <Input
                  id="p-pct" type="number" step="1" defaultValue={config.pct_investimento ?? "20"}
                  className="tnum" placeholder="20"
                  onBlur={(e) => saveConfig("pct_investimento", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* gráfico primeiro (a tendência), tabela depois (os números) */}
        <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
          <section className="rounded-2xl border bg-card p-5">
            <SectionTitle
              icon={TrendingUp}
              right={<ChartLegend items={[
                { color: c.text, label: "Receita" },
                { color: c.despesa, label: "Compromissos" },
                { color: c.primary, label: "Livre" },
              ]} />}
            >
              Evolução projetada
            </SectionTitle>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="projSobra" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.primary} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} {...gridProps(c)} />
                  <XAxis dataKey="mes" {...axisProps(c)} />
                  <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={70} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.grid }} />
                  <Area type="monotone" dataKey="Livre" stroke="none" fill="url(#projSobra)" animationDuration={CHART_ANIM} legendType="none" tooltipType="none" />
                  <Line type="monotone" dataKey="Receita" stroke={c.text} strokeWidth={1.75} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                  <Line type="monotone" dataKey="Compromissos" stroke={c.despesa} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                  <Line type="monotone" dataKey="Livre" stroke={c.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="overflow-x-auto rounded-2xl border bg-card">
            <div className="min-w-[680px]">
              {/* cabeçalho da tabela */}
              <div className="grid grid-cols-[110px_0.8fr_1.2fr_1.2fr_1.2fr_1.2fr_28px] items-center gap-2 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <span>Mês</span>
                <span>Contas ativas</span>
                <span className="text-right">Compromissos</span>
                <span className="text-right">Receita</span>
                <span className="flex items-center justify-end gap-1">
                  Livre
                  <UiTooltip>
                    <TooltipTrigger asChild><Info className="size-3.5 cursor-help" /></TooltipTrigger>
                    <TooltipContent className="max-w-64">Receita − contas fixas − faturas do cartão. Não inclui Pix e débito do dia a dia — por isso é diferente do saldo do Dashboard.</TooltipContent>
                  </UiTooltip>
                </span>
                <span className="text-right">Sugestão investir</span>
                <span />
              </div>

              <div className="flex flex-col">
                {dados.map((d, i) => {
                  const anteriorQtd = i > 0 ? dados[i - 1].qtdObr : d.qtdObr
                  const terminou = i > 0 && anteriorQtd > d.qtdObr
                  const atual = i === 0
                  const expandido = aberto === d.mesRef
                  return (
                    <div
                      key={d.mesRef}
                      className={cn(
                        "border-b border-border/60 transition-colors last:border-b-0",
                        atual && "bg-primary/[0.05]",
                        expandido && "bg-secondary/40",
                      )}
                    >
                      <button
                        onClick={() => setAberto(expandido ? null : d.mesRef)}
                        className="grid w-full grid-cols-[110px_0.8fr_1.2fr_1.2fr_1.2fr_1.2fr_28px] items-center gap-2 px-4 py-3 text-left text-sm hover:bg-secondary/40"
                        aria-expanded={expandido}
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          {fmtMesCurto(d.mesRef)}
                          {atual && <span className="rounded-full bg-primary/12 px-1.5 py-px text-[0.65rem] font-medium text-primary">atual</span>}
                          {terminou && <PartyPopper className="size-3.5 text-primary" aria-label="uma conta terminou" />}
                        </span>
                        <span className="tnum text-muted-foreground">{d.qtdObr}</span>
                        <span className="tnum text-right">{fmtR(d.totalObr)}</span>
                        <span className="tnum text-right">
                          {d.estimado && <span className="mr-1 text-[0.65rem] text-muted-foreground">est.</span>}{fmtR(d.receita)}
                        </span>
                        <span className={cn("tnum text-right font-semibold", d.sobra < 0 && "text-destructive")}>{fmtR(d.sobra)}</span>
                        <span className="tnum text-right text-muted-foreground">{fmtR(d.sugestao)}</span>
                        <ChevronRight className={cn("size-4 justify-self-end text-muted-foreground transition-transform duration-200", expandido && "rotate-90")} />
                      </button>

                      <AnimatePresence initial={false}>
                        {expandido && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <DetalheMes mesRef={d.mesRef} obrigacoes={obrigacoes} cartoes={cartoes} transacoes={transacoes} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const TONES = {
  teal: "bg-secondary text-primary",
  violet: "bg-secondary text-muted-foreground",
  blue: "bg-secondary text-muted-foreground",
}

function ResumoCard({
  icon: Icon, tone, label, valor, valorTexto, sub, barra, index: _index,
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: EASE }}
      className="flex items-center gap-4 rounded-xl border bg-card p-4"
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONES[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="tnum font-display text-2xl font-semibold leading-tight tracking-[-0.02em]">
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
    <div className="grid gap-x-6 gap-y-1 px-4 pt-1 pb-3 sm:grid-cols-2">
      {vazio && <p className="text-sm text-muted-foreground">Nenhuma obrigação ou fatura neste mês.</p>}
      {ativas.map((o) => (
        <div key={`o-${o.id}`} className="flex items-center gap-2.5 py-1.5">
          <span className="grid size-7 place-items-center rounded-full bg-secondary text-muted-foreground"><LinkIcon className="size-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{o.nome}</span>
            <span className="block text-[0.7rem] text-muted-foreground">
              Dia {o.dia_vencimento || "—"} · {o.parcela_total ? `Parcela ${parcelaNoMes(o, mesRef)}/${o.parcela_total}` : "Recorrente"}
            </span>
          </span>
          <span className="tnum text-sm font-semibold">{fmtR(Number(o.valor))}</span>
        </div>
      ))}
      {faturas.map(({ c, v }) => (
        <div key={`c-${c.id}`} className="flex items-center gap-2.5 py-1.5">
          <LogoAvatar src={c.logo} cor="var(--muted-foreground)" Icon={CreditCard} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">Fatura {c.nome}</span>
            <span className="block text-[0.7rem] text-muted-foreground">Dia {c.dia_vencimento || "—"} · cartão</span>
          </span>
          <span className="tnum text-sm font-semibold">{fmtR(v)}</span>
        </div>
      ))}
    </div>
  )
}
