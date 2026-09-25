import { useMemo, useState } from "react"
import {
  ArrowUp, ArrowDown, TrendingUp, Clock, Scale, Check, Inbox, PieChart, ChevronRight,
} from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { StatCard } from "@/components/stat-card"
import { CategoryDonut, type DonutSlice } from "./category-donut"
import { PanoramaResumo } from "@/features/relatorio/panorama"
import { LancamentosFiltravel } from "./lancamentos-filtravel"
import { TransacaoDialog } from "@/features/transacoes/nova-transacao-dialog"
import { duplicarTransacao, excluirTransacao } from "@/lib/transacoes-actions"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"
import type { Transacao } from "@/lib/supabase"
import { TrendPill } from "./trend-pill"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase } from "@/lib/supabase"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, addMonths } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  receitasDoMes, despesasDoMes, txDoMes, itensObrigacoesDoMes, despesasExibicaoDoMes,
} from "@/lib/selectors"

export function DashboardPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes, descricaoIcones, loadAll } = useFinData()
  const [busyObr, setBusyObr] = useState<number | null>(null)
  const [verTodasCats, setVerTodasCats] = useState(false)
  const [editTx, setEditTx] = useState<Transacao | null>(null)
  const [delTx, setDelTx] = useState<Transacao | null>(null)
  const [busyTx, setBusyTx] = useState(false)

  async function duplicar(t: Transacao) {
    try { await duplicarTransacao(t, mesRef); toast.success("Lançamento duplicado neste mês"); await loadAll() }
    catch (e) { toast.error("Erro ao duplicar", { description: e instanceof Error ? e.message : "" }) }
  }
  async function confirmarExcluir() {
    if (!delTx) return
    setBusyTx(true)
    try { await excluirTransacao(delTx.id); toast.success("Lançamento removido"); setDelTx(null); await loadAll() }
    catch (e) { toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" }) }
    finally { setBusyTx(false) }
  }

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

    // donut de gastos por categoria (despesas do mês, SEM duplicação de cartão)
    const despMes = despesasExibicaoDoMes(transacoes, mesRef)
    const porCat = new Map<string, number>()
    for (const t of despMes) {
      const k = t.categoria || "outro"
      porCat.set(k, (porCat.get(k) || 0) + Number(t.valor))
    }
    const slices: DonutSlice[] = [...porCat.entries()]
      .map(([catKey, value]) => ({ catKey, label: catInfo(catKey).l, value }))
      .sort((a, b) => b.value - a.value)

    // histórico: receitas (cru) + despesas sem duplicação
    const receitasMes = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "receita")
    const hist = [...receitasMes, ...despMes]
    // agrupa por dia
    const grupos = new Map<string, typeof hist>()
    for (const t of hist) {
      const arr = grupos.get(t.data) || []
      arr.push(t)
      grupos.set(t.data, arr)
    }
    const dias = [...grupos.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))

    // sparkline do saldo: saldo acumulado dos últimos 6 meses (até o mês atual)
    const sparkSaldo: { mes: string; saldo: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(mesRef, -i)
      sparkSaldo.push({ mes: m, saldo: receitasDoMes(transacoes, m) - despesasDoMes(transacoes, m) })
    }

    // lista de lançamentos do mês (pra seção filtrável) — receitas + despesas sem duplicação
    const lancamentos = hist.slice().sort((a, b) => (a.data < b.data ? 1 : -1))

    // total de lançamentos do mês
    const totalLanc = lancamentos.length

    return { receitas, despesas, saldo, receitasAnt, despesasAnt, saldoAnt, itens, pendentes, totalObr, pctComprometido, slices, despesas_total: despesas, dias, sparkSaldo, lancamentos, totalLanc }
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
          label="Saldo do Mês" value={d.saldo} icon={TrendingUp} tone={d.saldo >= 0 ? "teal" : "danger"} index={0}
          valueClassName={d.saldo >= 0 ? "text-success" : "text-destructive"}
          trend={<TrendPill atual={d.saldo} anterior={d.saldoAnt} mesRef={mesRef} />}
          spark={d.sparkSaldo.map((s) => s.saldo)}
        />
        <StatCard
          label="Receitas" value={d.receitas} icon={ArrowUp} tone="teal" index={1}
          valueClassName="text-success"
          trend={<TrendPill atual={d.receitas} anterior={d.receitasAnt} mesRef={mesRef} />}
        />
        <StatCard
          label="Despesas" value={d.despesas} icon={ArrowDown} tone="danger" index={2}
          valueClassName="text-destructive"
          trend={<TrendPill atual={d.despesas} anterior={d.despesasAnt} mesRef={mesRef} invertido />}
        />
        <StatCard
          label="Pendentes" value={d.pendentes} icon={Clock} tone="warning" index={3}
          valueClassName="text-warning"
        />
      </div>

      {/* Panorama do mês — o gestor em 3 frases */}
      <PanoramaResumo mesRef={mesRef} />

      {/* Donut + Obrigações do mês */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <PieChart className="size-3.5" /> Gastos por Categoria
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-[minmax(190px,230px)_minmax(0,1fr)] sm:items-center">
            <CategoryDonut slices={d.slices} centerLabel="Despesas" centerValue={d.despesas} />
            <div className="flex flex-col gap-1">
              {(verTodasCats ? d.slices : d.slices.slice(0, 6)).map((s, i) => {
                const info = catInfo(s.catKey)
                const Icon = info.icon
                const pct = d.despesas > 0 ? Math.round((s.value / d.despesas) * 100) : 0
                return (
                  <motion.div
                    key={s.catKey}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.24, delay: i * 0.025, ease: [0.23, 1, 0.32, 1] }}
                    className="flex items-center gap-2.5 rounded-lg px-1.5 py-1"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `${catColor(s.catKey)}1f`, color: catColor(s.catKey) }}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="flex-1 truncate text-sm">{s.label}</span>
                    <span className="tnum text-sm font-medium">{fmtR(s.value)}</span>
                    <span className="tnum w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                  </motion.div>
                )
              })}
              {d.slices.length > 6 && (
                <button
                  onClick={() => setVerTodasCats((v) => !v)}
                  className="mt-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {verTodasCats ? "Ver menos" : `Ver todas as categorias (${d.slices.length})`}
                  <ChevronRight className={cn("size-3.5 transition-transform", verTodasCats && "rotate-90")} />
                </button>
              )}
            </div>
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

      {/* Lançamentos filtráveis (carrossel / grade) */}
      <LancamentosFiltravel
        lancamentos={d.lancamentos} cartoes={cartoes} descricaoIcones={descricaoIcones}
        onEdit={(t) => setEditTx(t)} onDuplicar={duplicar} onDelete={(t) => setDelTx(t)}
      />

      <TransacaoDialog editar={editTx} open={!!editTx} onOpenChange={(o) => !o && setEditTx(null)} />
      <AlertDialog open={delTx != null} onOpenChange={(o) => !o && setDelTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este lançamento?</AlertDialogTitle>
            <AlertDialogDescription>{delTx?.descricao} — esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmarExcluir() }} disabled={busyTx}>
              {busyTx && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
