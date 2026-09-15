import { create } from "zustand"
import {
  supabase,
  type Obrigacao,
  type Transacao,
  type Cartao,
  type CartaoCompra,
  type FaturaItem,
  type Investimento,
  type SaldoConta,
  type Teto,
  type Config,
  type DescricaoIcone,
  type CategoriaIcone,
} from "@/lib/supabase"

type FinState = {
  loading: boolean
  error: string | null
  obrigacoes: Obrigacao[]
  transacoes: Transacao[]
  cartoes: Cartao[]
  compras: CartaoCompra[]
  faturaItens: FaturaItem[]
  investimentos: Investimento[]
  saldos: SaldoConta[]
  tetos: Teto[]
  config: Record<string, string>
  descricaoIcones: Record<string, string>
  categoriaIcones: Record<string, string>
  loadAll: () => Promise<void>
  saveConfig: (chave: string, valor: string) => Promise<void>
}

export const useFinData = create<FinState>((set) => ({
  loading: true,
  error: null,
  obrigacoes: [],
  transacoes: [],
  cartoes: [],
  compras: [],
  faturaItens: [],
  investimentos: [],
  saldos: [],
  tetos: [],
  config: {},
  descricaoIcones: {},
  categoriaIcones: {},
  saveConfig: async (chave, valor) => {
    await supabase.from("fin_config").upsert({ chave, valor: String(valor) }, { onConflict: "chave" })
    set((st) => ({ config: { ...st.config, [chave]: String(valor) } }))
  },
  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [obr, tx, cart, comp, fat, inv, sal, tet, cfg, dic, cic] = await Promise.all([
        supabase.from("fin_obrigacoes").select("*").order("dia_vencimento"),
        supabase.from("fin_transacoes").select("*").order("data", { ascending: false }),
        supabase.from("fin_cartoes").select("*").order("nome"),
        supabase.from("fin_cartao_compras").select("*").order("criado_em"),
        supabase.from("fin_fatura_itens").select("*").order("criado_em"),
        supabase.from("fin_investimentos").select("*").order("data", { ascending: false }),
        supabase.from("fin_saldo_conta").select("*"),
        supabase.from("fin_tetos").select("*"),
        supabase.from("fin_config").select("*"),
        supabase.from("fin_descricao_icones").select("*"),
        supabase.from("fin_categoria_icones").select("*"),
      ])

      const firstError =
        obr.error || tx.error || cart.error || comp.error || fat.error ||
        inv.error || sal.error || tet.error || cfg.error || dic.error || cic.error
      if (firstError) throw firstError

      const config: Record<string, string> = {}
      for (const c of (cfg.data as Config[]) || []) {
        if (c.chave) config[c.chave] = c.valor ?? ""
      }
      const descricaoIcones: Record<string, string> = {}
      for (const d of (dic.data as DescricaoIcone[]) || []) {
        if (d.descricao_norm) descricaoIcones[d.descricao_norm] = d.imagem
      }
      const categoriaIcones: Record<string, string> = {}
      for (const c of (cic.data as CategoriaIcone[]) || []) {
        if (c.categoria) categoriaIcones[c.categoria] = c.imagem
      }

      set({
        loading: false,
        obrigacoes: (obr.data as Obrigacao[]) || [],
        transacoes: (tx.data as Transacao[]) || [],
        cartoes: (cart.data as Cartao[]) || [],
        compras: (comp.data as CartaoCompra[]) || [],
        faturaItens: (fat.data as FaturaItem[]) || [],
        investimentos: (inv.data as Investimento[]) || [],
        saldos: (sal.data as SaldoConta[]) || [],
        tetos: (tet.data as Teto[]) || [],
        config,
        descricaoIcones,
        categoriaIcones,
      })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Erro ao carregar dados" })
    }
  },
}))
