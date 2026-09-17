import type { Obrigacao, Transacao, Cartao, CartaoCompra } from "@/lib/supabase"

// Em qual parcela a obrigação está no mês de referência (1-indexed)
export function parcelaNoMes(obr: Obrigacao, mesRef: string): number {
  const [anoI, mesI] = obr.data_inicio.slice(0, 7).split("-").map(Number)
  const [anoM, mesM] = mesRef.split("-").map(Number)
  return (anoM - anoI) * 12 + (mesM - mesI) + 1
}

export function obrigacaoAtivaNoMes(obr: Obrigacao, mesRef: string): boolean {
  if (!obr.ativa) return false
  const parc = parcelaNoMes(obr, mesRef)
  if (parc < 1) return false
  if (obr.parcela_total && parc > obr.parcela_total) return false
  return true
}

export function obrigacoesAtivasNoMes(obrigacoes: Obrigacao[], mesRef: string): Obrigacao[] {
  return obrigacoes.filter((o) => obrigacaoAtivaNoMes(o, mesRef))
}

export function txDoMes(transacoes: Transacao[], mesRef: string): Transacao[] {
  return transacoes.filter((t) => t.mes_ref === mesRef)
}

export function receitasDoMes(transacoes: Transacao[], mesRef: string): number {
  return txDoMes(transacoes, mesRef)
    .filter((t) => t.tipo === "receita")
    .reduce((s, t) => s + Number(t.valor), 0)
}

export function despesasDoMes(transacoes: Transacao[], mesRef: string): number {
  const doMes = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "despesa")
  // despesas que NÃO são de cartão somam direto (débito, obrigações)
  const foraCartao = doMes.filter((t) => !t.cartao_id).reduce((s, t) => s + Number(t.valor), 0)
  // despesas de cartão: somadas via faturaInfoDoMes (que reparte cheia/itens, sem duplicar)
  const cartaoIds = [...new Set(doMes.filter((t) => t.cartao_id).map((t) => t.cartao_id as number))]
  const deCartao = cartaoIds.reduce((s, cid) => s + faturaInfoDoMes(transacoes, cid, mesRef).valor, 0)
  return foraCartao + deCartao
}

export function obrigacaoPagaNoMes(
  transacoes: Transacao[],
  obrId: number,
  mesRef: string
): Transacao | undefined {
  return transacoes.find((t) => t.obrigacao_id === obrId && t.mes_ref === mesRef)
}

// Fatura de um cartão num mês = soma das despesas daquele cartão nesse mês_ref
// Detecta se uma transação de cartão é uma "fatura cheia" lançada manualmente
// (valor total do mês, descrição "FATURA" ou "FATURA (x/y)") vs. um item/compra detalhada.
export function ehFaturaCheia(t: Transacao): boolean {
  const d = (t.descricao || "").trim().toUpperCase()
  return d === "FATURA" || /^FATURA\s*\(\d+\/\d+\)$/.test(d) || /^FATURA\s+INICIO/.test(d)
}

export type FaturaTipo = "prevista" | "atual" | "parcial" | "vazia"
export type FaturaInfo = {
  valor: number        // total da fatura (o que você paga)
  detalhado: number    // soma dos itens realmente lançados
  indefinido: number   // parte da fatura ainda não detalhada (cheia - detalhado)
  tipo: FaturaTipo
}

// Modelo do usuário (evita duplicação):
// - fatura cheia (ex: R$200) define o TOTAL da fatura
// - itens detalhados (ex: R$50) são o que já foi contabilizado
// - o resto (R$150) vira "fatura indefinida" = cheia - detalhado
// Nunca soma cheia + itens: o total é sempre a cheia (quando existe), repartida.
// Casos:
//   só cheia          -> PREVISTA  (total = cheia, indefinido = cheia, detalhado = 0)
//   cheia + itens      -> PARCIAL   (total = cheia, detalhado = itens, indefinido = cheia - itens)
//   só itens           -> ATUAL     (total = itens, tudo detalhado)
//   nada               -> VAZIA
export function faturaInfoDoMes(transacoes: Transacao[], cartaoId: number, mesRef: string): FaturaInfo {
  const doCartao = transacoes.filter((t) => t.cartao_id === cartaoId && t.mes_ref === mesRef && t.tipo === "despesa")
  const itens = doCartao.filter((t) => !ehFaturaCheia(t))
  const cheias = doCartao.filter((t) => ehFaturaCheia(t))
  const detalhado = itens.reduce((s, t) => s + Number(t.valor), 0)
  const cheia = cheias.reduce((s, t) => s + Number(t.valor), 0)

  if (cheia > 0) {
    // a fatura cheia manda no total; itens são o detalhado, resto é indefinido
    const indefinido = Math.max(0, cheia - detalhado)
    // se o detalhado passou da cheia, o total vira o detalhado (o cheio ficou defasado)
    const valor = detalhado > cheia ? detalhado : cheia
    const tipo: FaturaTipo = detalhado > 0 ? "parcial" : "prevista"
    return { valor, detalhado, indefinido: detalhado > cheia ? 0 : indefinido, tipo }
  }
  if (detalhado > 0) return { valor: detalhado, detalhado, indefinido: 0, tipo: "atual" }
  return { valor: 0, detalhado: 0, indefinido: 0, tipo: "vazia" }
}

export function faturaDoMes(transacoes: Transacao[], cartaoId: number, mesRef: string): number {
  return faturaInfoDoMes(transacoes, cartaoId, mesRef).valor
}

export function totalCartoesNoMes(cartoes: Cartao[], transacoes: Transacao[], mesRef: string): number {
  return cartoes
    .filter((c) => c.ativo !== false)
    .reduce((s, c) => s + faturaDoMes(transacoes, c.id, mesRef), 0)
}

export function mesFimObrigacao(o: Obrigacao): string | null {
  if (!o.parcela_total) return null
  const [a, m] = o.data_inicio.slice(0, 7).split("-").map(Number)
  const d = new Date(a, m - 1 + (o.parcela_total - 1), 1)
  return d.toISOString().slice(0, 7)
}

import type { Teto } from "@/lib/supabase"
import { addMonths } from "@/lib/format"

export function gastoDebitoNoMes(transacoes: Transacao[], mesRef: string): number {
  return txDoMes(transacoes, mesRef)
    .filter((t) => t.tipo === "despesa" && !t.cartao_id && !t.obrigacao_id)
    .reduce((s, t) => s + Number(t.valor), 0)
}

export function gastoVariavelTotalNoMes(
  cartoes: Cartao[], transacoes: Transacao[], mesRef: string
): number {
  return gastoDebitoNoMes(transacoes, mesRef) + totalCartoesNoMes(cartoes, transacoes, mesRef)
}

export function gastoCategoriaNoMes(transacoes: Transacao[], catKey: string, mesRef: string): number {
  return txDoMes(transacoes, mesRef)
    .filter((t) => t.tipo === "despesa" && t.categoria === catKey)
    .reduce((s, t) => s + Number(t.valor), 0)
}

export function getTeto(
  tetos: Teto[], mesRef: string, escopo: string,
  cartaoId: number | null, categoria: string | null
): number | null {
  const t = tetos.find(
    (x) =>
      x.mes_ref === mesRef && x.escopo === escopo &&
      (cartaoId ? Number(x.cartao_id) === Number(cartaoId) : !x.cartao_id) &&
      (categoria ? x.categoria === categoria : !x.categoria)
  )
  return t ? Number(t.valor) : null
}

export function mediaCategoriaMeses(
  transacoes: Transacao[], catKey: string, mesRef: string, n: number
): number {
  const valores: number[] = []
  for (let i = 1; i <= n; i++) {
    const v = gastoCategoriaNoMes(transacoes, catKey, addMonths(mesRef, -i))
    if (v > 0) valores.push(v)
  }
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0
}

export type StatusPrevisto = "vazio" | "ok" | "critico"
export function statusPrevisto(real: number, previsto: number): StatusPrevisto {
  if (!previsto || previsto <= 0) return "vazio"
  return real > previsto ? "critico" : "ok"
}

export type StatusTeto = "vazio" | "ok" | "alerta" | "critico"
export function statusTeto(gasto: number, teto: number | null): StatusTeto {
  if (!teto) return "vazio"
  const pct = gasto / teto
  if (pct > 1) return "critico"
  if (pct >= 0.8) return "alerta"
  return "ok"
}

// ---- Itens de obrigações do mês (obrigações + faturas de cartão unificadas) ----
export type ItemObrigacao = {
  tipo: "obrigacao" | "cartao"
  id: number
  nome: string
  dia: number | null
  categoria: string | null
  valor: number
  paga: boolean
  parcTxt: string
}

export function itensObrigacoesDoMes(
  obrigacoes: Obrigacao[], cartoes: Cartao[], transacoes: Transacao[], mesRef: string
): ItemObrigacao[] {
  const itensObr: ItemObrigacao[] = obrigacoesAtivasNoMes(obrigacoes, mesRef).map((o) => ({
    tipo: "obrigacao",
    id: o.id,
    nome: o.nome,
    dia: o.dia_vencimento,
    categoria: o.categoria,
    valor: Number(o.valor),
    paga: !!obrigacaoPagaNoMes(transacoes, o.id, mesRef),
    parcTxt: o.parcela_total ? `Parcela ${parcelaNoMes(o, mesRef)}/${o.parcela_total}` : "Recorrente",
  }))
  const itensCartao: ItemObrigacao[] = []
  for (const c of cartoes.filter((c) => c.ativo !== false)) {
    const valor = faturaDoMes(transacoes, c.id, mesRef)
    if (valor <= 0) continue
    itensCartao.push({
      tipo: "cartao",
      id: c.id,
      nome: `Fatura ${c.nome}`,
      dia: c.dia_vencimento,
      categoria: "cartao",
      valor,
      paga: true,
      parcTxt: "Fatura do cartão (já lançada)",
    })
  }
  return [...itensObr, ...itensCartao]
}

// ---- Projeção de um mês ----
export type ProjecaoMes = {
  mesRef: string
  receita: number
  totalObr: number
  sobra: number
  sugestao: number
  qtdObr: number
  estimado: boolean
}

export function calcularProjecaoMes(
  obrigacoes: Obrigacao[], cartoes: Cartao[], transacoes: Transacao[],
  config: Record<string, string>, mesRef: string
): ProjecaoMes {
  const rendaReal = receitasDoMes(transacoes, mesRef)
  const rendaProjetada = parseFloat(config.renda_projetada) || 0
  const estimado = rendaReal <= 0
  const receita = rendaReal > 0 ? rendaReal : rendaProjetada
  const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
  const totalObr = ativas.reduce((s, o) => s + Number(o.valor), 0) + totalCartoesNoMes(cartoes, transacoes, mesRef)
  const sobra = receita - totalObr
  const pct = parseFloat(config.pct_investimento) || 0
  const sugestao = Math.max(0, sobra * (pct / 100))
  return { mesRef, receita, totalObr, sobra, sugestao, qtdObr: ativas.length, estimado }
}

// variação percentual mês a mês (retorna null quando não há base)
export function variacaoPct(atual: number, anterior: number): { pct: number; subiu: boolean } | null {
  if (!anterior) return null
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100)
  return { pct, subiu: pct > 0 }
}

// ---- Investimentos / patrimônio ----
import type { Investimento, SaldoConta } from "@/lib/supabase"

export function saldoContaDoMes(saldos: SaldoConta[], mesRef: string): number {
  const validos = saldos.filter((s) => s.mes_ref <= mesRef).sort((a, b) => a.mes_ref.localeCompare(b.mes_ref))
  return validos.length ? Number(validos[validos.length - 1].saldo) : 0
}

export function investidoAcumuladoAte(investimentos: Investimento[], mesRef: string): number {
  return investimentos.filter((i) => i.mes_ref <= mesRef).reduce((s, i) => s + Number(i.valor), 0)
}

export function patrimonioDoMes(saldos: SaldoConta[], investimentos: Investimento[], mesRef: string): number {
  return saldoContaDoMes(saldos, mesRef) + investidoAcumuladoAte(investimentos, mesRef)
}

// ---- Detalhe de fatura de cartão (fin_fatura_itens) ----
import type { FaturaItem } from "@/lib/supabase"

export function normalizarDescricao(d: string | null): string {
  return (d || "").trim().toLowerCase()
}

// Meses relevantes de um cartão: onde há fatura (transações), compras, ou itens detalhados,
// mais um horizonte de alguns meses à frente pra planejar.
export function mesesDoCartao(
  cartaoId: number, transacoes: Transacao[], compras: CartaoCompra[],
  faturaItens: FaturaItem[], mesRefBase: string
): string[] {
  const set = new Set<string>()
  transacoes.filter((t) => t.cartao_id === cartaoId).forEach((t) => set.add(t.mes_ref))
  compras.filter((c) => c.cartao_id === cartaoId).forEach((c) => set.add(c.data_inicio.slice(0, 7)))
  faturaItens.filter((f) => f.cartao_id === cartaoId).forEach((f) => set.add(f.mes_ref))
  // horizonte em torno do mês navegado: 3 meses atrás até 6 à frente (garante que o mês
  // atual sempre apareça na lista, mesmo sem lançamentos)
  for (let i = -3; i <= 6; i++) set.add(addMonths(mesRefBase, i))
  return [...set].sort()
}

export type SugestaoParcela = {
  descricao: string
  valor: number
  categoria: string
  proxParcela: number
  parcela_total: number
}

export function sugestoesParcelasParaMes(
  faturaItens: FaturaItem[], cartaoId: number, mesAlvo: string, itensJaNoMes: FaturaItem[]
): SugestaoParcela[] {
  const nomesJaNoMes = new Set(itensJaNoMes.map((i) => normalizarDescricao(i.descricao)))
  const porNome: Record<string, FaturaItem> = {}
  faturaItens
    .filter((fi) => fi.cartao_id === cartaoId && fi.parcela_total && fi.parcela_total > 1)
    .forEach((fi) => {
      const dn = normalizarDescricao(fi.descricao)
      if (!porNome[dn] || fi.mes_ref > porNome[dn].mes_ref) porNome[dn] = fi
    })
  const sugestoes: SugestaoParcela[] = []
  Object.values(porNome).forEach((fi) => {
    const dn = normalizarDescricao(fi.descricao)
    if (nomesJaNoMes.has(dn)) return
    const atual = fi.parcela_atual || 1
    if (!fi.parcela_total || atual >= fi.parcela_total) return
    const proxParcela = atual + 1
    const mesProxima = addMonths(fi.mes_ref, 1)
    if (mesProxima !== mesAlvo) return
    sugestoes.push({
      descricao: fi.descricao, valor: Number(fi.valor), categoria: fi.categoria,
      proxParcela, parcela_total: fi.parcela_total,
    })
  })
  return sugestoes
}

// Lista de despesas do mês SEM duplicação de cartão, pronta pra exibir (histórico, donut).
// Regra: pra cada cartão, se tem itens detalhados, esconde a "fatura cheia" e, se a cheia
// for maior que os itens, injeta uma linha virtual "Fatura indefinida" com o restante.
export type LinhaExibicao = Transacao & { _virtual?: boolean }

export function despesasExibicaoDoMes(transacoes: Transacao[], mesRef: string): LinhaExibicao[] {
  const doMes = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "despesa")
  const foraCartao = doMes.filter((t) => !t.cartao_id)
  const cartaoIds = [...new Set(doMes.filter((t) => t.cartao_id).map((t) => t.cartao_id as number))]
  const out: LinhaExibicao[] = [...foraCartao]

  for (const cid of cartaoIds) {
    const doCartao = doMes.filter((t) => t.cartao_id === cid)
    const itens = doCartao.filter((t) => !ehFaturaCheia(t))
    const cheias = doCartao.filter((t) => ehFaturaCheia(t))
    if (itens.length > 0) {
      // mostra os itens; esconde a fatura cheia; injeta indefinido se sobrar
      out.push(...itens)
      const info = faturaInfoDoMes(transacoes, cid, mesRef)
      if (info.indefinido > 0.005 && cheias.length > 0) {
        const base = cheias[0]
        out.push({
          ...base,
          id: -cid * 100000, // id negativo = linha virtual, não deletável
          descricao: "Fatura indefinida",
          valor: info.indefinido,
          categoria: "cartao",
          _virtual: true,
        })
      }
    } else {
      // sem itens: mostra a fatura cheia normal
      out.push(...cheias)
    }
  }
  return out
}
