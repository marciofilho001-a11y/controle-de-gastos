import { LogoAvatar } from "@/components/logo-avatar"
import { logoDoLancamento } from "@/lib/marcas"
import { temaDaDescricao, temasComExtras } from "@/lib/temas"
import { catInfo, catColor, RECEITA_CATS } from "@/lib/categorias"
import { useFinData } from "@/hooks/use-fin-data"

// Ícone de um lançamento, na ordem: logo da marca (escolhida ou detectada) → ícone do tema
// pelas palavras da descrição (cerveja → garrafa, mercado → carrinho) → ícone da categoria.
// Mesma regra em todas as listas, pra uma cerveja nunca virar controle de videogame.
export function IconeLancamento({
  descricao, categoria, tipo = "despesa", size = 32,
}: { descricao?: string | null; categoria?: string | null; tipo?: "despesa" | "receita"; size?: number }) {
  const { descricaoIcones, config } = useFinData()
  const logo = logoDoLancamento(descricao, descricaoIcones)
  const tema = tipo === "despesa" ? temaDaDescricao(descricao, temasComExtras(config.temas_extra)) : null
  const info = tipo === "receita" ? RECEITA_CATS.find((c) => c.v === categoria) ?? catInfo(categoria) : catInfo(categoria)
  const Icon = tema ? tema.icon : info.icon
  const cor = tipo === "receita" ? "var(--success)" : tema ? tema.cor : catColor(categoria)
  return <LogoAvatar src={logo} cor={cor} Icon={Icon} size={size} />
}
