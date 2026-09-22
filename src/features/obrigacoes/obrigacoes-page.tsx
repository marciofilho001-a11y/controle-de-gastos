import { useMemo, useState } from "react"
import { Pencil, Trash2, Zap, Archive, Loader2, Inbox } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ObrigacaoDialog } from "./obrigacao-dialog"
import { PageHeader } from "@/components/page-header"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Obrigacao } from "@/lib/supabase"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { motion } from "motion/react"
import { obrigacaoAtivaNoMes, parcelaNoMes } from "@/lib/selectors"
import { cn } from "@/lib/utils"

export function ObrigacoesPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, loadAll } = useFinData()
  const [delObr, setDelObr] = useState<Obrigacao | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { ativas, historico } = useMemo(() => {
    const ativas = obrigacoes.filter((o) => obrigacaoAtivaNoMes(o, mesRef))
    const historico = obrigacoes.filter((o) => !obrigacaoAtivaNoMes(o, mesRef))
    return { ativas, historico }
  }, [obrigacoes, mesRef])

  async function confirmarDelete() {
    if (!delObr) return
    setDeleting(true)
    try {
      const { error } = await supabase.from("fin_obrigacoes").delete().eq("id", delObr.id)
      if (error) throw error
      toast.success("Obrigação removida")
      setDelObr(null)
      await loadAll()
    } catch (e) {
      toast.error("Erro ao remover", { description: e instanceof Error ? e.message : "" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Obrigações Mensais" description="Contas fixas e parcelamentos recorrentes do mês." actions={<ObrigacaoDialog />} />

      {/* Ativas */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Zap className="size-3.5" /> Ativas
          <Badge variant="secondary" className="ml-1">{ativas.length}</Badge>
        </div>
        {ativas.length === 0 ? (
          <Empty>Nenhuma obrigação ativa neste mês</Empty>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {ativas.map((o, i) => (
              <ObrCard key={o.id} o={o} mesRef={mesRef} index={i} onDelete={() => setDelObr(o)} />
            ))}
          </div>
        )}
      </section>

      {/* Histórico */}
      {historico.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Archive className="size-3.5" /> Histórico / Inativas
            <Badge variant="secondary" className="ml-1">{historico.length}</Badge>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {historico.map((o, i) => (
              <ObrCard key={o.id} o={o} mesRef={mesRef} index={i} inativa onDelete={() => setDelObr(o)} />
            ))}
          </div>
        </section>
      )}

      <AlertDialog open={delObr != null} onOpenChange={(v) => !v && setDelObr(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta obrigação?</AlertDialogTitle>
            <AlertDialogDescription>
              As transações já lançadas não serão apagadas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmarDelete() }} disabled={deleting}>
              {deleting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ObrCard({
  o, mesRef, index, inativa, onDelete,
}: {
  o: Obrigacao
  mesRef: string
  index: number
  inativa?: boolean
  onDelete: () => void
}) {
  const info = catInfo(o.categoria)
  const Icon = info.icon
  const cor = catColor(o.categoria)
  const parcelaTxt = o.parcela_total
    ? `Parcela ${Math.max(1, parcelaNoMes(o, mesRef))}/${o.parcela_total}`
    : "Recorrente"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: [0.2, 0, 0, 1] }}
      className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", inativa && "opacity-70")}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${cor}1f`, color: cor, border: `1px solid ${cor}3a` }}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold">{o.nome}</p>
          <p className="text-xs text-muted-foreground">{info.l}</p>
        </div>
      </div>
      <p className="tnum text-xl font-semibold" style={{ color: inativa ? undefined : cor }}>{fmtR(Number(o.valor))}</p>
      <div className="flex flex-wrap gap-1.5">
        {o.dia_vencimento && <Badge variant="secondary">Dia {o.dia_vencimento}</Badge>}
        <Badge variant="outline">{parcelaTxt}</Badge>
        {inativa && <Badge variant="outline" className="text-muted-foreground">Inativa</Badge>}
      </div>
      <div className="flex gap-2">
        <ObrigacaoDialog
          editar={o}
          trigger={
            <Button variant="outline" size="sm" className="flex-1">
              <Pencil data-icon="inline-start" /> Editar
            </Button>
          }
        />
        <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </motion.div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-10 text-center">
      <Inbox className="size-7 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
