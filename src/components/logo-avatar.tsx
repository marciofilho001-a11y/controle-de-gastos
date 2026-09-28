import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// Avatar redondo com logo (data URL) e "LED": um brilho na cor dominante da logo.
// A imagem é analisada uma vez (canvas) pra achar a cor dominante e a cor de fundo,
// e é exibida com object-cover + leve zoom, cortando bordas quadradas/escuras.

type Info = { cor: string; fundo: string }
const cache = new Map<string, Promise<Info>>()

function analisar(src: string): Promise<Info> {
  const hit = cache.get(src)
  if (hit) return hit
  const p = new Promise<Info>((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const N = 48
        const c = document.createElement("canvas")
        c.width = N; c.height = N
        const ctx = c.getContext("2d", { willReadFrequently: true })!
        ctx.drawImage(img, 0, 0, N, N)
        const px = ctx.getImageData(0, 0, N, N).data
        const hist = new Map<string, { n: number; r: number; g: number; b: number }>()
        let sr = 0, sg = 0, sb = 0, sn = 0
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3]
          if (a < 128) continue
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
          sr += r; sg += g; sb += b; sn++
          if (mx - mn < 45 || mx < 60) continue // cinza/preto não conta como "cor"
          const k = `${r >> 5}-${g >> 5}-${b >> 5}`
          const h = hist.get(k) || { n: 0, r: 0, g: 0, b: 0 }
          h.n++; h.r += r; h.g += g; h.b += b
          hist.set(k, h)
        }
        let cor = "#8b93a7"
        if (hist.size) {
          const top = [...hist.values()].sort((a, b) => b.n - a.n)[0]
          cor = `rgb(${Math.round(top.r / top.n)},${Math.round(top.g / top.n)},${Math.round(top.b / top.n)})`
        } else if (sn) {
          cor = `rgb(${Math.round(sr / sn)},${Math.round(sg / sn)},${Math.round(sb / sn)})`
        }
        // fundo = média dos 4 cantos (pra preencher o círculo sem "quina")
        const cantos = [0, (N - 1) * 4, (N * (N - 1)) * 4, (N * N - 1) * 4]
        let fr = 0, fg = 0, fb = 0, fa = 0
        for (const i of cantos) { fr += px[i]; fg += px[i + 1]; fb += px[i + 2]; fa += px[i + 3] }
        const fundo = fa / 4 < 128 ? cor : `rgb(${Math.round(fr / 4)},${Math.round(fg / 4)},${Math.round(fb / 4)})`
        resolve({ cor, fundo })
      } catch {
        resolve({ cor: "#8b93a7", fundo: "var(--background)" })
      }
    }
    img.onerror = () => resolve({ cor: "#8b93a7", fundo: "var(--background)" })
    img.src = src
  })
  cache.set(src, p)
  return p
}

export function useCorLogo(src: string | null | undefined): Info | null {
  const [info, setInfo] = useState<Info | null>(null)
  useEffect(() => {
    let vivo = true
    if (!src) { setInfo(null); return }
    analisar(src).then((i) => { if (vivo) setInfo(i) })
    return () => { vivo = false }
  }, [src])
  return info
}

export function LogoAvatar({
  src, cor, Icon, size = 40, className, led = true,
}: {
  src: string | null | undefined
  cor: string                                   // cor de fallback (categoria) quando não há logo
  Icon: React.ComponentType<{ className?: string }>
  size?: number
  className?: string
  led?: boolean
}) {
  const info = useCorLogo(src)
  const glow = src ? info?.cor || "transparent" : cor
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full transition-shadow duration-500", className)}
      style={{
        width: size, height: size,
        background: src ? info?.fundo || "var(--background)" : `${cor}1f`,
        color: cor,
        boxShadow: led && (info || !src)
          ? `0 0 0 1px color-mix(in srgb, ${glow} 55%, transparent), 0 0 ${Math.round(size * 0.42)}px color-mix(in srgb, ${glow} 45%, transparent)`
          : "0 0 0 1px var(--border)",
      }}
    >
      {src ? (
        <img src={src} alt="" className="size-full scale-[1.18] object-cover" draggable={false} />
      ) : (
        <Icon className="size-[45%]" />
      )}
    </span>
  )
}
