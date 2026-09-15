import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { catColor, catInfo } from "@/lib/categorias"
import { fmtR } from "@/lib/format"

export type DonutSlice = { catKey: string; label: string; value: number }

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: p.payload.fill }} />
        <span className="font-medium">{p.payload.label}</span>
      </p>
      <p className="tnum mt-0.5 text-muted-foreground">{fmtR(p.value)}</p>
    </div>
  )
}

export function CategoryDonut({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[]
  centerLabel: string
  centerValue: number
}) {
  if (!slices.length) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">Sem dados</div>
    )
  }
  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {slices.map((s) => (
              <Cell key={s.catKey} fill={catColor(s.catKey)} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{centerLabel}</p>
          <p className="tnum mt-0.5 text-lg font-semibold">{fmtR(centerValue)}</p>
        </div>
      </div>
    </div>
  )
}

export { catInfo }
