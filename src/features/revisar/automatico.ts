import { useFinData } from "@/hooks/use-fin-data"
import { temasComExtras } from "@/lib/temas"
import { processarAutomaticos, type Contexto } from "@/lib/extrato"

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
    extrato: st.extrato,
  }
}

let rodando: Promise<{ feitos: number; erros: number }> | null = null

// Resolve sozinho o que o site já sabe (regras aprendidas, lançamentos que você já tinha feito,
// pagamento de fatura dentro do cartão). O resto fica em "Revisar".
export function rodarAutomatico(): Promise<{ feitos: number; erros: number }> {
  if (rodando) return rodando
  rodando = (async () => {
    const st = useFinData.getState()
    if (!st.extrato.some((e) => e.status === "novo")) return { feitos: 0, erros: 0 }
    const r = await processarAutomaticos(useFinData.getState().extrato, contextoAtual())
    if (r.feitos || r.erros) await useFinData.getState().loadAll()
    return r
  })().finally(() => { rodando = null })
  return rodando
}

// quantos esperam resposta
export function contarParaRevisar(extrato: { status: string }[]): number {
  return extrato.filter((e) => e.status === "novo").length
}
