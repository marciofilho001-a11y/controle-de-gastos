import { useMemo, useState } from "react"
import { Zap, Archive, Loader2, Inbox, ChevronDown, Check, Plus } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import type { TabId } from "@/components/layout/nav"
import { alternarPagamento } from "@/lib/contas-actions"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ObrigacaoDialog } from "./obrigacao-dialog"
import { AssinaturasPanel } from "@/features/assinaturas/assinaturas-panel"
import { PageHeader } from "@/components/page-header"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Obrigacao } from "@/lib/supabase"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtData } from "@/lib/format"
import { motion, AnimatePresence } from "motion/react"
import { RowActions } from "@/components/row-actions"
import { LogoAvatar } from "@/components/logo-avatar"
import { logoDoLancamento } from "@/lib/marcas"
import { obrigacaoAtivaNoMes, parcelaNoMes, contasDoMes, type ItemObrigacao } from "@/lib/selectors"
import { cn } from "@/lib/utils"

export function ObrigacoesPage({ mesRef, onNavigate }: { mesRef: string; onNavigate?: (t: TabId) => void }) {
  const { obrigacoes, cartoes, transacoes, faturaPagamentos, loadAll } = useFinData()
  const [busyPg, setBusyPg] = useState<string | null>(null)
  const hoje = new Date().toISOString().slice(0, 10)
  const [delObr, setDelObr] = useState<Obrigacao | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [verInativas, setVerInativas] = useState(false)

  const { ativas, historico } = useMemo(() => {
    const ativas = obrigacoes.filter((o) => obrigacaoAtivaNoMes(o, mesRef))
    const historico = obrigacoes.filter((o) => !obrigacaoAtivaNoMes(o, mesRef))
    return { ativas, historico }
  }, [obrigacoes, mesRef])

  // contas do mês (obrigações + faturas) ordenadas por proximidade do vencimento
  const v = useMemo(() => {
    const contas = contasDoMes(obrigacoes, cartoes, transacoes, mesRef, faturaPagamentos, hoje)
    const mesCorrente = hoje.slice(0, 7)
    const diaHoje = Number(hoje.slice(8, 10))
    const diasAte = (dia: number | null) => {
      if (dia == null) return 99
      if (mesRef < mesCorrente) return -99
      if (mesRef > mesCorrente) return 99
      return dia - diaHoje
    }
    const proximos7 = contas.pendentes.filter((i) => { const d = diasAte(i.dia); return d >= 0 && d <= 7 })
    const soma = (arr: typeof contas.itens) => arr.reduce((s, i) => s + i.valor, 0)
    return {
      contas, diasAte, proximos7, totalProximos7: soma(proximos7), totalVencidas: soma(contas.vencidas),
      lista: [...contas.pendentes, ...contas.pagas],
    }
  }, [obrigacoes, cartoes, transacoes, faturaPagamentos, mesRef, hoje])

  async function pagar(item: ItemObrigacao) {
    const chave = `${item.tipo}-${item.id}`
    setBusyPg(chave)
    await alternarPagamento(item, mesRef)
    setBusyPg(null)
  }

  async function confirmarDelete() {
    if (!delObr) return
    setDeleting(true)
    try {
      const { error } = await supabase.from("fin_obrigacoes").delete().eq("id", delObr.id)
      if (error) throw error
      toast.success("Obrigação removida")
      setDelObr(null)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Obrigações" description="Contas fixas, parcelamentos e assinaturas." actions={<ObrigacaoDialog />} />

      {/* resumo: a pagar · vencidas · próximos 7 dias */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Kpi label="A pagar este mês" valor={v.contas.totalPendente} sub={`${v.contas.pendentes.length} conta${v.contas.pendentes.length === 1 ? "" : "s"} em aberto`} />
        <Kpi label="Vencidas" valor={v.totalVencidas} sub={v.contas.vencidas.length ? `${v.contas.vencidas.length} pendência${v.contas.vencidas.length === 1 ? "" : "s"}` : "nada atrasado"} tom={v.contas.vencidas.length ? "alerta" : undefined} />
        <Kpi label="Próximos 7 dias" valor={v.totalProximos7} sub={v.proximos7.length ? `${v.proximos7.length} vencimento${v.proximos7.length === 1 ? "" : "s"}` : "nenhum vencimento"} tom={v.proximos7.length ? "ok" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* próximos vencimentos */}
        <section>
          <div className="mb-3">
            <h3 className="text-base font-semibold tracking-[-0.01em]">Próximos vencimentos</h3>
            <p className="text-xs text-muted-foreground">Obrigações e faturas do mês, ordenadas por proximidade · toque no círculo pra dar baixa</p>
          </div>
          {v.lista.length === 0 ? (
            <Empty>Nenhuma conta neste mês</Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {v.lista.map((i) => {
                const chave = `${i.tipo}-${i.id}`
                const dias = v.diasAte(i.dia)
                const cartao = i.tipo === "cartao" ? cartoes.find((c) => c.id === i.id) : null
                const obr = i.tipo === "obrigacao" ? obrigacoes.find((o) => o.id === i.id) : null
                const vencida = !i.paga && v.contas.vencidas.includes(i)
                const info = catInfo(i.categoria)
                return (
                  <div
                    key={chave}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors sm:px-4",
                      i.paga && "opacity-55",
                      vencida && "border-destructive/40",
                    )}
                  >
                    <button
                      onClick={() => pagar(i)} disabled={busyPg === chave}
                      aria-label={i.paga ? "Reabrir" : "Marcar como paga"}
                      className={cn("press grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
                        i.paga ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40 hover:border-primary")}
                    >
                      {busyPg === chave ? <Loader2 className="size-3.5 animate-spin" /> : i.paga && <Check className="size-3.5" weight="bold" />}
                    </button>
                    <span className={cn("w-12 shrink-0 text-xs font-medium leading-tight sm:w-16", vencida ? "text-destructive" : dias === 0 ? "text-primary" : "text-muted-foreground")}>
                      {i.paga && i.pagoEm ? `pago ${fmtData(i.pagoEm).slice(0, 5)}` : rotuloDia(i.dia, dias, mesRef)}
                    </span>
                    <LogoAvatar src={cartao?.logo ?? (obr ? logoDoLancamento(obr.nome, descricaoIconesSeguro()) : undefined)} cor={catColor(i.categoria)} Icon={info.icon} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", i.paga && "line-through")}>{i.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{i.tipo === "cartao" ? "Fatura do cartão" : `${info.l} · ${i.parcTxt}`}</p>
                    </div>
                    <span className="tnum shrink-0 text-sm font-semibold">{fmtR(i.valor)}</span>
                    {i.tipo === "cartao" && onNavigate && (
                      <button onClick={() => onNavigate("cartoes")} className="hidden shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground sm:block">Ver</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* assinaturas + atalho */}
        <div className="flex flex-col gap-4">
          <AssinaturasPanel mesRef={mesRef} compacto />
          <div className="rounded-2xl border bg-card p-5">
            <p className="font-semibold">Nova obrigação</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Conta fixa, parcelamento ou assinatura que se repete todo mês.</p>
            <div className="mt-3"><ObrigacaoDialog trigger={<Button variant="outline" size="sm"><Plus data-icon="inline-start" /> Adicionar</Button>} /></div>
          </div>
        </div>
      </div>

      {/* Ativas */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground/85">
          <Zap className="size-3.5 text-muted-foreground" /> Cadastradas neste mês
          <Badge variant="secondary" className="ml-1">{ativas.length}</Badge>
        </div>
        {ativas.length === 0 ? (
          <Empty>Nenhuma obrigação ativa neste mês</Empty>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {ativas.map((o) => (
              <ObrLinha key={o.id} o={o} mesRef={mesRef} onDelete={() => setDelObr(o)} />
            ))}
          </div>
        )}
      </section>

      {/* Histórico: recolhido por padrão (abre ao clicar) */}
      {historico.length > 0 && (
        <section>
          <button
            type="button" onClick={() => setVerInativas((v) => !v)} aria-expanded={verInativas}
            className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground/85"
          >
            <Archive className="size-3.5 text-muted-foreground" /> Encerradas / inativas
            <Badge variant="secondary" className="ml-1">{historico.length}</Badge>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", verInativas && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {verInativas && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="overflow-hidden"
              >
                <div className="overflow-hidden rounded-2xl border bg-card">
                  {historico.map((o) => (
                    <ObrLinha key={o.id} o={o} mesRef={mesRef} inativa onDelete={() => setDelObr(o)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <AlertDialog open={delObr != null} onOpenChange={(v) => !v && setDelObr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta obrigação?</AlertDialogTitle>
            <AlertDialogDescription>
              As transações já lançadas não serão apagadas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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

function ObrLinha({
  o, mesRef, inativa, onDelete,
}: {
  o: Obrigacao
  mesRef: string
  inativa?: boolean
  onDelete: () => void
}) {
  const { descricaoIcones } = useFinData()
  const [editando, setEditando] = useState(false)
  const info = catInfo(o.categoria)
  const logo = logoDoLancamento(o.nome, descricaoIcones)
  const parcelaTxt = o.parcela_total
    ? `Parcela ${Math.max(1, parcelaNoMes(o, mesRef))}/${o.parcela_total}`
    : "Recorrente"

  return (
    <div className={cn("group/obr flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-secondary/40", inativa && "text-muted-foreground")}>
      <ObrigacaoDialog
        editar={o} open={editando} onOpenChange={setEditando}
        trigger={
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <LogoAvatar src={logo} cor={catColor(o.categoria)} Icon={info.icon} size={38} />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-medium", !inativa && "text-foreground")}>{o.nome}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {info.l}{o.dia_vencimento ? ` · dia ${o.dia_vencimento}` : ""} · {parcelaTxt}
              </span>
            </span>
            <span className={cn("tnum shrink-0 font-semibold", inativa ? "text-muted-foreground" : "text-foreground")}>{fmtR(Number(o.valor))}</span>
          </button>
        }
      />
      <RowActions
        onEditar={() => setEditando(true)}
        onExcluir={onDelete}
        className="md:opacity-0 md:group-hover/obr:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
      />
    </div>
  )
}

function Kpi({ label, valor, sub, tom }: { label: string; valor: number; sub: string; tom?: "alerta" | "ok" }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-3 sm:p-4">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="tnum mt-1 truncate font-display text-lg font-semibold tracking-[-0.02em] sm:text-2xl">{fmtR(valor)}</p>
      <p className={cn("mt-1 truncate text-xs", tom === "alerta" ? "text-destructive" : tom === "ok" ? "text-primary" : "text-muted-foreground")}>{sub}</p>
    </div>
  )
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
function rotuloDia(dia: number | null, dias: number, mesRef: string): string {
  if (dia == null) return "sem dia"
  if (dias === 0) return "Hoje"
  if (dias === 1) return "Amanhã"
  return `${String(dia).padStart(2, "0")} ${MESES[Number(mesRef.slice(5, 7)) - 1]}`
}

// logos das obrigações: lê o dicionário da store sem precisar de hook dentro do map
function descricaoIconesSeguro() {
  return useFinData.getState().descricaoIcones
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-10 text-center">
      <Inbox className="size-7 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
