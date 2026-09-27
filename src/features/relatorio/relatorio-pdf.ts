import type { Transacao, Cartao, Obrigacao, Teto } from "@/lib/supabase"
import { catInfo } from "@/lib/categorias"
import { fmtR, fmtMesLongo, fmtData } from "@/lib/format"
import {
  receitasDoMes, despesasDoMes, despesasExibicaoDoMes, obrigacoesAtivasNoMes, faturaDoMes,
  txDoMes, parcelaNoMes,
} from "@/lib/selectors"
import { gerarInsights, type Severidade } from "@/lib/insights"

// ---------------------------------------------------------------------------
// Relatório de gastos em PDF (A4), gerado no navegador a partir dos dados do
// mês. Estilo: faixa navy com detalhe teal, tiles de KPI, seções numeradas,
// tabelas e rodapé com paginação. Nenhum número é inventado: tudo sai dos
// mesmos seletores do app (mesma base do Dashboard e do Relatório).
// ---------------------------------------------------------------------------

export type PdfInput = {
  transacoes: Transacao[]
  cartoes: Cartao[]
  obrigacoes: Obrigacao[]
  tetos: Teto[]
  config: Record<string, string>
  mesRef: string
}

const NAVY: [number, number, number] = [30, 52, 72]
const TEAL: [number, number, number] = [16, 179, 163]
const INK: [number, number, number] = [15, 23, 42]
const MUTED: [number, number, number] = [100, 116, 139]
const LINE: [number, number, number] = [226, 232, 240]
const TILE: [number, number, number] = [241, 245, 249]
const ZEBRA: [number, number, number] = [248, 250, 252]
const NOTE_BG: [number, number, number] = [230, 247, 245]
const NOTE_BD: [number, number, number] = [127, 214, 204]

const PAGE_W = 210
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

// Helvetica (WinAnsi) não tem alguns glifos: troca por equivalentes seguros
function txt(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[—–]/g, "-")
    .replace(/×/g, "x")
    .replace(/→/g, "->")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[✓◌]/g, "")
}

const SEV_LABEL: Record<Severidade, string> = { vilao: "Vilão", atencao: "Atenção", ok: "Bom sinal", info: "Panorama" }

export async function gerarRelatorioPdf(inp: PdfInput) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const { transacoes, cartoes, obrigacoes, tetos, config, mesRef } = inp

  // ---------------- dados (mesma base do app) ----------------
  const receita = receitasDoMes(transacoes, mesRef)
  const despesas = despesasDoMes(transacoes, mesRef)
  const sobra = receita - despesas
  const exib = despesasExibicaoDoMes(transacoes, mesRef)
  const receitas = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "receita")
  const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
  const faturas = cartoes
    .filter((c) => c.ativo !== false)
    .map((c) => ({ c, v: faturaDoMes(transacoes, c.id, mesRef) }))
    .filter((f) => f.v > 0)
  const totalObr = ativas.reduce((s, o) => s + Number(o.valor), 0)
  const totalFat = faturas.reduce((s, f) => s + f.v, 0)
  const comprometido = totalObr + totalFat

  // por categoria (top 6 + demais)
  const porCat = new Map<string, number>()
  for (const t of exib) {
    const k = t.categoria || "outro"
    porCat.set(k, (porCat.get(k) || 0) + Number(t.valor))
  }
  const cats = [...porCat.entries()].sort((a, b) => b[1] - a[1])
  const top = cats.slice(0, 6)
  const demais = cats.slice(6).reduce((s, [, v]) => s + v, 0)
  const linhasCat: { label: string; valor: number }[] = top.map(([k, v]) => ({ label: catInfo(k).l, valor: v }))
  if (demais > 0) linhasCat.push({ label: "Demais categorias", valor: demais })
  const somaCats = linhasCat.reduce((s, l) => s + l.valor, 0)

  // lançamentos individuais (despesas + receitas, por data)
  const nomeCartao = (id: number | null) => (id ? cartoes.find((c) => c.id === id)?.nome || "Cartão" : "Pix / Débito")
  const lanc = [...receitas, ...exib]
    .filter((t) => !("_virtual" in t && (t as { _virtual?: boolean })._virtual))
    .sort((a, b) => (a.data < b.data ? -1 : 1))
  const virtuais = exib.filter((t) => (t as { _virtual?: boolean })._virtual)

  const insights = gerarInsights({ transacoes, cartoes, obrigacoes, tetos, config, mesRef })
    .filter((i) => i.id !== "vazio")

  const mesLongo = fmtMesLongo(mesRef)
  const mesTitulo = mesLongo.charAt(0).toUpperCase() + mesLongo.slice(1)
  const hoje = new Date().toLocaleDateString("pt-BR")

  // ---------------- documento ----------------
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  let y = 0

  const tableBase = {
    margin: { left: MARGIN, right: MARGIN, top: 34, bottom: 22 },
    styles: { font: "helvetica", fontSize: 8.5, textColor: INK, cellPadding: 2.4, lineColor: LINE, lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: ZEBRA },
    theme: "grid" as const,
    showFoot: "lastPage" as const,
  }

  function titulo(t: string, sub: string) {
    doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(16)
    doc.text(txt(t), MARGIN, y)
    y += 6
    doc.setTextColor(...MUTED).setFont("helvetica", "normal").setFontSize(9)
    doc.text(txt(sub), MARGIN, y)
    y += 8
  }

  // hEst = altura estimada do bloco que vem a seguir; se não couber, a seção inteira vai pra próxima página
  function secao(n: number, t: string, sub: string, hEst = 40) {
    if (y + 12 + hEst > 276) { doc.addPage(); y = 36 }
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, y - 1.5, MARGIN + 12, y - 1.5)
    doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(12)
    doc.text(txt(`${n}. ${t}`), MARGIN + 15, y)
    y += 4.5
    doc.setTextColor(...MUTED).setFont("helvetica", "normal").setFontSize(8)
    doc.text(txt(sub), MARGIN + 15, y)
    y += 7
  }

  function tiles(items: { label: string; valor: string }[]) {
    const gap = 3
    const w = (CONTENT_W - gap * (items.length - 1)) / items.length
    const h = 17
    items.forEach((it, i) => {
      const x = MARGIN + i * (w + gap)
      const dark = i === 0
      doc.setFillColor(...(dark ? NAVY : TILE))
      doc.roundedRect(x, y, w, h, 1.5, 1.5, "F")
      doc.setTextColor(...(dark ? [255, 255, 255] as [number, number, number] : MUTED)).setFont("helvetica", "bold").setFontSize(6.5)
      doc.text(txt(it.label.toUpperCase()), x + 4, y + 6)
      doc.setTextColor(...(dark ? [255, 255, 255] as [number, number, number] : NAVY)).setFontSize(12.5)
      doc.text(txt(it.valor), x + 4, y + 13)
    })
    y += h + 8
  }

  function barras(linhas: { label: string; valor: number }[]) {
    const max = Math.max(1, ...linhas.map((l) => l.valor))
    const x0 = MARGIN + 48, x1 = PAGE_W - MARGIN - 26, bw = x1 - x0
    doc.setFontSize(8.5)
    linhas.forEach((l, i) => {
      const yy = y + i * 5.2
      doc.setTextColor(...INK).setFont("helvetica", "normal")
      doc.text(txt(l.label), MARGIN, yy + 2)
      doc.setFillColor(...LINE)
      doc.roundedRect(x0, yy, bw, 2.6, 1.3, 1.3, "F")
      doc.setFillColor(...(i === 0 ? TEAL : NAVY))
      doc.roundedRect(x0, yy, Math.max(2.6, (l.valor / max) * bw), 2.6, 1.3, 1.3, "F")
      doc.setFont("helvetica", "bold")
      doc.text(txt(fmtR(l.valor)), PAGE_W - MARGIN, yy + 2, { align: "right" })
    })
    y += linhas.length * 5.2 + 5
  }

  const hTab = (linhas: number) => linhas * 8.2 + 20

  function tabela(opts: Parameters<typeof autoTable>[1]) {
    autoTable(doc, { ...tableBase, startY: y, ...opts })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9
  }

  function nota(texto: string) {
    const lines = doc.setFontSize(8.5).splitTextToSize(txt(texto), CONTENT_W - 8) as string[]
    const h = lines.length * 4.2 + 6
    if (y + h > 270) { doc.addPage(); y = 36 }
    doc.setFillColor(...NOTE_BG).setDrawColor(...NOTE_BD).setLineWidth(0.3)
    doc.roundedRect(MARGIN, y, CONTENT_W, h, 1, 1, "FD")
    doc.setTextColor(...INK).setFont("helvetica", "normal")
    doc.text(lines, MARGIN + 4, y + 5)
    y += h + 8
  }

  // ---------------- página 1 ----------------
  y = 40
  titulo("Controle financeiro mensal", `Visão consolidada de ${mesTitulo}: categorias, obrigações, cartões, lançamentos e panorama do gestor.`)
  tiles([
    { label: "Total de despesas", valor: fmtR(despesas) },
    { label: "Receitas do mês", valor: fmtR(receita) },
    { label: "Obrigações + faturas", valor: fmtR(comprometido) },
    { label: sobra >= 0 ? "Sobra do mês" : "Déficit do mês", valor: fmtR(sobra) },
  ])

  secao(1, "Resumo por categoria", `Distribuição do total de ${fmtR(despesas)} em despesas, sem duplicar fatura de cartão com seus itens.`, linhasCat.length * 5.2 + hTab(linhasCat.length))
  barras(linhasCat)
  tabela({
    head: [["Categoria", "Valor", "%"]],
    body: linhasCat.map((l) => [txt(l.label), fmtR(l.valor), `${despesas > 0 ? ((l.valor / despesas) * 100).toFixed(1).replace(".", ",") : "0,0"}%`]),
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 34 }, 2: { halign: "right", cellWidth: 20 } },
  })

  secao(2, "Obrigações e faturas", "O que está comprometido no mês por compromisso fixo e por cartão.", hTab(ativas.length + faturas.length + 1))
  tabela({
    pageBreak: "avoid",
    head: [["Item", "Tipo", "Dia", "Valor"]],
    body: [
      ...ativas.map((o) => [txt(o.nome), o.parcela_total ? `Parcela ${parcelaNoMes(o, mesRef)}/${o.parcela_total}` : "Recorrente", String(o.dia_vencimento || "-"), fmtR(Number(o.valor))]),
      ...faturas.map((f) => [txt(`Fatura ${f.c.nome}`), "Cartão", String(f.c.dia_vencimento || "-"), fmtR(f.v)]),
    ],
    foot: [["TOTAL", `${ativas.length + faturas.length} itens`, "", fmtR(comprometido)]],
    footStyles: { fillColor: TILE, textColor: INK, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 34 }, 2: { cellWidth: 14, halign: "center" }, 3: { halign: "right", cellWidth: 32 } },
  })

  // ---------------- página 2+ ----------------
  if (y > 150) { doc.addPage(); y = 40 } else { y += 6 }
  titulo("Detalhamento dos lançamentos", `${lanc.length} lançamento(s) em ${mesTitulo}, por data, com estabelecimento, categoria e meio de pagamento.`)

  secao(3, "Lançamentos individuais", "Receitas em verde, despesas em vermelho. Faturas ainda não detalhadas aparecem ao final.", 60)
  tabela({
    head: [["Data", "Estabelecimento", "Categoria", "Meio", "Valor"]],
    body: [
      ...lanc.map((t) => [
        fmtData(t.data), txt(t.descricao || "-"), txt(catInfo(t.categoria).l),
        t.tipo === "receita" ? "Receita" : t.obrigacao_id ? "Obrigação" : nomeCartao(t.cartao_id),
        (t.tipo === "receita" ? "+ " : "- ") + fmtR(Number(t.valor)),
      ]),
      ...virtuais.map((t) => ["-", txt(`Fatura a detalhar - ${nomeCartao(t.cartao_id)}`), "Faturas a detalhar", nomeCartao(t.cartao_id), "- " + fmtR(Number(t.valor))]),
    ],
    foot: [["TOTAL", `${lanc.length} lançamentos`, "", "Despesas", fmtR(despesas)]],
    footStyles: { fillColor: TILE, textColor: INK, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: "auto", fontStyle: "bold" }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { halign: "right", cellWidth: 28 } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 4) {
        const v = String(d.cell.raw)
        d.cell.styles.textColor = v.startsWith("+") ? [22, 163, 74] : [220, 38, 38]
        d.cell.styles.fontStyle = "bold"
      }
    },
  })

  secao(4, "Panorama do gestor", "Leitura direta do mês, calculada localmente a partir dos seus lançamentos.", hTab(Math.min(12, insights.length)) + 30)
  tabela({
    pageBreak: "avoid",
    head: [["Sinal", "Leitura"]],
    body: insights.slice(0, 12).map((i) => [SEV_LABEL[i.severidade], txt(i.frase + (i.detalhe ? ` ${i.detalhe}` : ""))]),
    columnStyles: { 0: { cellWidth: 24, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 0) {
        const s = String(d.cell.raw)
        d.cell.styles.textColor = s === "Vilão" ? [220, 38, 38] : s === "Atenção" ? [217, 119, 6] : s === "Bom sinal" ? [22, 163, 74] : MUTED
      }
    },
  })

  secao(5, "Conferência financeira", "Checagens simples para garantir que os totais fecham.", hTab(4))
  const ok = (a: number, b: number) => Math.abs(a - b) < 0.01
  tabela({
    pageBreak: "avoid",
    head: [["Conferência", "Resultado", "Status"]],
    body: [
      ["Soma das categorias", fmtR(somaCats), ok(somaCats, despesas) ? "Confere com o total de despesas" : `Difere de ${fmtR(despesas)}`],
      ["Obrigações + faturas", fmtR(comprometido), `${((comprometido / Math.max(1, receita || parseFloat(config.renda_projetada) || 1)) * 100).toFixed(0)}% da renda comprometida`],
      ["Receitas - despesas", fmtR(sobra), sobra >= 0 ? "Mês fechou no azul" : "Mês fechou no vermelho"],
      ["Lançamentos listados", `${lanc.length + virtuais.length}`, ok(lanc.filter((t) => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor), 0) + virtuais.reduce((s, t) => s + Number(t.valor), 0), despesas) ? "Somam o total de despesas" : "Soma difere do total"],
    ],
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 36, halign: "right", fontStyle: "bold" }, 2: { cellWidth: "auto" } },
  })

  nota(`Observação: faturas de cartão entram uma única vez. Quando você já detalhou itens de uma fatura, o relatório mostra os itens e apenas o restante como "Fatura a detalhar" - nunca a fatura cheia somada aos itens. Panorama e conferências vêm das mesmas regras do aplicativo.`)

  // ---------------- cabeçalho e rodapé em todas as páginas ----------------
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFillColor(...NAVY).rect(0, 0, PAGE_W, 24, "F")
    doc.setFillColor(...TEAL).rect(0, 0, 6, 24, "F")
    doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(10)
    doc.text("RELATÓRIO DE GASTOS", MARGIN, 14.5)
    doc.setFont("helvetica", "normal").setFontSize(8.5)
    doc.text(txt(`FinFlow Pro - ${mesTitulo}`), PAGE_W - MARGIN, 14.5, { align: "right" })
    doc.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, 283, PAGE_W - MARGIN, 283)
    doc.setTextColor(...MUTED).setFontSize(7.5)
    doc.text(txt(`Gerado pelo FinFlow Pro em ${hoje}. Valores calculados a partir dos lançamentos do mês.`), MARGIN, 288)
    doc.text(`Página ${p} de ${total}`, PAGE_W - MARGIN, 288, { align: "right" })
  }

  doc.save(`relatorio-gastos-${mesRef}.pdf`)
}
