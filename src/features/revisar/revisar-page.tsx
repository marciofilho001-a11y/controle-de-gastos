import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import {
  Sparkles, Check, X, Undo2, RefreshCw, Upload, CreditCard, Landmark, Trash2, Loader2, ChevronDown,
  Inbox, Brain, Link as LinkIcon, Info,
} from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { IconeLancamento } from "@/components/icone-lancamento"
import { Emoji } from "@/components/emoji"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Cartao, type ContaBanco, type ExtratoItem, type Obrigacao, type Regra } from "@/lib/supabase"
import { aplicar, desfazer, sugerir, titulo, type Acao, type Sugestao } from "@/lib/extrato"
import { importarArquivo } from "@/lib/importar-arquivo"
import { catInfo, DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"
import { addMonths, fmtData, fmtMesCurto, fmtMesLongo, fmtR } from "@/lib/format"
import { faturaInfoDoMes, obrigacoesAtivasNoMes } from "@/lib/selectors"
import { contextoAtual, contarParaRevisar, rodarAutomatico, sincronizarBancos, statusBancos } from "./automatico"
import { cn } from "@/lib/utils"

type Aba = "fila" | "lancados" | "ignorados" | "regras"
const EASE = [0.23, 1, 0.32, 1] as const

// "CARTÃO NUBANK" -> "Nubank"
function nomeCurto(nome: string): string {
  const s = nome.replace(/^cart[aã]o\s+/i, "").trim() || nome
  return s === s.toUpperCase() && s.length > 3 ? s.charAt(0) + s.slice(1).toLowerCase() : s
}

function nomeConta(c: ContaBanco | null | undefined, cartoes: Cartao[]): string {
  if (!c) return "Banco"
  if (c.tipo === "CREDIT") {
    const k = cartoes.find((x) => x.id === c.cartao_id)
    return k ? `Cartão ${nomeCurto(k.nome)}` : `Cartão ${c.banco ?? c.nome ?? ""}`.trim()
  }
  if (c.origem === "arquivo") return "Conta (arquivo)"
  return `${c.banco ?? c.nome ?? "Conta"}`
}

function meioDe(item: ExtratoItem): string {
  const t = `${item.operacao ?? ""} ${item.descricao_raw ?? ""} ${item.descricao}`
  if (item.tipo_conta === "CREDIT") return item.sentido === "saida" ? "Compra no cartão" : "Crédito no cartão"
  if (/pix/i.test(t)) return "Pix"
  if (/boleto|bill|cobran/i.test(t)) return "Boleto"
  if (/ted|doc|transf/i.test(t)) return "Transferência"
  if (/d[eé]bito|debit|compra/i.test(t)) return "Débito"
  return item.sentido === "saida" ? "Saída" : "Entrada"
}

const ROTULO_ACAO: Record<Acao, string> = {
  despesa: "Gasto",
  receita: "Entrada (receita)",
  fatura: "Pagamento de fatura",
  obrigacao: "Conta fixa paga",
  ignorar: "Não lançar",
}

function acoesPossiveis(item: ExtratoItem): Acao[] {
  const cartao = item.tipo_conta === "CREDIT"
  if (item.sentido === "entrada") return cartao ? ["ignorar"] : ["receita", "ignorar"]
  return cartao ? ["despesa", "ignorar"] : ["despesa", "fatura", "obrigacao", "ignorar"]
}

function quando(iso?: string | null): string {
  if (!iso) return "nunca"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "nunca"
  const hh = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const hoje = new Date()
  const ontem = new Date(Date.now() - 86400000)
  if (d.toDateString() === hoje.toDateString()) return `hoje às ${hh}`
  if (d.toDateString() === ontem.toDateString()) return `ontem às ${hh}`
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hh}`
}

function rotuloChave(chave: string): string {
  return chave.startsWith("pessoa:") ? `Pix/TED com ${titulo(chave.slice(7))}` : titulo(chave)
}

function rotuloRegra(r: Regra, cartoes: Cartao[], obrigacoes: Obrigacao[]): string {
  if (r.acao === "despesa") return `lança como gasto · ${catInfo(r.categoria).l}${r.descricao ? ` · “${r.descricao}”` : ""}`
  if (r.acao === "receita") return `lança como entrada · ${catInfo(r.categoria).l}`
  if (r.acao === "fatura") {
    const c = cartoes.find((x) => x.id === r.cartao_id)
    return `dá baixa na fatura${c ? ` do ${nomeCurto(c.nome)}` : ""}`
  }
  if (r.acao === "obrigacao") {
    const o = obrigacoes.find((x) => x.id === r.obrigacao_id)
    return `marca paga a conta fixa${o ? ` “${o.nome}”` : ""}`
  }
  return "não lança (ignora)"
}

// sugestão é boa o bastante pra "aceitar todas"?
function valida(s: Sugestao, item: ExtratoItem): boolean {
  if (s.conciliar) return true
  if (s.acao === "despesa" && item.tipo_conta === "CREDIT" && !s.cartao_id) return false
  if (s.acao === "fatura" && !s.cartao_id) return false
  if (s.acao === "obrigacao" && !s.obrigacao_id) return false
  return true
}

export function RevisarPage() {
  const {
    extrato, regras, contasBanco, cartoes, obrigacoes, transacoes, faturaPagamentos, extratoLigados, config, loadAll,
  } = useFinData()
  const [aba, setAba] = useState<Aba>("fila")
  const [aceitando, setAceitando] = useState(false)

  // o motor lê do estado carregado; recalcula quando qualquer coisa muda
  const ctx = useMemo(() => contextoAtual(), [extrato, regras, contasBanco, cartoes, obrigacoes, transacoes, faturaPagamentos, extratoLigados, config.temas_extra])

  const fila = useMemo(
    () => extrato.filter((e) => e.status === "novo").sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)),
    [extrato],
  )
  const lancados = useMemo(
    () => extrato.filter((e) => e.status === "lancado" || e.status === "conciliado").sort((a, b) => ((a.resolvido_em ?? "") < (b.resolvido_em ?? "") ? 1 : -1)),
    [extrato],
  )
  const ignorados = useMemo(
    () => extrato.filter((e) => e.status === "ignorado").sort((a, b) => ((a.resolvido_em ?? "") < (b.resolvido_em ?? "") ? 1 : -1)),
    [extrato],
  )
  const sugestoes = useMemo(() => new Map(fila.map((i) => [i.id, sugerir(i, ctx)])), [fila, ctx])
  const boas = fila.filter((i) => {
    const s = sugestoes.get(i.id)!
    return valida(s, i) && (s.conciliar || s.confianca !== "baixa")
  })

  const porMes = useMemo(() => {
    const g = new Map<string, ExtratoItem[]>()
    for (const i of fila) g.set(i.data.slice(0, 7), [...(g.get(i.data.slice(0, 7)) ?? []), i])
    return [...g.entries()]
  }, [fila])

  const autoHoje = lancados.filter((e) => e.auto).length

  async function aceitarTodas() {
    setAceitando(true)
    const c = contextoAtual()
    let ok = 0, falhas = 0
    for (const i of boas) {
      try { await aplicar(i, sugerir(i, c), { aprender: true, sempre: true }, c); ok++ } catch { falhas++ }
    }
    await loadAll()
    setAceitando(false)
    if (ok) toast.success(`${ok} lançamento${ok > 1 ? "s" : ""} confirmado${ok > 1 ? "s" : ""}`, { description: "Das próximas vezes o site faz esses sozinho." })
    if (falhas) toast.error(`${falhas} não ${falhas > 1 ? "foram" : "foi"} lançado${falhas > 1 ? "s" : ""}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Revisar"
        description="O que chega do banco o site lança sozinho quando já conhece. O resto ele pergunta uma vez e aprende."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
        <section className="painel min-w-0 rounded-2xl border bg-card">
          {/* abas */}
          <div className="flex flex-wrap items-center gap-3 border-b px-5 pt-4 pb-3">
            <div className="scrollbar-none -mx-1 flex w-full min-w-0 gap-0.5 overflow-x-auto px-1 sm:w-auto sm:flex-1">
              {([
                ["fila", "Para revisar", fila.length],
                ["lancados", "Lançados", lancados.length],
                ["ignorados", "Ignorados", ignorados.length],
                ["regras", "Aprendizado", regras.length],
              ] as [Aba, string, number][]).map(([id, rot, n]) => (
                <button
                  key={id}
                  onClick={() => setAba(id)}
                  className={cn(
                    "press relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    aba === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {aba === id && <motion.span layoutId="revisar-aba" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-full bg-secondary ring-1 ring-border" />}
                  <span className="relative">{rot}</span>
                  {n > 0 && (
                    <span className={cn("tnum relative rounded-full px-1.5 text-[0.7rem] font-semibold", id === "fila" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{n}</span>
                  )}
                </button>
              ))}
            </div>
            {aba === "fila" && boas.length > 0 && (
              <Button size="sm" onClick={aceitarTodas} disabled={aceitando} className="w-full gap-1.5 sm:w-auto">
                {aceitando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" weight="bold" />}
                Aceitar {boas.length} sugest{boas.length > 1 ? "ões" : "ão"}
              </Button>
            )}
          </div>

          <div className="px-5 pt-4 pb-5">
            {aba === "fila" && (
              fila.length === 0 ? (
                <Vazio
                  semConexao={contasBanco.length === 0}
                  autoHoje={autoHoje}
                />
              ) : (
                <div className="flex flex-col gap-5">
                  {porMes.map(([mes, itens]) => (
                    <div key={mes}>
                      <CabecalhoMes mes={mes} itens={itens} />
                      <div className="mt-2.5 flex flex-col gap-3">
                        <AnimatePresence initial={false}>
                          {itens.map((i) => (
                            <ItemRevisar
                              key={i.id}
                              item={i}
                              sug={sugestoes.get(i.id)!}
                              conta={contasBanco.find((c) => c.id === i.conta_id) ?? null}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {aba === "lancados" && (
              <ListaResolvidos itens={lancados} vazio="Nada lançado pelo extrato nos últimos 45 dias." />
            )}
            {aba === "ignorados" && (
              <ListaResolvidos itens={ignorados} vazio="Nada ignorado nos últimos 45 dias." ignorados />
            )}
            {aba === "regras" && <ListaRegras />}
          </div>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-[7.5rem]">
          <PainelBancos />
          <PainelImportar />
          <ComoFunciona />
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CabecalhoMes({ mes, itens }: { mes: string; itens: ExtratoItem[] }) {
  const { loadAll } = useFinData()
  const [confirmar, setConfirmar] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!confirmar) return
    const t = setTimeout(() => setConfirmar(false), 4000)
    return () => clearTimeout(t)
  }, [confirmar])

  async function ignorarTodos() {
    if (!confirmar) return setConfirmar(true)
    setBusy(true)
    const { error } = await supabase.from("fin_extrato")
      .update({ status: "ignorado", acao: "ignorar", auto: false, resolvido_em: new Date().toISOString() })
      .in("id", itens.map((i) => i.id))
    await loadAll()
    setBusy(false)
    setConfirmar(false)
    if (error) toast.error("Não consegui ignorar", { description: error.message })
    else toast.success(`${itens.length} movimentações de ${fmtMesLongo(mes).toLowerCase()} ignoradas`, { description: "Dá pra trazer de volta na aba Ignorados." })
  }

  return (
    <div className="flex items-center gap-3 border-b pb-2">
      <p className="min-w-0 flex-1 text-sm font-semibold">
        {fmtMesLongo(mes)} <span className="font-normal text-muted-foreground">· {itens.length} para revisar</span>
      </p>
      <button
        onClick={ignorarTodos}
        disabled={busy}
        className={cn("press text-xs font-medium transition-colors", confirmar ? "text-destructive" : "text-muted-foreground hover:text-foreground")}
      >
        {busy ? "Ignorando..." : confirmar ? `Toque de novo: ignorar ${itens.length}` : "Ignorar todos do mês"}
      </button>
    </div>
  )
}

function Vazio({ semConexao, autoHoje }: { semConexao: boolean; autoHoje: number }) {
  if (semConexao) {
    return (
      <div className="grid place-items-center gap-3 py-12 text-center">
        <Emoji nome="sparkles" className="size-11" />
        <div>
          <p className="font-semibold">Pare de lançar à mão</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Conecte seus bancos de graça pelo Open Finance (painel ao lado) ou importe o extrato em OFX/CSV.
            Tudo que entrar aparece aqui: o que o site já conhece ele lança sozinho, o resto ele pergunta uma vez.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="grid place-items-center gap-3 py-12 text-center">
      <Emoji nome="party-popper" className="size-11" />
      <div>
        <p className="font-semibold">Tudo em dia</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {autoHoje > 0 ? `${autoHoje} lançamento${autoHoje > 1 ? "s" : ""} feito${autoHoje > 1 ? "s" : ""} sozinho${autoHoje > 1 ? "s" : ""} recentemente (aba Lançados). ` : ""}
          Quando chegar algo novo do banco, aparece aqui.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Um item da fila: o que veio do banco + o que o site acha que é

function ItemRevisar({ item, sug, conta }: { item: ExtratoItem; sug: Sugestao; conta: ContaBanco | null }) {
  const { cartoes, obrigacoes, transacoes, loadAll } = useFinData()
  const ehCartao = item.tipo_conta === "CREDIT"
  const [acao, setAcao] = useState<Acao>(sug.acao)
  const [descricao, setDescricao] = useState(sug.descricao)
  const [categoria, setCategoria] = useState(sug.categoria)
  const [cartaoFatura, setCartaoFatura] = useState<number | null>(sug.acao === "fatura" ? sug.cartao_id : null)
  const [mesFatura, setMesFatura] = useState(sug.acao === "fatura" ? sug.mes_ref : item.data.slice(0, 7))
  const [obrigacaoId, setObrigacaoId] = useState<number | null>(sug.obrigacao_id)
  const [conciliar, setConciliar] = useState(!!sug.conciliar)
  const [sempre, setSempre] = useState(true)
  const [busy, setBusy] = useState<"ok" | "ignorar" | null>(null)

  // a sugestão muda quando você liga a conta a um cartão ou ensina algo parecido
  useEffect(() => {
    setAcao(sug.acao); setDescricao(sug.descricao); setCategoria(sug.categoria)
    setCartaoFatura(sug.acao === "fatura" ? sug.cartao_id : null)
    setMesFatura(sug.acao === "fatura" ? sug.mes_ref : item.data.slice(0, 7))
    setObrigacaoId(sug.obrigacao_id); setConciliar(!!sug.conciliar)
  }, [sug, item.data])

  const mes = item.data.slice(0, 7)
  const ativasMes = obrigacoesAtivasNoMes(obrigacoes, mes)
  const cartaoDaConta = ehCartao ? cartoes.find((c) => c.id === conta?.cartao_id) ?? null : null

  function trocarAcao(a: Acao) {
    setAcao(a)
    setConciliar(false)
    if (a === "despesa") setCategoria(sug.acao === "despesa" ? sug.categoria : "outro")
    if (a === "receita") setCategoria(sug.acao === "receita" ? sug.categoria : "outro")
    if (a === "fatura" && !cartaoFatura) setCartaoFatura(cartoes.find((c) => c.ativo !== false)?.id ?? null)
    if (a === "obrigacao" && !obrigacaoId) setObrigacaoId(ativasMes[0]?.id ?? obrigacoes[0]?.id ?? null)
  }

  const final: Sugestao = {
    ...sug,
    acao,
    descricao: descricao.trim() || sug.descricao,
    categoria: acao === "fatura" ? "cartao" : categoria,
    cartao_id: acao === "despesa" ? (ehCartao ? cartaoDaConta?.id ?? null : null) : acao === "fatura" ? cartaoFatura : null,
    mes_ref: acao === "fatura" ? mesFatura : acao === "despesa" && ehCartao ? sug.mes_ref : mes,
    obrigacao_id: acao === "obrigacao" ? obrigacaoId : null,
    conciliar: conciliar ? sug.conciliar : null,
  }
  const faltaCartao = acao === "despesa" && ehCartao && !final.cartao_id
  const podeConfirmar = valida(final, item) && !!final.descricao

  async function resolver(ignorar: boolean) {
    setBusy(ignorar ? "ignorar" : "ok")
    try {
      const s: Sugestao = ignorar ? { ...final, acao: "ignorar", conciliar: null } : final
      await aplicar(item, s, { aprender: true, sempre }, contextoAtual())
      await loadAll()
      const nome = s.acao === "ignorar" ? "Ignorado" : s.conciliar ? "Ligado ao que você já tinha lançado" : `Lançado: ${s.descricao}`
      toast.success(nome, {
        description: sempre && !s.conciliar ? "Das próximas vezes o site faz isso sozinho." : undefined,
        action: { label: "Desfazer", onClick: () => desfazerPorId(item.id) },
      })
    } catch (e) {
      setBusy(null)
      toast.error("Não consegui lançar", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function ligarConta(cartaoId: string) {
    if (!conta) return
    const { error } = await supabase.from("fin_bancos_contas").update({ cartao_id: Number(cartaoId) }).eq("id", conta.id)
    if (error) return toast.error("Não consegui ligar", { description: error.message })
    await loadAll()
  }

  const conf = sug.conciliar && conciliar ? "alta" : sug.confianca
  const valorFatura = acao === "fatura" && cartaoFatura ? faturaInfoDoMes(transacoes, cartaoFatura, mesFatura).valor : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{ duration: 0.25, ease: EASE }}
      className="overflow-hidden rounded-xl border border-border/70 bg-secondary/15"
    >
      {/* o que veio do banco */}
      <div className="flex items-start gap-3 px-3.5 pt-3.5">
        <IconeLancamento descricao={final.descricao} categoria={acao === "fatura" ? "cartao" : categoria} tipo={item.sentido === "entrada" ? "receita" : "despesa"} size={38} />
        <div className="min-w-0 flex-1">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            disabled={conciliar || acao === "ignorar"}
            aria-label="Nome do lançamento"
            className="-ml-2 h-8 border-transparent bg-transparent px-2 text-[0.95rem] font-semibold shadow-none hover:border-border focus-visible:border-ring disabled:opacity-100 dark:bg-transparent"
          />
          <p className="mt-0.5 line-clamp-2 text-xs [overflow-wrap:anywhere] text-muted-foreground sm:line-clamp-1" title={item.descricao_raw ?? item.descricao}>
            {meioDe(item)} · {nomeConta(conta, cartoes)} · {fmtData(item.data).slice(0, 5)}
            {item.descricao_raw && item.descricao_raw !== final.descricao && <> · <span className="font-mono text-[0.7rem]">{item.descricao_raw}</span></>}
          </p>
          {(item.parcela_total || (ehCartao && item.sentido === "saida")) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.parcela_total && item.parcela_total > 1 && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">parcela {item.parcela_atual ?? 1}/{item.parcela_total}</span>
              )}
              {ehCartao && item.sentido === "saida" && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">fatura de {fmtMesCurto(sug.mes_ref).toLowerCase()}{item.pendente ? " (aberta)" : ""}</span>
              )}
            </div>
          )}
        </div>
        <p className={cn("tnum shrink-0 pt-1 text-[0.95rem] font-semibold", item.sentido === "entrada" ? "text-success" : "text-foreground")}>
          {item.sentido === "entrada" ? "+ " : "− "}{fmtR(item.valor)}
        </p>
      </div>

      {/* o que o site acha */}
      <div className="px-3.5 pt-3">
        {sug.conciliar && conciliar ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm">
            <LinkIcon className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              Você já lançou isso: <b className="font-semibold">“{sug.conciliar.descricao}”</b>
              <span className="text-muted-foreground"> em {fmtData(sug.conciliar.data).slice(0, 5)} · {fmtR(Number(sug.conciliar.valor))}</span>
            </span>
            <button onClick={() => setConciliar(false)} className="press text-xs font-medium text-muted-foreground hover:text-foreground">Não é o mesmo</button>
          </div>
        ) : (
          <>
            <p className={cn("flex items-center gap-1.5 text-xs", conf === "alta" ? "text-primary" : conf === "media" ? "text-foreground/75" : "text-muted-foreground")}>
              <Sparkles className="size-3.5 shrink-0" weight="fill" />
              {sug.motivo || "novo por aqui"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Select value={acao} onValueChange={(v) => trocarAcao(v as Acao)}>
                <SelectTrigger className="h-8 w-full text-[0.82rem] sm:w-auto sm:min-w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  {acoesPossiveis(item).map((a) => (
                    <SelectItem key={a} value={a}>{a === "despesa" && ehCartao ? "Compra no cartão" : ROTULO_ACAO[a]}</SelectItem>
                  ))}
                </SelectGroup></SelectContent>
              </Select>

              {(acao === "despesa" || acao === "receita") && (
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="h-8 w-full text-[0.82rem] sm:w-auto sm:min-w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    {(acao === "receita" ? RECEITA_CATS : DESPESA_CATS.filter((c) => c.v !== "fatura_indefinida" && c.v !== "cartao")).map((c) => (
                      <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                    ))}
                  </SelectGroup></SelectContent>
                </Select>
              )}

              {acao === "fatura" && (
                <>
                  <Select value={cartaoFatura ? String(cartaoFatura) : ""} onValueChange={(v) => setCartaoFatura(Number(v))}>
                    <SelectTrigger className="h-8 w-full text-[0.82rem] sm:w-auto sm:min-w-[150px]"><SelectValue placeholder="Qual cartão?" /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      {cartoes.filter((c) => c.ativo !== false).map((c) => <SelectItem key={c.id} value={String(c.id)}>{nomeCurto(c.nome)}</SelectItem>)}
                    </SelectGroup></SelectContent>
                  </Select>
                  <Select value={mesFatura} onValueChange={setMesFatura}>
                    <SelectTrigger className="h-8 w-full text-[0.82rem] sm:w-auto sm:min-w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      {[addMonths(mes, -1), mes, addMonths(mes, 1)].map((m) => (
                        <SelectItem key={m} value={m}>Fatura de {fmtMesCurto(m).toLowerCase()}</SelectItem>
                      ))}
                    </SelectGroup></SelectContent>
                  </Select>
                </>
              )}

              {acao === "obrigacao" && (
                <Select value={obrigacaoId ? String(obrigacaoId) : ""} onValueChange={(v) => setObrigacaoId(Number(v))}>
                  <SelectTrigger className="col-span-2 h-8 w-full text-[0.82rem] sm:w-auto sm:min-w-[170px]"><SelectValue placeholder="Qual conta fixa?" /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    {(ativasMes.length ? ativasMes : obrigacoes).map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.nome} · {fmtR(Number(o.valor))}</SelectItem>
                    ))}
                  </SelectGroup></SelectContent>
                </Select>
              )}
            </div>
            {valorFatura != null && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Fatura de {fmtMesCurto(mesFatura).toLowerCase()} no app: {fmtR(valorFatura)}
                {Math.abs(valorFatura - item.valor) > 1 && valorFatura > 0 && " (valor diferente do pago)"}
              </p>
            )}
            {faltaCartao && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs">
                <CreditCard className="size-4 shrink-0" />
                <span className="flex-1">Este cartão do banco é qual cartão do app?</span>
                <Select onValueChange={ligarConta}>
                  <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder="Escolher cartão" /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    {cartoes.filter((c) => c.ativo !== false).map((c) => <SelectItem key={c.id} value={String(c.id)}>{nomeCurto(c.nome)}</SelectItem>)}
                  </SelectGroup></SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </div>

      {/* resposta */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 px-3.5 py-2.5">
        <label className={cn("flex w-full min-w-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-1", sug.conciliar && conciliar && "hidden sm:invisible sm:flex")}>
          <Switch size="sm" checked={sempre} onCheckedChange={setSempre} />
          <span>Das próximas vezes, fazer isso sozinho</span>
        </label>
        <Button variant="ghost" size="sm" onClick={() => resolver(true)} disabled={!!busy} className="ml-auto h-8 text-muted-foreground">
          {busy === "ignorar" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Ignorar
        </Button>
        <Button size="sm" onClick={() => resolver(false)} disabled={!!busy || !podeConfirmar} className="h-8 gap-1.5">
          {busy === "ok" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" weight="bold" />}
          {sug.conciliar && conciliar ? "É o mesmo" : "Confirmar"}
        </Button>
      </div>
    </motion.div>
  )
}

async function desfazerPorId(id: string) {
  const st = useFinData.getState()
  try {
    // o item no estado pode estar velho; busca como está agora
    const { data } = await supabase.from("fin_extrato").select("*").eq("id", id).maybeSingle()
    if (!data) return
    const item = { ...(data as ExtratoItem), valor: Number(data.valor) }
    let transacoes = st.transacoes
    if (item.transacao_id && !transacoes.some((t) => t.id === item.transacao_id)) {
      await st.loadAll()
      transacoes = useFinData.getState().transacoes
    }
    await desfazer(item, transacoes, { pararDeAutomatizar: item.auto })
    await useFinData.getState().loadAll()
    toast("Desfeito: voltou pra fila de revisar")
  } catch (e) {
    toast.error("Não consegui desfazer", { description: e instanceof Error ? e.message : String(e) })
  }
}

// ---------------------------------------------------------------------------

function ListaResolvidos({ itens, vazio, ignorados }: { itens: ExtratoItem[]; vazio: string; ignorados?: boolean }) {
  const { transacoes, cartoes, contasBanco } = useFinData()
  const [busy, setBusy] = useState<string | null>(null)
  if (!itens.length) {
    return (
      <div className="grid place-items-center gap-3 py-12 text-center">
        <Emoji nome="receipt" className="size-10 opacity-80" />
        <p className="text-sm text-muted-foreground">{vazio}</p>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      {itens.map((i) => {
        const t = i.transacao_id ? transacoes.find((x) => x.id === i.transacao_id) : null
        const nome = t?.descricao ?? i.descricao
        const conta = contasBanco.find((c) => c.id === i.conta_id)
        const como = ignorados ? "não lançado"
          : i.status === "conciliado" ? "ligado ao que você lançou"
          : i.acao === "fatura" ? "baixa na fatura"
          : t?.obrigacao_id ? "conta fixa paga"
          : t?.tipo === "receita" ? `entrada · ${catInfo(t.categoria).l}`
          : t ? `${catInfo(t.categoria).l}${t.parcela_total && t.parcela_total > 1 ? ` · ${t.parcela_total}x` : ""}` : "lançado"
        return (
          <div key={i.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0">
            <IconeLancamento descricao={nome} categoria={t?.categoria ?? (i.acao === "fatura" ? "cartao" : "outro")} tipo={i.sentido === "entrada" ? "receita" : "despesa"} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {i.auto && <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 font-medium text-primary"><Sparkles className="size-3" weight="fill" />sozinho</span>}
                {como} · {nomeConta(conta, cartoes)} · {fmtData(i.data).slice(0, 5)}
              </p>
            </div>
            <p className={cn("tnum shrink-0 text-sm font-semibold", i.sentido === "entrada" ? "text-success" : "", ignorados && "text-muted-foreground")}>
              {i.sentido === "entrada" ? "+ " : "− "}{fmtR(i.valor)}
            </p>
            <Button
              variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
              disabled={busy === i.id}
              onClick={async () => { setBusy(i.id); await desfazerPorId(i.id); setBusy(null) }}
              title={ignorados ? "Trazer de volta pra revisar" : "Desfazer e revisar de novo"}
            >
              {busy === i.id ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
              <span className="hidden sm:inline">{ignorados ? "Trazer de volta" : "Desfazer"}</span>
            </Button>
          </div>
        )
      })}
    </div>
  )
}

function ListaRegras() {
  const { regras, cartoes, obrigacoes, loadAll } = useFinData()
  const [busy, setBusy] = useState<number | null>(null)
  if (!regras.length) {
    return (
      <div className="grid place-items-center gap-3 py-12 text-center">
        <Brain className="size-9 text-muted-foreground/70" />
        <p className="max-w-sm text-sm text-muted-foreground">
          Ainda não aprendi nada. Cada vez que você confirma um item com “fazer isso sozinho”, ele vira uma regra aqui.
        </p>
      </div>
    )
  }
  async function alternar(r: Regra, auto: boolean) {
    setBusy(r.id)
    const { error } = await supabase.from("fin_regras").update({ auto }).eq("id", r.id)
    await loadAll()
    setBusy(null)
    if (error) toast.error("Não consegui salvar", { description: error.message })
  }
  async function apagar(r: Regra) {
    setBusy(r.id)
    const { error } = await supabase.from("fin_regras").delete().eq("id", r.id)
    await loadAll()
    setBusy(null)
    if (error) toast.error("Não consegui apagar", { description: error.message })
    else toast(`Esqueci “${rotuloChave(r.chave)}”`, { description: "Da próxima vez o site pergunta de novo." })
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        O que o site já sabe fazer sozinho. Desligue pra ele voltar a perguntar, ou apague pra esquecer.
      </p>
      <div className="overflow-hidden rounded-xl border border-border/70">
        {regras.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
              {r.sentido === "entrada" ? <Landmark className="size-4" /> : <Brain className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{rotuloChave(r.chave)} <span className="font-normal text-muted-foreground">({r.sentido === "entrada" ? "entrada" : "saída"})</span></p>
              <p className="truncate text-xs text-muted-foreground">{rotuloRegra(r, cartoes, obrigacoes)} · usada {r.vezes}x</p>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title="Lançar sozinho">
              <span className="hidden sm:inline">sozinho</span>
              <Switch size="sm" checked={r.auto} disabled={busy === r.id} onCheckedChange={(v) => alternar(r, v)} />
            </label>
            <button
              onClick={() => apagar(r)} disabled={busy === r.id}
              className="press grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
              aria-label="Esquecer regra"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Conexão com os bancos (Open Finance via Meu Pluggy — grátis pra uso pessoal)

function PainelBancos() {
  const { contasBanco, cartoes, config, saveConfig, loadAll } = useFinData()
  const [status, setStatus] = useState<{ configurado: boolean; items: number } | null | undefined>(undefined)
  const [sincronizando, setSincronizando] = useState(false)
  const [abrirConfig, setAbrirConfig] = useState(false)
  const [itens, setItens] = useState(config.pluggy_items ?? "")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { statusBancos().then(setStatus) }, [])
  useEffect(() => { setItens(config.pluggy_items ?? "") }, [config.pluggy_items])

  const contasPluggy = contasBanco.filter((c) => c.origem === "pluggy")
  const pronto = !!status?.configurado && (status?.items ?? 0) > 0

  async function sincronizar() {
    setSincronizando(true)
    try {
      const r = await sincronizarBancos()
      if (r.erro) throw new Error(r.erro)
      await loadAll()
      const a = await rodarAutomatico()
      const revisar = contarParaRevisar(useFinData.getState().extrato)
      const partes = [
        `${r.novos ?? 0} nova${(r.novos ?? 0) === 1 ? "" : "s"}`,
        a.feitos ? `${a.feitos} lançada${a.feitos > 1 ? "s" : ""} sozinha${a.feitos > 1 ? "s" : ""}` : null,
        revisar ? `${revisar} pra revisar` : null,
      ].filter(Boolean)
      toast.success("Bancos atualizados", { description: partes.join(" · ") })
      if (r.erros?.length) toast.error("Alguma conexão falhou", { description: r.erros.join(" | ").slice(0, 300) })
      statusBancos().then(setStatus)
    } catch (e) {
      toast.error("Não consegui buscar nos bancos", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSincronizando(false)
    }
  }

  async function salvarItens() {
    setSalvando(true)
    const limpo = itens.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).join(", ")
    await saveConfig("pluggy_items", limpo)
    setSalvando(false)
    toast.success("Conexões salvas")
    statusBancos().then(setStatus)
  }

  async function ligarCartao(conta: ContaBanco, v: string) {
    const { error } = await supabase.from("fin_bancos_contas").update({ cartao_id: v === "nenhum" ? null : Number(v) }).eq("id", conta.id)
    if (error) return toast.error("Não consegui salvar", { description: error.message })
    await loadAll()
  }
  async function alternarConta(conta: ContaBanco, ativo: boolean) {
    const { error } = await supabase.from("fin_bancos_contas").update({ ativo }).eq("id", conta.id)
    if (error) return toast.error("Não consegui salvar", { description: error.message })
    await loadAll()
  }

  return (
    <section className="painel rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Landmark className="size-[1.1rem]" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-ui text-[0.95rem] font-semibold tracking-tight">Bancos conectados</h3>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", status === undefined ? "bg-muted-foreground/40" : pronto ? "bg-success" : "bg-warning")} />
            {status === undefined ? "verificando..." : status === null ? "função de sincronização fora do ar"
              : !status.configurado ? "falta configurar (grátis)"
              : !status.items ? "falta colar as conexões"
              : `busca sozinho 2x por dia · última ${quando(config.pluggy_ultimo_sync)}`}
          </p>
        </div>
      </div>

      {pronto && (
        <Button onClick={sincronizar} disabled={sincronizando} variant="secondary" size="sm" className="mt-4 w-full gap-1.5">
          <RefreshCw className={cn("size-4", sincronizando && "animate-spin")} />
          {sincronizando ? "Buscando nos bancos..." : "Buscar agora"}
        </Button>
      )}

      {contasPluggy.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {contasPluggy.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/70 bg-secondary/15 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                {c.tipo === "CREDIT" ? <CreditCard className="size-4 shrink-0 text-muted-foreground" /> : <Landmark className="size-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.banco ?? "Banco"} · {c.nome ?? (c.tipo === "CREDIT" ? "Cartão" : "Conta")}</p>
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    {c.tipo === "CREDIT" ? "cartão de crédito" : "conta"}{c.numero ? ` ••${c.numero}` : ""} · {quando(c.ultimo_sync)}
                  </p>
                </div>
                <Switch size="sm" checked={c.ativo} onCheckedChange={(v) => alternarConta(c, v)} aria-label="Buscar esta conta" />
              </div>
              {c.tipo === "CREDIT" && (
                <Select value={c.cartao_id ? String(c.cartao_id) : "nenhum"} onValueChange={(v) => ligarCartao(c, v)}>
                  <SelectTrigger className="mt-2 h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    <SelectItem value="nenhum">Ligar a um cartão do app...</SelectItem>
                    {cartoes.filter((k) => k.ativo !== false).map((k) => <SelectItem key={k.id} value={String(k.id)}>É o cartão {nomeCurto(k.nome)}</SelectItem>)}
                  </SelectGroup></SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setAbrirConfig((v) => !v)}
        className="press mt-4 flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {pronto ? "Conexões (Item IDs)" : "Como conectar de graça"}
        <ChevronDown className={cn("size-4 transition-transform", (abrirConfig || (!pronto && status !== undefined)) && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {(abrirConfig || (!pronto && status !== undefined)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden"
          >
            <div className="pt-3">
              {!pronto && (
                <ol className="mb-3 flex list-decimal flex-col gap-1.5 pl-4 text-xs text-muted-foreground marker:font-semibold marker:text-foreground/70">
                  <li>Crie sua conta grátis no <a className="font-medium text-primary underline-offset-2 hover:underline" href="https://meu.pluggy.ai" target="_blank" rel="noreferrer">Meu Pluggy</a> e conecte seus bancos (Nubank, Mercado Pago, PicPay...).</li>
                  <li>Com o mesmo e-mail, entre no <a className="font-medium text-primary underline-offset-2 hover:underline" href="https://dashboard.pluggy.ai" target="_blank" rel="noreferrer">painel da Pluggy</a> e crie uma aplicação. Copie o Client ID e o Client Secret.</li>
                  <li>No Supabase, em Edge Functions → Secrets, crie <code className="rounded bg-muted px-1">PLUGGY_CLIENT_ID</code> e <code className="rounded bg-muted px-1">PLUGGY_CLIENT_SECRET</code> com esses valores.</li>
                  <li>No painel da Pluggy, conecte cada banco pelo conector “MeuPluggy” e cole aqui o Item ID de cada um.</li>
                </ol>
              )}
              <Textarea
                value={itens}
                onChange={(e) => setItens(e.target.value)}
                placeholder="Item IDs, um por linha (ex.: 3f2a9c1e-...)"
                rows={3}
                className="font-mono text-xs"
              />
              <Button onClick={salvarItens} disabled={salvando || itens === (config.pluggy_items ?? "")} size="sm" variant="secondary" className="mt-2 w-full">
                {salvando ? <Loader2 className="size-4 animate-spin" /> : null} Salvar conexões
              </Button>
              <p className="mt-2 flex gap-1.5 text-[0.7rem] text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" />
                O Client Secret fica só no Supabase, nunca no site. O site guarda só data, descrição e valor das movimentações.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ---------------------------------------------------------------------------

function PainelImportar() {
  const { cartoes, loadAll } = useFinData()
  const [destino, setDestino] = useState("conta")
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setBusy(true)
    try {
      const cartao = destino === "conta" ? null : cartoes.find((c) => c.id === Number(destino)) ?? null
      const r = await importarArquivo(f, cartao ? { tipo: "cartao", cartao } : { tipo: "conta" })
      await loadAll()
      const a = await rodarAutomatico()
      const revisar = contarParaRevisar(useFinData.getState().extrato)
      toast.success(`${r.formato}: ${r.lidas} movimentações lidas`, {
        description: [
          `${r.novas} nova${r.novas === 1 ? "" : "s"}`,
          r.repetidas ? `${r.repetidas} já importada${r.repetidas > 1 ? "s" : ""}` : null,
          a.feitos ? `${a.feitos} lançada${a.feitos > 1 ? "s" : ""} sozinha${a.feitos > 1 ? "s" : ""}` : null,
          revisar ? `${revisar} pra revisar` : null,
        ].filter(Boolean).join(" · "),
      })
    } catch (err) {
      toast.error("Não consegui importar", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="painel rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><Upload className="size-[1.1rem]" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-ui text-[0.95rem] font-semibold tracking-tight">Importar extrato</h3>
          <p className="text-xs text-muted-foreground">OFX ou CSV baixado do app/site do banco. Sem cadastro; importar de novo não duplica.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Select value={destino} onValueChange={setDestino}>
          <SelectTrigger className="h-9 min-w-0 flex-1 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value="conta">Conta (Pix e débito)</SelectItem>
            {cartoes.filter((c) => c.ativo !== false).map((c) => <SelectItem key={c.id} value={String(c.id)}>Fatura do {nomeCurto(c.nome)}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
        <Button onClick={() => ref.current?.click()} disabled={busy} className="h-9 gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Arquivo
        </Button>
        <input ref={ref} type="file" accept=".ofx,.csv,.txt,.OFX,.CSV,text/csv,application/x-ofx" className="hidden" onChange={onArquivo} />
      </div>
    </section>
  )
}

function ComoFunciona() {
  return (
    <section className="rounded-2xl border border-dashed p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Inbox className="size-4 text-muted-foreground" /> Como funciona</h3>
      <ul className="mt-2.5 flex flex-col gap-2 text-xs text-muted-foreground">
        <li><b className="font-semibold text-foreground/80">Já lançou à mão?</b> O site liga as duas coisas e não duplica.</li>
        <li><b className="font-semibold text-foreground/80">Pagou a fatura pelo banco?</b> Dá baixa na fatura do cartão certo; o pagamento dentro do cartão é ignorado.</li>
        <li><b className="font-semibold text-foreground/80">Conta fixa?</b> Pix ou boleto com o valor da conta marca ela como paga.</li>
        <li><b className="font-semibold text-foreground/80">Novo?</b> Ele pergunta uma vez. Com “fazer isso sozinho” ligado, das próximas vezes ele lança direto.</li>
        <li><b className="font-semibold text-foreground/80">Errou?</b> Desfazer em Lançados devolve pra cá e para de automatizar até você confirmar de novo.</li>
      </ul>
    </section>
  )
}
