import { useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  LayoutGrid, List, Inbox, TrendingUp, Calendar, ArrowUp, ArrowDown, Layers,
} from "lucide-react"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { RowActions } from "@/components/row-actions"
import { catInfo, catColor, DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"
import { fmtR, fmtData } from "@/lib/format"
import type { LinhaExibicao } from "@/lib/selectors"
import type { Cartao } from "@/lib/supabase"
import { cn } from "@/lib/utils"

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
  const [modo, setModo] = useState<"grade" | "lista">("grade")
  const [filtroCartao, setFiltroCartao] = useState("todos")
  const [filtroCat, setFiltroCat] = useState("todas")

  // base após o filtro de pagamento — é sobre ela que os chips contam
  const porPagamento = useMemo(() => {
    if (filtroCartao === "debito") return lancamentos.filter((t) => !t.cartao_id)
    if (filtroCartao !== "todos") return lancamentos.filter((t) => t.cartao_id === parseInt(filtroCartao))
    return lancamentos
  }, [lancamentos, filtroCartao])

  // chips: categorias presentes + contagem, ordenadas por quantidade
  const chips = useMemo(() => {
    const cont = new Map<string, number>()
    for (const t of porPagamento) {
      const k = t.categoria || "outro"
      cont.set(k, (cont.get(k) || 0) + 1)
    }
    const todas = [...DESPESA_CATS, ...RECEITA_CATS].filter((c, i, arr) => arr.findIndex((x) => x.v === c.v) === i)
    return todas
      .filter((c) => cont.has(c.v))
      .map((c) => ({ ...c, n: cont.get(c.v)! }))
      .sort((a, b) => b.n - a.n)
  }, [porPagamento])

  const filtrados = useMemo(
    () => (filtroCat === "todas" ? porPagamento : porPagamento.filter((t) => (t.categoria || "outro") === filtroCat)),
    [porPagamento, filtroCat]
  )

  const cartoesAtivos = cartoes.filter((c) => c.ativo !== false)

  return (
    <div className="rounded-xl border bg-card p-5">
      {/* cabeçalho */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
          <TrendingUp className="size-4.5" />
        </span>
        <div className="flex items-center gap-2.5">
          <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">Lançamentos</h3>
          <span className="tnum rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">{filtrados.length}</span>
        </div>
        <p className="hidden text-sm text-muted-foreground md:block">Tudo que entrou e saiu no mês</p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={filtroCartao} onValueChange={(v) => { setFiltroCartao(v); setFiltroCat("todas") }}>
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
          <Select value={filtroCat} onValueChange={setFiltroCat}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todas">Toda categoria</SelectItem>
                {chips.map((c) => (
                  <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-0.5 rounded-lg border bg-secondary/50 p-0.5">
            <ToggleBtn ativo={modo === "grade"} onClick={() => setModo("grade")} label="Grade"><LayoutGrid className="size-4" /></ToggleBtn>
            <ToggleBtn ativo={modo === "lista"} onClick={() => setModo("lista")} label="Lista"><List className="size-4" /></ToggleBtn>
          </div>
        </div>
      </div>

      {/* chips de categoria com contagem */}
      <div className="scrollbar-none -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip ativo={filtroCat === "todas"} onClick={() => setFiltroCat("todas")} icon={Layers} label="Todos" n={porPagamento.length} />
        {chips.map((c) => (
          <Chip
            key={c.v}
            ativo={filtroCat === c.v}
            onClick={() => setFiltroCat(filtroCat === c.v ? "todas" : c.v)}
            icon={c.icon}
            label={c.l}
            n={c.n}
            cor={catColor(c.v)}
          />
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <Inbox className="size-7 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Nenhum lançamento com esse filtro</p>
        </div>
      ) : modo === "grade" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((t, i) => (
            <LancCard key={t.id} t={t} cartoes={cartoes} descricaoIcones={descricaoIcones} index={i} acoes={acoes} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtrados.map((t, i) => (
            <LancRow key={t.id} t={t} cartoes={cartoes} descricaoIcones={descricaoIcones} index={i} acoes={acoes} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToggleBtn({ ativo, onClick, label, children }: { ativo: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label} aria-pressed={ativo}
      className={cn("grid size-8 place-items-center rounded-md transition-colors",
        ativo ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
    >
      {children}
    </button>
  )
}

function Chip({
  ativo, onClick, icon: Icon, label, n, cor,
}: {
  ativo: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; n: number; cor?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        ativo ? "border-primary/50 bg-primary/15 text-primary" : "bg-background/40 text-foreground hover:bg-secondary"
      )}
    >
      <Icon className="size-4" style={!ativo && cor ? { color: cor } : undefined} />
      {label}
      <span className={cn("tnum rounded-full px-1.5 py-px text-[0.7rem] font-semibold",
        ativo ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
        {n}
      </span>
    </button>
  )
}

// ---- helpers visuais compartilhados por card e linha ----------------------
function useVisual(t: LinhaExibicao, cartoes: Cartao[], descricaoIcones: Record<string, string>) {
  const info = catInfo(t.categoria)
  const cor = catColor(t.categoria)
  const receita = t.tipo === "receita"
  const cartaoTx = t.cartao_id ? cartoes.find((c) => c.id === t.cartao_id) : null
  const iconeCustom = descricaoIcones[(t.descricao || "").trim().toLowerCase()]
  const imagem = iconeCustom || cartaoTx?.logo || null
  return { info, cor, receita, cartaoTx, imagem }
}

function Avatar({ imagem, cor, Icon, size = 40 }: { imagem: string | null; cor: string; Icon: React.ComponentType<{ className?: string }>; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-border"
      style={{ width: size, height: size, background: imagem ? "var(--background)" : `${cor}1f`, color: cor }}
    >
      {imagem ? <img src={imagem} alt="" className="size-full object-contain p-1.5" /> : <Icon className="size-[45%]" />}
    </span>
  )
}

function ValorPill({ receita, valor }: { receita: boolean; valor: number }) {
  return (
    <span className={cn(
      "tnum flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-bold",
      receita ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
    )}>
      {receita ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {fmtR(valor)}
    </span>
  )
}

function LancCard({
  t, cartoes, descricaoIcones, index, acoes,
}: {
  t: LinhaExibicao; cartoes: Cartao[]; descricaoIcones: Record<string, string>; index: number; acoes: Acoes
}) {
  const { info, cor, receita, cartaoTx, imagem } = useVisual(t, cartoes, descricaoIcones)
  const Icon = info.icon
  const editavel = t.id > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.03, 0.3), ease: EASE_OUT }}
      className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-background/40 p-3.5 pl-4 transition-colors hover:border-primary/30"
    >
      {/* barra de acento à esquerda, na cor da categoria */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />

      <div className="flex items-start gap-3">
        <Avatar imagem={imagem} cor={cor} Icon={Icon} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold leading-tight">{t.descricao || info.l}</p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium" style={{ color: cor }}>
            <Icon className="size-3.5 shrink-0" />
            {info.l}
            {cartaoTx && <span className="truncate text-muted-foreground">· {cartaoTx.nome}</span>}
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

      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" /> <span className="tnum">{fmtData(t.data)}</span>
        </span>
        <ValorPill receita={receita} valor={Number(t.valor)} />
      </div>
    </motion.div>
  )
}

function LancRow({
  t, cartoes, descricaoIcones, index, acoes,
}: {
  t: LinhaExibicao; cartoes: Cartao[]; descricaoIcones: Record<string, string>; index: number; acoes: Acoes
}) {
  const { info, cor, receita, cartaoTx, imagem } = useVisual(t, cartoes, descricaoIcones)
  const Icon = info.icon
  const editavel = t.id > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.25), ease: EASE_OUT }}
      className="relative flex items-center gap-3 overflow-hidden rounded-lg border bg-background/40 py-2 pl-4 pr-2 transition-colors hover:border-primary/30"
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: cor }} aria-hidden />
      <Avatar imagem={imagem} cor={cor} Icon={Icon} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{t.descricao || info.l}</p>
        <p className="flex items-center gap-1.5 truncate text-xs" style={{ color: cor }}>
          <Icon className="size-3 shrink-0" /> {info.l}
          {cartaoTx && <span className="truncate text-muted-foreground">· {cartaoTx.nome}</span>}
        </p>
      </div>
      <span className="tnum hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <Calendar className="size-3.5" /> {fmtData(t.data)}
      </span>
      <ValorPill receita={receita} valor={Number(t.valor)} />
      {editavel && (
        <RowActions
          size="sm"
          onEditar={acoes.onEdit ? () => acoes.onEdit!(t) : undefined}
          onDuplicar={acoes.onDuplicar ? () => acoes.onDuplicar!(t) : undefined}
          onExcluir={acoes.onDelete ? () => acoes.onDelete!(t) : undefined}
        />
      )}
    </motion.div>
  )
}
