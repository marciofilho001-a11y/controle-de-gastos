import { useMemo, useState } from "react"
import {
  Clock, Plus, Search, Inbox, Sparkles, CheckCheck, CreditCard, CalendarClock, Layers, X, ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { CategoryDonut, type DonutSlice } from "@/features/dashboard/category-donut"
import { ItemIcon } from "./item-icon"
import { RowActions } from "@/components/row-actions"
import { TransacaoDialog } from "@/features/transacoes/nova-transacao-dialog"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Cartao, type Transacao } from "@/lib/supabase"
import { DESPESA_CATS, catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtMesRef, mesRefAtual, fmtData } from "@/lib/format"
import { faturaDoMes, faturaInfoDoMes, ehFaturaCheia, mesesDoCartao, sugestoesParcelasParaMes } from "@/lib/selectors"
import { cn } from "@/lib/utils"

export function FaturaDetalhe({
  cartao,
  onVoltar,
  mesRefBase,
}: {
  cartao: Cartao
  onVoltar: () => void
  mesRefBase: string
}) {
  const { transacoes, compras, faturaItens, loadAll } = useFinData()
  const [mesSel, setMesSel] = useState<string>("")
  const [busca, setBusca] = useState("")
  const [catFiltro, setCatFiltro] = useState<string | null>(null)
  const [novoDesc, setNovoDesc] = useState("")
  const [novoCat, setNovoCat] = useState("outro")
  const [novoValor, setNovoValor] = useState("")
  const [busy, setBusy] = useState(false)
  const [editTx, setEditTx] = useState<Transacao | null>(null)

  const meses = useMemo(
    () => mesesDoCartao(cartao.id, transacoes, compras, faturaItens, mesRefBase),
    [cartao, transacoes, compras, faturaItens, mesRefBase]
  )

  const mesAtivo = useMemo(() => {
    // se o usuário escolheu um mês na lista, usa ele; senão abre no mês que está navegando
    if (mesSel && meses.includes(mesSel)) return mesSel
    return mesRefBase
  }, [mesSel, meses, mesRefBase])

  const dados = useMemo(() => {
    const fatInfo = faturaInfoDoMes(transacoes, cartao.id, mesAtivo)
    const valorFatura = fatInfo.valor
    const hoje = mesRefAtual()
    const ehFuturo = mesAtivo > hoje
    // FONTE ÚNICA: os itens do detalhe vêm das transações do cartão (menos a "fatura cheia")
    const todosItens = transacoes.filter(
      (t) => t.cartao_id === cartao.id && t.mes_ref === mesAtivo && t.tipo === "despesa" && !ehFaturaCheia(t)
    )
    const somaItens = todosItens.reduce((s, i) => s + Number(i.valor), 0)
    const planejando = valorFatura <= 0 && ehFuturo
    const valor = planejando ? somaItens : valorFatura
    // "fatura indefinida" = parte da fatura ainda não detalhada em itens
    const restante = planejando ? 0 : fatInfo.indefinido

    let itens = catFiltro ? todosItens.filter((i) => i.categoria === catFiltro) : todosItens
    const b = busca.trim().toLowerCase()
    if (b) itens = itens.filter((i) => (i.descricao || "").toLowerCase().includes(b))

    const porCat = new Map<string, number>()
    for (const i of todosItens) {
      const k = i.categoria || "outro"
      porCat.set(k, (porCat.get(k) || 0) + Number(i.valor))
    }
    const slices: DonutSlice[] = [...porCat.entries()]
      .map(([catKey, value]) => ({ catKey, label: catInfo(catKey).l, value }))
      .sort((a, b) => b.value - a.value)

    const sugestoes = sugestoesParcelasParaMes(faturaItens, cartao.id, mesAtivo, todosItens as any)
    return { valorFatura, ehFuturo, todosItens, somaItens, planejando, valor, restante, itens, slices, sugestoes }
  }, [cartao, transacoes, faturaItens, mesAtivo, catFiltro, busca])

  async function addItem() {
    const v = parseFloat(novoValor)
    if (!novoDesc.trim() || isNaN(v) || v <= 0) {
      toast.error("Preencha descrição e valor do item")
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.from("fin_transacoes").insert({
        tipo: "despesa", cartao_id: cartao.id, mes_ref: mesAtivo,
        data: mesAtivo + "-01", descricao: novoDesc.trim(), valor: v, categoria: novoCat,
      })
      if (error) throw error
      toast.success("Item adicionado!")
      setNovoDesc(""); setNovoValor(""); setBusca("")
      await loadAll()
    } catch (e) {
      toast.error("Erro ao adicionar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  async function delItem(id: number) {
    setBusy(true)
    try {
      const { error } = await supabase.from("fin_transacoes").delete().eq("id", id)
      if (error) throw error
      toast.success("Item removido")
      await loadAll()
    } catch (e) {
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  async function mudarCategoria(id: number, categoria: string) {
    try {
      const { error } = await supabase.from("fin_transacoes").update({ categoria }).eq("id", id)
      if (error) throw error
      await loadAll()
    } catch (e) {
      toast.error("Erro ao mudar categoria", { description: e instanceof Error ? e.message : "" })
    }
  }

  async function addSugestao(s: { descricao: string; valor: number; categoria: string; proxParcela: number; parcela_total: number }) {
    setBusy(true)
    try {
      const { error } = await supabase.from("fin_transacoes").insert({
        tipo: "despesa", cartao_id: cartao.id, mes_ref: mesAtivo, data: mesAtivo + "-01",
        descricao: s.descricao, valor: s.valor,
        categoria: s.categoria, parcela_atual: s.proxParcela, parcela_total: s.parcela_total,
      })
      if (error) throw error
      toast.success(`${s.descricao} ${s.proxParcela}/${s.parcela_total} adicionada!`)
      await loadAll()
    } catch (e) {
      toast.error("Erro", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  async function addTodasSugestoes() {
    if (!dados.sugestoes.length) return
    setBusy(true)
    try {
      const linhas = dados.sugestoes.map((s) => ({
        tipo: "despesa", cartao_id: cartao.id, mes_ref: mesAtivo, data: mesAtivo + "-01",
        descricao: s.descricao, valor: s.valor,
        categoria: s.categoria, parcela_atual: s.proxParcela, parcela_total: s.parcela_total,
      }))
      const { error } = await supabase.from("fin_transacoes").insert(linhas)
      if (error) throw error
      toast.success(`${linhas.length} parcela(s) adicionada(s)!`)
      await loadAll()
    } catch (e) {
      toast.error("Erro", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onVoltar} aria-label="Voltar">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="grid size-10 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
          {cartao.logo ? <img src={cartao.logo} alt="" className="size-full object-contain p-1" /> : <CreditCard className="size-5" />}
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold">{cartao.nome}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> Vencimento dia {cartao.dia_vencimento || "—"}
            {cartao.limite ? ` · limite ${fmtR(Number(cartao.limite))}` : ""}
          </p>
        </div>
      </div>

      <TransacaoDialog editar={editTx} open={!!editTx} onOpenChange={(o) => !o && setEditTx(null)} />

      {/* corpo em tela cheia: meses | conteúdo */}
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* lista de meses */}
        <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible">
          {meses.map((m) => {
            const val = faturaDoMes(transacoes, cartao.id, m)
            const ehFuturo = m > mesRefAtual()
            const qtdItens = faturaItens.filter((fi) => fi.cartao_id === cartao.id && fi.mes_ref === m).length
            const sel = m === mesAtivo
            return (
              <button
                key={m}
                onClick={() => { setMesSel(m); setCatFiltro(null); setBusca("") }}
                className={cn(
                  "flex shrink-0 flex-col items-start rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                  sel ? "border-primary/40 bg-primary/10" : "hover:bg-secondary"
                )}
              >
                <span className={cn("text-sm font-semibold capitalize", sel && "text-primary")}>{fmtMesRef(m)}</span>
                <span className="tnum text-xs text-muted-foreground">
                  {val > 0 ? fmtR(val) : ehFuturo ? (qtdItens ? `${qtdItens} planejado(s)` : "planejar") : "—"}
                </span>
              </button>
            )
          })}
        </div>

        {/* conteúdo do mês */}
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-xl font-semibold capitalize">{fmtMesRef(mesAtivo)}</h3>
            <span className={cn("tnum text-sm", dados.planejando ? "text-[var(--cat-investimento)]" : "text-muted-foreground")}>
              · {dados.planejando ? "planejado: " : ""}{fmtR(dados.valor)}
            </span>
          </div>

          {dados.planejando && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--cat-investimento)]/40 bg-[var(--cat-investimento)]/10 px-3 py-2 text-xs text-[var(--cat-investimento)]">
              <CalendarClock className="size-4 shrink-0" />
              Fatura de {fmtMesRef(mesAtivo)} ainda não fechou — o que adicionar aqui fica como planejado e vira o extrato real quando a fatura chegar.
            </div>
          )}

          {/* grid: gráfico | lista */}
          <div className="grid gap-5 xl:grid-cols-[minmax(280px,360px)_1fr]">
            {/* gráfico */}
            {dados.slices.length > 0 && (
              <div className="rounded-xl border bg-card p-4">
                <CategoryDonut slices={dados.slices} centerLabel="Itens" centerValue={dados.somaItens} />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dados.slices.map((s) => (
                    <button
                      key={s.catKey}
                      onClick={() => setCatFiltro(catFiltro === s.catKey ? null : s.catKey)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                        catFiltro === s.catKey ? "border-primary bg-primary/10" : "hover:bg-secondary"
                      )}
                    >
                      <span className="size-2 rounded-full" style={{ background: catColor(s.catKey) }} />
                      {s.label} <span className="tnum text-muted-foreground">{fmtR(s.value)}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">clique numa categoria pra filtrar</p>
              </div>
            )}

            {/* lista + form */}
            <div className="flex flex-col gap-3">
              {dados.sugestoes.length > 0 && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                    <Sparkles className="size-3.5 text-primary" />
                    Parcelamentos em andamento pra {fmtMesRef(mesAtivo)}
                    <Button size="sm" variant="secondary" className="ml-auto h-7" onClick={addTodasSugestoes} disabled={busy}>
                      <CheckCheck data-icon="inline-start" /> Adicionar todas
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {dados.sugestoes.map((s, i) => (
                      <button key={i} onClick={() => addSugestao(s)} disabled={busy}
                        className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left hover:border-primary/40">
                        <ItemIcon descricao={s.descricao} categoria={s.categoria} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.descricao}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Layers className="size-3" /> {s.proxParcela}/{s.parcela_total}
                          </span>
                        </span>
                        <span className="tnum text-sm">{fmtR(s.valor)}</span>
                        <Plus className="size-4 text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {catFiltro && (
                <div className="flex items-center justify-between rounded-lg border bg-secondary/50 px-3 py-1.5 text-xs">
                  <span>Filtrando: <b>{catInfo(catFiltro).l}</b></span>
                  <Button size="sm" variant="ghost" className="h-6" onClick={() => setCatFiltro(null)}>
                    <X data-icon="inline-start" /> limpar
                  </Button>
                </div>
              )}

              {dados.todosItens.length >= 8 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item por nome..." className="pl-9" />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                {dados.itens.length === 0 ? (
                  <div className="grid place-items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    <Inbox className="size-6 text-muted-foreground/60" />
                    {busca ? "Nenhum item encontrado" : dados.planejando ? "Nada planejado ainda — use o formulário abaixo" : "Nenhum item detalhado ainda"}
                  </div>
                ) : (
                  dados.itens.map((i) => (
                    <ItemRow key={i.id} item={i} onEdit={() => setEditTx(i)} onDelete={() => delItem(i.id)} onCategoria={(c) => mudarCategoria(i.id, c)} busy={busy} />
                  ))
                )}
                {!dados.planejando && !catFiltro && dados.restante > 0.005 && (
                  <div className="flex items-center justify-between rounded-lg border-l-[3px] border-muted-foreground/40 bg-card px-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">Fatura indefinida</span>
                    <span className="tnum text-muted-foreground">{fmtR(dados.restante)}</span>
                  </div>
                )}
              </div>

              {/* form adicionar */}
              <div className="mt-1 flex flex-wrap items-end gap-2 rounded-xl border bg-card/60 p-3">
                <Input value={novoDesc} onChange={(e) => setNovoDesc(e.target.value)} placeholder="Descrição (ex: iFood)" className="min-w-[140px] flex-1" />
                <Select value={novoCat} onValueChange={setNovoCat}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DESPESA_CATS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input type="number" step="0.01" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} placeholder="Valor" className="w-[100px]" />
                <Button onClick={addItem} disabled={busy}>
                  <Plus data-icon="inline-start" /> Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ItemRow({
  item, onEdit, onDelete, onCategoria, busy,
}: {
  item: Transacao
  onEdit: () => void
  onDelete: () => void
  onCategoria: (c: string) => void
  busy: boolean
}) {
  const cor = catColor(item.categoria)
  const dataCompra = item.data // transação usa 'data'
  return (
    <div className="flex items-center gap-2.5 rounded-lg border-l-2 bg-card px-3 py-2.5" style={{ borderLeftColor: cor }}>
      <ItemIcon descricao={item.descricao || ""} categoria={item.categoria || "outro"} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.descricao}</span>
          <Select value={item.categoria || "outro"} onValueChange={onCategoria}>
            <SelectTrigger className="h-6 w-auto gap-1 border-none bg-transparent px-1.5 text-xs text-muted-foreground shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {DESPESA_CATS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {(dataCompra || (item.parcela_total && item.parcela_total > 1)) && (
          <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
            {dataCompra && <span>{fmtData(dataCompra)}</span>}
            {item.parcela_total && item.parcela_total > 1 && (
              <span className="flex items-center gap-0.5"><Layers className="size-2.5" /> {item.parcela_atual || 1}/{item.parcela_total}</span>
            )}
          </div>
        )}
      </div>
      <span className="tnum text-sm font-medium">{fmtR(Number(item.valor))}</span>
      <RowActions size="sm" onEditar={onEdit} onExcluir={busy ? undefined : onDelete} />
    </div>
  )
}
