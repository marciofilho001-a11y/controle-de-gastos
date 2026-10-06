import {
  Beer, GraduationCap, School, BookOpen, SprayCan, Scissors, Pill, Stethoscope, Dumbbell,
  UtensilsCrossed, ShoppingCart, Laptop, Shirt, Home, Gamepad2, Tv, Car, Fuel, ParkingCircle,
  type LucideIcon,
} from "@/lib/icons"

// ---------------------------------------------------------------------------
// Temas de gasto: agrupamento por PALAVRAS DA DESCRIÇÃO, transversal às
// categorias. É o que permite frases como "você gastou R$X em bebida" mesmo
// bebida não sendo uma categoria (está dentro de Lazer/Alimentação).
//
// Extensível pelo usuário via fin_config.temas_extra (JSON):
//   { "bebida": ["pietro"], "mercado": ["angeloni"] }
// ---------------------------------------------------------------------------

export type TemaKey =
  | "bebida" | "delivery" | "mercado" | "perfumes" | "barbearia" | "farmacia" | "consultas"
  | "suplementos" | "faculdade" | "cursos" | "livros" | "eletronicos" | "roupas" | "casa"
  | "games" | "assinaturas" | "transporte_app" | "combustivel" | "estacionamento"

export type Tema = {
  key: TemaKey
  label: string           // como aparece na frase do gestor ("você gastou R$X em ...")
  titulo: string          // como aparece em tabelas (subcategoria)
  grupo: string           // agrupamento por comportamento (PDF, seção 2)
  icon: LucideIcon
  cor: string
  palavras: string[]      // termos (sem acento, minúsculo) que marcam o tema
  discricionario: boolean // true = gasto por escolha (vilão em potencial)
}

// A ORDEM importa: a primeira palavra encontrada decide ("curso claude" cai em cursos, não em assinaturas)
export const TEMAS: Tema[] = [
  { key: "bebida", label: "bebida e saídas", titulo: "Bebidas e saídas", grupo: "Saídas e bebidas", icon: Beer, cor: "#f59e0b", discricionario: true,
    palavras: ["cerveja", "cervejas", "bebida", "bebidas", "ice", "vinho", "vodka", "whisky", "gin", "drink", "drinks", "bar", "balada", "festa", "festas", "chopp", "chope", "boteco", "pub", "evento", "show", "ingresso"] },
  { key: "cursos", label: "cursos", titulo: "Cursos", grupo: "Educação", icon: GraduationCap, cor: "#f97316", discricionario: false,
    palavras: ["curso", "cursos", "udemy", "alura", "hotmart", "workshop", "treinamento", "aula", "aulas"] },
  { key: "faculdade", label: "faculdade", titulo: "Faculdade", grupo: "Educação", icon: School, cor: "#ea580c", discricionario: false,
    palavras: ["univali", "faculdade", "universidade", "mensalidade", "matricula", "semestre", "tcc"] },
  { key: "livros", label: "livros", titulo: "Livros", grupo: "Educação", icon: BookOpen, cor: "#fb923c", discricionario: false,
    palavras: ["livro", "livros", "kindle", "apostila", "amazon livros"] },
  { key: "perfumes", label: "perfumes", titulo: "Perfumes e cosméticos", grupo: "Perfumaria", icon: SprayCan, cor: "#0d9488", discricionario: true,
    palavras: ["perfume", "perfumes", "colonia", "fragrancia", "boticario", "natura", "lattafa", "fakhar", "liquid brun", "coffe duo", "cosmetico", "cosmeticos"] },
  { key: "barbearia", label: "cuidados pessoais", titulo: "Cuidados pessoais", grupo: "Perfumaria", icon: Scissors, cor: "#14b8a6", discricionario: true,
    palavras: ["barbearia", "barbeiro", "cabelo", "leave in", "zacca", "pomada", "skincare", "shampoo", "creme"] },
  { key: "farmacia", label: "farmácia", titulo: "Farmácia", grupo: "Academia e saúde", icon: Pill, cor: "#ef4444", discricionario: false,
    palavras: ["farmacia", "drogaria", "remedio", "remedios", "medicamento", "seakalm", "panvel", "raia", "drogasil", "pague menos", "dipirona", "vitamina"] },
  { key: "consultas", label: "consultas e terapia", titulo: "Consultas e terapia", grupo: "Academia e saúde", icon: Stethoscope, cor: "#dc2626", discricionario: false,
    palavras: ["psicologo", "psicologa", "psicologo", "terapia", "medico", "medica", "dentista", "consulta", "exame", "clinica", "nutricionista"] },
  { key: "suplementos", label: "academia e suplementos", titulo: "Academia / Fitness", grupo: "Academia e saúde", icon: Dumbbell, cor: "#8b5cf6", discricionario: false,
    palavras: ["elemento fit", "whey", "creatina", "suplemento", "suplementos", "academia", "growth", "max titanium", "integralmedica", "smartfit", "crossfit", "personal"] },
  { key: "delivery", label: "comida fora de casa", titulo: "Restaurantes e delivery", grupo: "Alimentação", icon: UtensilsCrossed, cor: "#22c55e", discricionario: true,
    palavras: ["ifood", "pizza", "pizzaria", "lanche", "lanches", "hamburguer", "burger", "sushi", "restaurante", "delivery", "rappi", "hot dog", "dogao", "espetinho", "acai", "sorvete", "padaria", "xis", "comida", "marmita", "churrasco"] },
  { key: "mercado", label: "mercado", titulo: "Mercado", grupo: "Alimentação", icon: ShoppingCart, cor: "#16a34a", discricionario: false,
    palavras: ["koch", "komprao", "mercado", "supermercado", "atacadao", "angeloni", "giassi", "bistek", "carrefour", "big", "hortifruti", "feira", "acougue", "fort"] },
  { key: "eletronicos", label: "eletrônicos e tech", titulo: "Eletrônicos / Tech", grupo: "Compras", icon: Laptop, cor: "#ec4899", discricionario: true,
    palavras: ["terabyte", "terabyteshop", "kabum", "pichau", "notebook", "monitor", "teclado", "mouse", "placa", "ssd", "fone", "celular", "iphone", "samsung", "amazon", "aliexpress", "shopee", "mercado livre", "ps5", "playstation 5", "console"] },
  { key: "roupas", label: "roupas e calçados", titulo: "Roupas e acessórios", grupo: "Compras", icon: Shirt, cor: "#db2777", discricionario: true,
    palavras: ["nike", "adidas", "jaqueta", "tenis", "camisa", "camiseta", "calca", "bermuda", "roupa", "roupas", "sapato", "renner", "riachuelo", "c&a", "zara", "shein", "bone", "oculos", "relogio"] },
  { key: "casa", label: "casa", titulo: "Casa", grupo: "Compras", icon: Home, cor: "#a855f7", discricionario: false,
    palavras: ["movel", "moveis", "decoracao", "utensilio", "utensilios", "cama", "mesa", "banho", "leroy", "tok stok", "havan", "eletrodomestico", "geladeira", "fogao"] },
  { key: "games", label: "jogos", titulo: "Jogos", grupo: "Entretenimento", icon: Gamepad2, cor: "#64748b", discricionario: true,
    palavras: ["steam", "jogo", "jogos", "game", "games", "playstation", "psn", "xbox", "nintendo", "epic"] },
  { key: "assinaturas", label: "assinaturas", titulo: "Assinaturas", grupo: "Entretenimento", icon: Tv, cor: "#6366f1", discricionario: true,
    palavras: ["netflix", "spotify", "youtube", "yt premium", "prime video", "disney", "hbo", "max", "globoplay", "investidor 10", "investidor10", "chatgpt", "claude", "icloud", "google one", "assinatura", "premium"] },
  { key: "transporte_app", label: "Uber e transporte por app", titulo: "Uber / apps", grupo: "Transporte", icon: Car, cor: "#3b82f6", discricionario: true,
    palavras: ["uber", "99", "99pop", "cabify", "indriver", "taxi"] },
  { key: "combustivel", label: "combustível", titulo: "Combustível", grupo: "Transporte", icon: Fuel, cor: "#2563eb", discricionario: false,
    palavras: ["gasolina", "etanol", "combustivel", "posto", "shell", "ipiranga", "petrobras", "diesel"] },
  { key: "estacionamento", label: "estacionamento e pedágio", titulo: "Estacionamento / pedágio", grupo: "Transporte", icon: ParkingCircle, cor: "#1d4ed8", discricionario: false,
    palavras: ["estacionamento", "pedagio", "zona azul", "parquimetro"] },
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
