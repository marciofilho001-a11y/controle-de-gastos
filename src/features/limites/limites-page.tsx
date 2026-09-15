import { useState } from "react"
import { Gauge, Copy, Banknote, CreditCard, Shapes, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useFinData } from "@/hooks/use-fin-data"
import { supabase } from "@/lib/supabase"
import { DESPESA_CATS, catColor } from "@/lib/categorias"
import { fmtR, fmtMesRef, addMonths } from "@/lib/format"
import {
  gastoVariavelTotalNoMes, gastoDebitoNoMes, faturaDoMes, gastoCategoriaNoMes,
  getTeto, statusTeto, mediaCategoriaMeses,
} from "@/lib/selectors"
import { cn } from "@/lib/utils"

const statusColor: Record<string, string> = {
  ok: "text-success", alerta: "text-warning", critico: "text-destructive", vazio: "text-muted-foreground",
}

export function LimitesPage({ mesRef }: { mesRef: string }) {
  const { cartoes, transacoes, tetos, loadAll } = useFinData()
  const [copiando, setCopiando] = useState(false)

  async function salvarTeto(escopo: string, cartaoId: number | null, categoria: string | null, valorStr: string) {
    const valor = parseFloat(valorStr)
    const linha = tetos.find(
      (x) =>
        x.mes_ref === mesRef && x.escopo === escopo &&
        (cartaoId ? Number(x.cartao_id) === Number(cartaoId) : !x.cartao_id) &&
        (categoria ? x.categoria === categoria : !x.categoria)
    )
    try {
      if (isNaN(valor) || valor <= 0) {
        if (linha) {
          await supabase.from("fin_tetos").delete().eq("id", linha.id)
          toast.success("Limite removido")
          await loadAll()
        }
        return
      }
      if (linha) {
        await supabase.from("fin_tetos").update({ valor }).eq("id", linha.id)
      } else {
        await supabase.from("fin_tetos").insert({ mes_ref: mesRef, escopo, cartao_id: cartaoId, categoria, valor })
      }
      toast.success("Limite salvo!")
      await loadAll()
    } catch (e) {
      toast.error("Erro ao salvar limite", { description: e instanceof Error ? e.message : "" })
    }
  }

  async function copiarMesAnterior() {
    const anterior = addMonths(mesRef, -1)
    const doAnterior = tetos.filter((t) => t.mes_ref === anterior)
    if (!doAnterior.length) {
      toast.error(`Nenhum limite definido em ${fmtMesRef(anterior)}`)
      return
    }
    setCopiando(true)
    try {
      for (const t of doAnterior) {
        const existente = tetos.find(
          (x) =>
            x.mes_ref === mesRef && x.escopo === t.escopo &&
            String(x.cartao_id || "") === String(t.cartao_id || "") &&
            String(x.categoria || "") === String(t.categoria || "")
        )
        if (existente) await supabase.from("fin_tetos").update({ valor: t.valor }).eq("id", existente.id)
        else await supabase.from("fin_tetos").insert({ mes_ref: mesRef, escopo: t.escopo, cartao_id: t.cartao_id, categoria: t.categoria, valor: t.valor })
      }
      toast.success("Limites copiados!")
      await loadAll()
    } catch (e) {
      toast.error("Erro ao copiar", { description: e instanceof Error ? e.message : "" })
    } finally {
      setCopiando(false)
    }
  }

  const gastoTotal = gastoVariavelTotalNoMes(cartoes, transacoes, mesRef)
  const tetoTotal = getTeto(tetos, mesRef, "total", null, null)
  const stTotal = statusTeto(gastoTotal, tetoTotal)
  const pctTotal = tetoTotal ? Math.min(100, (gastoTotal / tetoTotal) * 100) : 0

  const baldes = [
    { key: "debito", nome: "Débito e dinheiro", icon: Banknote, gasto: gastoDebitoNoMes(transacoes, mesRef), cartaoId: null as number | null, logo: null as string | null },
    ...cartoes.filter((c) => c.ativo !== false).map((c) => ({
      key: `cartao-${c.id}`, nome: c.nome, icon: CreditCard,
      gasto: faturaDoMes(transacoes, c.id, mesRef), cartaoId: c.id, logo: c.logo,
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">
          Limites de Gasto <span className="text-primary">— {fmtMesRef(mesRef)}</span>
        </h2>
        <Button variant="outline" onClick={copiarMesAnterior} disabled={copiando}>
          {copiando ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Copy data-icon="inline-start" />}
          Copiar do mês anterior
        </Button>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Só gasto variável entra aqui — obrigações fixas (consórcio, parcelas) ficam de fora, pro limite medir o que você controla no mês.
      </p>

      {/* Limite total */}
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">Limite total do mês</span>
          {tetoTotal && <Badge variant="secondary" className={statusColor[stTotal]}>{Math.round((gastoTotal / tetoTotal) * 100)}% usado</Badge>}
        </div>
        <p className={cn("tnum text-3xl font-semibold", tetoTotal ? statusColor[stTotal] : "")}>{fmtR(gastoTotal)}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Definir limite:</span>
          <Input
            type="number" step="0.01" defaultValue={tetoTotal ?? ""} placeholder="0,00"
            className="tnum max-w-[140px]"
            onBlur={(e) => salvarTeto("total", null, null, e.target.value)}
          />
        </div>
        {tetoTotal && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", stTotal === "critico" ? "bg-destructive" : stTotal === "alerta" ? "bg-warning" : "bg-primary")} style={{ width: `${pctTotal}%` }} />
          </div>
        )}
        {tetoTotal && stTotal === "critico" && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4" /> Limite estourado em <b>{fmtR(gastoTotal - tetoTotal)}</b>
          </p>
        )}
      </div>

      {/* Por forma de pagamento */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Gauge className="size-3.5" /> Por Forma de Pagamento
        </div>
        <div className="flex flex-col gap-2.5">
          {baldes.map((b) => {
            const teto = getTeto(tetos, mesRef, b.key === "debito" ? "debito" : "cartao", b.cartaoId, null)
            const st = statusTeto(b.gasto, teto)
            const pct = teto ? Math.min(100, (b.gasto / teto) * 100) : 0
            const Icon = b.icon
            return (
              <div key={b.key} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                  {b.logo ? <img src={b.logo} alt="" className="size-full object-contain p-1" /> : <Icon className="size-5" />}
                </span>
                <div className="min-w-[140px] flex-1">
                  <p className="font-medium">{b.nome}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className={cn("h-full rounded-full", st === "critico" ? "bg-destructive" : st === "alerta" ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className={cn("tnum text-sm font-semibold", teto ? statusColor[st] : "text-muted-foreground")}>
                  {fmtR(b.gasto)}{teto ? <span className="text-muted-foreground"> / {fmtR(teto)}</span> : null}
                </span>
                <Input
                  type="number" step="0.01" defaultValue={teto ?? ""} placeholder="sem limite"
                  className="tnum w-[130px]"
                  onBlur={(e) => salvarTeto(b.key === "debito" ? "debito" : "cartao", b.cartaoId, null, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </section>

      {/* Metas por categoria */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Shapes className="size-3.5" /> Metas por Categoria
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Opcional — o Relatório usa a meta como "previsto" quando ela existe; sem meta, usa a média dos últimos meses.
        </p>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {DESPESA_CATS.filter((c) => c.v !== "cartao" && c.v !== "outro").map((c) => {
            const meta = getTeto(tetos, mesRef, "categoria", null, c.v)
            const gastoAtual = gastoCategoriaNoMes(transacoes, c.v, mesRef)
            const media = mediaCategoriaMeses(transacoes, c.v, mesRef, 3)
            const Icon = c.icon
            const cor = catColor(c.v)
            return (
              <div key={c.v} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg" style={{ background: `${cor}1f`, color: cor }}>
                    <Icon className="size-4" />
                  </span>
                  <span className="font-medium">{c.l}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Média (3m)</span>
                  <span className="tnum">{media > 0 ? fmtR(media) : "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Gasto atual</span>
                  <span className="tnum font-medium">{fmtR(gastoAtual)}</span>
                </div>
                <Input
                  type="number" step="0.01" defaultValue={meta ?? ""} placeholder="sem meta"
                  className="tnum"
                  onBlur={(e) => salvarTeto("categoria", null, c.v, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
