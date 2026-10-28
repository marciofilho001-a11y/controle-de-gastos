import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type ContaBanco } from "@/lib/supabase"
import { temasComExtras } from "@/lib/temas"
import { casarCartao, processarAutomaticos, type Contexto } from "@/lib/extrato"

// Contexto do motor a partir do que está carregado no app agora
export function contextoAtual(): Contexto {
  const st = useFinData.getState()
  return {
    regras: st.regras,
    transacoes: st.transacoes,
    cartoes: st.cartoes,
    obrigacoes: st.obrigacoes,
    contas: st.contasBanco,
    faturaPagamentos: st.faturaPagamentos,
    temas: temasComExtras(st.config.temas_extra),
    usados: new Set(st.extratoLigados),
  }
}

// cartão do banco (Open Finance) sem cartão do app: liga pelo nome (Nubank → CARTÃO NUBANK)
async function ligarCartoes(contas: ContaBanco[]): Promise<boolean> {
  const { cartoes } = useFinData.getState()
  let mudou = false
  for (const c of contas) {
    if (c.tipo !== "CREDIT" || c.cartao_id || c.origem !== "pluggy") continue
    const alvo = casarCartao(`${c.banco ?? ""} ${c.nome ?? ""}`, cartoes)
    if (!alvo) continue
    const { error } = await supabase.from("fin_bancos_contas").update({ cartao_id: alvo.id }).eq("id", c.id)
    if (!error) mudou = true
  }
  return mudou
}

let rodando: Promise<{ feitos: number; erros: number }> | null = null

// Resolve sozinho o que o site já sabe (regras aprendidas, lançamentos que você já tinha feito,
// pagamento de fatura dentro do cartão). O resto fica em "Revisar".
export function rodarAutomatico(): Promise<{ feitos: number; erros: number }> {
  if (rodando) return rodando
  rodando = (async () => {
    const st = useFinData.getState()
    if (!st.extrato.some((e) => e.status === "novo")) return { feitos: 0, erros: 0 }
    if (await ligarCartoes(st.contasBanco)) await useFinData.getState().loadAll()
    const r = await processarAutomaticos(useFinData.getState().extrato, contextoAtual())
    if (r.feitos || r.erros) await useFinData.getState().loadAll()
    return r
  })().finally(() => { rodando = null })
  return rodando
}

export type ResultadoSync = {
  configurado: boolean
  items?: number
  contas?: number
  novos?: number
  atualizados?: number
  erro?: string
  erros?: string[]
}

export async function sincronizarBancos(dias?: number): Promise<ResultadoSync> {
  const { data, error } = await supabase.functions.invoke("pluggy-sync", { body: { acao: "sync", ...(dias ? { dias } : {}) } })
  if (error) throw new Error(error.message || "Não consegui falar com a função de sincronização")
  return data as ResultadoSync
}

export async function statusBancos(): Promise<{ configurado: boolean; items: number } | null> {
  const { data, error } = await supabase.functions.invoke("pluggy-sync", { body: { acao: "status" } })
  if (error) return null
  return data as { configurado: boolean; items: number }
}

// quantos esperam resposta (o que ainda está pendente no banco não conta)
export function contarParaRevisar(extrato: { status: string; pendente: boolean }[]): number {
  return extrato.filter((e) => e.status === "novo" && !e.pendente).length
}
