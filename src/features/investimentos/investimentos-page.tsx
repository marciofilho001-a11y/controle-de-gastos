import { useMemo, useState } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts"
import {
  Landmark, TrendingUp, Sparkles, CircleDollarSign, Plus, Trash2, Loader2, Inbox, Save,
} from "lucide-react"
import { toast } from "sonner"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase } from "@/lib/supabase"
import { fmtR, fmtData, fmtMesRef, fmtMesCurto, proximosMeses, addMonths } from "@/lib/format"
import {
  patrimonioDoMes, saldoContaDoMes, investidoAcumuladoAte, calcularProjecaoMes,
} from "@/lib/selectors"

export function InvestimentosPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes, config, investimentos, saldos, loadAll } = useFinData()
  const [saldoInput, setSaldoInput] = useState("")
  const [savingSaldo, setSavingSaldo] = useState(false)
  const [delInv, setDelInv] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const d = useMemo(() => {
    const totalInvestido = investimentos.reduce((s, i) => s + Number(i.valor), 0)
    const patrimonio = patrimonioDoMes(saldos, investimentos, mesRef)
    const proj = calcularProjecaoMes(obrigacoes, cartoes, transacoes, config, mesRef)
    const investidoMes = investimentos.filter((i) => i.mes_ref === mesRef).reduce((s, i) => s + Number(i.valor), 0)
    const saldoExato = saldos.find((s) => s.mes_ref === mesRef)
    const saldoUltimo = saldoContaDoMes(saldos, mesRef)

    // gráfico de patrimônio acumulado dos últimos meses
    const meses = proximosMeses(12, addMonths(mesRef, -6)).slice(0, 12)
    const serie = meses.map((m) => ({
      mes: fmtMesCurto(m),
      Patrimônio: Math.round(saldoContaDoMes(saldos, m) + investidoAcumuladoAte(investimentos, m)),
    }))

    return { totalInvestido, patrimonio, proj, investidoMes, saldoExato, saldoUltimo, serie }
  }, [obrigacoes, cartoes, transacoes, config, investimentos, saldos, mesRef])

  async function salvarSaldo() {
    const v = parseFloat(saldoInput || (d.saldoExato ? String(d.saldoExato.saldo) : ""))
    if (isNaN(v)) {
      toast.error("Preencha o saldo")
      return
    }
    setSavingSaldo(true)
    try {
      const { error } = await supabase
        .from("fin_saldo_conta")
        .upsert({ mes_ref: mesRef, saldo: v, atualizado_em: new Date().toISOString() }, { onConflict: "mes_ref" })
      if (error) throw error
      toast.success("Saldo salvo!")
      await loadAll()
    } catch (e) {
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSavingSaldo(false)
    }
  }

  async function confirmarDelete() {
    if (delInv == null) return
    setBusy(true)
    try {
      const { error } = await supabase.from("fin_investimentos").delete().eq("id", delInv)
      if (error) throw error
      toast.success("Investimento removido")
      setDelInv(null)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Investimentos</h2>
        <NovoInvestimentoDialog />
      </div>

      {/* saldo em conta */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
            Saldo em conta — {fmtMesRef(mesRef)}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Snapshot manual do saldo da(s) sua(s) conta(s). Meses sem lançamento repetem o último valor, pro gráfico de patrimônio não quebrar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="saldo">Saldo atual (R$)</Label>
            <Input
              id="saldo" type="number" step="0.01"
              defaultValue={d.saldoExato ? String(d.saldoExato.saldo) : ""}
              onChange={(e) => setSaldoInput(e.target.value)}
              placeholder="0,00" className="tnum w-[200px]"
            />
          </div>
          <Button onClick={salvarSaldo} disabled={savingSaldo}>
            {savingSaldo ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            Salvar
          </Button>
          {!d.saldoExato && d.saldoUltimo > 0 && (
            <span className="pb-2 text-xs text-muted-foreground">Último informado: {fmtR(d.saldoUltimo)}</span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Patrimônio Total" value={d.patrimonio} icon={Landmark} tone="teal" index={0} valueClassName="text-success" />
        <StatCard label="Total Investido" value={d.totalInvestido} icon={TrendingUp} tone="teal" index={1} valueClassName="text-success" />
        <StatCard label="Sugerido este mês" value={d.proj.sugestao} icon={Sparkles} tone="slate" index={2} />
        <StatCard
          label="Investido este mês" value={d.investidoMes} icon={CircleDollarSign}
          tone={d.investidoMes >= d.proj.sugestao ? "teal" : "warning"} index={3}
        />
      </div>

      {/* gráfico patrimônio */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-3.5" /> Patrimônio ao Longo do Tempo
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.serie} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="patrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => "R$" + v} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-semibold">{label}</p>
                    <p className="tnum text-muted-foreground">{fmtR(payload[0].value)}</p>
                  </div>
                )
              }} />
              <Area type="monotone" dataKey="Patrimônio" stroke="var(--primary)" strokeWidth={2.5} fill="url(#patrGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* histórico de aportes */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Mês ref.</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {investimentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center">
                  <span className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="size-7 text-muted-foreground/60" />
                    Nenhum investimento registrado
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              investimentos.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="tnum text-muted-foreground">{fmtData(inv.data)}</TableCell>
                  <TableCell>{inv.mes_ref}</TableCell>
                  <TableCell>{inv.descricao || "—"}</TableCell>
                  <TableCell className="tnum text-right font-semibold text-success">{fmtR(Number(inv.valor))}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => setDelInv(inv.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={delInv != null} onOpenChange={(v) => !v && setDelInv(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este investimento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmarDelete() }} disabled={busy}>
              {busy && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function NovoInvestimentoDialog() {
  const { loadAll } = useFinData()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [valor, setValor] = useState("")
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [descricao, setDescricao] = useState("")

  async function salvar() {
    const v = parseFloat(valor)
    if (!v || !data) {
      toast.error("Preencha valor e data")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from("fin_investimentos").insert({
        valor: v, data, mes_ref: data.slice(0, 7), descricao: descricao.trim(),
      })
      if (error) throw error
      toast.success("Investimento registrado!")
      setOpen(false)
      setValor(""); setDescricao(""); setData(new Date().toISOString().slice(0, 10))
      await loadAll()
    } catch (e) {
      toast.error("Erro ao registrar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" /> Registrar Investimento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Investimento</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="i-valor">Valor (R$)</Label>
              <Input id="i-valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="i-data">Data</Label>
              <Input id="i-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-desc">Descrição (opcional)</Label>
            <Input id="i-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Tesouro, CDB..." />
          </div>
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

