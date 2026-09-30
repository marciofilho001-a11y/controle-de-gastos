import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { Scale, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, Loader2, Search, Flame, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto } from "@/lib/format"
import {
  resumoNatureza, serieNatureza, inutilFuturo, chaveDescricao, lerOverrides, NATUREZA_INFO, NATUREZAS,
  type Natureza, type NaturezaClassificada,
} from "@/lib/essencial"
import { nomeComercial } from "@/lib/temas"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const
const COR = (n: Natureza) => NATUREZA_INFO[n].cor
const ABA_CURTA: Record<NaturezaClassificada, string> = { essencial: "Essencial", escolha: "Escolha", inutil: "Inúteis" }

// Onde foi o dinheiro do mês: essencial, por escolha e o que você marcou como inútil.
// O seletor no topo (ou os cards) troca o foco: número grande, histórico e a lista "para onde foi".
export function EssencialCard({ mesRef, compacto = false }: { mesRef: string; compacto?: boolean }) {
  const { transacoes, config } = useFinData()
  const [foco, setFoco] = useState<NaturezaClassificada>("escolha")
  const [ajustar, setAjustar] = useState<{ open: boolean; filtro: Natureza | "todos" }>({ open: false, filtro: "todos" })

  const d = useMemo(() => {
    const r = resumoNatureza(transacoes, mesRef, config.temas_extra, config.essencial_override)
    const serie = serieNatureza(transacoes, mesRef, 6, config.temas_extra, config.essencial_override)
    const atual = serie[serie.length - 1]
    const prev = serie.length >= 2 && atual?.mesRef === mesRef ? serie[serie.length - 2] : null
    const ant = prev && prev.confiavel && atual.confiavel ? prev : null
    const futuro = inutilFuturo(transacoes, mesRef, config.temas_extra, config.essencial_override)
    return { r, serie, ant, futuro }
  }, [transacoes, mesRef, config.temas_extra, config.essencial_override])

  const { r } = d
  if (r.total <= 0) return null
  const seg = (v: number) => (r.total > 0 ? (v / r.total) * 100 : 0)
  const info = NATUREZA_INFO[foco]
  const cor = info.cor
  const delta = d.ant ? r.pct[foco] - d.ant.pct[foco] : null
  // subir essencial é neutro/bom; subir escolha ou inútil é alerta
  const deltaRuim = delta != null && (foco === "essencial" ? delta < 0 : delta > 0)
  const grupos = r.grupos[foco]
  const maxGrupo = grupos[0]?.total || 1
  const abrirAjustar = (filtro: Natureza | "todos") => setAjustar({ open: true, filtro })

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
      className="rounded-xl border bg-card p-5"
    >
      {/* cabeçalho: título + seletor + ajustar */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Scale className="size-3.5" /> Para onde foi o dinheiro
        </div>
        <div className="order-3 flex w-full rounded-lg border bg-secondary/40 p-0.5 sm:order-none sm:ml-auto sm:w-auto" role="tablist">
          {NATUREZAS.map((n) => {
            const ativo = foco === n
            return (
              <button
                key={n} role="tab" aria-selected={ativo} aria-label={NATUREZA_INFO[n].label}
                onClick={() => setFoco(n)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                  ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {ativo && (
                  <motion.span
                    layoutId={`foco-${compacto ? "c" : "n"}`}
                    className="absolute inset-0 rounded-md"
                    style={{ background: `color-mix(in srgb, ${COR(n)} 18%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${COR(n)} 55%, transparent)` }}
                    transition={{ duration: 0.25, ease: EASE }}
                  />
                )}
                <span className="relative size-2 rounded-full" style={{ background: COR(n) }} />
                <span className="relative whitespace-nowrap"><span className="sm:hidden">{ABA_CURTA[n]}</span><span className="hidden sm:inline">{NATUREZA_INFO[n].label}</span></span>
              </button>
            )
          })}
        </div>
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-muted-foreground sm:ml-0" onClick={() => abrirAjustar(foco)}>
          <SlidersHorizontal data-icon="inline-start" /> Ajustar
        </Button>
      </div>

      <div className={cn("grid gap-6", !compacto && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]")}>
        {/* número + barra */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <AnimatePresence mode="wait">
              <motion.p
                key={foco}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="tnum font-display text-4xl font-bold leading-none" style={{ color: cor }}
              >
                {Math.round(r.pct[foco])}%
              </motion.p>
            </AnimatePresence>
            <div className="pb-0.5 leading-tight">
              <p className="text-sm font-medium">{info.frase} · <span className="tnum">{fmtR(r[foco])}</span></p>
              <p className="text-xs text-muted-foreground">do que já está classificado em {fmtMesCurto(mesRef)}</p>
            </div>
            {delta != null && Math.abs(delta) >= 0.5 && (
              <span className={cn(
                "mb-0.5 ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                deltaRuim ? "bg-destructive/12 text-destructive" : "bg-success/12 text-success",
              )}>
                {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {Math.abs(delta).toFixed(0)} p.p. vs {fmtMesCurto(d.ant!.mesRef)}
              </span>
            )}
          </div>

          {/* barra do mês: o foco acende, o resto apaga */}
          <div className="flex h-3.5 overflow-hidden rounded-full bg-secondary">
            {(["essencial", "escolha", "inutil", "indefinido"] as const).map((k, i) => {
              const v = r[k]
              if (v <= 0) return null
              const ativo = k === foco
              return (
                <motion.button
                  key={k} type="button" aria-label={NATUREZA_INFO[k].label}
                  disabled={k === "indefinido"}
                  onClick={() => k !== "indefinido" && setFoco(k)}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${seg(v)}%`, opacity: k === "indefinido" ? 0.4 : ativo ? 1 : 0.35 }}
                  transition={{ duration: 0.5, delay: 0.05 + i * 0.06, ease: EASE }}
                  style={{ background: COR(k), boxShadow: ativo ? `0 0 12px color-mix(in srgb, ${COR(k)} 60%, transparent)` : undefined }}
                />
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NATUREZAS.map((n) => (
              <Legenda
                key={n} cor={COR(n)} label={NATUREZA_INFO[n].label} valor={r[n]}
                sub={`${Math.round(r.pct[n])}% do classificado`}
                ativo={foco === n} onClick={() => setFoco(n)}
              />
            ))}
            <Legenda
              cor={COR("indefinido")} label="A classificar" valor={r.indefinido}
              sub={`${Math.round(seg(r.indefinido))}% do mês, fora do %`} apagado
              onClick={() => abrirAjustar("indefinido")}
            />
          </div>

          {d.serie.length >= 2 && (
            <div className="flex items-end gap-1.5">
              {d.serie.map((s) => {
                const p = s.pct[foco]
                return (
                  <div
                    key={s.mesRef} className="flex flex-1 flex-col items-center gap-1"
                    title={s.confiavel ? `${fmtMesCurto(s.mesRef)}: ${Math.round(p)}% ${info.label.toLowerCase()}` : `${fmtMesCurto(s.mesRef)}: mês pouco detalhado (fatura cheia sem itens) — % não confiável`}
                  >
                    <span className="tnum text-[10px] text-muted-foreground">{s.confiavel ? `${Math.round(p)}%` : "—"}</span>
                    <div className="flex h-10 w-full max-w-9 items-end overflow-hidden rounded-md bg-secondary">
                      <motion.div
                        className="w-full rounded-md"
                        initial={false} animate={{ height: s.confiavel ? `${p > 0 ? Math.max(4, p) : 0}%` : "0%" }}
                        transition={{ duration: 0.45, ease: EASE }}
                        style={{ background: s.mesRef === mesRef ? cor : `color-mix(in srgb, ${cor} 45%, transparent)` }}
                      />
                    </div>
                    <span className={cn("text-[10px]", s.mesRef === mesRef ? "font-semibold text-foreground" : "text-muted-foreground")}>{fmtMesCurto(s.mesRef)}</span>
                    {!s.confiavel && <span className="-mt-1 text-[9px] text-muted-foreground/70">pouco detalhado</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* para onde foi o foco */}
        {!compacto && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Para onde foi o "{info.label.toLowerCase()}"
            </p>

            {foco === "inutil" && d.futuro.total > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs"
                style={{ borderColor: `color-mix(in srgb, ${cor} 45%, transparent)`, background: `color-mix(in srgb, ${cor} 9%, transparent)` }}>
                <CalendarClock className="size-4 shrink-0" style={{ color: cor }} />
                <span>
                  Ainda vão sair <b className="tnum">{fmtR(d.futuro.total)}</b> com gastos inúteis nos próximos{" "}
                  {d.futuro.meses} {d.futuro.meses > 1 ? "meses" : "mês"} (parcelas já lançadas).
                </span>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={foco}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex flex-col gap-2"
              >
                {grupos.length === 0 ? (
                  foco === "inutil" ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
                      <Flame className="size-6" style={{ color: cor }} />
                      <p className="text-sm font-medium">Nenhum gasto inútil marcado</p>
                      <p className="max-w-xs text-xs text-muted-foreground">
                        Marque as parcelas feitas na emoção e as dívidas que você não queria ter. A marcação vale para todos os meses daquele lançamento.
                      </p>
                      <Button size="sm" variant="outline" className="mt-1" onClick={() => abrirAjustar("todos")}>
                        Marcar gastos inúteis
                      </Button>
                    </div>
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">Nada {info.frase.replace("foi ", "")} neste mês</p>
                  )
                ) : (
                  grupos.slice(0, 6).map((g, i) => (
                    <div key={g.grupo} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm">{g.grupo} <span className="text-xs text-muted-foreground">· {g.n}</span></p>
                        <p className="tnum shrink-0 text-sm font-semibold">{fmtR(g.total)}</p>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          className="h-full rounded-full" style={{ background: cor }}
                          initial={{ width: 0 }} animate={{ width: `${(g.total / maxGrupo) * 100}%` }}
                          transition={{ duration: 0.5, delay: 0.05 + i * 0.04, ease: EASE }}
                        />
                      </div>
                    </div>
                  ))
                )}
                {grupos.length > 6 && (
                  <button onClick={() => abrirAjustar(foco)} className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                    ver os {grupos.length} grupos
                  </button>
                )}
              </motion.div>
            </AnimatePresence>

            {r.indefinido > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtR(r.indefinido)} ainda estão em faturas sem detalhe ou em "Outro" — detalhar deixa o número mais preciso.
              </p>
            )}
          </div>
        )}
      </div>

      <AjustarDialog
        open={ajustar.open} filtroInicial={ajustar.filtro} mesRef={mesRef}
        onOpenChange={(o) => setAjustar((a) => ({ ...a, open: o }))}
      />
    </motion.section>
  )
}

function Legenda({
  cor, label, valor, sub, apagado, ativo, onClick,
}: { cor: string; label: string; valor: number; sub: string; apagado?: boolean; ativo?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        "min-w-0 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-secondary/50",
        apagado && "opacity-75",
      )}
      style={ativo ? { borderColor: cor, background: `color-mix(in srgb, ${cor} 10%, transparent)` } : undefined}
    >
      <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full" style={{ background: cor, boxShadow: `0 0 6px ${cor}` }} />
        {label}
      </p>
      <p className="tnum mt-0.5 truncate text-sm font-semibold">{fmtR(valor)}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </button>
  )
}

// Lista as descrições do mês e deixa trocar entre essencial, por escolha e inútil (grava um ajuste por descrição)
function AjustarDialog({
  open, onOpenChange, mesRef, filtroInicial,
}: { open: boolean; onOpenChange: (o: boolean) => void; mesRef: string; filtroInicial: Natureza | "todos" }) {
  const { transacoes, config, saveConfig } = useFinData()
  const [busy, setBusy] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Natureza | "todos">(filtroInicial)
  const [busca, setBusca] = useState("")
  const [abertoCom, setAbertoCom] = useState<string | null>(null)

  // cada vez que abre, começa no filtro de onde veio
  const chaveAbertura = open ? filtroInicial : null
  if (chaveAbertura !== abertoCom) {
    setAbertoCom(chaveAbertura)
    if (open) { setFiltro(filtroInicial); setBusca("") }
  }

  const itens = useMemo(() => {
    const r = resumoNatureza(transacoes, mesRef, config.temas_extra, config.essencial_override)
    const m = new Map<string, { chave: string; nome: string; total: number; n: number; natureza: Natureza; ajustado: boolean; virtual: boolean; parcela: string | null }>()
    for (const l of r.linhas) {
      const virtual = !!l._virtual || l.categoria === "fatura_indefinida"
      const chave = virtual ? `__virtual_${l.id}` : chaveDescricao(l.descricao)
      const parcela = l.parcela_total && l.parcela_total > 1 ? `${l.parcela_atual ?? "?"}/${l.parcela_total}` : null
      const cur = m.get(chave) || { chave, nome: nomeComercial(l.descricao), total: 0, n: 0, natureza: l.natureza, ajustado: l.motivo === "ajuste", virtual, parcela }
      cur.total += Number(l.valor); cur.n++
      m.set(chave, cur)
    }
    const ordem: Record<Natureza, number> = { inutil: 0, escolha: 1, essencial: 2, indefinido: 3 }
    return [...m.values()].sort((a, b) => ordem[a.natureza] - ordem[b.natureza] || b.total - a.total)
  }, [transacoes, mesRef, config.temas_extra, config.essencial_override])

  const contagem = useMemo(() => {
    const c: Record<Natureza | "todos", number> = { todos: itens.length, essencial: 0, escolha: 0, inutil: 0, indefinido: 0 }
    for (const i of itens) c[i.natureza]++
    return c
  }, [itens])

  const q = busca.trim().toLowerCase()
  const visiveis = itens.filter((i) => (filtro === "todos" || i.natureza === filtro) && (!q || i.nome.toLowerCase().includes(q)))

  async function definir(chave: string, nat: NaturezaClassificada | null) {
    setBusy(chave)
    try {
      const ov = lerOverrides(config.essencial_override)
      if (nat) ov[chave] = nat
      else delete ov[chave]
      await saveConfig("essencial_override", JSON.stringify(ov))
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(null)
    }
  }

  const FILTROS: { k: Natureza | "todos"; label: string }[] = [
    { k: "todos", label: "Todos" },
    { k: "essencial", label: "Essencial" },
    { k: "escolha", label: "Por escolha" },
    { k: "inutil", label: "Inúteis" },
    { k: "indefinido", label: "A classificar" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Classificar os gastos de {fmtMesCurto(mesRef)}</DialogTitle>
          <DialogDescription>
            A marcação vale para a descrição em todos os meses — todas as parcelas de uma compra vão juntas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lançamento" className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map(({ k, label }) => {
              const ativo = filtro === k
              const c = k === "todos" ? undefined : COR(k)
              return (
                <button
                  key={k} onClick={() => setFiltro(k)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  style={ativo ? { borderColor: c ?? "var(--primary)", background: `color-mix(in srgb, ${c ?? "var(--primary)"} 15%, transparent)` } : undefined}
                >
                  {c && <span className="size-2 rounded-full" style={{ background: c }} />}
                  {label}
                  <span className="tnum text-muted-foreground">{contagem[k]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="-mx-6 max-h-[55vh] overflow-y-auto px-6">
          <div className="flex flex-col gap-1.5 pb-2">
            {visiveis.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento aqui</p>
            )}
            {visiveis.map((i) => {
              const cor = COR(i.natureza)
              return (
                <div key={i.chave} className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor, boxShadow: `0 0 6px ${cor}` }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="tnum">{fmtR(i.total)}</span>
                        {i.parcela && ` · parcela ${i.parcela}`}
                        {i.n > 1 && ` · ${i.n} lançamentos`}
                        {i.ajustado && " · marcado por você"}
                      </p>
                    </div>
                  </div>
                  {i.virtual ? (
                    <span className="pl-5.5 text-xs text-muted-foreground sm:pl-0">detalhe a fatura</span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1 pl-5.5 sm:pl-0">
                      {busy === i.chave && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                      {NATUREZAS.map((n) => (
                        <button
                          key={n} disabled={busy === i.chave}
                          onClick={() => definir(i.chave, n)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                            i.natureza === n ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                          style={i.natureza === n ? { borderColor: COR(n), background: `color-mix(in srgb, ${COR(n)} 16%, transparent)` } : undefined}
                        >
                          {NATUREZA_INFO[n].curto}
                        </button>
                      ))}
                      {i.ajustado && (
                        <button
                          onClick={() => definir(i.chave, null)} disabled={busy === i.chave}
                          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                          title="Voltar à classificação automática" aria-label="Voltar à classificação automática"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
