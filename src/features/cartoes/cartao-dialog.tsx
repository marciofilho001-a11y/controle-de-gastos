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
import { fechamentoDoCartao } from "@/lib/data-compra"

export function CartaoDialog({ editar, trigger, open: openCtl, onOpenChange }: { editar?: Cartao; trigger?: React.ReactNode; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const { loadAll } = useFinData()
  const [openInt, setOpenInt] = useState(false)
  const open = openCtl ?? openInt
  const setOpen = (v: boolean) => { setOpenInt(v); onOpenChange?.(v) }
  const [saving, setSaving] = useState(false)
  const [nome, setNome] = useState("")
  const [dia, setDia] = useState("")
  const [fecha, setFecha] = useState("")
  const [limite, setLimite] = useState("")

  useEffect(() => {
    if (open && editar) {
      setNome(editar.nome)
      setDia(editar.dia_vencimento ? String(editar.dia_vencimento) : "")
      setFecha(editar.dia_fechamento ? String(editar.dia_fechamento) : "")
      setLimite(editar.limite ? String(editar.limite) : "")
    } else if (open && !editar) {
      setNome(""); setDia(""); setFecha(""); setLimite("")
    }
  }, [open, editar])

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Preencha o nome do cartão")
      return
    }
    const diaOk = (v: string) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31)
    if (!diaOk(dia) || !diaOk(fecha)) {
      toast.error("Os dias de fechamento e vencimento vão de 1 a 31")
      return
    }
    setSaving(true)
    try {
      const payload = {
        nome: nome.trim(),
        dia_vencimento: parseInt(dia) || null,
        dia_fechamento: parseInt(fecha) || null,
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
              <Label htmlFor="c-fecha">Dia do fechamento</Label>
              <Input id="c-fecha" type="number" min="1" max="31" value={fecha} onChange={(e) => setFecha(e.target.value)} placeholder="Ex: 3" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-dia">Dia do vencimento</Label>
              <Input id="c-dia" type="number" min="1" max="31" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="Ex: 10" />
            </div>
          </div>
          <ExplicacaoCiclo fecha={parseInt(fecha) || null} venc={parseInt(dia) || null} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-limite">Limite (R$)</Label>
            <Input id="c-limite" type="number" step="0.01" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="opcional" />
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

// Resume o ciclo da fatura com os dias digitados (e avisa quando o fechamento está sendo estimado)
function ExplicacaoCiclo({ fecha, venc }: { fecha: number | null; venc: number | null }) {
  const f = fechamentoDoCartao({ dia_fechamento: fecha, dia_vencimento: venc })
  if (!f) return <p className="-mt-1 text-xs text-muted-foreground">Informe o fechamento e o vencimento da fatura.</p>
  if (f.estimado) {
    return (
      <p className="-mt-1 text-xs text-muted-foreground">
        Sem o dia de fechamento, o app estima <b className="text-foreground">dia {f.dia}</b> (7 dias antes do vencimento). Informe o dia certo para as compras caírem na fatura certa.
      </p>
    )
  }
  const mesSeguinte = !!venc && venc <= f.dia
  return (
    <p className="-mt-1 text-xs text-muted-foreground">
      Compras até o <b className="text-foreground">dia {f.dia}</b> entram na fatura que {venc ? <>vence <b className="text-foreground">dia {venc}</b> {mesSeguinte ? "do mês seguinte" : "do mesmo mês"}</> : "fecha neste mês"}; depois do dia {f.dia}, na fatura seguinte.
    </p>
  )
}
