import type { Transacao } from "@/lib/supabase"
import { despesasExibicaoDoMes, type LinhaExibicao } from "@/lib/selectors"
import { catInfo } from "@/lib/categorias"
import { normalizarTexto, nomeComercial, temaDaDescricao, temasComExtras, type Tema } from "@/lib/temas"
import { addMonths } from "@/lib/format"

// ---------------------------------------------------------------------------
// Essencial × por escolha: cada despesa do mês é classificada em
//   essencial  — o que manteria a vida funcionando (casa, saúde, estudo, mercado, transporte, contratos)
//   escolha    — gasto discricionário (lazer, bebida, compras, delivery, assinaturas...)
//   indefinido — ainda não dá pra saber (fatura cheia sem detalhe, "Outro")
// Ordem de decisão: ajuste manual do usuário > tema da descrição (temas.ts) > categoria.
// Ajustes ficam em fin_config.essencial_override = { "<descrição normalizada>": "essencial" | "escolha" }.
// ---------------------------------------------------------------------------

export type Natureza = "essencial" | "escolha" | "indefinido"
export type Overrides = Record<string, Exclude<Natureza, "indefinido">>

const CAT_ESSENCIAL = new Set(["moradia", "consorcio", "financiamento", "saude", "educacao", "transporte", "alimentacao"])
const CAT_ESCOLHA = new Set(["lazer", "compras", "assinatura"])

export const NATUREZA_INFO: Record<Natureza, { label: string; cor: string; curto: string }> = {
  essencial: { label: "Essencial", curto: "Essencial", cor: "#38bdf8" },
  escolha: { label: "Por escolha", curto: "Escolha", cor: "#f472b6" },
  indefinido: { label: "A classificar", curto: "A classificar", cor: "#8b93a7" },
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
export type ResumoNatureza = {
  mesRef: string
  total: number
  essencial: number
  escolha: number
  indefinido: number
  pctEscolha: number          // % de escolha sobre o que está classificado (essencial + escolha)
  cobertura: number           // fração do mês que já dá pra classificar (0..1); abaixo de 0.5 o % não é confiável
  linhas: LinhaClassificada[]
  gruposEscolha: { grupo: string; total: number; n: number }[]
}

export function resumoNatureza(
  transacoes: Transacao[], mesRef: string, temasExtraJson?: string | null, overridesJson?: string | null,
): ResumoNatureza {
  const temas = temasComExtras(temasExtraJson)
  const overrides = lerOverrides(overridesJson)
  const linhas = despesasExibicaoDoMes(transacoes, mesRef).map((t) => ({ ...t, ...classificar(t, temas, overrides) }))
  const soma = (n: Natureza) => linhas.filter((l) => l.natureza === n).reduce((s, l) => s + Number(l.valor), 0)
  const essencial = soma("essencial"), escolha = soma("escolha"), indefinido = soma("indefinido")
  const classificado = essencial + escolha
  const g = new Map<string, { grupo: string; total: number; n: number }>()
  for (const l of linhas) {
    if (l.natureza !== "escolha") continue
    const cur = g.get(l.grupo) || { grupo: l.grupo, total: 0, n: 0 }
    cur.total += Number(l.valor); cur.n++
    g.set(l.grupo, cur)
  }
  return {
    mesRef, linhas, essencial, escolha, indefinido,
    total: essencial + escolha + indefinido,
    pctEscolha: classificado > 0 ? (escolha / classificado) * 100 : 0,
    cobertura: essencial + escolha + indefinido > 0 ? classificado / (essencial + escolha + indefinido) : 0,
    gruposEscolha: [...g.values()].sort((a, b) => b.total - a.total),
  }
}

// Série dos últimos N meses (só meses com despesa), pra ver a evolução do % por escolha
export function serieNatureza(
  transacoes: Transacao[], mesRef: string, n: number, temasExtraJson?: string | null, overridesJson?: string | null,
) {
  const out: { mesRef: string; pctEscolha: number; escolha: number; essencial: number; confiavel: boolean }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const m = addMonths(mesRef, -i)
    const r = resumoNatureza(transacoes, m, temasExtraJson, overridesJson)
    if (r.total > 0) out.push({ mesRef: m, pctEscolha: r.pctEscolha, escolha: r.escolha, essencial: r.essencial, confiavel: r.cobertura >= 0.5 })
  }
  return out
}
