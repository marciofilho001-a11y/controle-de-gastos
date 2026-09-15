import { useMemo, useState } from "react"
import { Search, Download, Trash2, Calculator, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { NovaTransacaoDialog } from "./nova-transacao-dialog"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Transacao } from "@/lib/supabase"
import { catInfo, catColor, DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"
import { fmtR, fmtData } from "@/lib/format"
import { txDoMes } from "@/lib/selectors"
import { cn } from "@/lib/utils"

export function TransacoesPage({ mesRef }: { mesRef: string }) {
  const { transacoes, cartoes, loadAll } = useFinData()
  const [busca, setBusca] = useState("")
  const [filtTipo, setFiltTipo] = useState("todos")
  const [filtOrigem, setFiltOrigem] = useState("todas")
  const [filtCat, setFiltCat] = useState("todas")
  const [delId, setDelId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const todasCats = [...DESPESA_CATS, ...RECEITA_CATS].filter(
    (c, i, arr) => arr.findIndex((x) => x.v === c.v) === i
  )

  const list = useMemo(() => {
    let l = txDoMes(transacoes, mesRef)
    if (filtTipo !== "todos") l = l.filter((t) => t.tipo === filtTipo)
    if (filtOrigem === "debito") l = l.filter((t) => !t.cartao_id && !t.obrigacao_id)
    else if (filtOrigem === "cartao") l = l.filter((t) => !!t.cartao_id)
    else if (filtOrigem === "obrigacao") l = l.filter((t) => !!t.obrigacao_id)
    if (filtCat !== "todas") l = l.filter((t) => t.categoria === filtCat)
    const b = busca.trim().toLowerCase()
    if (b) l = l.filter((t) => (t.descricao || "").toLowerCase().includes(b))
    return l
  }, [transacoes, mesRef, filtTipo, filtOrigem, filtCat, busca])

  const algumFiltro = filtTipo !== "todos" || filtOrigem !== "todas" || filtCat !== "todas" || !!busca.trim()
  const totalDespesa = list.filter((t) => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor), 0)
  const totalReceita = list.filter((t) => t.tipo === "receita").reduce((s, t) => s + Number(t.valor), 0)

  function limparFiltros() {
    setBusca(""); setFiltTipo("todos"); setFiltOrigem("todas"); setFiltCat("todas")
  }

  function exportarCSV() {
    const linhas = [
      ["Data", "Descrição", "Categoria", "Tipo", "Valor"],
      ...list.map((t) => [
        fmtData(t.data), t.descricao || "", catInfo(t.categoria).l,
        t.tipo === "receita" ? "Receita" : "Despesa", String(Number(t.valor).toFixed(2)),
      ]),
    ]
    const csv = linhas.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
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

  function cartaoNome(id: number | null) {
    return cartoes.find((c) => c.id === id)?.nome
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Transações</h2>
        <NovaTransacaoDialog />
      </div>

      {/* barra de busca + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição..."
            className="pl-9"
          />
        </div>
        <Select value={filtTipo} onValueChange={setFiltTipo}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="receita">Receitas</SelectItem>
              <SelectItem value="despesa">Despesas</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={filtOrigem} onValueChange={setFiltOrigem}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="todas">Toda origem</SelectItem>
              <SelectItem value="debito">Débito / dinheiro</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
              <SelectItem value="obrigacao">Obrigação</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={filtCat} onValueChange={setFiltCat}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {todasCats.map((c) => (
                <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {algumFiltro && (
          <Button variant="ghost" onClick={limparFiltros}>Limpar filtros</Button>
        )}
        <Button variant="outline" onClick={exportarCSV}>
          <Download data-icon="inline-start" /> Exportar CSV
        </Button>
      </div>

      {/* resumo filtrado */}
      {algumFiltro && list.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
          <Calculator className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{list.length} lançamento(s) filtrado(s)</span>
          {totalDespesa > 0 && (
            <span className="text-destructive">· − {fmtR(totalDespesa)} em despesas</span>
          )}
          {totalReceita > 0 && (
            <span className="text-success">· + {fmtR(totalReceita)} em receitas</span>
          )}
        </div>
      )}

      {/* tabela */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              list.map((t) => {
                const info = catInfo(t.categoria)
                const Icon = info.icon
                const receita = t.tipo === "receita"
                return (
                  <TableRow key={t.id}>
                    <TableCell className="tnum text-muted-foreground">{fmtData(t.data)}</TableCell>
                    <TableCell className="font-medium">
                      {t.descricao || "—"}
                      {t.cartao_id && (
                        <Badge variant="secondary" className="ml-2 font-normal">
                          {cartaoNome(t.cartao_id)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 font-medium" style={{ color: catColor(t.categoria) }}>
                        <Icon className="size-4" /> {info.l}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(receita ? "border-success/40 text-success" : "border-destructive/40 text-destructive")}
                      >
                        {receita ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn("tnum text-right font-semibold", receita ? "text-success" : "text-destructive")}>
                      {receita ? "+ " : "− "}{fmtR(Number(t.valor))}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => setDelId(t.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

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

export type { Transacao }
