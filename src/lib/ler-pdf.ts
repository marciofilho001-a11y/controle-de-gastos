// ---------------------------------------------------------------------------
// Fatura ou extrato em PDF (qualquer banco): o texto é lido no próprio navegador
// (nada sai do aparelho), remontado em linhas e cada linha com data + descrição + valor
// vira uma movimentação. PDF com senha (comum: começo do CPF) pede a senha uma vez.
// ---------------------------------------------------------------------------

export type LinhaPdf = { data: string; descricao: string; valor: number; sinal: "+" | "-" | null; contraparte?: string | null }

async function textoEmLinhas(arquivo: File, pedirSenha: () => string | null): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist")
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const dados = new Uint8Array(await arquivo.arrayBuffer())
  const tarefa = pdfjs.getDocument({ data: dados })
  tarefa.onPassword = (atualizar: (s: string) => void, motivo: number) => {
    const senha = pedirSenha()
    if (senha == null) { tarefa.destroy(); return }
    atualizar(senha)
    void motivo
  }
  const doc = await tarefa.promise
  const linhas: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p)
    const conteudo = await pagina.getTextContent()
    // agrupa os pedaços de texto pela altura (y) e ordena da esquerda pra direita
    const porY = new Map<number, { x: number; s: string }[]>()
    for (const it of conteudo.items as { str: string; transform: number[] }[]) {
      if (!it.str?.trim()) continue
      const y = Math.round(it.transform[5] / 2) * 2
      const chave = [...porY.keys()].find((k) => Math.abs(k - y) <= 2) ?? y
      porY.set(chave, [...(porY.get(chave) ?? []), { x: it.transform[4], s: it.str }])
    }
    for (const y of [...porY.keys()].sort((a, b) => b - a)) {
      linhas.push(porY.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join("  "))
    }
  }
  await doc.destroy()
  return linhas
}

const RE_DATA = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/
const RE_VALOR = /(-\s*)?(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})(\s*-)?\s*([CD]\b|\+)?\s*$/i
const RE_PULAR = /\b(saldo|total|limite|vencimento|pagamento m[ií]nimo|encargos|juros do rotativo|cet\b|iof financ|valor m[ií]nimo|cr[eé]dito rotativo|parcelamento de fatura|resumo|subtotal)\b/i
const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 }

// data de referência do documento (vencimento ou maior data com ano) pra completar "dd/mm"
function referencia(linhas: string[]): Date {
  const txt = linhas.join("\n")
  const venc = txt.match(/vencimento[^\d]{0,30}(\d{2})\/(\d{2})\/(\d{4})/i)
  if (venc) return new Date(Number(venc[3]), Number(venc[2]) - 1, Number(venc[1]))
  let maior: Date | null = null
  for (const m of txt.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && (!maior || d > maior)) maior = d
  }
  return maior ?? new Date()
}

export async function lerPdf(arquivo: File, pedirSenha: () => string | null): Promise<LinhaPdf[]> {
  return extrairMovimentos(await textoEmLinhas(arquivo, pedirSenha))
}

// texto do PDF (já em linhas) -> movimentações
export function extrairMovimentos(linhas: string[]): LinhaPdf[] {
  const agrupado = extrairAgrupado(linhas)
  if (agrupado.length) return agrupado
  const ref = referencia(linhas)
  const out: LinhaPdf[] = []
  for (const bruta of linhas) {
    let l = bruta.replace(/\s+/g, " ").trim()
    // "12 OUT" (Nubank) -> "12/10"
    l = l.replace(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b\.?/i, (_, d, m) => `${d}/${MESES[m.toLowerCase()]}`)
    const md = l.match(RE_DATA)
    const mv = l.match(RE_VALOR)
    if (!md || !mv) continue
    const dia = Number(md[1]), mes = Number(md[2])
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) continue
    let ano = md[3] ? Number(md[3].length === 2 ? `20${md[3]}` : md[3]) : ref.getFullYear()
    // sem ano: data depois do documento é do ano anterior (fatura de janeiro com compras de dezembro)
    if (!md[3] && new Date(ano, mes - 1, dia).getTime() > ref.getTime() + 40 * 86400000) ano -= 1
    let descricao = l.slice(md[0].length, l.length - mv[0].length).trim()
    // tira uma segunda data colada (extratos com "data mov." e "data valor")
    descricao = descricao.replace(/^\d{1,2}\/\d{1,2}(\/\d{2,4})?\s+/, "").trim()
    if (!descricao || descricao.length < 2 || RE_PULAR.test(descricao)) continue
    const valor = Number(mv[2].replace(/\./g, "").replace(",", "."))
    if (!valor) continue
    const negativo = !!mv[1] || !!mv[3] || /^D$/i.test(mv[4] ?? "")
    const positivo = /^(C|\+)$/i.test(mv[4] ?? "")
    out.push({
      data: `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
      descricao: descricao.slice(0, 200),
      valor,
      sinal: negativo ? "-" : positivo ? "+" : null,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Extrato "agrupado por dia" (conta Nubank e parecidos): a data aparece uma vez,
// depois "Total de entradas" / "Total de saídas" e as movimentações embaixo, sem data
// e sem sinal; o nome de quem recebeu pode quebrar em várias linhas.
// ---------------------------------------------------------------------------
const RE_DIA = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s+(\d{4})\b\s*(.*)$/i
const RE_DIA_NUM = /^(\d{2})\/(\d{2})\/(\d{4})\b\s*(.*)$/
const RE_SECAO = /^total de (entradas|sa[ií]das)\b/i
const RE_RODAPE = /(tem alguma d[uú]vida|ouvidoria|extrato gerado|atendimento|metropolitanas|dispon[ií]veis em|valores em r\$|\bde \d{4}\s+a\s+\d{1,2} de|^cpf\b|ag[eê]ncia\s+\d+\s+conta$|saldo|rendimento l[ií]quido|n[aã]o nos responsabilizamos|asseguramos|nu financeira|nu pagamentos s\.a|^cnpj|^investimento$|^pagamento$)/i
const RE_VALOR_FIM = /^(.*?)\s{2,}([-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2})\s*$/
const cpfDe = (s: string) => s.match(/•••\.(\d{3}\.\d{3})-••/)?.[1] ?? null

function extrairAgrupado(linhas: string[]): LinhaPdf[] {
  const temDia = linhas.some((l) => (RE_DIA.exec(l.trim()) ?? RE_DIA_NUM.exec(l.trim()))?.[4]?.match(RE_SECAO))
  if (!temDia) return []
  // dono do extrato (pra reconhecer Pix pra você mesmo em outro banco)
  const cpfTitular = linhas.slice(0, 6).map(cpfDe).find(Boolean) ?? null

  const out: (LinhaPdf & { _extra: number; _op: string; _resto: string })[] = []
  let data: string | null = null
  let sinal: "+" | "-" | null = null
  let ultimo: (typeof out)[number] | null = null
  for (const bruta of linhas) {
    let l = bruta.trim()
    const dia = RE_DIA.exec(l) ?? null
    const num = dia ? null : RE_DIA_NUM.exec(l)
    if (dia || num) {
      const [d, m, a] = dia ? [Number(dia[1]), MESES[dia[2].slice(0, 3).toLowerCase()], Number(dia[3])] : [Number(num![1]), Number(num![2]), Number(num![3])]
      data = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      l = (dia ? dia[4] : num![4]).trim()
      sinal = null
      ultimo = null
      if (!l) continue
    }
    const sec = RE_SECAO.exec(l)
    if (sec) { sinal = /entrada/i.test(sec[1]) ? "+" : "-"; ultimo = null; continue }
    if (!data || !sinal) continue
    if (RE_RODAPE.test(l)) { ultimo = null; continue }
    const mv = RE_VALOR_FIM.exec(l)
    if (mv) {
      const valor = Number(mv[2].replace(/[-+\s]/g, "").replace(/\./g, "").replace(",", "."))
      if (!valor) continue
      const colunas = mv[1].split(/\s{2,}/).map((c) => c.trim()).filter(Boolean)
      ultimo = { data, descricao: "", valor, sinal, contraparte: null, _extra: 0, _op: colunas[0] ?? "", _resto: colunas.slice(1).join(" ") }
      out.push(ultimo)
      continue
    }
    // continuação do nome (no máximo duas linhas, pra não pegar rodapé)
    if (ultimo && ultimo._extra < 2) { ultimo._resto += " " + l; ultimo._extra++ }
  }

  return out.map(({ _extra, _op, _resto, ...m }) => {
    void _extra
    const resto = _resto.replace(/\s+/g, " ").trim()
    // "Fulano de Tal - •••.123.456-•• - BANCO..." / "EMPRESA LTDA - 12.345.678/0001-90 - BANCO..."
    let nome = resto.split(/\s+-\s+/)[0].replace(/^[\d./-]{8,}\s+/, "").replace(/\s*-\s*$/, "").trim()
    if (/^\d/.test(nome) || nome.length < 2) nome = ""
    const proprio = !!cpfTitular && cpfDe(resto) === cpfTitular
    const op = _op || "Movimentação"
    let descricao: string
    if (/valor adicionado/i.test(`${op} ${resto}`)) return { ...m, descricao: "Valor adicionado na conta por cartão de crédito (Pix no Crédito)", contraparte: null }
    if (!nome) descricao = op
    else if (proprio) descricao = `${op} - ${nome} (mesma titularidade)`
    else descricao = `${op} - ${nome}`
    return { ...m, descricao: descricao.slice(0, 200), contraparte: nome || null }
  })
}
