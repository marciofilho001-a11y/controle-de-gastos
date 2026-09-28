import type { Transacao } from "@/lib/supabase"

// Informação de parcela de um lançamento: vem dos campos parcela_atual/parcela_total
// ou, em lançamentos antigos, do sufixo "(2/5)" na descrição.
export function infoParcela(t: Pick<Transacao, "descricao" | "parcela_atual" | "parcela_total">): { atual: number; total: number } | null {
  if (t.parcela_total && t.parcela_total > 1) return { atual: t.parcela_atual || 1, total: t.parcela_total }
  const m = (t.descricao || "").match(/\((\d+)\s*\/\s*(\d+)\)\s*$/)
  if (m && Number(m[2]) > 1) return { atual: Number(m[1]), total: Number(m[2]) }
  return null
}

export type StatusLanc = { key: "pago" | "pendente" | "detalhar"; label: string }

// Status exibido nas listas: lançamento registrado = pago; data futura = pendente;
// linha virtual de fatura sem detalhamento = "a detalhar". Parcelado mostra "Pago 2/5".
export function statusLancamento(t: Pick<Transacao, "id" | "data" | "descricao" | "parcela_atual" | "parcela_total">, hoje = new Date().toISOString().slice(0, 10)): StatusLanc {
  if (t.id < 0) return { key: "detalhar", label: "A detalhar" }
  const p = infoParcela(t)
  const suf = p ? ` ${p.atual}/${p.total}` : ""
  if (t.data > hoje) return { key: "pendente", label: `Pendente${suf}` }
  return { key: "pago", label: `Pago${suf}` }
}
