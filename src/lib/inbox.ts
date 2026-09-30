import { supabase, type Cartao, type FaturaItem, type InboxItem, type Transacao } from "@/lib/supabase"
import { parseEntrada, type ParseResult } from "@/features/chat/parser"
import { salvarEntrada } from "@/features/chat/salvar"
import { temaDaDescricao, type TemaKey } from "@/lib/temas"

// ---------------------------------------------------------------------------
// Caixa de entrada (fin_inbox): compras que chegam sozinhas pela automação
// "Transação" do app Atalhos do iPhone (pagamento por aproximação / Apple Pay).
// O atalho manda o que o iPhone entrega — valor (texto formatado), estabelecimento
// e nome do cartão na Carteira. Aqui isso vira uma prévia de lançamento pra revisar.
// ---------------------------------------------------------------------------

const TZ = "America/Sao_Paulo"

// "R$ 1.234,56" | "R$43,00" | "$12.50" | "43" → número
export function parseValorBruto(bruto: string | null | undefined): number | null {
  if (!bruto) return null
  const s = String(bruto).replace(/[^\d.,-]/g, "")
  if (!s) return null
  const ult = Math.max(s.lastIndexOf(","), s.lastIndexOf("."))
  let n: number
  if (ult >= 0 && s.length - ult - 1 >= 1 && s.length - ult - 1 <= 2) {
    // último separador com 1–2 dígitos depois = decimal
    const inteiro = s.slice(0, ult).replace(/[.,]/g, "")
    n = parseFloat(`${inteiro}.${s.slice(ult + 1)}`)
  } else {
    n = parseFloat(s.replace(/[.,]/g, ""))
  }
  return Number.isFinite(n) && n > 0 ? Math.abs(n) : null
}

// data/hora local (Brasília) de um timestamp — evita o lançamento cair no dia seguinte por causa do UTC
export function dataLocal(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso))
  const g = (t: string) => p.find((x) => x.type === t)?.value
  return `${g("year")}-${g("month")}-${g("day")}`
}
export function horaLocal(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

// Em qual fatura (mês de vencimento) cai uma compra feita em `dataISO` (YYYY-MM-DD).
// Sem o dia de fechamento cadastrado, estima fechamento = vencimento − 7 dias.
export function mesFaturaPara(cartao: Pick<Cartao, "dia_vencimento"> | null, dataISO: string): string {
  const [a, m, d] = dataISO.split("-").map(Number)
  const compra = Date.UTC(a, m - 1, d)
  const venc = cartao?.dia_vencimento
  if (!venc) return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7)
  for (let i = 0; i <= 2; i++) {
    const vencimento = Date.UTC(a, m - 1 + i, Math.min(venc, 28))
    const fechamento = vencimento - 7 * 86400000
    if (compra <= fechamento) return new Date(vencimento).toISOString().slice(0, 7)
  }
  return new Date(Date.UTC(a, m + 2, 1)).toISOString().slice(0, 7)
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
}

// Casa o nome do cartão na Carteira do iPhone ("Nubank", "Mercado Pago") com os cartões do app
export function casarCartao(nomeCarteira: string | null | undefined, cartoes: Cartao[]): Cartao | null {
  if (!nomeCarteira) return null
  const alvo = normalizar(nomeCarteira)
  const alvoColado = alvo.replace(/[^a-z0-9]/g, "")
  const genericos = new Set(["cartao", "credito", "debito", "linha", "de", "do", "da", "mp", "card"])
  let melhor: { c: Cartao; pontos: number } | null = null
  for (const c of cartoes.filter((x) => x.ativo !== false)) {
    const nome = normalizar(c.nome)
    const tokens = nome.split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !genericos.has(t))
    const colado = tokens.join("")
    let pontos = tokens.filter((t) => alvo.includes(t)).length
    if (colado.length >= 5 && alvoColado.includes(colado)) pontos += 2
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { c, pontos }
  }
  return melhor?.c ?? null
}

// quando o histórico não conhece o estabelecimento, o tema da descrição sugere a categoria
const CAT_DO_TEMA: Record<TemaKey, string> = {
  bebida: "lazer", delivery: "alimentacao", mercado: "alimentacao", perfumes: "lazer", barbearia: "saude",
  farmacia: "saude", consultas: "saude", suplementos: "saude", faculdade: "educacao", cursos: "educacao",
  livros: "educacao", eletronicos: "compras", roupas: "compras", casa: "compras", games: "lazer",
  assinaturas: "assinatura", transporte_app: "transporte", combustivel: "transporte", estacionamento: "transporte",
}

const MINUSCULAS = new Set(["de", "do", "da", "dos", "das", "e", "em"])
export function titulo(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
}

// Monta a prévia (mesmo formato do assistente de lançamento) a partir do que o iPhone mandou
export function previaDoInbox(
  item: InboxItem, cartoes: Cartao[], transacoes: Transacao[], faturaItens: FaturaItem[],
): { parse: ParseResult; valorOk: boolean; dataCompra: string } {
  const valor = parseValorBruto(item.valor_bruto) ?? 0
  const estab = (item.estabelecimento || "").trim() || "Compra por aproximação"
  const dataCompra = dataLocal(item.recebido_em)
  // o leitor só é usado pra categoria (histórico > dicionário); cartão vem do nome na Carteira
  const base = parseEntrada(`${estab} ${valor.toFixed(2).replace(".", ",")}`, [], transacoes, faturaItens)
  const cartao = casarCartao(item.cartao_nome, cartoes)
  const parse: ParseResult = {
    tipo: "despesa",
    origem: "cartao",
    descricao: titulo(estab),
    valorParcela: valor,
    numParcelas: 1,
    valorTotal: valor,
    categoria:
      base && base.categoria !== "cartao" && base.categoria !== "outro"
        ? base.categoria
        : CAT_DO_TEMA[temaDaDescricao(estab)?.key as TemaKey] ?? "outro",
    categoriaOrigem: base?.categoriaOrigem ?? "padrão",
    cartao,
    cartaoMencionadoNaoEncontrado: cartao ? null : item.cartao_nome || null,
    mesRef: mesFaturaPara(cartao, dataCompra),
    mesMencionado: null,
    confianca: cartao && valor > 0 ? "alta" : "baixa",
    fraseOriginal: estab,
  }
  return { parse, valorOk: valor > 0, dataCompra }
}

// Confirma: grava o lançamento (com a data real da compra) e tira da caixa de entrada
export async function confirmarInbox(item: InboxItem, parse: ParseResult, dataCompra: string): Promise<void> {
  let transacaoId: number | null = null
  if (parse.numParcelas > 1 && parse.origem === "cartao" && parse.cartao) {
    await salvarEntrada(parse, parse.mesRef || dataCompra.slice(0, 7))
  } else {
    const ehCartao = parse.origem === "cartao" && parse.cartao
    const { data, error } = await supabase
      .from("fin_transacoes")
      .insert({
        tipo: "despesa",
        descricao: parse.descricao,
        valor: parse.valorTotal,
        categoria: parse.categoria,
        data: dataCompra,
        mes_ref: ehCartao ? parse.mesRef || mesFaturaPara(parse.cartao, dataCompra) : dataCompra.slice(0, 7),
        cartao_id: ehCartao ? parse.cartao!.id : null,
      })
      .select("id")
    if (error) throw error
    transacaoId = data?.[0]?.id ?? null
  }
  const { error: e2 } = await supabase
    .from("fin_inbox")
    .update({ status: "confirmado", transacao_id: transacaoId, resolvido_em: new Date().toISOString() })
    .eq("id", item.id)
  if (e2) throw e2
}

export async function descartarInbox(item: InboxItem): Promise<void> {
  const { error } = await supabase
    .from("fin_inbox")
    .update({ status: "descartado", resolvido_em: new Date().toISOString() })
    .eq("id", item.id)
  if (error) throw error
}
