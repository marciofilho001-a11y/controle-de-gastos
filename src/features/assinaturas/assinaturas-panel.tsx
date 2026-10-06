import { useMemo, useState } from "react"
import { logoDoLancamento } from "@/lib/marcas"
import { toast } from "sonner"
import { Repeat, TrendingUp, AlertTriangle, Plus, X, Smartphone } from "@/lib/icons"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { LogoAvatar } from "@/components/logo-avatar"
import { useFinData } from "@/hooks/use-fin-data"
import { catColor } from "@/lib/categorias"
import { fmtR, fmtMesCurto } from "@/lib/format"
import { detectarAssinaturas, lerLista, type Assinatura, type StatusAssinatura } from "@/lib/assinaturas"
import { cn } from "@/lib/utils"


const STATUS: Record<StatusAssinatura, { label: string; dot: string }> = {
  ativa: { label: "Ativa", dot: "bg-success" },
  nova: { label: "1ª cobrança", dot: "bg-primary" },
  pendente: { label: "Ainda não cobrou", dot: "bg-warning" },
  sumiu: { label: "Sumiu", dot: "bg-muted-foreground" },
}

export function AssinaturasPanel({ mesRef, compacto = false }: { mesRef: string; compacto?: boolean }) {
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
    <section className="rounded-2xl border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary"><Repeat className="size-4" /></span>
          <div>
            <h3 className="font-display text-lg font-semibold leading-tight">Assinaturas</h3>
            <p className="text-xs text-muted-foreground">{compacto ? `${d.vivas.length} ativas · ${fmtR(d.mensal)}/mês` : "Cobranças que se repetem e não são parcelamento"}</p>
          </div>
        </div>
        <div className={cn("ml-auto flex flex-wrap gap-2", compacto && "hidden")}>
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
        <div className="-mx-2 flex flex-col">
          {d.assinaturas.map((a) => {
            const st = STATUS[a.status]
            const cartao = a.cartaoId ? cartoes.find((c) => c.id === a.cartaoId) : null
            const logo = logoDoLancamento(a.ultimaTx.descricao, descricaoIcones) || cartao?.logo || null
            return (
              <div
                key={a.chave}
                className={cn("group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-secondary/40", a.status === "sumiu" && "opacity-60")}
              >
                <LogoAvatar src={logo} cor={catColor(a.categoria)} Icon={Smartphone} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">{a.nome}</p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <span className={cn("size-1.5 shrink-0 rounded-full", st.dot)} />
                    <span className="truncate">
                      {st.label} · {cartao ? cartao.nome : "Débito / Pix"}
                      {a.status !== "sumiu" && <> · próxima {cartao ? `fatura ${fmtMesCurto(a.proximoMes)}` : fmtMesCurto(a.proximoMes)}</>}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum font-semibold leading-tight">{fmtR(a.valor)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                  <p className="tnum mt-0.5 text-xs text-muted-foreground">{fmtR(a.valor * 12)}/ano</p>
                </div>
                <button
                  onClick={() => ignorar(a)} disabled={busy}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  title="Não é assinatura" aria-label={`${a.nome} não é assinatura`}
                >
                  <X className="size-4" />
                </button>
              </div>
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
    <div className="rounded-xl bg-secondary/60 px-3 py-1.5">
      <p className="text-[0.72rem] text-muted-foreground">{label}</p>
      <p className={cn("tnum text-sm font-semibold", destaque && "text-foreground")}>{valor}</p>
    </div>
  )
}
