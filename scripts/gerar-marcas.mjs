// Gera src/lib/marcas-dados.ts com só as marcas da detecção automática (evita levar ~3.400 logos pro bundle).
// Rodar depois de mexer na lista: node scripts/gerar-marcas.mjs
import { readFileSync, writeFileSync } from "node:fs"
import * as si from "simple-icons"

const fonte = readFileSync(new URL("../src/lib/marcas.ts", import.meta.url), "utf8")
const nomes = [...new Set([...fonte.matchAll(/\[(si[A-Z0-9][A-Za-z0-9]*),/g)].map((m) => m[1]))]
const linhas = nomes.map((n) => {
  const i = si[n]
  if (!i) throw new Error(`Ícone não existe no simple-icons: ${n}`)
  return `export const ${n}: Marca = ${JSON.stringify({ title: i.title, slug: i.slug, hex: i.hex, path: i.path })}`
})
writeFileSync(
  new URL("../src/lib/marcas-dados.ts", import.meta.url),
  `// GERADO por scripts/gerar-marcas.mjs a partir do pacote simple-icons — não editar à mão\n` +
  `export type Marca = { title: string; slug: string; hex: string; path: string }\n\n${linhas.join("\n")}\n`,
)
console.log(`${nomes.length} marcas gravadas`)
