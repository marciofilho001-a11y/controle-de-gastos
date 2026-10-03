import { EMOJIS_FLUENT } from "@/lib/emojis-fluent"
import { cn } from "@/lib/utils"

// Emoji colorido (Fluent Emoji Flat) desenhado em SVG — igual em todo navegador/celular
export function Emoji({ nome, className, title }: { nome: string; className?: string; title?: string }) {
  const body = EMOJIS_FLUENT[nome] ?? EMOJIS_FLUENT["package"]
  return (
    <svg
      viewBox="0 0 32 32" className={cn("size-5 shrink-0", className)} role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true} aria-label={title}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
