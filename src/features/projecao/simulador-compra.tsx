import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine, Cell,
} from "recharts"
import {
  ShoppingBag, CheckCircle2, AlertTriangle, XCircle, Layers, CalendarClock, CreditCard, Lightbulb, Info,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto, addMonths } from "@/lib/format"
import {
  simular, melhorParcelamento, melhorMesParaComprar, type Forma, type Veredito,
} from "@/lib/simulador"
import { useChartColors, fmtAxis, axisProps, gridProps, CHART_ANIM } from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const
const ATALHOS = [1, 3, 6, 10, 12]

const VEREDITO: Record<Veredito, { titulo: string; cls: string; cor: string; icon: React.ComponentType<{ className?: string }> }> = {
  cabe: { titulo: "Cabe com folga", cls: "border-success/40 bg-success/8 text-success", cor: "var(--success)", icon: CheckCircle2 },
  aperta: { titulo: "Cabe, mas aperta", cls: "border-warning/45 bg-warning/10 text-warning", cor: "var(--warning)", icon: AlertTriangle },
  nao: { titulo: "Não cabe agora", cls: "border-destructive/45 bg-destructive/8 text-destructive", cor: "var(--destructive)", icon: XCircle },
}

export function SimuladorCompra({ mesRef, embutido = false }: { mesRef: string; embutido?: boolean }) {
  const { obrigacoes, cartoes, transacoes, config, faturaPagamentos } = useFinData()
  const c = useChartColors()
  const ativos = cartoes.filter((x) => x.ativo !== false)

  const [descricao, setDescricao] = useState("")
  const [valorTxt, setValorTxt] = useState("")
  const [formaId, setFormaId] = useState<string>(ativos[0] ? String(ativos[0].id) : "debito")
  const [parcTxt, setParcTxt] = useState("1")
  const [primeiroMes, setPrimeiroMes] = useState<string>(ativos[0] ? addMonths(mesRef, 1) : mesRef)

  const valor = parseFloat(valorTxt.replace(",", ".")) || 0
  const parcelas = Math.max(1, Math.min(48, parseInt(parcTxt) || 1))
  const forma: Forma = formaId === "debito" ? { tipo: "debito" } : { tipo: "cartao", cartaoId: Number(formaId) }
  const cartao = forma.tipo === "cartao" ? cartoes.find((x) => x.id === forma.cartaoId) : null

  function trocarForma(v: string) {
    setFormaId(v)
    setPrimeiroMes(v === "debito" ? mesRef : addMonths(mesRef, 1))
    if (v === "debito") setParcTxt("1")
  }

  const sim = useMemo(() => {
    if (valor <= 0) return null
    const base = { obrigacoes, cartoes, transacoes, config, pagamentos: faturaPagamentos, mesRef }
    const entrada = { valor, forma, parcelas, primeiroMes }
    const r = simular(base, entrada)
    const sugParc = r.veredito !== "cabe" ? melhorParcelamento(base, entrada) : null
    const sugMes = r.veredito !== "cabe" ? melhorMesParaComprar(base, entrada) : null
    return { r, sugParc: sugParc && sugParc !== parcelas ? sugParc : null, sugMes }
  }, [valor, formaId, parcelas, primeiroMes, obrigacoes, cartoes, transacoes, config, faturaPagamentos, mesRef]) // eslint-disable-line react-hooks/exhaustive-deps

  const opcoesMes = Array.from({ length: 4 }, (_, i) => addMonths(mesRef, i))
  const chart = sim?.r.meses.map((m) => ({
    mes: fmtMesCurto(m.mesRef) + (m.receitaEstimada ? "*" : ""),
    Antes: Math.round(m.sobraAntes),
    Depois: Math.round(m.sobraDepois),
    afetado: m.impacto > 0,
  })) ?? []

  return (
    <section className={cn("relative", !embutido && "overflow-hidden rounded-xl border bg-card p-5")}>
      <div className={cn("relative mb-4 flex flex-wrap items-center gap-3", embutido && "hidden")}>
        <span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"><ShoppingBag className="size-5" /></span>
        <div>
          <h3 className="font-display text-xl font-semibold leading-tight">Posso comprar?</h3>
          <p className="text-xs text-muted-foreground">Simule a compra antes de fazer — nada é gravado.</p>
        </div>
      </div>

      <div className="relative grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* formulário */}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sim-desc">O que é</Label>
            <Input id="sim-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: tênis, notebook, viagem" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sim-valor">Valor total</Label>
            <Input
              id="sim-valor" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)}
              placeholder="R$ 0,00" className="tnum h-11 text-lg font-semibold"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Como vai pagar</Label>
            <Select value={formaId} onValueChange={trocarForma}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ativos.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.nome}</SelectItem>)}
                  <SelectItem value="debito">Débito / Pix (à vista)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {forma.tipo === "cartao" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sim-parc">Parcelas</Label>
              <div className="flex items-center gap-1.5">
                <Input id="sim-parc" type="number" min={1} max={48} value={parcTxt} onChange={(e) => setParcTxt(e.target.value)} className="tnum w-16 text-center" />
                {ATALHOS.map((n) => (
                  <button
                    key={n} onClick={() => setParcTxt(String(n))}
                    className={cn("h-9 flex-1 rounded-md border text-xs font-semibold transition-colors",
                      parcelas === n ? "border-primary/60 bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>{forma.tipo === "cartao" ? "Primeira parcela na fatura de" : "Pago em"}</Label>
            <Select value={primeiroMes} onValueChange={setPrimeiroMes}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {opcoesMes.map((m) => <SelectItem key={m} value={m}>{fmtMesCurto(m)}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* resultado */}
        <AnimatePresence mode="wait">
          {!sim ? (
            <motion.div
              key="vazio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid min-h-[260px] place-items-center rounded-xl border border-dashed text-center"
            >
              <div className="flex max-w-xs flex-col items-center gap-2 px-6">
                <Lightbulb className="size-7 text-muted-foreground/70" />
                <p className="text-sm text-muted-foreground">Digite o valor e a forma de pagamento para ver como ficam as próximas faturas e a sobra de cada mês.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: EASE }} className="flex min-w-0 flex-col gap-4"
            >
              <Banner sim={sim.r} descricao={descricao} cartaoNome={cartao?.nome} />

              <div className="grid gap-2.5 sm:grid-cols-3">
                <Numero icon={Layers} label="Cada parcela" valor={fmtR(sim.r.valorParcela)} sub={forma.tipo === "cartao" ? `${parcelas}x no ${cartao?.nome ?? "cartão"}` : "à vista"} />
                <Numero
                  icon={CalendarClock} label="Meses afetados"
                  valor={parcelas > 1 ? `${fmtMesCurto(primeiroMes)} → ${fmtMesCurto(addMonths(primeiroMes, parcelas - 1))}` : fmtMesCurto(primeiroMes)}
                  sub={parcelas > 1 ? `${parcelas} meses` : "um mês só"}
                />
                {sim.r.limite ? (
                  <LimiteBox l={sim.r.limite} />
                ) : (
                  <Numero icon={CreditCard} label="Limite do cartão" valor="—" sub={forma.tipo === "cartao" ? "sem limite cadastrado" : "não se aplica"} />
                )}
              </div>

              {(sim.sugParc || sim.sugMes) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lightbulb className="size-3.5" /> Para caber com folga:</span>
                  {sim.sugParc && (
                    <button onClick={() => setParcTxt(String(sim.sugParc))} className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20">
                      parcelar em {sim.sugParc}x
                    </button>
                  )}
                  {sim.sugMes && (
                    <button onClick={() => setPrimeiroMes(sim.sugMes!)} className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20">
                      começar a pagar em {fmtMesCurto(sim.sugMes)}
                    </button>
                  )}
                </div>
              )}

              <div className="rounded-xl border bg-background/40 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Sobra livre por mês</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted-foreground/40" /> sem a compra</span>
                  <span className="flex items-center gap-1.5">
                    com a compra:
                    <span className="size-2.5 rounded-sm bg-success" /> folgado
                    <span className="size-2.5 rounded-sm bg-warning" /> apertado
                    <span className="size-2.5 rounded-sm bg-destructive" /> no vermelho
                  </span>
                  <span className="flex items-center gap-1.5"><span className="h-px w-4 border-t border-dashed border-warning" /> folga ideal</span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={3} barCategoryGap="26%">
                      <CartesianGrid vertical={false} {...gridProps(c)} />
                      <XAxis dataKey="mes" {...axisProps(c)} />
                      <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={72} />
                      <Tooltip
                        cursor={{ fill: c.muted, opacity: 0.4 }}
                        content={({ active, payload, label }: any) => active && payload?.length ? (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                            <p className="mb-1 font-semibold">{label}</p>
                            <p className="flex justify-between gap-4 text-muted-foreground">Sem a compra <span className="tnum text-foreground">{fmtR(payload[0].payload.Antes)}</span></p>
                            <p className="flex justify-between gap-4 text-muted-foreground">Com a compra <span className="tnum font-semibold text-foreground">{fmtR(payload[0].payload.Depois)}</span></p>
                          </div>
                        ) : null}
                      />
                      <ReferenceLine y={0} stroke={c.text} strokeOpacity={0.5} />
                      <ReferenceLine y={Math.round(sim.r.folga)} stroke="var(--warning)" strokeDasharray="4 4" strokeOpacity={0.7} />
                      <Bar dataKey="Antes" fill={c.text} fillOpacity={0.3} radius={[4, 4, 0, 0]} maxBarSize={26} animationDuration={CHART_ANIM} />
                      <Bar dataKey="Depois" radius={[4, 4, 0, 0]} maxBarSize={26} animationDuration={CHART_ANIM}>
                        {chart.map((row, i) => (
                          <Cell
                            key={i}
                            fill={row.Depois < 0 ? "var(--destructive)" : !row.afetado ? c.text : row.Depois < sim.r.folga ? "var(--warning)" : "var(--success)"}
                            fillOpacity={row.afetado ? 1 : 0.3}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" />
                Sobra livre = receita − obrigações e faturas já lançadas − gasto típico no débito/Pix
                ({fmtR(sim.r.meses[1]?.variavel ?? sim.r.meses[0].variavel)}/mês). Meses com * usam receita estimada
                (renda projetada ou média dos últimos meses).
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function Banner({ sim, descricao, cartaoNome }: { sim: ReturnType<typeof simular>; descricao: string; cartaoNome?: string }) {
  const v = VEREDITO[sim.veredito]
  const oque = descricao.trim() ? `“${descricao.trim()}”` : "A compra"
  const pior = sim.piorMes
  let texto: string
  if (sim.limite?.estoura) {
    texto = `${oque} passa do limite do ${cartaoNome ?? "cartão"} em ${fmtR(sim.limite.depois - sim.limite.total)}.`
  } else if (sim.veredito === "nao") {
    texto = `Em ${fmtMesCurto(pior.mesRef)} faltariam ${fmtR(-pior.sobraDepois)} para fechar o mês.`
  } else if (sim.veredito === "aperta") {
    texto = `Em ${fmtMesCurto(pior.mesRef)} sobrariam só ${fmtR(pior.sobraDepois)} (folga ideal: ${fmtR(sim.folga)}).`
  } else {
    texto = `No mês mais apertado (${fmtMesCurto(pior.mesRef)}) ainda sobram ${fmtR(pior.sobraDepois)}.`
  }
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", v.cls)}>
      <v.icon className="size-6 shrink-0" />
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold leading-tight">{v.titulo}</p>
        <p className="text-sm text-foreground/85">{texto}</p>
      </div>
    </div>
  )
}

function Numero({ icon: Icon, label, valor, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; valor: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-lg border px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <p className="tnum mt-1 truncate font-semibold">{valor}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

function LimiteBox({ l }: { l: NonNullable<ReturnType<typeof simular>["limite"]> }) {
  const pctAntes = Math.min(100, (l.usado / l.total) * 100)
  const pctDepois = Math.min(100, (l.depois / l.total) * 100)
  return (
    <div className="min-w-0 rounded-lg border px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CreditCard className="size-3.5" /> Limite depois da compra</p>
      <p className={cn("tnum mt-1 truncate font-semibold", l.estoura && "text-destructive")}>
        {l.estoura ? `estoura ${fmtR(l.depois - l.total)}` : `sobra ${fmtR(l.total - l.depois)}`}
      </p>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("absolute inset-y-0 left-0 rounded-full", l.estoura ? "bg-destructive" : "bg-warning")} style={{ width: `${pctDepois}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pctAntes}%` }} />
      </div>
      <p className="tnum mt-1 truncate text-[11px] text-muted-foreground">{fmtR(l.depois)} de {fmtR(l.total)}</p>
    </div>
  )
}
