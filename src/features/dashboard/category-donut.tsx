import { useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { catColor, catInfo } from "@/lib/categorias"
import { fmtR } from "@/lib/format"

export type DonutSlice = { catKey: string; label: string; value: number }

export function CategoryDonut({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  if (!slices.length) {
    return (
      <div className="mx-auto grid aspect-square w-full max-w-[220px] place-items-center rounded-full border border-dashed text-sm text-muted-foreground">
        Sem dados
      </div>
    )
  }

  const ativo = hover != null ? slices[hover] : null
  const label = ativo ? ativo.label : centerLabel
  const valor = ativo ? ativo.value : centerValue
  const sub = ativo
    ? `${centerValue > 0 ? Math.round((ativo.value / centerValue) * 100) : 0}% do total`
    : "Total"

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[220px]"
      onMouseLeave={() => setHover(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="66%"
            outerRadius="94%"
            paddingAngle={2.5}
            cornerRadius={5}
            stroke="var(--card)"
            strokeWidth={2}
            startAngle={90}
            endAngle={-270}
            onMouseEnter={(_: any, i: number) => setHover(i)}
            isAnimationActive
            animationDuration={650}
          >
            {slices.map((s, i) => (
              <Cell
                key={s.catKey}
                fill={catColor(s.catKey)}
                fillOpacity={hover == null || hover === i ? 1 : 0.28}
                style={{ transition: "fill-opacity 0.2s ease", outline: "none" }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* texto central — troca no hover, nunca sobrepõe */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="flex max-w-[62%] flex-col items-center text-center leading-none">
          <span className="mb-1.5 truncate text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="tnum text-[clamp(1.05rem,4.4vw,1.45rem)] font-semibold text-foreground">
            {fmtR(valor)}
          </span>
          <span className="mt-1 text-[0.68rem] text-muted-foreground">{sub}</span>
        </div>
      </div>
    </div>
  )
}

export { catInfo }
