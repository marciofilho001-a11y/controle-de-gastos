import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Transacao } from "@/lib/supabase"
import { addMonths } from "@/lib/format"

// ---------------------------------------------------------------------------
// Salário fixo: o mesmo salário aparece em todos os meses (do atual até 12 meses à frente),
// como receita de verdade. Mudar um mês à mão vale só pra ele; apagar um mês não volta.
// Mudar o valor fixo atualiza os meses daqui pra frente que ainda estão no padrão.
// ---------------------------------------------------------------------------

export type SalarioBase = {
  ativo: boolean
  valor: number
  dia: number
  descricao: string
  desde: string          // primeiro mês (yyyy-mm)
  ate?: string           // último mês já gerado (não gera de novo o que você apagou)
}

const CHAVE = "salario_base"
const ORIGEM = "salario_base"
const MESES_A_FRENTE = 11

export const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function lerSalarioBase(config: Record<string, string>): SalarioBase | null {
  try {
    const b = JSON.parse(config[CHAVE] || "null")
    return b && typeof b.valor === "number" ? b : null
  } catch {
    return null
  }
}

function dataNoMes(mes: string, dia: number): string {
  const [a, m] = mes.split("-").map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return `${mes}-${String(Math.min(Math.max(1, dia), ultimo)).padStart(2, "0")}`
}

const ehSalario = (t: Transacao, mes: string) => t.tipo === "receita" && t.categoria === "salario" && t.mes_ref === mes

async function salvarConfig(b: SalarioBase) {
  await useFinData.getState().saveConfig(CHAVE, JSON.stringify(b))
}

// cria o salário dos meses que ainda não têm (sem repetir o que você apagou)
export async function sincronizarSalarioBase(): Promise<number> {
  const st = useFinData.getState()
  const b = lerSalarioBase(st.config)
  if (!b?.ativo) return 0
  const fim = addMonths(mesAtual(), MESES_A_FRENTE)
  let m = b.ate ? addMonths(b.ate, 1) : b.desde
  if (m < b.desde) m = b.desde
  const linhas: Partial<Transacao>[] = []
  for (; m <= fim; m = addMonths(m, 1)) {
    if (st.transacoes.some((t) => ehSalario(t, m))) continue
    linhas.push({
      tipo: "receita", descricao: b.descricao, valor: b.valor, categoria: "salario",
      data: dataNoMes(m, b.dia), mes_ref: m, origem: ORIGEM,
    })
  }
  if (linhas.length) {
    const { error } = await supabase.from("fin_transacoes").insert(linhas)
    if (error) throw error
  }
  if (b.ate !== fim) await salvarConfig({ ...b, ate: fim })
  return linhas.length
}

// liga ou muda o salário fixo; os meses daqui pra frente que estão no padrão acompanham
export async function salvarSalarioBase(novo: { valor: number; dia: number; descricao: string }): Promise<number> {
  const st = useFinData.getState()
  const atual = lerSalarioBase(st.config)
  const hoje = mesAtual()
  const futuros = st.transacoes.filter((t) => t.origem === ORIGEM && t.mes_ref >= hoje)
  for (const t of futuros) {
    const { error } = await supabase.from("fin_transacoes").update({
      valor: novo.valor, descricao: novo.descricao, data: dataNoMes(t.mes_ref, novo.dia),
    }).eq("id", t.id)
    if (error) throw error
  }
  const desde = atual?.ativo ? atual.desde : hoje
  await salvarConfig({ ativo: true, ...novo, desde, ate: atual?.ativo ? atual.ate : undefined })
  await useFinData.getState().loadAll()
  const criados = await sincronizarSalarioBase()
  await useFinData.getState().loadAll()
  return criados + futuros.length
}

// para de repetir: tira o salário fixo dos meses seguintes (o mês atual e o passado ficam)
export async function desligarSalarioBase(): Promise<void> {
  const st = useFinData.getState()
  const atual = lerSalarioBase(st.config)
  if (!atual) return
  const { error } = await supabase.from("fin_transacoes").delete().eq("origem", ORIGEM).gt("mes_ref", mesAtual())
  if (error) throw error
  await salvarConfig({ ...atual, ativo: false, ate: undefined })
  await useFinData.getState().loadAll()
}
