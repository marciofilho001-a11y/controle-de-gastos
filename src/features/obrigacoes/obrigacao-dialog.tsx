import { useEffect, useState } from "react"
import { Plus, Loader2, Pencil } from "lucide-react"
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
import { supabase, type Obrigacao } from "@/lib/supabase"
import { DESPESA_CATS } from "@/lib/categorias"
import { useFinData } from "@/hooks/use-fin-data"
import { mesRefAtual } from "@/lib/format"

export function ObrigacaoDialog({
  editar,
  trigger,
}: {
  editar?: Obrigacao
  trigger?: React.ReactNode
}) {
  const { loadAll } = useFinData()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState("")
  const [valor, setValor] = useState("")
  const [dia, setDia] = useState("")
  const [categoria, setCategoria] = useState("outro")
  const [inicio, setInicio] = useState(mesRefAtual())
  const [totalParcelas, setTotalParcelas] = useState("")

  useEffect(() => {
    if (open && editar) {
      setNome(editar.nome)
      setValor(String(editar.valor))
      setDia(editar.dia_vencimento ? String(editar.dia_vencimento) : "")
      setCategoria(editar.categoria || "outro")
      setInicio(editar.data_inicio.slice(0, 7))
      setTotalParcelas(editar.parcela_total ? String(editar.parcela_total) : "")
    } else if (open && !editar) {
      setNome(""); setValor(""); setDia(""); setCategoria("outro")
      setInicio(mesRefAtual()); setTotalParcelas("")
    }
  }, [open, editar])

  async function salvar() {
    const v = parseFloat(valor)
    if (!nome.trim() || !v) {
      toast.error("Preencha nome e valor")
      return
    }
    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        valor: v,
        dia_vencimento: parseInt(dia) || null,
        categoria,
        data_inicio: inicio + "-01",
        parcela_total: parseInt(totalParcelas) || null,
      }
      const { error } = editar
        ? await supabase.from("fin_obrigacoes").update(payload).eq("id", editar.id)
        : await supabase.from("fin_obrigacoes").insert(payload)
      if (error) throw error
      toast.success("Obrigação salva!")
      setOpen(false)
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
        {trigger ?? (
          <Button>
            <Plus data-icon="inline-start" /> Nova Obrigação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editar ? "Editar Obrigação" : "Nova Obrigação"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obr-nome">Nome</Label>
            <Input id="obr-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Consórcio, Cartão Nubank..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obr-valor">Valor (R$)</Label>
              <Input id="obr-valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obr-dia">Dia vencimento</Label>
              <Input id="obr-dia" type="number" min="1" max="31" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="Ex: 10" />
            </div>
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obr-inicio">Mês da 1ª parcela</Label>
              <Input id="obr-inicio" type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="obr-total">Total de parcelas</Label>
              <Input id="obr-total" type="number" min="1" value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} placeholder="vazio = recorrente" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Preencha "Total de parcelas" para obrigações que terminam (financiamento, consórcio).
            Deixe vazio para recorrentes (assinaturas, aluguel).
          </p>
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

export const EditIcon = Pencil
