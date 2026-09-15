import { supabase } from "@/lib/supabase"
import { addMonths } from "@/lib/format"
import type { ParseResult } from "./parser"

// Grava a entrada interpretada no Supabase, conforme origem/parcelas.
// Retorna uma mensagem de sucesso pra mostrar no chat.
export async function salvarEntrada(r: ParseResult, mesRefBase: string): Promise<string> {
  // ── RECEITA ou DESPESA à débito/dinheiro → 1 transação ──
  if (r.origem === "debito") {
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from("fin_transacoes").insert({
      tipo: r.tipo,
      descricao: r.descricao,
      valor: r.valorTotal,
      categoria: r.categoria,
      data: hoje,
      mes_ref: hoje.slice(0, 7),
    })
    if (error) throw error
    return `${r.tipo === "receita" ? "Receita" : "Despesa"} "${r.descricao}" de R$ ${r.valorTotal.toFixed(2)} registrada.`
  }

  // ── DESPESA no CARTÃO ──
  if (!r.cartao) throw new Error("Cartão não identificado")

  // à vista no cartão → item na fatura do mês base
  if (r.numParcelas <= 1) {
    const { error } = await supabase.from("fin_fatura_itens").insert({
      cartao_id: r.cartao.id,
      mes_ref: mesRefBase,
      descricao: r.descricao,
      valor: r.valorParcela,
      categoria: r.categoria,
    })
    if (error) throw error
    return `"${r.descricao}" (R$ ${r.valorParcela.toFixed(2)}) lançada na fatura do ${r.cartao.nome}.`
  }

  // parcelado → registra a compra + gera 1 transação por parcela (igual ao "Nova Compra")
  const { data: compraData, error: compraErr } = await supabase
    .from("fin_cartao_compras")
    .insert({
      cartao_id: r.cartao.id,
      descricao: r.descricao,
      categoria: r.categoria,
      valor_parcela: r.valorParcela,
      parcela_total: r.numParcelas,
      data_inicio: mesRefBase + "-01",
    })
    .select()
  if (compraErr) throw compraErr
  const compraId = compraData![0].id
  const cartaoId = r.cartao.id

  const linhas = Array.from({ length: r.numParcelas }, (_, i) => ({
    tipo: "despesa",
    descricao: `${r.descricao} (${i + 1}/${r.numParcelas})`,
    valor: r.valorParcela,
    categoria: r.categoria,
    data: addMonths(mesRefBase, i) + "-01",
    mes_ref: addMonths(mesRefBase, i),
    cartao_id: cartaoId,
    compra_id: compraId,
    parcela_atual: i + 1,
    parcela_total: r.numParcelas,
  }))
  const { error: txErr } = await supabase.from("fin_transacoes").insert(linhas)
  if (txErr) throw txErr

  return `${r.numParcelas}x de R$ ${r.valorParcela.toFixed(2)} — "${r.descricao}" no ${r.cartao.nome} (total R$ ${r.valorTotal.toFixed(2)}).`
}
