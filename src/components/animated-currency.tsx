import NumberFlow from "@number-flow/react"
import { cn } from "@/lib/utils"

export function AnimatedCurrency({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <NumberFlow
      value={value}
      format={{ style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      locales="pt-BR"
      className={cn("tnum", className)}
    />
  )
}
