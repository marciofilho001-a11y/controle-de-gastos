import { supabase } from "@/lib/supabase"

// Baixa da fatura de um cartão num mês. Guardado em fin_fatura_pagamentos
// (um registro por cartão+mês) — não mexe nas transações, só marca como paga.
export async function registrarFaturaPaga(cartaoId: number, mesRef: string, valor: number, pagoEm?: string) {
  const { error } = await supabase
    .from("fin_fatura_pagamentos")
    .upsert(
      { cartao_id: cartaoId, mes_ref: mesRef, valor, pago_em: pagoEm || new Date().toISOString().slice(0, 10) },
      { onConflict: "cartao_id,mes_ref" }
    )
  if (error) throw error
}

export async function removerFaturaPaga(cartaoId: number, mesRef: string) {
  const { error } = await supabase
    .from("fin_fatura_pagamentos")
    .delete()
    .eq("cartao_id", cartaoId)
    .eq("mes_ref", mesRef)
  if (error) throw error
}
