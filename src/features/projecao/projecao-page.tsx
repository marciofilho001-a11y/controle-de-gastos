import { useMemo } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from "recharts"
import { PartyPopper, Settings2, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto, proximosMeses } from "@/lib/format"
import { calcularProjecaoMes } from "@/lib/selectors"
import { cn } from "@/lib/utils"

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tnum font-medium text-foreground">{fmtR(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export function ProjecaoPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes, config, saveConfig } = useFinData()

  const dados = useMemo(() => {
    const meses = proximosMeses(12, mesRef)
    return meses.map((m) => calcularProjecaoMes(obrigacoes, cartoes, transacoes, config, m))
  }, [obrigacoes, cartoes, transacoes, config, mesRef])

  const chartData = dados.map((d) => ({
    mes: fmtMesCurto(d.mesRef),
    Receita: Math.round(d.receita),
    Obrigações: Math.round(d.totalObr),
    Sobra: Math.round(d.sobra),
    estimado: d.estimado,
  }))

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-semibold">Projeção Financeira — Próximos 12 Meses</h2>

      {/* Parâmetros */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Settings2 className="size-3.5" /> Parâmetros da Projeção
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-renda">Renda mensal projetada (R$)</Label>
            <Input
              id="p-renda" type="number" step="0.01" defaultValue={config.renda_projetada ?? ""}
              className="tnum" placeholder="0,00"
              onBlur={(e) => saveConfig("renda_projetada", e.target.value)}
            />
            <span className="text-xs text-muted-foreground">Usada para meses futuros sem renda lançada ainda</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-pct">% da sobra sugerido p/ investir</Label>
            <Input
              id="p-pct" type="number" step="1" defaultValue={config.pct_investimento ?? "20"}
              className="tnum" placeholder="20"
              onBlur={(e) => saveConfig("pct_investimento", e.target.value)}
            />
            <span className="text-xs text-muted-foreground">Ex: 20 = investir 20% do que sobrar todo mês</span>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-3.5" /> Evolução Projetada
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => "R$" + v} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Receita" stroke="var(--series-previsto)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Obrigações" stroke="var(--series-real)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Sobra" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead>Obrigações ativas</TableHead>
              <TableHead className="text-right">Total obrigações</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Sobra</TableHead>
              <TableHead className="text-right">Sugestão investir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map((d, i) => {
              const anteriorQtd = i > 0 ? dados[i - 1].qtdObr : d.qtdObr
              const terminou = i > 0 && anteriorQtd > d.qtdObr
              return (
                <TableRow key={d.mesRef}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {fmtMesCurto(d.mesRef)}
                      {terminou && <PartyPopper className="size-3.5 text-primary" />}
                    </span>
                  </TableCell>
                  <TableCell>{d.qtdObr}</TableCell>
                  <TableCell className="tnum text-right text-destructive">{fmtR(d.totalObr)}</TableCell>
                  <TableCell className="tnum text-right text-success">{fmtR(d.receita)}</TableCell>
                  <TableCell className={cn("tnum text-right font-semibold", d.sobra >= 0 ? "text-success" : "text-destructive")}>
                    {fmtR(d.sobra)}
                  </TableCell>
                  <TableCell className="tnum text-right" style={{ color: "var(--cat-investimento)" }}>{fmtR(d.sugestao)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
