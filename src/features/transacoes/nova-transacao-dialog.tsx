import { useEffect, useState } from "react"
import { Plus, Loader2, Banknote, CreditCard } from "lucide-react"
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
import { supabase, type Transacao } from "@/lib/supabase"
import { DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"
import { useFinData } from "@/hooks/use-fin-data"

const DEBITO = "debito"

// Dialog único de lançamento: cria ou edita (quando `editar` vem preenchido).
// Pode ser controlado de fora (open/onOpenChange) — útil a partir de um menu de ações —
// ou usar o próprio `trigger`.
export function TransacaoDialog({
  editar,
  trigger,
  open: openProp,
  onOpenChange,
  mesRefPadrao,
}: {
  editar?: Transacao | null
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (v: boolean) => void
  mesRefPadrao?: string
}) {
  const { cartoes, loadAll } = useFinData()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (v: boolean) => { setOpenState(v); onOpenChange?.(v) }

  const [saving, setSaving] = useState(false)
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa")
  const [descricao, setDescricao] = useState("")
  const [valor, setValor] = useState("")
  const [categoria, setCategoria] = useState("outro")
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [forma, setForma] = useState<string>(DEBITO) // "debito" | id do cartão
  const [mesFatura, setMesFatura] = useState("")

  const cartoesAtivos = cartoes.filter((c) => c.ativo !== false)
  const cats = tipo === "receita" ? RECEITA_CATS : DESPESA_CATS
  const noCartao = tipo === "despesa" && forma !== DEBITO

  useEffect(() => {
    if (!open) return
    if (editar) {
      setTipo(editar.tipo)
      setDescricao(editar.descricao || "")
      setValor(String(editar.valor))
      setCategoria(editar.categoria || "outro")
      setData(editar.data)
      setForma(editar.cartao_id ? String(editar.cartao_id) : DEBITO)
      setMesFatura(editar.mes_ref)
    } else {
      const hoje = new Date().toISOString().slice(0, 10)
      setTipo("despesa"); setDescricao(""); setValor(""); setCategoria("outro")
      setData(mesRefPadrao && !hoje.startsWith(mesRefPadrao) ? `${mesRefPadrao}-01` : hoje)
      setForma(DEBITO); setMesFatura(mesRefPadrao || hoje.slice(0, 7))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editar])

  // ao mudar a data, o mês da fatura acompanha (a menos que o usuário já tenha mexido nele)
  function mudarData(d: string) {
    setData(d)
    if (d && (!mesFatura || mesFatura === data.slice(0, 7))) setMesFatura(d.slice(0, 7))
  }

  async function salvar() {
    const v = parseFloat(valor)
    if (!descricao.trim() || !v || v <= 0 || !data) {
      toast.error("Preencha descrição, valor e data")
      return
    }
    const cartao_id = noCartao ? parseInt(forma) : null
    const mes_ref = noCartao && mesFatura ? mesFatura : data.slice(0, 7)
    const payload = {
      tipo, descricao: descricao.trim(), valor: v, data, categoria, mes_ref, cartao_id,
    }
    setSaving(true)
    try {
      const { error } = editar
        ? await supabase.from("fin_transacoes").update(payload).eq("id", editar.id)
        : await supabase.from("fin_transacoes").insert(payload)
      if (error) throw error
      toast.success(editar ? "Lançamento atualizado!" : "Lançamento salvo!")
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
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : openProp === undefined ? (
        <DialogTrigger asChild>
          <Button>
            <Plus data-icon="inline-start" /> Nova Transação
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editar ? "Editar Lançamento" : "Nova Transação"}</DialogTitle>
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
              onClick={() => { setTipo("receita"); setCategoria("outro"); setForma(DEBITO) }}
            >
              Receita
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-desc">Descrição</Label>
            <Input id="tx-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Mercado, Salário..." autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-valor">Valor (R$)</Label>
              <Input id="tx-valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-data">Data</Label>
              <Input id="tx-data" type="date" value={data} onChange={(e) => mudarData(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            {tipo === "despesa" && (
              <div className="flex flex-col gap-1.5">
                <Label>Forma de pagamento</Label>
                <Select value={forma} onValueChange={setForma}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={DEBITO}>
                        <span className="flex items-center gap-2"><Banknote className="size-3.5" /> Débito / dinheiro</span>
                      </SelectItem>
                      {cartoesAtivos.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <span className="flex items-center gap-2"><CreditCard className="size-3.5" /> {c.nome}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {noCartao && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-mes">Mês da fatura</Label>
              <Input id="tx-mes" type="month" value={mesFatura} onChange={(e) => setMesFatura(e.target.value)} />
              <span className="text-xs text-muted-foreground">
                Em qual fatura essa compra cai. Compras depois do fechamento vão pro mês seguinte.
              </span>
            </div>
          )}
          {editar && (editar.obrigacao_id || editar.compra_id) && (
            <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Este lançamento está vinculado a {editar.obrigacao_id ? "uma obrigação" : "uma compra parcelada"}. O vínculo é mantido ao salvar.
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

// compatibilidade: botão "Nova Transação" dos cabeçalhos
export function NovaTransacaoDialog({ mesRef }: { mesRef?: string }) {
  return <TransacaoDialog mesRefPadrao={mesRef} />
}
