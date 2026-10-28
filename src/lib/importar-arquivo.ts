import { supabase, type Cartao, type ExtratoItem } from "@/lib/supabase"

// ---------------------------------------------------------------------------
// Importar extrato/fatura por arquivo (sem cadastro em nada): OFX de qualquer banco,
// CSV do Nubank (conta e cartão), Mercado Pago e CSV genérico (data, descrição, valor).
// Cada linha vira um item do extrato (mesmo caminho do Open Finance): o site decide
// sozinho o que já conhece e pergunta o resto. Reimportar o mesmo arquivo não duplica.
// ---------------------------------------------------------------------------

export type Destino = { tipo: "cartao"; cartao: Cartao } | { tipo: "conta" }

type Linha = { data: string; descricao: string; valor: number; id?: string; parcela?: [number, number] | null }

export type ResultadoImportacao = { lidas: number; novas: number; repetidas: number; formato: string }

function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

// "1.234,56" | "-12,50" | "R$ 10,00" | "12.50" | "(12,50)" → número
export function numeroBR(s: string): number | null {
  let t = String(s ?? "").trim()
  if (!t) return null
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t.replace(/^r\$\s*/i, "")) || /-\s*$/.test(t)
  t = t.replace(/[^\d.,]/g, "")
  if (!t) return null
  const ult = Math.max(t.lastIndexOf(","), t.lastIndexOf("."))
  const dec = ult >= 0 && t.length - ult - 1 <= 2 ? t.slice(ult + 1) : ""
  const int = (dec ? t.slice(0, ult) : t).replace(/[.,]/g, "")
  const n = parseFloat(`${int}.${dec || "0"}`)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

// yyyy-mm-dd | dd/mm/yyyy | dd-mm-yyyy | dd/mm/yy | yyyymmdd(hhmmss) → yyyy-mm-dd
export function dataISO(s: string): string | null {
  const t = String(s ?? "").trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

function parcelaDe(desc: string): [number, number] | null {
  const m = desc.match(/parcela\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i) || desc.match(/\((\d{1,2})\/(\d{1,2})\)\s*$/) || desc.match(/\s(\d{1,2})\/(\d{1,2})\s*$/)
  if (!m) return null
  const a = Number(m[1]), b = Number(m[2])
  return b > 1 && a >= 1 && a <= b ? [a, b] : null
}

// ---------- OFX ----------
function lerOFX(txt: string): Linha[] {
  const out: Linha[] = []
  const blocos = txt.split(/<STMTTRN>/i).slice(1)
  const tag = (b: string, t: string) => {
    const m = b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, "i"))
    return m ? m[1].trim() : ""
  }
  for (const b of blocos) {
    const data = dataISO(tag(b, "DTPOSTED"))
    const valor = numeroBR(tag(b, "TRNAMT").replace(".", ",").replace(/,(?=.*,)/g, ""))
    const desc = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" - ") || tag(b, "TRNTYPE")
    if (!data || valor == null || !valor) continue
    out.push({ data, valor, descricao: desc, id: tag(b, "FITID") || undefined, parcela: parcelaDe(desc) })
  }
  return out
}

// ---------- CSV ----------
function dividir(linha: string, sep: string): string[] {
  const out: string[] = []
  let cur = "", q = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') { if (q && linha[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === sep && !q) { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z_ ]/g, "").trim()

function lerCSV(txt: string): { linhas: Linha[]; formato: string } {
  const todas = txt.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim())
  if (todas.length < 2) return { linhas: [], formato: "CSV vazio" }
  // acha a linha de cabeçalho (algumas exportações têm linhas de título antes)
  let iCab = 0, sep = ","
  for (let i = 0; i < Math.min(10, todas.length); i++) {
    const s = (todas[i].match(/;/g) || []).length > (todas[i].match(/,/g) || []).length ? ";" : ","
    const cols = dividir(todas[i], s).map(norm)
    if (cols.some((c) => /^(data|date|release_date|dt)/.test(c)) && cols.some((c) => /(valor|amount|value|net_amount|transaction_net_amount)/.test(c))) { iCab = i; sep = s; break }
  }
  const cab = dividir(todas[iCab], sep).map(norm)
  const idx = (re: RegExp) => cab.findIndex((c) => re.test(c))
  const iData = idx(/^(data|date|release_date|dt)/)
  const iValor = idx(/(transaction_net_amount|net_amount|^valor|amount|value)/)
  let iDesc = idx(/(descricao|description|title|historico|estabelecimento|lancamento|transaction_type|detalhe)/)
  const iId = idx(/(identificador|reference_id|^id$|fitid)/)
  if (iData < 0 || iValor < 0) return { linhas: [], formato: "CSV sem colunas de data e valor" }
  if (iDesc < 0) iDesc = cab.findIndex((_, i) => i !== iData && i !== iValor && i !== iId)
  const formato =
    cab.includes("title") && cab.includes("amount") ? "Nubank (fatura do cartão)" :
    cab.includes("identificador") ? "Nubank (conta)" :
    cab.some((c) => c.includes("release_date")) ? "Mercado Pago" : "CSV"
  const linhas: Linha[] = []
  for (const l of todas.slice(iCab + 1)) {
    const c = dividir(l, sep)
    const data = dataISO(c[iData] ?? "")
    const valor = numeroBR(c[iValor] ?? "")
    const descricao = (c[iDesc] ?? "").trim()
    if (!data || valor == null || !valor) continue
    linhas.push({ data, valor, descricao: descricao || "Movimentação", id: iId >= 0 ? c[iId] : undefined, parcela: parcelaDe(descricao) })
  }
  return { linhas, formato }
}

export function lerTexto(txt: string): { linhas: Linha[]; formato: string } {
  return /<OFX>|OFXHEADER|<STMTTRN>/i.test(txt) ? { linhas: lerOFX(txt), formato: "OFX" } : lerCSV(txt)
}

// Pix do Nubank: "Transferência enviada pelo Pix - FULANO DE TAL - •••.123.456-•• - BANCO"
export function contraparteDe(desc: string): string | null {
  const m = desc.match(/pix\s*-\s*([^-•]+?)\s*(?:-|$)/i)
  return m ? m[1].trim() : null
}

export async function importarArquivo(arquivo: File, destino: Destino): Promise<ResultadoImportacao> {
  const bruto = await arquivo.arrayBuffer()
  let txt = new TextDecoder("utf-8").decode(bruto)
  if (txt.includes("�")) txt = new TextDecoder("windows-1252").decode(bruto)   // OFX/CSV antigos em latin-1
  const { linhas, formato } = lerTexto(txt)
  if (!linhas.length) throw new Error(`Não encontrei movimentações no arquivo (${formato}). Use OFX ou CSV com data, descrição e valor.`)

  const ehCartao = destino.tipo === "cartao"
  // no cartão, alguns arquivos trazem compra positiva (Nubank CSV), outros negativa (OFX): vale o sinal da maioria
  const positivas = linhas.filter((l) => l.valor > 0).length
  const compraPositiva = ehCartao && positivas >= linhas.length / 2

  const contaId = ehCartao ? `arquivo:cartao:${destino.cartao.id}` : "arquivo:conta"
  const { error: e1 } = await supabase.from("fin_bancos_contas").upsert({
    id: contaId, origem: "arquivo", tipo: ehCartao ? "CREDIT" : "BANK",
    nome: ehCartao ? destino.cartao.nome : "Conta (Pix e débito)", banco: "Arquivo importado",
    cartao_id: ehCartao ? destino.cartao.id : null, ultimo_sync: new Date().toISOString(),
  }, { onConflict: "id" })
  if (e1) throw e1

  const vistos = new Map<string, number>()
  const itens: Partial<ExtratoItem>[] = linhas.map((l) => {
    const saida = ehCartao ? (compraPositiva ? l.valor > 0 : l.valor < 0) : l.valor < 0
    const base = `${contaId}|${l.data}|${l.valor.toFixed(2)}|${l.descricao}`
    const n = (vistos.get(base) ?? 0) + 1      // duas compras iguais no mesmo dia continuam sendo duas
    vistos.set(base, n)
    return {
      id: l.id ? `arq:${hash(contaId + "|" + l.id)}` : `arq:${hash(base + "|" + n)}`,
      conta_id: contaId, origem: "arquivo", data: l.data,
      descricao: l.descricao.slice(0, 200), descricao_raw: l.descricao.slice(0, 200),
      valor: Math.round(Math.abs(l.valor) * 100) / 100, sentido: saida ? "saida" : "entrada",
      tipo_conta: ehCartao ? "CREDIT" : "BANK",
      operacao: /pix/i.test(l.descricao) ? "PIX" : null,
      contraparte: contraparteDe(l.descricao),
      parcela_atual: l.parcela?.[0] ?? null, parcela_total: l.parcela?.[1] ?? null,
      pendente: false,
    }
  })

  // grava só o que ainda não existe (reimportar não duplica nem desfaz o que já foi resolvido)
  const ids = itens.map((i) => i.id!)
  const ja = new Set<string>()
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase.from("fin_extrato").select("id").in("id", ids.slice(i, i + 300))
    for (const r of data ?? []) ja.add(r.id)
  }
  const novas = itens.filter((i) => !ja.has(i.id!))
  for (let i = 0; i < novas.length; i += 300) {
    const { error } = await supabase.from("fin_extrato").insert(novas.slice(i, i + 300))
    if (error) throw error
  }
  return { lidas: linhas.length, novas: novas.length, repetidas: linhas.length - novas.length, formato }
}
