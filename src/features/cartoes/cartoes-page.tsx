import { useMemo, useState } from "react"
import { CreditCard, Pencil, Loader2, Inbox, Check, Undo2, FileCheck2, Landmark, Sparkles, ChevronRight } from "@/lib/icons"
import { RowActions } from "@/components/row-actions"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { CartaoDialog } from "./cartao-dialog"
import { CartaoMini } from "./cartao-mini"
import { CompraDialog } from "./compra-dialog"
import { FaturaPrevistaDialog } from "./fatura-prevista-dialog"
import { FaturaDetalhe } from "./fatura-detalhe"
import { useFinData } from "@/hooks/use-fin-data"
import { registrarFaturaPaga, removerFaturaPaga } from "@/lib/pagamentos"
import { supabase, type Cartao, type CartaoCompra } from "@/lib/supabase"
import { catInfo } from "@/lib/categorias"
import { fmtR, fmtMesCurto, fmtData } from "@/lib/format"
import { faturaInfoDoMes, faturaPagaNoMes } from "@/lib/selectors"
import { motion } from "motion/react"
import { LogoAvatar } from "@/components/logo-avatar"
import { fechamentoDoCartao, diasParaFechar, dataLocal } from "@/lib/data-compra"
import { faturaDoMesNoBanco, faturaFechadaDoMes, mesDaFaturaAberta, nomeDoPlastico } from "@/lib/bancos"
import type { ContaBanco } from "@/lib/supabase"
import type { TabId } from "@/components/layout/nav"
import { cn } from "@/lib/utils"

export function CartoesPage({ mesRef, onNavigate }: { mesRef: string; onNavigate?: (t: TabId) => void }) {
  const { cartoes, compras, transacoes, faturaPagamentos, contasBanco, loadAll } = useFinData()
  const [filtroCartao, setFiltroCartao] = useState("todos")
  const [delCartao, setDelCartao] = useState<Cartao | null>(null)
  const [delCompra, setDelCompra] = useState<CartaoCompra | null>(null)
  const [busy, setBusy] = useState(false)
  const [detalheCartao, setDetalheCartao] = useState<Cartao | null>(null)
  const [busyFat, setBusyFat] = useState<number | null>(null)

  // mais recentes primeiro (por mês de início), depois por cartão
  const comprasFiltradas = useMemo(() => {
    const base = filtroCartao === "todos" ? compras : compras.filter((c) => c.cartao_id === parseInt(filtroCartao))
    return [...base].sort((a, b) =>
      a.data_inicio < b.data_inicio ? 1 : a.data_inicio > b.data_inicio ? -1 : a.cartao_id - b.cartao_id || b.id - a.id)
  }, [compras, filtroCartao])
  const [editCartao, setEditCartao] = useState<Cartao | null>(null)
  const [editCompra, setEditCompra] = useState<CartaoCompra | null>(null)

  async function confirmarDelCartao() {
    if (!delCartao) return
    const temCompras = compras.some((c) => c.cartao_id === delCartao.id)
    if (temCompras) {
      toast.error("Exclua as compras deste cartão antes de removê-lo")
      setDelCartao(null)
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.from("fin_cartoes").delete().eq("id", delCartao.id)
      if (error) throw error
      toast.success("Cartão removido")
      setDelCartao(null)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  async function confirmarDelCompra() {
    if (!delCompra) return
    setBusy(true)
    try {
      await supabase.from("fin_transacoes").delete().eq("compra_id", delCompra.id)
      const { error } = await supabase.from("fin_cartao_compras").delete().eq("id", delCompra.id)
      if (error) throw error
      toast.success("Compra e parcelas removidas")
      setDelCompra(null)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  // baixa da fatura do mês navegado (fica registrada; não mexe nos lançamentos)
  async function alternarFatura(c: Cartao, paga: boolean, valor: number) {
    setBusyFat(c.id)
    try {
      if (paga) {
        await removerFaturaPaga(c.id, mesRef)
        toast.success(`Fatura do ${c.nome} reaberta`)
      } else {
        await registrarFaturaPaga(c.id, mesRef, valor)
        toast.success(`Fatura do ${c.nome} marcada como paga`)
      }
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível atualizar a fatura", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusyFat(null)
    }
  }

  function cartaoNome(id: number) {
    return cartoes.find((c) => c.id === id)?.nome ?? "—"
  }

  if (detalheCartao) {
    return <FaturaDetalhe cartao={detalheCartao} onVoltar={() => setDetalheCartao(null)} mesRefBase={mesRef} />
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cartões"
        accent={fmtMesCurto(mesRef)}
        description="Fatura de cada cartão no mês navegado, compras e parcelamentos."
        actions={<><CartaoDialog /><CompraDialog /></>}
      />

      {/* Grid de cartões */}
      {cartoes.length === 0 ? (
        <Empty>Nenhum cartão cadastrado</Empty>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {cartoes.map((c) => {
            const fatInfo = faturaInfoDoMes(transacoes, c.id, mesRef)
            const fatura = fatInfo.valor
            const doBanco = contasBanco.find((x) => x.tipo === "CREDIT" && x.cartao_id === c.id && x.ativo !== false) ?? null
            // com o banco ligado, a barra mostra o limite real usado; sem ele, a fatura do app sobre o limite cadastrado
            const usoLimite = doBanco?.limite
              ? Math.min(100, (Number(doBanco.saldo ?? 0) / Number(doBanco.limite)) * 100)
              : c.limite ? Math.min(100, (fatura / Number(c.limite)) * 100) : null
            const pg = faturaPagaNoMes(faturaPagamentos, c.id, mesRef)
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                className="group/cartao flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/20"
                onClick={() => setDetalheCartao(c)}
              >
                <div className="flex items-center gap-2.5">
                  <LogoAvatar src={c.logo} cor="var(--muted-foreground)" Icon={CreditCard} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-semibold">{c.nome}</p>
                    <CicloCartao cartao={c} />
                  </div>
                  <CartaoMini nome={c.nome} logo={c.logo} />
                  <span onClick={(e) => e.stopPropagation()}>
                    <RowActions size="sm" onEditar={() => setEditCartao(c)} onExcluir={() => setDelCartao(c)} />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[0.8rem] text-muted-foreground">Fatura deste mês</p>
                    {fatInfo.tipo === "prevista" && (
                      <span className="rounded-full bg-secondary px-2 py-px text-[0.68rem] font-medium text-muted-foreground">prevista</span>
                    )}
                    {fatInfo.tipo === "atual" && (
                      <span className="rounded-full bg-secondary px-2 py-px text-[0.68rem] font-medium text-muted-foreground">atual</span>
                    )}
                    {fatInfo.tipo === "parcial" && (
                      <span className="rounded-full bg-secondary px-2 py-px text-[0.68rem] font-medium text-muted-foreground">parcial</span>
                    )}
                    <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
                      <FaturaPrevistaDialog
                        cartao={c}
                        mesRef={mesRef}
                        trigger={
                          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-primary" aria-label="Editar fatura prevista">
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                    </span>
                  </div>
                  <p className="tnum text-xl font-semibold">{fmtR(fatura)}</p>
                  {fatInfo.tipo === "parcial" && (
                    <div className="mt-1 flex flex-col gap-0.5 text-[0.7rem]">
                      <span className="flex justify-between text-muted-foreground">
                        <span className="text-success">✓ detalhado</span>
                        <span className="tnum">{fmtR(fatInfo.detalhado)}</span>
                      </span>
                      <span className="flex justify-between text-muted-foreground">
                        <span>◌ fatura indefinida</span>
                        <span className="tnum">{fmtR(fatInfo.indefinido)}</span>
                      </span>
                    </div>
                  )}
                </div>
                {doBanco && <NoBanco cartao={c} conta={doBanco} mesRef={mesRef} faturaApp={fatura} onNavigate={onNavigate} />}
                {usoLimite !== null && (
                  <div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-500", usoLimite >= 90 ? "bg-destructive" : usoLimite >= 75 ? "bg-warning" : "bg-primary")}
                        style={{ width: `${usoLimite}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[0.7rem] text-muted-foreground">
                      {doBanco?.limite ? (
                        <span className="tnum">{fmtR(Number(doBanco.disponivel ?? Number(doBanco.limite) - Number(doBanco.saldo ?? 0)))} livres de {fmtR(Number(doBanco.limite))}</span>
                      ) : (
                        <span className="tnum">{fmtR(fatura)} de {fmtR(Number(c.limite))}</span>
                      )}
                      <span className="tnum">{usoLimite.toFixed(0)}%</span>
                    </div>
                  </div>
                )}
                {fatura > 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {pg ? (
                      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5">
                        <Check className="size-4 shrink-0 text-success" />
                        <p className="min-w-0 flex-1 truncate text-xs font-medium text-success">Paga em {fmtData(pg.pago_em)}</p>
                        <Button
                          variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"
                          aria-label="Reabrir fatura" disabled={busyFat === c.id}
                          onClick={() => alternarFatura(c, true, fatura)}
                        >
                          {busyFat === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button" disabled={busyFat === c.id}
                        onClick={() => alternarFatura(c, false, fatura)}
                        className="btn-pagar"
                      >
                        <span className="btn-pagar-icone">
                          {busyFat === c.id ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate pr-8 text-center">Marcar fatura como paga</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Compras e parcelamentos */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground/85">
            Compras e parcelamentos
          </h3>
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todos">Todos os cartões</SelectItem>
                {cartoes.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Cada compra gera uma transação por parcela, já no mês certo — excluir aqui remove todas as parcelas de uma vez.
        </p>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Compra</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead className="text-right">Parcela</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Início</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {comprasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhuma compra lançada
                  </TableCell>
                </TableRow>
              ) : (
                comprasFiltradas.map((cp) => {
                  const info = catInfo(cp.categoria)
                  const total = Number(cp.valor_parcela) * cp.parcela_total
                  const cartao = cartoes.find((c) => c.id === cp.cartao_id)
                  const mostraCat = cp.categoria && cp.categoria !== "cartao"
                  return (
                    <TableRow key={cp.id} className="group/compra">
                      <TableCell>
                        <button type="button" onClick={() => setEditCompra(cp)} className="flex min-w-0 items-center gap-3 text-left">
                          <LogoAvatar src={cartao?.logo} cor="var(--muted-foreground)" Icon={CreditCard} size={30} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{cp.descricao || "—"}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {cartaoNome(cp.cartao_id)}{mostraCat ? ` · ${info.l}` : ""}
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{cp.parcela_total > 1 ? `${cp.parcela_total}x` : "à vista"}</TableCell>
                      <TableCell className="tnum text-right font-medium">{fmtR(Number(cp.valor_parcela))}</TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">{fmtR(total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtMesCurto(cp.data_inicio.slice(0, 7))}</TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          size="sm" onEditar={() => setEditCompra(cp)} onExcluir={() => setDelCompra(cp)}
                          className="md:opacity-0 md:group-hover/compra:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        {editCompra && <CompraDialog editar={editCompra} open onOpenChange={(v) => !v && setEditCompra(null)} trigger={<span hidden />} />}
        {editCartao && <CartaoDialog editar={editCartao} open onOpenChange={(v) => !v && setEditCartao(null)} trigger={<span hidden />} />}
      </section>

      {/* Confirmações */}
      <AlertDialog open={delCartao != null} onOpenChange={(v) => !v && setDelCartao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este cartão?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmarDelCartao() }} disabled={busy}>
              {busy && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={delCompra != null} onOpenChange={(v) => !v && setDelCompra(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta compra e todas as parcelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as parcelas (inclusive de meses futuros) serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmarDelCompra() }} disabled={busy}>
              {busy && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

// o que o banco diz deste cartão no mês navegado, lado a lado com o app
function NoBanco({ cartao, conta, mesRef, faturaApp, onNavigate }: {
  cartao: Cartao; conta: ContaBanco; mesRef: string; faturaApp: number; onNavigate?: (t: TabId) => void
}) {
  const { extrato } = useFinData()
  const hoje = dataLocal(new Date().toISOString())
  const aberta = mesDaFaturaAberta(extrato, conta, cartao, hoje)
  const calc = faturaDoMesNoBanco(extrato, conta, cartao, mesRef)
  const fechada = faturaFechadaDoMes(conta, mesRef)
  const ehAberta = mesRef === aberta
  const futura = mesRef > aberta
  const aRevisar = calc.itens.filter((e) => e.status === "novo").length
  // compara compras com compras: o app soma os gastos; o banco desconta pagamentos antecipados
  const faltaNoApp = Math.round((calc.compras - faturaApp) * 100) / 100
  const semDados = calc.itens.length === 0 && !fechada

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/25 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
      <p className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
        <Landmark className="size-3.5" /> No banco · {nomeDoPlastico(conta)}{conta.numero ? ` ••${conta.numero}` : ""}
      </p>
      {semDados ? (
        <p className="mt-1 text-xs text-muted-foreground">{futura ? "Só parcelas futuras por enquanto." : "Sem movimentação deste mês no banco."}</p>
      ) : (
        <>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {ehAberta ? "Compras até agora" : futura ? "Parcelas já lançadas" : "Compras da fatura"}
            </span>
            <span className="tnum text-sm font-semibold">{fmtR(calc.compras)}</span>
          </div>
          {fechada && !ehAberta && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">Cobrado no vencimento</span>
              <span className="tnum text-xs font-medium">{fmtR(fechada.total)}</span>
            </div>
          )}
          {calc.creditos > 0 && (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted-foreground">Pago antecipado</span>
              <span className="tnum text-xs font-medium text-success">− {fmtR(calc.creditos)}</span>
            </div>
          )}
          <p className={cn("mt-1.5 text-[0.7rem]", Math.abs(faltaNoApp) <= 0.5 ? "text-success" : "text-muted-foreground")}>
            {Math.abs(faltaNoApp) <= 0.5 ? "✓ bate com o app" : faltaNoApp > 0 ? `no banco tem ${fmtR(faltaNoApp)} a mais que no app` : `no app tem ${fmtR(-faltaNoApp)} a mais que no banco`}
          </p>
        </>
      )}
      {aRevisar > 0 && onNavigate && (
        <button onClick={() => onNavigate("revisar")} className="press mt-2 flex w-full items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-left text-xs font-medium text-primary">
          <Sparkles className="size-3.5" weight="fill" />
          <span className="flex-1">{aRevisar} compra{aRevisar > 1 ? "s" : ""} pra revisar</span>
          <ChevronRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-10 text-center">
      <Inbox className="size-7 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

// "Fecha dia 3 · Vence dia 10" + quantos dias faltam pro fechamento
function CicloCartao({ cartao }: { cartao: Cartao }) {
  const f = fechamentoDoCartao(cartao)
  const dias = diasParaFechar(cartao, dataLocal(new Date().toISOString()))
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <p className="flex flex-wrap items-center gap-x-1.5">
        <span title={f?.estimado ? "Estimado: 7 dias antes do vencimento. Edite o cartão para informar o dia certo." : undefined}>
          Fecha {f ? `dia ${f.dia}${f.estimado ? "*" : ""}` : "—"}
        </span>
        <span aria-hidden>·</span>
        <span>Vence dia {cartao.dia_vencimento || "—"}</span>
      </p>
      {dias !== null && (
        <p className={cn("text-[0.7rem]", dias <= 3 ? "font-medium text-warning" : "text-muted-foreground/80")}>
          {dias === 0 ? "fecha hoje" : dias === 1 ? "fecha amanhã" : `fecha em ${dias} dias`}
        </p>
      )}
    </div>
  )
}
