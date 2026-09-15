import type { LucideIcon } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { AnimatedCurrency } from "@/components/animated-currency"

type Tone = "teal" | "slate" | "danger" | "warning"

const toneStyles: Record<Tone, { badge: string; bar: string; value?: string }> = {
  teal: {
    badge: "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
    bar: "bg-gradient-to-b from-primary to-primary/60",
  },
  slate: {
    badge: "bg-muted text-muted-foreground ring-1 ring-border",
    bar: "bg-transparent",
  },
  danger: {
    badge: "bg-gradient-to-br from-destructive to-destructive/70 text-destructive-foreground",
    bar: "bg-gradient-to-b from-destructive to-destructive/60",
  },
  warning: {
    badge: "bg-gradient-to-br from-warning to-warning/70 text-warning-foreground",
    bar: "bg-gradient-to-b from-warning to-warning/60",
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
}: {
  label: string
  value: number
  icon: LucideIcon
  tone?: Tone
  trend?: React.ReactNode
  valueClassName?: string
  index?: number
}) {
  const s = toneStyles[tone]
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
      <AnimatedCurrency
        value={value}
        className={cn("block text-2xl font-semibold", valueClassName)}
      />
      {trend && <div className="mt-1.5 text-xs text-muted-foreground">{trend}</div>}
    </motion.div>
  )
}
