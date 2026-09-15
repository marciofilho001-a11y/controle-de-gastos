import { useState } from "react"
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
import { supabase } from "@/lib/supabase"
import { DESPESA_CATS } from "@/lib/categorias"
import { useFinData } from "@/hooks/use-fin-data"
import { addMonths, mesRefAtual } from "@/lib/format"

export function CompraDialog() {
  const { cartoes, loadAll } = useFinData()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const cartoesAtivos = cartoes.filter((c) => c.ativo !== false)
  const [cartaoId, setCartaoId] = useState(cartoesAtivos[0]?.id ? String(cartoesAtivos[0].id) : "")
  const [descricao, setDescricao] = useState("")
  const [categoria, setCategoria] = useState("outro")
  const [valorParcela, setValorParcela] = useState("")
  const [numParcelas, setNumParcelas] = useState("1")
  const [mesInicio, setMesInicio] = useState(mesRefAtual())

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
      const { data: compraData, error: compraErr } = await supabase
        .from("fin_cartao_compras")
        .insert({
          cartao_id: cid, descricao: descricao.trim(), categoria,
          valor_parcela: vp, parcela_total: np, data_inicio: mesInicio + "-01",
        })
        .select()
      if (compraErr) throw compraErr
      const compraId = compraData![0].id

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

      toast.success(`Compra lançada — ${np} parcela(s) gerada(s)!`)
      setOpen(false)
      setDescricao(""); setValorParcela(""); setNumParcelas("1")
      await loadAll()
    } catch (e) {
      toast.error("Erro ao lançar compra", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={cartoesAtivos.length === 0}>
          <Plus data-icon="inline-start" /> Nova Compra / Parcelamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Compra / Parcelamento</DialogTitle>
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
              Serão geradas {numParcelas} parcelas de R$ {parseFloat(valorParcela).toFixed(2)} — total R$ {(parseFloat(valorParcela) * parseInt(numParcelas)).toFixed(2)}, uma por mês a partir do mês escolhido.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={salvar} disabled={saving}>
            {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
