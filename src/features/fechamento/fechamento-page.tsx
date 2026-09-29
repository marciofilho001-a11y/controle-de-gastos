import { useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  CheckCircle2, Circle, AlertTriangle, Lock, Unlock, Loader2, ListChecks, CreditCard, Wallet,
  Clock, Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus, Scale, Landmark, Receipt, Flag, CalendarClock,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageHeader, SectionTitle } from "@/components/page-header"
import { PdfButton } from "@/features/relatorio/pdf-button"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase } from "@/lib/supabase"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtMesCurto, fmtMesLongo, addMonths, fmtData } from "@/lib/format"
import {
  receitasDoMes, despesasDoMes, obrigacoesAtivasNoMes, obrigacaoPagaNoMes, faturaInfoDoMes,
  despesasExibicaoDoMes, txDoMes, parcelaNoMes, variacaoPct, faturaPagaNoMes,
} from "@/lib/selectors"
import { gerarInsights, type Severidade } from "@/lib/insights"
import { statusLancamento } from "@/lib/parcelas"
import type { TabId } from "@/components/layout/nav"
import { LogoAvatar } from "@/components/logo-avatar"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const
const SEV: Record<Severidade, { label: string; cls: string }> = {
  vilao: { label: "Vilão", cls: "bg-destructive/12 text-destructive" },
  atencao: { label: "Atenção", cls: "bg-warning/15 text-warning" },
  ok: { label: "Bom sinal", cls: "bg-success/12 text-success" },
  info: { label: "Panorama", cls: "bg-secondary text-muted-foreground" },
}

// Tela de "virar o mês": checklist do que falta, comparação com o mês anterior,
// veredito e o carimbo de fechamento (guardado em fin_config: fechado_<mes>).
export function FechamentoPage({ mesRef, onNavigate }: { mesRef: string; onNavigate: (t: TabId) => void }) {
  const { transacoes, cartoes, obrigacoes, tetos, config, faturaPagamentos, saveConfig, loadAll } = useFinData()
  const [busy, setBusy] = useState<number | "fechar" | null>(null)
  const hoje = new Date().toISOString().slice(0, 10)
  const fechadoEm = config[`fechado_${mesRef}`] || ""
  const anterior = addMonths(mesRef, -1)

  const d = useMemo(() => {
    const receita = receitasDoMes(transacoes, mesRef)
    const despesa = despesasDoMes(transacoes, mesRef)
    const sobra = receita - despesa
    const recAnt = receitasDoMes(transacoes, anterior)
    const despAnt = despesasDoMes(transacoes, anterior)
    const sobraAnt = recAnt - despAnt

    const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
    const obrig = ativas.map((o) => ({ o, paga: !!obrigacaoPagaNoMes(transacoes, o.id, mesRef) }))
    const naoPagas = obrig.filter((x) => !x.paga)
    const totalObrig = ativas.reduce((s, o) => s + Number(o.valor), 0)

    const faturas = cartoes.filter((c) => c.ativo !== false)
      .map((c) => ({ c, f: faturaInfoDoMes(transacoes, c.id, mesRef) })).filter((x) => x.f.valor > 0)
    const indefinido = faturas.reduce((s, x) => s + x.f.indefinido, 0)
    const faturasPendentes = faturas.filter((x) => x.f.indefinido > 0)
    const totalFat = faturas.reduce((s, x) => s + x.f.valor, 0)
    // baixa manual da fatura (fin_fatura_pagamentos): o que ainda falta pagar
    const faturasComBaixa = faturas.map((x) => ({ ...x, pg: faturaPagaNoMes(faturaPagamentos, x.c.id, mesRef) }))
    const faturasAPagar = faturasComBaixa.filter((x) => !x.pg)
    const totalFatAPagar = faturasAPagar.reduce((s, x) => s + x.f.valor, 0)
    const aPagar = totalFatAPagar + naoPagas.reduce((s, x) => s + Number(x.o.valor), 0)

    const exib = despesasExibicaoDoMes(transacoes, mesRef)
    const pendentes = exib.filter((t) => !t._virtual && statusLancamento(t, hoje).key === "pendente")
    const semCategoria = exib.filter((t) => !t._virtual && (!t.categoria || t.categoria === "outro"))

    const rendaPrev = parseFloat(config.renda_projetada) || 0
    const receitas = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "receita")

    // categorias este mês x anterior
    const somaCat = (m: string) => {
      const acc = new Map<string, number>()
      for (const t of despesasExibicaoDoMes(transacoes, m)) acc.set(t.categoria || "outro", (acc.get(t.categoria || "outro") || 0) + Number(t.valor))
      return acc
    }
    const catAtual = somaCat(mesRef), catAnt = somaCat(anterior)
    const cats = [...new Set([...catAtual.keys(), ...catAnt.keys()])]
      .map((k) => ({ k, atual: catAtual.get(k) || 0, ant: catAnt.get(k) || 0 }))
      .map((x) => ({ ...x, delta: x.atual - x.ant }))
      .sort((a, b) => b.atual - a.atual)

    const insights = gerarInsights({ transacoes, cartoes, obrigacoes, tetos, config, mesRef }).filter((i) => i.id !== "vazio").slice(0, 5)

    const checks = [
      { id: "obrig", ok: naoPagas.length === 0, titulo: "Obrigações pagas", detalhe: naoPagas.length ? `${naoPagas.length} de ${ativas.length} ainda sem baixa` : `${ativas.length} de ${ativas.length} com baixa`, icon: ListChecks },
      { id: "fatpg", ok: faturasAPagar.length === 0, titulo: "Faturas pagas", detalhe: faturasAPagar.length ? `${fmtR(totalFatAPagar)} em ${faturasAPagar.length} fatura(s) sem baixa` : faturas.length ? `${faturas.length} de ${faturas.length} com baixa` : "Nenhuma fatura neste mês", icon: CalendarClock },
      { id: "fat", ok: indefinido <= 0, titulo: "Faturas detalhadas", detalhe: indefinido > 0 ? `${fmtR(indefinido)} sem detalhamento em ${faturasPendentes.length} fatura(s)` : "Todas as faturas abertas item a item", icon: CreditCard },
      { id: "rec", ok: receita > 0 && (rendaPrev === 0 || receita >= rendaPrev * 0.9), titulo: "Receitas registradas", detalhe: receita === 0 ? "Nenhuma receita lançada" : rendaPrev > 0 && receita < rendaPrev * 0.9 ? `${fmtR(receita)} de ${fmtR(rendaPrev)} previstos` : `${fmtR(receita)} em ${receitas.length} lançamento(s)`, icon: Wallet },
      { id: "pend", ok: pendentes.length === 0, titulo: "Lançamentos pendentes", detalhe: pendentes.length ? `${pendentes.length} com data futura (${fmtR(pendentes.reduce((s, t) => s + Number(t.valor), 0))})` : "Nada com data futura", icon: Clock },
      { id: "cat", ok: semCategoria.length === 0, titulo: "Tudo categorizado", detalhe: semCategoria.length ? `${semCategoria.length} lançamento(s) em "Outro"` : "Nenhum lançamento solto em Outro", icon: Flag },
    ]
    const feitos = checks.filter((c) => c.ok).length

    return {
      receita, despesa, sobra, recAnt, despAnt, sobraAnt, obrig, naoPagas, totalObrig, faturas, faturasPendentes, indefinido, totalFat,
      pendentes, semCategoria, rendaPrev, cats, insights, checks, feitos, exib,
      faturasComBaixa, faturasAPagar, totalFatAPagar, aPagar,
    }
  }, [transacoes, cartoes, obrigacoes, tetos, config, faturaPagamentos, mesRef, anterior, hoje])

  async function pagarObrigacao(o: (typeof d.obrig)[number]["o"]) {
    setBusy(o.id)
    try {
      const { error } = await supabase.from("fin_transacoes").insert({
        tipo: "despesa", descricao: o.nome, valor: Number(o.valor), categoria: o.categoria,
        data: `${mesRef}-${String(o.dia_vencimento || 1).padStart(2, "0")}`, mes_ref: mesRef, obrigacao_id: o.id,
      })
      if (error) throw error
      toast.success(`${o.nome} marcada como paga`)
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível dar baixa", { description: e instanceof Error ? e.message : "" })
    } finally { setBusy(null) }
  }

  async function alternarFechamento() {
    setBusy("fechar")
    try {
      await saveConfig(`fechado_${mesRef}`, fechadoEm ? "" : hoje)
      toast.success(fechadoEm ? "Mês reaberto" : `${fmtMesCurto(mesRef)} fechado`)
    } finally { setBusy(null) }
  }

  const pctRenda = d.receita > 0 ? (d.sobra / d.receita) * 100 : 0
  const comprometido = d.totalObrig + d.totalFat

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fechamento do mês"
        accent={fmtMesLongo(mesRef)}
        description="Checklist pra virar o mês, comparação com o anterior e o carimbo de fechado."
        actions={
          <>
            <PdfButton mesRef={mesRef} />
            <Button variant={fechadoEm ? "outline" : "default"} onClick={alternarFechamento} disabled={busy === "fechar"}>
              {busy === "fechar" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : fechadoEm ? <Unlock data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
              {fechadoEm ? "Reabrir mês" : "Fechar mês"}
            </Button>
          </>
        }
      />

      {/* veredito */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
        className={cn("relative overflow-hidden rounded-xl border p-5", d.sobra >= 0 ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}
      >
        <div className="flex flex-wrap items-center gap-5">
          <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", d.sobra >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
            {d.sobra >= 0 ? <TrendingUp className="size-7" /> : <TrendingDown className="size-7" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fechadoEm ? `Mês fechado em ${fmtData(fechadoEm)}` : `${d.feitos} de ${d.checks.length} itens do checklist concluídos`}
            </p>
            <p className="mt-0.5 font-display text-2xl font-semibold tracking-[-0.01em]">
              {d.sobra >= 0 ? "Mês no azul: " : "Mês no vermelho: "}
              <span className={cn("tnum", d.sobra >= 0 ? "text-success" : "text-destructive")}>{fmtR(d.sobra)}</span>
              {d.receita > 0 && <span className="text-base font-normal text-muted-foreground"> · {pctRenda.toFixed(0)}% da renda</span>}
            </p>
            {d.aPagar > 0 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">
                  <Clock className="size-3.5" /> Falta pagar {fmtR(d.aPagar)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {d.faturasAPagar.length > 0 && `${d.faturasAPagar.length} fatura(s)`}
                  {d.faturasAPagar.length > 0 && d.naoPagas.length > 0 && " · "}
                  {d.naoPagas.length > 0 && `${d.naoPagas.length} obrigação(ões)`}
                </span>
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {d.recAnt > 0 || d.despAnt > 0
                ? `Em ${fmtMesCurto(anterior)} a sobra foi ${fmtR(d.sobraAnt)} (${d.sobra >= d.sobraAnt ? "+" : ""}${fmtR(d.sobra - d.sobraAnt)} agora).`
                : "Sem dados do mês anterior pra comparar."}
            </p>
          </div>
          <div className="flex gap-1 self-stretch">
            {d.checks.map((c) => (
              <span key={c.id} className={cn("w-2.5 rounded-full", c.ok ? "bg-success" : "bg-border")} title={c.titulo} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* comparação com o mês anterior */}
      <section>
        <SectionTitle icon={Scale}>{fmtMesCurto(mesRef)} x {fmtMesCurto(anterior)}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Comparativo label="Receitas" atual={d.receita} ant={d.recAnt} icon={Wallet} bomQuandoSobe index={0} />
          <Comparativo label="Despesas" atual={d.despesa} ant={d.despAnt} icon={Receipt} bomQuandoSobe={false} index={1} />
          <Comparativo label="Obrigações + faturas" atual={comprometido} ant={obrigacoesAtivasNoMes(obrigacoes, anterior).reduce((s, o) => s + Number(o.valor), 0) + cartoes.reduce((s, c) => s + faturaInfoDoMes(transacoes, c.id, anterior).valor, 0)} icon={Landmark} bomQuandoSobe={false} index={2} />
          <Comparativo label="Sobra" atual={d.sobra} ant={d.sobraAnt} icon={TrendingUp} bomQuandoSobe index={3} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* checklist */}
        <section>
          <SectionTitle icon={ListChecks}>Checklist de fechamento</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {d.checks.map((c, i) => {
              const Icon = c.icon
              return (
                <motion.div
                  key={c.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: i * 0.05, ease: EASE }}
                  className={cn("rounded-xl border bg-card p-4", c.ok ? "border-success/25" : "border-warning/30")}
                >
                  <div className="flex items-center gap-3">
                    {c.ok ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className="size-5 shrink-0 text-warning" />}
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", c.ok ? "bg-success/12 text-success" : "bg-warning/15 text-warning")}><Icon className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.titulo}</p>
                      <p className="text-xs text-muted-foreground">{c.detalhe}</p>
                    </div>
                    {!c.ok && (c.id === "fat" || c.id === "fatpg") && (
                      <Button size="sm" variant="outline" onClick={() => onNavigate("cartoes")}>Detalhar <ArrowRight data-icon="inline-end" /></Button>
                    )}
                    {!c.ok && (c.id === "pend" || c.id === "cat") && (
                      <Button size="sm" variant="outline" onClick={() => onNavigate("transacoes")}>Ver <ArrowRight data-icon="inline-end" /></Button>
                    )}
                    {!c.ok && c.id === "rec" && (
                      <Button size="sm" variant="outline" onClick={() => onNavigate("transacoes")}>Lançar <ArrowRight data-icon="inline-end" /></Button>
                    )}
                  </div>

                  {c.id === "fatpg" && d.faturasAPagar.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
                      {d.faturasAPagar.map(({ c: cart, f }) => (
                        <div key={cart.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
                          <LogoAvatar src={cart.logo} cor="var(--muted-foreground)" Icon={CreditCard} size={28} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{cart.nome}</p>
                            <p className="text-xs text-muted-foreground">Vence dia {cart.dia_vencimento || "—"}</p>
                          </div>
                          <span className="tnum text-sm font-medium">{fmtR(f.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {c.id === "obrig" && d.naoPagas.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
                      {d.naoPagas.map(({ o }) => (
                        <div key={o.id} className="flex items-center gap-3 rounded-lg bg-background/40 px-3 py-2">
                          <span className="grid size-7 place-items-center rounded-md" style={{ background: `${catColor(o.categoria)}22`, color: catColor(o.categoria) }}>
                            {(() => { const I = catInfo(o.categoria).icon; return <I className="size-3.5" /> })()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{o.nome}</p>
                            <p className="text-[0.7rem] text-muted-foreground">Dia {o.dia_vencimento || "—"} · {o.parcela_total ? `Parcela ${parcelaNoMes(o, mesRef)}/${o.parcela_total}` : "Recorrente"}</p>
                          </div>
                          <span className="tnum text-sm font-semibold">{fmtR(Number(o.valor))}</span>
                          <Button size="sm" variant="secondary" className="h-7" onClick={() => pagarObrigacao(o)} disabled={busy === o.id}>
                            {busy === o.id ? <Loader2 className="size-3.5 animate-spin" /> : "Dar baixa"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.id === "fat" && d.faturasPendentes.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5 border-t pt-3">
                      {d.faturasPendentes.map(({ c: cartao, f }) => (
                        <div key={cartao.id} className="flex items-center gap-3 rounded-lg bg-background/40 px-3 py-2 text-sm">
                          <LogoAvatar src={cartao.logo} cor="var(--muted-foreground)" Icon={CreditCard} size={28} />
                          <p className="min-w-0 flex-1 truncate font-medium">{cartao.nome}</p>
                          <span className="text-xs text-muted-foreground">{fmtR(f.detalhado)} de {fmtR(f.valor)} detalhado</span>
                          <span className="tnum font-semibold text-warning">{fmtR(f.indefinido)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* categorias x anterior + panorama */}
        <div className="flex flex-col gap-6">
          <section>
            <SectionTitle icon={Receipt}>Categorias x mês anterior</SectionTitle>
            <div className="rounded-xl border bg-card p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 pb-2 pt-1 text-left">Categoria</th>
                    <th className="px-2 pb-2 pt-1 text-right">{fmtMesCurto(mesRef)}</th>
                    <th className="hidden px-2 pb-2 pt-1 text-right sm:table-cell">{fmtMesCurto(anterior)}</th>
                    <th className="px-2 pb-2 pt-1 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {d.cats.slice(0, 8).map((x) => {
                    const I = catInfo(x.k).icon; const cor = catColor(x.k)
                    return (
                      <tr key={x.k} className="border-t border-border/60">
                        <td className="px-2 py-2">
                          <span className="flex items-center gap-2">
                            <span className="grid size-6 place-items-center rounded-md" style={{ background: `${cor}22`, color: cor }}><I className="size-3.5" /></span>
                            <span className="truncate font-medium">{catInfo(x.k).l}</span>
                          </span>
                        </td>
                        <td className="tnum px-2 py-2 text-right font-semibold">{fmtR(x.atual)}</td>
                        <td className="tnum hidden px-2 py-2 text-right text-muted-foreground sm:table-cell">{fmtR(x.ant)}</td>
                        <td className={cn("tnum px-2 py-2 text-right text-xs font-semibold", x.delta > 0 ? "text-destructive" : x.delta < 0 ? "text-success" : "text-muted-foreground")}>
                          {x.delta === 0 ? <Minus className="ml-auto size-3.5" /> : `${x.delta > 0 ? "+" : ""}${fmtR(x.delta)}`}
                        </td>
                      </tr>
                    )
                  })}
                  {d.cats.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">Sem despesas no mês</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <SectionTitle icon={Sparkles}>Leitura do gestor</SectionTitle>
            <div className="flex flex-col gap-2">
              {d.insights.map((i) => (
                <div key={i.id} className="flex gap-3 rounded-xl border bg-card p-3.5">
                  <span className={cn("mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold", SEV[i.severidade].cls)}>{SEV[i.severidade].label}</span>
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{i.frase}</p>
                    {i.detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{i.detalhe}</p>}
                  </div>
                </div>
              ))}
              {d.insights.length === 0 && (
                <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground"><AlertTriangle className="size-4" /> Sem leituras pra este mês ainda.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Comparativo({ label, atual, ant, icon: Icon, bomQuandoSobe, index }: {
  label: string; atual: number; ant: number; icon: React.ComponentType<{ className?: string }>; bomQuandoSobe: boolean; index: number
}) {
  const v = variacaoPct(atual, ant)
  const bom = v ? (v.subiu === bomQuandoSobe) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05, ease: EASE }}
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className="tnum mt-2 font-display text-2xl font-semibold">{fmtR(atual)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs">
        {v && v.pct === 0 ? (
          <><span className="tnum rounded-md bg-secondary px-1.5 py-px font-semibold text-muted-foreground">0%</span><span className="text-muted-foreground">igual a {fmtR(ant)}</span></>
        ) : v ? (
          <>
            <span className={cn("tnum flex items-center gap-0.5 rounded-md px-1.5 py-px font-semibold", bom ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive")}>
              {v.subiu ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {v.subiu ? "+" : "-"}{Math.abs(v.pct).toFixed(0)}%
            </span>
            <span className="text-muted-foreground">vs {fmtR(ant)}</span>
          </>
        ) : <span className="text-muted-foreground">sem mês anterior</span>}
      </p>
    </motion.div>
  )
}
