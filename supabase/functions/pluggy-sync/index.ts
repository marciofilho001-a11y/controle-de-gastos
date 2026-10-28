// pluggy-sync — puxa contas e movimentações do Meu Pluggy (Open Finance) para fin_extrato.
// Segredos (Supabase → Edge Functions → Secrets): PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET.
// Item IDs das conexões: fin_config.pluggy_items (separados por vírgula), cadastrados pelo site.
// Ações (body JSON): { acao: "status" } | { acao: "sync", dias?: number }
import { createClient } from "jsr:@supabase/supabase-js@2"

const API = "https://api.pluggy.ai"
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

// data local (Brasília) de um ISO em UTC
function dataBR(iso: string | null | undefined): string | null {
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
}
const hojeBR = () => dataBR(new Date().toISOString())!
function somaDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function pluggy(path: string, apiKey: string) {
  const r = await fetch(API + path, { headers: { "X-API-KEY": apiKey, accept: "application/json" } })
  const txt = await r.text()
  if (!r.ok) throw new Error(`Pluggy ${r.status} em ${path.split("?")[0]}: ${txt.slice(0, 200)}`)
  return JSON.parse(txt)
}

// todas as páginas de transações de uma conta (v2 com cursor; cai pro v1 se precisar)
async function transacoesDaConta(accountId: string, de: string, ate: string, apiKey: string) {
  const out: any[] = []
  const base = `/v2/transactions?accountId=${accountId}&dateFrom=${de}&dateTo=${ate}`
  try {
    let url: string | null = base
    for (let i = 0; url && i < 50; i++) {
      const pg: any = await pluggy(url, apiKey)
      out.push(...(pg.results ?? []))
      const next: string | null = pg.next ?? null
      if (!next) break
      if (next.startsWith("http")) url = next.replace(API, "")
      else if (next.startsWith("/")) url = next
      else {
        const q = next.replace(/^\?/, "")
        url = `/v2/transactions?${q}`
        if (!q.includes("accountId=")) url += `&accountId=${accountId}`
        if (!q.includes("dateFrom=")) url += `&dateFrom=${de}&dateTo=${ate}`
      }
    }
    return out
  } catch (e) {
    if (!String(e).includes(" 404 ")) throw e
  }
  for (let page = 1; page < 50; page++) {
    const pg: any = await pluggy(`/transactions?accountId=${accountId}&from=${de}&to=${ate}&pageSize=500&page=${page}`, apiKey)
    out.push(...(pg.results ?? []))
    if (!pg.totalPages || page >= pg.totalPages) break
  }
  return out
}

function paraExtrato(t: any, conta: { id: string; tipo: string }) {
  const credito = conta.tipo === "CREDIT"
  const amount = Number(t.amount ?? 0)
  // cartão: positivo = compra; negativo = pagamento/estorno. Conta: type DEBIT = saída
  const sentido = credito
    ? (amount > 0 ? "saida" : "entrada")
    : (t.type === "DEBIT" || (!t.type && amount < 0) ? "saida" : "entrada")
  const cc = t.creditCardMetadata ?? {}
  const pd = t.paymentData ?? {}
  const contraparte = (sentido === "saida" ? pd.receiver?.name : pd.payer?.name) ?? null
  const merchant = t.merchant?.businessName || t.merchant?.name || null
  return {
    id: String(t.id),
    conta_id: conta.id,
    origem: "pluggy",
    data: dataBR(cc.purchaseDate && Number(cc.installmentNumber || 1) <= 1 ? cc.purchaseDate : t.date) ?? hojeBR(),
    descricao: String(merchant || t.description || t.descriptionRaw || "Movimentação").slice(0, 200),
    descricao_raw: t.descriptionRaw ? String(t.descriptionRaw).slice(0, 200) : (t.description ? String(t.description).slice(0, 200) : null),
    valor: Math.round(Math.abs(amount) * 100) / 100,
    sentido,
    tipo_conta: conta.tipo,
    operacao: t.operationType || pd.paymentMethod || null,
    contraparte: contraparte ? String(contraparte).slice(0, 120) : null,
    parcela_atual: cc.installmentNumber ? Number(cc.installmentNumber) : null,
    parcela_total: cc.totalInstallments ? Number(cc.totalInstallments) : null,
    data_compra: dataBR(cc.purchaseDate),
    previsao_fatura: dataBR(cc.billForecastDate ?? t.billForecastDate ?? null),
    pendente: t.status === "PENDING",
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  // chaves: segredos da função ou, se não houver, o cofre do banco (Vault, só o service_role lê)
  let clientId = Deno.env.get("PLUGGY_CLIENT_ID")
  let clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET")
  if (!clientId || !clientSecret) {
    const { data: cred } = await db.rpc("pluggy_credenciais")
    clientId = clientId || cred?.id || undefined
    clientSecret = clientSecret || cred?.secret || undefined
  }
  const body = await req.json().catch(() => ({}))
  const acao = body.acao ?? "sync"

  const { data: cfg } = await db.from("fin_config").select("valor").eq("chave", "pluggy_items").maybeSingle()
  const items = String(cfg?.valor ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^[0-9a-f-]{20,}$/i.test(s))
  const configurado = !!(clientId && clientSecret)

  if (acao === "status") return json({ configurado, items: items.length })
  if (!configurado) return json({ configurado: false, erro: "Faltam os segredos PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET" })
  if (!items.length) return json({ configurado: true, items: 0, erro: "Nenhuma conexão (Item ID) cadastrada" })

  const resumo = { configurado: true, items: items.length, contas: 0, novos: 0, atualizados: 0, erros: [] as string[] }
  let apiKey: string
  try {
    const r = await fetch(API + "/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    })
    const j = await r.json()
    if (!r.ok || !j.apiKey) throw new Error(`login na Pluggy falhou (${r.status}): ${JSON.stringify(j).slice(0, 160)}`)
    apiKey = j.apiKey
  } catch (e) {
    return json({ ...resumo, erros: [String(e instanceof Error ? e.message : e)] })
  }

  const hoje = hojeBR()
  for (const itemId of items) {
    try {
      const item = await pluggy(`/items/${itemId}`, apiKey).catch(() => null)
      const banco = item?.connector?.name ?? null
      const contas = await pluggy(`/accounts?itemId=${itemId}`, apiKey)
      for (const a of contas.results ?? []) {
        resumo.contas++
        const contaId = String(a.id)
        const { data: existente } = await db.from("fin_bancos_contas").select("id, ultimo_sync, ativo").eq("id", contaId).maybeSingle()
        const linhaConta = {
          id: contaId, item_id: itemId, origem: "pluggy", banco: banco ?? a.owner ?? null,
          nome: a.marketingName || a.name || null, tipo: a.type ?? null, subtipo: a.subtype ?? null,
          numero: a.number ? String(a.number).slice(-4) : null,
        }
        if (existente) await db.from("fin_bancos_contas").update(linhaConta).eq("id", contaId)
        else await db.from("fin_bancos_contas").insert(linhaConta)
        if (existente && existente.ativo === false) continue

        // primeira vez: 60 dias pra trás; depois, desde o último sync com folga de 10 dias
        const ultimo = existente?.ultimo_sync ? dataBR(existente.ultimo_sync)! : null
        const dias = Number(body.dias) > 0 ? Number(body.dias) : null
        const de = dias ? somaDias(hoje, -dias) : ultimo ? somaDias(ultimo, -10) : somaDias(hoje, -60)
        const brutas = await transacoesDaConta(contaId, de, somaDias(hoje, 1), apiKey)
        const linhas = brutas.map((t) => paraExtrato(t, { id: contaId, tipo: a.type }))
          .filter((l) => l.valor > 0)

        if (linhas.length) {
          const ids = linhas.map((l) => l.id)
          const ja = new Map<string, string>()
          for (let i = 0; i < ids.length; i += 200) {
            const { data } = await db.from("fin_extrato").select("id, status").in("id", ids.slice(i, i + 200))
            for (const r of data ?? []) ja.set(r.id, r.status)
          }
          const novas = linhas.filter((l) => !ja.has(l.id))
          // ainda não resolvidas: atualiza (compra pendente que fechou muda data/valor)
          const atualizar = linhas.filter((l) => ja.get(l.id) === "novo")
          if (novas.length) {
            const { error } = await db.from("fin_extrato").insert(novas)
            if (error) throw new Error("gravar extrato: " + error.message)
            resumo.novos += novas.length
          }
          for (const l of atualizar) {
            await db.from("fin_extrato").update(l).eq("id", l.id).eq("status", "novo")
            resumo.atualizados++
          }
        }
        // compra pendente que o banco substituiu por outra ao confirmar (id novo): sai da fila
        const vistos = new Set(linhas.map((l) => l.id))
        const { data: pend } = await db.from("fin_extrato").select("id")
          .eq("conta_id", contaId).eq("status", "novo").eq("pendente", true).gte("data", de)
        const sumiram = (pend ?? []).map((r) => r.id).filter((id) => !vistos.has(id))
        if (sumiram.length) await db.from("fin_extrato").delete().in("id", sumiram)

        await db.from("fin_bancos_contas").update({ ultimo_sync: new Date().toISOString() }).eq("id", contaId)
      }
    } catch (e) {
      resumo.erros.push(`${itemId.slice(0, 8)}…: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  await db.from("fin_config").upsert({ chave: "pluggy_ultimo_sync", valor: new Date().toISOString() }, { onConflict: "chave" })
  return json(resumo)
})
