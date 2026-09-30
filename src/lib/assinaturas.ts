import type { Transacao } from "@/lib/supabase"
import { ehFaturaCheia } from "@/lib/selectors"
import { chaveDescricao } from "@/lib/essencial"
import { nomeComercial, temaDaDescricao, temasComExtras } from "@/lib/temas"
import { infoParcela } from "@/lib/parcelas"
import { addMonths } from "@/lib/format"

// ---------------------------------------------------------------------------
// Assinaturas: cobranças recorrentes que NÃO são parcelamento.
// Entra como assinatura quando:
//   - você confirmou (fin_config.assinaturas_confirmadas), ou
//   - a categoria é "assinatura" ou o tema da descrição é assinaturas (Netflix, YT Premium...), ou
//   - a mesma descrição aparece em 2+ meses com valor parecido e sem marca de parcela.
// Sai quando você marca "não é assinatura" (fin_config.assinaturas_ignoradas).
// ---------------------------------------------------------------------------

export type StatusAssinatura = "ativa" | "nova" | "pendente" | "sumiu"

export type Assinatura = {
  chave: string
  nome: string
  categoria: string
  cartaoId: number | null
  valor: number              // valor da cobrança mais recente
  valorAnterior: number | null
  mudouValor: boolean
  meses: string[]            // meses com cobrança, em ordem
  ultimoMes: string
  proximoMes: string
  status: StatusAssinatura
  origem: "confirmada" | "categoria" | "recorrencia"
  ultimaTx: Transacao
}

export function lerLista(json?: string | null): string[] {
  if (!json) return []
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

type Grupo = { chave: string; txs: Transacao[] }

function agrupar(transacoes: Transacao[], ateMes: string): Grupo[] {
  const g = new Map<string, Transacao[]>()
  for (const t of transacoes) {
    if (t.tipo !== "despesa" || t.mes_ref > ateMes) continue
    if (t.obrigacao_id) continue                          // obrigações já têm tela própria
    if (t.cartao_id && ehFaturaCheia(t)) continue          // fatura cheia não é compra
    const k = chaveDescricao(t.descricao)
    if (!k) continue
    const arr = g.get(k) || []
    arr.push(t)
    g.set(k, arr)
  }
  return [...g.entries()].map(([chave, txs]) => ({ chave, txs }))
}

export function detectarAssinaturas(
  transacoes: Transacao[], mesRef: string, config: Record<string, string>,
): { assinaturas: Assinatura[]; candidatas: { chave: string; nome: string; valor: number }[] } {
  const temas = temasComExtras(config.temas_extra)
  const confirmadas = new Set(lerLista(config.assinaturas_confirmadas))
  const ignoradas = new Set(lerLista(config.assinaturas_ignoradas))
  const ateMes = addMonths(mesRef, 1)                    // compras de hoje já caem na fatura do mês seguinte
  const grupos = agrupar(transacoes, ateMes)

  const assinaturas: Assinatura[] = []
  const candidatas: { chave: string; nome: string; valor: number }[] = []

  for (const { chave, txs } of grupos) {
    if (ignoradas.has(chave)) continue
    const parcelado = txs.some((t) => infoParcela(t) != null)
    const ord = [...txs].sort((a, b) => (a.mes_ref + a.data).localeCompare(b.mes_ref + b.data))
    const ult = ord[ord.length - 1]
    const meses = [...new Set(ord.map((t) => t.mes_ref))].sort()
    const tema = temaDaDescricao(ult.descricao, temas)
    const porCategoria = ult.categoria === "assinatura" || tema?.key === "assinaturas"

    // valor por mês (soma se houve 2 cobranças no mesmo mês)
    const porMes = meses.map((m) => ord.filter((t) => t.mes_ref === m).reduce((s, t) => s + Number(t.valor), 0))
    const vals = porMes.filter((v) => v > 0)
    const parecidos = vals.length >= 2 && Math.max(...vals) / Math.min(...vals) <= 1.25
    const porRecorrencia = !parcelado && meses.length >= 2 && parecidos

    let origem: Assinatura["origem"] | null = null
    if (confirmadas.has(chave)) origem = "confirmada"
    else if (!parcelado && porCategoria) origem = "categoria"
    else if (porRecorrencia) origem = "recorrencia"

    if (!origem) {
      // candidata a marcar manualmente: compra avulsa recente, não parcelada
      if (!parcelado && ult.mes_ref >= addMonths(mesRef, -2)) {
        candidatas.push({ chave, nome: nomeComercial(ult.descricao), valor: Number(ult.valor) })
      }
      continue
    }

    const valor = porMes[porMes.length - 1]
    const valorAnterior = porMes.length >= 2 ? porMes[porMes.length - 2] : null
    const mudouValor = valorAnterior != null && Math.abs(valor - valorAnterior) / valorAnterior > 0.03
    const ultimoMes = meses[meses.length - 1]

    let status: StatusAssinatura
    if (ultimoMes >= mesRef) status = meses.length === 1 ? "nova" : "ativa"
    else if (ultimoMes === addMonths(mesRef, -1)) status = "pendente"   // cobrou mês passado, ainda não apareceu neste
    else status = "sumiu"

    assinaturas.push({
      chave, nome: nomeComercial(ult.descricao), categoria: ult.categoria || "assinatura",
      cartaoId: ult.cartao_id, valor, valorAnterior, mudouValor, meses, ultimoMes,
      proximoMes: ultimoMes >= mesRef ? addMonths(ultimoMes, 1) : mesRef,
      status, origem, ultimaTx: ult,
    })
  }

  const ordemStatus: Record<StatusAssinatura, number> = { pendente: 0, ativa: 1, nova: 2, sumiu: 3 }
  assinaturas.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || b.valor - a.valor)
  candidatas.sort((a, b) => a.nome.localeCompare(b.nome))
  return { assinaturas, candidatas }
}
