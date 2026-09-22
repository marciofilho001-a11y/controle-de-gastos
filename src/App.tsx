import { useEffect, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "@/components/layout/header"
import { NavBar, type TabId } from "@/components/layout/nav"
import { RelatorioPage } from "@/features/relatorio/relatorio-page"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { TransacoesPage } from "@/features/transacoes/transacoes-page"
import { ObrigacoesPage } from "@/features/obrigacoes/obrigacoes-page"
import { CartoesPage } from "@/features/cartoes/cartoes-page"
import { LimitesPage } from "@/features/limites/limites-page"
import { ProjecaoPage } from "@/features/projecao/projecao-page"
import { InvestimentosPage } from "@/features/investimentos/investimentos-page"
import { ChatAssistente } from "@/features/chat/chat-assistente"
import { useFinData } from "@/hooks/use-fin-data"
import { addMonths, mesRefAtual } from "@/lib/format"
import { Loader2 } from "lucide-react"

export default function App() {
  const [tab, setTab] = useState<TabId>("dashboard")
  const [mesRef, setMesRef] = useState(mesRefAtual())
  const { loading, error, loadAll } = useFinData()

  useEffect(() => {
    loadAll()
  }, [loadAll])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto min-h-[100dvh] w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
        <Header mesRef={mesRef} onMonthChange={(d) => setMesRef((m) => addMonths(m, d))} />
        <div className="mt-4">
          <NavBar active={tab} onChange={setTab} />
        </div>

        <main className="mt-6 pb-24">
          {loading ? (
            <div className="grid min-h-[50vh] place-items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="grid min-h-[40vh] place-items-center rounded-xl border border-destructive/30 bg-destructive/5">
              <div className="text-center">
                <p className="font-medium text-destructive">Erro ao carregar dados</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : tab === "dashboard" ? (
            <DashboardPage mesRef={mesRef} />
          ) : tab === "obrigacoes" ? (
            <ObrigacoesPage mesRef={mesRef} />
          ) : tab === "cartoes" ? (
            <CartoesPage mesRef={mesRef} />
          ) : tab === "limites" ? (
            <LimitesPage mesRef={mesRef} />
          ) : tab === "projecao" ? (
            <ProjecaoPage mesRef={mesRef} />
          ) : tab === "investimentos" ? (
            <InvestimentosPage mesRef={mesRef} />
          ) : tab === "transacoes" ? (
            <TransacoesPage mesRef={mesRef} />
          ) : tab === "relatorio" ? (
            <RelatorioPage mesRef={mesRef} />
          ) : null}
        </main>
      </div>
      {!loading && !error && <ChatAssistente mesRef={mesRef} />}
      <Toaster position="bottom-right" richColors />
    </TooltipProvider>
  )
}
