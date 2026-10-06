import { useEffect, useMemo, useRef, useState } from "react"
import type { SimpleIcon } from "simple-icons"
import { Ban, Loader2, RotateCcw, Search, Upload } from "@/lib/icons"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useFinData } from "@/hooks/use-fin-data"
import { comprimirImagemParaIcone } from "@/lib/image"
import { logoDoLancamento, logoMarcaDataUrl, marcaDaDescricao, normalizarParaMarca, SEM_LOGO } from "@/lib/marcas"
import { cn } from "@/lib/utils"

// Biblioteca completa (~3.400 marcas) carregada só quando o seletor abre
let biblioteca: Promise<SimpleIcon[]> | null = null
function carregarBiblioteca() {
  biblioteca ??= import("simple-icons").then((m) =>
    Object.values(m).filter((v): v is SimpleIcon => typeof v === "object" && v !== null && "path" in v && "hex" in v),
  )
  return biblioteca
}

const LIMITE = 48

// palavra mais "marca" da descrição pra começar a busca (ignora parcelas e palavras genéricas)
const GENERICAS = new Set(["fatura", "cartao", "pagamento", "compra", "jogos", "jogo", "curso", "venda", "perfume", "comida", "bebida", "de", "do", "da"])
function buscaInicial(descricao: string): string {
  const m = marcaDaDescricao(descricao)
  if (m) return m.title
  const p = normalizarParaMarca(descricao).trim().split(" ").filter((w) => w.length > 2 && !GENERICAS.has(w) && !/^\d/.test(w))
  return p[0] || ""
}

export function SeletorLogo({
  descricao, open, onOpenChange,
}: { descricao: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { descricaoIcones, loadAll } = useFinData()
  const dn = descricao.trim().toLowerCase()
  const atual = logoDoLancamento(descricao, descricaoIcones)
  const temPropria = !!descricaoIcones[dn]
  const [q, setQ] = useState("")
  const [icones, setIcones] = useState<SimpleIcon[] | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ(buscaInicial(descricao))
    carregarBiblioteca().then(setIcones).catch(() => toast.error("Não consegui carregar a biblioteca de logos"))
  }, [open, descricao])

  const resultados = useMemo(() => {
    if (!icones) return []
    const t = normalizarParaMarca(q).trim()
    if (!t) return []
    const sem = t.replace(/ /g, "")
    const pontua = (i: SimpleIcon) => {
      const titulo = normalizarParaMarca(i.title).trim()
      if (titulo === t || i.slug === sem) return 0
      if (titulo.startsWith(t) || i.slug.startsWith(sem)) return 1
      if (titulo.includes(t) || i.slug.includes(sem)) return 2
      return 9
    }
    return icones.map((i) => [pontua(i), i] as const).filter(([p]) => p < 9)
      .sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title)).slice(0, LIMITE).map(([, i]) => i)
  }, [icones, q])

  async function gravar(imagem: string | null, chave: string, msg: string) {
    if (!dn) { toast.error("Esse lançamento não tem nome pra vincular o logo"); return }
    setSalvando(chave)
    try {
      const { error } = imagem === null
        ? await supabase.from("fin_descricao_icones").delete().eq("descricao_norm", dn)
        : await supabase.from("fin_descricao_icones").upsert({ descricao_norm: dn, imagem, atualizado_em: new Date().toISOString() })
      if (error) throw error
      await loadAll()
      toast.success(msg)
      onOpenChange(false)
    } catch (err) {
      toast.error("Erro ao salvar o logo", { description: err instanceof Error ? err.message : "" })
    } finally {
      setSalvando(null)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error("Escolha uma imagem (PNG ou JPG)"); return }
    const imagem = await comprimirImagemParaIcone(file, 192)
    await gravar(imagem, "upload", `Imagem de "${descricao}" salva`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Logo do lançamento</DialogTitle>
          <DialogDescription>
            Vale pra todo lançamento chamado “{descricao}”. Logos da biblioteca Simple Icons.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca: Netflix, Uber, Steam…" className="pl-9" />
        </div>

        <div className="h-[300px] overflow-y-auto rounded-lg border bg-secondary/20 p-2">
          {!icones ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
          ) : resultados.length === 0 ? (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
              {q.trim() ? "Nenhuma marca com esse nome. Comércio local não está na biblioteca: envie uma imagem." : "Digite o nome de uma marca"}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {resultados.map((i) => {
                const src = logoMarcaDataUrl(i)
                const ativo = atual === src
                return (
                  <button
                    key={i.slug} type="button" title={i.title} disabled={!!salvando}
                    onClick={() => gravar(src, i.slug, `Logo ${i.title} aplicado em "${descricao}"`)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-secondary disabled:opacity-60",
                      ativo && "bg-primary/10 ring-1 ring-primary/50",
                    )}
                  >
                    <span className="relative size-10 overflow-hidden rounded-full ring-1 ring-border">
                      <img src={src} alt="" className="size-full" />
                      {salvando === i.slug && <span className="absolute inset-0 grid place-items-center bg-background/60"><Loader2 className="size-4 animate-spin" /></span>}
                    </span>
                    <span className="w-full truncate text-center text-[0.68rem] text-muted-foreground">{i.title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={!!salvando}>
            <Upload data-icon="inline-start" /> Enviar imagem
          </Button>
          <Button variant="outline" size="sm" onClick={() => gravar(SEM_LOGO, "sem", "Logo removido")} disabled={!!salvando}>
            <Ban data-icon="inline-start" /> Sem logo
          </Button>
          {temPropria && (
            <Button variant="ghost" size="sm" onClick={() => gravar(null, "padrao", "Voltou ao automático")} disabled={!!salvando}>
              <RotateCcw data-icon="inline-start" /> Automático
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
      </DialogContent>
    </Dialog>
  )
}
