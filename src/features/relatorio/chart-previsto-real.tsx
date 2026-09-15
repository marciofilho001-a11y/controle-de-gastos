import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
} from "recharts"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"

export type LinhaCat = {
  catKey: string
  label: string
  previsto: number
  real: number
  cor: string
}

function CategoryTick(props: any) {
  const { x, y, payload, linhas } = props
  const linha = (linhas as LinhaCat[]).find((l) => l.label === payload.value)
  if (!linha) return null
  const info = catInfo(linha.catKey)
  const Icon = info.icon
  const cor = catColor(linha.catKey)
  const chipSize = 28
  const chipX = x - 150
  return (
    <g transform={`translate(0,${y})`}>
      <rect
        x={chipX} y={-chipSize / 2} width={chipSize} height={chipSize} rx={8}
        fill={`${cor}22`} stroke={`${cor}44`} strokeWidth={1}
      />
      <g transform={`translate(${chipX + chipSize / 2 - 8}, -8)`}>
        <Icon width={16} height={16} stroke={cor} />
      </g>
      <text
        x={chipX + chipSize + 8} y={0} dy="0.32em"
        fontSize={13} fontWeight={600} fill="var(--foreground)"
        fontFamily="var(--font-display)"
      >
        {linha.label}
      </text>
    </g>
  )
}

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

export function ChartPrevistoReal({ linhas }: { linhas: LinhaCat[] }) {
  if (!linhas.length) {
    return (
      <div className="grid h-48 place-items-center text-sm text-muted-foreground">
        Sem dados para comparar neste mês
      </div>
    )
  }
  const height = Math.max(220, linhas.length * 82)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={linhas}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 8, left: 160 }}
          barCategoryGap="30%"
          barGap={4}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tickFormatter={(v) => "R$" + v}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={158}
            tick={(props) => <CategoryTick {...props} linhas={linhas} />}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
          <Bar dataKey="previsto" name="Previsto" radius={6} barSize={13}>
            {linhas.map((l) => (
              <Cell key={`p-${l.catKey}`} fill="var(--series-previsto)" />
            ))}
          </Bar>
          <Bar dataKey="real" name="Real" radius={6} barSize={13}>
            {linhas.map((l) => (
              <Cell key={`r-${l.catKey}`} fill="var(--series-real)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
