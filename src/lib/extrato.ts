import {
  supabase, type Cartao, type ContaBanco, type ExtratoItem, type FaturaPagamento, type Obrigacao,
  type Regra, type Transacao,
} from "@/lib/supabase"
import { parseEntrada } from "@/features/chat/parser"
import { normalizarTexto, nomeComercial, temaDaDescricao, type Tema, type TemaKey } from "@/lib/temas"
import { mesFaturaPara } from "@/lib/data-compra"
import { addMonths } from "@/lib/format"
import {
  ehFaturaCheia, faturaInfoDoMes, faturaPagaNoMes, obrigacaoPagaNoMes, obrigacoesAtivasNoMes,
} from "@/lib/selectors"
import { registrarFaturaPaga, removerFaturaPaga } from "@/lib/pagamentos"
import { catInfo } from "@/lib/categorias"

// ---------------------------------------------------------------------------
// Lançamento automático: cada movimentação que chega do banco (Open Finance ou arquivo)
// vira uma SUGESTÃO. O site decide sozinho quando tem certeza (regra aprendida ou o mesmo
// lançamento já feito à mão) e pergunta quando não tem. Cada resposta vira regra.
// ---------------------------------------------------------------------------

export type Acao = "despesa" | "receita" | "fatura" | "obrigacao" | "ignorar"

export type Sugestao = {
  acao: Acao
  descricao: string
  categoria: string
  cartao_id: number | null
  obrigacao_id: number | null
  data: string
  mes_ref: string
  parcela_atual: number | null
  parcela_total: number | null
  confianca: "alta" | "media" | "baixa"
  motivo: string
  chave: string
  regra: Regra | null
  conciliar: Transacao | null       // já existe esse lançamento (feito à mão): só liga, não duplica
  automatico: boolean               // pode resolver sem perguntar
}

export type Contexto = {
  regras: Regra[]
  transacoes: Transacao[]
  cartoes: Cartao[]
  obrigacoes: Obrigacao[]
  contas: ContaBanco[]
  faturaPagamentos: FaturaPagamento[]
  temas: Tema[]
  usados: Set<number>               // transações já ligadas a algum item do extrato
}

// ---------- texto ----------

const MINUSCULAS = new Set(["de", "do", "da", "dos", "das", "e", "em", "com", "para"])
export function titulo(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().split(" ")
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
}

// maquininhas/intermediários: o nome útil vem DEPOIS do "*"
const INTERMEDIARIOS = new Set([
  "ifd", "pag", "mp", "pp", "ec", "dl", "pg", "sumup", "stone", "ebanx", "paypal", "hotmart", "pagseguro",
  "mercadopago", "ppro", "zp", "ame", "picpay", "cielo", "getnet", "rede", "sq", "pagbank", "ton", "infinitepay",
  "asaas", "iugu", "vindi", "pagarme", "moip", "wirecard", "dm", "shp", "htm", "lojas",
])
const PREFIXOS: RegExp[] = [
  /^compra (no |com |em )?(cart[aã]o|d[eé]bito|cr[eé]dito)( de d[eé]bito| de cr[eé]dito)?\s*[-:–]?\s*/i,
  /^(transfer[eê]ncia|pix|ted|doc)\s+(enviad[ao]|recebid[ao]|realizad[ao])(\s+pelo\s+pix)?\s*[-:–]?\s*/i,
  /^(pix|ted|doc)\s*[-:–]\s*/i,
  /^pagamento (de |do |da )?(boleto|conta|titulo|t[ií]tulo)\s*[-:–]?\s*/i,
  /^pagamento efetuado\s*[-:–]?\s*/i,
  /^d[eé]bito autom[aá]tico\s*[-:–]?\s*/i,
  /^compra\s*[-:–]\s*/i,
]

// "IFD*IFOOD CLUB SAO PAULO BR" -> "Ifood Club"; "Transferência enviada pelo Pix - LUIZ F" -> "Luiz F"
export function limparDescricao(raw: string | null | undefined): string {
  let s = String(raw || "").replace(/\s+/g, " ").trim()
  for (const re of PREFIXOS) s = s.replace(re, "")
  const ast = s.match(/^([A-Za-z0-9.]{1,14})\s*\*\s*(.+)$/)
  if (ast) {
    const pref = ast[1].toLowerCase().replace(/\./g, "")
    s = INTERMEDIARIOS.has(pref) ? ast[2] : ast[1]
  }
  s = s
    .replace(/\b\d{4,}\b/g, " ")                               // códigos/ids
    .replace(/\s+-\s+(cpf|cnpj)?[\d.\-/*•]+\s*$/i, "")          // " - ***.123.456-**"
    .replace(/[•*]+/g, " ")
    .replace(/\b(bra|brasil|br)\s*$/i, "")
    .replace(/\s+(sao paulo|s paulo|rio de janeiro|curitiba|florianopolis|itajai|bombinhas|porto belo|balneario camboriu|osasco|barueri)\s*([a-z]{2})?\s*$/i, "")
    .replace(/\s+[A-Z]{2}\s*$/, "")                             // UF no fim
    .replace(/[-–:.,;]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
  return titulo(s || String(raw || "Movimentação").trim())
}

// chave da regra: pessoa (Pix/TED) ou estabelecimento, normalizada e curta
export function chaveDe(item: Pick<ExtratoItem, "descricao" | "descricao_raw" | "contraparte" | "operacao">): string {
  const pessoa = item.contraparte && /pix|ted|doc|transf/i.test(`${item.operacao ?? ""} ${item.descricao_raw ?? ""} ${item.descricao}`)
  if (pessoa) {
    const p = normalizarTexto(item.contraparte).split(" ").filter((w) => w.length > 1).slice(0, 2).join(" ")
    if (p) return `pessoa:${p}`
  }
  const base = normalizarTexto(limparDescricao(item.descricao || item.descricao_raw))
  const tokens = base.split(" ").filter((w) => w.length > 1 && !/^\d+$/.test(w) && !MINUSCULAS.has(w))
  return tokens.slice(0, 3).join(" ") || base || "movimentacao"
}

const sem = (s: string) => normalizarTexto(s).split(" ").filter((w) => w.length >= 3)
function sobreposicao(a: string, b: string): number {
  const A = new Set(sem(a))
  return sem(b).filter((w) => A.has(w)).length
}

const CAT_DO_TEMA: Record<TemaKey, string> = {
  bebida: "lazer", delivery: "alimentacao", mercado: "alimentacao", perfumes: "lazer", barbearia: "saude",
  farmacia: "saude", consultas: "saude", suplementos: "saude", faculdade: "educacao", cursos: "educacao",
  livros: "educacao", eletronicos: "compras", roupas: "compras", casa: "compras", games: "lazer",
  assinaturas: "assinatura", transporte_app: "transporte", combustivel: "transporte", estacionamento: "transporte",
}

// ---------- cartões ----------

const GENERICOS = new Set(["cartao", "credito", "debito", "linha", "de", "do", "da", "card", "conta", "banco", "pagamento", "pagamentos"])
export function casarCartao(texto: string | null | undefined, cartoes: Cartao[]): Cartao | null {
  if (!texto) return null
  const alvo = normalizarTexto(texto)
  const alvoColado = alvo.replace(/[^a-z0-9]/g, "")
  let melhor: { c: Cartao; pontos: number } | null = null
  for (const c of cartoes.filter((x) => x.ativo !== false)) {
    const tokens = normalizarTexto(c.nome).split(" ").filter((t) => t.length >= 3 && !GENERICOS.has(t))
    const colado = tokens.join("")
    let pontos = tokens.filter((t) => alvo.split(" ").includes(t) || alvoColado.includes(t)).length
    if (colado.length >= 5 && alvoColado.includes(colado)) pontos += 2
    // "nu pagamentos" = Nubank
    if (/\bnu\b/.test(alvo) && /nubank/.test(normalizarTexto(c.nome))) pontos += 2
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { c, pontos }
  }
  return melhor?.c ?? null
}

function mesDe(iso: string) { return iso.slice(0, 7) }

// em qual fatura cai uma compra do extrato do cartão
function mesFaturaDoItem(item: ExtratoItem, cartao: Cartao | null): string {
  if (item.previsao_fatura) return mesDe(item.previsao_fatura)
  const k = item.parcela_atual ?? 1
  if (item.data_compra && k > 1) return addMonths(mesFaturaPara(cartao, item.data_compra), k - 1)
  return mesFaturaPara(cartao, item.data_compra && k <= 1 ? item.data_compra : item.data)
}

// ---------- histórico ----------

// categoria e nome que você já usou pra algo parecido
function doHistorico(nome: string, chave: string, transacoes: Transacao[]): { categoria: string; descricao: string } | null {
  const alvo = normalizarTexto(nome)
  const tok = chave.replace(/^pessoa:/, "").split(" ")[0] ?? ""
  const cands = transacoes.filter((t) => {
    if (t.tipo !== "despesa" || !t.categoria || t.categoria === "outro" || t.categoria === "fatura_indefinida" || ehFaturaCheia(t)) return false
    const n = normalizarTexto(nomeComercial(t.descricao))
    return n === alvo || (tok.length >= 4 && n.split(" ").includes(tok))
  })
  if (!cands.length) return null
  const cont = new Map<string, number>()
  for (const t of cands) cont.set(t.categoria!, (cont.get(t.categoria!) || 0) + 1)
  const categoria = [...cont.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const exato = cands.find((t) => normalizarTexto(nomeComercial(t.descricao)) === alvo)
  return { categoria, descricao: nomeComercial((exato ?? cands[0]).descricao) }
}

function categoriaPorDicionario(nome: string, ctx: Contexto): { categoria: string; fonte: string } {
  const p = parseEntrada(`${nome} 1`, [], [], [])
  if (p && p.categoriaOrigem === "dicionário" && p.categoria !== "outro" && p.categoria !== "cartao") return { categoria: p.categoria, fonte: `parece ${catInfo(p.categoria).l.toLowerCase()}` }
  const tema = temaDaDescricao(nome, ctx.temas)
  if (tema) return { categoria: CAT_DO_TEMA[tema.key as TemaKey] ?? "outro", fonte: `parece ${tema.titulo.toLowerCase()}` }
  return { categoria: "outro", fonte: "" }
}

// ---------- conciliação (não duplicar o que você já lançou) ----------

const pertoValor = (a: number, b: number) => Math.abs(Number(a) - Number(b)) <= 0.05
function diasEntre(a: string, b: string) {
  return Math.abs((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 86400000)
}

function acharExistente(item: ExtratoItem, s: Omit<Sugestao, "conciliar" | "automatico">, ctx: Contexto): Transacao | null {
  const proibida = item.acao?.startsWith("sem:") ? Number(item.acao.slice(4)) : null
  const livres = ctx.transacoes.filter((t) => !ctx.usados.has(t.id) && t.id !== proibida && pertoValor(t.valor, item.valor))
  let cands: Transacao[] = []
  if (s.acao === "despesa" && s.cartao_id) {
    const meses = [s.mes_ref, addMonths(s.mes_ref, -1), addMonths(s.mes_ref, 1)]
    cands = livres.filter((t) => t.tipo === "despesa" && t.cartao_id === s.cartao_id && !ehFaturaCheia(t) && meses.includes(t.mes_ref))
    if (s.parcela_total && s.parcela_total > 1) {
      const mesmaParcela = cands.filter((t) => t.parcela_atual === s.parcela_atual)
      if (mesmaParcela.length) cands = mesmaParcela
    }
  } else if (s.acao === "despesa") {
    cands = livres.filter((t) => t.tipo === "despesa" && !t.cartao_id && diasEntre(t.data, s.data) <= 4)
  } else if (s.acao === "receita") {
    cands = livres.filter((t) => t.tipo === "receita" && (diasEntre(t.data, s.data) <= 5 || t.mes_ref === s.mes_ref))
  } else if (s.acao === "obrigacao" && s.obrigacao_id) {
    const paga = obrigacaoPagaNoMes(ctx.transacoes, s.obrigacao_id, s.mes_ref)
    return paga && !ctx.usados.has(paga.id) && paga.id !== proibida ? paga : null
  }
  if (!cands.length) return null
  // mais parecido no nome e mais perto na data primeiro
  return cands
    .map((t) => ({ t, nota: sobreposicao(t.descricao || "", s.descricao) * 3 - (t.data.endsWith("-01") ? 0 : Math.min(diasEntre(t.data, s.data), 30) / 10) }))
    .sort((a, b) => b.nota - a.nota)[0].t
}

// ---------- sugestão ----------

const RE_TRANSF_PROPRIA = /(mesma titularidade|conta propria|entre contas|aplica[cç][aã]o|resgate|caixinha|cofrinho|porquinho|guardad|poupan[cç]a|\bcdb\b|\brdb\b|\blci\b|\blca\b|tesouro|investimento|reserva)/i
const RE_PAGTO_FATURA = /(fatura|pagamento (de |do )?cart[aã]o|pgto (de )?cart|pag(amento)? fat|nu pagamentos|cart[aã]o de cr[eé]dito)/i
const RE_SALARIO = /(sal[aá]rio|folha|proventos|holerite|pro[- ]?labore|adiantamento salarial)/i
const RE_RENDIMENTO = /(rendimento|juros|dividend|proventos fii)/i

export function sugerir(item: ExtratoItem, ctx: Contexto): Sugestao {
  const conta = ctx.contas.find((c) => c.id === item.conta_id) ?? null
  const ehCartao = (item.tipo_conta ?? conta?.tipo) === "CREDIT"
  const cartao = ehCartao ? ctx.cartoes.find((c) => c.id === conta?.cartao_id) ?? null : null
  const nome = limparDescricao(item.contraparte && /pix|ted|transf/i.test(`${item.operacao} ${item.descricao}`) ? item.contraparte : item.descricao)
  const chave = chaveDe(item)
  const texto = `${item.descricao} ${item.descricao_raw ?? ""} ${item.contraparte ?? ""}`
  const regra = ctx.regras.find((r) => r.chave === chave && r.sentido === item.sentido) ?? null
  const mesData = mesDe(item.data)

  const base = {
    descricao: nome, categoria: "outro", cartao_id: null as number | null, obrigacao_id: null as number | null,
    data: item.data_compra && (item.parcela_atual ?? 1) <= 1 ? item.data_compra : item.data,
    mes_ref: mesData, parcela_atual: item.parcela_total && item.parcela_total > 1 ? item.parcela_atual ?? 1 : null,
    parcela_total: item.parcela_total && item.parcela_total > 1 ? item.parcela_total : null,
    chave, regra,
  }
  let s: Omit<Sugestao, "conciliar" | "automatico">

  if (regra) {
    s = { ...base, acao: regra.acao, descricao: regra.descricao || nome, categoria: regra.categoria || "outro", confianca: "alta", motivo: `você ensinou: "${regra.descricao || nome}"` }
    if (regra.acao === "despesa" && ehCartao) { s.cartao_id = cartao?.id ?? null; s.mes_ref = mesFaturaDoItem(item, cartao) }
    if (regra.acao === "obrigacao") s.obrigacao_id = regra.obrigacao_id
    if (regra.acao === "fatura") Object.assign(s, faturaDoPagamento(item, ctx, regra.cartao_id))
  } else if (ehCartao) {
    if (item.sentido === "entrada") {
      const pagto = RE_PAGTO_FATURA.test(texto) || /pagamento|pgto|pag /i.test(texto)
      s = { ...base, acao: "ignorar", confianca: pagto ? "alta" : "baixa",
        motivo: pagto ? "pagamento da fatura: os gastos já contam pelas compras do cartão" : "crédito/estorno no cartão; se for devolução, apague a compra original" }
    } else {
      const h = doHistorico(nome, chave, ctx.transacoes)
      const d = h ? null : categoriaPorDicionario(nome, ctx)
      s = {
        ...base, acao: "despesa", cartao_id: cartao?.id ?? null, mes_ref: mesFaturaDoItem(item, cartao),
        descricao: h?.descricao ?? nome, categoria: h?.categoria ?? d!.categoria,
        confianca: !cartao ? "baixa" : h ? "media" : d!.categoria !== "outro" ? "media" : "baixa",
        motivo: !cartao ? "ligue esta conta a um cartão do app" : h ? `você já lançou "${h.descricao}" assim` : d!.fonte || "novo por aqui",
      }
    }
  } else if (RE_TRANSF_PROPRIA.test(texto) && !RE_RENDIMENTO.test(texto)) {
    s = { ...base, acao: "ignorar", confianca: "media", motivo: "parece movimentação entre suas contas ou investimento" }
  } else if (item.sentido === "entrada") {
    if (RE_SALARIO.test(texto)) s = { ...base, acao: "receita", categoria: "salario", descricao: nome, confianca: "media", motivo: "parece salário" }
    else if (RE_RENDIMENTO.test(texto)) s = { ...base, acao: "receita", categoria: "investimento", confianca: "media", motivo: "parece rendimento" }
    else s = { ...base, acao: "receita", categoria: "outro", confianca: "baixa", motivo: item.contraparte ? `dinheiro que ${titulo(item.contraparte)} te mandou` : "entrada nova" }
  } else {
    // saída da conta: fatura? conta fixa? ou gasto no Pix/débito
    const fat = faturaDoPagamento(item, ctx, null)
    const obr = contaFixaDoPagamento(item, ctx)
    if (fat && (RE_PAGTO_FATURA.test(texto) || fat.confianca === "alta")) {
      s = { ...base, ...fat, acao: "fatura" }
    } else if (obr) {
      s = { ...base, acao: "obrigacao", obrigacao_id: obr.o.id, descricao: obr.o.nome, categoria: obr.o.categoria || "outro",
        confianca: obr.nota >= 3 ? "alta" : "media", motivo: `mesmo valor da conta fixa "${obr.o.nome}"` }
    } else {
      const h = doHistorico(nome, chave, ctx.transacoes)
      const d = h ? null : categoriaPorDicionario(nome, ctx)
      s = {
        ...base, acao: "despesa", descricao: h?.descricao ?? nome, categoria: h?.categoria ?? d!.categoria,
        confianca: h ? "media" : d!.categoria !== "outro" ? "media" : "baixa",
        motivo: h ? `você já lançou "${h.descricao}" assim` : d!.fonte || (item.contraparte ? "Pix para alguém novo" : "novo por aqui"),
      }
    }
  }

  const conciliar = s.acao === "ignorar" || s.acao === "fatura" ? null : acharExistente(item, s, ctx)
  const travado = item.pendente || item.acao === "revisar" || !!item.acao?.startsWith("sem:")
  const automatico = !travado && (
    !!conciliar ||
    (!!regra && regra.auto && (s.acao !== "despesa" || !ehCartao || !!s.cartao_id)) ||
    (ehCartao && item.sentido === "entrada" && s.confianca === "alta"))   // pagamento de fatura dentro do cartão
  return { ...s, conciliar, automatico, motivo: conciliar ? `já estava lançado: "${conciliar.descricao}"` : s.motivo }
}

// pagamento de fatura saindo da conta: qual cartão e qual mês
function faturaDoPagamento(item: ExtratoItem, ctx: Contexto, cartaoFixo: number | null):
  { cartao_id: number; mes_ref: string; descricao: string; categoria: string; confianca: "alta" | "media" | "baixa"; motivo: string } | null {
  const texto = `${item.descricao} ${item.descricao_raw ?? ""} ${item.contraparte ?? ""}`
  const porNome = cartaoFixo ? ctx.cartoes.find((c) => c.id === cartaoFixo) ?? null : casarCartao(texto, ctx.cartoes)
  const mes = mesDe(item.data)
  const meses = [mes, addMonths(mes, 1), addMonths(mes, -1)]
  let melhor: { c: Cartao; m: string; dif: number } | null = null
  for (const c of ctx.cartoes.filter((x) => x.ativo !== false && (!porNome || x.id === porNome.id))) {
    for (const m of meses) {
      if (faturaPagaNoMes(ctx.faturaPagamentos, c.id, m)) continue
      const v = faturaInfoDoMes(ctx.transacoes, c.id, m).valor
      if (v <= 0) continue
      const dif = Math.abs(v - item.valor)
      if (!melhor || dif < melhor.dif) melhor = { c, m, dif }
    }
  }
  const exato = melhor && melhor.dif <= Math.max(1, item.valor * 0.01)
  if (!exato && !porNome) return null
  const c = exato ? melhor!.c : porNome!
  const m = exato ? melhor!.m : melhor?.c.id === c.id ? melhor!.m : mes
  return {
    cartao_id: c.id, mes_ref: m, descricao: `Fatura ${c.nome}`, categoria: "cartao",
    confianca: exato && porNome ? "alta" : "media",
    motivo: exato ? `pagamento da fatura ${c.nome} (${m.slice(5)}/${m.slice(2, 4)}), mesmo valor` : `parece pagamento da fatura ${c.nome}`,
  }
}

// conta fixa (obrigação) com o mesmo valor neste mês
function contaFixaDoPagamento(item: ExtratoItem, ctx: Contexto): { o: Obrigacao; nota: number } | null {
  const mes = mesDe(item.data)
  let melhor: { o: Obrigacao; nota: number } | null = null
  for (const o of obrigacoesAtivasNoMes(ctx.obrigacoes, mes)) {
    const valorOk = Math.abs(Number(o.valor) - item.valor) <= Math.max(1, Number(o.valor) * 0.02)
    if (!valorOk) continue
    const nota = 2 + Math.min(2, sobreposicao(o.nome, `${item.descricao} ${item.contraparte ?? ""}`))
    if (!melhor || nota > melhor.nota) melhor = { o, nota }
  }
  return melhor
}

// ---------- aplicar ----------

export async function aplicar(item: ExtratoItem, s: Sugestao, opts: { aprender: boolean; sempre: boolean; auto?: boolean }, ctx: Contexto) {
  let transacaoId: number | null = null
  let status: ExtratoItem["status"] = "lancado"

  if (s.conciliar) {
    transacaoId = s.conciliar.id
    status = "conciliado"
  } else if (s.acao === "despesa" || s.acao === "receita") {
    const parcelado = s.acao === "despesa" && s.cartao_id && s.parcela_total && s.parcela_total > 1
    const ini = s.parcela_atual ?? 1
    const linhas = parcelado
      ? Array.from({ length: s.parcela_total! - ini + 1 }, (_, i) => {
          const mes = addMonths(s.mes_ref, i)
          return {
            tipo: "despesa" as const, descricao: s.descricao, valor: item.valor, categoria: s.categoria,
            data: i === 0 ? s.data : `${mes}-01`, mes_ref: mes, cartao_id: s.cartao_id,
            parcela_atual: ini + i, parcela_total: s.parcela_total,
          }
        })
      : [{
          tipo: s.acao, descricao: s.descricao, valor: item.valor, categoria: s.categoria,
          data: s.data, mes_ref: s.acao === "despesa" && s.cartao_id ? s.mes_ref : mesDe(s.data),
          cartao_id: s.acao === "despesa" ? s.cartao_id : null,
        }]
    const { data, error } = await supabase.from("fin_transacoes").insert(linhas).select("id")
    if (error) throw error
    transacaoId = data?.[0]?.id ?? null
  } else if (s.acao === "obrigacao" && s.obrigacao_id) {
    const o = ctx.obrigacoes.find((x) => x.id === s.obrigacao_id)
    const { data, error } = await supabase.from("fin_transacoes").insert({
      tipo: "despesa", descricao: o?.nome ?? s.descricao, valor: item.valor, categoria: o?.categoria ?? s.categoria,
      data: item.data, mes_ref: mesDe(item.data), obrigacao_id: s.obrigacao_id,
    }).select("id")
    if (error) throw error
    transacaoId = data?.[0]?.id ?? null
  } else if (s.acao === "fatura" && s.cartao_id) {
    await registrarFaturaPaga(s.cartao_id, s.mes_ref, item.valor, item.data)
    ctx.faturaPagamentos = [...ctx.faturaPagamentos, { id: -1, cartao_id: s.cartao_id, mes_ref: s.mes_ref, pago_em: item.data, valor: item.valor, criado_em: "" }]
  } else {
    status = "ignorado"
  }

  let regraId = s.regra?.id ?? null
  if (opts.aprender && !s.conciliar) {
    const linha = {
      chave: s.chave, sentido: item.sentido, acao: s.acao, descricao: s.descricao, categoria: s.categoria,
      obrigacao_id: s.acao === "obrigacao" ? s.obrigacao_id : null, cartao_id: s.acao === "fatura" ? s.cartao_id : null,
      auto: opts.sempre, vezes: (s.regra?.vezes ?? 0) + 1, atualizado_em: new Date().toISOString(),
    }
    const { data } = await supabase.from("fin_regras").upsert(linha, { onConflict: "chave,sentido" }).select("id")
    regraId = data?.[0]?.id ?? regraId
  }

  const { error } = await supabase.from("fin_extrato").update({
    status, acao: s.conciliar ? "conciliado" : s.acao, auto: !!opts.auto, transacao_id: transacaoId,
    regra_id: regraId, resolvido_em: new Date().toISOString(),
  }).eq("id", item.id)
  if (error) throw error
  if (transacaoId) ctx.usados.add(transacaoId)
}

// Desfaz o que foi feito com um item e devolve ele pra fila de perguntas
export async function desfazer(item: ExtratoItem, transacoes: Transacao[], opts: { pararDeAutomatizar: boolean }) {
  if (item.status === "lancado" && item.transacao_id) {
    const t = transacoes.find((x) => x.id === item.transacao_id)
    // parcelado: apaga as parcelas que o lançamento criou junto (mesmo lote)
    const ids = t?.parcela_total && t.parcela_total > 1
      ? transacoes.filter((x) => x.cartao_id === t.cartao_id && x.descricao === t.descricao && x.parcela_total === t.parcela_total && x.criado_em === t.criado_em).map((x) => x.id)
      : [item.transacao_id]
    const { error } = await supabase.from("fin_transacoes").delete().in("id", ids)
    if (error) throw error
  }
  if (item.status === "lancado" && item.acao === "fatura") {
    // a baixa foi pelo valor deste item; reabre a fatura correspondente
    const { data } = await supabase.from("fin_fatura_pagamentos").select("cartao_id, mes_ref").eq("valor", item.valor).eq("pago_em", item.data)
    for (const p of data ?? []) await removerFaturaPaga(p.cartao_id, p.mes_ref)
  }
  if (opts.pararDeAutomatizar && item.regra_id) {
    await supabase.from("fin_regras").update({ auto: false }).eq("id", item.regra_id)
  }
  const { error } = await supabase.from("fin_extrato").update({
    status: "novo", auto: false, transacao_id: null, resolvido_em: null,
    // "sem:<id>": não era o mesmo lançamento, não religar; "revisar": volta pra fila e espera você
    acao: item.status === "conciliado" && item.transacao_id ? `sem:${item.transacao_id}` : "revisar",
  }).eq("id", item.id)
  if (error) throw error
}

// Resolve sozinho tudo que tem certeza (regra aprendida, já lançado à mão, pagamento dentro do cartão)
export async function processarAutomaticos(itens: ExtratoItem[], ctx: Contexto): Promise<{ feitos: number; erros: number }> {
  let feitos = 0, erros = 0
  const fila = itens.filter((i) => i.status === "novo" && !i.pendente).sort((a, b) => (a.data < b.data ? -1 : 1))
  for (const item of fila) {
    const s = sugerir(item, ctx)
    if (!s.automatico) continue
    try {
      await aplicar(item, s, { aprender: false, sempre: false, auto: true }, ctx)
      if (s.regra) await supabase.from("fin_regras").update({ vezes: s.regra.vezes + 1, atualizado_em: new Date().toISOString() }).eq("id", s.regra.id)
      feitos++
    } catch {
      erros++
    }
  }
  return { feitos, erros }
}
