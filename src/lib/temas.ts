// ---------------------------------------------------------------------------
// Temas de gasto: agrupamento por PALAVRAS DA DESCRIÇÃO, transversal às
// categorias. É o que permite frases como "você gastou R$X em bebida" mesmo
// bebida não sendo uma categoria (está dentro de Lazer/Alimentação).
//
// Extensível pelo usuário via fin_config.temas_extra (JSON):
//   { "bebida": ["pietro"], "mercado": ["angeloni"] }
// ---------------------------------------------------------------------------

export type TemaKey =
  | "bebida" | "mercado" | "delivery" | "perfumes" | "games" | "eletronicos"
  | "suplementos" | "transporte_app" | "assinaturas" | "barbearia" | "roupas"

export type Tema = {
  key: TemaKey
  label: string          // como aparece na frase
  palavras: string[]     // termos (sem acento, minúsculo) que marcam o tema
  discricionario: boolean // true = gasto por escolha (vilão em potencial)
}

export const TEMAS: Tema[] = [
  { key: "bebida", label: "bebida e saídas", discricionario: true,
    palavras: ["cerveja", "cervejas", "bebida", "bebidas", "ice", "vinho", "vodka", "whisky", "gin", "drink", "bar", "balada", "festa", "chopp", "chope", "boteco", "pub"] },
  { key: "delivery", label: "comida fora de casa", discricionario: true,
    palavras: ["ifood", "pizza", "pizzaria", "lanche", "lanches", "hamburguer", "burger", "sushi", "restaurante", "delivery", "rappi", "hot dog", "dogao", "espetinho", "acai", "sorvete", "padaria"] },
  { key: "mercado", label: "mercado", discricionario: false,
    palavras: ["koch", "komprao", "mercado", "supermercado", "atacadao", "angeloni", "giassi", "bistek", "carrefour", "big", "hortifruti", "feira", "acougue"] },
  { key: "perfumes", label: "perfumes", discricionario: true,
    palavras: ["perfume", "perfumes", "colonia", "fragrancia", "boticario", "natura", "lattafa", "fakhar", "liquid brun", "coffe duo"] },
  { key: "games", label: "jogos", discricionario: true,
    palavras: ["steam", "jogo", "jogos", "game", "games", "playstation", "psn", "xbox", "nintendo", "epic"] },
  { key: "eletronicos", label: "eletrônicos e tech", discricionario: true,
    palavras: ["terabyte", "terabyteshop", "kabum", "pichau", "notebook", "monitor", "teclado", "mouse", "placa", "ssd", "fone", "celular", "iphone", "samsung", "amazon", "aliexpress", "shopee", "mercado livre"] },
  { key: "suplementos", label: "academia e suplementos", discricionario: false,
    palavras: ["elemento fit", "whey", "creatina", "suplemento", "suplementos", "academia", "growth", "max titanium", "integralmedica"] },
  { key: "transporte_app", label: "Uber e transporte por app", discricionario: true,
    palavras: ["uber", "99", "99pop", "cabify", "indriver", "taxi"] },
  { key: "assinaturas", label: "assinaturas", discricionario: true,
    palavras: ["netflix", "spotify", "youtube", "yt premium", "prime video", "disney", "hbo", "max", "globoplay", "investidor 10", "investidor10", "chatgpt", "claude", "icloud", "google one"] },
  { key: "barbearia", label: "barbearia e cuidados", discricionario: true,
    palavras: ["barbearia", "barbeiro", "cabelo", "leave in", "zacca", "pomada", "skincare"] },
  { key: "roupas", label: "roupas e calçados", discricionario: true,
    palavras: ["nike", "adidas", "jaqueta", "tenis", "camisa", "camiseta", "calca", "bermuda", "roupa", "roupas", "sapato", "renner", "riachuelo", "c&a", "zara", "shein"] },
]

export function normalizarTexto(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*\(\d+\/\d+\)\s*$/, "") // remove "(2/6)" de parcelas
    .replace(/[^a-z0-9&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Mescla termos extras vindos da config (JSON) no dicionário base
export function temasComExtras(extraJson?: string | null): Tema[] {
  if (!extraJson) return TEMAS
  try {
    const extra = JSON.parse(extraJson) as Record<string, string[]>
    return TEMAS.map((t) => {
      const mais = extra[t.key]
      return Array.isArray(mais) && mais.length
        ? { ...t, palavras: [...t.palavras, ...mais.map((p) => normalizarTexto(p))] }
        : t
    })
  } catch {
    return TEMAS
  }
}

// Primeiro tema cuja palavra aparece na descrição (palavra inteira ou termo composto)
export function temaDaDescricao(descricao: string | null | undefined, temas: Tema[] = TEMAS): Tema | null {
  const d = normalizarTexto(descricao)
  if (!d) return null
  const tokens = new Set(d.split(" "))
  for (const t of temas) {
    for (const p of t.palavras) {
      if (p.includes(" ")) { if (d.includes(p)) return t }
      else if (tokens.has(p)) return t
    }
  }
  return null
}

// Nome "comercial" de uma transação: descrição sem "(x/y)" e capitalizada
export function nomeComercial(descricao: string | null | undefined): string {
  const base = (descricao || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim()
  return base || "Sem descrição"
}
