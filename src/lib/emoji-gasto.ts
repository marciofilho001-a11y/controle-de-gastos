import { tipoDoGasto } from "@/lib/tipo-gasto"
import type { Tema } from "@/lib/temas"

// Emoji (Fluent Emoji Flat) de cada lançamento: primeiro o tipo de gasto lido da descrição
// (cerveja, pizza, steam, academia...), depois a categoria.

const POR_TIPO: Record<string, string> = {
  esporte: "soccer-ball", pagamento: "money-with-wings", cerveja: "clinking-beer-mugs", vinho: "wine-glass",
  ice: "cup-with-straw", destilado: "cocktail-glass", festa: "party-popper", evento: "admission-tickets",
  praia: "beach-with-umbrella", viagem: "airplane", cinema: "popcorn", musica: "musical-notes", jogos: "video-game",
  perfume: "lotion-bottle", cuidados: "barber-pole", churrasco: "cut-of-meat", pizza: "pizza", sobremesa: "soft-ice-cream",
  cafe: "hot-beverage", bolo: "birthday-cake", presente: "wrapped-gift", academia: "flexed-biceps", energia: "high-voltage",
  // temas gerais (temas.ts)
  "tema:bebida": "beer-mug", "tema:delivery": "takeout-box", "tema:mercado": "shopping-cart", "tema:perfumes": "lotion-bottle",
  "tema:barbearia": "barber-pole", "tema:farmacia": "pill", "tema:consultas": "stethoscope", "tema:suplementos": "flexed-biceps",
  "tema:faculdade": "graduation-cap", "tema:cursos": "laptop", "tema:livros": "books", "tema:eletronicos": "mobile-phone",
  "tema:roupas": "t-shirt", "tema:casa": "house", "tema:games": "video-game", "tema:assinaturas": "television",
  "tema:transporte_app": "taxi", "tema:combustivel": "fuel-pump", "tema:estacionamento": "p-button",
}

const POR_CATEGORIA: Record<string, string> = {
  moradia: "house", cartao: "credit-card", consorcio: "handshake", financiamento: "classical-building",
  saude: "red-heart", educacao: "graduation-cap", transporte: "automobile", alimentacao: "fork-and-knife-with-plate",
  lazer: "confetti-ball", compras: "shopping-bags", assinatura: "spiral-calendar", fatura_indefinida: "receipt",
  outro: "package",
}
const POR_RECEITA: Record<string, string> = {
  salario: "money-bag", freelance: "briefcase", investimento: "chart-increasing", outro: "dollar-banknote",
}

export function emojiDoLancamento(
  t: { descricao?: string | null; categoria?: string | null; tipo?: string | null },
  temas?: Tema[],
): string {
  if (t.tipo === "receita") return POR_RECEITA[t.categoria || "outro"] ?? "dollar-banknote"
  if (t.categoria === "fatura_indefinida") return "receipt"
  const tipo = tipoDoGasto(t.descricao, temas)
  if (tipo && POR_TIPO[tipo.key]) return POR_TIPO[tipo.key]
  return POR_CATEGORIA[t.categoria || "outro"] ?? "package"
}
