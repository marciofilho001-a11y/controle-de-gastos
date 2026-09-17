import type { LucideIcon } from "lucide-react"
import { motion } from "motion/react"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"
import { cn } from "@/lib/utils"
import { AnimatedCurrency } from "@/components/animated-currency"

type Tone = "teal" | "slate" | "danger" | "warning"

const toneStyles: Record<Tone, { badge: string; bar: string; spark: string }> = {
  teal: {
    badge: "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
    bar: "bg-gradient-to-b from-primary to-primary/60",
    spark: "var(--primary)",
  },
  slate: {
    badge: "bg-muted text-muted-foreground ring-1 ring-border",
    bar: "bg-transparent",
    spark: "var(--muted-foreground)",
  },
  danger: {
    badge: "bg-gradient-to-br from-destructive to-destructive/70 text-destructive-foreground",
    bar: "bg-gradient-to-b from-destructive to-destructive/60",
    spark: "var(--destructive)",
  },
  warning: {
    badge: "bg-gradient-to-br from-warning to-warning/70 text-warning-foreground",
    bar: "bg-gradient-to-b from-warning to-warning/60",
    spark: "var(--warning)",
  },
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  trend,
  valueClassName,
  index = 0,
  spark,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone?: Tone
  trend?: React.ReactNode
  valueClassName?: string
  index?: number
  spark?: number[]
}) {
  const s = toneStyles[tone]
  const sparkData = spark?.map((v, i) => ({ i, v })) ?? null
  const gid = `spark-${label.replace(/\s+/g, "")}-${tone}`
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.2, 0, 0, 1] }}
      className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm"
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", s.bar)} />
      <div className="mb-3 flex items-center gap-2.5">
        <div className={cn("grid size-9 place-items-center rounded-[0.65rem]", s.badge)}>
          <Icon className="size-[1.05rem]" />
        </div>
        <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <AnimatedCurrency
            value={value}
            className={cn("block text-2xl font-semibold", valueClassName)}
          />
          {trend && <div className="mt-1.5 text-xs text-muted-foreground">{trend}</div>}
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="h-11 w-24 shrink-0 self-center opacity-90" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 3, right: 0, bottom: 3, left: 0 }}>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.spark} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.spark} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Area
                  type="monotone" dataKey="v" stroke={s.spark} strokeWidth={2}
                  fill={`url(#${gid})`} isAnimationActive dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  )
}
