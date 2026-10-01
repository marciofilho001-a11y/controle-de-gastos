import type { Cartao } from "@/lib/supabase"

// Datas da compra: dia local (Brasília) e em qual fatura do cartão ela cai.

const TZ = "America/Sao_Paulo"

// data local (Brasília) de um timestamp — evita o lançamento cair no dia seguinte por causa do UTC
export function dataLocal(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso))
  const g = (t: string) => p.find((x) => x.type === t)?.value
  return `${g("year")}-${g("month")}-${g("day")}`
}

type DiasCartao = Pick<Cartao, "dia_vencimento" | "dia_fechamento">

// dia `dia` do mês (0-based, aceita estouro de ano); dia 31 num mês de 30 vira o último dia do mês
function noMes(ano: number, mes0: number, dia: number): number {
  const ultimo = new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate()
  return Date.UTC(ano, mes0, Math.min(dia, ultimo))
}
const mesDe = (ms: number) => new Date(ms).toISOString().slice(0, 7)

// Dia de fechamento: o cadastrado ou, sem ele, uma estimativa (vencimento − 7 dias).
export function fechamentoDoCartao(c: DiasCartao | null | undefined): { dia: number; estimado: boolean } | null {
  if (c?.dia_fechamento) return { dia: c.dia_fechamento, estimado: false }
  if (c?.dia_vencimento) return { dia: ((c.dia_vencimento - 7 + 29) % 30) + 1, estimado: true }
  return null
}

// Em qual fatura (mês de vencimento) cai uma compra feita em `dataISO` (YYYY-MM-DD).
// Compra até o dia do fechamento entra na fatura que fecha naquele mês; depois, na seguinte.
// O vencimento é o primeiro "dia de vencimento" depois do fechamento (fecha 3 / vence 10 = mesmo mês;
// fecha 25 / vence 5 = mês seguinte). Sem fechamento cadastrado, estima fechamento = vencimento − 7 dias.
export function mesFaturaPara(cartao: DiasCartao | null, dataISO: string): string {
  const [a, m, d] = dataISO.split("-").map(Number)
  const compra = Date.UTC(a, m - 1, d)
  const venc = cartao?.dia_vencimento
  const fech = cartao?.dia_fechamento
  if (!venc && !fech) return mesDe(Date.UTC(a, m, 1))

  if (fech) {
    for (let i = 0; i <= 2; i++) {
      const fechamento = noMes(a, m - 1 + i, fech)
      if (compra > fechamento) continue
      const f = new Date(fechamento)
      const ano = f.getUTCFullYear(), mes0 = f.getUTCMonth()
      if (!venc) return mesDe(Date.UTC(ano, mes0 + 1, 1))
      let vencimento = noMes(ano, mes0, venc)
      if (vencimento <= fechamento) vencimento = noMes(ano, mes0 + 1, venc)
      return mesDe(vencimento)
    }
  }
  for (let i = 0; i <= 2; i++) {
    const vencimento = noMes(a, m - 1 + i, venc!)
    if (compra <= vencimento - 7 * 86400000) return mesDe(vencimento)
  }
  return mesDe(Date.UTC(a, m + 2, 1))
}

// Dias até o próximo fechamento (0 = fecha hoje). Null se o cartão não tem dia de fechamento nem vencimento.
export function diasParaFechar(cartao: DiasCartao | null, hojeISO: string): number | null {
  const f = fechamentoDoCartao(cartao)
  if (!f) return null
  const [a, m, d] = hojeISO.split("-").map(Number)
  const hoje = Date.UTC(a, m - 1, d)
  for (let i = 0; i <= 1; i++) {
    const fechamento = noMes(a, m - 1 + i, f.dia)
    if (fechamento >= hoje) return Math.round((fechamento - hoje) / 86400000)
  }
  return null
}
