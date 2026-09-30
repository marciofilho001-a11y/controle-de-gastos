import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { Plus, Send, CheckCircle2, Nfc, ArrowUpRight, Mic, Loader2, CircleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PreviewCard } from "@/features/chat/chat-assistente"
import { parseEntrada, type ParseResult } from "@/features/chat/parser"
import { salvarEntrada } from "@/features/chat/salvar"
import { useFinData } from "@/hooks/use-fin-data"
import { mesRefAtual } from "@/lib/format"
import { mesFaturaPara, dataLocal } from "@/lib/inbox"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const
const EXEMPLOS = ["pix 50 luiz", "mercado 120 débito", "ifood 45 nubank", "3x 70 jaqueta nubank"]

// Tela aberta pelo ícone "Lançar" da tela inicial do iPhone: escreve (ou dita pelo
// microfone do teclado), confere a prévia e grava direto na lista de lançamentos.
export function LancarRapido() {
  const { loading, error, cartoes, transacoes, faturaItens, inbox, loadAll } = useFinData()
  const [texto, setTexto] = useState("")
  const [previa, setPrevia] = useState<ParseResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [feitos, setFeitos] = useState<{ id: number; msg: string }[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hoje = dataLocal(new Date().toISOString())

  useEffect(() => { if (!loading) inputRef.current?.focus() }, [loading])

  function interpretar(frase = texto) {
    const t = frase.trim()
    if (!t) return
    const r = parseEntrada(t, cartoes, transacoes, faturaItens, mesRefAtual())
    if (!r) {
      setPrevia(null)
      setErro('Não achei o valor. Tente algo como "pix 50 luiz".')
      return
    }
    setErro(null)
    // compra no cartão sem mês citado: cai na fatura certa pela data de hoje
    if (r.origem === "cartao" && r.cartao && !r.mesMencionado) r.mesRef = mesFaturaPara(r.cartao, hoje)
    setPrevia(r)
  }

  function ajustar(patch: Partial<ParseResult>) {
    setPrevia((p) => {
      if (!p) return p
      const n = { ...p, ...patch }
      if ("cartao" in patch && !("mesRef" in patch) && !p.mesMencionado) {
        n.mesRef = n.origem === "cartao" && n.cartao ? mesFaturaPara(n.cartao, hoje) : null
      }
      n.valorTotal = n.valorParcela * n.numParcelas
      return n
    })
  }

  async function lancar() {
    if (!previa) return
    setSalvando(true)
    try {
      const msg = await salvarEntrada(previa, previa.mesRef || mesRefAtual())
      setFeitos((f) => [{ id: Date.now(), msg }, ...f].slice(0, 8))
      setPrevia(null)
      setTexto("")
      toast.success("Lançado")
      inputRef.current?.focus()
      await loadAll()
    } catch (e) {
      toast.error("Não foi possível lançar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-5 px-4"
      style={{ paddingTop: "max(env(safe-area-inset-top), 20px)", paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
    >
      {/* cabeçalho */}
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30">
          <Plus className="size-6" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight">Lançar</h1>
          <p className="text-xs text-muted-foreground">Pix, débito, compra online — entra direto na lista</p>
        </div>
        <a href="/" className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          FinFlow <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      {inbox.length > 0 && (
        <a href="/" className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm">
          <Nfc className="size-4.5 shrink-0 text-primary" />
          <span className="flex-1">
            <span className="font-semibold">{inbox.length} compra{inbox.length > 1 ? "s" : ""} por aproximação</span> esperando revisão
          </span>
          <ArrowUpRight className="size-4 text-primary" />
        </a>
      )}

      {loading ? (
        <div className="grid flex-1 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Erro ao carregar: {error}</p>
      ) : (
        <>
          {/* entrada */}
          <div className="rounded-2xl border bg-card p-3 shadow-sm focus-within:border-primary/60">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); if (erro) setErro(null) }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); interpretar() } }}
              enterKeyHint="send"
              rows={2}
              placeholder='O que e quanto? Ex.: "pix 50 luiz"'
              className="w-full resize-none bg-transparent px-1 text-lg outline-none placeholder:text-muted-foreground/70"
            />
            <div className="mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Mic className="size-3.5" /> toque no microfone do teclado para falar
              </span>
              <Button size="sm" className="ml-auto" onClick={() => interpretar()} disabled={!texto.trim()}>
                <Send data-icon="inline-start" /> Conferir
              </Button>
            </div>
          </div>

          {erro && (
            <p className="-mt-2 flex items-center gap-1.5 text-sm text-warning"><CircleAlert className="size-4" /> {erro}</p>
          )}

          {!previa && (
            <div className="flex flex-wrap gap-2">
              {EXEMPLOS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setTexto(ex); interpretar(ex) }}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {previa && (
              <motion.div key="previa" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }}>
                <PreviewCard
                  parse={previa}
                  cartoes={cartoes}
                  salvando={salvando}
                  mesRef={mesRefAtual()}
                  className="bg-card p-4"
                  titulo="Confere e lança"
                  rotuloConfirmar="Lançar"
                  onConfirm={lancar}
                  onCancel={() => { setPrevia(null); inputRef.current?.focus() }}
                  onChange={ajustar}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {feitos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lançados agora</p>
              <AnimatePresence initial={false}>
                {feitos.map((f, i) => (
                  <motion.p
                    key={f.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className={cn("flex items-start gap-2 rounded-lg px-1 py-1 text-sm", i > 0 && "text-muted-foreground")}
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {f.msg}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  )
}
