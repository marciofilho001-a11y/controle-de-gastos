import type { Transacao, Cartao, Obrigacao, Teto } from "@/lib/supabase"
import { catInfo } from "@/lib/categorias"
import { fmtR, fmtMesCurto, addMonths, mesRefAtual } from "@/lib/format"
import {
  despesasExibicaoDoMes, receitasDoMes, despesasDoMes, obrigacoesAtivasNoMes,
  totalCartoesNoMes, faturaDoMes, gastoDebitoNoMes, gastoCategoriaNoMes, ehFaturaCheia,
  type LinhaExibicao,
} from "@/lib/selectors"
import { temasComExtras, temaDaDescricao, nomeComercial, type Tema } from "@/lib/temas"

// ---------------------------------------------------------------------------
// Motor de insights ("gestor financeiro"): regras locais, determinísticas,
// que transformam os números do mês em frases diretas. Sem API, sem custo.
// ---------------------------------------------------------------------------

export type Severidade = "vilao" | "atencao" | "ok" | "info"

export type Insight = {
  id: string
  severidade: Severidade
  frase: string                 // a sentença do gestor
  detalhe?: string              // complemento (menor)
  impacto: number               // R$ envolvido — ordena dentro da severidade
  transacoes?: Transacao[]      // "ver lançamentos"
}

export type InsightInput = {
  transacoes: Transacao[]
  cartoes: Cartao[]
  obrigacoes: Obrigacao[]
  tetos: Teto[]
  config: Record<string, string>
  mesRef: string
}

const RANK: Record<Severidade, number> = { vilao: 0, atencao: 1, ok: 2, info: 3 }

function somar(ts: { valor: number | string }[]): number {
  return ts.reduce((s, t) => s + Number(t.valor), 0)
}

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0
}

function listaCurta(ts: Transacao[], n = 3): string {
  const porNome = new Map<string, number>()
  for (const t of ts) {
    const k = nomeComercial(t.descricao)
    porNome.set(k, (porNome.get(k) || 0) + Number(t.valor))
  }
  return [...porNome.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ${fmtR(v)}`)
    .join(", ")
}

export function gerarInsights(inp: InsightInput): Insight[] {
  const { transacoes, cartoes, obrigacoes, tetos, config, mesRef } = inp
  const out: Insight[] = []
  const temas = temasComExtras(config.temas_extra)

  const receita = receitasDoMes(transacoes, mesRef)
  const rendaPrevista = parseFloat(config.renda_projetada) || 0
  const rendaBase = receita > 0 ? receita : rendaPrevista
  const despesas = despesasDoMes(transacoes, mesRef)
  const exib = despesasExibicaoDoMes(transacoes, mesRef)
  // itens "de verdade" (compras/gastos), fora obrigações fixas e linhas virtuais
  const itens = exib.filter((t) => !t._virtual && !t.obrigacao_id && (t.categoria || "") !== "fatura_indefinida")
  const ativas = obrigacoesAtivasNoMes(obrigacoes, mesRef)
  const totalObr = somar(ativas)
  const totalCartoes = totalCartoesNoMes(cartoes, transacoes, mesRef)
  const mesAnt = addMonths(mesRef, -1)
  const ehPassadoOuAtual = mesRef <= mesRefAtual()

  if (!exib.length && receita <= 0) {
    return [{ id: "vazio", severidade: "info", frase: `Sem lançamentos em ${fmtMesCurto(mesRef)} ainda.`, impacto: 0 }]
  }

  // ---- 1. Temas (bebida, perfumes, mercado...) --------------------------
  const porTema = new Map<Tema, Transacao[]>()
  for (const t of itens) {
    const tema = temaDaDescricao(t.descricao, temas)
    if (!tema) continue
    if (!porTema.has(tema)) porTema.set(tema, [])
    porTema.get(tema)!.push(t)
  }
  for (const [tema, ts] of porTema) {
    const total = somar(ts)
    if (total < 40) continue
    const vilao = tema.discricionario && total >= 100
    out.push({
      id: `tema-${tema.key}`,
      severidade: vilao ? "vilao" : "info",
      frase: `Você gastou ${fmtR(total)} em ${tema.label} este mês.`,
      detalhe: `${ts.length} lançamento${ts.length > 1 ? "s" : ""}: ${listaCurta(ts)}`,
      impacto: total,
      transacoes: ts,
    })
  }

  // ---- 2. Maior gasto (por estabelecimento) e maior compra única --------
  if (itens.length) {
    const porNome = new Map<string, Transacao[]>()
    for (const t of itens) {
      const k = nomeComercial(t.descricao)
      if (!porNome.has(k)) porNome.set(k, [])
      porNome.get(k)!.push(t)
    }
    const [nome, ts] = [...porNome.entries()].sort((a, b) => somar(b[1]) - somar(a[1]))[0]
    const total = somar(ts)
    const parc = ts.find((t) => t.parcela_total && t.parcela_total > 1)
    const restantes = transacoes.filter((t) => t.tipo === "despesa" && t.mes_ref > mesRef && nomeComercial(t.descricao) === nome).length
    const detalhe = parc
      ? `Parcela ${parc.parcela_atual}/${parc.parcela_total} — termina em ${fmtMesCurto(addMonths(mesRef, (parc.parcela_total || 1) - (parc.parcela_atual || 1)))}.`
      : restantes > 0
        ? `Parcelado — ainda faltam ${restantes} parcela${restantes > 1 ? "s" : ""} de ${fmtR(total)} à frente.`
        : ts.length > 1 ? `${ts.length} lançamentos no mesmo lugar.` : undefined
    out.push({
      id: "maior-gasto",
      severidade: total >= rendaBase * 0.15 ? "atencao" : "info",
      frase: `Seu maior gasto foi ${nome}: ${fmtR(total)} (${pct(total, despesas)}% das despesas).`,
      detalhe,
      impacto: total,
      transacoes: ts,
    })
  }

  // ---- 3. Parcelamentos: este mês + comprometido à frente ---------------
  // Uma transação é parcela se tem parcela_total>1, se a descrição traz "(x/y)",
  // ou se existe uma "irmã" (mesmo nome e valor) marcada como parcela em outro mês
  // — cobre lançamentos manuais feitos sem o campo de parcela.
  const irmas = new Map<string, number>() // nomeComercial|valor -> parcela_total
  for (const t of transacoes) {
    if (t.tipo === "despesa" && t.parcela_total && t.parcela_total > 1 && !ehFaturaCheia(t)) {
      irmas.set(`${nomeComercial(t.descricao).toLowerCase()}|${Number(t.valor).toFixed(2)}`, t.parcela_total)
    }
  }
  const ehParcela = (t: Transacao) =>
    (!!t.parcela_total && t.parcela_total > 1) ||
    /\(\d+\/\d+\)\s*$/.test(t.descricao || "") ||
    irmas.has(`${nomeComercial(t.descricao).toLowerCase()}|${Number(t.valor).toFixed(2)}`)
  const parcMes = itens.filter(ehParcela)
  const parcFuturo = transacoes.filter(
    (t) => t.tipo === "despesa" && t.mes_ref > mesRef && !ehFaturaCheia(t) && ehParcela(t)
  )
  if (parcMes.length || parcFuturo.length) {
    const totMes = somar(parcMes)
    const totFut = somar(parcFuturo)
    const ultimo = parcFuturo.map((t) => t.mes_ref).sort().at(-1)
    out.push({
      id: "parcelamentos",
      severidade: totMes >= rendaBase * 0.2 ? "vilao" : totMes >= 100 ? "atencao" : "info",
      frase: totMes > 0
        ? `Em parcelamentos, suas compras somam ${fmtR(totMes)} este mês.`
        : `Você não paga parcela este mês, mas tem ${fmtR(totFut)} parcelados à frente.`,
      detalhe: totFut > 0
        ? `Ainda há ${fmtR(totFut)} a vencer${ultimo ? ` até ${fmtMesCurto(ultimo)}` : ""} — cada parcela nova come o salário do mês seguinte.`
        : "Nada parcelado à frente. Mantenha assim.",
      impacto: totMes + totFut,
      transacoes: parcMes,
    })
  }

  // ---- 4. Renda comprometida antes do dia a dia -------------------------
  if (rendaBase > 0) {
    const comprometido = totalObr + totalCartoes
    const p = pct(comprometido, rendaBase)
    out.push({
      id: "comprometido",
      severidade: p >= 90 ? "vilao" : p >= 75 ? "atencao" : "ok",
      frase: `${p}% da sua renda já está comprometida com contas fixas e faturas.`,
      detalhe: `${fmtR(comprometido)} de ${fmtR(rendaBase)} antes de qualquer gasto do dia a dia. ${p >= 90 ? "Qualquer mercado joga o mês no vermelho." : p >= 75 ? "A margem é curta." : "Margem saudável."}`,
      impacto: comprometido,
    })
  }

  // ---- 5. Vencimentos concentrados no início do mês ---------------------
  {
    const cart10 = cartoes.filter((c) => c.ativo !== false && (c.dia_vencimento || 31) <= 10)
      .reduce((s, c) => s + faturaDoMes(transacoes, c.id, mesRef), 0)
    const obr10 = ativas.filter((o) => (o.dia_vencimento || 31) <= 10).reduce((s, o) => s + Number(o.valor), 0)
    const ate10 = cart10 + obr10
    if (ate10 > 0 && rendaBase > 0 && ate10 >= rendaBase * 0.5) {
      out.push({
        id: "vencimentos-10",
        severidade: ate10 >= rendaBase * 0.7 ? "atencao" : "info",
        frase: `${fmtR(ate10)} saem até o dia 10 — ${pct(ate10, rendaBase)}% da renda nos primeiros dez dias.`,
        detalhe: "Faturas e contas concentradas logo depois do salário. Se der, empurre vencimentos pro fim do mês.",
        impacto: ate10,
      })
    }
  }

  // ---- 6. Lazer x alimentação -------------------------------------------
  {
    const lazer = gastoCategoriaNoMes(transacoes, "lazer", mesRef)
    const alim = gastoCategoriaNoMes(transacoes, "alimentacao", mesRef)
    if (lazer >= 150 && alim > 0 && lazer >= alim * 1.5) {
      const x = (lazer / alim).toFixed(1).replace(".0", "")
      out.push({
        id: "lazer-vs-alim",
        severidade: lazer >= alim * 3 ? "vilao" : "atencao",
        frase: `Lazer (${fmtR(lazer)}) é ${x}× o que você gastou em alimentação (${fmtR(alim)}).`,
        detalhe: "Prioridade invertida: o supérfluo está na frente do essencial.",
        impacto: lazer,
        transacoes: itens.filter((t) => t.categoria === "lazer"),
      })
    }
  }

  // ---- 7. Débito não lançado --------------------------------------------
  if (ehPassadoOuAtual && gastoDebitoNoMes(transacoes, mesRef) <= 0 && despesas > 0) {
    out.push({
      id: "debito-zero",
      severidade: "atencao",
      frase: "Nenhum gasto no débito/dinheiro lançado este mês.",
      detalhe: "Ninguém gasta zero no dia a dia — a sobra que o app mostra pode não existir. Lance mercado e combustível.",
      impacto: 0,
    })
  }

  // ---- 8. Sobra do mês --------------------------------------------------
  if (rendaBase > 0 && ehPassadoOuAtual) {
    const sobra = rendaBase - despesas
    const p = pct(Math.max(0, sobra), rendaBase)
    const pctInv = parseFloat(config.pct_investimento) || 0
    out.push({
      id: "sobra",
      severidade: sobra < 0 ? "vilao" : p < 10 ? "atencao" : "ok",
      frase: sobra < 0
        ? `Você fechou o mês no vermelho: ${fmtR(sobra)}.`
        : `Sobrou ${fmtR(sobra)} — ${p}% da renda.`,
      detalhe: sobra < 0
        ? "Gastou mais do que entrou. O que faltou virou cartão ou dívida."
        : pctInv > 0 && sobra > 0
          ? `Pela sua regra de ${pctInv}%, dá pra investir ${fmtR(sobra * pctInv / 100)} — separe no dia do salário.`
          : "Defina um % pra investir na Projeção e o gestor passa a cobrar.",
      impacto: Math.abs(sobra),
    })
  }

  // ---- 9. Metas (tetos) estouradas --------------------------------------
  for (const t of tetos.filter((x) => x.mes_ref === mesRef && x.escopo === "categoria" && x.categoria)) {
    const gasto = gastoCategoriaNoMes(transacoes, t.categoria!, mesRef)
    const teto = Number(t.valor)
    if (teto > 0 && gasto > teto) {
      out.push({
        id: `teto-${t.categoria}`,
        severidade: "vilao",
        frase: `Estourou a meta de ${catInfo(t.categoria!).l}: ${fmtR(gasto)} de ${fmtR(teto)}.`,
        detalhe: `${fmtR(gasto - teto)} acima do combinado.`,
        impacto: gasto - teto,
        transacoes: itens.filter((x) => x.categoria === t.categoria),
      })
    }
  }
  for (const t of tetos.filter((x) => x.mes_ref === mesRef && x.escopo === "cartao" && x.cartao_id)) {
    const c = cartoes.find((k) => k.id === Number(t.cartao_id))
    if (!c) continue
    const fat = faturaDoMes(transacoes, c.id, mesRef)
    const teto = Number(t.valor)
    if (teto > 0 && fat > teto) {
      out.push({
        id: `teto-cartao-${c.id}`,
        severidade: "vilao",
        frase: `Fatura do ${c.nome} passou do limite: ${fmtR(fat)} de ${fmtR(teto)}.`,
        impacto: fat - teto,
      })
    }
  }

  // ---- 10. Comparativo com o mês anterior (categoria e cartão) ----------
  {
    const agrupar = (lista: LinhaExibicao[]) => {
      const m = new Map<string, number>()
      for (const t of lista) {
        const k = t.categoria || "outro"
        if (k === "fatura_indefinida" || k === "cartao") continue
        m.set(k, (m.get(k) || 0) + Number(t.valor))
      }
      return m
    }
    const atual = agrupar(exib)
    const anterior = agrupar(despesasExibicaoDoMes(transacoes, mesAnt))
    if (anterior.size) {
      let subiu: [string, number] | null = null
      let caiu: [string, number] | null = null
      for (const k of new Set([...atual.keys(), ...anterior.keys()])) {
        const d = (atual.get(k) || 0) - (anterior.get(k) || 0)
        if (d >= 50 && (!subiu || d > subiu[1])) subiu = [k, d]
        if (d <= -50 && (!caiu || d < caiu[1])) caiu = [k, d]
      }
      if (subiu) {
        out.push({
          id: "subiu",
          severidade: "atencao",
          frase: (anterior.get(subiu[0]) || 0) > 0
            ? `${catInfo(subiu[0]).l} subiu ${fmtR(subiu[1])} em relação a ${fmtMesCurto(mesAnt)}.`
            : `${catInfo(subiu[0]).l} apareceu com ${fmtR(subiu[1])} — em ${fmtMesCurto(mesAnt)} não tinha nada lançado.`,
          detalhe: `${fmtR(anterior.get(subiu[0]) || 0)} → ${fmtR(atual.get(subiu[0]) || 0)}.`,
          impacto: subiu[1],
          transacoes: itens.filter((t) => (t.categoria || "outro") === subiu![0]),
        })
      }
      if (caiu) {
        out.push({
          id: "caiu",
          severidade: "ok",
          frase: `${catInfo(caiu[0]).l} caiu ${fmtR(-caiu[1])} em relação a ${fmtMesCurto(mesAnt)}.`,
          detalhe: "Bom sinal — segura esse ritmo.",
          impacto: -caiu[1],
        })
      }
    }
    // cartão que mais cresceu
    let maior: { c: Cartao; d: number; atual: number } | null = null
    for (const c of cartoes.filter((k) => k.ativo !== false)) {
      const a = faturaDoMes(transacoes, c.id, mesRef)
      const b = faturaDoMes(transacoes, c.id, mesAnt)
      if (b > 0 && a - b >= 100 && (!maior || a - b > maior.d)) maior = { c, d: a - b, atual: a }
    }
    if (maior) {
      out.push({
        id: "cartao-cresceu",
        severidade: "atencao",
        frase: `A fatura do ${maior.c.nome} cresceu ${fmtR(maior.d)} vs ${fmtMesCurto(mesAnt)}.`,
        detalhe: `Fechou em ${fmtR(maior.atual)}.`,
        impacto: maior.d,
      })
    }
  }

  // ---- 11. Renda abaixo do previsto -------------------------------------
  if (receita > 0 && rendaPrevista > 0 && receita < rendaPrevista * 0.95) {
    out.push({
      id: "renda-abaixo",
      severidade: "atencao",
      frase: `Entrou ${fmtR(rendaPrevista - receita)} a menos do que você previa este mês.`,
      detalhe: `${fmtR(receita)} contra ${fmtR(rendaPrevista)} projetados.`,
      impacto: rendaPrevista - receita,
    })
  }

  return out.sort((a, b) => RANK[a.severidade] - RANK[b.severidade] || b.impacto - a.impacto)
}

// Os N mais importantes (pro card do Dashboard)
export function topInsights(lista: Insight[], n = 3): Insight[] {
  return lista.filter((i) => i.id !== "vazio").slice(0, n)
}
