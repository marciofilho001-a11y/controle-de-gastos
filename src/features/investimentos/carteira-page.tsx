import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Loader2, PiggyBank, HandCoins, Undo2, Pencil, Trash2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { useFinData } from "@/hooks/use-fin-data"
import type { Ativo, ClasseAtivo } from "@/lib/supabase"
import { CLASSES, classeInfo, criarAtivo, editarAtivo, venderAtivo, desfazerVenda, apagarAtivo } from "@/lib/ativos"
import { numeroBR } from "@/lib/importar-arquivo"
import { fmtR, fmtData, fmtMesCurto } from "@/lib/format"
import { cn } from "@/lib/utils"

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const fmtQtd = (n: number | null) => (n == null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: 6 }))
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e))

type Filtro = ClasseAtivo | "todos"

export function CarteiraPage() {
  const ativos = useFinData((s) => s.ativos)
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [novo, setNovo] = useState(false)
  const [editando, setEditando] = useState<Ativo | null>(null)
  const [vendendo, setVendendo] = useState<Ativo | null>(null)
  const [apagando, setApagando] = useState<Ativo | null>(null)

  const d = useMemo(() => {
    const abertos = ativos.filter((a) => !a.vendido_em)
    const vendidos = ativos.filter((a) => a.vendido_em).sort((a, b) => (b.vendido_em! > a.vendido_em! ? 1 : -1))
    const total = abertos.reduce((s, a) => s + a.valor_aplicado, 0)
    const porClasse = CLASSES.map((c) => {
      const lista = abertos.filter((a) => a.classe === c.v)
      return { ...c, total: lista.reduce((s, a) => s + a.valor_aplicado, 0), qtd: lista.length }
    })
    const lucroVendas = vendidos.reduce((s, a) => s + ((a.valor_venda ?? 0) - a.valor_aplicado), 0)
    return { abertos, vendidos, total, porClasse, lucroVendas }
  }, [ativos])

  const lista = filtro === "todos" ? d.abertos : d.abertos.filter((a) => a.classe === filtro)
  const vendidosFiltro = filtro === "todos" ? d.vendidos : d.vendidos.filter((a) => a.classe === filtro)
  const classesVisiveis = d.porClasse.filter((c) => c.v !== "outro" || c.qtd > 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Investimentos"
        description="Separe sua carteira em FIIs, ações e renda fixa. Quando vender, o dinheiro entra como receita no mês da venda."
        actions={<Button onClick={() => setNovo(true)}><Plus className="size-4" /> Novo investimento</Button>}
      />

      {/* resumo */}
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Na carteira</p>
            <p className="tnum text-3xl font-semibold tracking-tight">{fmtR(d.total)}</p>
          </div>
          {d.vendidos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Resultado das vendas:{" "}
              <span className={cn("tnum font-medium", d.lucroVendas >= 0 ? "text-success" : "text-destructive")}>
                {d.lucroVendas >= 0 ? "+" : ""}{fmtR(d.lucroVendas)}
              </span>
            </p>
          )}
        </div>
        {d.total > 0 && (
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {d.porClasse.filter((c) => c.total > 0).map((c) => (
              <span key={c.v} style={{ width: `${(c.total / d.total) * 100}%`, background: c.cor }} />
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <BotaoClasse ativo={filtro === "todos"} onClick={() => setFiltro("todos")} titulo="Tudo" valor={d.total} qtd={d.abertos.length} />
          {classesVisiveis.map((c) => (
            <BotaoClasse key={c.v} ativo={filtro === c.v} onClick={() => setFiltro(c.v)} titulo={c.curto} cor={c.cor}
              valor={c.total} qtd={c.qtd} pct={d.total ? (c.total / d.total) * 100 : 0} />
          ))}
        </div>
      </section>

      {/* carteira */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {filtro === "todos" ? "Seus investimentos" : classeInfo(filtro).l}
        </h2>
        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
            <PiggyBank className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {ativos.length === 0 ? "Nenhum investimento ainda. Cadastre o primeiro pra ver a carteira separada." : "Nada nessa classe por enquanto."}
            </p>
            <Button variant="outline" size="sm" onClick={() => setNovo(true)}><Plus className="size-4" /> Novo investimento</Button>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {lista.map((a) => {
              const c = classeInfo(a.classe)
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {a.ticker && a.nome !== a.ticker ? <><span className="tracking-wide">{a.ticker}</span> <span className="font-normal text-muted-foreground">· {a.nome}</span></> : a.ticker || a.nome}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.curto} · desde {fmtData(a.data_compra)}{a.quantidade ? ` · ${fmtQtd(a.quantidade)} cotas` : ""}
                    </p>
                  </div>
                  <p className="tnum shrink-0 font-semibold">{fmtR(a.valor_aplicado)}</p>
                  <div className="flex basis-full items-center justify-end gap-0.5 sm:basis-auto">
                    <Button size="sm" variant="outline" onClick={() => setVendendo(a)} className="h-8"><HandCoins className="size-4" /> Vender</Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditando(a)} aria-label="Editar"><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8 text-muted-foreground" onClick={() => setApagando(a)} aria-label="Apagar"><Trash2 className="size-4" /></Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* vendidos */}
      {vendidosFiltro.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Vendidos</h2>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {vendidosFiltro.map((a) => {
              const c = classeInfo(a.classe)
              const ganho = (a.valor_venda ?? 0) - a.valor_aplicado
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="size-2.5 shrink-0 rounded-full opacity-50" style={{ background: c.cor }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.ticker || a.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Vendido em {fmtData(a.vendido_em!)} · entrou como receita de {fmtMesCurto(a.vendido_em!.slice(0, 7)).toLowerCase()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum font-semibold text-success">+{fmtR(a.valor_venda ?? 0)}</p>
                    <p className={cn("tnum text-xs", ganho >= 0 ? "text-success" : "text-destructive")}>
                      {ganho >= 0 ? "lucro " : "prejuízo "}{fmtR(Math.abs(ganho))}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" title="Desfazer venda" aria-label="Desfazer venda"
                    onClick={async () => {
                      try { await desfazerVenda(a); toast("Venda desfeita", { description: "Voltou pra carteira e a receita saiu do mês." }) }
                      catch (e) { toast.error("Não consegui desfazer", { description: erroMsg(e) }) }
                    }}>
                    <Undo2 className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <AtivoDialog aberto={novo || !!editando} ativo={editando} classeInicial={filtro === "todos" ? "fii" : filtro}
        onOpenChange={(v) => { if (!v) { setNovo(false); setEditando(null) } }} />
      <VenderDialog ativo={vendendo} onOpenChange={(v) => { if (!v) setVendendo(null) }} />
      <AlertDialog open={!!apagando} onOpenChange={(v) => { if (!v) setApagando(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar {apagando?.ticker || apagando?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>Sai da carteira. Use isso se cadastrou errado; se você vendeu, use "Vender" pra o dinheiro entrar no mês.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!apagando) return
              try { await apagarAtivo(apagando); toast("Investimento apagado") }
              catch (e) { toast.error("Não consegui apagar", { description: erroMsg(e) }) }
            }}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BotaoClasse({ ativo, onClick, titulo, valor, qtd, cor, pct }: {
  ativo: boolean; onClick: () => void; titulo: string; valor: number; qtd: number; cor?: string; pct?: number
}) {
  return (
    <button onClick={onClick} aria-pressed={ativo}
      className={cn("press flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        ativo ? "border-primary/50 bg-primary/5" : "hover:border-foreground/20")}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {cor && <span className="size-2 rounded-full" style={{ background: cor }} />}
        {titulo}{pct != null && pct > 0 ? ` · ${Math.round(pct)}%` : ""}
      </span>
      <span className="tnum text-base font-semibold">{fmtR(valor)}</span>
      <span className="text-xs text-muted-foreground">{qtd} {qtd === 1 ? "ativo" : "ativos"}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------

function AtivoDialog({ aberto, ativo, classeInicial, onOpenChange }: {
  aberto: boolean; ativo: Ativo | null; classeInicial: ClasseAtivo; onOpenChange: (v: boolean) => void
}) {
  const [classe, setClasse] = useState<ClasseAtivo>("fii")
  const [ticker, setTicker] = useState("")
  const [nome, setNome] = useState("")
  const [qtd, setQtd] = useState("")
  const [valor, setValor] = useState("")
  const [data, setData] = useState(hojeISO())
  const [saiu, setSaiu] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setClasse(ativo?.classe ?? classeInicial)
    setTicker(ativo?.ticker ?? "")
    setNome(ativo?.nome ?? "")
    setQtd(ativo?.quantidade != null ? String(ativo.quantidade).replace(".", ",") : "")
    setValor(ativo ? String(ativo.valor_aplicado).replace(".", ",") : "")
    setData(ativo?.data_compra ?? hojeISO())
    setSaiu(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, ativo])

  const v = numeroBR(valor) ?? 0
  const q = qtd.trim() ? numeroBR(qtd) : null
  const nomeFinal = nome.trim() || ticker.trim().toUpperCase()
  const ok = v > 0 && nomeFinal.length > 0 && !!data && (q == null || q > 0)
  const rendaFixa = classe === "renda_fixa"

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    const dados = {
      classe, nome: nomeFinal, ticker: ticker.trim() ? ticker.trim().toUpperCase() : null,
      quantidade: rendaFixa ? null : q, valor_aplicado: Math.round(v * 100) / 100, data_compra: data,
    }
    try {
      if (ativo) {
        await editarAtivo(ativo.id, dados)
        toast.success("Investimento atualizado")
      } else {
        await criarAtivo({ ...dados, observacao: null, saiuDoMes: saiu })
        toast.success(`${dados.ticker || dados.nome} na carteira`, {
          description: saiu ? `Também lançado como despesa de ${fmtMesCurto(data.slice(0, 7)).toLowerCase()}.` : undefined,
        })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error("Não consegui salvar", { description: erroMsg(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ativo ? "Editar investimento" : "Novo investimento"}</DialogTitle>
          <DialogDescription>Quanto você colocou e quando. Dá pra ajustar depois.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Tipo">
            {CLASSES.map((c) => (
              <button type="button" key={c.v} role="radio" aria-checked={classe === c.v} onClick={() => setClasse(c.v)}
                className={cn("press flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                  classe === c.v ? "border-primary/60 bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <span className="size-2 rounded-full" style={{ background: c.cor }} /> {c.curto}
              </button>
            ))}
          </div>
          {rendaFixa ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="at-nome">Nome</Label>
              <Input id="at-nome" placeholder="CDB Nubank 110% CDI, Tesouro Selic…" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="at-ticker">Código</Label>
                <Input id="at-ticker" placeholder={classe === "fii" ? "MXRF11" : "PETR4"} value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())} autoCapitalize="characters" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="at-nome">Nome <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="at-nome" placeholder={classe === "fii" ? "Maxi Renda" : "Petrobras"} value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
            </div>
          )}
          <div className={cn("grid gap-3", rendaFixa ? "grid-cols-2" : "grid-cols-3")}>
            {!rendaFixa && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="at-qtd">Cotas</Label>
                <Input id="at-qtd" inputMode="decimal" placeholder="100" value={qtd} onChange={(e) => setQtd(e.target.value)} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="at-valor">Valor total</Label>
              <Input id="at-valor" inputMode="decimal" placeholder="1.000,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="at-data">Data</Label>
              <Input id="at-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          {!ativo && (
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Switch checked={saiu} onCheckedChange={setSaiu} className="mt-0.5" />
              <span>
                <span className="font-medium">Tirar do saldo do mês</span>
                <span className="block text-xs text-muted-foreground">Lança como despesa "Investimento (aporte)" em {fmtMesCurto(data.slice(0, 7)).toLowerCase()}. Deixe desligado se é algo que você já tinha.</span>
              </span>
            </label>
          )}
          <Button type="submit" disabled={!ok || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} {ativo ? "Salvar" : "Adicionar à carteira"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VenderDialog({ ativo, onOpenChange }: { ativo: Ativo | null; onOpenChange: (v: boolean) => void }) {
  const [data, setData] = useState(hojeISO())
  const [valor, setValor] = useState("")
  const [qtd, setQtd] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ativo) return
    setData(hojeISO())
    setValor("")
    setQtd(ativo.quantidade != null ? String(ativo.quantidade).replace(".", ",") : "")
  }, [ativo])

  const v = numeroBR(valor) ?? 0
  const q = qtd.trim() ? numeroBR(qtd) : null
  const total = ativo?.quantidade ?? null
  const qtdOk = total == null || q == null || (q > 0 && q <= total)
  const ok = !!ativo && v > 0 && !!data && qtdOk
  const parcial = total != null && q != null && q < total
  const aplicadoVendido = ativo ? (parcial ? ativo.valor_aplicado * (q! / total!) : ativo.valor_aplicado) : 0
  const ganho = v - aplicadoVendido

  async function vender(e: React.FormEvent) {
    e.preventDefault()
    if (!ok || !ativo) return
    setBusy(true)
    try {
      await venderAtivo(ativo, { data, valor: v, quantidade: total != null ? q : null })
      toast.success(`+${fmtR(v)} em ${fmtMesCurto(data.slice(0, 7)).toLowerCase()}`, {
        description: `Venda de ${ativo.ticker || ativo.nome} entrou como receita do mês.`,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error("Não consegui registrar a venda", { description: erroMsg(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!ativo} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Vender {ativo?.ticker || ativo?.nome}</DialogTitle>
          <DialogDescription>O valor recebido entra como receita no mês da venda, como um salário.</DialogDescription>
        </DialogHeader>
        <form onSubmit={vender} className="flex flex-col gap-3.5">
          {total != null && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vd-qtd">Cotas vendidas <span className="font-normal text-muted-foreground">(de {fmtQtd(total)})</span></Label>
              <Input id="vd-qtd" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} aria-invalid={!qtdOk} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vd-valor">Recebi</Label>
              <Input id="vd-valor" inputMode="decimal" placeholder="1.200,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vd-data">Data da venda</Label>
              <Input id="vd-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          {v > 0 && ativo && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              Colocou {fmtR(aplicadoVendido)} ·{" "}
              <span className={cn("font-medium", ganho >= 0 ? "text-success" : "text-destructive")}>
                {ganho >= 0 ? "lucro de " : "prejuízo de "}{fmtR(Math.abs(ganho))}
              </span>
              {parcial && <span className="block text-xs text-muted-foreground">O resto ({fmtQtd(total! - q!)} cotas) continua na carteira.</span>}
            </p>
          )}
          <Button type="submit" disabled={!ok || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Registrar venda
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
