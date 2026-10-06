import { ListChecks, CalendarClock, CreditCard, Wallet, Clock, Flag, type LucideIcon } from "@/lib/icons"
import type { Cartao, FaturaPagamento, Obrigacao, Transacao } from "@/lib/supabase"
import { fmtR } from "@/lib/format"
import {
  receitasDoMes, obrigacoesAtivasNoMes, obrigacaoPagaNoMes, faturaInfoDoMes,
  despesasExibicaoDoMes, txDoMes, faturaPagaNoMes,
} from "@/lib/selectors"
import { statusLancamento } from "@/lib/parcelas"

export type CheckFechamento = { id: "obrig" | "fatpg" | "fat" | "rec" | "pend" | "cat"; ok: boolean; titulo: string; curto: string; detalhe: string; icon: LucideIcon }

// Checklist de "virar o mês" — usado no Fechamento e no resumo do Dashboard (mesma regra nos dois).
export function checklistFechamento(p: {
  transacoes: Transacao[]; cartoes: Cartao[]; obrigacoes: Obrigacao[]; faturaPagamentos: FaturaPagamento[]
  config: Record<string, string>; mesRef: string; hoje: string
}): CheckFechamento[] {
  const { transacoes, cartoes, obrigacoes, faturaPagamentos, config, mesRef, hoje } = p
  const receita = receitasDoMes(transacoes, mesRef)
  const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
  const naoPagas = ativas.filter((o) => !obrigacaoPagaNoMes(transacoes, o.id, mesRef))

  const faturas = cartoes.filter((c) => c.ativo !== false)
    .map((c) => ({ c, f: faturaInfoDoMes(transacoes, c.id, mesRef) })).filter((x) => x.f.valor > 0)
  const indefinido = faturas.reduce((s, x) => s + x.f.indefinido, 0)
  const faturasPendentes = faturas.filter((x) => x.f.indefinido > 0)
  const faturasAPagar = faturas.filter((x) => !faturaPagaNoMes(faturaPagamentos, x.c.id, mesRef))
  const totalFatAPagar = faturasAPagar.reduce((s, x) => s + x.f.valor, 0)

  const exib = despesasExibicaoDoMes(transacoes, mesRef)
  const pendentes = exib.filter((t) => !t._virtual && statusLancamento(t, hoje).key === "pendente")
  const semCategoria = exib.filter((t) => !t._virtual && (!t.categoria || t.categoria === "outro"))
  const rendaPrev = parseFloat(config.renda_projetada) || 0
  const receitas = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "receita")

  return [
    { id: "obrig", ok: naoPagas.length === 0, titulo: "Obrigações pagas", curto: "Conferir obrigações", detalhe: naoPagas.length ? `${naoPagas.length} de ${ativas.length} ainda sem baixa` : `${ativas.length} de ${ativas.length} com baixa`, icon: ListChecks },
    { id: "fatpg", ok: faturasAPagar.length === 0, titulo: "Faturas pagas", curto: "Pagar faturas", detalhe: faturasAPagar.length ? `${fmtR(totalFatAPagar)} em ${faturasAPagar.length} fatura(s) sem baixa` : faturas.length ? `${faturas.length} de ${faturas.length} com baixa` : "Nenhuma fatura neste mês", icon: CalendarClock },
    { id: "fat", ok: indefinido <= 0, titulo: "Faturas detalhadas", curto: "Conferir cartões", detalhe: indefinido > 0 ? `${fmtR(indefinido)} sem detalhamento em ${faturasPendentes.length} fatura(s)` : "Todas as faturas abertas item a item", icon: CreditCard },
    { id: "rec", ok: receita > 0 && (rendaPrev === 0 || receita >= rendaPrev * 0.9), titulo: "Receitas registradas", curto: "Conferir receitas", detalhe: receita === 0 ? "Nenhuma receita lançada" : rendaPrev > 0 && receita < rendaPrev * 0.9 ? `${fmtR(receita)} de ${fmtR(rendaPrev)} previstos` : `${fmtR(receita)} em ${receitas.length} lançamento(s)`, icon: Wallet },
    { id: "pend", ok: pendentes.length === 0, titulo: "Lançamentos pendentes", curto: "Conferir pendências", detalhe: pendentes.length ? `${pendentes.length} com data futura (${fmtR(pendentes.reduce((s, t) => s + Number(t.valor), 0))})` : "Nada com data futura", icon: Clock },
    { id: "cat", ok: semCategoria.length === 0, titulo: "Tudo categorizado", curto: "Categorizar transações", detalhe: semCategoria.length ? `${semCategoria.length} lançamento(s) em "Outro"` : "Nenhum lançamento solto em Outro", icon: Flag },
  ]
}
