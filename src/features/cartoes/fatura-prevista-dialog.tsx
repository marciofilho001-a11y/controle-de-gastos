import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase, type Cartao } from "@/lib/supabase"
import { useFinData } from "@/hooks/use-fin-data"
import { ehFaturaCheia, faturaInfoDoMes } from "@/lib/selectors"
import { fmtR, fmtMesRef } from "@/lib/format"

// Editor rápido da "fatura prevista" (valor cheio da fatura) de um cartão, no mês navegado.
// Opera na transação FATURA daquele mês: cria, atualiza ou consolida.
export function FaturaPrevistaDialog({
  cartao, mesRef, trigger,
}: {
  cartao: Cartao
  mesRef: string
  trigger: React.ReactNode
}) {
  const { transacoes, compras, loadAll } = useFinData()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [valor, setValor] = useState("")

  const cheias = useMemo(
    () => transacoes.filter(
      (t) => t.cartao_id === cartao.id && t.mes_ref === mesRef && t.tipo === "despesa" && ehFaturaCheia(t)
    ),
    [transacoes, cartao.id, mesRef]
  )
  const fatInfo = useMemo(() => faturaInfoDoMes(transacoes, cartao.id, mesRef), [transacoes, cartao.id, mesRef])
  const valorAtual = cheias.reduce((s, t) => s + Number(t.valor), 0)

  useEffect(() => {
    if (open) setValor(valorAtual > 0 ? String(valorAtual) : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function salvar() {
    const v = parseFloat(valor)
    if (isNaN(v) || v <= 0) {
      toast.error("Informe um valor de fatura maior que zero")
      return
    }
    setSaving(true)
    try {
      if (cheias.length === 0) {
        // não existe fatura cheia neste mês: cria uma
        const { error } = await supabase.from("fin_transacoes").insert({
          tipo: "despesa", cartao_id: cartao.id, mes_ref: mesRef,
          data: mesRef + "-01", descricao: "FATURA", valor: v, categoria: "cartao",
        })
        if (error) throw error
      } else {
        // atualiza a primeira e remove eventuais duplicadas
        const principal = cheias[0]
        const { error } = await supabase.from("fin_transacoes").update({ valor: v }).eq("id", principal.id)
        if (error) throw error
        const extras = cheias.slice(1).map((t) => t.id)
        if (extras.length) await supabase.from("fin_transacoes").delete().in("id", extras)
        // se a fatura é de parcela única e vem de uma compra, mantém a compra em sincronia
        if (principal.compra_id) {
          const compra = compras.find((c) => c.id === principal.compra_id)
          if (compra && compra.parcela_total === 1) {
            await supabase.from("fin_cartao_compras").update({ valor_parcela: v }).eq("id", compra.id)
          }
        }
      }
      toast.success("Fatura prevista atualizada!")
      setOpen(false)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao salvar fatura", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fatura prevista — {cartao.nome}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm text-muted-foreground">
            Valor cheio da fatura de <span className="font-medium capitalize text-foreground">{fmtMesRef(mesRef)}</span>.
            {fatInfo.detalhado > 0 && (
              <> Já há <span className="tnum text-success">{fmtR(fatInfo.detalhado)}</span> detalhado em itens — o restante vira "fatura indefinida".</>
            )}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fp-valor">Valor da fatura (R$)</Label>
            <Input
              id="fp-valor" type="number" step="0.01" value={valor}
              onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") salvar() }}
            />
          </div>
          {fatInfo.detalhado > 0 && parseFloat(valor) > 0 && parseFloat(valor) >= fatInfo.detalhado && (
            <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Detalhado {fmtR(fatInfo.detalhado)} · Fatura indefinida {fmtR(parseFloat(valor) - fatInfo.detalhado)}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
