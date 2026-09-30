import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { Smartphone, CheckCheck, Loader2, Nfc } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PreviewCard } from "@/features/chat/chat-assistente"
import type { ParseResult } from "@/features/chat/parser"
import { useFinData } from "@/hooks/use-fin-data"
import { mesRefAtual, fmtData } from "@/lib/format"
import { previaDoInbox, confirmarInbox, descartarInbox, horaLocal } from "@/lib/inbox"
import type { InboxItem } from "@/lib/supabase"

const EASE = [0.23, 1, 0.32, 1] as const

// Compras por aproximação que o iPhone mandou sozinho (automação "Transação" do Atalhos).
// Ficam aqui até você confirmar — o iPhone às vezes dispara até em compra recusada.
export function InboxRevisao() {
  const { inbox, cartoes, transacoes, faturaItens, loadAll } = useFinData()
  const [edits, setEdits] = useState<Record<number, ParseResult>>({})
  const [busy, setBusy] = useState<number | "todas" | null>(null)

  const itens = useMemo(
    () => inbox.map((item) => ({ item, ...previaDoInbox(item, cartoes, transacoes, faturaItens) })),
    [inbox, cartoes, transacoes, faturaItens],
  )
  // descarta edições de itens que já saíram da caixa
  useEffect(() => {
    setEdits((e) => Object.fromEntries(Object.entries(e).filter(([id]) => inbox.some((i) => i.id === Number(id)))))
  }, [inbox])

  if (!itens.length) return null
  const parseDe = (id: number, base: ParseResult) => edits[id] ?? base
  const pronto = (p: ParseResult) => p.valorTotal > 0 && (p.origem !== "cartao" || !!p.cartao)
  const prontos = itens.filter((x) => pronto(parseDe(x.item.id, x.parse)))

  async function confirmar(item: InboxItem, parse: ParseResult, dataCompra: string) {
    setBusy(item.id)
    try {
      await confirmarInbox(item, parse, dataCompra)
      toast.success(`${parse.descricao} lançado`)
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível lançar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(null)
    }
  }
  async function descartar(item: InboxItem) {
    setBusy(item.id)
    try {
      await descartarInbox(item)
      toast("Compra descartada")
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível descartar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(null)
    }
  }
  async function confirmarTodas() {
    setBusy("todas")
    let ok = 0
    try {
      for (const x of prontos) {
        await confirmarInbox(x.item, parseDe(x.item.id, x.parse), x.dataCompra)
        ok++
      }
      toast.success(`${ok} compra${ok > 1 ? "s" : ""} lançada${ok > 1 ? "s" : ""}`)
    } catch (e) {
      toast.error("Parou no meio", { description: `${ok} lançada(s). ${e instanceof Error ? e.message : ""}` })
    } finally {
      await loadAll()
      setBusy(null)
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}
      className="rounded-xl border border-primary/35 bg-gradient-to-r from-primary/10 via-card to-card p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/40">
            <Nfc className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold leading-tight">
              A revisar · {itens.length} compra{itens.length > 1 ? "s" : ""} por aproximação
            </h3>
            <p className="text-xs text-muted-foreground">
              Chegaram do iPhone. Confira e lance — ou descarte se a compra foi recusada.
            </p>
          </div>
        </div>
        {prontos.length >= 2 && (
          <Button size="sm" className="w-full sm:w-auto" onClick={confirmarTodas} disabled={busy !== null}>
            {busy === "todas" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <CheckCheck data-icon="inline-start" />}
            Confirmar {prontos.length === itens.length ? "todas" : `${prontos.length} prontas`}
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {itens.map(({ item, parse: base, dataCompra, valorOk }) => {
            const parse = parseDe(item.id, base)
            return (
              <motion.div
                key={item.id} layout
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <PreviewCard
                  parse={parse}
                  cartoes={cartoes}
                  salvando={busy === item.id || busy === "todas"}
                  mesRef={mesRefAtual()}
                  className="bg-card"
                  iniciarEditando={!valorOk || !parse.cartao}
                  titulo={
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Smartphone className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {fmtData(dataCompra)} às {horaLocal(item.recebido_em)}
                        {item.cartao_nome ? ` · ${item.cartao_nome}` : ""}
                        {!valorOk && " · valor não veio, confira"}
                      </span>
                    </span>
                  }
                  rotuloConfirmar="Lançar"
                  rotuloCancelar="Descartar"
                  onConfirm={() => confirmar(item, parse, dataCompra)}
                  onCancel={() => descartar(item)}
                  onChange={(patch) => setEdits((e) => {
                    const p = { ...(e[item.id] ?? base), ...patch }
                    p.valorTotal = p.valorParcela * p.numParcelas
                    return { ...e, [item.id]: p }
                  })}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.section>
  )
}
