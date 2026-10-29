import type { Cartao, ContaBanco, ExtratoItem } from "@/lib/supabase"
import { mesFaturaDoItem } from "@/lib/extrato"
import { mesFaturaPara } from "@/lib/data-compra"

// ---------------------------------------------------------------------------
// Retrato de cada banco (Open Finance): conta, cartão, fatura aberta e movimentações.
// Tudo calculado do que o banco mandou, sem depender do que foi lançado no app.
// ---------------------------------------------------------------------------

export type FaturaBanco = { vence: string; total: number }

export type Banco = {
  nome: string
  conta: ContaBanco | null       // conta corrente (Pix, débito)
  cartao: ContaBanco | null      // cartão de crédito
  contas: ContaBanco[]
}

export function bancosDe(contas: ContaBanco[]): Banco[] {
  const mapa = new Map<string, Banco>()
  for (const c of contas.filter((x) => x.origem === "pluggy")) {
    const nome = c.banco || "Banco"
    const b = mapa.get(nome) ?? { nome, conta: null, cartao: null, contas: [] }
    b.contas.push(c)
    if (c.tipo === "CREDIT") b.cartao ??= c
    else b.conta ??= c
    mapa.set(nome, b)
  }
  // ordem fixa e previsível: pelo nome
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

// mês da fatura de cada lançamento do cartão (o mesmo cálculo do lançamento automático)
export function mesDaFatura(item: ExtratoItem, cartaoApp: Cartao | null): string {
  return mesFaturaDoItem(item, cartaoApp)
}

export type FaturaCalculada = {
  mes: string
  compras: number          // o que entrou na fatura
  creditos: number         // pagamentos antecipados e estornos
  total: number            // compras − créditos
  itens: ExtratoItem[]
}

// fatura de um mês somando as movimentações do cartão que caem nela
export function faturaDoMesNoBanco(extrato: ExtratoItem[], contaCartao: ContaBanco, cartaoApp: Cartao | null, mes: string): FaturaCalculada {
  const itens = extrato.filter((e) => e.conta_id === contaCartao.id && mesDaFatura(e, cartaoApp) === mes)
  const compras = soma(itens.filter((e) => e.sentido === "saida"))
  const creditos = soma(itens.filter((e) => e.sentido === "entrada"))
  return { mes, compras, creditos, total: Math.round((compras - creditos) * 100) / 100, itens }
}

// fatura que ainda está aberta: a das compras pendentes; sem elas, a do ciclo de hoje
export function mesDaFaturaAberta(extrato: ExtratoItem[], contaCartao: ContaBanco, cartaoApp: Cartao | null, hoje: string): string {
  const pend = extrato.filter((e) => e.conta_id === contaCartao.id && e.pendente && e.sentido === "saida")
  if (pend.length) {
    const meses = pend.map((e) => mesDaFatura(e, cartaoApp)).sort()
    // a mais comum entre as pendentes (parcelas futuras não puxam pra frente)
    const cont = new Map<string, number>()
    for (const m of meses) cont.set(m, (cont.get(m) ?? 0) + 1)
    return [...cont.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]
  }
  return mesFaturaPara(cartaoApp, hoje)
}

// fatura fechada que o banco informou para o vencimento daquele mês
export function faturaFechadaDoMes(contaCartao: ContaBanco, mes: string): FaturaBanco | null {
  const lista = (contaCartao.faturas ?? []) as FaturaBanco[]
  return lista.find((f) => f.vence?.slice(0, 7) === mes) ?? null
}

export function soma(itens: { valor: number | string }[]): number {
  return Math.round(itens.reduce((s, e) => s + Number(e.valor), 0) * 100) / 100
}

// "MASTERCARD" + "GOLD" -> "Mastercard Gold"
export function nomeDoPlastico(c: ContaBanco): string {
  const t = (s: string | null | undefined) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "")
  return [t(c.bandeira), t(c.nivel)].filter(Boolean).join(" ") || (c.nome ?? "Cartão")
}
