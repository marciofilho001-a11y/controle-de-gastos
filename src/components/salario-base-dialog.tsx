import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "@/lib/icons"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFinData } from "@/hooks/use-fin-data"
import { desligarSalarioBase, lerSalarioBase, mesAtual, salvarSalarioBase } from "@/lib/salario-base"
import { addMonths, fmtMesCurto, fmtR } from "@/lib/format"
import { numeroBR } from "@/lib/importar-arquivo"

export function SalarioBaseDialog({ aberto, onOpenChange }: { aberto: boolean; onOpenChange: (v: boolean) => void }) {
  const config = useFinData((s) => s.config)
  const base = lerSalarioBase(config)
  const ligado = !!base?.ativo
  const [valor, setValor] = useState("")
  const [dia, setDia] = useState("5")
  const [descricao, setDescricao] = useState("Salário")
  const [busy, setBusy] = useState<"salvar" | "desligar" | null>(null)

  useEffect(() => {
    if (!aberto) return
    setValor(base ? String(base.valor).replace(".", ",") : "")
    setDia(String(base?.dia ?? 5))
    setDescricao(base?.descricao ?? "Salário")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const v = numeroBR(valor) ?? 0
  const d = Number(dia)
  const ok = v > 0 && d >= 1 && d <= 31 && descricao.trim().length > 0

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!ok) return
    setBusy("salvar")
    try {
      await salvarSalarioBase({ valor: Math.round(v * 100) / 100, dia: d, descricao: descricao.trim() })
      toast.success(`Salário fixo de ${fmtR(v)} todo dia ${d}`, {
        description: `Lançado de ${fmtMesCurto(mesAtual()).toLowerCase()} até ${fmtMesCurto(addMonths(mesAtual(), 11)).toLowerCase()}. Mudar um mês à mão vale só pra ele.`,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error("Não consegui salvar", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  async function desligar() {
    setBusy("desligar")
    try {
      await desligarSalarioBase()
      toast("Salário fixo desligado", { description: "Saiu dos próximos meses; o deste mês e os anteriores ficaram." })
      onOpenChange(false)
    } catch (err) {
      toast.error("Não consegui desligar", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Salário fixo</DialogTitle>
          <DialogDescription>
            Entra como receita em todos os meses, deste até 12 meses à frente. Se um mês for diferente, edite só ele em Transações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sb-valor">Valor por mês</Label>
            <Input id="sb-valor" inputMode="decimal" placeholder="3.000,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sb-dia">Cai no dia</Label>
              <Input id="sb-dia" type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sb-desc">Nome</Label>
              <Input id="sb-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={!ok || !!busy}>
            {busy === "salvar" && <Loader2 className="size-4 animate-spin" />} {ligado ? "Atualizar salário fixo" : "Ligar salário fixo"}
          </Button>
          {ligado && (
            <Button type="button" variant="ghost" onClick={desligar} disabled={!!busy} className="text-muted-foreground">
              {busy === "desligar" && <Loader2 className="size-4 animate-spin" />} Desligar (tira dos próximos meses)
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
