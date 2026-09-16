import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Sparkles, X, Send, Check, Pencil, CreditCard, Wallet, Loader2, CircleAlert,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useFinData } from "@/hooks/use-fin-data"
import { parseEntrada, type ParseResult } from "./parser"
import { salvarEntrada } from "./salvar"
import { DESPESA_CATS, RECEITA_CATS, catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtMesRef } from "@/lib/format"
import { cn } from "@/lib/utils"

type Msg =
  | { autor: "user"; texto: string }
  | { autor: "bot"; texto: string }
  | { autor: "preview"; parse: ParseResult }

export function ChatAssistente({ mesRef }: { mesRef: string }) {
  const { cartoes, transacoes, faturaItens, loadAll } = useFinData()
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([
    { autor: "bot", texto: 'Oi! Escreva um gasto ou receita em linguagem natural. Ex: "Koch 10 comida débito" ou "3x de 70 Nubank jaqueta Nike".' },
  ])
  const [salvando, setSalvando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [msgs, aberto])

  function enviar() {
    const t = texto.trim()
    if (!t) return
    setTexto("")
    const r = parseEntrada(t, cartoes, transacoes, faturaItens, mesRef)
    if (!r) {
      setMsgs((m) => [
        ...m,
        { autor: "user", texto: t },
        { autor: "bot", texto: "Não consegui identificar um valor. Tente incluir o valor, ex: \"mercado 45 débito\"." },
      ])
      return
    }
    setMsgs((m) => [...m, { autor: "user", texto: t }, { autor: "preview", parse: r }])
  }

  async function confirmar(parse: ParseResult, idx: number) {
    setSalvando(true)
    try {
      const msg = await salvarEntrada(parse, mesRef)
      // remove o preview e põe a confirmação
      setMsgs((m) => m.map((x, i) => (i === idx ? { autor: "bot", texto: "✓ " + msg } : x)))
      await loadAll()
    } catch (e) {
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSalvando(false)
    }
  }

  function cancelar(idx: number) {
    setMsgs((m) => m.map((x, i) => (i === idx ? { autor: "bot", texto: "Cancelado. Pode reescrever." } : x)))
  }

  function atualizarPreview(idx: number, patch: Partial<ParseResult>) {
    setMsgs((m) =>
      m.map((x, i) => {
        if (i !== idx || x.autor !== "preview") return x
        const p = { ...x.parse, ...patch }
        p.valorTotal = p.valorParcela * p.numParcelas
        return { autor: "preview", parse: p }
      })
    )
  }

  return (
    <>
      {/* botão flutuante */}
      <motion.button
        onClick={() => setAberto((v) => !v)}
        className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label="Assistente de lançamento"
      >
        <AnimatePresence mode="wait">
          {aberto ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="size-6" />
            </motion.span>
          ) : (
            <motion.span key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <Sparkles className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* janela de chat */}
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed bottom-24 right-5 z-50 flex h-[min(560px,75vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          >
            {/* header */}
            <div className="flex items-center gap-2.5 border-b bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <div className="flex-1">
                <p className="font-display text-sm font-semibold">Lançamento rápido</p>
                <p className="text-xs text-muted-foreground">Escreva naturalmente, eu cadastro</p>
              </div>
            </div>

            {/* mensagens */}
            <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
              {msgs.map((m, i) =>
                m.autor === "preview" ? (
                  <PreviewCard
                    key={i}
                    parse={m.parse}
                    cartoes={cartoes}
                    salvando={salvando}
                    onConfirm={() => confirmar(m.parse, i)}
                    onCancel={() => cancelar(i)}
                    onChange={(patch) => atualizarPreview(i, patch)}
                    mesRef={mesRef}
                  />
                ) : (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                      m.autor === "user"
                        ? "self-end bg-primary text-primary-foreground"
                        : "self-start bg-secondary text-secondary-foreground"
                    )}
                  >
                    {m.texto}
                  </div>
                )
              )}
            </div>

            {/* input */}
            <div className="flex items-center gap-2 border-t p-3">
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder='Ex: "Koch 10 comida débito"'
                className="flex-1"
              />
              <Button size="icon" onClick={enviar} disabled={!texto.trim()}>
                <Send className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function PreviewCard({
  parse, cartoes, salvando, onConfirm, onCancel, onChange, mesRef,
}: {
  parse: ParseResult
  cartoes: any[]
  salvando: boolean
  onConfirm: () => void
  onCancel: () => void
  onChange: (patch: Partial<ParseResult>) => void
  mesRef: string
}) {
  const [editando, setEditando] = useState(false)
  const cats = parse.tipo === "receita" ? RECEITA_CATS : DESPESA_CATS
  const info = catInfo(parse.categoria)
  const Icon = info.icon
  const cor = catColor(parse.categoria)
  const cartoesAtivos = cartoes.filter((c) => c.ativo !== false)

  const origemLabel =
    parse.origem === "cartao"
      ? parse.cartao
        ? `${parse.cartao.nome}${parse.numParcelas > 1 ? ` · ${parse.numParcelas}x` : " · à vista"}`
        : "Cartão (não identificado)"
      : "Débito / dinheiro"

  return (
    <div className="self-start w-full rounded-2xl border bg-background/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" /> Confirma esse lançamento?
      </p>

      {parse.cartaoMencionadoNaoEncontrado && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
          <CircleAlert className="size-3.5" /> Você citou "{parse.cartaoMencionadoNaoEncontrado}" mas não achei esse cartão — escolha abaixo.
        </div>
      )}

      {!editando ? (
        <div className="flex items-start gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${cor}1f`, color: cor, border: `1px solid ${cor}3a` }}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{parse.descricao}</p>
            <p className="tnum text-sm">
              {parse.tipo === "receita" ? "+ " : "− "}{fmtR(parse.valorTotal)}
              {parse.numParcelas > 1 && <span className="text-muted-foreground"> ({parse.numParcelas}× {fmtR(parse.valorParcela)})</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1" style={{ color: cor }}>{info.l}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                {parse.origem === "cartao" ? <CreditCard className="size-3" /> : <Wallet className="size-3" />}
                {origemLabel}
              </span>
              {parse.origem === "cartao" && <><span>·</span><span>fatura {fmtMesRef(parse.mesRef || mesRef)}</span></>}
            </div>
          </div>
          <button onClick={() => setEditando(true)} className="text-muted-foreground hover:text-foreground" title="Ajustar">
            <Pencil className="size-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Input value={parse.descricao} onChange={(e) => onChange({ descricao: e.target.value })} placeholder="Descrição" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="0.01" value={parse.valorParcela} onChange={(e) => onChange({ valorParcela: parseFloat(e.target.value) || 0 })} placeholder="Valor" />
            <Input type="number" min="1" value={parse.numParcelas} onChange={(e) => onChange({ numParcelas: Math.max(1, parseInt(e.target.value) || 1) })} placeholder="Parcelas" />
          </div>
          <Select value={parse.categoria} onValueChange={(v) => onChange({ categoria: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>{cats.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={parse.origem === "cartao" ? (parse.cartao ? String(parse.cartao.id) : "") : "debito"}
            onValueChange={(v) => {
              if (v === "debito") onChange({ origem: "debito", cartao: null, cartaoMencionadoNaoEncontrado: null })
              else {
                const c = cartoesAtivos.find((x) => String(x.id) === v)
                onChange({ origem: "cartao", cartao: c || null, cartaoMencionadoNaoEncontrado: null })
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Forma de pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="debito">Débito / dinheiro</SelectItem>
                {cartoesAtivos.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button
          size="sm" className="flex-1"
          onClick={onConfirm}
          disabled={salvando || (parse.origem === "cartao" && !parse.cartao)}
        >
          {salvando ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Check data-icon="inline-start" />}
          Cadastrar
        </Button>
      </div>
    </div>
  )
}
