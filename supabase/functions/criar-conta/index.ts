// criar-conta — cria a conta do FinFlow já confirmada, sem mandar e-mail
// (o e-mail embutido do Supabase só envia 2 por hora e travava os cadastros).
// Body: { nome, email, senha } -> { ok: true } | { erro }
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405)

  const body = await req.json().catch(() => ({}))
  const nome = String(body.nome ?? "").trim().slice(0, 80)
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200)
  const senha = String(body.senha ?? "")

  if (!nome) return json({ erro: "Diga seu nome." })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ erro: "Esse e-mail não parece válido." })
  if (senha.length < 6) return json({ erro: "A senha precisa ter pelo menos 6 caracteres." })
  if (senha.length > 72) return json({ erro: "A senha pode ter no máximo 72 caracteres." })

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return json({ erro: "Já existe uma conta com esse e-mail. Use Entrar." })
    }
    return json({ erro: "Não consegui criar a conta. Tente de novo." })
  }
  return json({ ok: true })
})
