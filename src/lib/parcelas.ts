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

const SUFIXO = /\s*\(\d+\s*\/\s*\d+\)\s*$/
export function baseDescricao(d: string | null | undefined): string {
  return (d || "").replace(SUFIXO, "").trim()
}
function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()
}
function mesMais(mesRef: string, n: number): string {
  const [a, m] = mesRef.split("-").map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

// As outras parcelas da mesma compra: mesmo vínculo de compra, ou — sem vínculo —
// mesmo cartão, mesma descrição base, mesmo total de parcelas e mês coerente com o número da parcela.
export function parcelasIrmas(t: Transacao, todas: Transacao[]): Transacao[] {
  const p = infoParcela(t)
  if (!p) return []
  const base = norm(baseDescricao(t.descricao))
  const candidatas = todas.filter((o) => {
    if (o.id === t.id || o.tipo !== t.tipo) return false
    const q = infoParcela(o)
    if (!q || q.total !== p.total || q.atual === p.atual) return false
    if (t.compra_id && o.compra_id) return o.compra_id === t.compra_id
    if ((o.cartao_id ?? null) !== (t.cartao_id ?? null)) return false
    if (norm(baseDescricao(o.descricao)) !== base) return false
    return o.mes_ref === mesMais(t.mes_ref, q.atual - p.atual)
  })
  // duas compras iguais no mesmo cartão (ex.: dois jogos parcelados em 3x): fica, pra cada
  // número de parcela, a que mais se parece com esta — mesma compra, mesmo lote, mesmo valor
  const nota = (o: Transacao) =>
    (t.compra_id && o.compra_id === t.compra_id ? 8 : 0) +
    (!t.compra_id && !o.compra_id ? 4 : 0) +
    (o.criado_em && o.criado_em === t.criado_em ? 2 : 0) +
    (Number(o.valor) === Number(t.valor) ? 1 : 0)
  const porNumero = new Map<number, Transacao>()
  for (const o of candidatas) {
    const n = infoParcela(o)!.atual
    const atual = porNumero.get(n)
    if (!atual || nota(o) > nota(atual)) porNumero.set(n, o)
  }
  return [...porNumero.values()].sort((a, b) => a.mes_ref.localeCompare(b.mes_ref))
}

// Descrição de uma parcela irmã com o novo nome, mantendo o "(k/n)" se ela usava esse formato
export function descricaoIrma(novaBase: string, irma: Transacao): string {
  const m = (irma.descricao || "").match(/\((\d+)\s*\/\s*(\d+)\)\s*$/)
  return m ? `${novaBase} (${m[1]}/${m[2]})` : novaBase
}
