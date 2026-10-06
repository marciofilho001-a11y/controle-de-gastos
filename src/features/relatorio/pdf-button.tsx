import { useState } from "react"
import { FileDown, Loader2 } from "@/lib/icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useFinData } from "@/hooks/use-fin-data"
import { gerarRelatorioPdf } from "./relatorio-pdf"

export function PdfButton({ mesRef }: { mesRef: string }) {
  const { transacoes, cartoes, obrigacoes, tetos, config } = useFinData()
  const [busy, setBusy] = useState(false)

  async function gerar() {
    setBusy(true)
    try {
      await gerarRelatorioPdf({ transacoes, cartoes, obrigacoes, tetos, config, mesRef })
      toast.success("PDF gerado — confira seus downloads")
    } catch (e) {
      toast.error("Erro ao gerar PDF", { description: e instanceof Error ? e.message : "" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" onClick={gerar} disabled={busy}>
      {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <FileDown data-icon="inline-start" />}
      Gerar PDF
    </Button>
  )
}
