import { useMemo, useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { motion, AnimatePresence } from "motion/react"
import { Banknote, CreditCard, ChevronRight } from "lucide-react"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { linhasDoMetodo, breakdownPorCategoria } from "@/lib/selectors"
import type { Transacao, Cartao } from "@/lib/supabase"
import { cn } from "@/lib/utils"

type MetodoId = "debito" | `cartao-${number}`

const EASE_OUT = [0.23, 1, 0.32, 1] as const

export function FormaPagamentoBreakdown({
  transacoes,
  cartoes,
  mesRef,
}: {
  transacoes: Transacao[]
  cartoes: Cartao[]
  mesRef: string
}) {
  // monta os métodos: débito + cada cartão ativo, com seu total
  const metodos = useMemo(() => {
    const debitoLinhas = linhasDoMetodo(transacoes, mesRef, "debito")
    const debTotal = debitoLinhas.reduce((s, t) => s + Number(t.valor), 0)
    const lista = [
      {
        id: "debito" as MetodoId, nome: "Pix / Débito", logo: null as string | null,
        cor: "#22d3a5", total: debTotal, linhas: debitoLinhas,
      },
      ...cartoes
        .filter((c) => c.ativo !== false)
        .map((c) => {
          const linhas = linhasDoMetodo(transacoes, mesRef, { cartaoId: c.id })
          return {
            id: `cartao-${c.id}` as MetodoId, nome: c.nome, logo: c.logo,
            cor: "#f472b6", total: linhas.reduce((s, t) => s + Number(t.valor), 0), linhas,
          }
        }),
    ].filter((m) => m.total > 0)
    return lista
  }, [transacoes, cartoes, mesRef])

  const [selId, setSelId] = useState<MetodoId | null>(metodos[0]?.id ?? null)
  const sel = metodos.find((m) => m.id === selId) ?? metodos[0]
  const maxTotal = Math.max(1, ...metodos.map((m) => m.total))

  const breakdown = useMemo(() => {
    if (!sel) return []
    return breakdownPorCategoria(sel.linhas).map((b) => ({
      ...b, label: catInfo(b.catKey).l,
    }))
  }, [sel])

  if (!metodos.length) {
    return <div className="grid h-32 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">Sem gastos neste mês</div>
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
      {/* coluna de métodos */}
      <div className="flex flex-col gap-2">
        {metodos.map((m, i) => {
          const ativo = m.id === sel?.id
          const pct = Math.round((m.total / maxTotal) * 100)
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: i * 0.04, ease: EASE_OUT }}
              whileTap={{ scale: 0.985 }}
              onClick={() => setSelId(m.id)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                ativo ? "border-primary/40 bg-primary/8 ring-1 ring-primary/15" : "hover:bg-secondary/60"
              )}
            >
              <span className={cn(
                "grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl",
                m.logo ? "bg-muted ring-1 ring-border" : ""
              )} style={m.logo ? {} : { background: `${m.cor}22`, color: m.cor }}>
                {m.logo ? <img src={m.logo} alt="" className="size-full object-contain p-1" /> :
                  m.id === "debito" ? <Banknote className="size-5" /> : <CreditCard className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-semibold", ativo && "text-primary")}>{m.nome}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: ativo ? "var(--primary)" : "var(--muted-foreground)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.04 + 0.1, ease: EASE_OUT }}
                  />
                </div>
              </div>
              <span className="tnum shrink-0 text-sm font-semibold">{fmtR(m.total)}</span>
              <ChevronRight className={cn("size-4 shrink-0 transition-colors", ativo ? "text-primary" : "text-muted-foreground")} />
            </motion.button>
          )
        })}
      </div>

      {/* painel de detalhe do método selecionado */}
      <div className="rounded-xl border bg-card p-5">
        <AnimatePresence mode="wait">
          {sel && (
            <motion.div
              key={sel.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className={cn("grid size-9 place-items-center overflow-hidden rounded-lg",
                  sel.logo ? "bg-muted ring-1 ring-border" : "")} style={sel.logo ? {} : { background: `${sel.cor}22`, color: sel.cor }}>
                  {sel.logo ? <img src={sel.logo} alt="" className="size-full object-contain p-1" /> :
                    sel.id === "debito" ? <Banknote className="size-[1.05rem]" /> : <CreditCard className="size-[1.05rem]" />}
                </span>
                <div>
                  <p className="font-display text-[15px] font-semibold">{sel.nome}</p>
                  <p className="text-xs text-muted-foreground">Gastos por categoria</p>
                </div>
                <span className="tnum ml-auto text-lg font-semibold">{fmtR(sel.total)}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(180px,240px)_1fr] sm:items-center">
                {/* donut */}
                <div className="relative h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdown} dataKey="valor" nameKey="label"
                        cx="50%" cy="50%" innerRadius="62%" outerRadius="88%"
                        paddingAngle={2} stroke="var(--card)" strokeWidth={2}
                        animationDuration={400}
                      >
                        {breakdown.map((b) => <Cell key={b.catKey} fill={catColor(b.catKey)} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0]
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                            <p className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.payload.fill }} /><span className="font-medium">{p.payload.label}</span></p>
                            <p className="tnum mt-0.5 text-muted-foreground">{fmtR(p.value)}</p>
                          </div>
                        )
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="text-[0.7rem] text-muted-foreground">categorias</p>
                      <p className="tnum text-sm font-semibold">{breakdown.length}</p>
                    </div>
                  </div>
                </div>

                {/* legenda / lista de categorias (valores precisos — fallback de a11y) */}
                <div className="flex flex-col gap-1">
                  {breakdown.map((b, i) => {
                    const info = catInfo(b.catKey)
                    const Icon = info.icon
                    const pct = sel.total > 0 ? Math.round((b.valor / sel.total) * 100) : 0
                    return (
                      <motion.div
                        key={b.catKey}
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.24, delay: i * 0.03, ease: EASE_OUT }}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `${catColor(b.catKey)}1f`, color: catColor(b.catKey) }}>
                          <Icon className="size-3.5" />
                        </span>
                        <span className="flex-1 truncate text-sm">{info.l}</span>
                        <span className="tnum text-sm font-medium">{fmtR(b.valor)}</span>
                        <span className="tnum w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
