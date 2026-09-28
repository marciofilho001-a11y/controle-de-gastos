import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { LucideIcon } from "lucide-react"

// Converte um ícone Lucide em PNG (círculo colorido + ícone branco) pra usar no jsPDF.
// Cache por ícone+cor, resolução 128px (nítido em impressão A4).

const cache = new Map<string, Promise<string>>()

export function iconePng(Icon: LucideIcon, cor: string, forma: "circulo" | "quadrado" = "circulo"): Promise<string> {
  const key = `${Icon.displayName || (Icon as unknown as { name?: string }).name || "i"}|${cor}|${forma}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = (async () => {
    const inner = renderToStaticMarkup(createElement(Icon, { color: "#ffffff", size: 34, strokeWidth: 2.25 }))
      .replace("<svg ", '<svg x="15" y="15" ')
    const bg = forma === "circulo"
      ? `<circle cx="32" cy="32" r="32" fill="${cor}"/>`
      : `<rect x="0" y="0" width="64" height="64" rx="14" fill="${cor}"/>`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">${bg}${inner}</svg>`
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image()
        im.onload = () => res(im)
        im.onerror = rej
        im.src = url
      })
      const c = document.createElement("canvas")
      c.width = 128; c.height = 128
      c.getContext("2d")!.drawImage(img, 0, 0, 128, 128)
      return c.toDataURL("image/png")
    } finally {
      URL.revokeObjectURL(url)
    }
  })()
  cache.set(key, p)
  return p
}
