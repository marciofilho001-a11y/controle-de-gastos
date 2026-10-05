import { useMemo, useState } from "react"
import { logoDoLancamento } from "@/lib/marcas"
import { motion, AnimatePresence } from "motion/react"
import { LayoutGrid, ReceiptText, Inbox, Layers, CheckCircle2, Clock, FileText } from "lucide-react"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { RowActions } from "@/components/row-actions"
import { LogoAvatar } from "@/components/logo-avatar"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtData, fmtMesCurto } from "@/lib/format"
import { statusLancamento } from "@/lib/parcelas"
import type { LinhaExibicao } from "@/lib/selectors"
import type { Cartao } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const EASE_OUT = [0.23, 1, 0.32, 1] as const

type Acoes = {
  onEdit?: (t: LinhaExibicao) => void
  onDuplicar?: (t: LinhaExibicao) => void
  onDelete?: (t: LinhaExibicao) => void
}

// Bloco "Categorias + Lançamentos" do Relatório: lateral com as categorias do mês
// (valor, % do total, barra) e tabela de lançamentos filtrável por categoria e status.
export function CategoriasLancamentos({
  lancamentos,
  cartoes,
  descricaoIcones,
  onEdit,
  onDuplicar,
  onDelete,
}: {
  lancamentos: LinhaExibicao[]
  cartoes: Cartao[]
  descricaoIcones: Record<string, string>
} & Acoes) {
  const acoes: Acoes = { onEdit, onDuplicar, onDelete }
  const [cat, setCat] = useState<string | null>(null)
  const [status, setStatus] = useState<"todos" | "pago" | "pendente">("todos")
  const [ordem, setOrdem] = useState<"recentes" | "antigos" | "maior" | "menor">("recentes")
  const hoje = new Date().toISOString().slice(0, 10)

  const total = lancamentos.reduce((s, t) => s + Number(t.valor), 0)

  const categorias = useMemo(() => {
    const m = new Map<string, { valor: number; n: number }>()
    for (const t of lancamentos) {
      const k = t.categoria || "outro"
      const c = m.get(k) || { valor: 0, n: 0 }
      c.valor += Number(t.valor); c.n += 1
      m.set(k, c)
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, pct: total > 0 ? (v.valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor)
  }, [lancamentos, total])
  const maxCat = Math.max(1, ...categorias.map((c) => c.valor))

  const daCategoria = useMemo(
    () => (cat ? lancamentos.filter((t) => (t.categoria || "outro") === cat) : lancamentos),
    [lancamentos, cat]
  )
  const contagem = useMemo(() => {
    let pago = 0, pend = 0
    for (const t of daCategoria) (statusLancamento(t, hoje).key === "pendente" ? pend++ : pago++)
    return { pago, pend }
  }, [daCategoria, hoje])

  const filtrados = useMemo(() => {
    const base = status === "todos" ? daCategoria
      : daCategoria.filter((t) => (statusLancamento(t, hoje).key === "pendente") === (status === "pendente"))
    const arr = [...base]
    if (ordem === "recentes") arr.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.id - a.id))
    if (ordem === "antigos") arr.sort((a, b) => (a.data > b.data ? 1 : a.data < b.data ? -1 : a.id - b.id))
    if (ordem === "maior") arr.sort((a, b) => Number(b.valor) - Number(a.valor))
    if (ordem === "menor") arr.sort((a, b) => Number(a.valor) - Number(b.valor))
    return arr
  }, [daCategoria, status, ordem, hoje])
  const totalFiltrado = filtrados.reduce((s, t) => s + Number(t.valor), 0)

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ── Categorias ── */}
      <aside className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><LayoutGrid className="size-4" /></span>
          <h3 className="font-display text-base font-semibold">Categorias</h3>
          <button
            onClick={() => setCat(null)}
            className={cn("ml-auto text-xs font-medium transition-colors", cat ? "text-primary hover:underline" : "text-muted-foreground")}
          >
            Ver todas
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {categorias.map((c, i) => {
            const info = catInfo(c.key); const Icon = info.icon; const cor = catColor(c.key)
            const ativo = cat === c.key
            return (
              <motion.button
                key={c.key}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: Math.min(i * 0.04, 0.3), ease: EASE_OUT }}
                onClick={() => setCat(ativo ? null : c.key)}
                aria-pressed={ativo}
                className={cn(
                  "group w-full rounded-xl border bg-background/40 p-3 text-left transition-all hover:border-primary/40",
                  ativo && "border-primary/60 bg-primary/8 shadow-[0_0_0_1px_var(--primary)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg" style={{ background: `${cor}22`, color: cor }}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground">{info.l}</p>
                    <p className="tnum truncate font-display text-[15px] font-bold leading-tight">{fmtR(c.valor)}</p>
                  </div>
                  <span className="tnum text-xs font-semibold text-muted-foreground">{Math.round(c.pct)}%</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: cor }}
                    initial={{ width: 0 }} animate={{ width: `${(c.valor / maxCat) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.1 + Math.min(i * 0.04, 0.3), ease: EASE_OUT }}
                  />
                </div>
              </motion.button>
            )
          })}
          {categorias.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem despesas no mês</p>}
        </div>
      </aside>

      {/* ── Lançamentos ── */}
      <section className="min-w-0 rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><ReceiptText className="size-4" /></span>
          <h3 className="font-display text-base font-semibold">
            Lançamentos{cat && <span className="text-muted-foreground"> · {catInfo(cat).l}</span>}
          </h3>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Ordenar por</span>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="recentes">Mais recentes</SelectItem>
                  <SelectItem value="antigos">Mais antigos</SelectItem>
                  <SelectItem value="maior">Maior valor</SelectItem>
                  <SelectItem value="menor">Menor valor</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <Chip ativo={status === "todos"} onClick={() => setStatus("todos")} icon={Layers} label="Todos" n={daCategoria.length} />
          <Chip ativo={status === "pago"} onClick={() => setStatus("pago")} icon={CheckCircle2} label="Pagos" n={contagem.pago} />
          <Chip ativo={status === "pendente"} onClick={() => setStatus("pendente")} icon={Clock} label="Pendentes" n={contagem.pend} />
        </div>

        {filtrados.length === 0 ? (
          <div className="grid place-items-center gap-2 py-12 text-center">
            <Inbox className="size-7 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Nenhum lançamento com esse filtro</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="pb-2 pl-2 text-left font-semibold">Data</th>
                  <th className="pb-2 text-left font-semibold">Descrição</th>
                  <th className="hidden pb-2 text-left font-semibold md:table-cell">Categoria</th>
                  <th className="pb-2 text-right font-semibold">Valor</th>
                  <th className="pb-2 pl-3 text-left font-semibold">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtrados.map((t, i) => (
                    <Linha key={t.id} t={t} i={i} cartoes={cartoes} descricaoIcones={descricaoIcones} acoes={acoes} hoje={hoje} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-secondary text-muted-foreground"><FileText className="size-4" /></span>
          <span className="text-sm text-muted-foreground">
            {cat ? "Total da categoria" : status === "todos" ? "Total dos lançamentos" : status === "pago" ? "Total pago" : "Total pendente"}
          </span>
          <span className="tnum ml-auto font-display text-base font-bold text-success">{fmtR(totalFiltrado)}</span>
        </div>
      </section>
    </div>
  )
}

function Chip({ ativo, onClick, icon: Icon, label, n }: {
  ativo: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; n: number
}) {
  return (
    <button
      onClick={onClick} aria-pressed={ativo}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        ativo ? "border-transparent bg-primary text-primary-foreground shadow-sm" : "bg-background/40 text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" /> {label} <span className="tnum opacity-80">({n})</span>
    </button>
  )
}

const STATUS_CLS = {
  pago: "bg-success/12 text-success",
  pendente: "bg-warning/15 text-warning",
  detalhar: "bg-secondary text-muted-foreground",
} as const

function Linha({ t, i, cartoes, descricaoIcones, acoes, hoje }: {
  t: LinhaExibicao; i: number; cartoes: Cartao[]; descricaoIcones: Record<string, string>; acoes: Acoes; hoje: string
}) {
  const info = catInfo(t.categoria); const Icon = info.icon; const cor = catColor(t.categoria)
  const cartao = t.cartao_id ? cartoes.find((c) => c.id === t.cartao_id) : null
  const imagem = logoDoLancamento(t.descricao, descricaoIcones) || cartao?.logo || null
  const st = statusLancamento(t, hoje)
  const editavel = t.id > 0
  const cell = "border-b border-border/60 py-2.5 align-middle"
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2, delay: Math.min(i * 0.015, 0.2), ease: EASE_OUT }}
      className="group transition-colors hover:bg-secondary/40"
    >
      <td className={cn(cell, "pl-2 whitespace-nowrap")}>
        <p className="tnum font-medium">{fmtData(t.data)}</p>
        <p className="text-[0.7rem] text-muted-foreground">{cartao ? `Fatura ${fmtMesCurto(t.mes_ref)}` : t.obrigacao_id ? "Obrigação" : "Pix / Débito"}</p>
      </td>
      <td className={cn(cell, "pr-3")}>
        <div className="flex items-center gap-2.5">
          <LogoAvatar src={imagem} cor={cor} Icon={Icon} size={32} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{t.descricao || info.l}</p>
            <p className="truncate text-[0.7rem] text-muted-foreground">{cartao?.nome || (t.obrigacao_id ? "Obrigação fixa" : "Pix / Débito")}</p>
          </div>
        </div>
      </td>
      <td className={cn(cell, "hidden md:table-cell")}>
        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: `${cor}1f`, color: cor }}>
          {info.l}
        </span>
      </td>
      <td className={cn(cell, "tnum whitespace-nowrap text-right font-bold", t.tipo === "receita" ? "text-success" : "text-destructive")}>
        {t.tipo === "receita" ? "+" : ""}{fmtR(Number(t.valor))}
      </td>
      <td className={cn(cell, "pl-3 whitespace-nowrap")}>
        <span className={cn("tnum inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_CLS[st.key])}>{st.label}</span>
      </td>
      <td className={cn(cell, "w-8 pr-1 text-right")}>
        {editavel && (
          <RowActions
            size="sm"
            onEditar={acoes.onEdit ? () => acoes.onEdit!(t) : undefined}
            onDuplicar={acoes.onDuplicar ? () => acoes.onDuplicar!(t) : undefined}
            onExcluir={acoes.onDelete ? () => acoes.onDelete!(t) : undefined}
          />
        )}
      </td>
    </motion.tr>
  )
}
