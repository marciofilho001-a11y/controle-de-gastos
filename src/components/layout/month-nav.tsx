import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fmtMesLongo } from "@/lib/format"

export function MonthNav({
  mesRef,
  onChange,
}: {
  mesRef: string
  onChange: (delta: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon" className="size-9" onClick={() => onChange(-1)} aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex min-w-[11rem] items-center justify-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium">
        <CalendarDays className="size-4 text-primary" />
        <span className="font-display capitalize">{fmtMesLongo(mesRef)}</span>
      </div>
      <Button variant="outline" size="icon" className="size-9" onClick={() => onChange(1)} aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
