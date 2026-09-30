import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { Repeat, TrendingUp, AlertTriangle, CheckCircle2, Clock, Plus, X, Sparkles, Ghost, Smartphone } from "lucide-react"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { LogoAvatar } from "@/components/logo-avatar"
import { useFinData } from "@/hooks/use-fin-data"
import { catColor } from "@/lib/categorias"
import { fmtR, fmtMesCurto } from "@/lib/format"
import { detectarAssinaturas, lerLista, type Assinatura, type StatusAssinatura } from "@/lib/assinaturas"
import { cn } from "@/lib/utils"

const EASE = [0.23, 1, 0.32, 1] as const

const STATUS: Record<StatusAssinatura, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  ativa: { label: "Ativa", cls: "bg-success/12 text-success", icon: CheckCircle2 },
  nova: { label: "1ª cobrança", cls: "bg-primary/12 text-primary", icon: Sparkles },
  pendente: { label: "Ainda não cobrou", cls: "bg-warning/15 text-warning", icon: Clock },
  sumiu: { label: "Sumiu", cls: "bg-secondary text-muted-foreground", icon: Ghost },
}

export function AssinaturasPanel({ mesRef }: { mesRef: string }) {
  const { transacoes, cartoes, config, descricaoIcones, saveConfig } = useFinData()
  const [busy, setBusy] = useState(false)

  const d = useMemo(() => {
    const { assinaturas, candidatas } = detectarAssinaturas(transacoes, mesRef, config)
    const vivas = assinaturas.filter((a) => a.status !== "sumiu")
    const mensal = vivas.reduce((s, a) => s + a.valor, 0)
    const alertas = assinaturas.filter((a) => a.mudouValor || a.status === "sumiu")
    return { assinaturas, candidatas, vivas, mensal, alertas }
  }, [transacoes, mesRef, config])

  async function salvarListas(conf: string[], ign: string[], msg: string) {
    setBusy(true)
    try {
      await saveConfig("assinaturas_confirmadas", JSON.stringify([...new Set(conf)]))
      await saveConfig("assinaturas_ignoradas", JSON.stringify([...new Set(ign)]))
      toast.success(msg)
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }
  const confirmadas = lerLista(config.assinaturas_confirmadas)
  const ignoradas = lerLista(config.assinaturas_ignoradas)

  function ignorar(a: Assinatura) {
    salvarListas(confirmadas.filter((c) => c !== a.chave), [...ignoradas, a.chave], `${a.nome} não conta mais como assinatura`)
  }
  function marcar(chave: string, nome: string) {
    salvarListas([...confirmadas, chave], ignoradas.filter((c) => c !== chave), `${nome} marcada como assinatura`)
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary"><Repeat className="size-4.5" /></span>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight">Assinaturas</h3>
            <p className="text-xs text-muted-foreground">Cobranças que se repetem e não são parcelamento</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Resumo label="Por mês" valor={fmtR(d.mensal)} destaque />
          <Resumo label="Por ano" valor={fmtR(d.mensal * 12)} />
          <Resumo label="Ativas" valor={String(d.vivas.length)} />
        </div>
      </div>

      {d.alertas.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5">
          {d.alertas.map((a) => (
            <div key={a.chave} className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-sm">
              {a.mudouValor ? <TrendingUp className="size-4 shrink-0 text-warning" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />}
              <span className="min-w-0">
                <span className="font-medium">{a.nome}</span>{" "}
                {a.mudouValor
                  ? <>mudou de <span className="tnum">{fmtR(a.valorAnterior!)}</span> para <span className="tnum font-semibold">{fmtR(a.valor)}</span> em {fmtMesCurto(a.ultimoMes)}</>
                  : <>não cobra desde {fmtMesCurto(a.ultimoMes)} — cancelou? Se sim, marque como “não é assinatura”.</>}
              </span>
            </div>
          ))}
        </div>
      )}

      {d.assinaturas.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Nenhuma assinatura detectada ainda. Marque abaixo as que você tem.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.assinaturas.map((a, i) => {
            const st = STATUS[a.status]
            const cartao = a.cartaoId ? cartoes.find((c) => c.id === a.cartaoId) : null
            const logo = descricaoIcones[(a.ultimaTx.descricao || "").trim().toLowerCase()] || cartao?.logo || null
            return (
              <motion.div
                key={a.chave}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3), ease: EASE }}
                className={cn("group relative flex flex-col gap-3 rounded-xl border bg-background/40 p-3.5", a.status === "sumiu" && "opacity-60")}
              >
                <div className="flex items-start gap-3">
                  <LogoAvatar src={logo} cor={catColor(a.categoria)} Icon={Smartphone} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-semibold leading-tight">{a.nome}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {cartao ? cartao.nome : "Débito / Pix"} · {a.meses.length} cobrança{a.meses.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => ignorar(a)} disabled={busy}
                    className="-mr-1 -mt-1 grid size-7 place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                    title="Não é assinatura" aria-label={`${a.nome} não é assinatura`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="tnum text-lg font-bold leading-none">{fmtR(a.valor)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                    <p className="tnum mt-1 text-[11px] text-muted-foreground">{fmtR(a.valor * 12)} por ano</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
                      <st.icon className="size-3" /> {st.label}
                    </span>
                    {a.status !== "sumiu" && (
                      <span className="text-[11px] text-muted-foreground">
                        próxima: {cartao ? `fatura ${fmtMesCurto(a.proximoMes)}` : fmtMesCurto(a.proximoMes)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {d.candidatas.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <Plus className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Faltou alguma?</span>
          <Select value="" onValueChange={(chave) => { const c = d.candidatas.find((x) => x.chave === chave); if (c) marcar(c.chave, c.nome) }}>
            <SelectTrigger className="h-9 w-[260px]" disabled={busy}><SelectValue placeholder="Marcar lançamento como assinatura" /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {d.candidatas.map((c) => (
                  <SelectItem key={c.chave} value={c.chave}>{c.nome} · {fmtR(c.valor)}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
    </section>
  )
}

function Resumo({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-1.5", destaque && "border-primary/40 bg-primary/8")}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("tnum text-sm font-bold", destaque && "text-primary")}>{valor}</p>
    </div>
  )
}
