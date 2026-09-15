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
import { DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"
import { useFinData } from "@/hooks/use-fin-data"

export function NovaTransacaoDialog() {
  const { loadAll } = useFinData()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa")
  const [descricao, setDescricao] = useState("")
  const [valor, setValor] = useState("")
  const [categoria, setCategoria] = useState("outro")
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  const cats = tipo === "receita" ? RECEITA_CATS : DESPESA_CATS

  function reset() {
    setTipo("despesa"); setDescricao(""); setValor(""); setCategoria("outro")
    setData(new Date().toISOString().slice(0, 10))
  }

  async function salvar() {
    const v = parseFloat(valor)
    if (!descricao.trim() || !v || !data) {
      toast.error("Preencha descrição, valor e data")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from("fin_transacoes").insert({
        tipo, descricao: descricao.trim(), valor: v, data, categoria, mes_ref: data.slice(0, 7),
      })
      if (error) throw error
      toast.success("Transação salva!")
      setOpen(false)
      reset()
      await loadAll()
    } catch (e) {
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" /> Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button" variant={tipo === "despesa" ? "default" : "outline"}
              onClick={() => { setTipo("despesa"); setCategoria("outro") }}
            >
              Despesa
            </Button>
            <Button
              type="button" variant={tipo === "receita" ? "default" : "outline"}
              onClick={() => { setTipo("receita"); setCategoria("outro") }}
            >
              Receita
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-desc">Descrição</Label>
            <Input id="tx-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Mercado, Salário..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-valor">Valor (R$)</Label>
              <Input id="tx-valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-data">Data</Label>
              <Input id="tx-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cats.map((c) => (
                    <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
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
