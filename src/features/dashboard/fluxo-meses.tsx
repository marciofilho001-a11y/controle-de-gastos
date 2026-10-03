import { useMemo, useState } from "react"
import { BarChart3 } from "lucide-react"
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Obrigacao, Transacao } from "@/lib/supabase"
import { receitasDoMes, despesasComContasDoMes } from "@/lib/selectors"
import { addMonths, fmtMesCurto, fmtR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Painel } from "./painel"

const COR = { receitas: "#14a08b", despesas: "#e5484d", saldo: "color-mix(in srgb, var(--foreground) 72%, transparent)" }
const JANELAS = [4, 6, 12] as const

type Linha = { mes: string; label: string; receitas: number; despesas: number; saldo: number }

function compacto(v: number): string {
  return `${v < 0 ? "−" : ""}R$ ${Math.abs(Math.round(v)).toLocaleString("pt-BR")}`
}

// Receitas x despesas por mês (barras) e o saldo (linha), terminando no mês navegado
export function FluxoMeses({ transacoes, obrigacoes, mesRef, index }: { transacoes: Transacao[]; obrigacoes: Obrigacao[]; mesRef: string; index?: number }) {
  const [n, setN] = useState<(typeof JANELAS)[number]>(4)
  const dados = useMemo<Linha[]>(() => {
    const out: Linha[] = []
    for (let i = n - 1; i >= 0; i--) {
      const m = addMonths(mesRef, -i)
      const r = receitasDoMes(transacoes, m), d = despesasComContasDoMes(obrigacoes, transacoes, m)
      out.push({ mes: m, label: fmtMesCurto(m), receitas: r, despesas: d, saldo: r - d })
    }
    return out
  }, [transacoes, obrigacoes, mesRef, n])

  return (
    <Painel
      icon={BarChart3} titulo="Fluxo do mês" index={index}
      acao={
        <div className="flex rounded-lg border bg-secondary/40 p-0.5" role="tablist" aria-label="Período">
          {JANELAS.map((j) => (
            <button
              key={j} role="tab" aria-selected={n === j} onClick={() => setN(j)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                n === j ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {j} meses
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-1 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Legenda cor={COR.receitas} rotulo="Receitas" />
        <Legenda cor={COR.despesas} rotulo="Despesas" />
        <Legenda cor={COR.saldo} rotulo="Saldo" linha />
      </div>
      <div className="h-[230px] lg:h-auto lg:min-h-[230px] lg:flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barGap={4} barCategoryGap={n === 12 ? "22%" : "34%"}>
            <defs>
              <linearGradient id="fluxoRec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR.receitas} stopOpacity={1} />
                <stop offset="100%" stopColor={COR.receitas} stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="fluxoDesp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR.despesas} stopOpacity={1} />
                <stop offset="100%" stopColor={COR.despesas} stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis
              dataKey="mes" axisLine={false} tickLine={false} interval={0}
              tick={({ x, y, payload }: { x: number | string; y: number | string; payload: { value: string } }) => (
                <text x={Number(x)} y={Number(y) + 14} textAnchor="middle" fontSize={11}
                  fill={payload.value === mesRef ? "var(--foreground)" : "var(--muted-foreground)"}
                  fontWeight={payload.value === mesRef ? 600 : 400}>
                  {fmtMesCurto(payload.value)}
                </text>
              )}
            />
            <YAxis
              axisLine={false} tickLine={false} width={70} tickCount={5}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={compacto}
            />
            <Tooltip
              cursor={{ fill: "var(--secondary)", opacity: 0.45 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const l = payload[0].payload as Linha
                return (
                  <div className="min-w-44 rounded-lg border bg-popover p-2.5 text-xs shadow-lg">
                    <p className="mb-1.5 font-semibold">{fmtMesCurto(l.mes)}</p>
                    <LinhaTip cor={COR.receitas} rotulo="Receitas" valor={l.receitas} />
                    <LinhaTip cor={COR.despesas} rotulo="Despesas" valor={l.despesas} />
                    <div className="mt-1.5 border-t pt-1.5">
                      <LinhaTip cor={COR.saldo} rotulo="Saldo" valor={l.saldo} destaque={l.saldo >= 0 ? "text-primary" : "text-destructive"} />
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="receitas" name="Receitas" fill="url(#fluxoRec)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="despesas" name="Despesas" fill="url(#fluxoDesp)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line
              type="monotone" dataKey="saldo" name="Saldo" stroke={COR.saldo} strokeWidth={2}
              dot={{ r: 3, fill: "var(--card)", stroke: COR.saldo, strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: COR.saldo, stroke: "var(--card)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Painel>
  )
}

function Legenda({ cor, rotulo, linha }: { cor: string; rotulo: string; linha?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {linha
        ? <span className="relative h-0.5 w-3.5 rounded-full" style={{ background: cor }}><span className="absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full" style={{ background: cor }} /></span>
        : <span className="size-2.5 rounded-[3px]" style={{ background: cor }} />}
      {rotulo}
    </span>
  )
}

function LinhaTip({ cor, rotulo, valor, destaque }: { cor: string; rotulo: string; valor: number; destaque?: string }) {
  return (
    <p className="flex items-center gap-2 py-0.5">
      <span className="size-2 rounded-full" style={{ background: cor }} />
      <span className="flex-1 text-muted-foreground">{rotulo}</span>
      <span className={cn("tnum font-semibold", destaque)}>{fmtR(valor)}</span>
    </p>
  )
}
