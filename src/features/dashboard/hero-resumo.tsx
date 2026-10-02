import { useState } from "react"
import { motion } from "motion/react"
import { ArrowUp, ArrowDown, Clock, Eye, EyeOff, CircleCheck, TrendingDown } from "lucide-react"
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts"
import { fmtR, fmtMesCurto, fmtMesRef, addMonths } from "@/lib/format"
import { variacaoPct } from "@/lib/selectors"
import { cn } from "@/lib/utils"
import { EASE } from "./painel"

type Ponto = { mes: string; saldo: number }

// Faixa de resumo do topo: saldo em destaque + receitas, despesas, pendentes e o saldo dos últimos meses
export function HeroResumo({
  mesRef, saldo, receitas, despesas, receitasAnt, despesasAnt, pendentes, nPendentes, serie,
}: {
  mesRef: string; saldo: number; receitas: number; despesas: number; receitasAnt: number; despesasAnt: number
  pendentes: number; nPendentes: number; serie: Ponto[]
}) {
  const [oculto, setOculto] = useState(false)
  const pctRenda = receitas > 0 ? Math.round((saldo / receitas) * 100) : null
  const positivo = saldo >= 0
  const esconder = (v: string) => (oculto ? "R$ ••••" : v)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
      className="painel relative overflow-hidden rounded-2xl border bg-card"
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" style={{ boxShadow: "0 0 18px var(--primary)" }} />
      <div className="grid gap-y-5 p-5 pl-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,2.4fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,2.3fr)_minmax(0,1.2fr)] xl:items-center">
        {/* saldo */}
        <div className="flex flex-col gap-2 md:pr-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            Saldo do mês
            <button
              type="button" onClick={() => setOculto((o) => !o)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={oculto ? "Mostrar valores" : "Esconder valores"}
            >
              {oculto ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className={cn("tnum text-[2.35rem] leading-none font-bold tracking-tight", positivo ? "text-primary" : "text-destructive")}>
            {esconder(fmtR(saldo))}
          </p>
          {pctRenda !== null && (
            <span className={cn(
              "mt-1 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              positivo ? "border-primary/35 bg-primary/10 text-primary" : "border-destructive/35 bg-destructive/10 text-destructive",
            )}>
              {positivo ? <CircleCheck className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {positivo ? `${pctRenda}% da sua renda` : `${Math.abs(pctRenda)}% acima da renda`}
            </span>
          )}
        </div>

        {/* receitas · despesas · pendentes */}
        <div className="grid grid-cols-1 gap-3.5 border-t pt-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:border-t-0 sm:pt-0 md:border-l md:pl-2">
          <Kpi
            icon={ArrowUp} tom="success" rotulo="Receitas" valor={esconder(fmtR(receitas))}
            rodape={<Variacao atual={receitas} anterior={receitasAnt} mesRef={mesRef} />}
          />
          <Kpi
            icon={ArrowDown} tom="destructive" rotulo="Despesas" valor={esconder(fmtR(despesas))} valorCls="text-destructive"
            rodape={<Variacao atual={despesas} anterior={despesasAnt} mesRef={mesRef} invertido />}
          />
          <Kpi
            icon={Clock} tom="warning" rotulo="Pendentes" valor={esconder(fmtR(pendentes))} valorCls="text-warning"
            rodape={
              nPendentes > 0
                ? <span className="rounded-md bg-warning/12 px-2 py-0.5 text-xs font-medium text-warning">{nPendentes} conta{nPendentes > 1 ? "s" : ""}</span>
                : <span className="text-xs text-muted-foreground">tudo pago</span>
            }
          />
        </div>

        {/* saldo dos últimos meses */}
        <div className="h-24 md:col-span-2 xl:col-span-1 xl:h-28 xl:border-l xl:pl-4">
          <MiniSaldo serie={serie} mesRef={mesRef} oculto={oculto} />
        </div>
      </div>
    </motion.section>
  )
}

const TONS = {
  success: "bg-success/12 text-success ring-success/25",
  destructive: "bg-destructive/12 text-destructive ring-destructive/25",
  warning: "bg-warning/12 text-warning ring-warning/25",
} as const

function Kpi({
  icon: Icon, tom, rotulo, valor, valorCls, rodape,
}: {
  icon: React.ComponentType<{ className?: string }>; tom: keyof typeof TONS; rotulo: string; valor: string; valorCls?: string; rodape: React.ReactNode
}) {
  return (
    <>
      {/* celular: uma linha por indicador */}
      <div className="flex items-center gap-3 sm:hidden">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full ring-1", TONS[tom])}><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{rotulo}</p>
          <div className="mt-0.5">{rodape}</div>
        </div>
        <p className={cn("tnum text-lg font-semibold", valorCls)}>{valor}</p>
      </div>
      {/* tablet/desktop: coluna */}
      <div className="hidden flex-col gap-2 sm:flex sm:px-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("grid size-6 place-items-center rounded-full ring-1", TONS[tom])}><Icon className="size-3.5" /></span>
          {rotulo}
        </div>
        <p className={cn("tnum text-xl leading-tight font-semibold", valorCls)}>{valor}</p>
        <div className="min-h-5">{rodape}</div>
      </div>
    </>
  )
}

function Variacao({ atual, anterior, mesRef, invertido = false }: { atual: number; anterior: number; mesRef: string; invertido?: boolean }) {
  const v = variacaoPct(atual, anterior)
  const ant = fmtMesRef(addMonths(mesRef, -1))
  if (!v) return <span className="text-xs text-muted-foreground">sem base em {ant}</span>
  if (v.pct === 0) return <span className="text-xs text-muted-foreground">igual a {ant}</span>
  const bom = invertido ? !v.subiu : v.subiu
  const Seta = v.subiu ? ArrowUp : ArrowDown
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Seta className={cn("size-3", bom ? "text-success" : "text-destructive")} />
      <span className={cn("font-semibold", bom ? "text-success" : "text-destructive")}>{v.subiu ? "+" : ""}{v.pct}%</span>
      vs. {ant}
    </span>
  )
}

// Saldo de cada mês: barras discretas + linha com pontos (o mês atual em destaque)
function MiniSaldo({ serie, mesRef, oculto }: { serie: Ponto[]; mesRef: string; oculto: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={serie} margin={{ top: 8, right: 6, bottom: 4, left: 6 }}>
        <defs>
          <linearGradient id="miniSaldoBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[(min: number) => Math.min(0, min), "dataMax"]} />
        <Tooltip
          cursor={false}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as Ponto
            return (
              <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                <p className="text-muted-foreground">Saldo de {fmtMesCurto(p.mes)}</p>
                <p className={cn("tnum font-semibold", p.saldo >= 0 ? "text-primary" : "text-destructive")}>{oculto ? "R$ ••••" : fmtR(p.saldo)}</p>
              </div>
            )
          }}
        />
        <Bar dataKey="saldo" fill="url(#miniSaldoBar)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        <Line
          type="monotone" dataKey="saldo" stroke="var(--primary)" strokeWidth={2}
          dot={(p: { cx?: number; cy?: number; index?: number; payload?: Ponto }) => (
            <circle
              key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.mes === mesRef ? 4 : 2.5}
              fill={p.payload?.mes === mesRef ? "var(--primary)" : "var(--card)"} stroke="var(--primary)" strokeWidth={1.5}
            />
          )}
          activeDot={{ r: 4.5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
