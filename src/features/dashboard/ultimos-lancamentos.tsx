import { ArrowRight, ListOrdered } from "lucide-react"
import type { Transacao } from "@/lib/supabase"
import { catInfo, catColor, RECEITA_CATS } from "@/lib/categorias"
import { fmtR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Painel, LinkAcao } from "./painel"

// Tabela curta com os lançamentos mais recentes do mês; clicar abre a edição
export function UltimosLancamentos({
  lancamentos, onEditar, onVerTodos, index, max = 4,
}: { lancamentos: Transacao[]; onEditar: (t: Transacao) => void; onVerTodos: () => void; index?: number; max?: number }) {
  const linhas = lancamentos.slice(0, max)
  return (
    <Painel
      icon={ListOrdered} titulo="Últimos lançamentos" index={index}
      acao={<LinkAcao onClick={onVerTodos}>Ver todos <ArrowRight className="size-3.5" /></LinkAcao>}
    >
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.68rem] font-medium tracking-wider text-muted-foreground uppercase">
              <th className="w-14 px-1 pb-2 font-medium">Data</th>
              <th className="px-1 pb-2 font-medium">Descrição</th>
              <th className="hidden px-1 pb-2 font-medium sm:table-cell">Categoria</th>
              <th className="px-1 pb-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((t) => {
              const receita = t.tipo === "receita"
              const info = receita ? RECEITA_CATS.find((c) => c.v === t.categoria) ?? catInfo(t.categoria) : catInfo(t.categoria)
              const Icon = info.icon
              const virtual = t.id < 0
              return (
                <tr
                  key={t.id}
                  onClick={virtual ? undefined : () => onEditar(t)}
                  className={cn("border-t border-border/60", !virtual && "cursor-pointer hover:bg-secondary/40")}
                >
                  <td className="tnum px-1 py-2.5 whitespace-nowrap text-muted-foreground">{t.data.slice(8, 10)}/{t.data.slice(5, 7)}</td>
                  <td className="max-w-0 px-1 py-2.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className="size-4 shrink-0" style={{ color: receita ? "var(--success)" : catColor(t.categoria) }} />
                      <span className="truncate">{t.descricao}</span>
                    </span>
                  </td>
                  <td className="hidden px-1 py-2.5 text-muted-foreground sm:table-cell">{info.l}</td>
                  <td className={cn("tnum px-1 py-2.5 text-right font-semibold whitespace-nowrap", receita ? "text-success" : "text-destructive")}>
                    {receita ? "+ " : "- "}{fmtR(Number(t.valor))}
                  </td>
                </tr>
              )
            })}
            {!linhas.length && (
              <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum lançamento neste mês</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Painel>
  )
}
