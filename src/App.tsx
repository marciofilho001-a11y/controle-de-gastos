import { useEffect, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Header } from "@/components/layout/header"
import { NavBar, TabBar, type TabId } from "@/components/layout/nav"
import { RelatorioPage } from "@/features/relatorio/relatorio-page"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { TransacoesPage } from "@/features/transacoes/transacoes-page"
import { ObrigacoesPage } from "@/features/obrigacoes/obrigacoes-page"
import { CartoesPage } from "@/features/cartoes/cartoes-page"
import { ProjecaoPage } from "@/features/projecao/projecao-page"
import { FechamentoPage } from "@/features/fechamento/fechamento-page"
import { HistoricoPage } from "@/features/historico/historico-page"
import { ChatAssistente } from "@/features/chat/chat-assistente"
import { LancarRapido } from "@/features/lancar/lancar-rapido"
import { useFinData } from "@/hooks/use-fin-data"
import { addMonths, mesRefAtual } from "@/lib/format"
import { Loader2 } from "@/lib/icons"

export default function App() {
  const [tab, setTab] = useState<TabId>("dashboard")
  const [mesRef, setMesRef] = useState(mesRefAtual())
  const { loading, error, loadAll } = useFinData()

  const [rolou, setRolou] = useState(false)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // a barra superior só ganha sombra quando há conteúdo passando por baixo dela
  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 4)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // ícone "Lançar" da tela inicial: só a tela de lançamento rápido, sem o app inteiro
  if (window.location.pathname.startsWith("/lancar")) {
    return (
      <>
        <LancarRapido />
        <Toaster position="top-center" richColors />
      </>
    )
  }

  // troca de aba sempre começa do topo (sem herdar a rolagem da aba anterior)
  const irPara = (t: TabId) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app-bar sticky top-0 z-40" data-scrolled={rolou}>
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 pb-2.5 sm:px-6 lg:px-8">
          <Header mesRef={mesRef} onMonthChange={(d) => setMesRef((m) => addMonths(m, d))} />
          <div className="mt-2.5 hidden md:block">
            <NavBar active={tab} onChange={irPara} />
          </div>
        </div>
      </div>

      <div className="mx-auto min-h-[100dvh] w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <main className="pt-5 pb-32 md:pb-24">
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
            <DashboardPage mesRef={mesRef} onNavigate={irPara} />
          ) : tab === "obrigacoes" ? (
            <ObrigacoesPage mesRef={mesRef} />
          ) : tab === "cartoes" ? (
            <CartoesPage mesRef={mesRef} />
          ) : tab === "projecao" ? (
            <ProjecaoPage mesRef={mesRef} />
          ) : tab === "transacoes" ? (
            <TransacoesPage mesRef={mesRef} />
          ) : tab === "fechamento" ? (
            <FechamentoPage mesRef={mesRef} onNavigate={irPara} />
          ) : tab === "historico" ? (
            <HistoricoPage mesRef={mesRef} />
          ) : tab === "relatorio" ? (
            <RelatorioPage mesRef={mesRef} />
          ) : null}
        </main>
      </div>
      <TabBar active={tab} onChange={irPara} />
      {!loading && !error && <ChatAssistente mesRef={mesRef} />}
      <Toaster position="bottom-center" richColors offset={24} mobileOffset={{ bottom: 92 }} />
    </TooltipProvider>
  )
}
