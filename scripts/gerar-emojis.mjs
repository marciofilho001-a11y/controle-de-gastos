// Gera src/lib/emojis-fluent.ts só com os emojis usados no app (Fluent Emoji Flat, Microsoft — licença MIT).
// Rodar depois de mudar a lista: node scripts/gerar-emojis.mjs
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const set = JSON.parse(readFileSync(require.resolve("@iconify-json/fluent-emoji-flat/icons.json"), "utf8"))

const NOMES = `soccer-ball money-with-wings clinking-beer-mugs beer-mug wine-glass cup-with-straw cocktail-glass party-popper
admission-tickets beach-with-umbrella airplane popcorn musical-notes video-game lotion-bottle barber-pole cut-of-meat pizza
soft-ice-cream hot-beverage birthday-cake wrapped-gift flexed-biceps high-voltage takeout-box shopping-cart pill stethoscope
graduation-cap books laptop t-shirt house oncoming-automobile automobile fuel-pump p-button credit-card handshake
classical-building fork-and-knife-with-plate shopping-bags spiral-calendar receipt package money-bag chart-increasing
dollar-banknote mobile-phone confetti-ball television hamburger taxi bus red-heart sparkles coin briefcase hammer-and-wrench
key bed nail-polish dog toolbox`.split(/\s+/).filter(Boolean)

const out = {}
let n = 0
for (const nome of NOMES) {
  const i = set.icons[nome] ?? set.icons[set.aliases?.[nome]?.parent]
  if (!i) throw new Error(`emoji não existe no Fluent Emoji Flat: ${nome}`)
  // ids de gradiente únicos por emoji (evita colisão quando vários aparecem na mesma tela)
  let body = i.body
  const ids = [...body.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
  for (const id of ids) body = body.replaceAll(`"${id}"`, `"fe-${nome}-${id}"`).replaceAll(`#${id})`, `#fe-${nome}-${id})`)
  out[nome] = body
  n++
}
const ts = `// Gerado por scripts/gerar-emojis.mjs — não editar à mão.
// Fluent Emoji Flat (Microsoft), licença MIT — viewBox 0 0 32 32.
export const EMOJIS_FLUENT: Record<string, string> = ${JSON.stringify(out, null, 0)}
`
writeFileSync(new URL("../src/lib/emojis-fluent.ts", import.meta.url), ts)
console.log(`${n} emojis gravados, ${(ts.length / 1024).toFixed(1)} KB`)
