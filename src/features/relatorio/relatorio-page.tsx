import { useMemo } from "react"
import { DollarSign, Calculator, CreditCard, Wallet, CircleGauge, Shapes, Banknote } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { ChartPrevistoReal, type LinhaCat } from "./chart-previsto-real"
import { CatCard, type CatLinha } from "./cat-card"
import { FormaPagamentoBreakdown } from "./forma-pagamento"
import { useFinData } from "@/hooks/use-fin-data"
import { catColor, catInfo } from "@/lib/categorias"
import { fmtMesLongo, fmtR } from "@/lib/format"
import {
  obrigacoesAtivasNoMes, receitasDoMes, despesasDoMes,
  gastoVariavelTotalNoMes, totalCartoesNoMes, gastoDebitoNoMes, faturaDoMes,
  getTeto, mediaCategoriaMeses, statusPrevisto, despesasExibicaoDoMes,
} from "@/lib/selectors"

export function RelatorioPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, transacoes, cartoes, tetos, config } = useFinData()

  const calc = useMemo(() => {
    const rendaPrevista = parseFloat(config.renda_projetada) || 0
    const rendaReal = receitasDoMes(transacoes, mesRef)
    const diffRenda = rendaReal - rendaPrevista
    const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
    const custosFixos = ativas.reduce((s, o) => s + Number(o.valor), 0)
    const gastosVariaveis = gastoVariavelTotalNoMes(cartoes, transacoes, mesRef)
    const despesaReal = despesasDoMes(transacoes, mesRef)
    const despesaPrevista = custosFixos + totalCartoesNoMes(cartoes, transacoes, mesRef)
    const saldoPrevisto = rendaPrevista - despesaPrevista
    const saldoReal = rendaReal - despesaReal

    // lista de despesas SEM duplicação de cartão (mesma base do Dashboard)
    const despesasMes = despesasExibicaoDoMes(transacoes, mesRef)
    const catsUsadas = [
      ...new Set([...ativas.map((o) => o.categoria), ...despesasMes.map((t) => t.categoria)]),
    ].filter(Boolean) as string[]

    const linhasCat = catsUsadas
      .map((catKey) => {
        const obrFixo = ativas.filter((o) => o.categoria === catKey).reduce((s, o) => s + Number(o.valor), 0)
        const meta = getTeto(tetos, mesRef, "categoria", null, catKey)
        const media = mediaCategoriaMeses(transacoes, catKey, mesRef, 3)
        const previsto = meta || media || obrFixo
        const origemPrevisto = meta ? "meta" : media ? "média" : obrFixo ? "obrigação" : null
        const real = despesasMes.filter((t) => (t.categoria || "outro") === catKey).reduce((s, t) => s + Number(t.valor), 0)
        const st = statusPrevisto(real, previsto)
        return { catKey, label: labelCat(catKey), previsto, origemPrevisto, real, diff: real - previsto, st, cor: catColor(catKey) }
      })
      .filter((l) => l.previsto > 0 || l.real > 0)
      .sort((a, b) => b.real - a.real)

    const gastoDeb = gastoDebitoNoMes(transacoes, mesRef)
    const linhasCartao = cartoes
      .filter((c) => c.ativo !== false)
      .map((c) => ({ c, fatura: faturaDoMes(transacoes, c.id, mesRef) }))
    const maxFatura = Math.max(1, ...linhasCartao.map((l) => l.fatura))

    return {
      rendaReal, diffRenda, rendaPrevista, custosFixos, gastosVariaveis, despesaReal,
      saldoReal, saldoPrevisto, linhasCat, gastoDeb, linhasCartao, maxFatura, despesasMes,
    }
  }, [obrigacoes, transacoes, cartoes, tetos, config, mesRef])

  const chartData: LinhaCat[] = calc.linhasCat.map((l) => ({
    catKey: l.catKey, label: l.label, previsto: l.previsto, real: l.real, cor: l.cor,
  }))
  const catCards: CatLinha[] = calc.linhasCat

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">
          Relatório Mensal <span className="text-primary">— {fmtMesLongo(mesRef)}</span>
        </h2>
      </div>

      {/* Cockpit Financeiro */}
      <section>
        <SectionTitle icon={CircleGauge}>Cockpit Financeiro</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Receita Líquida" value={calc.rendaReal} icon={DollarSign} tone="teal" index={0}
            trend={
              calc.rendaPrevista > 0 ? (
                <span className={calc.diffRenda >= 0 ? "text-success" : "text-destructive"}>
                  {calc.diffRenda >= 0 ? "+" : ""}{fmtR(calc.diffRenda)} vs previsto
                </span>
              ) : undefined
            }
          />
          <StatCard
            label="Custos Fixos" value={calc.custosFixos} icon={Calculator} tone="slate" index={1}
            trend={calc.despesaReal > 0 ? `${Math.round((calc.custosFixos / calc.despesaReal) * 100)}% do total gasto` : undefined}
          />
          <StatCard
            label="Gastos Variáveis / Cartão" value={calc.gastosVariaveis} icon={CreditCard} tone="slate" index={2}
            trend={calc.despesaReal > 0 ? `${Math.round((calc.gastosVariaveis / calc.despesaReal) * 100)}% do total gasto` : undefined}
          />
          <StatCard
            label="Sobra Real" value={calc.saldoReal} icon={Wallet} tone="teal" index={3}
            valueClassName={calc.saldoReal >= 0 ? "text-success" : "text-destructive"}
            trend={calc.rendaPrevista > 0 ? `previsto: ${fmtR(calc.saldoPrevisto)}` : undefined}
          />
        </div>
      </section>

      {/* Gastos por categoria — Previsto x Real */}
      <section>
        <SectionTitle icon={Shapes}>Gastos por Categoria — Previsto x Real</SectionTitle>
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center justify-end gap-4 text-xs">
            <Legend color="var(--series-previsto)" label="Previsto" />
            <Legend color="var(--series-real)" label="Real" />
          </div>
          <ChartPrevistoReal linhas={chartData} />
        </div>
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catCards.map((l, i) => (
            <CatCard key={l.catKey} linha={l} index={i} transacoes={calc.despesasMes} cartoes={cartoes} />
          ))}
        </div>
      </section>

      {/* Por forma de pagamento — drill-down interativo */}
      <section>
        <SectionTitle icon={Banknote}>Por Forma de Pagamento</SectionTitle>
        <FormaPagamentoBreakdown transacoes={transacoes} cartoes={cartoes} mesRef={mesRef} />
      </section>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </h3>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function labelCat(catKey: string): string {
  return catInfo(catKey).l
}
