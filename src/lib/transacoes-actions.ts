import { toast } from "sonner"
import { supabase, type Transacao } from "@/lib/supabase"
import { useFinData } from "@/hooks/use-fin-data"

// Ações comuns a qualquer lista de lançamentos (Transações, Dashboard, Fatura...)

export async function excluirTransacao(id: number) {
  const { error } = await supabase.from("fin_transacoes").delete().eq("id", id)
  if (error) throw error
}

// Copia o lançamento pro mês de destino, mantendo o dia do mês quando possível.
// Vínculos (obrigação, compra, parcela) NÃO são copiados — a cópia é um lançamento solto.
export async function duplicarTransacao(t: Transacao, mesRefDestino: string) {
  const dia = Number((t.data || "").slice(8, 10)) || 1
  const [ano, mes] = mesRefDestino.split("-").map(Number)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const data = `${mesRefDestino}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`
  const { error } = await supabase.from("fin_transacoes").insert({
    tipo: t.tipo,
    descricao: t.descricao,
    valor: Number(t.valor),
    categoria: t.categoria,
    data,
    mes_ref: mesRefDestino,
    cartao_id: t.cartao_id,
  })
  if (error) throw error
}

// Linha virtual ("Faturas a detalhar") não é editável nem excluível
export function ehEditavel(t: { id: number }): boolean {
  return t.id > 0
}

// Excluir com "Desfazer" (sem diálogo de confirmação): some da tela na hora,
// o aviso dá 5 s pra voltar atrás e só então apaga de verdade no banco.
export function excluirComDesfazer(t: { id: number; descricao?: string | null }) {
  const st = useFinData.getState()
  const antes = st.transacoes
  useFinData.setState({ transacoes: antes.filter((x) => x.id !== t.id) })
  let desfeito = false
  const timer = window.setTimeout(async () => {
    if (desfeito) return
    try {
      await excluirTransacao(t.id)
      await useFinData.getState().loadAll()
    } catch (e) {
      useFinData.setState({ transacoes: antes })
      toast.error("Não foi possível remover", { description: e instanceof Error ? e.message : "" })
    }
  }, 5000)
  toast(`"${t.descricao || "Lançamento"}" removido`, {
    duration: 5000,
    action: {
      label: "Desfazer",
      onClick: () => {
        desfeito = true
        window.clearTimeout(timer)
        useFinData.setState({ transacoes: antes })
      },
    },
  })
}
