import { useCorLogo } from "@/components/logo-avatar"
import { cn } from "@/lib/utils"

// Nomes genéricos que não identificam o cartão ("Cartão", "Linha Crédito"...) saem do rótulo
const GENERICAS = new Set(["cartao", "cartão", "credito", "crédito", "linha", "de", "do", "da", "card"])
function rotulo(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter((w) => !GENERICAS.has(w.toLowerCase()))
  const lista = palavras.length ? palavras : nome.trim().split(/\s+/)
  const dois = lista.slice(0, 2).join(" ")
  return dois.length > 9 ? lista[0] : dois   // cabe ~9 letras no cartãozinho
}

// cor de reserva quando a logo ainda não carregou (ou não tem): derivada do nome, sempre a mesma
function corDoNome(nome: string): string {
  let h = 0
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 38% 46%)`
}

// Cartãozinho ilustrado no canto do card: gradiente na cor da logo, chip, brilho diagonal e
// duas "bolinhas" de bandeira (neutras, sem marca). Dá o charme de cartão de verdade.
export function CartaoMini({ nome, logo, className }: { nome: string; logo?: string | null; className?: string }) {
  const info = useCorLogo(logo)
  const base = logo ? info?.cor || corDoNome(nome) : corDoNome(nome)
  const cinza = base === "#8b93a7"
  const cor = cinza ? corDoNome(nome) : base
  return (
    <div
      aria-hidden
      className={cn(
        "relative h-9 w-14 shrink-0 overflow-hidden rounded-[7px] ring-1 ring-white/20 transition-transform duration-300 ease-out",
        "group-hover/cartao:-translate-y-0.5 group-hover/cartao:-rotate-3",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${cor} 82%, black) 0%, color-mix(in srgb, ${cor} 42%, black) 100%)`,
        boxShadow: `0 8px 16px -6px color-mix(in srgb, ${cor} 70%, transparent), inset 0 1px 0 rgba(255,255,255,.22)`,
      }}
    >
      {/* brilho diagonal */}
      <span className="absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 46%)" }} />
      {/* nome */}
      <span className="absolute top-[5px] left-[6px] max-w-[42px] truncate text-[5.5px] leading-none font-bold tracking-[0.08em] text-white/90 uppercase">
        {rotulo(nome)}
      </span>
      {/* chip */}
      <span
        className="absolute bottom-[6px] left-[6px] h-[7px] w-[10px] rounded-[2px]"
        style={{ background: "linear-gradient(135deg,#f3d98b,#b98f3a)", boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.25)" }}
      />
      {/* bandeira neutra */}
      <span className="absolute right-[6px] bottom-[5px] flex">
        <span className="size-[9px] rounded-full bg-white/55" />
        <span className="-ml-[4px] size-[9px] rounded-full bg-white/30 ring-[.5px] ring-white/30" />
      </span>
    </div>
  )
}
