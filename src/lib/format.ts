// Formatação de moeda BRL
export function fmtR(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0)
}

// mes_ref é sempre 'YYYY-MM'
export function mesRefAtual(): string {
  return new Date().toISOString().slice(0, 7)
}

export function addMonths(mesRef: string, n: number): string {
  const [a, m] = mesRef.split("-").map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return d.toISOString().slice(0, 7)
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

// 'Set/2026'
export function fmtMesRef(mesRef: string): string {
  const [a, m] = mesRef.split("-").map(Number)
  return `${MESES_ABREV[m - 1]}/${a}`
}

// 'Setembro 2026'
export function fmtMesLongo(mesRef: string): string {
  const [a, m] = mesRef.split("-").map(Number)
  return `${MESES_LONGO[m - 1]} ${a}`
}

// 'Set/26'
export function fmtMesCurto(mesRef: string): string {
  const [a, m] = mesRef.split("-").map(Number)
  return `${MESES_ABREV[m - 1]}/${String(a).slice(2)}`
}

// data 'YYYY-MM-DD' -> 'DD/MM/YYYY'
export function fmtData(data: string): string {
  const [a, m, d] = data.split("-")
  return `${d}/${m}/${a}`
}

export function proximosMeses(qtd: number, apartirDe: string): string[] {
  const out: string[] = []
  for (let i = 0; i < qtd; i++) out.push(addMonths(apartirDe, i))
  return out
}
