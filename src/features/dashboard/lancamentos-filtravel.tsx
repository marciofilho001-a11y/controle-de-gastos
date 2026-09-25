import { useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import {
  LayoutGrid, GalleryHorizontal, ChevronLeft, ChevronRight, Inbox,
} from "lucide-react"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { catInfo, catColor, DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"
import { fmtR, fmtData } from "@/lib/format"
import type { LinhaExibicao } from "@/lib/selectors"
import type { Cartao } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { RowActions } from "@/components/row-actions"

const EASE_OUT = [0.23, 1, 0.32, 1] as const

type Acoes = {
  onEdit?: (t: LinhaExibicao) => void
  onDuplicar?: (t: LinhaExibicao) => void
  onDelete?: (t: LinhaExibicao) => void
}

export function LancamentosFiltravel({
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
  const [modo, setModo] = useState<"carrossel" | "grade">("carrossel")
  const [filtroCartao, setFiltroCartao] = useState("todos")
  const [filtroCat, setFiltroCat] = useState("todas")
  const scrollRef = useRef<HTMLDivElement>(null)

  // categorias presentes nos lançamentos (pra popular o filtro só com o que existe)
  const catsPresentes = useMemo(() => {
    const set = new Set(lancamentos.map((l) => l.categoria || "outro"))
    const todas = [...DESPESA_CATS, ...RECEITA_CATS].filter((c, i, arr) => arr.findIndex((x) => x.v === c.v) === i)
    return todas.filter((c) => set.has(c.v))
  }, [lancamentos])

  const filtrados = useMemo(() => {
    let l = lancamentos
    if (filtroCartao === "debito") l = l.filter((t) => !t.cartao_id)
    else if (filtroCartao !== "todos") l = l.filter((t) => t.cartao_id === parseInt(filtroCartao))
    if (filtroCat !== "todas") l = l.filter((t) => (t.categoria || "outro") === filtroCat)
    return l
  }, [lancamentos, filtroCartao, filtroCat])

  function scroll(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" })
  }

  const cartoesAtivos = cartoes.filter((c) => c.ativo !== false)

  return (
    <div className="rounded-xl border bg-card p-5">
      {/* header + filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="font-display text-lg font-semibold">Lançamentos</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{filtrados.length}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* filtro cartão (engloba débito + cartões) */}
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todos">Todo pagamento</SelectItem>
                <SelectItem value="debito">Pix / Débito</SelectItem>
                {cartoesAtivos.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* filtro categoria */}
          <Select value={filtroCat} onValueChange={setFiltroCat}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todas">Toda categoria</SelectItem>
                {catsPresentes.map((c) => (
                  <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* toggle grade/carrossel */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-secondary/50 p-0.5">
            <button
              onClick={() => setModo("carrossel")}
              className={cn("grid size-8 place-items-center rounded-md transition-colors",
                modo === "carrossel" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              aria-label="Carrossel" aria-pressed={modo === "carrossel"}
            >
              <GalleryHorizontal className="size-4" />
            </button>
            <button
              onClick={() => setModo("grade")}
              className={cn("grid size-8 place-items-center rounded-md transition-colors",
                modo === "grade" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              aria-label="Grade" aria-pressed={modo === "grade"}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <Inbox className="size-7 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Nenhum lançamento com esse filtro</p>
        </div>
      ) : modo === "carrossel" ? (
        <div className="relative">
          <div
            ref={scrollRef}
            className="scrollbar-none flex gap-3 overflow-x-auto scroll-smooth pb-1"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {filtrados.map((t, i) => (
              <LancCard key={t.id} t={t} cartoes={cartoes} descricaoIcones={descricaoIcones} index={i} snap acoes={acoes} />
            ))}
          </div>
          {/* setas de navegação */}
          <button onClick={() => scroll(-1)} className="absolute -left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border bg-card shadow-md transition-colors hover:bg-secondary" aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => scroll(1)} className="absolute -right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border bg-card shadow-md transition-colors hover:bg-secondary" aria-label="Próximo">
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((t, i) => (
            <LancCard key={t.id} t={t} cartoes={cartoes} descricaoIcones={descricaoIcones} index={i} acoes={acoes} />
          ))}
        </div>
      )}
    </div>
  )
}

function LancCard({
  t, cartoes, descricaoIcones, index, snap, acoes,
}: {
  t: LinhaExibicao
  cartoes: Cartao[]
  descricaoIcones: Record<string, string>
  index: number
  snap?: boolean
  acoes: Acoes
}) {
  const editavel = t.id > 0
  const info = catInfo(t.categoria)
  const Icon = info.icon
  const cor = catColor(t.categoria)
  const receita = t.tipo === "receita"
  const cartaoTx = t.cartao_id ? cartoes.find((c) => c.id === t.cartao_id) : null
  const iconeCustom = descricaoIcones[(t.descricao || "").trim().toLowerCase()]
  const imagem = iconeCustom || cartaoTx?.logo || null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.03, 0.3), ease: EASE_OUT }}
      className={cn(
        "flex shrink-0 flex-col gap-2.5 rounded-xl border bg-background/40 p-3.5",
        snap && "w-[220px]"
      )}
      style={snap ? { scrollSnapAlign: "start" } : undefined}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg"
          style={imagem ? { background: "var(--muted)" } : { background: `${cor}1f`, color: cor }}
        >
          {imagem ? <img src={imagem} alt="" className="size-full object-contain p-0.5" /> : <Icon className="size-4.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t.descricao || info.l}</p>
          <p className="truncate text-xs" style={{ color: cor }}>
            {info.l}{cartaoTx && <span className="text-muted-foreground"> · {cartaoTx.nome}</span>}
          </p>
        </div>
        {editavel && (
          <RowActions
            size="sm"
            className="-mr-1.5 -mt-1"
            onEditar={acoes.onEdit ? () => acoes.onEdit!(t) : undefined}
            onDuplicar={acoes.onDuplicar ? () => acoes.onDuplicar!(t) : undefined}
            onExcluir={acoes.onDelete ? () => acoes.onDelete!(t) : undefined}
          />
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[0.7rem] text-muted-foreground">{fmtData(t.data)}</span>
        <span className={cn("tnum text-sm font-bold", receita ? "text-success" : "text-destructive")}>
          {receita ? "+ " : "− "}{fmtR(Number(t.valor))}
        </span>
      </div>
    </motion.div>
  )
}
