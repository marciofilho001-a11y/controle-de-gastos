import { cn } from "@/lib/utils"

// Painel "LED": navy profundo, borda neon (teal ou violeta) e brilho externo.
export function LedPanel({
  children, className, tone = "teal",
}: { children: React.ReactNode; className?: string; tone?: "teal" | "violet" }) {
  return (
    <div data-tone={tone} className={cn("led-panel font-ui", className)}>
      {children}
    </div>
  )
}

// Mini card com borda e brilho na cor de destaque
export function LedCard({
  children, cor, className,
}: { children: React.ReactNode; cor: string; className?: string }) {
  return (
    <div className={cn("led-card font-ui", className)} style={{ ["--lc" as string]: cor }}>
      {children}
    </div>
  )
}

// Ícone em círculo: aro fino na cor + brilho suave (o LED)
export function LedIcon({
  icon: Icon, cor, size = 44, className,
}: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; cor: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full", className)}
      style={{
        width: size, height: size, color: cor,
        background: `color-mix(in srgb, ${cor} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${cor} 75%, transparent), 0 0 ${Math.round(size * 0.42)}px color-mix(in srgb, ${cor} 38%, transparent)`,
      }}
    >
      <Icon className="size-[46%]" strokeWidth={1.8} />
    </span>
  )
}
