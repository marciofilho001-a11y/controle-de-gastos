import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Cabeçalho padrão de todas as abas: título + acento (mês/escopo) + descrição + ações.
// Mantém o mesmo ritmo vertical e alinhamento em todo o app.
export function PageHeader({
  title,
  accent,
  description,
  actions,
  className,
}: {
  title: string
  accent?: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em]">
          {title}
          {accent && <span className="text-primary"> — {accent}</span>}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// Título de seção dentro de uma página (caixa alta, discreto, com ícone)
export function SectionTitle({
  icon: Icon,
  children,
  right,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  children: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-2", className)}>
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {children}
      </h3>
      {right}
    </div>
  )
}
