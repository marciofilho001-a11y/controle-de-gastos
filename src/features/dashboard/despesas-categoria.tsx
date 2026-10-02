import { useState } from "react"
import { motion } from "motion/react"
import { PieChart } from "lucide-react"
import { catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { CategoryDonut, type DonutSlice } from "./category-donut"
import { Painel, LinkAcao, EASE } from "./painel"

const TOP = 5

// Donut + tabela de categorias (as 5 maiores e "Outros"; dá pra abrir todas)
export function DespesasCategoria({ slices, total, index }: { slices: DonutSlice[]; total: number; index?: number }) {
  const [todas, setTodas] = useState(false)
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const resto = slices.slice(TOP)
  const linhas: { key: string; label: string; value: number; cor: string }[] = todas || resto.length <= 1
    ? slices.map((s) => ({ key: s.catKey, label: s.label, value: s.value, cor: catColor(s.catKey) }))
    : [
        ...slices.slice(0, TOP).map((s) => ({ key: s.catKey, label: s.label, value: s.value, cor: catColor(s.catKey) })),
        { key: "__outros", label: `Outros (${resto.length})`, value: resto.reduce((a, s) => a + s.value, 0), cor: "#7b8794" },
      ]

  return (
    <Painel
      icon={PieChart} titulo="Despesas por categoria" index={index}
      acao={resto.length > 1 ? <LinkAcao onClick={() => setTodas((t) => !t)}>{todas ? "Resumir" : "Ver todas"}</LinkAcao> : undefined}
    >
      <div className="grid flex-1 items-center gap-5 sm:grid-cols-[minmax(170px,210px)_minmax(0,1fr)]">
        <CategoryDonut slices={slices} centerLabel="Despesas" centerValue={total} />
        <div className="flex flex-col">
          {linhas.map((l, i) => (
            <motion.div
              key={l.key}
              initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: i * 0.025, ease: EASE }}
              className="grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-3 border-b border-border/60 py-2 last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.cor, boxShadow: `0 0 0 3px color-mix(in srgb, ${l.cor} 18%, transparent)` }} />
                <span className="truncate">{l.label}</span>
              </span>
              <span className="tnum text-sm font-semibold">{fmtR(l.value)}</span>
              <span className="tnum text-right text-xs text-muted-foreground">{pct(l.value)}%</span>
            </motion.div>
          ))}
          {!linhas.length && <p className="py-6 text-center text-sm text-muted-foreground">Sem despesas neste mês</p>}
        </div>
      </div>
    </Painel>
  )
}
