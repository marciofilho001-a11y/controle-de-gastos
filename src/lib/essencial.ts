import type { Transacao } from "@/lib/supabase"
import { despesasExibicaoDoMes, type LinhaExibicao } from "@/lib/selectors"
import { catInfo } from "@/lib/categorias"
import { normalizarTexto, nomeComercial, temaDaDescricao, temasComExtras, type Tema } from "@/lib/temas"
import { addMonths } from "@/lib/format"

// ---------------------------------------------------------------------------
// Essencial × por escolha: cada despesa do mês é classificada em
//   essencial  — o que manteria a vida funcionando (casa, saúde, estudo, mercado, transporte, contratos)
//   escolha    — gasto discricionário (lazer, bebida, compras, delivery, assinaturas...)
//   inutil     — gasto que você mesmo marcou como inútil (parcela feita na emoção, dívida sem querer).
//                Nunca é automático: só entra aqui pelo "Ajustar".
//   indefinido — ainda não dá pra saber (fatura cheia sem detalhe, "Outro")
// Ordem de decisão: ajuste manual do usuário > tema da descrição (temas.ts) > categoria.
// Ajustes ficam em fin_config.essencial_override = { "<descrição normalizada>": "essencial" | "escolha" | "inutil" }.
// ---------------------------------------------------------------------------

export type Natureza = "essencial" | "escolha" | "inutil" | "indefinido"
export type NaturezaClassificada = Exclude<Natureza, "indefinido">
export const NATUREZAS: NaturezaClassificada[] = ["essencial", "escolha", "inutil"]
export type Overrides = Record<string, NaturezaClassificada>

const CAT_ESSENCIAL = new Set(["moradia", "consorcio", "financiamento", "saude", "educacao", "transporte", "alimentacao"])
const CAT_ESCOLHA = new Set(["lazer", "compras", "assinatura"])

export const NATUREZA_INFO: Record<Natureza, { label: string; cor: string; curto: string; frase: string }> = {
  essencial: { label: "Essencial", curto: "Essencial", cor: "#0f9e8c", frase: "foi essencial" },
  escolha: { label: "Por escolha", curto: "Escolha", cor: "#3b82f6", frase: "foi por escolha" },
  inutil: { label: "Gastos inúteis", curto: "Inútil", cor: "#c97a0e", frase: "foi gasto inútil" },
  indefinido: { label: "A classificar", curto: "A classificar", cor: "#8b93a7", frase: "a classificar" },
}

export function chaveDescricao(descricao: string | null | undefined): string {
  return normalizarTexto(nomeComercial(descricao))
}

export function lerOverrides(json?: string | null): Overrides {
  if (!json) return {}
  try {
    const o = JSON.parse(json)
    return o && typeof o === "object" ? (o as Overrides) : {}
  } catch {
    return {}
  }
}

export type Classificacao = { natureza: Natureza; motivo: "ajuste" | "tema" | "categoria"; grupo: string }

export function classificar(t: Pick<Transacao, "descricao" | "categoria">, temas: Tema[], overrides: Overrides): Classificacao {
  const cat = t.categoria || "outro"
  const tema = temaDaDescricao(t.descricao, temas)
  const grupo = tema?.titulo ?? catInfo(cat).l
  const ov = overrides[chaveDescricao(t.descricao)]
  if (ov) return { natureza: ov, motivo: "ajuste", grupo }
  if (cat === "fatura_indefinida") return { natureza: "indefinido", motivo: "categoria", grupo: "Faturas a detalhar" }
  if (tema) return { natureza: tema.discricionario ? "escolha" : "essencial", motivo: "tema", grupo }
  if (CAT_ESSENCIAL.has(cat)) return { natureza: "essencial", motivo: "categoria", grupo }
  if (CAT_ESCOLHA.has(cat)) return { natureza: "escolha", motivo: "categoria", grupo }
  return { natureza: "indefinido", motivo: "categoria", grupo }
}

export type LinhaClassificada = LinhaExibicao & Classificacao
export type Grupo = { grupo: string; total: number; n: number }
export type ResumoNatureza = {
  mesRef: string
  total: number
  essencial: number
  escolha: number
  inutil: number
  indefinido: number
  classificado: number        // essencial + escolha + inutil
  pct: Record<NaturezaClassificada, number> // % de cada uma sobre o classificado
  pctEscolha: number
  cobertura: number           // fração do mês que já dá pra classificar (0..1); abaixo de 0.5 o % não é confiável
  linhas: LinhaClassificada[]
  grupos: Record<Natureza, Grupo[]>
  gruposEscolha: Grupo[]
}

export function resumoNatureza(
  transacoes: Transacao[], mesRef: string, temasExtraJson?: string | null, overridesJson?: string | null,
): ResumoNatureza {
  const temas = temasComExtras(temasExtraJson)
  const overrides = lerOverrides(overridesJson)
  const linhas = despesasExibicaoDoMes(transacoes, mesRef).map((t) => ({ ...t, ...classificar(t, temas, overrides) }))
  const soma = (n: Natureza) => linhas.filter((l) => l.natureza === n).reduce((s, l) => s + Number(l.valor), 0)
  const essencial = soma("essencial"), escolha = soma("escolha"), inutil = soma("inutil"), indefinido = soma("indefinido")
  const classificado = essencial + escolha + inutil
  const total = classificado + indefinido
  const mapas: Record<Natureza, Map<string, Grupo>> = { essencial: new Map(), escolha: new Map(), inutil: new Map(), indefinido: new Map() }
  for (const l of linhas) {
    // inúteis são poucos e escolhidos a dedo: agrupa pelo nome do lançamento, não pelo tema
    const chave = l.natureza === "inutil" ? nomeComercial(l.descricao) || l.grupo : l.grupo
    const g = mapas[l.natureza]
    const cur = g.get(chave) || { grupo: chave, total: 0, n: 0 }
    cur.total += Number(l.valor); cur.n++
    g.set(chave, cur)
  }
  const ordenar = (m: Map<string, Grupo>) => [...m.values()].sort((a, b) => b.total - a.total)
  const grupos = {
    essencial: ordenar(mapas.essencial), escolha: ordenar(mapas.escolha),
    inutil: ordenar(mapas.inutil), indefinido: ordenar(mapas.indefinido),
  }
  const pctDe = (v: number) => (classificado > 0 ? (v / classificado) * 100 : 0)
  const pct = { essencial: pctDe(essencial), escolha: pctDe(escolha), inutil: pctDe(inutil) }
  return {
    mesRef, linhas, essencial, escolha, inutil, indefinido, classificado, total, pct,
    pctEscolha: pct.escolha,
    cobertura: total > 0 ? classificado / total : 0,
    grupos, gruposEscolha: grupos.escolha,
  }
}

// Quanto ainda vai sair nos próximos meses com o que foi marcado como inútil (parcelas já lançadas à frente)
export function inutilFuturo(
  transacoes: Transacao[], mesRef: string, temasExtraJson?: string | null, overridesJson?: string | null,
): { total: number; meses: number } {
  const temas = temasComExtras(temasExtraJson)
  const overrides = lerOverrides(overridesJson)
  let total = 0
  const meses = new Set<string>()
  for (let i = 1; i <= 36; i++) {
    const m = addMonths(mesRef, i)
    for (const t of despesasExibicaoDoMes(transacoes, m)) {
      if (classificar(t, temas, overrides).natureza !== "inutil") continue
      total += Number(t.valor)
      meses.add(m)
    }
  }
  return { total, meses: meses.size }
}

// Série dos últimos N meses (só meses com despesa), pra ver a evolução do % por escolha
export function serieNatureza(
  transacoes: Transacao[], mesRef: string, n: number, temasExtraJson?: string | null, overridesJson?: string | null,
) {
  const out: { mesRef: string; pct: Record<NaturezaClassificada, number>; pctEscolha: number; escolha: number; essencial: number; inutil: number; confiavel: boolean }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const m = addMonths(mesRef, -i)
    const r = resumoNatureza(transacoes, m, temasExtraJson, overridesJson)
    if (r.total > 0) out.push({ mesRef: m, pct: r.pct, pctEscolha: r.pctEscolha, escolha: r.escolha, essencial: r.essencial, inutil: r.inutil, confiavel: r.cobertura >= 0.5 })
  }
  return out
}
