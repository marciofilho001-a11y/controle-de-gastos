import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { variacaoPct } from "@/lib/selectors"
import { fmtMesRef, addMonths } from "@/lib/format"
import { cn } from "@/lib/utils"

export function TrendPill({
  atual,
  anterior,
  mesRef,
  invertido = false,
}: {
  atual: number
  anterior: number
  mesRef: string
  invertido?: boolean
}) {
  const v = variacaoPct(atual, anterior)
  const mesAntLabel = fmtMesRef(addMonths(mesRef, -1))
  if (!v) return null
  if (v.pct === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" /> estável vs {mesAntLabel}
      </span>
    )
  }
  const bom = invertido ? !v.subiu : v.subiu
  const Icon = v.subiu ? TrendingUp : TrendingDown
  return (
    <span className={cn("flex items-center gap-1 text-xs", bom ? "text-success" : "text-destructive")}>
      <Icon className="size-3" /> {v.subiu ? "+" : ""}
      {v.pct}% vs {mesAntLabel}
    </span>
  )
}
