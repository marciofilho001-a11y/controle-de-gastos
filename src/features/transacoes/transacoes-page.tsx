import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Search, Download, Loader2, CalendarDays, Wallet, CalendarRange, X, Pencil, Copy, Trash2, Lock,
  ArrowDownLeft, ArrowUpRight, MousePointerClick, Layers, CreditCard, ChevronDown, Repeat, Check,
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NovaTransacaoDialog, TransacaoDialog } from "./nova-transacao-dialog"
import { logoDoLancamento, corDoLogo } from "@/lib/marcas"
import { SeletorLogo } from "@/components/seletor-logo"
import { RowActions } from "@/components/row-actions"
import { Emoji } from "@/components/emoji"
import { duplicarTransacao } from "@/lib/transacoes-actions"
import { TransacoesBlocos } from "./transacoes-blocos"
import { PageHeader } from "@/components/page-header"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Cartao, type Transacao } from "@/lib/supabase"
import { catInfo, catColor, DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"
import { fmtR, fmtData, fmtMesCurto, fmtMesRef } from "@/lib/format"
import { txDoMes, despesasExibicaoDoMes, obrigacoesPendentesDoMes, type LinhaExibicao } from "@/lib/selectors"
import { emojiDoLancamento } from "@/lib/emoji-gasto"
import { infoParcela } from "@/lib/parcelas"
import { temasComExtras, type Tema } from "@/lib/temas"
import { cicloDaFatura } from "@/lib/data-compra"
import { LogoAvatar } from "@/components/logo-avatar"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
const MESES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
const DIAS = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"]

function useDesktop() {
  const q = "(min-width: 1024px)"
  const [ok, setOk] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setOk(m.matches)
    m.addEventListener("change", f)
    return () => m.removeEventListener("change", f)
  }, [])
  return ok
}

// "CARTÃO NUBANK" -> "Nubank"
function nomeCurtoCartao(nome: string): string {
  const s = nome.replace(/^cart[aã]o\s+/i, "").trim() || nome
  return s === s.toUpperCase() && s.length > 3 ? s.charAt(0) + s.slice(1).toLowerCase() : s
}

function formaDePagamento(t: LinhaExibicao, cartoes: Cartao[]): string {
  if (t.tipo === "receita") return "Entrada"
  const c = t.cartao_id ? cartoes.find((x) => x.id === t.cartao_id) : null
  if (c) return nomeCurtoCartao(c.nome)
  if (t.obrigacao_id) return "Conta fixa"
  return /\bpix\b/i.test(t.descricao || "") ? "Pix" : "Débito / dinheiro"
}

function cabecalhoDia(data: string) {
  const [a, m, d] = data.split("-").map(Number)
  const dt = new Date(a, m - 1, d)
  return { dia: `${String(d).padStart(2, "0")} ${MESES[m - 1]}`, semana: DIAS[dt.getDay()], ano: a }
}

export function TransacoesPage({ mesRef }: { mesRef: string }) {
  const { transacoes, cartoes, obrigacoes, config, descricaoIcones, loadAll } = useFinData()
  const [pagando, setPagando] = useState<number | null>(null)
  const desktop = useDesktop()
  const [busca, setBusca] = useState("")
  const [modo, setModo] = useState<"dia" | "forma">("dia")
  const [filtTipo, setFiltTipo] = useState("todos")
  const [filtOrigem, setFiltOrigem] = useState("todas")
  const [filtCat, setFiltCat] = useState("todas")
  const [delId, setDelId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editTx, setEditTx] = useState<Transacao | null>(null)
  const [todosMeses, setTodosMeses] = useState(false)
  const [selId, setSelId] = useState<number | null>(null)

  const temas = useMemo(() => temasComExtras(config.temas_extra), [config.temas_extra])
  const todasCats = [...DESPESA_CATS, ...RECEITA_CATS].filter((c, i, arr) => arr.findIndex((x) => x.v === c.v) === i)

  const list = useMemo(() => {
    // base sem duplicação de cartão: itens reais + linha virtual "Faturas a detalhar",
    // e as receitas do mês. Mesma base do Dashboard/Relatório — totais batem.
    const meses = todosMeses ? [...new Set(transacoes.map((t) => t.mes_ref))].sort() : [mesRef]
    let l: LinhaExibicao[] = meses.flatMap((m) => [
      ...txDoMes(transacoes, m).filter((t) => t.tipo === "receita"),
      ...despesasExibicaoDoMes(transacoes, m),
      ...obrigacoesPendentesDoMes(obrigacoes, transacoes, m), // contas fixas ainda a pagar
    ])
    if (filtTipo !== "todos") l = l.filter((t) => t.tipo === filtTipo)
    if (filtOrigem === "debito") l = l.filter((t) => !t.cartao_id && !t.obrigacao_id)
    else if (filtOrigem === "cartao") l = l.filter((t) => !!t.cartao_id)
    else if (filtOrigem === "obrigacao") l = l.filter((t) => !!t.obrigacao_id)
    if (filtCat !== "todas") l = l.filter((t) => (t.categoria || "outro") === filtCat)
    const b = busca.trim().toLowerCase()
    if (b) l = l.filter((t) => (t.descricao || "").toLowerCase().includes(b))
    return l.sort((a, b2) => (a.data < b2.data ? 1 : a.data > b2.data ? -1 : b2.id - a.id))
  }, [transacoes, obrigacoes, mesRef, filtTipo, filtOrigem, filtCat, busca, todosMeses])

  // separação em blocos: entradas · contas fixas · conta e dinheiro (por dia) · faturas do cartão
  const entradas = useMemo(() => list.filter((t) => t.tipo === "receita"), [list])
  const fixas = useMemo(
    () => list.filter((t) => t.tipo === "despesa" && !t.cartao_id && !!t.obrigacao_id)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)),
    [list],
  )
  const dias = useMemo(() => {
    const g = new Map<string, LinhaExibicao[]>()
    for (const t of list) if (t.tipo === "despesa" && !t.cartao_id && !t.obrigacao_id) g.set(t.data, [...(g.get(t.data) || []), t])
    return [...g.entries()]
  }, [list])

  async function pagarConta(t: LinhaExibicao) {
    if (!t.obrigacao_id) return
    setPagando(t.id)
    try {
      const { error } = await supabase.from("fin_transacoes").insert({
        tipo: "despesa", descricao: t.descricao, valor: Number(t.valor), categoria: t.categoria,
        data: t.data, mes_ref: t.mes_ref, obrigacao_id: t.obrigacao_id,
      })
      if (error) throw error
      toast.success(`${t.descricao} marcada como paga`)
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível marcar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setPagando(null)
    }
  }

  // cartão: agrupado por fatura (cartão + mês em que vence) — os gastos são do ciclo anterior
  const faturas = useMemo(() => {
    const g = new Map<string, { cartao: Cartao | undefined; mesRef: string; itens: LinhaExibicao[] }>()
    for (const t of list) {
      if (!t.cartao_id) continue
      const k = `${t.cartao_id}|${t.mes_ref}`
      const cur = g.get(k) || { cartao: cartoes.find((c) => c.id === t.cartao_id), mesRef: t.mes_ref, itens: [] }
      cur.itens.push(t)
      g.set(k, cur)
    }
    return [...g.entries()].map(([k, v]) => ({
      k, ...v,
      total: v.itens.reduce((s, t) => s + Number(t.valor), 0),
      ciclo: cicloDaFatura(v.cartao ?? null, v.mesRef),
    })).sort((a, b) => (a.mesRef < b.mesRef ? 1 : a.mesRef > b.mesRef ? -1 : b.total - a.total))
  }, [list, cartoes])

  const totalDespesa = list.filter((t) => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor), 0)
  const totalReceita = list.filter((t) => t.tipo === "receita").reduce((s, t) => s + Number(t.valor), 0)
  const saldoLista = totalReceita - totalDespesa
  const algumFiltro = filtTipo !== "todos" || filtOrigem !== "todas" || filtCat !== "todas" || !!busca.trim()
  const selecionado = list.find((t) => t.id === selId) ?? null

  // a seleção some quando o lançamento sai da lista (filtro, exclusão, troca de mês)
  useEffect(() => { if (selId != null && !list.some((t) => t.id === selId)) setSelId(null) }, [list, selId])

  function limparFiltros() {
    setBusca(""); setFiltTipo("todos"); setFiltOrigem("todas"); setFiltCat("todas")
  }

  function exportarCSV() {
    const linhas = [
      ["Data", "Descrição", "Categoria", "Forma", "Tipo", "Valor"],
      ...list.map((t) => [
        fmtData(t.data), t.descricao || "", catInfo(t.categoria).l, formaDePagamento(t, cartoes),
        t.tipo === "receita" ? "Receita" : "Despesa", String(Number(t.valor).toFixed(2)),
      ]),
    ]
    const csv = linhas.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transacoes-${mesRef}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function confirmarDelete() {
    if (delId == null) return
    setDeleting(true)
    try {
      const { error } = await supabase.from("fin_transacoes").delete().eq("id", delId)
      if (error) throw error
      toast.success("Transação removida")
      setDelId(null)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" })
    } finally {
      setDeleting(false)
    }
  }

  async function duplicar(t: Transacao) {
    try {
      await duplicarTransacao(t, mesRef)
      toast.success("Lançamento duplicado neste mês")
      await loadAll()
    } catch (e) {
      toast.error("Erro ao duplicar", { description: e instanceof Error ? e.message : "" })
    }
  }

  const detalhe = selecionado && (
    <DetalheTransacao
      t={selecionado} cartoes={cartoes} temas={temas} iconeCustom={logoDoLancamento(selecionado.descricao, descricaoIcones)}
      onFechar={() => setSelId(null)}
      onEditar={() => { setEditTx(selecionado); if (!desktop) setSelId(null) }}
      onDuplicar={() => duplicar(selecionado)}
      onExcluir={() => { setDelId(selecionado.id); if (!desktop) setSelId(null) }}
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transações" accent={todosMeses ? "todos os meses" : fmtMesCurto(mesRef)}
        description="Tudo que entrou e saiu, dia a dia."
        actions={<NovaTransacaoDialog mesRef={mesRef} />}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)]">
        {/* ---------------- histórico ---------------- */}
        <section className="painel min-w-0 rounded-2xl border bg-card">
          <div className="flex flex-wrap items-start gap-3 px-5 pt-5">
            <div className="min-w-0 flex-1">
              <h3 className="font-ui text-lg font-semibold tracking-tight">Histórico de transações</h3>
              <p className="text-xs text-muted-foreground">
                {list.length} lançamento{list.length === 1 ? "" : "s"}{algumFiltro && " filtrados"}
              </p>
            </div>
            <span
              className={cn(
                "tnum rounded-full border px-3 py-1 text-sm font-semibold",
                saldoLista >= 0 ? "border-primary/50 bg-primary/10 text-primary" : "border-primary/40 bg-primary/5 text-primary",
              )}
              title={`Entradas ${fmtR(totalReceita)} · Saídas ${fmtR(totalDespesa)}`}
            >
              {saldoLista >= 0 ? "+ " : "− "}{fmtR(Math.abs(saldoLista))}
            </span>
          </div>

          {/* busca + filtros */}
          <div className="flex flex-wrap items-center gap-2 border-b px-5 pt-4 pb-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lançamento..." className="h-9 pl-9" />
            </div>
            <Select value={filtTipo} onValueChange={setFiltTipo}>
              <SelectTrigger className="h-9 w-[118px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="todos">Tudo</SelectItem>
                <SelectItem value="receita">Entradas</SelectItem>
                <SelectItem value="despesa">Saídas</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
            <Select value={filtOrigem} onValueChange={setFiltOrigem}>
              <SelectTrigger className="h-9 w-[132px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="todas">Toda forma</SelectItem>
                <SelectItem value="debito">Débito / dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="obrigacao">Conta fixa</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
            <Select value={filtCat} onValueChange={setFiltCat}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="todas">Toda categoria</SelectItem>
                {todasCats.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <IconeBotao ativo={todosMeses} onClick={() => setTodosMeses((v) => !v)} titulo="Buscar em todos os meses">
                <CalendarRange className="size-4" />
              </IconeBotao>
              <div className="flex items-center rounded-lg border bg-secondary/40 p-0.5">
                <IconeBotao ativo={modo === "dia"} onClick={() => setModo("dia")} titulo="Por dia" plano>
                  <CalendarDays className="size-4" />
                </IconeBotao>
                <IconeBotao ativo={modo === "forma"} onClick={() => setModo("forma")} titulo="Por forma de pagamento" plano>
                  <Wallet className="size-4" />
                </IconeBotao>
              </div>
              <IconeBotao onClick={exportarCSV} titulo="Exportar CSV"><Download className="size-4" /></IconeBotao>
            </div>
            {algumFiltro && (
              <button onClick={limparFiltros} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <X className="size-3.5" /> Limpar
              </button>
            )}
          </div>

          {/* lista */}
          <div className="px-5 pb-4">
            {list.length === 0 ? (
              <div className="grid place-items-center gap-3 py-16 text-center">
                <Emoji nome="receipt" className="size-10 opacity-80" />
                <p className="text-sm text-muted-foreground">Nenhuma transação encontrada</p>
              </div>
            ) : modo === "forma" ? (
              <div className="pt-4">
                <TransacoesBlocos list={list} cartoes={cartoes} onDelete={(id) => setDelId(id)} onEdit={(t) => setEditTx(t)} onDuplicar={duplicar} />
              </div>
            ) : (
              <>
                {entradas.length > 0 && (
                  <>
                    <TituloSecao icon={ArrowDownLeft} tom="entrada" titulo="Entradas" sub="Salário, vendas e o que mais entrou"
                      total={entradas.reduce((s, t) => s + Number(t.valor), 0)} />
                    <BlocoDia className="mt-3">
                    {entradas.map((t) => (
                        <LinhaTransacao
                          key={t.id} t={t} cartoes={cartoes} temas={temas}
                          iconeCustom={logoDoLancamento(t.descricao, descricaoIcones)}
                          ativo={t.id === selId}
                          onSelecionar={() => setSelId((s) => (s === t.id ? null : t.id))}
                          onEditar={() => setEditTx(t)} onDuplicar={() => duplicar(t)} onExcluir={() => setDelId(t.id)}
                          onPagar={() => pagarConta(t)} pagando={pagando === t.id}
                        />
                    ))}
                    </BlocoDia>
                  </>
                )}

                {fixas.length > 0 && (
                  <>
                    <TituloSecao icon={Repeat} titulo="Contas fixas" sub="Obrigações do mês: as pagas e as que ainda vencem"
                      total={-fixas.reduce((s, t) => s + Number(t.valor), 0)} />
                    <BlocoDia className="mt-3">
                    {fixas.map((t) => (
                        <LinhaTransacao
                          key={t.id} t={t} cartoes={cartoes} temas={temas}
                          iconeCustom={logoDoLancamento(t.descricao, descricaoIcones)}
                          ativo={t.id === selId}
                          onSelecionar={() => setSelId((s) => (s === t.id ? null : t.id))}
                          onEditar={() => setEditTx(t)} onDuplicar={() => duplicar(t)} onExcluir={() => setDelId(t.id)}
                          onPagar={() => pagarConta(t)} pagando={pagando === t.id}
                        />
                    ))}
                    </BlocoDia>
                  </>
                )}

                {dias.length > 0 && (
                  <TituloSecao
                    icon={Wallet} titulo="Conta e dinheiro" sub="Pix e débito, no dia em que aconteceram"
                    total={-dias.flatMap(([, i]) => i).reduce((s, t) => s + Number(t.valor), 0)}
                  />
                )}
                {dias.length > 0 && <div className="flex flex-col gap-3 pt-3">
                {dias.map(([data, itens]) => (
                  <BlocoDia key={data}>
                    <CabecalhoDia data={data} itens={itens} comAno={todosMeses} />
                    {itens.map((t) => (
                        <LinhaTransacao
                          key={t.id} t={t} cartoes={cartoes} temas={temas}
                          iconeCustom={logoDoLancamento(t.descricao, descricaoIcones)}
                          ativo={t.id === selId}
                          onSelecionar={() => setSelId((s) => (s === t.id ? null : t.id))}
                          onEditar={() => setEditTx(t)} onDuplicar={() => duplicar(t)} onExcluir={() => setDelId(t.id)}
                          onPagar={() => pagarConta(t)} pagando={pagando === t.id}
                        />
                    ))}
                  </BlocoDia>
                ))}
                </div>}

                {faturas.length > 0 && (
                  <TituloSecao
                    icon={CreditCard} titulo="Faturas do cartão"
                    sub="Contam no mês em que a fatura vence; os gastos são do ciclo anterior"
                    total={-faturas.reduce((s, f) => s + f.total, 0)}
                  />
                )}
                <div className="flex flex-col gap-3 pt-1">
                  {faturas.map((f) => (
                    <GrupoFatura key={f.k} fatura={f}>
                      {porDiaDaCompra(f.itens).map(([data, itens]) => (
                        <BlocoDia key={data}>
                          <CabecalhoDia data={data} itens={itens} comAno={todosMeses} />
                          {itens.map((t) => (
                        <LinhaTransacao
                          key={t.id} t={t} cartoes={cartoes} temas={temas} naFatura
                          iconeCustom={logoDoLancamento(t.descricao, descricaoIcones)}
                          ativo={t.id === selId}
                          onSelecionar={() => setSelId((s) => (s === t.id ? null : t.id))}
                          onEditar={() => setEditTx(t)} onDuplicar={() => duplicar(t)} onExcluir={() => setDelId(t.id)}
                        />
                          ))}
                        </BlocoDia>
                      ))}
                    </GrupoFatura>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ---------------- visão do mês ---------------- */}
        <aside className="lg:sticky lg:top-4">
          <VisaoDoMes
            list={list} totalReceita={totalReceita} totalDespesa={totalDespesa}
            titulo={todosMeses ? "Visão geral" : "Visão do mês"}
            filtCat={filtCat} onFiltrarCat={(k) => setFiltCat((f) => (f === k ? "todas" : k))}
            detalhe={desktop ? detalhe : null}
          />
        </aside>
      </div>

      {/* no celular o detalhe abre por cima */}
      {!desktop && (
        <Dialog open={!!selecionado} onOpenChange={(o) => !o && setSelId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="sr-only">Detalhes da transação</DialogTitle></DialogHeader>
            {detalhe}
          </DialogContent>
        </Dialog>
      )}

      <TransacaoDialog editar={editTx} open={!!editTx} onOpenChange={(o) => !o && setEditTx(null)} />

      <AlertDialog open={delId != null} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta transação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmarDelete() }} disabled={deleting}>
              {deleting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function IconeBotao({
  children, onClick, titulo, ativo, plano,
}: { children: React.ReactNode; onClick: () => void; titulo: string; ativo?: boolean; plano?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} title={titulo} aria-label={titulo} aria-pressed={ativo}
      className={cn(
        "grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
        plano ? "size-8 rounded-md" : "border",
        ativo && (plano ? "bg-card text-foreground shadow-sm" : "border-primary/40 bg-primary/10 text-primary"),
      )}
    >
      {children}
    </button>
  )
}

// Ícone do lançamento: imagem que você escolheu pra essa descrição, senão o emoji do tipo de gasto
function IconeLancamento({
  t, temas, iconeCustom, tamanho = "md",
}: { t: LinhaExibicao; temas: Tema[]; iconeCustom?: string; tamanho?: "md" | "lg" }) {
  const grande = tamanho === "lg"
  const corMarca = corDoLogo(iconeCustom)
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary/70 ring-1 ring-border/80",
        grande ? "size-14" : "size-10",
      )}
      style={corMarca ? { boxShadow: `0 0 ${grande ? 18 : 12}px color-mix(in srgb, ${corMarca} 40%, transparent)` } : undefined}
    >
      {iconeCustom
        ? <img src={iconeCustom} alt="" className="size-full object-cover" />
        : <Emoji nome={emojiDoLancamento(t, temas)} className={grande ? "size-8" : "size-[22px]"} />}
    </span>
  )
}

function LinhaTransacao({
  t, cartoes, temas, iconeCustom, ativo, naFatura, onSelecionar, onEditar, onDuplicar, onExcluir, onPagar, pagando,
}: {
  t: LinhaExibicao; cartoes: Cartao[]; temas: Tema[]; iconeCustom?: string; ativo: boolean; naFatura?: boolean
  onSelecionar: () => void; onEditar: () => void; onDuplicar: () => void; onExcluir: () => void
  onPagar?: () => void; pagando?: boolean
}) {
  const receita = t.tipo === "receita"
  const p = infoParcela(t)
  // valor neutro: saída na cor do texto, só entrada em verde (padrão de extrato bancário)
  const cor = receita ? "var(--success)" : "var(--foreground)"
  return (
    <div
      className={cn(
        "group/linha relative flex items-center gap-3 border-b border-border/50 px-3 py-2.5 transition-colors last:border-b-0",
        ativo ? "bg-primary/[0.07]" : "hover:bg-secondary/50",
      )}
    >
      {ativo && <motion.span layoutId="linha-ativa" className="absolute inset-y-0 left-0 w-[3px] bg-primary" transition={{ duration: 0.25, ease: EASE }} />}
      <button type="button" onClick={onSelecionar} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <IconeLancamento t={t} temas={temas} iconeCustom={iconeCustom} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{t.descricao || "—"}</span>
            {p && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-secondary px-1.5 py-px text-[0.65rem] text-muted-foreground">
                <Layers className="size-2.5" /> {p.atual}/{p.total}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {catInfo(t.categoria).l}
            {t._pendente
              ? <><span className="px-1 opacity-60">·</span><span className="text-warning">a pagar · vence {fmtData(t.data).slice(0, 5)}</span></>
              : t.obrigacao_id
                ? <><span className="px-1 opacity-60">·</span><span className="text-success">paga em {fmtData(t.data).slice(0, 5)}</span></>
                : naFatura ? null : <><span className="px-1 opacity-60">·</span>{formaDePagamento(t, cartoes)}</>}
          </span>
        </span>
        <span className={cn("tnum shrink-0 text-sm font-semibold", t._pendente && "opacity-70")} style={{ color: cor }}>
          {receita ? "+ " : "− "}{fmtR(Number(t.valor))}
        </span>
      </button>
      {t._pendente && onPagar ? (
        <button
          type="button" onClick={onPagar} disabled={pagando}
          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary/40 px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
        >
          {pagando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Paguei
        </button>
      ) : t.id > 0 ? (
        <RowActions size="sm" onEditar={onEditar} onDuplicar={onDuplicar} onExcluir={onExcluir} />
      ) : (
        <span className="grid size-7 place-items-center" title="Valor calculado — detalhe na aba Cartões">
          <Lock className="size-3.5 text-muted-foreground/50" />
        </span>
      )}
    </div>
  )
}

const SEM_DATA = "sem-data"

// itens da fatura agrupados pelo dia da compra (mais recente primeiro); sem data informada vão pro fim
function porDiaDaCompra(itens: LinhaExibicao[]): [string, LinhaExibicao[]][] {
  const g = new Map<string, LinhaExibicao[]>()
  for (const t of itens) {
    const k = dataCompraReal(t) ? t.data : SEM_DATA
    g.set(k, [...(g.get(k) || []), t])
  }
  return [...g.entries()].sort(([a], [b]) => (a === SEM_DATA ? 1 : b === SEM_DATA ? -1 : a < b ? 1 : -1))
}

// cada dia é um cartão próprio: faixa de cabeçalho + lançamentos, com espaço entre os dias
function BlocoDia({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border border-border/70 bg-secondary/15", className)}>{children}</div>
}

const SEMANA_LEGIVEL = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

function CabecalhoDia({ data, itens, comAno }: { data: string; itens: LinhaExibicao[]; comAno?: boolean; compacto?: boolean }) {
  const saida = itens.filter((t) => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor), 0)
  const entrada = itens.filter((t) => t.tipo === "receita").reduce((s, t) => s + Number(t.valor), 0)
  const qtd = `${itens.length} ${itens.length === 1 ? "lançamento" : "lançamentos"}`
  const faixa = "flex items-center gap-3 border-b border-border/70 bg-secondary/50 px-3 py-2"
  if (data === SEM_DATA) {
    return (
      <div className={faixa}>
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-background text-sm font-semibold text-muted-foreground ring-1 ring-border">?</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-muted-foreground">Sem data da compra</span>
          <span className="block truncate text-xs text-muted-foreground">lançadas antes do campo de data · edite pra informar</span>
        </span>
        <span className="tnum shrink-0 text-sm font-semibold">− {fmtR(saida)}</span>
      </div>
    )
  }
  const c = cabecalhoDia(data)
  const [num, mes] = c.dia.split(" ")
  return (
    <div className={faixa}>
      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-background leading-none ring-1 ring-border">
        <span className="tnum text-[0.95rem] font-semibold">{num}</span>
        <span className="mt-0.5 text-[0.58rem] font-medium tracking-wider text-muted-foreground">{mes}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{SEMANA_LEGIVEL(c.semana)}{comAno && <span className="font-normal text-muted-foreground"> · {c.ano}</span>}</span>
        <span className="block text-xs text-muted-foreground">{qtd}</span>
      </span>
      {itens.length > 1 && <span className="tnum flex shrink-0 flex-col items-end text-sm font-semibold">
        {saida > 0 && <span>− {fmtR(saida)}</span>}
        {entrada > 0 && <span className={cn("text-success", saida > 0 && "text-xs font-medium")}>+ {fmtR(entrada)}</span>}
      </span>}
    </div>
  )
}

// dia 1º do mês da fatura = data não informada (lançado antes de existir o campo de data)
function dataCompraReal(t: LinhaExibicao): boolean {
  return t.id > 0 && t.data !== `${t.mes_ref}-01`
}

function TituloSecao({ icon: Icon, titulo, sub, total, tom }: { icon: typeof Wallet; titulo: string; sub: string; total: number; tom?: "entrada" }) {
  return (
    <div className="mt-6 flex items-end gap-3 border-b pb-2.5 first:mt-4">
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tom === "entrada" ? "bg-success/12 text-success" : "bg-primary/12 text-primary")}><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      </div>
      <span className={cn("tnum shrink-0 text-sm font-semibold", total >= 0 ? "text-success" : "text-foreground")}>
        {total >= 0 ? "+ " : "− "}{fmtR(Math.abs(total))}
      </span>
    </div>
  )
}

function GrupoFatura({
  fatura, children,
}: {
  fatura: { cartao: Cartao | undefined; mesRef: string; itens: LinhaExibicao[]; total: number; ciclo: ReturnType<typeof cicloDaFatura> }
  children: React.ReactNode
}) {
  const [aberto, setAberto] = useState(true)
  const { cartao, mesRef, itens, total, ciclo } = fatura
  const mes = MESES_LONGO[Number(mesRef.slice(5, 7)) - 1]
  const periodo = `${fmtData(ciclo.inicio).slice(0, 5)} a ${fmtData(ciclo.fim).slice(0, 5)}`
  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}
        className="flex w-full items-center gap-3 bg-secondary/30 px-3 py-3 text-left transition-colors hover:bg-secondary/50"
      >
        <LogoAvatar src={cartao?.logo} cor="var(--muted-foreground)" Icon={CreditCard} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">Fatura de {mes}</span>
            <span className="text-xs text-muted-foreground">{cartao ? nomeCurtoCartao(cartao.nome) : "Cartão"}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground" title={ciclo.estimado ? "Fechamento estimado: cadastre o dia de fechamento no cartão" : undefined}>
            <span className="rounded-md bg-primary/12 px-1.5 py-px font-medium text-primary">
              gastos {ciclo.mesGastos ? `de ${ciclo.mesGastos}` : `de ${periodo}`}
            </span>
            {ciclo.mesGastos && <span>{periodo}</span>}
            {ciclo.vencimento && <span>· vence {fmtData(ciclo.vencimento).slice(0, 5)}</span>}
            {ciclo.estimado && <span>*</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="tnum text-sm font-semibold">− {fmtR(total)}</span>
          <span className="text-[0.7rem] text-muted-foreground">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !aberto && "-rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function VisaoDoMes({
  list, totalReceita, totalDespesa, titulo, filtCat, onFiltrarCat, detalhe,
}: {
  list: LinhaExibicao[]; totalReceita: number; totalDespesa: number; titulo: string
  filtCat: string; onFiltrarCat: (k: string) => void; detalhe: React.ReactNode
}) {
  const [todas, setTodas] = useState(false)
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of list) if (t.tipo === "despesa") m.set(t.categoria || "outro", (m.get(t.categoria || "outro") || 0) + Number(t.valor))
    return [...m.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)
  }, [list])
  const maior = cats[0]
  const max = maior?.v || 1
  const soma = (f: (t: LinhaExibicao) => boolean) => list.filter((t) => t.tipo === "despesa" && f(t)).reduce((s, t) => s + Number(t.valor), 0)
  const fixasPagas = soma((t) => !t.cartao_id && !!t.obrigacao_id && !t._pendente)
  const fixasAPagar = soma((t) => !!t._pendente)
  const partes = [
    { k: "fat", rotulo: "Faturas do cartão", v: soma((t) => !!t.cartao_id), cor: "var(--primary)" },
    { k: "fix", rotulo: "Contas fixas pagas", v: fixasPagas, cor: "#3b82f6" },
    { k: "fixp", rotulo: "Contas fixas a pagar", v: fixasAPagar, cor: "#c97a0e" },
    { k: "conta", rotulo: "Pix e débito", v: soma((t) => !t.cartao_id && !t.obrigacao_id), cor: "#8b93a7" },
  ]
  const visiveis = todas ? cats : cats.slice(0, 6)

  return (
    <section className="painel flex flex-col gap-5 rounded-2xl border bg-card p-5">
      <div>
        <h3 className="font-ui text-lg font-semibold tracking-tight">{titulo}</h3>
        <p className="text-xs text-muted-foreground">Como suas transações estão distribuídas</p>
      </div>

      {detalhe}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[0.7rem] tracking-wider text-muted-foreground uppercase"><ArrowDownLeft className="size-3.5 text-success" /> Entradas</p>
          <p className="tnum mt-1 text-sm font-semibold text-success">{fmtR(totalReceita)}</p>
        </div>
        <div className="rounded-xl border px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[0.7rem] tracking-wider text-muted-foreground uppercase"><ArrowUpRight className="size-3.5 text-destructive" /> Saídas</p>
          <p className="tnum mt-1 text-sm font-semibold">{fmtR(totalDespesa)}</p>
        </div>
      </div>
      {totalDespesa > 0 && (
        <div className="-mt-3 flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-xs">
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-secondary">
            {partes.map((p) => p.v > 0 && (
              <span key={p.k} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.v / totalDespesa) * 100}%`, background: p.cor }} />
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {partes.map((p) => p.v > 0 && (
              <p key={p.k} className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ background: p.cor }} />
                <span className="flex-1">{p.rotulo}</span>
                <span className="tnum font-semibold text-foreground">{fmtR(p.v)}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {maior && (
        <div className="flex items-center gap-3 rounded-xl border bg-secondary/30 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-medium tracking-wider text-muted-foreground uppercase">Maior categoria</p>
            <p className="mt-1 truncate text-lg font-semibold text-primary">{catInfo(maior.k).l}</p>
            <p className="tnum text-sm">{fmtR(maior.v)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Emoji nome={emojiDoLancamento({ categoria: maior.k, tipo: "despesa" })} className="size-8" />
            <p className="tnum text-xs text-muted-foreground">{totalDespesa > 0 ? ((maior.v / totalDespesa) * 100).toFixed(1).replace(".", ",") : 0}% das despesas</p>
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold">Despesas por categoria</p>
            {cats.length > 6 && (
              <button onClick={() => setTodas((v) => !v)} className="text-xs font-medium text-primary hover:text-primary/80">
                {todas ? "Resumir" : `Ver todas (${cats.length})`}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {visiveis.map((c, i) => {
              const ativo = filtCat === c.k
              return (
                <button
                  key={c.k} type="button" onClick={() => onFiltrarCat(c.k)}
                  title={ativo ? "Tirar o filtro" : `Ver só ${catInfo(c.k).l}`}
                  className={cn("-mx-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/40", ativo && "bg-secondary/60")}
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className={cn("truncate", ativo && "font-semibold")}>{catInfo(c.k).l}</span>
                    <span className="tnum shrink-0 text-xs text-muted-foreground">{fmtR(c.v)}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-secondary">
                    <motion.span
                      className="block h-full rounded-full" style={{ background: catColor(c.k) }}
                      initial={{ width: 0 }} animate={{ width: `${(c.v / max) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04, ease: EASE }}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!detalhe && (
        <div className="hidden items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-xs text-muted-foreground lg:flex">
          <MousePointerClick className="size-4" /> Clique em uma transação para ver detalhes
        </div>
      )}
    </section>
  )
}

function DetalheTransacao({
  t, cartoes, temas, iconeCustom, onFechar, onEditar, onDuplicar, onExcluir,
}: {
  t: LinhaExibicao; cartoes: Cartao[]; temas: Tema[]; iconeCustom?: string
  onFechar: () => void; onEditar: () => void; onDuplicar: () => void; onExcluir: () => void
}) {
  const receita = t.tipo === "receita"
  const p = infoParcela(t)
  const c = cabecalhoDia(t.data)
  const virtual = t.id < 0
  const [seletor, setSeletor] = useState(false)
  const linhas: [string, React.ReactNode][] = [
    [t.cartao_id ? "Comprado em" : t._pendente ? "Vence" : "Data", t.cartao_id && !dataCompraReal(t)
      ? <span className="text-muted-foreground">não informado</span>
      : <>{fmtData(t.data)} <span className="text-muted-foreground">· {c.semana.toLowerCase()}</span></>],
    ["Categoria", catInfo(t.categoria).l],
    ["Forma", formaDePagamento(t, cartoes)],
  ]
  if (t.cartao_id) linhas.push(["Fatura", <>{fmtMesRef(t.mes_ref)} <span className="text-muted-foreground">· paga em {MESES_LONGO[Number(t.mes_ref.slice(5, 7)) - 1]}</span></>])
  if (p) linhas.push(["Parcela", `${p.atual} de ${p.total}`])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={t.id}
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="rounded-xl border bg-secondary/20 p-4"
      >
        <div className="flex items-start gap-3">
          {virtual || !t.descricao ? (
            <IconeLancamento t={t} temas={temas} iconeCustom={iconeCustom} tamanho="lg" />
          ) : (
            <button type="button" onClick={() => setSeletor(true)} title="Trocar logo" className="group/logo relative shrink-0 rounded-full">
              <IconeLancamento t={t} temas={temas} iconeCustom={iconeCustom} tamanho="lg" />
              <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition-colors group-hover/logo:text-foreground">
                <Pencil className="size-2.5" />
              </span>
            </button>
          )}
          {seletor && <SeletorLogo descricao={t.descricao || ""} open={seletor} onOpenChange={setSeletor} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug font-semibold">{t.descricao || "—"}</p>
            <p className={cn("tnum mt-1 text-xl font-bold", receita ? "text-success" : "text-foreground")}>
              {receita ? "+ " : "− "}{fmtR(Number(t.valor))}
            </p>
          </div>
          <button onClick={onFechar} className="hidden text-muted-foreground hover:text-foreground lg:block" aria-label="Fechar detalhes">
            <X className="size-4" />
          </button>
        </div>
        <dl className="mt-4 flex flex-col text-sm">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-t border-border/60 py-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
        {t._pendente ? (
          <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Conta fixa do mês ainda não paga. Use o botão "Paguei" na lista quando pagar.
          </p>
        ) : virtual ? (
          <p className="mt-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            Valor calculado: é o que falta detalhar na fatura. Abra a aba Cartões para lançar os itens.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" onClick={onEditar}><Pencil data-icon="inline-start" /> Editar</Button>
            <Button size="sm" variant="outline" onClick={onDuplicar}><Copy data-icon="inline-start" /> Duplicar</Button>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onExcluir}><Trash2 data-icon="inline-start" /> Excluir</Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export type { Transacao }
