import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { type DonutSlice } from "./category-donut"
import { LancamentosFiltravel } from "./lancamentos-filtravel"
import { HeroResumo } from "./hero-resumo"
import { FluxoMeses } from "./fluxo-meses"
import { DespesasCategoria } from "./despesas-categoria"
import { AtencaoCard } from "./atencao-card"
import { ChecklistResumo } from "./checklist-resumo"
import { UltimosLancamentos } from "./ultimos-lancamentos"
import { EASE } from "./painel"
import { TransacaoDialog } from "@/features/transacoes/nova-transacao-dialog"
import { duplicarTransacao, excluirTransacao } from "@/lib/transacoes-actions"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Transacao } from "@/lib/supabase"
import type { TabId } from "@/components/layout/nav"
import { useFinData } from "@/hooks/use-fin-data"
import { EssencialResumo } from "@/features/essencial/essencial-card"
import { checklistFechamento } from "@/lib/checklist-fechamento"
import { catInfo } from "@/lib/categorias"
import { addMonths, fmtMesLongo } from "@/lib/format"
import {
  receitasDoMes, despesasDoMes, txDoMes, despesasExibicaoDoMes, contasDoMes,
} from "@/lib/selectors"

function saudacao(): string {
  const h = new Date().getHours()
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
}

export function DashboardPage({ mesRef, onNavigate }: { mesRef: string; onNavigate: (t: TabId) => void }) {
  const { obrigacoes, cartoes, transacoes, descricaoIcones, config, loadAll, faturaPagamentos } = useFinData()
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
    const mesAnt = addMonths(mesRef, -1)
    const contas = contasDoMes(obrigacoes, cartoes, transacoes, mesRef, faturaPagamentos)

    // categorias (despesas do mês, sem duplicar fatura de cartão)
    const despMes = despesasExibicaoDoMes(transacoes, mesRef)
    const porCat = new Map<string, number>()
    for (const t of despMes) porCat.set(t.categoria || "outro", (porCat.get(t.categoria || "outro") || 0) + Number(t.valor))
    const slices: DonutSlice[] = [...porCat.entries()]
      .map(([catKey, value]) => ({ catKey, label: catInfo(catKey).l, value }))
      .sort((a, b) => b.value - a.value)

    // saldo dos últimos 6 meses (até o mês navegado)
    const serieSaldo = Array.from({ length: 6 }, (_, i) => {
      const m = addMonths(mesRef, i - 5)
      return { mes: m, saldo: receitasDoMes(transacoes, m) - despesasDoMes(transacoes, m) }
    })

    // lançamentos do mês: receitas + despesas sem duplicação, mais recentes primeiro
    const receitasMes = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "receita")
    const lancamentos = [...receitasMes, ...despMes].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id))

    const checks = checklistFechamento({
      transacoes, cartoes, obrigacoes, faturaPagamentos, config, mesRef, hoje: new Date().toISOString().slice(0, 10),
    })

    return {
      receitas, despesas, saldo: receitas - despesas,
      receitasAnt: receitasDoMes(transacoes, mesAnt), despesasAnt: despesasDoMes(transacoes, mesAnt),
      contas, slices, serieSaldo, lancamentos, checks,
    }
  }, [obrigacoes, cartoes, transacoes, faturaPagamentos, config, mesRef])

  const irParaLancamentos = () => document.getElementById("lancamentos")?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <div className="flex flex-col gap-5">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
        <h2 className="font-ui text-2xl font-semibold tracking-tight">{saudacao()}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Aqui está o resumo do seu mês financeiro · {fmtMesLongo(mesRef)}</p>
      </motion.div>

      <HeroResumo
        mesRef={mesRef} saldo={d.saldo} receitas={d.receitas} despesas={d.despesas}
        receitasAnt={d.receitasAnt} despesasAnt={d.despesasAnt}
        pendentes={d.contas.totalPendente} nPendentes={d.contas.pendentes.length} serie={d.serieSaldo}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <FluxoMeses transacoes={transacoes} mesRef={mesRef} index={1} />
        <DespesasCategoria slices={d.slices} total={d.despesas} index={2} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <EssencialResumo mesRef={mesRef} index={3} />
        <AtencaoCard contas={d.contas} receitas={d.receitas} mesRef={mesRef} index={4} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ChecklistResumo checks={d.checks} onVerTodos={() => onNavigate("fechamento")} index={5} />
        <UltimosLancamentos lancamentos={d.lancamentos} onEditar={setEditTx} onVerTodos={irParaLancamentos} index={6} />
      </div>

      {/* Lançamentos filtráveis (carrossel / grade) — a lista completa */}
      <div id="lancamentos" className="scroll-mt-4">
      <LancamentosFiltravel
        lancamentos={d.lancamentos} cartoes={cartoes} descricaoIcones={descricaoIcones}
        onEdit={(t) => setEditTx(t)} onDuplicar={duplicar} onDelete={(t) => setDelTx(t)}
      />
      </div>

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
