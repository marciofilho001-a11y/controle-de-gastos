import { useMemo, useState } from "react"
import { Zap, Archive, Loader2, Inbox, ChevronDown } from "@/lib/icons"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ObrigacaoDialog } from "./obrigacao-dialog"
import { AssinaturasPanel } from "@/features/assinaturas/assinaturas-panel"
import { PageHeader } from "@/components/page-header"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase, type Obrigacao } from "@/lib/supabase"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { motion, AnimatePresence } from "motion/react"
import { RowActions } from "@/components/row-actions"
import { LogoAvatar } from "@/components/logo-avatar"
import { logoDoLancamento } from "@/lib/marcas"
import { obrigacaoAtivaNoMes, parcelaNoMes } from "@/lib/selectors"
import { cn } from "@/lib/utils"

export function ObrigacoesPage({ mesRef }: { mesRef: string }) {
  const { obrigacoes, loadAll } = useFinData()
  const [delObr, setDelObr] = useState<Obrigacao | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [verInativas, setVerInativas] = useState(false)

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
      <PageHeader title="Obrigações" description="Contas fixas, parcelamentos recorrentes e assinaturas do mês." actions={<ObrigacaoDialog />} />

      <AssinaturasPanel mesRef={mesRef} />

      {/* Ativas */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground/85">
          <Zap className="size-3.5" /> Ativas
          <Badge variant="secondary" className="ml-1">{ativas.length}</Badge>
        </div>
        {ativas.length === 0 ? (
          <Empty>Nenhuma obrigação ativa neste mês</Empty>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            {ativas.map((o) => (
              <ObrLinha key={o.id} o={o} mesRef={mesRef} onDelete={() => setDelObr(o)} />
            ))}
          </div>
        )}
      </section>

      {/* Histórico: recolhido por padrão (abre ao clicar) */}
      {historico.length > 0 && (
        <section>
          <button
            type="button" onClick={() => setVerInativas((v) => !v)} aria-expanded={verInativas}
            className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground/85"
          >
            <Archive className="size-3.5 text-muted-foreground" /> Encerradas / inativas
            <Badge variant="secondary" className="ml-1">{historico.length}</Badge>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", verInativas && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {verInativas && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="overflow-hidden"
              >
                <div className="overflow-hidden rounded-2xl border bg-card">
                  {historico.map((o) => (
                    <ObrLinha key={o.id} o={o} mesRef={mesRef} inativa onDelete={() => setDelObr(o)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

function ObrLinha({
  o, mesRef, inativa, onDelete,
}: {
  o: Obrigacao
  mesRef: string
  inativa?: boolean
  onDelete: () => void
}) {
  const { descricaoIcones } = useFinData()
  const [editando, setEditando] = useState(false)
  const info = catInfo(o.categoria)
  const logo = logoDoLancamento(o.nome, descricaoIcones)
  const parcelaTxt = o.parcela_total
    ? `Parcela ${Math.max(1, parcelaNoMes(o, mesRef))}/${o.parcela_total}`
    : "Recorrente"

  return (
    <div className={cn("group/obr flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 hover:bg-secondary/40", inativa && "text-muted-foreground")}>
      <ObrigacaoDialog
        editar={o} open={editando} onOpenChange={setEditando}
        trigger={
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <LogoAvatar src={logo} cor={catColor(o.categoria)} Icon={info.icon} size={38} />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-medium", !inativa && "text-foreground")}>{o.nome}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {info.l}{o.dia_vencimento ? ` · dia ${o.dia_vencimento}` : ""} · {parcelaTxt}
              </span>
            </span>
            <span className={cn("tnum shrink-0 font-semibold", inativa ? "text-muted-foreground" : "text-foreground")}>{fmtR(Number(o.valor))}</span>
          </button>
        }
      />
      <RowActions
        onEditar={() => setEditando(true)}
        onExcluir={onDelete}
        className="md:opacity-0 md:group-hover/obr:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
      />
    </div>
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
