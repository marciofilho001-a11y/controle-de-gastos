import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
} from "recharts"
import { catInfo, catColor } from "@/lib/categorias"
import {
  useChartColors, fmtAxis, axisProps, gridProps, cursorProps, ChartTooltip, CHART_ANIM,
} from "@/lib/chart-theme"

export type LinhaCat = {
  catKey: string
  label: string
  previsto: number
  real: number
  cor: string
}

const LABEL_W = 150
const ROW_H = 56

function CategoryTick(props: any) {
  const { x, y, payload, linhas, fg } = props
  const linha = (linhas as LinhaCat[]).find((l) => l.label === payload.value)
  if (!linha) return null
  const info = catInfo(linha.catKey)
  const Icon = info.icon
  const cor = catColor(linha.catKey)
  const chip = 26
  const chipX = x - LABEL_W + 6
  return (
    <g transform={`translate(0,${y})`}>
      <rect x={chipX} y={-chip / 2} width={chip} height={chip} rx={7} fill={`${cor}22`} stroke={`${cor}44`} strokeWidth={1} />
      <g transform={`translate(${chipX + chip / 2 - 7}, -7)`}>
        <Icon width={14} height={14} stroke={cor} />
      </g>
      <text x={chipX + chip + 8} y={0} dy="0.32em" fontSize={12.5} fontWeight={600} fill={fg} fontFamily="var(--font-display)">
        {linha.label}
      </text>
    </g>
  )
}

export function ChartPrevistoReal({ linhas }: { linhas: LinhaCat[] }) {
  const c = useChartColors()
  if (!linhas.length) {
    return (
      <div className="grid h-40 place-items-center text-sm text-muted-foreground">
        Sem dados para comparar neste mês
      </div>
    )
  }
  const height = Math.max(160, linhas.length * ROW_H + 28)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={linhas}
          layout="vertical"
          margin={{ top: 4, right: 20, bottom: 0, left: 8 }}
          barCategoryGap="28%"
          barGap={3}
        >
          <CartesianGrid horizontal={false} {...gridProps(c)} />
          <XAxis type="number" tickFormatter={fmtAxis} {...axisProps(c)} />
          <YAxis
            type="category"
            dataKey="label"
            width={LABEL_W}
            tick={(props) => <CategoryTick {...props} linhas={linhas} fg={c.fg} />}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip content={<ChartTooltip />} cursor={cursorProps(c)} />
          <Bar dataKey="previsto" name="Previsto" radius={7} barSize={14} animationDuration={CHART_ANIM}>
            {linhas.map((l) => <Cell key={`p-${l.catKey}`} fill={c.previsto} />)}
          </Bar>
          <Bar dataKey="real" name="Real" radius={7} barSize={14} animationDuration={CHART_ANIM}>
            {linhas.map((l) => <Cell key={`r-${l.catKey}`} fill={c.real} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
