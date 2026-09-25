import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Flame, AlertTriangle, CheckCircle2, Info, Sparkles, ChevronDown, ArrowRight,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ItemIcon } from "@/features/cartoes/item-icon"
import { EnsinarGestorDialog } from "./ensinar-gestor"
import { useFinData } from "@/hooks/use-fin-data"
import { gerarInsights, type Insight, type Severidade } from "@/lib/insights"
import { fmtR, fmtMesLongo, fmtData } from "@/lib/format"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const

const SEV: Record<Severidade, { label: string; icon: typeof Flame; cls: string; dot: string }> = {
  vilao:   { label: "Vilão",    icon: Flame,        cls: "border-destructive/30 bg-destructive/[0.07]", dot: "bg-destructive/15 text-destructive" },
  atencao: { label: "Atenção",  icon: AlertTriangle, cls: "border-warning/30 bg-warning/[0.07]",        dot: "bg-warning/15 text-warning" },
  ok:      { label: "Bom sinal",icon: CheckCircle2,  cls: "border-success/30 bg-success/[0.07]",        dot: "bg-success/15 text-success" },
  info:    { label: "Panorama", icon: Info,          cls: "border-border bg-card",                      dot: "bg-muted text-muted-foreground" },
}

// Hook: gera os insights do mês a partir dos dados já carregados
export function usePanorama(mesRef: string): Insight[] {
  const { transacoes, cartoes, obrigacoes, tetos, config } = useFinData()
  return useMemo(
    () => gerarInsights({ transacoes, cartoes, obrigacoes, tetos, config, mesRef }),
    [transacoes, cartoes, obrigacoes, tetos, config, mesRef]
  )
}

export function InsightCard({ insight, index = 0, compacto = false }: { insight: Insight; index?: number; compacto?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const s = SEV[insight.severidade]
  const Icon = s.icon
  const temTx = !!insight.transacoes?.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: EASE }}
      className={cn("rounded-xl border", s.cls, compacto ? "px-3 py-2.5" : "p-4")}
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid shrink-0 place-items-center rounded-lg", s.dot, compacto ? "size-7" : "size-8")}>
          <Icon className={compacto ? "size-3.5" : "size-4"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-display font-semibold leading-snug", compacto ? "text-[13.5px]" : "text-[15px]")}>
            {insight.frase}
          </p>
          {insight.detalhe && !compacto && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{insight.detalhe}</p>
          )}
          {temTx && !compacto && (
            <button
              onClick={() => setAberto((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {aberto ? "ocultar" : "ver"} lançamentos ({insight.transacoes!.length})
              <ChevronDown className={cn("size-3.5 transition-transform", aberto && "rotate-180")} />
            </button>
          )}
          <AnimatePresence initial={false}>
            {aberto && temTx && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-col gap-1">
                  {insight.transacoes!
                    .slice()
                    .sort((a, b) => Number(b.valor) - Number(a.valor))
                    .map((t) => (
                      <div key={t.id} className="flex items-center gap-2.5 rounded-lg bg-background/60 px-2.5 py-1.5">
                        <ItemIcon descricao={t.descricao || ""} categoria={t.categoria || "outro"} size={26} />
                        <span className="min-w-0 flex-1 truncate text-sm">{t.descricao}</span>
                        <span className="text-[0.7rem] text-muted-foreground">{fmtData(t.data)}</span>
                        <span className="tnum text-sm font-medium">{fmtR(Number(t.valor))}</span>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// Painel completo (Dialog). `trigger` é o botão que abre.
export function PanoramaDialog({ mesRef, trigger }: { mesRef: string; trigger: React.ReactNode }) {
  const insights = usePanorama(mesRef)
  const [open, setOpen] = useState(false)
  const contagem = useMemo(() => {
    const c = { vilao: 0, atencao: 0, ok: 0, info: 0 } as Record<Severidade, number>
    for (const i of insights) c[i.severidade]++
    return c
  }, [insights])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="size-4 text-primary" />
            Panorama de <span className="capitalize">{fmtMesLongo(mesRef)}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {contagem.vilao > 0 && <span className="text-destructive">{contagem.vilao} vilão{contagem.vilao > 1 ? "s" : ""}</span>}
            {contagem.vilao > 0 && contagem.atencao > 0 && " · "}
            {contagem.atencao > 0 && <span className="text-warning">{contagem.atencao} ponto{contagem.atencao > 1 ? "s" : ""} de atenção</span>}
            {(contagem.vilao > 0 || contagem.atencao > 0) && contagem.ok > 0 && " · "}
            {contagem.ok > 0 && <span className="text-success">{contagem.ok} bom{contagem.ok > 1 ? "s" : ""} sinal{contagem.ok > 1 ? "is" : ""}</span>}
            {contagem.vilao + contagem.atencao + contagem.ok === 0 && "Leitura direta do seu mês, sem rodeio."}
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          {insights.map((i, idx) => <InsightCard key={i.id} insight={i} index={idx} />)}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.7rem] text-muted-foreground">
            Calculado localmente a partir dos seus lançamentos. Nenhum número é inventado.
          </p>
          <EnsinarGestorDialog />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Botão pronto pro cabeçalho do Relatório
export function PanoramaButton({ mesRef }: { mesRef: string }) {
  return (
    <PanoramaDialog
      mesRef={mesRef}
      trigger={
        <Button>
          <Sparkles data-icon="inline-start" /> Panorama do mês
        </Button>
      }
    />
  )
}

// Card resumido (3 frases) pro Dashboard, com atalho pro painel completo
export function PanoramaResumo({ mesRef }: { mesRef: string }) {
  const insights = usePanorama(mesRef)
  const top = insights.filter((i) => i.id !== "vazio").slice(0, 3)
  if (!top.length) return null
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5" /> Panorama do mês
        </div>
        <PanoramaDialog
          mesRef={mesRef}
          trigger={
            <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              ver completo <ArrowRight className="size-3.5" />
            </button>
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        {top.map((i, idx) => <InsightCard key={i.id} insight={i} index={idx} compacto />)}
      </div>
    </div>
  )
}
