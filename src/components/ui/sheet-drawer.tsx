import { useEffect, useState, type ReactNode } from "react"
import { Drawer } from "vaul"
import { X } from "@/lib/icons"
import { cn } from "@/lib/utils"

// Painel deslizante (Vaul): no celular sobe de baixo e fecha arrastando (com momento e
// resistência nas bordas); no desktop entra pela direita. Entra e sai pelo mesmo caminho.
function useDesktop() {
  const q = "(min-width: 768px)"
  const [ok, setOk] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setOk(m.matches)
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return ok
}

export function SheetDrawer({
  open, onOpenChange, titulo, descricao, children, className,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  titulo: ReactNode
  descricao?: ReactNode
  children: ReactNode
  className?: string
}) {
  const desktop = useDesktop()
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={desktop ? "right" : "bottom"}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className={cn(
            "fixed z-50 flex flex-col border bg-background shadow-2xl outline-none",
            desktop
              ? "inset-y-2 right-2 w-[min(980px,calc(100vw-1rem))] rounded-2xl"
              : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl",
            className,
          )}
        >
          {!desktop && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <Drawer.Title className="font-display text-xl font-semibold tracking-[-0.02em]">{titulo}</Drawer.Title>
              {descricao
                ? <Drawer.Description className="mt-0.5 text-sm text-muted-foreground">{descricao}</Drawer.Description>
                : <Drawer.Description className="sr-only">{typeof titulo === "string" ? titulo : ""}</Drawer.Description>}
            </div>
            <Drawer.Close className="press grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground" aria-label="Fechar">
              <X className="size-4" />
            </Drawer.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
