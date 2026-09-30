import type { Cartao } from "@/lib/supabase"

// Datas da compra: dia local (Brasília) e em qual fatura do cartão ela cai.

const TZ = "America/Sao_Paulo"

// data local (Brasília) de um timestamp — evita o lançamento cair no dia seguinte por causa do UTC
export function dataLocal(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso))
  const g = (t: string) => p.find((x) => x.type === t)?.value
  return `${g("year")}-${g("month")}-${g("day")}`
}

// Em qual fatura (mês de vencimento) cai uma compra feita em `dataISO` (YYYY-MM-DD).
// Sem o dia de fechamento cadastrado, estima fechamento = vencimento − 7 dias.
export function mesFaturaPara(cartao: Pick<Cartao, "dia_vencimento"> | null, dataISO: string): string {
  const [a, m, d] = dataISO.split("-").map(Number)
  const compra = Date.UTC(a, m - 1, d)
  const venc = cartao?.dia_vencimento
  if (!venc) return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7)
  for (let i = 0; i <= 2; i++) {
    const vencimento = Date.UTC(a, m - 1 + i, Math.min(venc, 28))
    const fechamento = vencimento - 7 * 86400000
    if (compra <= fechamento) return new Date(vencimento).toISOString().slice(0, 7)
  }
  return new Date(Date.UTC(a, m + 2, 1)).toISOString().slice(0, 7)
}
