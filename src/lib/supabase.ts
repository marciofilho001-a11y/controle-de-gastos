import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)

// ---- Tipos das tabelas fin_* (introspectados do schema real) ----

export type Obrigacao = {
  id: number
  nome: string
  valor: number
  categoria: string | null
  dia_vencimento: number | null
  data_inicio: string
  parcela_total: number | null
  ativa: boolean | null
  criado_em: string | null
}

export type Transacao = {
  id: number
  tipo: "receita" | "despesa"
  descricao: string | null
  valor: number
  categoria: string | null
  data: string
  mes_ref: string
  obrigacao_id: number | null
  cartao_id: number | null
  compra_id: number | null
  parcela_atual: number | null
  parcela_total: number | null
  criado_em: string | null
}

export type Cartao = {
  id: number
  nome: string
  dia_vencimento: number | null
  limite: number | null
  ativo: boolean | null
  logo: string | null
  criado_em: string | null
}

export type CartaoCompra = {
  id: number
  cartao_id: number
  descricao: string | null
  categoria: string | null
  valor_parcela: number
  parcela_total: number
  data_inicio: string
  criado_em: string | null
}

export type FaturaItem = {
  id: number
  cartao_id: number
  mes_ref: string
  descricao: string
  valor: number
  categoria: string
  data_compra: string | null
  parcela_atual: number | null
  parcela_total: number | null
  criado_em: string
}

export type Investimento = {
  id: number
  mes_ref: string
  valor: number
  descricao: string | null
  data: string
  criado_em: string | null
}

export type SaldoConta = {
  id: number
  mes_ref: string
  saldo: number
  atualizado_em: string
}

export type Teto = {
  id: number
  mes_ref: string
  escopo: string
  cartao_id: number | null
  categoria: string | null
  valor: number
  atualizado_em: string
}

export type Config = {
  id: number
  chave: string
  valor: string | null
}
