import type { Cartao, FaturaPagamento, Obrigacao, Transacao } from "@/lib/supabase"
import {
  calcularProjecaoMes, faturaDoMes, faturaPagaNoMes, gastoDebitoNoMes, receitasDoMes,
} from "@/lib/selectors"
import { addMonths } from "@/lib/format"

// ---------------------------------------------------------------------------
// Simulador "posso comprar?": aplica uma compra hipotética (à vista no débito,
// ou no cartão em N parcelas) sobre a projeção dos próximos meses e diz se cabe.
// Nada é gravado.
//
// Sobra livre de um mês = receita − (obrigações + faturas já lançadas) − gasto variável típico.
//   receita:  real do mês > renda projetada (config) > média das receitas reais recentes
//   variável: débito/Pix fora de obrigações; média dos últimos meses com dado
//             (no mês corrente, o maior entre o já gasto e a média)
// ---------------------------------------------------------------------------

export type Forma = { tipo: "debito" } | { tipo: "cartao"; cartaoId: number }
export type EntradaSimulacao = { valor: number; forma: Forma; parcelas: number; primeiroMes: string }
export type Veredito = "cabe" | "aperta" | "nao"

export type MesSimulado = {
  mesRef: string
  receita: number
  receitaEstimada: boolean
  comprometido: number
  variavel: number
  sobraAntes: number
  impacto: number
  sobraDepois: number
}

export type ResultadoSimulacao = {
  meses: MesSimulado[]
  veredito: Veredito
  folga: number                 // folga mínima desejada (10% da receita média)
  piorMes: MesSimulado
  valorParcela: number
  limite: { total: number; usado: number; depois: number; estoura: boolean } | null
}

type Base = {
  obrigacoes: Obrigacao[]; cartoes: Cartao[]; transacoes: Transacao[]
  config: Record<string, string>; pagamentos: FaturaPagamento[]; mesRef: string; horizonte?: number
}

function mediaRecente(fn: (m: string) => number, mesRef: string, n = 3): number {
  const vals: number[] = []
  for (let i = 1; i <= 6 && vals.length < n; i++) {
    const v = fn(addMonths(mesRef, -i))
    if (v > 0) vals.push(v)
  }
  const atual = fn(mesRef)
  if (!vals.length && atual > 0) vals.push(atual)
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
}

export function simular(base: Base, e: EntradaSimulacao): ResultadoSimulacao {
  const { obrigacoes, cartoes, transacoes, config, pagamentos, mesRef } = base
  const horizonte = base.horizonte ?? 6
  const renda = parseFloat(config.renda_projetada) || 0
  const receitaMedia = mediaRecente((m) => receitasDoMes(transacoes, m), mesRef)
  const variavelMedio = mediaRecente((m) => gastoDebitoNoMes(transacoes, m), mesRef)

  const n = e.forma.tipo === "cartao" ? Math.max(1, Math.min(48, Math.round(e.parcelas) || 1)) : 1
  const valorParcela = e.valor / n
  const mesesCompra = new Set(Array.from({ length: n }, (_, i) => addMonths(e.primeiroMes, i)))

  const meses: MesSimulado[] = []
  for (let i = 0; i < horizonte; i++) {
    const m = addMonths(mesRef, i)
    const proj = calcularProjecaoMes(obrigacoes, cartoes, transacoes, config, m)
    const real = receitasDoMes(transacoes, m)
    const receita = real > 0 ? real : renda > 0 ? renda : receitaMedia
    const variavel = i === 0 ? Math.max(gastoDebitoNoMes(transacoes, m), variavelMedio) : variavelMedio
    const sobraAntes = receita - proj.totalObr - variavel
    const impacto = mesesCompra.has(m) ? valorParcela : 0
    meses.push({
      mesRef: m, receita, receitaEstimada: real <= 0, comprometido: proj.totalObr, variavel,
      sobraAntes, impacto, sobraDepois: sobraAntes - impacto,
    })
  }

  // limite do cartão: soma das faturas em aberto (atual + parcelas futuras) + compra inteira
  let limite: ResultadoSimulacao["limite"] = null
  if (e.forma.tipo === "cartao") {
    const cartaoId = e.forma.cartaoId
    const c = cartoes.find((x) => x.id === cartaoId)
    if (c?.limite && Number(c.limite) > 0) {
      let usado = 0
      for (let i = 0; i <= 48; i++) {
        const m = addMonths(mesRef, i)
        if (faturaPagaNoMes(pagamentos, cartaoId, m)) continue
        usado += faturaDoMes(transacoes, cartaoId, m)
      }
      const total = Number(c.limite)
      limite = { total, usado, depois: usado + e.valor, estoura: usado + e.valor > total }
    }
  }

  const folga = Math.max(100, 0.1 * (meses.reduce((s, m) => s + m.receita, 0) / meses.length))
  const afetados = meses.filter((m) => m.impacto > 0)
  const alvo = afetados.length ? afetados : meses
  const piorMes = alvo.reduce((a, b) => (b.sobraDepois < a.sobraDepois ? b : a), alvo[0])
  const veredito: Veredito =
    limite?.estoura || piorMes.sobraDepois < 0 ? "nao" : piorMes.sobraDepois < folga ? "aperta" : "cabe"

  return { meses, veredito, folga, piorMes, valorParcela, limite }
}

// Menor nº de parcelas (até 12) que deixa a compra folgada no mesmo cartão
export function melhorParcelamento(base: Base, e: EntradaSimulacao): number | null {
  if (e.forma.tipo !== "cartao") return null
  for (let n = 1; n <= 12; n++) {
    if (simular(base, { ...e, parcelas: n }).veredito === "cabe") return n
  }
  return null
}

// Primeiro mês (até 6 à frente) em que a mesma compra passa a caber com folga
export function melhorMesParaComprar(base: Base, e: EntradaSimulacao): string | null {
  for (let i = 1; i <= 6; i++) {
    const primeiroMes = addMonths(e.primeiroMes, i)
    const r = simular({ ...base, horizonte: 6 + i }, { ...e, primeiroMes })
    if (r.veredito === "cabe") return primeiroMes
  }
  return null
}
