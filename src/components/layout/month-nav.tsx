import { ChevronLeft, ChevronRight } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { fmtMesLongo, fmtMesRef } from "@/lib/format"

export function MonthNav({
  mesRef,
  onChange,
}: {
  mesRef: string
  onChange: (delta: number) => void
}) {
  return (
    <div className="flex items-center rounded-full border bg-card/70 p-0.5">
      <Button variant="ghost" size="icon" className="press size-8 rounded-full" onClick={() => onChange(-1)} aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="tnum min-w-[6.5rem] px-1 text-center text-sm font-semibold sm:min-w-[9.5rem]">
        <span className="sm:hidden">{fmtMesRef(mesRef)}</span>
        <span className="hidden capitalize sm:inline">{fmtMesLongo(mesRef)}</span>
      </span>
      <Button variant="ghost" size="icon" className="press size-8 rounded-full" onClick={() => onChange(1)} aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
