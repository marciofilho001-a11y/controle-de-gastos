import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Ativo, type ClasseAtivo } from "@/lib/supabase"

// ---------------------------------------------------------------------------
// Carteira: FIIs, ações e renda fixa. Vender um ativo põe o dinheiro como receita
// no mês da venda ("Venda de investimento"), igual a um salário.
// ---------------------------------------------------------------------------

export const CLASSES: { v: ClasseAtivo; l: string; curto: string; cor: string }[] = [
  { v: "fii", l: "Fundos imobiliários", curto: "FIIs", cor: "#f59e0b" },
  { v: "acao", l: "Ações", curto: "Ações", cor: "#3d8ef0" },
  { v: "renda_fixa", l: "Renda fixa", curto: "Renda fixa", cor: "#14b8a6" },
  { v: "outro", l: "Outros", curto: "Outros", cor: "#8b93a7" },
]
export const classeInfo = (c: ClasseAtivo) => CLASSES.find((x) => x.v === c) ?? CLASSES[3]

const mesDe = (data: string) => data.slice(0, 7)
const r2 = (n: number) => Math.round(n * 100) / 100

export type NovoAtivo = {
  classe: ClasseAtivo; nome: string; ticker: string | null; quantidade: number | null
  valor_aplicado: number; data_compra: string; observacao: string | null
  saiuDoMes: boolean      // o dinheiro saiu do saldo do mês da compra (vira despesa "Investimento (aporte)")
}

export async function criarAtivo(a: NovoAtivo) {
  const { saiuDoMes, ...dados } = a
  const { error } = await supabase.from("fin_ativos").insert(dados)
  if (error) throw error
  if (saiuDoMes) {
    const { error: e2 } = await supabase.from("fin_transacoes").insert({
      tipo: "despesa", descricao: `Aporte ${a.ticker || a.nome}`, valor: a.valor_aplicado, categoria: "aporte",
      data: a.data_compra, mes_ref: mesDe(a.data_compra), origem: "aporte_ativo",
    })
    if (e2) throw e2
  }
  await useFinData.getState().loadAll()
}

export async function editarAtivo(id: number, dados: Partial<Ativo>) {
  const { error } = await supabase.from("fin_ativos").update(dados).eq("id", id)
  if (error) throw error
  await useFinData.getState().loadAll()
}

// vende tudo ou parte (pela quantidade); a parte vendida vira um registro fechado com a receita ligada
export async function venderAtivo(a: Ativo, venda: { data: string; valor: number; quantidade: number | null }) {
  const total = a.quantidade ?? 0
  const parcial = !!(venda.quantidade && total && venda.quantidade < total)
  const aplicadoVendido = parcial ? r2(a.valor_aplicado * (venda.quantidade! / total)) : a.valor_aplicado

  const { data: tx, error: e1 } = await supabase.from("fin_transacoes").insert({
    tipo: "receita", descricao: `Venda ${a.ticker || a.nome}`, valor: r2(venda.valor), categoria: "venda_investimento",
    data: venda.data, mes_ref: mesDe(venda.data), origem: "venda_ativo",
  }).select("id").single()
  if (e1) throw e1

  if (parcial) {
    const { error: e2 } = await supabase.from("fin_ativos").update({
      quantidade: total - venda.quantidade!, valor_aplicado: r2(a.valor_aplicado - aplicadoVendido),
    }).eq("id", a.id)
    if (e2) throw e2
    const { error: e3 } = await supabase.from("fin_ativos").insert({
      classe: a.classe, nome: a.nome, ticker: a.ticker, quantidade: venda.quantidade, valor_aplicado: aplicadoVendido,
      data_compra: a.data_compra, vendido_em: venda.data, valor_venda: r2(venda.valor), transacao_id: tx.id, observacao: a.observacao,
    })
    if (e3) throw e3
  } else {
    const { error: e2 } = await supabase.from("fin_ativos").update({
      vendido_em: venda.data, valor_venda: r2(venda.valor), transacao_id: tx.id,
    }).eq("id", a.id)
    if (e2) throw e2
  }
  await useFinData.getState().loadAll()
}

// desfaz a venda: some a receita e o ativo volta pra carteira (junta com o que sobrou, se foi parcial)
export async function desfazerVenda(a: Ativo) {
  if (a.transacao_id) {
    const { error } = await supabase.from("fin_transacoes").delete().eq("id", a.transacao_id)
    if (error) throw error
  }
  const resto = useFinData.getState().ativos.find((x) =>
    x.id !== a.id && !x.vendido_em && x.classe === a.classe && x.nome === a.nome &&
    (x.ticker ?? "") === (a.ticker ?? "") && x.data_compra === a.data_compra)
  if (resto) {
    const { error } = await supabase.from("fin_ativos").update({
      quantidade: (resto.quantidade ?? 0) + (a.quantidade ?? 0), valor_aplicado: r2(resto.valor_aplicado + a.valor_aplicado),
    }).eq("id", resto.id)
    if (error) throw error
    await supabase.from("fin_ativos").delete().eq("id", a.id)
  } else {
    const { error } = await supabase.from("fin_ativos").update({ vendido_em: null, valor_venda: null, transacao_id: null }).eq("id", a.id)
    if (error) throw error
  }
  await useFinData.getState().loadAll()
}

export async function apagarAtivo(a: Ativo) {
  if (a.transacao_id) await supabase.from("fin_transacoes").delete().eq("id", a.transacao_id)
  const { error } = await supabase.from("fin_ativos").delete().eq("id", a.id)
  if (error) throw error
  await useFinData.getState().loadAll()
}
