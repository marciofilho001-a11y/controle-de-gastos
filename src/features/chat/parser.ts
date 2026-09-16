import type { Cartao, Transacao, FaturaItem } from "@/lib/supabase"
import { DESPESA_CATS, RECEITA_CATS } from "@/lib/categorias"

// ── Dicionário de sinônimos → categoria (fallback quando o histórico não conhece) ──
const SINONIMOS: Record<string, string> = {
  // alimentação
  comida: "alimentacao", mercado: "alimentacao", lanche: "alimentacao", almoço: "alimentacao",
  almoco: "alimentacao", janta: "alimentacao", jantar: "alimentacao", cafe: "alimentacao",
  café: "alimentacao", ifood: "alimentacao", pizza: "alimentacao", restaurante: "alimentacao",
  padaria: "alimentacao", acougue: "alimentacao", hortifruti: "alimentacao", feira: "alimentacao",
  supermercado: "alimentacao", bebida: "alimentacao", cerveja: "alimentacao",
  // transporte
  transporte: "transporte", uber: "transporte", gasolina: "transporte", combustivel: "transporte",
  combustível: "transporte", posto: "transporte", onibus: "transporte", ônibus: "transporte",
  passagem: "transporte", estacionamento: "transporte", pedagio: "transporte", pedágio: "transporte",
  taxi: "transporte", "99": "transporte",
  // moradia
  moradia: "moradia", aluguel: "moradia", condominio: "moradia", condomínio: "moradia",
  luz: "moradia", agua: "moradia", água: "moradia", energia: "moradia", gas: "moradia", gás: "moradia",
  internet: "moradia", iptu: "moradia",
  // saúde
  saude: "saude", saúde: "saude", farmacia: "saude", farmácia: "saude", remedio: "saude",
  remédio: "saude", medico: "saude", médico: "saude", dentista: "saude", academia: "saude",
  // lazer
  lazer: "lazer", jogo: "lazer", jogos: "lazer", steam: "lazer", cinema: "lazer", show: "lazer",
  bar: "lazer", festa: "lazer", viagem: "lazer", netflix: "lazer", spotify: "lazer",
  // educação
  educacao: "educacao", educação: "educacao", curso: "educacao", faculdade: "educacao",
  livro: "educacao", livros: "educacao", escola: "educacao", material: "educacao",
  // assinatura
  assinatura: "assinatura", plano: "assinatura", mensalidade: "assinatura",
  // compras / vestuário
  compras: "compras", compra: "compras", roupa: "compras", roupas: "compras", loja: "compras",
  tenis: "compras", tênis: "compras", jaqueta: "compras", calca: "compras", calça: "compras",
  camisa: "compras", camiseta: "compras", sapato: "compras", nike: "compras", adidas: "compras",
  eletronico: "compras", eletrônico: "compras", celular: "compras", presente: "compras",
  // receitas
  salario: "salario", salário: "salario", pagamento: "salario", freelance: "freelance",
  freela: "freelance", rendimento: "investimento", dividendo: "investimento",
}

const PALAVRAS_RECEITA = new Set(["salario", "salário", "receita", "recebi", "ganhei", "rendimento", "freelance", "freela", "dividendo", "proventos"])
const PALAVRAS_CARTAO = new Set(["cartao", "cartão", "credito", "crédito", "fatura", "parcela", "parcelas", "parcelado"])
const PALAVRAS_DEBITO = new Set(["debito", "débito", "dinheiro", "pix", "avista", "vista"])

const CATEGORIAS_VALIDAS = new Set([...DESPESA_CATS, ...RECEITA_CATS].map((c) => c.v))

// nomes de mês → índice (0-11), com abreviações
const MESES_NOME: Record<string, number> = {
  janeiro: 0, jan: 0, fevereiro: 1, fev: 1, marco: 2, mar: 2, abril: 3, abr: 3,
  maio: 4, mai: 4, junho: 5, jun: 5, julho: 6, jul: 6, agosto: 7, ago: 7,
  setembro: 8, set: 8, outubro: 9, out: 9, novembro: 10, nov: 10, dezembro: 11, dez: 11,
}

export type Origem = "debito" | "cartao"

export type ParseResult = {
  tipo: "receita" | "despesa"
  origem: Origem
  descricao: string
  valorParcela: number       // valor de cada parcela (ou o total, se à vista)
  numParcelas: number        // 1 = à vista
  valorTotal: number
  categoria: string
  categoriaOrigem: "histórico" | "dicionário" | "explícita" | "padrão"
  cartao: Cartao | null
  cartaoMencionadoNaoEncontrado: string | null
  mesRef: string | null      // 'YYYY-MM' quando o usuário citou um mês; null = usa o mês navegado
  mesMencionado: string | null // nome do mês citado, pra mostrar no preview
  confianca: "alta" | "média" | "baixa"
  fraseOriginal: string
}

function fraseOriginalCapitalizada(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
}

// Busca a categoria que o usuário já usou pra uma descrição parecida, no histórico.
function categoriaDoHistorico(
  descricao: string,
  transacoes: Transacao[],
  faturaItens: FaturaItem[]
): string | null {
  const alvo = normalizar(descricao)
  if (!alvo) return null
  const candidatos: { desc: string; cat: string | null }[] = [
    ...transacoes.map((t) => ({ desc: normalizar(t.descricao || ""), cat: t.categoria })),
    ...faturaItens.map((f) => ({ desc: normalizar(f.descricao || ""), cat: f.categoria })),
  ]
  // match exato primeiro
  const exato = candidatos.find((c) => c.desc === alvo && c.cat)
  if (exato?.cat) return exato.cat
  // match por conter (a descrição digitada aparece num registro antigo, ou vice-versa)
  const parcial = candidatos.find(
    (c) => c.cat && c.desc.length >= 3 && (c.desc.includes(alvo) || alvo.includes(c.desc))
  )
  return parcial?.cat || null
}

// Extrai valor e nº de parcelas de padrões como:
//  "3 parcelas de 70", "3x 70", "3x de 70,50", "10 reais", "R$ 25,90"
function extrairValores(texto: string): { valorParcela: number; numParcelas: number } | null {
  const t = texto.replace(/r\$\s*/gi, "").replace(/reais|real/gi, "")

  // "3 parcelas de 70" | "3 parcela de 70" | "3x de 70" | "3 x 70" | "3x70"
  const mParc = t.match(/(\d+)\s*(?:x|parcelas?|vezes?)\s*(?:de\s*)?(\d+(?:[.,]\d{1,2})?)/i)
  if (mParc) {
    const num = parseInt(mParc[1])
    const val = parseFloat(mParc[2].replace(",", "."))
    if (num > 0 && val > 0) return { valorParcela: val, numParcelas: num }
  }

  // valor solto: primeiro número com decimais, senão primeiro inteiro
  const mDec = t.match(/(\d+[.,]\d{1,2})/)
  if (mDec) {
    const v = parseFloat(mDec[1].replace(",", "."))
    if (v > 0) return { valorParcela: v, numParcelas: 1 }
  }
  const mInt = t.match(/\b(\d+)\b/)
  if (mInt) {
    const v = parseFloat(mInt[1])
    if (v > 0) return { valorParcela: v, numParcelas: 1 }
  }
  return null
}

export function parseEntrada(
  frase: string,
  cartoes: Cartao[],
  transacoes: Transacao[],
  faturaItens: FaturaItem[],
  mesRefBase?: string
): ParseResult | null {
  const original = frase.trim()
  if (!original) return null
  // separa por espaço E por pontuação (/, -, vírgula, etc.) pra "dinheiro/débito" virar 2 tokens
  const palavras = normalizar(original)
    .split(/[\s/\\,;|·]+/)
    .map((p) => p.replace(/^[-.]+|[-.]+$/g, "")) // tira hífen/ponto nas pontas
    .filter(Boolean)
  const setPalavras = new Set(palavras)

  // 1) valores + parcelas
  const valores = extrairValores(original)
  if (!valores) return null // sem valor, não dá pra cadastrar
  const { valorParcela, numParcelas } = valores

  // 2) tipo (receita x despesa)
  const ehReceita = palavras.some((p) => PALAVRAS_RECEITA.has(p))
  const tipo: "receita" | "despesa" = ehReceita ? "receita" : "despesa"

  // 3) cartão mencionado?
  let cartao: Cartao | null = null
  let cartaoMencionadoNaoEncontrado: string | null = null
  const mencionaCartao = palavras.some((p) => PALAVRAS_CARTAO.has(p)) || numParcelas > 1
  // tokens genéricos que não servem pra identificar QUAL cartão (senão "credito" casa "Linha Crédito MP")
  const TOKENS_GENERICOS = new Set(["cartao", "credito", "linha", "mp", "de", "do", "da"])
  for (const c of cartoes.filter((x) => x.ativo !== false)) {
    const tokens = normalizar(c.nome).split(/\s+/).filter((tk) => tk.length >= 3 && !TOKENS_GENERICOS.has(tk))
    if (tokens.some((tk) => setPalavras.has(tk))) {
      cartao = c
      break
    }
  }
  if (mencionaCartao && !cartao && cartoes.length) {
    // mencionou cartão/parcela mas não achou qual — sinaliza pra confirmação
    const idx = palavras.findIndex((p) => p === "cartao" || p === "cartão")
    cartaoMencionadoNaoEncontrado = idx >= 0 && palavras[idx + 1] ? palavras[idx + 1] : null
  }

  // 4) origem
  const origem: Origem = cartao || mencionaCartao ? "cartao" : "debito"

  // 5) categoria — explícita > histórico > dicionário > padrão
  let categoria = "outro"
  let categoriaOrigem: ParseResult["categoriaOrigem"] = "padrão"

  // 5a) categoria dita explicitamente (nome exato de categoria na frase).
  // Ignora "cartao"/"cartão" aqui: nessa frase é forma de pagamento, não a categoria pretendida
  // (ex: "cartao nubank jaqueta compras" -> categoria = compras, não cartao).
  const catExplicita = palavras.find((p) => CATEGORIAS_VALIDAS.has(p) && p !== "cartao" && p !== "cartão")

  // tokens que pertencem ao nome do cartão escolhido (pra não virarem descrição nem categoria)
  const tokensCartao = new Set(cartao ? normalizar(cartao.nome).split(/\s+/) : [])

  // 5b) descrição = palavras que não são número/valor/cartão/origem/categoria/sinônimo
  const stop = new Set<string>([
    ...PALAVRAS_CARTAO, ...PALAVRAS_DEBITO, ...PALAVRAS_RECEITA, ...Object.keys(MESES_NOME),
    "de", "reais", "real", "no", "na", "do", "da", "com", "em", "gastei", "paguei", "mp", "linha", "recebi", "ganhei",
  ])
  const ehNumero = (p: string) => /\d/.test(p) // remove "10", "25,90", "3x", "70"
  // sinônimos/palavras-chave descrevem bem o gasto (uber, padaria, cinema) — mantém na descrição;
  // só tira número, cartão, origem e stopwords. A categoria explícita (nome de categoria) sai.
  let descricaoTokens = palavras.filter(
    (p) => !ehNumero(p) && !stop.has(p) && !CATEGORIAS_VALIDAS.has(p) && !tokensCartao.has(p)
  )
  // se sobrou mais de uma palavra, remove as puramente-sinônimo (ex: "comida" quando já virou categoria),
  // mantendo o nome real do estabelecimento (koch, univali...). Se só há sinônimo, mantém (vira a descrição).
  if (descricaoTokens.length > 1) {
    const semSinonimo = descricaoTokens.filter((p) => !Object.prototype.hasOwnProperty.call(SINONIMOS, p))
    if (semSinonimo.length) descricaoTokens = semSinonimo
  }
  let descricao = descricaoTokens.length
    ? descricaoTokens.join(" ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "" // preenchido abaixo, depois de resolver a categoria

  if (catExplicita) {
    categoria = catExplicita
    categoriaOrigem = "explícita"
  } else {
    // histórico
    const doHist = categoriaDoHistorico(descricao, transacoes, faturaItens)
    if (doHist) {
      categoria = doHist
      categoriaOrigem = "histórico"
    } else {
      // dicionário de sinônimos — ignorando palavras do nome do cartão.
      // pega o ÚLTIMO sinônimo da frase (o que a pessoa escreve por último costuma
      // ser a categoria pretendida: "água academia" -> academia/saúde, não água/moradia)
      const sinonimos = palavras.filter((p) => !tokensCartao.has(p)).map((p) => SINONIMOS[p]).filter(Boolean)
      const sinon = sinonimos.length ? sinonimos[sinonimos.length - 1] : undefined
      if (sinon) {
        categoria = sinon
        categoriaOrigem = "dicionário"
      } else if (origem === "cartao") {
        categoria = "cartao"
        categoriaOrigem = "padrão"
      }
    }
  }

  // descrição vazia (ex: "salario 2500") -> usa o nome da categoria como descrição
  if (!descricao) {
    const label = [...DESPESA_CATS, ...RECEITA_CATS].find((c) => c.v === categoria)?.l
    descricao = label || fraseOriginalCapitalizada(original)
  }

  // 6) mês da fatura mencionado? ("outubro", "out", "nov"...)
  let mesRef: string | null = null
  let mesMencionado: string | null = null
  const base = mesRefBase || new Date().toISOString().slice(0, 7)
  const [anoBase, mesBaseIdx] = base.split("-").map(Number)
  for (const p of palavras) {
    if (p in MESES_NOME && !CATEGORIAS_VALIDAS.has(p)) {
      const mIdx = MESES_NOME[p]
      // se o mês pedido já passou em relação ao mês base, assume o próximo ano
      const ano = mIdx < mesBaseIdx - 1 ? anoBase + 1 : anoBase
      mesRef = `${ano}-${String(mIdx + 1).padStart(2, "0")}`
      mesMencionado = p
      break
    }
  }

  // 7) confiança
  let confianca: ParseResult["confianca"] = "alta"
  if (cartaoMencionadoNaoEncontrado) confianca = "baixa"
  else if (categoriaOrigem === "padrão") confianca = "média"

  return {
    tipo,
    origem,
    descricao,
    valorParcela,
    numParcelas,
    valorTotal: valorParcela * numParcelas,
    categoria,
    categoriaOrigem,
    cartao,
    cartaoMencionadoNaoEncontrado,
    mesRef,
    mesMencionado,
    confianca,
    fraseOriginal: original,
  }
}
