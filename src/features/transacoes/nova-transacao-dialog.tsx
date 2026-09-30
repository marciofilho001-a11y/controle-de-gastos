import { useEffect, useState } from "react"
import { Plus, Loader2, Banknote, CreditCard, Layers } from "lucide-react"
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
import { addMonths, fmtR, fmtMesCurto } from "@/lib/format"
import { infoParcela, parcelasIrmas, baseDescricao, descricaoIrma } from "@/lib/parcelas"
import { Switch } from "@/components/ui/switch"
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
  const { cartoes, transacoes, loadAll } = useFinData()
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
  const [parcelas, setParcelas] = useState("1")        // novo lançamento: nº de parcelas (1 = à vista)
  const [parcAtual, setParcAtual] = useState("")       // edição: parcela atual / total
  const [parcTotal, setParcTotal] = useState("")
  const [aplicarTodas, setAplicarTodas] = useState(true) // edição de parcela: levar a mudança pras outras parcelas

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
      const p = infoParcela(editar)
      setParcAtual(p ? String(p.atual) : ""); setParcTotal(p ? String(p.total) : ""); setParcelas("1")
      setAplicarTodas(true)
    } else {
      const hoje = new Date().toISOString().slice(0, 10)
      setTipo("despesa"); setDescricao(""); setValor(""); setCategoria("outro")
      setData(mesRefPadrao && !hoje.startsWith(mesRefPadrao) ? `${mesRefPadrao}-01` : hoje)
      setForma(DEBITO); setMesFatura(mesRefPadrao || hoje.slice(0, 7))
      setParcelas("1"); setParcAtual(""); setParcTotal("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editar])

  // ao mudar a data, o mês da fatura acompanha (a menos que o usuário já tenha mexido nele)
  function mudarData(d: string) {
    setData(d)
    if (d && (!mesFatura || mesFatura === data.slice(0, 7))) setMesFatura(d.slice(0, 7))
  }

  const irmas = editar ? parcelasIrmas(editar, transacoes) : []

  const nParc = tipo === "despesa" && !editar ? Math.max(1, Math.min(72, parseInt(parcelas) || 1)) : 1
  const vNum = parseFloat(valor) || 0

  async function salvar() {
    const v = parseFloat(valor)
    if (!descricao.trim() || !v || v <= 0 || !data) {
      toast.error("Preencha descrição, valor e data")
      return
    }
    const cartao_id = noCartao ? parseInt(forma) : null
    const mes_ref = noCartao && mesFatura ? mesFatura : data.slice(0, 7)
    setSaving(true)
    try {
      if (editar) {
        const pt = parseInt(parcTotal) || 0
        const pa = parseInt(parcAtual) || 0
        const payload = {
          tipo, descricao: descricao.trim(), valor: v, data, categoria, mes_ref, cartao_id,
          parcela_total: pt > 1 ? pt : null,
          parcela_atual: pt > 1 ? Math.min(Math.max(1, pa || 1), pt) : null,
        }
        const { error } = await supabase.from("fin_transacoes").update(payload).eq("id", editar.id)
        if (error) throw error
        if (aplicarTodas && irmas.length) {
          // mesmas mudanças nas outras parcelas: nome, categoria, valor da parcela e cartão;
          // se o mês da fatura mudou, todas andam o mesmo tanto
          const novaBase = baseDescricao(descricao)
          const desloc = mesesEntre(editar.mes_ref, mes_ref)
          for (const o of irmas) {
            const { error: e2 } = await supabase.from("fin_transacoes").update({
              descricao: descricaoIrma(novaBase, o), categoria, valor: v, cartao_id,
              ...(desloc ? { mes_ref: addMonths(o.mes_ref, desloc), data: somarMesesData(o.data, desloc) } : {}),
            }).eq("id", o.id)
            if (e2) throw e2
          }
          if (editar.compra_id) {
            await supabase.from("fin_cartao_compras").update({ descricao: novaBase, categoria, valor_parcela: v }).eq("id", editar.compra_id)
          }
          toast.success(`Lançamento atualizado em ${irmas.length + 1} parcelas`)
        } else {
          toast.success("Lançamento atualizado!")
        }
      } else if (nParc <= 1) {
        const { error } = await supabase.from("fin_transacoes").insert({
          tipo, descricao: descricao.trim(), valor: v, data, categoria, mes_ref, cartao_id,
        })
        if (error) throw error
        toast.success("Lançamento salvo!")
      } else {
        // parcelado: no cartão registra a compra (igual ao "Nova Compra"); no débito só as parcelas.
        let compra_id: number | null = null
        if (cartao_id) {
          const { data: compra, error: cErr } = await supabase.from("fin_cartao_compras").insert({
            cartao_id, descricao: descricao.trim(), categoria, valor_parcela: v, parcela_total: nParc, data_inicio: data,
          }).select()
          if (cErr) throw cErr
          compra_id = compra![0].id
        }
        const dia = data.slice(8, 10)
        const linhas = Array.from({ length: nParc }, (_, i) => {
          const m = addMonths(mes_ref, i)
          const [ano, mes] = m.split("-").map(Number)
          const ultimo = new Date(ano, mes, 0).getDate()
          const dataParc = i === 0 ? data : `${m}-${String(Math.min(Number(dia), ultimo)).padStart(2, "0")}`
          return {
            tipo, descricao: `${descricao.trim()} (${i + 1}/${nParc})`, valor: v, categoria,
            data: dataParc, mes_ref: m, cartao_id, compra_id, parcela_atual: i + 1, parcela_total: nParc,
          }
        })
        const { error } = await supabase.from("fin_transacoes").insert(linhas)
        if (error) throw error
        toast.success(`${nParc} parcelas de ${fmtR(v)} lançadas`, { description: `Total ${fmtR(v * nParc)} até ${fmtMesCurto(addMonths(mes_ref, nParc - 1))}` })
      }
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
          {tipo === "despesa" && !editar && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-parc" className="flex items-center gap-1.5"><Layers className="size-3.5" /> Parcelas</Label>
              <div className="grid grid-cols-[110px_1fr] items-center gap-3">
                <Input id="tx-parc" type="number" min={1} max={72} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
                <span className="text-xs text-muted-foreground">
                  {nParc <= 1
                    ? "À vista (1x). Informe 2 ou mais pra dividir em parcelas mensais."
                    : `${nParc}x de ${fmtR(vNum)} = ${fmtR(vNum * nParc)} · uma parcela por mês a partir de ${fmtMesCurto(mesFatura || data.slice(0, 7))}`}
                </span>
              </div>
            </div>
          )}
          {tipo === "despesa" && editar && (
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5"><Layers className="size-3.5" /> Parcela</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={parcAtual} onChange={(e) => setParcAtual(e.target.value)} placeholder="atual" className="w-24" />
                <span className="text-sm text-muted-foreground">de</span>
                <Input type="number" min={1} value={parcTotal} onChange={(e) => setParcTotal(e.target.value)} placeholder="total" className="w-24" />
                <span className="text-xs text-muted-foreground">Deixe vazio se não é parcelado. Aparece como "Pago 2/5".</span>
              </div>
            </div>
          )}
          {editar && irmas.length > 0 && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5">
              <Switch checked={aplicarTodas} onCheckedChange={setAplicarTodas} />
              <span className="text-sm leading-tight">
                Aplicar nas outras {irmas.length} parcela{irmas.length > 1 ? "s" : ""}
                <span className="block text-xs text-muted-foreground">
                  {irmas.map((o) => `${infoParcela(o)?.atual}/${infoParcela(o)?.total} ${fmtMesCurto(o.mes_ref)}`).join(" · ")} — nome, categoria, valor e cartão
                </span>
              </span>
            </label>
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

function mesesEntre(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number)
  const [a2, m2] = ate.split("-").map(Number)
  return (a2 - a1) * 12 + (m2 - m1)
}
function somarMesesData(data: string, n: number): string {
  const [a, m, d] = data.split("-").map(Number)
  const ultimo = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate()
  return new Date(Date.UTC(a, m - 1 + n, Math.min(d, ultimo))).toISOString().slice(0, 10)
}

// compatibilidade: botão "Nova Transação" dos cabeçalhos
export function NovaTransacaoDialog({ mesRef }: { mesRef?: string }) {
  return <TransacaoDialog mesRefPadrao={mesRef} />
}
