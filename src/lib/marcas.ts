import type { Marca as SimpleIcon } from "./marcas-dados"
import {
  siAdidas, siAirbnb, siAliexpress, siAnthropic, siApple, siApplepay, siAppletv, siBinance, siBmw, siBurgerking,
  siCarrefour, siChevrolet, siClaude, siCocacola, siCoinbase, siCoursera, siDeezer, siDropbox, siDuolingo,
  siEpicgames, siFacebook, siFiat, siFigma, siFord, siGithub, siGoogle, siGoogleplay, siGooglepay, siHbomax,
  siHonda, siHyundai, siIcloud, siIfood, siIkea, siInstagram, siJeep, siKfc, siLeroymerlin, siMastercard,
  siMcdonalds, siMercadopago, siNetflix, siNike, siNotion, siNubank, siParamountplus, siPaypal, siPicpay,
  siPlaystation, siPuma, siRenault, siRevolut, siShell, siShopee, siSpotify, siStarbucks, siSteam, siTesla,
  siTiktok, siToyota, siTwitch, siUber, siUdemy, siVisa, siVivo, siVolkswagen, siWhatsapp, siYoutube,
  siYoutubemusic, siZara,
} from "./marcas-dados"

// Logos de marca (Simple Icons) reconhecidas pelo nome do lançamento.
// Chave = palavra ou trecho que aparece na descrição (sem acento, minúsculo).
const LISTA: [SimpleIcon, string[]][] = [
  [siSteam, ["steam"]],
  [siClaude, ["claude"]],
  [siAnthropic, ["anthropic"]],
  [siUber, ["uber"]],
  [siYoutubemusic, ["youtube music", "yt music"]],
  [siYoutube, ["youtube", "yt premium", "yt"]],
  [siNubank, ["nubank", "nu bank"]],
  [siMercadopago, ["mercado pago", "mercadopago", "meli+", "meli"]],
  [siShopee, ["shopee", "shoppe", "shope"]],
  [siSpotify, ["spotify"]],
  [siAppletv, ["apple tv", "appletv"]],
  [siApplepay, ["apple pay"]],
  [siIcloud, ["icloud"]],
  [siApple, ["apple", "iphone", "ipad", "macbook", "airpods"]],
  [siFiat, ["fiat"]],
  [siPlaystation, ["playstation", "ps5", "ps4", "psn", "ps plus"]],
  [siIfood, ["ifood"]],
  [siNetflix, ["netflix"]],
  [siHbomax, ["hbo max", "hbo"]],
  [siParamountplus, ["paramount"]],
  [siDeezer, ["deezer"]],
  [siTwitch, ["twitch"]],
  [siEpicgames, ["epic games", "epicgames"]],
  [siGoogleplay, ["google play"]],
  [siGooglepay, ["google pay"]],
  [siGoogle, ["google", "google one"]],
  [siGithub, ["github"]],
  [siPicpay, ["picpay"]],
  [siAliexpress, ["aliexpress"]],
  [siNike, ["nike"]],
  [siAdidas, ["adidas"]],
  [siPuma, ["puma"]],
  [siMcdonalds, ["mcdonalds", "mc donalds", "mequi"]],
  [siBurgerking, ["burger king"]],
  [siStarbucks, ["starbucks"]],
  [siKfc, ["kfc"]],
  [siCocacola, ["coca cola", "cocacola"]],
  [siShell, ["shell"]],
  [siAirbnb, ["airbnb"]],
  [siWhatsapp, ["whatsapp"]],
  [siInstagram, ["instagram"]],
  [siFacebook, ["facebook"]],
  [siTiktok, ["tiktok"]],
  [siNotion, ["notion"]],
  [siFigma, ["figma"]],
  [siDropbox, ["dropbox"]],
  [siDuolingo, ["duolingo"]],
  [siUdemy, ["udemy"]],
  [siCoursera, ["coursera"]],
  [siPaypal, ["paypal"]],
  [siVisa, ["visa"]],
  [siMastercard, ["mastercard"]],
  [siZara, ["zara"]],
  [siIkea, ["ikea"]],
  [siLeroymerlin, ["leroy merlin", "leroy"]],
  [siCarrefour, ["carrefour"]],
  [siVivo, ["vivo"]],
  [siRevolut, ["revolut"]],
  [siBinance, ["binance"]],
  [siCoinbase, ["coinbase"]],
  [siToyota, ["toyota"]],
  [siVolkswagen, ["volkswagen", "vw"]],
  [siChevrolet, ["chevrolet"]],
  [siHonda, ["honda"]],
  [siHyundai, ["hyundai"]],
  [siRenault, ["renault"]],
  [siJeep, ["jeep"]],
  [siFord, ["ford"]],
  [siBmw, ["bmw"]],
  [siTesla, ["tesla"]],
]

// chaves mais longas primeiro: "apple tv" ganha de "apple", "youtube music" de "youtube"
const CHAVES = LISTA.flatMap(([i, ks]) => ks.map((k) => [` ${k} `, i] as const)).sort((a, b) => b[0].length - a[0].length)

export function normalizarParaMarca(s: string): string {
  return ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim()} `
}

export function marcaDaDescricao(descricao: string | null | undefined): SimpleIcon | null {
  if (!descricao) return null
  const n = normalizarParaMarca(descricao)
  for (const [k, i] of CHAVES) if (n.includes(k)) return i
  return null
}

// Luminância relativa (0 = preto, 1 = branco) de um hex sem "#"
function luminancia(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((p) => {
    const c = parseInt(hex.slice(p, p + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Logo como imagem (data URL SVG): fundo na cor da marca + símbolo branco (ou escuro, se a marca for clara).
// Por ser imagem, funciona em todo lugar que já mostra os ícones personalizados.
export function logoMarcaDataUrl(i: Pick<SimpleIcon, "hex" | "path">): string {
  const glifo = luminancia(i.hex) > 0.55 ? "#111111" : "#ffffff"
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" fill="#${i.hex}"/>` +
    `<g transform="translate(5.4 5.4) scale(0.55)"><path fill="${glifo}" d="${i.path}"/></g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Valor gravado em fin_descricao_icones quando o lançamento não deve ter logo de marca
export const SEM_LOGO = "sem-logo"

const cache = new Map<string, string | undefined>()

// Imagem do lançamento: a que você escolheu > logo da marca reconhecida pelo nome > nenhuma
export function logoDoLancamento(descricao: string | null | undefined, descricaoIcones: Record<string, string>): string | undefined {
  const dn = (descricao || "").trim().toLowerCase()
  const propria = dn ? descricaoIcones[dn] : undefined
  if (propria === SEM_LOGO) return undefined
  if (propria) return propria
  if (!cache.has(dn)) {
    const m = marcaDaDescricao(descricao)
    cache.set(dn, m ? logoMarcaDataUrl(m) : undefined)
  }
  return cache.get(dn)
}

// Cor da marca embutida num logo gerado acima (pro brilho "LED"); null se for imagem enviada
export function corDoLogo(src: string | undefined): string | null {
  if (!src?.startsWith("data:image/svg+xml")) return null
  const m = decodeURIComponent(src).match(/<rect[^>]*fill="(#[0-9a-fA-F]{6})"/)
  return m ? m[1] : null
}
