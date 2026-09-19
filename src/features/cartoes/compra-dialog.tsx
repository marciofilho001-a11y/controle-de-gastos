import { useEffect, useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { supabase, type CartaoCompra } from "@/lib/supabase"
import { DESPESA_CATS } from "@/lib/categorias"
import { useFinData } from "@/hooks/use-fin-data"
import { addMonths, mesRefAtual } from "@/lib/format"

export function CompraDialog({ editar, trigger }: { editar?: CartaoCompra; trigger?: React.ReactNode }) {
  const { cartoes, loadAll } = useFinData()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const cartoesAtivos = cartoes.filter((c) => c.ativo !== false)
  const [cartaoId, setCartaoId] = useState("")
  const [descricao, setDescricao] = useState("")
  const [categoria, setCategoria] = useState("outro")
  const [valorParcela, setValorParcela] = useState("")
  const [numParcelas, setNumParcelas] = useState("1")
  const [mesInicio, setMesInicio] = useState(mesRefAtual())

  useEffect(() => {
    if (!open) return
    if (editar) {
      setCartaoId(String(editar.cartao_id))
      setDescricao(editar.descricao || "")
      setCategoria(editar.categoria || "outro")
      setValorParcela(String(editar.valor_parcela))
      setNumParcelas(String(editar.parcela_total || 1))
      setMesInicio(editar.data_inicio.slice(0, 7))
    } else {
      setCartaoId(cartoesAtivos[0]?.id ? String(cartoesAtivos[0].id) : "")
      setDescricao(""); setCategoria("outro"); setValorParcela(""); setNumParcelas("1"); setMesInicio(mesRefAtual())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editar])

  async function salvar() {
    const cid = parseInt(cartaoId)
    const vp = parseFloat(valorParcela)
    const np = parseInt(numParcelas) || 1
    if (!cid || !descricao.trim() || !vp || vp <= 0 || !mesInicio) {
      toast.error("Preencha cartão, descrição, valor e mês")
      return
    }
    setSaving(true)
    try {
      let compraId: number
      if (editar) {
        const { error: upErr } = await supabase
          .from("fin_cartao_compras")
          .update({
            cartao_id: cid, descricao: descricao.trim(), categoria,
            valor_parcela: vp, parcela_total: np, data_inicio: mesInicio + "-01",
          })
          .eq("id", editar.id)
        if (upErr) throw upErr
        compraId = editar.id
        // remove as parcelas antigas antes de regenerar
        const { error: delErr } = await supabase.from("fin_transacoes").delete().eq("compra_id", compraId)
        if (delErr) throw delErr
      } else {
        const { data: compraData, error: compraErr } = await supabase
          .from("fin_cartao_compras")
          .insert({
            cartao_id: cid, descricao: descricao.trim(), categoria,
            valor_parcela: vp, parcela_total: np, data_inicio: mesInicio + "-01",
          })
          .select()
        if (compraErr) throw compraErr
        compraId = compraData![0].id
      }

      const linhas = Array.from({ length: np }, (_, i) => ({
        tipo: "despesa",
        descricao: np > 1 ? `${descricao.trim()} (${i + 1}/${np})` : descricao.trim(),
        valor: vp,
        categoria,
        data: addMonths(mesInicio, i) + "-01",
        mes_ref: addMonths(mesInicio, i),
        cartao_id: cid,
        compra_id: compraId,
        parcela_atual: i + 1,
        parcela_total: np,
      }))
      const { error: txErr } = await supabase.from("fin_transacoes").insert(linhas)
      if (txErr) throw txErr

      toast.success(editar ? "Compra atualizada!" : `Compra lançada — ${np} parcela(s) gerada(s)!`)
      setOpen(false)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao salvar compra", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={cartoesAtivos.length === 0}>
            <Plus data-icon="inline-start" /> Nova Compra / Parcelamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editar ? "Editar Compra / Parcelamento" : "Nova Compra / Parcelamento"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Cartão</Label>
            <Select value={cartaoId} onValueChange={setCartaoId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cartoesAtivos.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cp-desc">Descrição</Label>
            <Input id="cp-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Notebook, Mercado..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-valor">Valor da parcela (R$)</Label>
              <Input id="cp-valor" type="number" step="0.01" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-parc">Nº de parcelas</Label>
              <Input id="cp-parc" type="number" min="1" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DESPESA_CATS.map((c) => (
                      <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-mes">Mês da 1ª parcela</Label>
              <Input id="cp-mes" type="month" value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} />
            </div>
          </div>
          {parseInt(numParcelas) > 1 && parseFloat(valorParcela) > 0 && (
            <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Serão {editar ? "regeneradas" : "geradas"} {numParcelas} parcelas de R$ {parseFloat(valorParcela).toFixed(2)} — total R$ {(parseFloat(valorParcela) * parseInt(numParcelas)).toFixed(2)}, uma por mês a partir do mês escolhido.
            </p>
          )}
          {editar && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Ao salvar, as parcelas antigas desta compra são substituídas pelas novas.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {editar ? "Salvar" : "Lançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
