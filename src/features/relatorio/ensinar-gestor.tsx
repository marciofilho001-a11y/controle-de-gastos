import { useMemo, useState } from "react"
import { GraduationCap, Plus, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useFinData } from "@/hooks/use-fin-data"
import { TEMAS, normalizarTexto, temaDaDescricao, temasComExtras, type TemaKey } from "@/lib/temas"

type Extras = Partial<Record<TemaKey, string[]>>

function lerExtras(json?: string | null): Extras {
  try { return json ? (JSON.parse(json) as Extras) : {} } catch { return {} }
}

// Editor das palavras que o Panorama usa pra agrupar gastos por tema.
// Ex.: ensinar que "Pietro" é bebida faz "Cervejas Pietro" contar em "bebida e saídas".
export function EnsinarGestorDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { config, saveConfig, transacoes } = useFinData()
  const [open, setOpen] = useState(false)
  const [tema, setTema] = useState<TemaKey>("bebida")
  const [palavra, setPalavra] = useState("")
  const [salvando, setSalvando] = useState(false)
  const extras = useMemo(() => lerExtras(config.temas_extra), [config.temas_extra])

  // quantos lançamentos (todos os meses) ainda não caem em tema nenhum — o que dá pra ensinar
  const semTema = useMemo(() => {
    const temas = temasComExtras(config.temas_extra)
    const nomes = new Map<string, number>()
    for (const t of transacoes) {
      if (t.tipo !== "despesa" || !t.descricao || t.obrigacao_id) continue
      if (/^\s*fatura/i.test(t.descricao) || t.descricao === "Faturas a detalhar") continue
      if (temaDaDescricao(t.descricao, temas)) continue
      const k = t.descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim()
      nomes.set(k, (nomes.get(k) || 0) + 1)
    }
    return [...nomes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n)
  }, [transacoes, config.temas_extra])

  async function persistir(novo: Extras) {
    setSalvando(true)
    try {
      await saveConfig("temas_extra", JSON.stringify(novo))
    } catch (e) {
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setSalvando(false)
    }
  }

  async function adicionar(p = palavra) {
    const w = normalizarTexto(p)
    if (!w) return
    const lista = extras[tema] || []
    if (lista.includes(w)) { toast.info("Essa palavra já está nesse tema"); return }
    await persistir({ ...extras, [tema]: [...lista, w] })
    setPalavra("")
    toast.success(`"${w}" agora conta como ${TEMAS.find((t) => t.key === tema)?.label}`)
  }

  async function remover(k: TemaKey, w: string) {
    const lista = (extras[k] || []).filter((x) => x !== w)
    const novo = { ...extras, [k]: lista }
    if (!lista.length) delete novo[k]
    await persistir(novo)
  }

  const temaAtual = TEMAS.find((t) => t.key === tema)!
  const totalExtras = Object.values(extras).reduce((s, l) => s + (l?.length || 0), 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <GraduationCap data-icon="inline-start" /> Ensinar palavras
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <GraduationCap className="size-4 text-primary" /> Ensinar o gestor
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            O Panorama agrupa gastos por palavras da descrição. Ensine as suas: "Pietro" é bebida, "Angeloni" é mercado.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <Label>Tema</Label>
              <Select value={tema} onValueChange={(v) => setTema(v as TemaKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TEMAS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="eg-palavra">Palavra</Label>
              <Input
                id="eg-palavra" value={palavra} onChange={(e) => setPalavra(e.target.value)}
                placeholder="ex.: pietro" onKeyDown={(e) => { if (e.key === "Enter") adicionar() }}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => adicionar()} disabled={salvando || !palavra.trim()} aria-label="Adicionar">
                <Plus data-icon="inline-start" /> Add
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{temaAtual.label}</span> já reconhece:{" "}
            {temaAtual.palavras.slice(0, 8).join(", ")}{temaAtual.palavras.length > 8 ? "…" : ""}
          </p>

          {/* palavras ensinadas */}
          <div className="rounded-xl border bg-card p-3">
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Suas palavras ({totalExtras})
            </p>
            {totalExtras === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ainda. Adicione acima ou clique numa sugestão abaixo.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {TEMAS.filter((t) => extras[t.key]?.length).map((t) => (
                  <div key={t.key} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium">{t.label}:</span>
                    {extras[t.key]!.map((w) => (
                      <span key={w} className="flex items-center gap-1 rounded-full border bg-secondary/60 px-2 py-0.5 text-xs">
                        {w}
                        <button onClick={() => remover(t.key, w)} className="text-muted-foreground hover:text-destructive" aria-label={`remover ${w}`}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* sugestões: descrições frequentes sem tema */}
          {semTema.length > 0 && (
            <div>
              <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                Sem tema ainda — clique pra ensinar como "{temaAtual.label}"
              </p>
              <div className="flex flex-wrap gap-1.5">
                {semTema.map((n) => (
                  <button
                    key={n}
                    onClick={() => adicionar(n)}
                    className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
