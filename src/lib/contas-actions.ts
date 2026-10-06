import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { registrarFaturaPaga, removerFaturaPaga } from "@/lib/pagamentos"
import { useFinData } from "@/hooks/use-fin-data"
import type { ItemObrigacao } from "@/lib/selectors"

// Marca/desmarca uma conta do mês como paga (obrigação fixa ou fatura de cartão).
// Mesma regra em todas as telas: obrigação paga = transação com obrigacao_id no mês;
// fatura paga = registro em fin_fatura_pagamentos.
export async function alternarPagamento(item: ItemObrigacao, mesRef: string): Promise<boolean> {
  try {
    if (item.tipo === "cartao") {
      if (item.paga) await removerFaturaPaga(item.id, mesRef)
      else await registrarFaturaPaga(item.id, mesRef, item.valor)
    } else if (item.paga) {
      const { error } = await supabase.from("fin_transacoes").delete().eq("obrigacao_id", item.id).eq("mes_ref", mesRef)
      if (error) throw error
    } else {
      const { error } = await supabase.from("fin_transacoes").insert({
        tipo: "despesa", descricao: item.nome, valor: item.valor, categoria: item.categoria,
        data: `${mesRef}-${String(item.dia || 1).padStart(2, "0")}`, mes_ref: mesRef, obrigacao_id: item.id,
      })
      if (error) throw error
    }
    toast.success(item.paga ? `${item.nome} reaberta` : `${item.nome} marcada como paga`)
    await useFinData.getState().loadAll()
    return true
  } catch (e) {
    toast.error("Não foi possível atualizar", { description: e instanceof Error ? e.message : "" })
    return false
  }
}
