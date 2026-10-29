import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { toast } from "sonner"
import {
  Landmark, CreditCard, RefreshCw, ArrowDownLeft, ArrowUpRight, Sparkles, ChevronRight,
} from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { LogoAvatar } from "@/components/logo-avatar"
import { IconeLancamento } from "@/components/icone-lancamento"
import { Emoji } from "@/components/emoji"
import { useFinData } from "@/hooks/use-fin-data"
import type { Cartao, ExtratoItem } from "@/lib/supabase"
import { logoDoLancamento } from "@/lib/marcas"
import { contraparteDe, limparDescricao } from "@/lib/extrato"
import {
  bancosDe, faturaDoMesNoBanco, faturaFechadaDoMes, mesDaFaturaAberta, nomeDoPlastico, soma, type Banco,
} from "@/lib/bancos"
import { faturaInfoDoMes } from "@/lib/selectors"
import { fmtMesCurto, fmtMesLongo, fmtR } from "@/lib/format"
import { dataLocal } from "@/lib/data-compra"
import { rodarAutomatico, sincronizarBancos } from "@/features/revisar/automatico"
import type { TabId } from "@/components/layout/nav"
import { cn } from "@/lib/utils"

const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

function quando(iso?: string | null): string {
  if (!iso) return "nunca"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "nunca"
  const hh = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  if (d.toDateString() === new Date().toDateString()) return `hoje às ${hh}`
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return `ontem às ${hh}`
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hh}`
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function BancosPage({ mesRef, onNavigate }: { mesRef: string; onNavigate: (t: TabId) => void }) {
  const { contasBanco, extrato, config } = useFinData()
  const bancos = useMemo(() => bancosDe(contasBanco), [contasBanco])
  const [sel, setSel] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  useEffect(() => {
    if (!sel && bancos.length) setSel(bancos[0].nome)
  }, [bancos, sel])
  const banco = bancos.find((b) => b.nome === sel) ?? bancos[0] ?? null

  async function buscar() {
    setBuscando(true)
    try {
      const r = await sincronizarBancos()
      if (r.erro) throw new Error(r.erro)
      await useFinData.getState().loadAll()
      const a = await rodarAutomatico()
      toast.success("Bancos atualizados", {
        description: [`${r.novos ?? 0} movimentaç${(r.novos ?? 0) === 1 ? "ão nova" : "ões novas"}`, a.feitos ? `${a.feitos} lançadas sozinhas` : null].filter(Boolean).join(" · "),
      })
    } catch (e) {
      toast.error("Não consegui buscar nos bancos", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBuscando(false)
    }
  }

  if (!banco) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Bancos" description="Saldo, cartão e movimentações de cada banco, direto do Open Finance." />
        <div className="painel grid place-items-center gap-3 rounded-2xl border bg-card py-16 text-center">
          <Emoji nome="classical-building" className="size-11" />
          <p className="font-semibold">Nenhum banco conectado</p>
          <p className="max-w-sm text-sm text-muted-foreground">Conecte pelo Meu Pluggy na tela Revisar, em "Bancos conectados".</p>
          <Button size="sm" onClick={() => onNavigate("revisar")}>Ir para Revisar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Bancos"
        accent={fmtMesCurto(mesRef)}
        description="Saldo, cartão e movimentações de cada banco, direto do Open Finance."
        actions={
          <div className="flex items-center gap-2.5">
            <span className="hidden text-xs text-muted-foreground sm:inline">atualizado {quando(config.pluggy_ultimo_sync)}</span>
            <Button size="sm" variant="secondary" onClick={buscar} disabled={buscando} className="gap-1.5">
              <RefreshCw className={cn("size-4", buscando && "animate-spin")} /> {buscando ? "Buscando..." : "Buscar agora"}
            </Button>
          </div>
        }
      />

      {/* um banco por vez */}
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Bancos">
        {bancos.map((b) => {
          const ativo = b.nome === banco.nome
          const pendentes = extrato.filter((e) => e.status === "novo" && b.contas.some((c) => c.id === e.conta_id)).length
          return (
            <button
              key={b.nome}
              role="tab"
              aria-selected={ativo}
              onClick={() => setSel(b.nome)}
              className={cn(
                "press relative flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-medium transition-colors",
                ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ativo && <motion.span layoutId="banco-pill" transition={SPRING} className="absolute inset-0 rounded-full bg-card ring-1 ring-border shadow-sm" />}
              <span className="relative"><LogoAvatar src={logoDoLancamento(b.nome, {})} cor="var(--muted-foreground)" Icon={Landmark} size={28} led={false} /></span>
              <span className="relative">{b.nome}</span>
              {pendentes > 0 && <span className="tnum relative rounded-full bg-primary px-1.5 text-[0.68rem] leading-[1.1rem] font-semibold text-primary-foreground">{pendentes}</span>}
            </button>
          )
        })}
      </div>

      <motion.div key={banco.nome} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="flex flex-col gap-5">
        <Resumo banco={banco} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
          <Movimentacoes banco={banco} mesRef={mesRef} onNavigate={onNavigate} />
          <div className="flex flex-col gap-5 lg:sticky lg:top-[7.5rem]">
            {banco.cartao && <Faturas banco={banco} />}
            <ContasDoBanco banco={banco} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Resumo({ banco }: { banco: Banco }) {
  const { extrato, cartoes } = useFinData()
  const cartaoApp = banco.cartao ? cartoes.find((c) => c.id === banco.cartao!.cartao_id) ?? null : null
  const hoje = dataLocal(new Date().toISOString())
  const aberta = banco.cartao ? (() => {
    const mes = mesDaFaturaAberta(extrato, banco.cartao!, cartaoApp, hoje)
    return { ...faturaDoMesNoBanco(extrato, banco.cartao!, cartaoApp, mes), vence: vencimentoDe(cartaoApp, mes) }
  })() : null
  const limite = Number(banco.cartao?.limite ?? 0)
  const usado = Number(banco.cartao?.saldo ?? 0)
  const disp = banco.cartao?.disponivel != null ? Number(banco.cartao.disponivel) : limite ? limite - usado : null
  const pct = limite ? Math.min(100, (usado / limite) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-3.5">
      <Tile className="order-2 md:order-none" icon={Landmark} rotulo="Saldo em conta" sub={banco.conta ? `conta ${banco.conta.numero ? `••${banco.conta.numero}` : ""}`.trim() : "sem conta corrente"}>
        {banco.conta ? fmtR(Number(banco.conta.saldo ?? 0)) : "—"}
      </Tile>

      <Tile
        className="order-1 col-span-2 md:order-none md:col-span-1"
        icon={CreditCard}
        rotulo={aberta ? `Fatura aberta · ${fmtMesLongo(aberta.mes).toLowerCase()}` : "Fatura aberta"}
        sub={aberta
          ? `${aberta.itens.filter((i) => i.sentido === "saida").length} compras${aberta.creditos > 0 ? ` · ${fmtR(aberta.creditos)} já pagos` : ""}${aberta.vence ? ` · vence ${dm(aberta.vence)}` : ""}`
          : "sem cartão neste banco"}
      >
        {aberta ? fmtR(Math.max(0, aberta.total)) : "—"}
      </Tile>

      <Tile className="order-3 md:order-none" icon={CreditCard} rotulo="Limite disponível" sub={limite ? `usado ${fmtR(usado)} de ${fmtR(limite)} (inclui parcelas futuras)` : banco.cartao ? "o banco não informou o limite" : "sem cartão neste banco"}>
        {disp != null && limite ? fmtR(disp) : "—"}
        {limite > 0 && (
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", bounce: 0, duration: 0.6 }}
              className={cn("h-full rounded-full", pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-primary")}
            />
          </div>
        )}
      </Tile>
    </div>
  )
}

function vencimentoDe(cartao: Cartao | null, mes: string): string | null {
  if (!cartao?.dia_vencimento) return null
  return `${mes}-${String(Math.min(cartao.dia_vencimento, 28)).padStart(2, "0")}`
}

function Tile({ icon: Icon, rotulo, sub, children, className }: { icon: typeof Landmark; rotulo: string; sub: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("painel min-w-0 rounded-2xl border bg-card p-3.5 md:p-4", className)}>
      <p className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
        <Icon className="size-4" /> {rotulo}
      </p>
      <div className="tnum mt-1.5 font-display text-[1.3rem] leading-tight font-semibold tracking-[-0.02em] md:text-[1.6rem]">{children}</div>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={sub}>{sub}</p>
    </section>
  )
}

// ---------------------------------------------------------------------------

type Filtro = "tudo" | "conta" | "cartao"

const STATUS: Record<ExtratoItem["status"], { rot: string; cls: string }> = {
  novo: { rot: "revisar", cls: "bg-primary/12 text-primary" },
  lancado: { rot: "lançado", cls: "bg-success/12 text-success" },
  conciliado: { rot: "já lançado", cls: "bg-success/12 text-success" },
  ignorado: { rot: "não conta", cls: "bg-muted text-muted-foreground" },
}

function Movimentacoes({ banco, mesRef, onNavigate }: { banco: Banco; mesRef: string; onNavigate: (t: TabId) => void }) {
  const { extrato, transacoes } = useFinData()
  const [filtro, setFiltro] = useState<Filtro>("tudo")
  const [verTudo, setVerTudo] = useState(false)
  const ids = new Set(banco.contas.map((c) => c.id))
  const todosDoMes = extrato
    .filter((e) => ids.has(e.conta_id ?? "") && e.data.slice(0, 7) === mesRef)
    .filter((e) => filtro === "tudo" || (filtro === "cartao" ? e.tipo_conta === "CREDIT" : e.tipo_conta !== "CREDIT"))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  // o que não conta (caixinha, Pix entre suas contas, pagamento de fatura) fica escondido até você pedir
  const naoContam = todosDoMes.filter((e) => e.status === "ignorado")
  const doMes = verTudo ? todosDoMes : todosDoMes.filter((e) => e.status !== "ignorado")
  const contam = todosDoMes.filter((e) => e.status !== "ignorado")
  const entrou = soma(contam.filter((e) => e.sentido === "entrada" && e.tipo_conta !== "CREDIT"))
  const saiu = soma(contam.filter((e) => e.sentido === "saida"))
  const aRevisar = doMes.filter((e) => e.status === "novo").length
  const dias = new Map<string, ExtratoItem[]>()
  for (const e of doMes) dias.set(e.data, [...(dias.get(e.data) ?? []), e])

  return (
    <section className="painel min-w-0 rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-ui text-[0.95rem] font-semibold tracking-tight">Movimentações de {fmtMesLongo(mesRef).toLowerCase()}</h3>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span className="tnum inline-flex items-center gap-1"><ArrowDownLeft className="size-3.5 text-success" /> entrou {fmtR(entrou)}</span>
            <span className="tnum inline-flex items-center gap-1"><ArrowUpRight className="size-3.5" /> saiu {fmtR(saiu)}</span>
          </p>
        </div>
        <div className="flex items-center rounded-full border bg-secondary/40 p-0.5" role="tablist">
          {(["tudo", "conta", "cartao"] as Filtro[]).map((f) => (
            <button
              key={f} role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}
              className={cn("press relative rounded-full px-3 py-1 text-xs font-medium", filtro === f ? "text-foreground" : "text-muted-foreground")}
            >
              {filtro === f && <motion.span layoutId={`mov-filtro-${banco.nome}`} transition={SPRING} className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border" />}
              <span className="relative">{f === "tudo" ? "Tudo" : f === "conta" ? "Conta" : "Cartão"}</span>
            </button>
          ))}
        </div>
      </div>

      {aRevisar > 0 && (
        <button
          onClick={() => onNavigate("revisar")}
          className="press mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded-xl bg-primary/8 px-3 py-2 text-left text-sm"
        >
          <Sparkles className="size-4 shrink-0 text-primary" weight="fill" />
          <span className="flex-1"><b className="font-semibold">{aRevisar}</b> deste mês esperando sua resposta em Revisar</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      )}

      <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
        {doMes.length === 0 ? (
          <div className="grid place-items-center gap-2 py-12 text-center">
            <Emoji nome="receipt" className="size-10 opacity-80" />
            <p className="text-sm text-muted-foreground">Nada neste mês{filtro !== "tudo" ? " com esse filtro" : ""}.</p>
          </div>
        ) : (
          [...dias.entries()].map(([data, itens]) => {
            const [a, m, d] = data.split("-").map(Number)
            return (
              <div key={data} className="overflow-hidden rounded-xl border border-border/70 bg-secondary/15">
                <div className="flex items-center gap-2 border-b border-border/70 bg-secondary/40 px-3 py-1.5 text-xs">
                  <span className="font-semibold">{String(d).padStart(2, "0")}/{String(m).padStart(2, "0")}</span>
                  <span className="text-muted-foreground">{DIAS[new Date(a, m - 1, d).getDay()]}</span>
                </div>
                {itens.map((e) => {
                  const t = e.transacao_id ? transacoes.find((x) => x.id === e.transacao_id) : null
                  const cp = contraparteDe(e)
                  const nome = t?.descricao ?? limparDescricao(cp && /pix|transf|ted/i.test(`${e.operacao ?? ""} ${e.descricao}`) ? cp : e.descricao)
                  const st = STATUS[e.status]
                  const cartao = e.tipo_conta === "CREDIT"
                  return (
                    <div key={e.id} className={cn("flex items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0", e.status === "ignorado" && "opacity-70")}>
                      <IconeLancamento descricao={nome} categoria={t?.categoria ?? "outro"} tipo={e.sentido === "entrada" && !cartao ? "receita" : "despesa"} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{nome}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <span>{cartao ? "Cartão" : "Conta"}{e.parcela_total && e.parcela_total > 1 ? ` · ${e.parcela_atual}/${e.parcela_total}` : ""}{e.pendente ? " · fatura aberta" : ""}</span>
                          <span className={cn("rounded px-1 py-px text-[0.66rem] font-semibold", st.cls)}>{st.rot}</span>
                        </p>
                      </div>
                      <p className={cn("tnum shrink-0 text-sm font-semibold", e.sentido === "entrada" && !cartao && "text-success")}>
                        {e.sentido === "entrada" ? "+ " : "− "}{fmtR(e.valor)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
        {naoContam.length > 0 && (
          <button
            onClick={() => setVerTudo((v) => !v)}
            className="press self-center rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {verTudo ? "Esconder" : "Mostrar"} {naoContam.length} que não conta{naoContam.length > 1 ? "m" : ""} (caixinha, Pix entre suas contas, pagamento de fatura)
          </button>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Faturas({ banco }: { banco: Banco }) {
  const { extrato, cartoes, transacoes } = useFinData()
  const conta = banco.cartao!
  const cartaoApp = cartoes.find((c) => c.id === conta.cartao_id) ?? null
  const hoje = dataLocal(new Date().toISOString())
  const aberta = mesDaFaturaAberta(extrato, conta, cartaoApp, hoje)
  const fechadas = ((conta.faturas ?? []) as { vence: string; total: number }[]).filter((f) => f.vence.slice(0, 7) < aberta).slice(0, 5)
  const meses = [aberta, ...fechadas.map((f) => f.vence.slice(0, 7))]

  return (
    <section className="painel rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-secondary text-muted-foreground"><CreditCard className="size-[1.1rem]" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-ui text-[0.95rem] font-semibold tracking-tight">Faturas do cartão</h3>
          <p className="truncate text-xs text-muted-foreground">
            {nomeDoPlastico(conta)}{conta.numero ? ` ••${conta.numero}` : ""}{cartaoApp ? ` · no app: ${cartaoApp.nome}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col">
        {meses.map((m, i) => {
          const fechada = faturaFechadaDoMes(conta, m)
          const calc = faturaDoMesNoBanco(extrato, conta, cartaoApp, m)
          const noApp = cartaoApp ? faturaInfoDoMes(transacoes, cartaoApp.id, m).valor : null
          const valor = i === 0 ? Math.max(0, calc.total) : fechada?.total ?? 0
          return (
            <div key={m} className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {fmtMesLongo(m)}
                  {i === 0 && <span className="ml-1.5 rounded bg-primary/12 px-1 py-px text-[0.66rem] font-semibold text-primary">aberta</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i === 0 ? "parcial, até hoje" : "a pagar no banco"}{noApp != null ? ` · no app ${fmtR(noApp)}` : ""}
                </p>
              </div>
              <p className="tnum text-sm font-semibold">{fmtR(valor)}</p>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        O valor das faturas fechadas é o que o banco cobra no vencimento: pagamentos antecipados já descontados.
      </p>
    </section>
  )
}

function ContasDoBanco({ banco }: { banco: Banco }) {
  return (
    <section className="rounded-2xl border border-dashed p-5">
      <h3 className="text-sm font-semibold">Contas ligadas</h3>
      <div className="mt-2.5 flex flex-col gap-2">
        {banco.contas.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 text-xs">
            {c.tipo === "CREDIT" ? <CreditCard className="size-4 text-muted-foreground" /> : <Landmark className="size-4 text-muted-foreground" />}
            <span className="min-w-0 flex-1 truncate">{c.tipo === "CREDIT" ? nomeDoPlastico(c) : "Conta"}{c.numero ? ` ••${c.numero}` : ""}</span>
            <span className="text-muted-foreground">{quando(c.ultimo_sync)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
