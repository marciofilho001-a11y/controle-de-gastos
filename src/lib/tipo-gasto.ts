import {
  Beer, Wine, Martini, CupSoda, PartyPopper, TreePalm, Goal, Gamepad2, FlaskRound, HandCoins,
  Scissors, Flame, Plane, Popcorn, Music, Coffee, Pizza, IceCream, Zap, Gift, Cake, Ticket, Dumbbell,
  type LucideIcon,
} from "lucide-react"
import { normalizarTexto, temaDaDescricao, temasComExtras, type Tema } from "@/lib/temas"

// ---------------------------------------------------------------------------
// "Tipo de gasto": o sistema lê a descrição de cada lançamento e entende que
// forma de gasto ele é (cerveja, jogo, perfume, pagamento a alguém...), dando
// um ícone próprio e um grupo — pra organizar uma categoria grande como Lazer.
//
// Ordem importa: a primeira regra que casar decide ("Futebol Pintores e cerveja"
// cai em futebol, não em cerveja). Sem regra fina, cai no tema geral (temas.ts,
// que também aceita palavras extras do usuário) e por fim em "Outros".
// ---------------------------------------------------------------------------

export type TipoGasto = {
  key: string
  grupo: string        // nome do grupo (chips e cabeçalhos de seção)
  icon: LucideIcon
  cor: string
}

type Regra = TipoGasto & { palavras: string[] }

const REGRAS: Regra[] = [
  { key: "esporte", grupo: "Esporte", icon: Goal, cor: "#22c55e",
    palavras: ["futebol", "pelada", "society", "futsal", "quadra", "volei", "beach tennis", "tenis de mesa", "basquete", "jiu jitsu"] },
  { key: "pagamento", grupo: "Pagamentos e Pix", icon: HandCoins, cor: "#38bdf8",
    palavras: ["pagamento", "pagamentos", "pix", "transferencia", "repasse", "emprestimo", "acerto", "reembolso", "vaquinha", "rateio"] },
  { key: "cerveja", grupo: "Bebidas", icon: Beer, cor: "#f59e0b",
    palavras: ["cerveja", "cervejas", "chopp", "chope", "heineken", "skol", "brahma", "budweiser", "stella", "corona", "amstel", "spaten", "breja", "cervejaria"] },
  { key: "vinho", grupo: "Bebidas", icon: Wine, cor: "#e11d48",
    palavras: ["vinho", "vinhos", "espumante", "champagne", "prosecco", "vinicola"] },
  { key: "ice", grupo: "Bebidas", icon: CupSoda, cor: "#06b6d4",
    palavras: ["ice", "smirnoff", "refri", "refrigerante", "energetico", "redbull", "red bull", "monster", "suco", "agua"] },
  { key: "destilado", grupo: "Bebidas", icon: Martini, cor: "#a78bfa",
    palavras: ["bebida", "bebidas", "vodka", "whisky", "gin", "cachaca", "tequila", "licor", "drink", "drinks", "caipirinha", "coquetel", "aperol", "campari", "jagermeister", "bar", "boteco", "pub", "balada"] },
  { key: "festa", grupo: "Festas e rolês", icon: PartyPopper, cor: "#ec4899",
    palavras: ["festa", "festas", "role", "aniversario", "confraternizacao", "happy hour", "open bar", "camarote"] },
  { key: "evento", grupo: "Festas e rolês", icon: Ticket, cor: "#f472b6",
    palavras: ["evento", "eventos", "show", "shows", "ingresso", "ingressos", "festival", "balada", "sympla"] },
  { key: "praia", grupo: "Viagem e passeios", icon: TreePalm, cor: "#14b8a6",
    palavras: ["praia", "passeio", "trilha", "barco", "lancha", "camping", "ilha"] },
  { key: "viagem", grupo: "Viagem e passeios", icon: Plane, cor: "#0ea5e9",
    palavras: ["viagem", "hotel", "hospedagem", "pousada", "airbnb", "booking", "passagem", "voo", "aereo", "latam"] },
  { key: "cinema", grupo: "Cinema e música", icon: Popcorn, cor: "#f97316",
    palavras: ["cinema", "filme", "teatro", "kinoplex", "cinemark", "ingresso.com"] },
  { key: "musica", grupo: "Cinema e música", icon: Music, cor: "#8b5cf6",
    palavras: ["spotify", "deezer", "musica", "karaoke", "violao", "guitarra"] },
  { key: "jogos", grupo: "Jogos", icon: Gamepad2, cor: "#6366f1",
    palavras: ["steam", "jogo", "jogos", "game", "games", "psn", "xbox", "nintendo", "epic", "playstation", "ps plus", "gamepass", "game pass", "riot", "valorant", "fifa", "fortnite", "roblox"] },
  { key: "perfume", grupo: "Perfumes", icon: FlaskRound, cor: "#0d9488",
    palavras: ["perfume", "perfumes", "colonia", "fragrancia", "boticario", "natura", "lattafa", "fakhar", "liquid brun", "coffe duo", "coffee duo", "decant", "eau de parfum", "parfum", "amakha"] },
  { key: "cuidados", grupo: "Cuidados pessoais", icon: Scissors, cor: "#14b8a6",
    palavras: ["barbearia", "barbeiro", "cabelo", "pomada", "skincare", "shampoo", "creme", "tatuagem", "manicure", "unha", "sobrancelha"] },
  { key: "churrasco", grupo: "Comida e lanches", icon: Flame, cor: "#ef4444",
    palavras: ["churrasco", "churras", "carne", "picanha", "linguica", "espetinho", "costela"] },
  { key: "pizza", grupo: "Comida e lanches", icon: Pizza, cor: "#f97316",
    palavras: ["pizza", "pizzaria", "lanche", "lanches", "hamburguer", "burger", "hot dog", "dogao", "xis", "sanduiche"] },
  { key: "sobremesa", grupo: "Comida e lanches", icon: IceCream, cor: "#f472b6",
    palavras: ["sorvete", "acai", "sobremesa", "doce", "chocolate", "milkshake"] },
  { key: "cafe", grupo: "Comida e lanches", icon: Coffee, cor: "#a16207",
    palavras: ["cafe", "cafeteria", "padaria", "starbucks", "cappuccino"] },
  { key: "bolo", grupo: "Presentes", icon: Cake, cor: "#fb7185",
    palavras: ["bolo", "confeitaria", "docinhos"] },
  { key: "presente", grupo: "Presentes", icon: Gift, cor: "#f43f5e",
    palavras: ["presente", "presentes", "lembrancinha", "mimo"] },
  { key: "academia", grupo: "Academia e fitness", icon: Dumbbell, cor: "#8b5cf6",
    palavras: ["academia", "whey", "creatina", "suplemento", "smartfit", "crossfit", "personal"] },
  { key: "energia", grupo: "Contas", icon: Zap, cor: "#eab308",
    palavras: ["luz", "energia", "celesc", "internet", "agua e esgoto", "casan"] },
]

export const TIPO_OUTROS = "Outros"

function casa(d: string, tokens: Set<string>, palavras: string[]): boolean {
  for (const p of palavras) {
    if (p.includes(" ")) { if (d.includes(p)) return true }
    else if (tokens.has(p)) return true
  }
  return false
}

export function tipoDoGasto(
  descricao: string | null | undefined,
  temas: Tema[] = temasComExtras(null),
): TipoGasto | null {
  const d = normalizarTexto(descricao)
  if (!d) return null
  const tokens = new Set(d.split(" "))
  for (const r of REGRAS) {
    if (casa(d, tokens, r.palavras)) return { key: r.key, grupo: r.grupo, icon: r.icon, cor: r.cor }
  }
  // sem regra fina: tema geral (supermercado, uber, assinaturas, faculdade...),
  // que também inclui as palavras que o usuário ensinou em temas_extra
  const t = temaDaDescricao(descricao, temas)
  if (t) return { key: `tema:${t.key}`, grupo: t.titulo, icon: t.icon, cor: t.cor }
  return null
}
