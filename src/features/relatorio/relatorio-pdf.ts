import type { Transacao, Cartao, Obrigacao, Teto } from "@/lib/supabase"
import type { LucideIcon } from "@/lib/icons"
import {
  Wallet, LayoutGrid, FileText, ListChecks, Sparkles, CheckCircle2, Lightbulb, Link as LinkIcon,
  CreditCard, ReceiptText, Beer, GraduationCap, SprayCan, HeartPulse, UtensilsCrossed,
  ShoppingBag, Gamepad2, Car, TrendingUp,
} from "@/lib/icons"
import { catInfo, catColor } from "@/lib/categorias"
import { fmtR, fmtMesLongo, fmtData } from "@/lib/format"
import {
  receitasDoMes, despesasComContasDoMes, despesasExibicaoDoMes, obrigacoesAtivasNoMes, faturaDoMes,
  txDoMes, parcelaNoMes, ehFaturaCheia, type LinhaExibicao,
} from "@/lib/selectors"
import { gerarInsights, type Severidade } from "@/lib/insights"
import { temasComExtras, temaDaDescricao, nomeComercial, type Tema } from "@/lib/temas"
import { iconePng } from "./pdf-icons"

// ---------------------------------------------------------------------------
// Relatório de gastos em PDF (A4), gerado no navegador.
// Estrutura: Categoria -> Subcategoria -> Lançamentos, com visão por
// comportamento no meio. Nenhum lançamento é omitido e nenhum número é
// inventado: tudo sai dos mesmos seletores do app.
// ---------------------------------------------------------------------------

export type PdfInput = {
  transacoes: Transacao[]
  cartoes: Cartao[]
  obrigacoes: Obrigacao[]
  tetos: Teto[]
  config: Record<string, string>
  mesRef: string
}

type RGB = [number, number, number]
const NAVY: RGB = [23, 43, 77]        // faixa e títulos
const HEAD: RGB = [30, 58, 110]       // cabeçalho de tabela
const TEAL: RGB = [16, 179, 163]
const INK: RGB = [15, 23, 42]
const MUTED: RGB = [100, 116, 139]
const LINE: RGB = [223, 231, 242]
const TINT: RGB = [240, 245, 252]     // zebra / subcategoria
const TOTAL_BG: RGB = [226, 236, 250] // linhas de total
const TILE: RGB = [241, 245, 249]
const NOTE_BG: RGB = [237, 244, 253]
const NOTE_BD: RGB = [147, 178, 224]
const GREEN: RGB = [22, 163, 74]
const RED: RGB = [220, 38, 38]

const PAGE_W = 210
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

function txt(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[—–]/g, "-")
    .replace(/×/g, "x")
    .replace(/→/g, "->")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[✓◌•]/g, "")
}
const pct = (v: number, base: number) => (base > 0 ? `${((v / base) * 100).toFixed(1).replace(".", ",")}%` : "0,0%")
const SEV_LABEL: Record<Severidade, string> = { vilao: "Vilão", atencao: "Atenção", ok: "Bom sinal", info: "Panorama" }

// grupos de comportamento (seção 2)
const GRUPOS: Record<string, { icon: LucideIcon; cor: string }> = {
  "Saídas e bebidas": { icon: Beer, cor: "#f59e0b" },
  "Educação": { icon: GraduationCap, cor: "#f97316" },
  "Perfumaria": { icon: SprayCan, cor: "#0d9488" },
  "Academia e saúde": { icon: HeartPulse, cor: "#ef4444" },
  "Alimentação": { icon: UtensilsCrossed, cor: "#22c55e" },
  "Compras": { icon: ShoppingBag, cor: "#ec4899" },
  "Entretenimento": { icon: Gamepad2, cor: "#6366f1" },
  "Transporte": { icon: Car, cor: "#3b82f6" },
  "Faturas ainda não detalhadas": { icon: ReceiptText, cor: "#8b93a7" },
  "Obrigações fixas": { icon: LinkIcon, cor: "#a78bfa" },
}

export async function gerarRelatorioPdf(inp: PdfInput) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const { transacoes, cartoes, obrigacoes, tetos, config, mesRef } = inp
  const temas = temasComExtras(config.temas_extra)

  // ---------------- dados ----------------
  const receita = receitasDoMes(transacoes, mesRef)
  // mesma base da tela: contas fixas a pagar contam no mês
  const despesas = despesasComContasDoMes(obrigacoes, transacoes, mesRef)
  const sobra = receita - despesas
  const exib = despesasExibicaoDoMes(transacoes, mesRef)
  const receitas = txDoMes(transacoes, mesRef).filter((t) => t.tipo === "receita")
  const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
  const faturas = cartoes.filter((c) => c.ativo !== false)
    .map((c) => ({ c, v: faturaDoMes(transacoes, c.id, mesRef) })).filter((f) => f.v > 0)
  const comprometido = ativas.reduce((s, o) => s + Number(o.valor), 0) + faturas.reduce((s, f) => s + f.v, 0)
  const nomeCartao = (id: number | null) => (id ? cartoes.find((c) => c.id === id)?.nome || "Cartão" : "Pix / Débito")

  // subcategoria de cada linha de despesa
  type Sub = { key: string; titulo: string; grupo: string; icon: LucideIcon; cor: string; tema: Tema | null }
  const subDe = (t: LinhaExibicao): Sub => {
    const cat = t.categoria || "outro"
    if (cat === "fatura_indefinida" || ehFaturaCheia(t)) {
      return { key: "fatura", titulo: "Fatura não detalhada", grupo: "Faturas ainda não detalhadas", icon: ReceiptText, cor: "#8b93a7", tema: null }
    }
    const tema = temaDaDescricao(t.descricao, temas)
    if (tema) return { key: tema.key, titulo: tema.titulo, grupo: tema.grupo, icon: tema.icon, cor: tema.cor, tema }
    if (t.obrigacao_id) {
      return { key: "obrig", titulo: "Fixos e obrigações", grupo: "Obrigações fixas", icon: LinkIcon, cor: "#a78bfa", tema: null }
    }
    return { key: `outros-${cat}`, titulo: "Outros", grupo: catInfo(cat).l, icon: catInfo(cat).icon, cor: catColor(cat), tema: null }
  }

  // Categoria -> Subcategoria -> linhas
  type Bucket = { titulo: string; icon: LucideIcon; cor: string; total: number; itens: LinhaExibicao[] }
  const porCat = new Map<string, { total: number; subs: Map<string, Bucket> }>()
  for (const t of exib) {
    const cat = t.categoria || "outro"
    const s = subDe(t)
    if (!porCat.has(cat)) porCat.set(cat, { total: 0, subs: new Map() })
    const g = porCat.get(cat)!
    g.total += Number(t.valor)
    if (!g.subs.has(s.key)) g.subs.set(s.key, { titulo: s.titulo, icon: s.icon, cor: s.cor, total: 0, itens: [] })
    const b = g.subs.get(s.key)!
    b.total += Number(t.valor)
    b.itens.push(t)
  }
  const cats = [...porCat.entries()].sort((a, b) => b[1].total - a[1].total)

  // comportamento (grupos) — exclusivo, soma = despesas
  const porGrupo = new Map<string, { total: number; icon: LucideIcon; cor: string }>()
  for (const t of exib) {
    const s = subDe(t)
    const g = GRUPOS[s.grupo]
    const cur = porGrupo.get(s.grupo) || { total: 0, icon: g?.icon || s.icon, cor: g?.cor || s.cor }
    cur.total += Number(t.valor)
    porGrupo.set(s.grupo, cur)
  }
  const grupos = [...porGrupo.entries()].sort((a, b) => b[1].total - a[1].total)

  // parcelas do mês (informativo)
  const irmas = new Set(transacoes.filter((t) => t.tipo === "despesa" && t.parcela_total && t.parcela_total > 1 && !ehFaturaCheia(t))
    .map((t) => `${nomeComercial(t.descricao).toLowerCase()}|${Number(t.valor).toFixed(2)}`))
  const ehParcela = (t: Transacao) => (!!t.parcela_total && t.parcela_total > 1) || /\(\d+\/\d+\)\s*$/.test(t.descricao || "") ||
    irmas.has(`${nomeComercial(t.descricao).toLowerCase()}|${Number(t.valor).toFixed(2)}`)
  const parcelasMes = exib.filter((t) => !t._virtual && !t.obrigacao_id && ehParcela(t)).reduce((s, t) => s + Number(t.valor), 0)

  const insights = gerarInsights({ transacoes, cartoes, obrigacoes, tetos, config, mesRef }).filter((i) => i.id !== "vazio")
  const mesLongo = fmtMesLongo(mesRef)
  const mesTitulo = mesLongo.charAt(0).toUpperCase() + mesLongo.slice(1)
  const hoje = new Date().toLocaleDateString("pt-BR")

  // ---------------- ícones (pré-renderizados) ----------------
  const icons = new Map<string, string>()
  const pedir = async (k: string, Icon: LucideIcon, cor: string, forma: "circulo" | "quadrado" = "circulo") => {
    if (!icons.has(k)) icons.set(k, await iconePng(Icon, cor, forma))
  }
  await Promise.all([
    pedir("sec-1", Wallet, "#2563eb"), pedir("sec-2", LayoutGrid, "#2563eb"), pedir("sec-3", FileText, "#7c3aed"),
    pedir("sec-4", ListChecks, "#0d9488"), pedir("sec-5", Sparkles, "#f59e0b"), pedir("sec-6", CheckCircle2, "#16a34a"),
    pedir("nota", Lightbulb, "#2563eb"), pedir("receita", TrendingUp, "#16a34a"),
    pedir("obrig", LinkIcon, "#a78bfa", "quadrado"), pedir("cartao", CreditCard, "#3b82f6", "quadrado"),
    ...cats.map(([k]) => pedir(`cat-${k}`, catInfo(k).icon, catColor(k))),
    ...grupos.map(([g, v]) => pedir(`grp-${g}`, v.icon, v.cor)),
  ])
  const ic = (k: string) => icons.get(k)!

  // ---------------- documento ----------------
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  let y = 0
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const base = {
    margin: { left: MARGIN, right: MARGIN, top: 34, bottom: 22 },
    styles: { font: "helvetica", fontSize: 8.6, textColor: INK, cellPadding: { top: 2.4, bottom: 2.4, left: 2.6, right: 2.6 }, lineColor: LINE, lineWidth: 0.2 },
    headStyles: { fillColor: HEAD, textColor: [255, 255, 255] as RGB, fontStyle: "bold" as const, fontSize: 8.6 },
    theme: "grid" as const,
    showFoot: "lastPage" as const,
  }

  function novaPagina() { doc.addPage(); y = 36 }
  function garantir(h: number) { if (y + h > 276) novaPagina() }

  function titulo(t: string, sub: string) {
    doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(16)
    doc.text(txt(t), MARGIN, y)
    y += 6
    doc.setTextColor(...MUTED).setFont("helvetica", "normal").setFontSize(9)
    doc.text(txt(sub), MARGIN, y)
    y += 8
  }

  // cabeçalho de seção: ícone redondo grande + título + subtítulo
  function secao(n: number, iconKey: string, t: string, sub: string, hEst = 40) {
    garantir(16 + hEst)
    doc.addImage(ic(iconKey), "PNG", MARGIN, y - 1, 11, 11)
    doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(14)
    doc.text(txt(`${n}. ${t}`), MARGIN + 14.5, y + 4)
    doc.setTextColor(...MUTED).setFont("helvetica", "normal").setFontSize(8.5)
    const lines = doc.splitTextToSize(txt(sub), CONTENT_W - 15) as string[]
    doc.text(lines, MARGIN + 14.5, y + 9)
    y += 12 + lines.length * 3.8
  }

  function tiles(items: { label: string; valor: string }[]) {
    const gap = 3, w = (CONTENT_W - gap * (items.length - 1)) / items.length, h = 17
    items.forEach((it, i) => {
      const x = MARGIN + i * (w + gap), dark = i === 0
      doc.setFillColor(...(dark ? NAVY : TILE)).roundedRect(x, y, w, h, 1.5, 1.5, "F")
      doc.setTextColor(...(dark ? [255, 255, 255] as RGB : MUTED)).setFont("helvetica", "bold").setFontSize(6.5)
      doc.text(txt(it.label.toUpperCase()), x + 4, y + 6)
      doc.setTextColor(...(dark ? [255, 255, 255] as RGB : NAVY)).setFontSize(12.5)
      doc.text(txt(it.valor), x + 4, y + 13)
    })
    y += h + 9
  }

  function nota(iconKey: string, tituloNota: string, texto: string) {
    const lines = doc.setFontSize(8.3).splitTextToSize(txt(texto), CONTENT_W - 24) as string[]
    const h = lines.length * 3.9 + 12
    garantir(h + 4)
    doc.setFillColor(...NOTE_BG).setDrawColor(...NOTE_BD).setLineWidth(0.3).roundedRect(MARGIN, y, CONTENT_W, h, 1.5, 1.5, "FD")
    doc.addImage(ic(iconKey), "PNG", MARGIN + 4, y + 3.5, 8, 8)
    doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(9)
    doc.text(txt(tituloNota), MARGIN + 16, y + 6)
    doc.setTextColor(...INK).setFont("helvetica", "normal").setFontSize(8.3)
    doc.text(lines, MARGIN + 16, y + 10.5)
    y += h + 8
  }

  const hTab = (linhas: number, alto = 8.4) => linhas * alto + 14

  // ======================= PÁGINA 1 =======================
  y = 40
  titulo("Controle financeiro mensal", `${mesTitulo}: onde o dinheiro foi gasto, por categoria, subcategoria e lançamento.`)
  tiles([
    { label: "Total de despesas", valor: fmtR(despesas) },
    { label: "Receitas do mês", valor: fmtR(receita) },
    { label: "Obrigações + faturas", valor: fmtR(comprometido) },
    { label: sobra >= 0 ? "Saldo do mês" : "Déficit do mês", valor: fmtR(sobra) },
  ])

  // ---- 1. Onde o dinheiro foi gasto (Categoria -> Subcategoria) ----
  {
    const linhas: (string | { content: string; rowSpan?: number; styles?: Record<string, unknown> })[][] = []
    const inicioGrupo = new Map<number, { cat: string }>()
    const totalRows = new Set<number>()
    for (const [cat, g] of cats) {
      const subs = [...g.subs.values()].sort((a, b) => b.total - a.total)
      const n = subs.length + 1
      inicioGrupo.set(linhas.length, { cat })
      subs.forEach((s, i) => {
        const first = i === 0
        linhas.push([
          ...(first ? [{ content: "", rowSpan: n, styles: { fillColor: [255, 255, 255], valign: "middle" } }] : []),
          txt(s.titulo), fmtR(s.total), pct(s.total, despesas),
        ])
      })
      totalRows.add(linhas.length)
      linhas.push([`Total ${txt(catInfo(cat).l)}`, fmtR(g.total), pct(g.total, despesas)])
    }
    secao(1, "sec-1", "Onde o dinheiro foi gasto", "Cada categoria aberta em subcategorias específicas, para bater o olho e ver o destino do dinheiro.", Math.min(120, hTab(linhas.length)))
    autoTable(doc, {
      ...base, startY: y,
      head: [["Categoria", "Subcategoria", "Valor", "% do total"]],
      body: linhas,
      columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 32, halign: "right" }, 3: { cellWidth: 24, halign: "right" } },
      didParseCell: (d) => {
        if (d.section !== "body") return
        if (totalRows.has(d.row.index)) {
          d.cell.styles.fillColor = TOTAL_BG
          d.cell.styles.fontStyle = "bold"
          d.cell.styles.textColor = HEAD
        } else if (d.column.index > 0) {
          d.cell.styles.fillColor = d.row.index % 2 ? TINT : [255, 255, 255]
        }
      },
      didDrawCell: (d) => {
        if (d.section !== "body" || d.column.index !== 0) return
        const g = inicioGrupo.get(d.row.index)
        if (!g) return
        const cx = d.cell.x + 3, cy = d.cell.y + d.cell.height / 2
        doc.addImage(ic(`cat-${g.cat}`), "PNG", cx, cy - 4.5, 9, 9)
        doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(9.5)
        doc.text(txt(catInfo(g.cat).l), cx + 12, cy + 1.2)
      },
    })
    y = lastY() + 10
  }

  // ---- 2. Visão rápida por comportamento ----
  secao(2, "sec-2", "Visão rápida por comportamento", "Como o dinheiro se distribui entre comportamentos - onde estão os maiores gastos, independente da categoria.", hTab(grupos.length, 9))
  autoTable(doc, {
    ...base, startY: y,
    head: [["Área", "Total", "% das despesas"]],
    body: grupos.map(([g, v]) => [txt(g), fmtR(v.total), pct(v.total, despesas)]),
    foot: [["Total", fmtR(despesas), "100%"]],
    footStyles: { fillColor: TOTAL_BG, textColor: HEAD, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: "auto", fontStyle: "bold", minCellHeight: 9.5, cellPadding: { top: 2.4, bottom: 2.4, left: 12, right: 2.6 } }, 1: { cellWidth: 40, halign: "right", fontStyle: "bold" }, 2: { cellWidth: 36, halign: "right" } },
    bodyStyles: { valign: "middle" },
    didParseCell: (d) => { if (d.section === "body") d.cell.styles.fillColor = d.row.index % 2 ? TINT : [255, 255, 255] },
    didDrawCell: (d) => {
      if (d.section !== "body" || d.column.index !== 0) return
      const g = grupos[d.row.index]?.[0]
      if (g) doc.addImage(ic(`grp-${g}`), "PNG", d.cell.x + 2.2, d.cell.y + d.cell.height / 2 - 3.5, 7, 7)
    },
  })
  y = lastY() + 6
  nota("nota", "Observação de classificação",
    `A subcategoria vem das palavras da descrição de cada lançamento (o mesmo dicionário do Panorama - você pode ensinar novas palavras no app). Nenhum valor foi inventado. "Faturas ainda não detalhadas" fica separada de propósito, para não transformar uma fatura sem detalhamento em um gasto específico.${parcelasMes > 0 ? ` Deste total, ${fmtR(parcelasMes)} são parcelas de compras anteriores.` : ""}`)

  // ---- 3. Obrigações e faturas ----
  {
    const linhas = [
      ...ativas.map((o) => ({ k: "obrig", r: [txt(o.nome), o.parcela_total ? `Parcela ${parcelaNoMes(o, mesRef)}/${o.parcela_total}` : "Recorrente", String(o.dia_vencimento || "-"), fmtR(Number(o.valor))] })),
      ...faturas.map((f) => ({ k: "cartao", r: [txt(`Fatura ${f.c.nome}`), "Cartão", String(f.c.dia_vencimento || "-"), fmtR(f.v)] })),
    ]
    secao(3, "sec-3", "Obrigações e faturas", "Compromissos fixos e faturas de cartão do mês, com dia de vencimento.", hTab(linhas.length + 1, 9))
    autoTable(doc, {
      ...base, startY: y, pageBreak: "avoid",
      head: [["Item", "Tipo", "Dia", "Valor"]],
      body: linhas.map((l) => l.r),
      foot: [["Total de obrigações e faturas", `${linhas.length} itens`, "", fmtR(comprometido)]],
      footStyles: { fillColor: TOTAL_BG, textColor: HEAD, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: "auto", minCellHeight: 9, cellPadding: { top: 2.4, bottom: 2.4, left: 11, right: 2.6 } }, 1: { cellWidth: 34 }, 2: { cellWidth: 16, halign: "center" }, 3: { cellWidth: 32, halign: "right", fontStyle: "bold", textColor: HEAD } },
      bodyStyles: { valign: "middle" },
      didParseCell: (d) => { if (d.section === "body") d.cell.styles.fillColor = d.row.index % 2 ? TINT : [255, 255, 255] },
      didDrawCell: (d) => {
        if (d.section !== "body" || d.column.index !== 0) return
        const l = linhas[d.row.index]
        if (l) doc.addImage(ic(l.k), "PNG", d.cell.x + 2.2, d.cell.y + d.cell.height / 2 - 3, 6, 6)
      },
    })
    y = lastY() + 10
  }

  // ======================= DETALHAMENTO =======================
  if (y > 150) novaPagina(); else y += 4
  titulo("Detalhamento dos lançamentos", `Todos os ${exib.filter((t) => !t._virtual).length + receitas.length} lançamentos de ${mesTitulo}, organizados por categoria e subcategoria.`)
  secao(4, "sec-4", "Lançamentos por categoria e subcategoria", "Data, estabelecimento, meio de pagamento e valor. A linha azul marca a subcategoria; a última linha fecha o total da categoria.", 40)

  for (const [cat, g] of cats) {
    const subs = [...g.subs.values()].sort((a, b) => b.total - a.total)
    const rows: (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[][] = []
    const subRows = new Set<number>()
    for (const s of subs) {
      subRows.add(rows.length)
      rows.push([{ content: `${txt(s.titulo)}   -   ${fmtR(s.total)}`, colSpan: 4, styles: { fillColor: TINT, textColor: HEAD, fontStyle: "bold" } }])
      for (const t of s.itens.slice().sort((a, b) => (a.data < b.data ? -1 : 1))) {
        rows.push([
          t._virtual ? "-" : fmtData(t.data),
          txt(t._virtual ? `Fatura a detalhar - ${nomeCartao(t.cartao_id)}` : (t.descricao || "-")),
          t.obrigacao_id ? "Obrigação" : nomeCartao(t.cartao_id),
          fmtR(Number(t.valor)),
        ])
      }
    }
    garantir(Math.min(70, 12 + hTab(rows.length, 7.6)))
    // cabeçalho da categoria
    doc.addImage(ic(`cat-${cat}`), "PNG", MARGIN, y - 0.5, 8, 8)
    doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(11)
    const nomeCat = txt(catInfo(cat).l)
    doc.text(nomeCat, MARGIN + 10.5, y + 5)
    const wNome = doc.getTextWidth(nomeCat)
    doc.setTextColor(...MUTED).setFont("helvetica", "normal").setFontSize(8.5)
    doc.text(txt(`${g.subs.size} subcategoria${g.subs.size > 1 ? "s" : ""} / ${rows.length - subs.length} lançamento${rows.length - subs.length > 1 ? "s" : ""}`), MARGIN + 10.5 + wNome + 3, y + 5)
    doc.setTextColor(...HEAD).setFont("helvetica", "bold").setFontSize(10.5)
    doc.text(fmtR(g.total), PAGE_W - MARGIN, y + 5, { align: "right" })
    y += 10
    autoTable(doc, {
      ...base, startY: y,
      head: [["Data", "Estabelecimento", "Meio", "Valor"]],
      body: rows,
      pageBreak: rows.length <= 14 ? "avoid" : "auto",
      foot: [[{ content: `Total ${txt(catInfo(cat).l)}`, colSpan: 3 }, fmtR(g.total)]],
      footStyles: { fillColor: TOTAL_BG, textColor: HEAD, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: "auto", fontStyle: "bold" }, 2: { cellWidth: 36 }, 3: { cellWidth: 30, halign: "right", textColor: RED, fontStyle: "bold" } },
      styles: { ...base.styles, fontSize: 8.2, cellPadding: { top: 1.9, bottom: 1.9, left: 2.6, right: 2.6 } },
    })
    y = lastY() + 8
  }

  if (receitas.length) {
    garantir(hTab(receitas.length + 1))
    doc.addImage(ic("receita"), "PNG", MARGIN, y - 0.5, 8, 8)
    doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(11)
    doc.text("Receitas", MARGIN + 10.5, y + 5)
    doc.setTextColor(...GREEN).setFontSize(10.5)
    doc.text(fmtR(receita), PAGE_W - MARGIN, y + 5, { align: "right" })
    y += 10
    autoTable(doc, {
      ...base, startY: y,
      head: [["Data", "Origem", "Categoria", "Valor"]],
      body: receitas.slice().sort((a, b) => (a.data < b.data ? -1 : 1)).map((t) => [fmtData(t.data), txt(t.descricao || "-"), txt(catInfo(t.categoria).l), fmtR(Number(t.valor))]),
      pageBreak: "avoid",
      foot: [[{ content: "Total de receitas", colSpan: 3 }, fmtR(receita)]],
      footStyles: { fillColor: TOTAL_BG, textColor: HEAD, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: "auto", fontStyle: "bold" }, 2: { cellWidth: 36 }, 3: { cellWidth: 30, halign: "right", textColor: GREEN, fontStyle: "bold" } },
      styles: { ...base.styles, fontSize: 8.2, cellPadding: { top: 1.9, bottom: 1.9, left: 2.6, right: 2.6 } },
    })
    y = lastY() + 10
  }

  // ---- 5. Panorama do gestor ----
  secao(5, "sec-5", "Panorama do gestor", "Leitura direta do mês, calculada localmente a partir dos seus lançamentos.", 36)
  autoTable(doc, {
    ...base, startY: y, rowPageBreak: "avoid",
    head: [["Sinal", "Leitura"]],
    body: insights.slice(0, 12).map((i) => [SEV_LABEL[i.severidade], txt(i.frase + (i.detalhe ? ` ${i.detalhe}` : ""))]),
    columnStyles: { 0: { cellWidth: 24, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    didParseCell: (d) => {
      if (d.section === "body") d.cell.styles.fillColor = d.row.index % 2 ? TINT : [255, 255, 255]
      if (d.section === "body" && d.column.index === 0) {
        const s = String(d.cell.raw)
        d.cell.styles.textColor = s === "Vilão" ? RED : s === "Atenção" ? [217, 119, 6] : s === "Bom sinal" ? GREEN : MUTED
      }
    },
  })
  y = lastY() + 10

  // ---- 6. Conferência ----
  const somaCats = cats.reduce((s, [, g]) => s + g.total, 0)
  const somaGrupos = grupos.reduce((s, [, v]) => s + v.total, 0)
  const ok = (a: number, b: number) => Math.abs(a - b) < 0.01
  const rendaBase = receita || parseFloat(config.renda_projetada) || 0
  secao(6, "sec-6", "Conferência financeira", "Checagens simples para garantir que os totais fecham.", hTab(4))
  autoTable(doc, {
    ...base, startY: y, pageBreak: "avoid",
    head: [["Conferência", "Resultado", "Status"]],
    body: [
      ["Soma das categorias e subcategorias", fmtR(somaCats), ok(somaCats, despesas) ? "Confere com o total de despesas" : `Difere de ${fmtR(despesas)}`],
      ["Soma da visão por comportamento", fmtR(somaGrupos), ok(somaGrupos, despesas) ? "Confere com o total de despesas" : `Difere de ${fmtR(despesas)}`],
      ["Obrigações + faturas", fmtR(comprometido), rendaBase > 0 ? `${((comprometido / rendaBase) * 100).toFixed(0)}% da renda comprometida` : "Sem renda de referência"],
      ["Receitas - despesas", fmtR(sobra), sobra >= 0 ? "Mês fechou no azul" : "Mês fechou no vermelho"],
    ],
    columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 34, halign: "right", fontStyle: "bold" }, 2: { cellWidth: "auto" } },
    didParseCell: (d) => { if (d.section === "body") d.cell.styles.fillColor = d.row.index % 2 ? TINT : [255, 255, 255] },
  })
  y = lastY() + 8

  // ---------------- cabeçalho e rodapé ----------------
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
    doc.text(txt(`Gerado pelo FinFlow Pro em ${hoje}. Valores calculados a partir dos lançamentos do mês; fatura de cartão entra uma única vez.`), MARGIN, 288)
    doc.text(`Página ${p} de ${total}`, PAGE_W - MARGIN, 288, { align: "right" })
  }

  doc.save(`relatorio-gastos-${mesRef}.pdf`)
}
