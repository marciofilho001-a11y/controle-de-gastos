import {
  Home,
  CreditCard,
  Link as LinkIcon,
  Car,
  Smartphone,
  Utensils,
  Fuel,
  Pill,
  Gamepad2,
  BookOpen,
  MoreHorizontal,
  Briefcase,
  Wrench,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

export type CatDef = { v: string; l: string; icon: LucideIcon }

export const DESPESA_CATS: CatDef[] = [
  { v: "moradia", l: "Moradia", icon: Home },
  { v: "cartao", l: "Cartão", icon: CreditCard },
  { v: "consorcio", l: "Consórcio", icon: LinkIcon },
  { v: "financiamento", l: "Financiamento", icon: Car },
  { v: "assinatura", l: "Assinatura", icon: Smartphone },
  { v: "alimentacao", l: "Alimentação", icon: Utensils },
  { v: "transporte", l: "Transporte", icon: Fuel },
  { v: "saude", l: "Saúde", icon: Pill },
  { v: "lazer", l: "Lazer", icon: Gamepad2 },
  { v: "educacao", l: "Educação", icon: BookOpen },
  { v: "outro", l: "Outro", icon: MoreHorizontal },
]

export const RECEITA_CATS: CatDef[] = [
  { v: "salario", l: "Salário", icon: Briefcase },
  { v: "freelance", l: "Freelance", icon: Wrench },
  { v: "investimento", l: "Rendimento", icon: TrendingUp },
  { v: "outro", l: "Outro", icon: MoreHorizontal },
]

// Fonte única de cores por categoria (usada em gráficos, badges, ícones).
export const CAT_COLORS: Record<string, string> = {
  moradia: "#3d8ef0",
  cartao: "#ec4899",
  consorcio: "#6366f1",
  financiamento: "#fb923c",
  assinatura: "#60a5fa",
  alimentacao: "#eab308",
  transporte: "#38bdf8",
  saude: "#ef4444",
  lazer: "#22c55e",
  educacao: "#94a3b8",
  outro: "#6b7280",
  salario: "#14b8a6",
  freelance: "#3d8ef0",
  investimento: "#a78bfa",
}

export function catInfo(v: string | null | undefined): CatDef {
  const key = v || "outro"
  return (
    DESPESA_CATS.find((c) => c.v === key) ||
    RECEITA_CATS.find((c) => c.v === key) || { v: key, l: key || "Outro", icon: MoreHorizontal }
  )
}

export function catColor(v: string | null | undefined): string {
  return CAT_COLORS[v || "outro"] || "#6b7280"
}
