import { useEffect, useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase, type Cartao } from "@/lib/supabase"
import { useFinData } from "@/hooks/use-fin-data"

export function CartaoDialog({ editar, trigger }: { editar?: Cartao; trigger?: React.ReactNode }) {
  const { loadAll } = useFinData()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState("")
  const [dia, setDia] = useState("")
  const [limite, setLimite] = useState("")

  useEffect(() => {
    if (open && editar) {
      setNome(editar.nome)
      setDia(editar.dia_vencimento ? String(editar.dia_vencimento) : "")
      setLimite(editar.limite ? String(editar.limite) : "")
    } else if (open && !editar) {
      setNome(""); setDia(""); setLimite("")
    }
  }, [open, editar])

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Preencha o nome do cartão")
      return
    }
    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        dia_vencimento: parseInt(dia) || null,
        limite: parseFloat(limite) || null,
      }
      const { error } = editar
        ? await supabase.from("fin_cartoes").update(payload).eq("id", editar.id)
        : await supabase.from("fin_cartoes").insert(payload)
      if (error) throw error
      toast.success("Cartão salvo!")
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
          <Button variant="outline">
            <Plus data-icon="inline-start" /> Novo Cartão
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editar ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-nome">Nome</Label>
            <Input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nubank, Inter..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-dia">Dia vencimento</Label>
              <Input id="c-dia" type="number" min="1" max="31" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="Ex: 10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-limite">Limite (R$)</Label>
              <Input id="c-limite" type="number" step="0.01" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="opcional" />
            </div>
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
