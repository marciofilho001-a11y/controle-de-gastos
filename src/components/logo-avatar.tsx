import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// Avatar redondo com logo (data URL) e "LED": um brilho na cor dominante da logo.
// A imagem é analisada uma vez (canvas) pra achar a cor dominante e a cor de fundo,
// e é exibida com object-cover + leve zoom, cortando bordas quadradas/escuras.

type Info = { cor: string; fundo: string; img: string }
const cache = new Map<string, Promise<Info>>()
const OUT = 192 // px do PNG final (nítido até ~64px @3x)

function analisar(src: string): Promise<Info> {
  const hit = cache.get(src)
  if (hit) return hit
  const p = new Promise<Info>((resolve) => {
    const falha = () => resolve({ cor: "#8b93a7", fundo: "var(--background)", img: src })
    const img = new Image()
    img.onload = () => {
      try {
        const W = img.naturalWidth, H = img.naturalHeight
        const N = 96
        const c = document.createElement("canvas")
        c.width = N; c.height = N
        const ctx = c.getContext("2d", { willReadFrequently: true })!
        ctx.drawImage(img, 0, 0, N, N)
        const px = ctx.getImageData(0, 0, N, N).data
        const at = (x: number, y: number) => (y * N + x) * 4

        // fundo: média de amostras nas bordas (transparente ou cor sólida)
        let br = 0, bg = 0, bb = 0, ba = 0, bn = 0
        for (let i = 0; i < N; i += 3) {
          for (const [x, y] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) {
            const k = at(x, y); br += px[k]; bg += px[k + 1]; bb += px[k + 2]; ba += px[k + 3]; bn++
          }
        }
        br /= bn; bg /= bn; bb /= bn; ba /= bn
        const transparente = ba < 110

        // cor dominante (ignora cinza/preto/branco) + caixa do conteúdo
        const hist = new Map<string, { n: number; r: number; g: number; b: number }>()
        let x0 = N, y0 = N, x1 = -1, y1 = -1, conteudo = 0
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const k = at(x, y)
            const r = px[k], g = px[k + 1], b = px[k + 2], a = px[k + 3]
            if (a < 90) continue
            const dist = transparente ? 999 : Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb)
            if (dist > 70) {
              conteudo++
              if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
            }
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
            if (mx - mn < 45 || mx < 60) continue
            const key = `${r >> 5}-${g >> 5}-${b >> 5}`
            const h = hist.get(key) || { n: 0, r: 0, g: 0, b: 0 }
            h.n++; h.r += r; h.g += g; h.b += b
            hist.set(key, h)
          }
        }
        let cor = "#8b93a7"
        if (hist.size) {
          const top = [...hist.values()].sort((a, b) => b.n - a.n)[0]
          cor = `rgb(${Math.round(top.r / top.n)},${Math.round(top.g / top.n)},${Math.round(top.b / top.n)})`
        }
        const fundo = transparente ? "#ffffff" : `rgb(${Math.round(br)},${Math.round(bg)},${Math.round(bb)})`

        // caixa do conteúdo em px da imagem original (fallback: imagem toda)
        const temCaixa = conteudo > N * N * 0.01 && x1 > x0 && y1 > y0
        const k = W / N, kh = H / N
        const bx = temCaixa ? x0 * k : 0, by = temCaixa ? y0 * kh : 0
        const bw = temCaixa ? (x1 - x0 + 1) * k : W, bh = temCaixa ? (y1 - y0 + 1) * kh : H

        // escala: o conteúdo inteiro cabe no círculo (margem ~10%), sem passar de 1.25x da imagem cheia
        const R = OUT / 2
        const meiaDiag = Math.sqrt(bw * bw + bh * bh) / 2
        const s0 = OUT / Math.max(W, H)
        const escala = Math.min(Math.max((R * 0.88) / meiaDiag, s0 * 0.7), s0 * 1.25)

        const o = document.createElement("canvas")
        o.width = OUT; o.height = OUT
        const oc = o.getContext("2d")!
        oc.fillStyle = fundo
        oc.fillRect(0, 0, OUT, OUT)
        oc.imageSmoothingEnabled = true
        oc.imageSmoothingQuality = "high"
        const dw = W * escala, dh = H * escala
        const cx = bx + bw / 2, cy = by + bh / 2   // centro do conteúdo
        oc.drawImage(img, R - cx * escala, R - cy * escala, dw, dh)
        resolve({ cor, fundo, img: o.toDataURL("image/png") })
      } catch {
        falha()
      }
    }
    img.onerror = falha
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
        // LED só nas logos de marca; o ícone de fallback fica plano e discreto
        boxShadow: led && src && info
          ? `0 0 0 1px color-mix(in srgb, ${glow} 55%, transparent), 0 0 ${Math.round(size * 0.42)}px color-mix(in srgb, ${glow} 45%, transparent)`
          : src ? "0 0 0 1px var(--border)" : "none",
      }}
    >
      {src ? (
        info ? <img src={info.img} alt="" className="size-full object-cover" draggable={false} /> : null
      ) : (
        <Icon className="size-[52%]" />
      )}
    </span>
  )
}
