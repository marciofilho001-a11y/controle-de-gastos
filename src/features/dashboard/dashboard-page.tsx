import { useMemo, useState } from "react"
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Clock, Scale, Check, Inbox, PieChart,
} from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { StatCard } from "@/components/stat-card"
import { CategoryDonut, type DonutSlice } from "./category-donut"
import { TrendPill } from "./trend-pill"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase } from "@/lib/supabase"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtData, addMonths } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  receitasDoMes, despesasDoMes, txDoMes, itensObrigacoesDoMes,
} from "@/lib/selectors"

export function DashboardPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes, loadAll } = useFinData()
  const [busyObr, setBusyObr] = useState<number | null>(null)

  const d = useMemo(() => {
    const receitas = receitasDoMes(transacoes, mesRef)
    const despesas = despesasDoMes(transacoes, mesRef)
    const saldo = receitas - despesas
    const mesAnt = addMonths(mesRef, -1)
    const receitasAnt = receitasDoMes(transacoes, mesAnt)
    const despesasAnt = despesasDoMes(transacoes, mesAnt)
    const saldoAnt = receitasAnt - despesasAnt
    const itens = itensObrigacoesDoMes(obrigacoes, cartoes, transacoes, mesRef)
    const pendentes = itens.filter((i) => !i.paga).reduce((s, i) => s + i.valor, 0)
    const totalObr = itens.reduce((s, i) => s + i.valor, 0)
    const pctComprometido = receitas > 0 ? Math.min(100, (totalObr / receitas) * 100) : 0

    // donut de gastos por categoria (despesas do mês)
    const despMes = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "despesa")
    const porCat = new Map<string, number>()
    for (const t of despMes) {
      const k = t.categoria || "outro"
      porCat.set(k, (porCat.get(k) || 0) + Number(t.valor))
    }
    const slices: DonutSlice[] = [...porCat.entries()]
      .map(([catKey, value]) => ({ catKey, label: catInfo(catKey).l, value }))
      .sort((a, b) => b.value - a.value)

    const hist = txDoMes(transacoes, mesRef)
    // agrupa por dia
    const grupos = new Map<string, typeof hist>()
    for (const t of hist) {
      const arr = grupos.get(t.data) || []
      arr.push(t)
      grupos.set(t.data, arr)
    }
    const dias = [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))

    return { receitas, despesas, saldo, receitasAnt, despesasAnt, saldoAnt, itens, pendentes, totalObr, pctComprometido, slices, despesas_total: despesas, dias }
  }, [obrigacoes, cartoes, transacoes, mesRef])

  async function toggleObrigacao(item: (typeof d.itens)[number]) {
    if (item.tipo === "cartao") return
    setBusyObr(item.id)
    try {
      if (item.paga) {
        // remover a transação que marca como paga
        const { error } = await supabase
          .from("fin_transacoes")
          .delete()
          .eq("obrigacao_id", item.id)
          .eq("mes_ref", mesRef)
        if (error) throw error
      } else {
        const obr = obrigacoes.find((o) => o.id === item.id)
        const { error } = await supabase.from("fin_transacoes").insert({
          tipo: "despesa",
          descricao: item.nome,
          valor: item.valor,
          categoria: item.categoria,
          data: `${mesRef}-${String(item.dia || 1).padStart(2, "0")}`,
          mes_ref: mesRef,
          obrigacao_id: item.id,
        })
        void obr
        if (error) throw error
      }
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível atualizar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusyObr(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo do Mês" value={d.saldo} icon={Wallet} tone={d.saldo >= 0 ? "teal" : "danger"} index={0}
          valueClassName={d.saldo >= 0 ? "text-success" : "text-destructive"}
          trend={<TrendPill atual={d.saldo} anterior={d.saldoAnt} mesRef={mesRef} />}
        />
        <StatCard
          label="Receitas" value={d.receitas} icon={ArrowDownLeft} tone="teal" index={1}
          valueClassName="text-success"
          trend={<TrendPill atual={d.receitas} anterior={d.receitasAnt} mesRef={mesRef} />}
        />
        <StatCard
          label="Despesas" value={d.despesas} icon={ArrowUpRight} tone="danger" index={2}
          valueClassName="text-destructive"
          trend={<TrendPill atual={d.despesas} anterior={d.despesasAnt} mesRef={mesRef} invertido />}
        />
        <StatCard
          label="Pendentes" value={d.pendentes} icon={Clock} tone="warning" index={3}
          valueClassName="text-warning"
        />
      </div>

      {/* Donut + Obrigações do mês */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <PieChart className="size-3.5" /> Gastos por Categoria
          </div>
          <CategoryDonut slices={d.slices} centerLabel="Total de gastos" centerValue={d.despesas} />
          <div className="mt-3 flex flex-col gap-1.5">
            {d.slices.slice(0, 4).map((s) => {
              const info = catInfo(s.catKey)
              const Icon = info.icon
              const pct = d.despesas > 0 ? Math.round((s.value / d.despesas) * 100) : 0
              return (
                <div key={s.catKey} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${catColor(s.catKey)}1f`, color: catColor(s.catKey) }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{s.label}</span>
                  <span className="tnum text-sm">{fmtR(s.value)}</span>
                  <span className="tnum w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Scale className="size-3.5" /> Obrigações do Mês
            </div>
            <span className="tnum text-xs text-muted-foreground">
              {d.pctComprometido.toFixed(0)}% comprometido
            </span>
          </div>
          <div className="mb-1 h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-series-previsto"
              initial={{ width: 0 }}
              animate={{ width: `${d.pctComprometido}%` }}
              transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {fmtR(d.totalObr)} de {fmtR(d.receitas)}
          </p>
          <div className="flex flex-col gap-1.5">
            {d.itens.length === 0 ? (
              <Empty>Nenhuma obrigação ativa neste mês</Empty>
            ) : (
              d.itens.map((i) => {
                const info = catInfo(i.categoria)
                const Icon = info.icon
                const cartao = i.tipo === "cartao" ? cartoes.find((c) => c.id === i.id) : null
                return (
                  <div
                    key={`${i.tipo}-${i.id}`}
                    className={cn("flex items-center gap-3 rounded-lg px-2 py-2", i.paga && "opacity-55")}
                  >
                    <button
                      onClick={() => toggleObrigacao(i)}
                      disabled={i.tipo === "cartao" || busyObr === i.id}
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                        i.paga ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary",
                        i.tipo === "cartao" && "cursor-default opacity-60"
                      )}
                      aria-label={i.paga ? "Marcar como não paga" : "Marcar como paga"}
                    >
                      {i.paga && <Check className="size-3.5" />}
                    </button>
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                      {cartao?.logo ? <img src={cartao.logo} alt="" className="size-full object-contain p-1" /> : <Icon className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", i.paga && "line-through")}>
                        {i.nome}
                        {i.tipo === "cartao" && (
                          <span className="ml-1.5 rounded bg-secondary px-1.5 py-px text-[0.6rem] uppercase text-muted-foreground">cartão</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dia {i.dia || "—"} · {i.parcTxt}
                      </p>
                    </div>
                    <span className="tnum text-sm font-medium">{fmtR(i.valor)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Histórico do mês */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-4 font-display text-lg font-semibold">Histórico do Mês</h3>
        {d.dias.length === 0 ? (
          <Empty>Nenhum lançamento neste mês</Empty>
        ) : (
          <div className="flex flex-col gap-4">
            {d.dias.map(([data, txs]) => (
              <div key={data}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {fmtData(data)}
                </p>
                <div className="flex flex-col gap-1">
                  {txs.map((t) => {
                    const info = catInfo(t.categoria)
                    const Icon = info.icon
                    const receita = t.tipo === "receita"
                    return (
                      <div key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-lg"
                          style={{ background: `${catColor(t.categoria)}1f`, color: catColor(t.categoria) }}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.descricao || info.l}</p>
                          <p className="text-xs" style={{ color: catColor(t.categoria) }}>{info.l}</p>
                        </div>
                        <span className={cn("tnum text-sm font-semibold", receita ? "text-success" : "text-destructive")}>
                          {receita ? "+ " : "− "}
                          {fmtR(Number(t.valor))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 py-8 text-center">
      <Inbox className="size-7 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
