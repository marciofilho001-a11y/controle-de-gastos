import { useMemo } from "react"
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts"
import { PartyPopper, Settings2, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { PageHeader, SectionTitle } from "@/components/page-header"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto, proximosMeses } from "@/lib/format"
import { calcularProjecaoMes } from "@/lib/selectors"
import {
  useChartColors, fmtAxis, axisProps, gridProps, ChartTooltip, ChartLegend, CHART_ANIM,
} from "@/lib/chart-theme"
import { cn } from "@/lib/utils"

export function ProjecaoPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, cartoes, transacoes, config, saveConfig } = useFinData()
  const c = useChartColors()

  const dados = useMemo(() => {
    const meses = proximosMeses(12, mesRef)
    return meses.map((m) => calcularProjecaoMes(obrigacoes, cartoes, transacoes, config, m))
  }, [obrigacoes, cartoes, transacoes, config, mesRef])

  const chartData = dados.map((d) => ({
    mes: fmtMesCurto(d.mesRef),
    Receita: Math.round(d.receita),
    Obrigações: Math.round(d.totalObr),
    Sobra: Math.round(d.sobra),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projeção Financeira"
        accent="próximos 12 meses"
        description="Receita, obrigações e sobra estimadas mês a mês a partir do mês navegado."
      />

      {/* Parâmetros */}
      <section>
        <SectionTitle icon={Settings2}>Parâmetros da Projeção</SectionTitle>
        <div className="rounded-xl border bg-card p-5">
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
      </section>

      {/* Gráfico */}
      <section>
        <SectionTitle
          icon={TrendingUp}
          right={<ChartLegend items={[
            { color: c.receita, label: "Receita" },
            { color: c.despesa, label: "Obrigações" },
            { color: c.primary, label: "Sobra" },
          ]} />}
        >
          Evolução Projetada
        </SectionTitle>
        <div className="rounded-xl border bg-card p-5">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="projSobra" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} {...gridProps(c)} />
                <XAxis dataKey="mes" {...axisProps(c)} />
                <YAxis tickFormatter={fmtAxis} {...axisProps(c)} width={70} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.grid }} />
                <Area
                  type="monotone" dataKey="Sobra" stroke="none" fill="url(#projSobra)"
                  animationDuration={CHART_ANIM} legendType="none" tooltipType="none"
                />
                <Line type="monotone" dataKey="Receita" stroke={c.receita} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                <Line type="monotone" dataKey="Obrigações" stroke={c.despesa} strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
                <Line type="monotone" dataKey="Sobra" stroke={c.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} animationDuration={CHART_ANIM} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

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
