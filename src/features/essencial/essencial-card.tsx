import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { Scale, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useFinData } from "@/hooks/use-fin-data"
import { fmtR, fmtMesCurto } from "@/lib/format"
import {
  resumoNatureza, serieNatureza, chaveDescricao, lerOverrides, NATUREZA_INFO, type Natureza,
} from "@/lib/essencial"
import { nomeComercial } from "@/lib/temas"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const

// Quanto do mês foi gasto no que é essencial x no que foi por escolha.
export function EssencialCard({ mesRef, compacto = false }: { mesRef: string; compacto?: boolean }) {
  const { transacoes, config } = useFinData()
  const [ajustar, setAjustar] = useState(false)

  const d = useMemo(() => {
    const r = resumoNatureza(transacoes, mesRef, config.temas_extra, config.essencial_override)
    const serie = serieNatureza(transacoes, mesRef, 6, config.temas_extra, config.essencial_override)
    const atual = serie[serie.length - 1]
    const prev = serie.length >= 2 && atual?.mesRef === mesRef ? serie[serie.length - 2] : null
    const ant = prev && prev.confiavel && atual.confiavel ? prev : null
    return { r, serie, ant }
  }, [transacoes, mesRef, config.temas_extra, config.essencial_override])

  const { r } = d
  if (r.total <= 0) return null
  const seg = (v: number) => (r.total > 0 ? (v / r.total) * 100 : 0)
  const classificado = r.essencial + r.escolha
  const doClass = (v: number) => (classificado > 0 ? (v / classificado) * 100 : 0)
  const delta = d.ant ? r.pctEscolha - d.ant.pctEscolha : null
  const maxGrupo = r.gruposEscolha[0]?.total || 1
  const corE = NATUREZA_INFO.escolha.cor, corS = NATUREZA_INFO.essencial.cor, corI = NATUREZA_INFO.indefinido.cor

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
      className="rounded-xl border bg-card p-5"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Scale className="size-3.5" /> Essencial × por escolha
        </div>
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-muted-foreground" onClick={() => setAjustar(true)}>
          <SlidersHorizontal data-icon="inline-start" /> Ajustar
        </Button>
      </div>

      <div className={cn("grid gap-6", !compacto && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]")}>
        {/* número + barra */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <p className="tnum font-display text-4xl font-bold leading-none" style={{ color: corE }}>
              {Math.round(r.pctEscolha)}%
            </p>
            <div className="pb-0.5 leading-tight">
              <p className="text-sm font-medium">foi por escolha</p>
              <p className="text-xs text-muted-foreground">do que já está classificado em {fmtMesCurto(mesRef)}</p>
            </div>
            {delta != null && Math.abs(delta) >= 0.5 && (
              <span className={cn(
                "mb-0.5 ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                delta > 0 ? "bg-destructive/12 text-destructive" : "bg-success/12 text-success",
              )}>
                {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                {Math.abs(delta).toFixed(0)} p.p. vs {fmtMesCurto(d.ant!.mesRef)}
              </span>
            )}
          </div>

          <div className="flex h-3.5 overflow-hidden rounded-full bg-secondary">
            {([["essencial", r.essencial, corS], ["escolha", r.escolha, corE], ["indefinido", r.indefinido, corI]] as const).map(([k, v, cor], i) =>
              v > 0 ? (
                <motion.div
                  key={k} className="h-full first:rounded-l-full last:rounded-r-full"
                  initial={{ width: 0 }} animate={{ width: `${seg(v)}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: EASE }}
                  style={{ background: cor, boxShadow: `0 0 12px color-mix(in srgb, ${cor} 55%, transparent)`, opacity: k === "indefinido" ? 0.55 : 1 }}
                />
              ) : null,
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Legenda cor={corS} label="Essencial" valor={r.essencial} sub={`${Math.round(doClass(r.essencial))}% do classificado`} />
            <Legenda cor={corE} label="Por escolha" valor={r.escolha} sub={`${Math.round(doClass(r.escolha))}% do classificado`} />
            <Legenda cor={corI} label="A classificar" valor={r.indefinido} sub={`${Math.round(seg(r.indefinido))}% do mês · fora da conta`} apagado />
          </div>

          {d.serie.length >= 2 && (
            <div className="flex items-end gap-1.5">
              {d.serie.map((s) => (
                <div
                  key={s.mesRef} className="flex flex-1 flex-col items-center gap-1"
                  title={s.confiavel ? `${fmtMesCurto(s.mesRef)}: ${Math.round(s.pctEscolha)}% por escolha` : `${fmtMesCurto(s.mesRef)}: mês pouco detalhado (fatura cheia sem itens) — % não confiável`}
                >
                  <span className="tnum text-[10px] text-muted-foreground">{s.confiavel ? `${Math.round(s.pctEscolha)}%` : "—"}</span>
                  <div className="flex h-10 w-full max-w-9 items-end overflow-hidden rounded-md bg-secondary">
                    <motion.div
                      className="w-full rounded-md"
                      initial={{ height: 0 }} animate={{ height: s.confiavel ? `${Math.max(4, s.pctEscolha)}%` : "0%" }}
                      transition={{ duration: 0.5, ease: EASE }}
                      style={{ background: s.mesRef === mesRef ? corE : `color-mix(in srgb, ${corE} 45%, transparent)` }}
                    />
                  </div>
                  <span className={cn("text-[10px]", s.mesRef === mesRef ? "font-semibold text-foreground" : "text-muted-foreground")}>{fmtMesCurto(s.mesRef)}</span>
                  {!s.confiavel && <span className="-mt-1 text-[9px] text-muted-foreground/70">pouco detalhado</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* onde vai o "por escolha" */}
        {!compacto && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Para onde foi o "por escolha"</p>
            {r.gruposEscolha.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum gasto por escolha neste mês</p>
            ) : (
              r.gruposEscolha.slice(0, 5).map((g, i) => (
                <div key={g.grupo} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm">{g.grupo} <span className="text-xs text-muted-foreground">· {g.n}</span></p>
                      <p className="tnum text-sm font-semibold">{fmtR(g.total)}</p>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        className="h-full rounded-full" style={{ background: corE }}
                        initial={{ width: 0 }} animate={{ width: `${(g.total / maxGrupo) * 100}%` }}
                        transition={{ duration: 0.55, delay: 0.1 + i * 0.05, ease: EASE }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
            {r.indefinido > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtR(r.indefinido)} ainda estão em faturas sem detalhe ou em "Outro" — detalhar deixa o número mais preciso.
              </p>
            )}
          </div>
        )}
      </div>

      <AjustarDialog open={ajustar} onOpenChange={setAjustar} mesRef={mesRef} />
    </motion.section>
  )
}

function Legenda({ cor, label, valor, sub, apagado }: { cor: string; label: string; valor: number; sub: string; apagado?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-lg border px-2.5 py-2", apagado && "opacity-75")}>
      <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full" style={{ background: cor, boxShadow: `0 0 6px ${cor}` }} />
        {label}
      </p>
      <p className="tnum mt-0.5 truncate text-sm font-semibold">{fmtR(valor)}</p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

// Lista as descrições do mês e deixa trocar entre essencial e por escolha (grava um ajuste por descrição)
function AjustarDialog({ open, onOpenChange, mesRef }: { open: boolean; onOpenChange: (o: boolean) => void; mesRef: string }) {
  const { transacoes, config, saveConfig } = useFinData()
  const [busy, setBusy] = useState<string | null>(null)

  const itens = useMemo(() => {
    const r = resumoNatureza(transacoes, mesRef, config.temas_extra, config.essencial_override)
    const m = new Map<string, { chave: string; nome: string; total: number; n: number; natureza: Natureza; ajustado: boolean; virtual: boolean }>()
    for (const l of r.linhas) {
      const virtual = !!l._virtual || l.categoria === "fatura_indefinida"
      const chave = virtual ? `__virtual_${l.id}` : chaveDescricao(l.descricao)
      const cur = m.get(chave) || { chave, nome: nomeComercial(l.descricao), total: 0, n: 0, natureza: l.natureza, ajustado: l.motivo === "ajuste", virtual }
      cur.total += Number(l.valor); cur.n++
      m.set(chave, cur)
    }
    const ordem: Record<Natureza, number> = { escolha: 0, essencial: 1, indefinido: 2 }
    return [...m.values()].sort((a, b) => ordem[a.natureza] - ordem[b.natureza] || b.total - a.total)
  }, [transacoes, mesRef, config.temas_extra, config.essencial_override])

  async function definir(chave: string, nat: Exclude<Natureza, "indefinido"> | null) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajustar essencial × por escolha</DialogTitle>
          <DialogDescription>
            A troca vale para a descrição em todos os meses (ex.: todo "Koch" passa a ser essencial).
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 max-h-[60vh] overflow-y-auto px-6">
          <div className="flex flex-col gap-1.5 pb-2">
            {itens.map((i) => {
              const cor = NATUREZA_INFO[i.natureza].cor
              return (
                <div key={i.chave} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: cor, boxShadow: `0 0 6px ${cor}` }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="tnum">{fmtR(i.total)}</span>{i.n > 1 && ` · ${i.n} lançamentos`}
                      {i.ajustado && " · ajustado por você"}
                    </p>
                  </div>
                  {i.virtual ? (
                    <span className="text-xs text-muted-foreground">detalhe a fatura</span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      {busy === i.chave && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                      {(["essencial", "escolha"] as const).map((n) => (
                        <button
                          key={n} disabled={busy === i.chave}
                          onClick={() => definir(i.chave, n)}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                            i.natureza === n ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                          style={i.natureza === n ? { borderColor: NATUREZA_INFO[n].cor, background: `color-mix(in srgb, ${NATUREZA_INFO[n].cor} 16%, transparent)` } : undefined}
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
