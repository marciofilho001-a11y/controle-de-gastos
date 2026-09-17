import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Banknote, CreditCard, Link as LinkIcon, ChevronDown, Trash2, TrendingUp } from "lucide-react"
import type { Cartao } from "@/lib/supabase"
import type { LinhaExibicao } from "@/lib/selectors"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtData } from "@/lib/format"
import { cn } from "@/lib/utils"

type Grupo = {
  chave: string
  nome: string
  icon: typeof Banknote
  cor: string
  itens: LinhaExibicao[]
}

// spring crítico (apple-design): sem overshoot, response ~0.35
const SPRING = { type: "spring" as const, bounce: 0, duration: 0.38 }

export function TransacoesBlocos({
  list,
  cartoes,
  onDelete,
}: {
  list: LinhaExibicao[]
  cartoes: Cartao[]
  onDelete: (id: number) => void
}) {
  const grupos: Grupo[] = [
    { chave: "receita", nome: "Receitas", icon: TrendingUp, cor: "#22d3a5", itens: list.filter((t) => t.tipo === "receita") },
    { chave: "debito", nome: "Débito e dinheiro", icon: Banknote, cor: "#38bdf8", itens: list.filter((t) => t.tipo === "despesa" && !t.cartao_id && !t.obrigacao_id) },
    { chave: "cartao", nome: "Cartões", icon: CreditCard, cor: "#f472b6", itens: list.filter((t) => t.tipo === "despesa" && !!t.cartao_id) },
    { chave: "obrigacao", nome: "Obrigações", icon: LinkIcon, cor: "#a78bfa", itens: list.filter((t) => t.tipo === "despesa" && !!t.obrigacao_id) },
  ].filter((g) => g.itens.length > 0)
  // por padrão abre o primeiro grupo que tem itens
  const primeiroComItens = grupos.find((g) => g.itens.length)?.chave
  const [abertos, setAbertos] = useState<Set<string>>(new Set(primeiroComItens ? [primeiroComItens] : []))

  function toggle(chave: string) {
    setAbertos((prev) => {
      const next = new Set(prev)
      next.has(chave) ? next.delete(chave) : next.add(chave)
      return next
    })
  }

  function cartaoNome(id: number | null) {
    return cartoes.find((c) => c.id === id)?.nome
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {grupos.map((g) => {
        const total = g.itens.reduce((s, t) => s + Number(t.valor), 0)
        const aberto = abertos.has(g.chave)
        const Icon = g.icon
        return (
          <div
            key={g.chave}
            className={cn(
              "self-start overflow-hidden rounded-xl border bg-card transition-colors",
              aberto && "ring-1 ring-primary/20"
            )}
          >
            {/* cabeçalho clicável — feedback no press (whileTap) */}
            <motion.button
              onClick={() => toggle(g.chave)}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.1 }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${g.cor}22`, color: g.cor }}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold">{g.nome}</p>
                <p className="text-xs text-muted-foreground">{g.itens.length} lançamento(s)</p>
              </div>
              <span className="tnum text-sm font-semibold" style={{ color: g.cor }}>{fmtR(total)}</span>
              <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={SPRING} className="text-muted-foreground">
                <ChevronDown className="size-4" />
              </motion.span>
            </motion.button>

            {/* lista expansível — height animado por spring crítico */}
            <AnimatePresence initial={false}>
              {aberto && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={SPRING}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-0.5 border-t px-2 py-2">
                    {g.itens.length === 0 ? (
                      <p className="px-2 py-3 text-sm italic text-muted-foreground">Nenhum lançamento aqui</p>
                    ) : (
                      g.itens.map((t) => {
                        const info = catInfo(t.categoria)
                        const CatIcon = info.icon
                        const receita = t.tipo === "receita"
                        return (
                          <div key={t.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60">
                            <span className="tnum shrink-0 text-[0.7rem] text-muted-foreground">{fmtData(t.data)}</span>
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `${catColor(t.categoria)}1f`, color: catColor(t.categoria) }}>
                              <CatIcon className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{t.descricao || "—"}</p>
                              {t.cartao_id && <p className="truncate text-[0.7rem] text-muted-foreground">{cartaoNome(t.cartao_id)}</p>}
                            </div>
                            <span className={cn("tnum shrink-0 text-sm font-semibold", receita ? "text-success" : "text-destructive")}>
                              {receita ? "+ " : "− "}{fmtR(Number(t.valor))}
                            </span>
                            {t.id > 0 && (
                              <button
                                onClick={() => onDelete(t.id)}
                                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                aria-label="Excluir"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
