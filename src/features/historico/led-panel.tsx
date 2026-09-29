import { cn } from "@/lib/utils"

// Cartão "LED": fundo com gradiente sutil, borda e brilho externo na cor de destaque.
export function LedPanel({
  children, className, cor = "var(--primary)", forte = false,
}: { children: React.ReactNode; className?: string; cor?: string; forte?: boolean }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl border", className)}
      style={{
        background: `linear-gradient(155deg, color-mix(in srgb, ${cor} ${forte ? 16 : 9}%, var(--card)), var(--card) 62%)`,
        borderColor: `color-mix(in srgb, ${cor} ${forte ? 45 : 28}%, var(--border))`,
        boxShadow: `0 0 ${forte ? 34 : 26}px -10px color-mix(in srgb, ${cor} ${forte ? 55 : 38}%, transparent), inset 0 1px 0 color-mix(in srgb, var(--foreground) 5%, transparent)`,
      }}
    >
      {children}
    </div>
  )
}

// Ícone em "pastilha" com brilho (o LED)
export function LedIcon({
  icon: Icon, cor, size = 40, redondo = false, className,
}: { icon: React.ComponentType<{ className?: string }>; cor: string; size?: number; redondo?: boolean; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center", redondo ? "rounded-full" : "rounded-xl", className)}
      style={{
        width: size, height: size,
        color: cor,
        background: `color-mix(in srgb, ${cor} 20%, transparent)`,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${cor} 45%, transparent), 0 0 ${Math.round(size * 0.45)}px color-mix(in srgb, ${cor} 45%, transparent)`,
      }}
    >
      <Icon className="size-[48%]" />
    </span>
  )
}
