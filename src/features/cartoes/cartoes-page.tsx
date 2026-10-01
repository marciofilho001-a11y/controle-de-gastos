import { useMemo, useState } from "react"
import { CreditCard, Pencil, Trash2, Loader2, Inbox, Check, Undo2, CalendarClock } from "lucide-react"
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
import { CompraDialog } from "./compra-dialog"
import { FaturaPrevistaDialog } from "./fatura-prevista-dialog"
import { FaturaDetalhe } from "./fatura-detalhe"
import { useFinData } from "@/hooks/use-fin-data"
import { registrarFaturaPaga, removerFaturaPaga } from "@/lib/pagamentos"
import { supabase, type Cartao, type CartaoCompra } from "@/lib/supabase"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtMesCurto, fmtData } from "@/lib/format"
import { faturaInfoDoMes, faturaPagaNoMes } from "@/lib/selectors"
import { motion } from "motion/react"
import { LogoAvatar } from "@/components/logo-avatar"
import { fechamentoDoCartao, diasParaFechar, dataLocal } from "@/lib/data-compra"
import { cn } from "@/lib/utils"

export function CartoesPage({ mesRef }: { mesRef: string }) {
  const { cartoes, compras, transacoes, faturaPagamentos, loadAll } = useFinData()
  const [filtroCartao, setFiltroCartao] = useState("todos")
  const [delCartao, setDelCartao] = useState<Cartao | null>(null)
  const [delCompra, setDelCompra] = useState<CartaoCompra | null>(null)
  const [busy, setBusy] = useState(false)
  const [detalheCartao, setDetalheCartao] = useState<Cartao | null>(null)
  const [busyFat, setBusyFat] = useState<number | null>(null)

  const comprasFiltradas = useMemo(() => {
    if (filtroCartao === "todos") return compras
    return compras.filter((c) => c.cartao_id === parseInt(filtroCartao))
  }, [compras, filtroCartao])

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
        title="Cartões de Crédito"
        accent={fmtMesCurto(mesRef)}
        description="Fatura de cada cartão no mês navegado, compras e parcelamentos."
        actions={<><CartaoDialog /><CompraDialog /></>}
      />

      {/* Grid de cartões */}
      {cartoes.length === 0 ? (
        <Empty>Nenhum cartão cadastrado</Empty>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {cartoes.map((c, i) => {
            const fatInfo = faturaInfoDoMes(transacoes, c.id, mesRef)
            const fatura = fatInfo.valor
            const usoLimite = c.limite ? Math.min(100, (fatura / Number(c.limite)) * 100) : null
            const pg = faturaPagaNoMes(faturaPagamentos, c.id, mesRef)
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: [0.2, 0, 0, 1] }}
                className="flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                onClick={() => setDetalheCartao(c)}
              >
                <div className="flex items-center gap-2.5">
                  <LogoAvatar src={c.logo} cor="var(--muted-foreground)" Icon={CreditCard} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-semibold">{c.nome}</p>
                    <CicloCartao cartao={c} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">Fatura deste mês</p>
                    {fatInfo.tipo === "prevista" && (
                      <span className="rounded-full bg-warning/15 px-2 py-px text-[0.6rem] font-semibold uppercase tracking-wide text-warning">prevista</span>
                    )}
                    {fatInfo.tipo === "atual" && (
                      <span className="rounded-full bg-success/15 px-2 py-px text-[0.6rem] font-semibold uppercase tracking-wide text-success">atual</span>
                    )}
                    {fatInfo.tipo === "parcial" && (
                      <span className="rounded-full bg-primary/15 px-2 py-px text-[0.6rem] font-semibold uppercase tracking-wide text-primary">parcial</span>
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
                  <p className="tnum text-xl font-semibold text-destructive">{fmtR(fatura)}</p>
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
                {usoLimite !== null && (
                  <div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full", usoLimite >= 90 ? "bg-destructive" : "bg-gradient-to-r from-series-previsto to-series-real")}
                        style={{ width: `${usoLimite}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[0.7rem] text-muted-foreground">
                      <span className="tnum">{fmtR(fatura)} de {fmtR(Number(c.limite))}</span>
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
                      <Button
                        variant="outline" size="sm" disabled={busyFat === c.id}
                        onClick={() => alternarFatura(c, false, fatura)}
                        className="w-full border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
                      >
                        {busyFat === c.id
                          ? <Loader2 data-icon="inline-start" className="animate-spin" />
                          : <CalendarClock data-icon="inline-start" />}
                        Marcar fatura como paga
                      </Button>
                    )}
                  </div>
                )}
                <div className="mt-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <CartaoDialog
                    editar={c}
                    trigger={
                      <Button variant="outline" size="sm" className="flex-1">
                        <Pencil data-icon="inline-start" /> Editar
                      </Button>
                    }
                  />
                  <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" onClick={() => setDelCartao(c)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Compras e parcelamentos */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Compras e Parcelamentos Lançados
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
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Cartão</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead className="text-right">Valor parcela</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
                <TableHead>Início</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comprasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Nenhuma compra lançada
                  </TableCell>
                </TableRow>
              ) : (
                comprasFiltradas.map((cp) => {
                  const info = catInfo(cp.categoria)
                  const Icon = info.icon
                  const total = Number(cp.valor_parcela) * cp.parcela_total
                  return (
                    <TableRow key={cp.id}>
                      <TableCell className="font-medium">{cartaoNome(cp.cartao_id)}</TableCell>
                      <TableCell>{cp.descricao || "—"}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 font-medium" style={{ color: catColor(cp.categoria) }}>
                          <Icon className="size-4" /> {info.l}
                        </span>
                      </TableCell>
                      <TableCell>{cp.parcela_total > 1 ? `1/${cp.parcela_total}` : "à vista"}</TableCell>
                      <TableCell className="tnum text-right">{fmtR(Number(cp.valor_parcela))}</TableCell>
                      <TableCell className="tnum text-right text-muted-foreground">{fmtR(total)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtMesCurto(cp.data_inicio.slice(0, 7))}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <CompraDialog
                            editar={cp}
                            trigger={
                              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary" aria-label="Editar compra">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => setDelCompra(cp)} aria-label="Remover compra">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
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
