import { useState } from "react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { Bell, ArrowRight, Check, Clock, Inbox, Sparkles } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase } from "@/lib/supabase"
import { registrarFaturaPaga, removerFaturaPaga } from "@/lib/pagamentos"
import { catInfo } from "@/lib/categorias"
import { fmtR, fmtData } from "@/lib/format"
import type { contasDoMes } from "@/lib/selectors"
import { LogoAvatar } from "@/components/logo-avatar"
import { InsightCard, PanoramaDialog, usePanorama } from "@/features/relatorio/panorama"
import { cn } from "@/lib/utils"
import { Painel, LinkAcao, EASE } from "./painel"

type Contas = ReturnType<typeof contasDoMes>

// "Atenção": o que falta pagar no mês (abre a lista de contas pra dar baixa) + os destaques do panorama
export function AtencaoCard({ contas, receitas, mesRef, index }: { contas: Contas; receitas: number; mesRef: string; index?: number }) {
  const [aberto, setAberto] = useState(false)
  const insights = usePanorama(mesRef).filter((i) => i.id !== "vazio").slice(0, 1)
  const n = contas.pendentes.length

  return (
    <Painel
      icon={Bell} titulo="Atenção" index={index}
      acao={
        <PanoramaDialog mesRef={mesRef} trigger={<LinkAcao><Sparkles className="size-3.5" /> Panorama</LinkAcao>} />
      }
    >
      {n > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            <span className="tnum font-semibold text-warning">{n}</span> pagamento{n > 1 ? "s" : ""} pendente{n > 1 ? "s" : ""}
            {contas.vencidas.length > 0 && (
              <span className="ml-1.5 rounded-md bg-destructive/12 px-1.5 py-0.5 text-xs font-medium text-destructive">
                {contas.vencidas.length} vencida{contas.vencidas.length > 1 ? "s" : ""}
              </span>
            )}
          </p>
          <p className="tnum text-2xl font-bold text-warning">{fmtR(contas.totalPendente)}</p>
        </div>
      ) : contas.itens.length > 0 ? (
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <span className="grid size-6 place-items-center rounded-full bg-success/15"><Check className="size-3.5" /></span>
          Tudo pago neste mês
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma conta ativa neste mês</p>
      )}

      {contas.itens.length > 0 && (
        <button
          type="button" onClick={() => setAberto(true)}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-primary/40 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {n > 0 ? "Ver pendências" : "Ver contas do mês"} <ArrowRight className="size-4" />
        </button>
      )}

      {insights.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t pt-4">
          {insights.map((i, idx) => <InsightCard key={i.id} insight={i} index={idx} compacto />)}
        </div>
      )}

      <ContasDialog open={aberto} onOpenChange={setAberto} contas={contas} receitas={receitas} mesRef={mesRef} />
    </Painel>
  )
}

// Lista de contas do mês com a baixa (marcar/desmarcar como paga) — o antigo "Contas do Mês"
function ContasDialog({
  open, onOpenChange, contas, receitas, mesRef,
}: { open: boolean; onOpenChange: (o: boolean) => void; contas: Contas; receitas: number; mesRef: string }) {
  const { cartoes, loadAll } = useFinData()
  const [busy, setBusy] = useState<string | null>(null)
  const pctComprometido = receitas > 0 ? Math.min(100, (contas.total / receitas) * 100) : 0

  async function alternar(item: Contas["itens"][number]) {
    const chave = `${item.tipo}-${item.id}`
    setBusy(chave)
    try {
      if (item.tipo === "cartao") {
        if (item.paga) await removerFaturaPaga(item.id, mesRef)
        else await registrarFaturaPaga(item.id, mesRef, item.valor)
        toast.success(item.paga ? "Fatura reaberta" : `${item.nome} marcada como paga`)
      } else if (item.paga) {
        const { error } = await supabase.from("fin_transacoes").delete().eq("obrigacao_id", item.id).eq("mes_ref", mesRef)
        if (error) throw error
      } else {
        const { error } = await supabase.from("fin_transacoes").insert({
          tipo: "despesa", descricao: item.nome, valor: item.valor, categoria: item.categoria,
          data: `${mesRef}-${String(item.dia || 1).padStart(2, "0")}`, mes_ref: mesRef, obrigacao_id: item.id,
        })
        if (error) throw error
      }
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível atualizar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contas do mês</DialogTitle>
          <DialogDescription>Marque o que já foi pago. Fatura de cartão e obrigações entram aqui.</DialogDescription>
        </DialogHeader>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span className="tnum">{fmtR(contas.total)} de {fmtR(receitas)}</span>
            <span className="tnum">{pctComprometido.toFixed(0)}% comprometido</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-series-previsto"
              initial={{ width: 0 }} animate={{ width: `${pctComprometido}%` }} transition={{ duration: 0.5, ease: EASE }} />
          </div>
          {contas.pendentes.length > 0 && (
            <p className="mt-2 flex w-fit items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
              <Clock className="size-3" /> Falta pagar {fmtR(contas.totalPendente)}
            </p>
          )}
        </div>
        <div className="-mx-6 max-h-[55vh] overflow-y-auto px-6">
          {contas.itens.length === 0 ? (
            <div className="grid place-items-center gap-2 py-8 text-center">
              <Inbox className="size-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Nenhuma conta ativa neste mês</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {contas.itens.map((i) => {
                const Icon = catInfo(i.categoria).icon
                const cartao = i.tipo === "cartao" ? cartoes.find((c) => c.id === i.id) : null
                const chave = `${i.tipo}-${i.id}`
                return (
                  <div key={chave} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", i.paga && "opacity-55")}>
                    <button
                      onClick={() => alternar(i)} disabled={busy === chave}
                      className={cn("grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                        i.paga ? "border-success bg-success text-success-foreground" : "border-border hover:border-primary")}
                      aria-label={i.paga ? "Marcar como não paga" : "Marcar como paga"}
                    >
                      {i.paga && <Check className="size-3.5" />}
                    </button>
                    <LogoAvatar src={cartao?.logo} cor="var(--muted-foreground)" Icon={Icon} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", i.paga && "line-through")}>
                        {i.nome}
                        {i.tipo === "cartao" && <span className="ml-1.5 rounded bg-secondary px-1.5 py-px text-[0.6rem] uppercase text-muted-foreground">cartão</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {i.paga && i.pagoEm ? <>Pago em {fmtData(i.pagoEm)} · {i.parcTxt}</> : <>Dia {i.dia || "—"} · {i.parcTxt}</>}
                      </p>
                    </div>
                    <span className="tnum text-sm font-medium">{fmtR(i.valor)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
