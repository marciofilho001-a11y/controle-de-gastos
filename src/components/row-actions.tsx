import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Menu de ações padrão de uma linha (lançamento, aporte...). O mesmo em todo o app:
// Editar · Duplicar · Excluir. Qualquer ação ausente some do menu.
export function RowActions({
  onEditar,
  onDuplicar,
  onExcluir,
  duplicarLabel = "Duplicar neste mês",
  size = "md",
  className,
}: {
  onEditar?: () => void
  onDuplicar?: () => void
  onExcluir?: () => void
  duplicarLabel?: string
  size?: "sm" | "md"
  className?: string
}) {
  if (!onEditar && !onDuplicar && !onExcluir) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ações"
          onClick={(e) => e.stopPropagation()}
          className={cn("shrink-0 text-muted-foreground hover:text-foreground", size === "sm" ? "size-7" : "size-8", className)}
        >
          <MoreHorizontal className={size === "sm" ? "size-3.5" : "size-4"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {onEditar && (
          <DropdownMenuItem onSelect={onEditar}>
            <Pencil className="size-4" /> Editar
          </DropdownMenuItem>
        )}
        {onDuplicar && (
          <DropdownMenuItem onSelect={onDuplicar}>
            <Copy className="size-4" /> {duplicarLabel}
          </DropdownMenuItem>
        )}
        {onExcluir && (onEditar || onDuplicar) && <DropdownMenuSeparator />}
        {onExcluir && (
          <DropdownMenuItem variant="destructive" onSelect={onExcluir}>
            <Trash2 className="size-4" /> Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
