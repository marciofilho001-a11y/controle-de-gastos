import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { Wallet, Loader2, Eye, EyeOff, CheckCircle2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { supabase } from "@/lib/supabase"
import { erroDeLogin } from "@/lib/auth"
import { cn } from "@/lib/utils"

type Modo = "entrar" | "criar" | "esqueci"
class MensagemPronta extends Error {}
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const

function Campo({ id, rotulo, children, dica }: { id: string; rotulo: string; children: React.ReactNode; dica?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[0.82rem] text-foreground/85">{rotulo}</Label>
      {children}
      {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
    </div>
  )
}

function CampoSenha({ id, valor, onChange, auto }: { id: string; valor: string; onChange: (v: string) => void; auto: string }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id} type={ver ? "text" : "password"} value={valor} onChange={(e) => onChange(e.target.value)}
        autoComplete={auto} required minLength={6} className="h-11 pr-11"
      />
      <button
        type="button" onClick={() => setVer((v) => !v)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
        aria-label={ver ? "Esconder senha" : "Mostrar senha"}
      >
        {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function LoginPage() {
  const [modo, setModo] = useState<Modo>("entrar")
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  function trocar(m: Modo) {
    setModo(m); setErro(null); setAviso(null)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErro(null); setAviso(null)
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (error) throw error
      } else if (modo === "criar") {
        if (!nome.trim()) throw new MensagemPronta("Diga seu nome.")
        // a conta nasce confirmada no servidor (sem e-mail de confirmação) e já entra
        const { data, error } = await supabase.functions.invoke("criar-conta", {
          body: { nome: nome.trim(), email: email.trim(), senha },
        })
        if (error) throw error
        if (data?.erro) throw new MensagemPronta(data.erro)
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (e2) throw e2
        toast.success(`Bem-vindo, ${nome.trim().split(" ")[0]}!`)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        if (error) throw error
        setAviso(`Se existir conta com ${email.trim()}, chegou um link pra criar uma senha nova.`)
      }
    } catch (err) {
      setErro(err instanceof MensagemPronta ? err.message : erroDeLogin(err))
    } finally {
      setBusy(false)
    }
  }

  const titulo = modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Recuperar senha"
  const botao = modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Enviar link"

  return (
    <div className="relative grid min-h-[100dvh] place-items-center px-4 py-10">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
        className="w-full max-w-[400px]"
      >
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-[0.9rem] bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-6" weight="fill" />
          </div>
          <div>
            <p className="font-display text-xl font-semibold">FinFlow <span className="text-primary">Pro</span></p>
            <p className="text-sm text-muted-foreground">Controle financeiro pessoal</p>
          </div>
        </div>

        <section className="painel rounded-2xl border bg-card p-6">
          {modo !== "esqueci" && (
            <div className="mb-5 grid grid-cols-2 rounded-full border bg-secondary/40 p-0.5" role="tablist">
              {(["entrar", "criar"] as Modo[]).map((m) => (
                <button
                  key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => trocar(m)}
                  className={cn("press relative rounded-full py-1.5 text-sm font-medium", modo === m ? "text-foreground" : "text-muted-foreground")}
                >
                  {modo === m && <motion.span layoutId="login-aba" transition={SPRING} className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border" />}
                  <span className="relative">{m === "entrar" ? "Entrar" : "Criar conta"}</span>
                </button>
              ))}
            </div>
          )}
          {modo === "esqueci" && <h2 className="mb-1 text-lg font-semibold">{titulo}</h2>}
          {modo === "esqueci" && <p className="mb-5 text-sm text-muted-foreground">Mandamos um link pro seu e-mail pra você criar uma senha nova.</p>}

          <form onSubmit={enviar} className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {modo === "criar" && (
                <motion.div key="nome" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                  <Campo id="nome" rotulo="Nome">
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className="h-11" placeholder="Como quer ser chamado" />
                  </Campo>
                </motion.div>
              )}
            </AnimatePresence>
            <Campo id="email" rotulo="E-mail">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="h-11" inputMode="email" />
            </Campo>
            {modo !== "esqueci" && (
              <Campo id="senha" rotulo="Senha" dica={modo === "criar" ? "Pelo menos 6 caracteres." : undefined}>
                <CampoSenha id="senha" valor={senha} onChange={setSenha} auto={modo === "criar" ? "new-password" : "current-password"} />
              </Campo>
            )}

            {erro && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
            {aviso && (
              <p className="flex gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {aviso}
              </p>
            )}

            <Button type="submit" disabled={busy} className="h-11 text-[0.95rem]">
              {busy && <Loader2 className="size-4 animate-spin" />} {botao}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {modo === "entrar" && (
              <button type="button" onClick={() => trocar("esqueci")} className="text-muted-foreground hover:text-foreground">Esqueci a senha</button>
            )}
            {modo === "esqueci" && (
              <button type="button" onClick={() => trocar("entrar")} className="text-muted-foreground hover:text-foreground">Voltar para Entrar</button>
            )}
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-muted-foreground">Cada conta vê só os próprios lançamentos.</p>
      </motion.div>
    </div>
  )
}

// aberto pelo link "esqueci a senha" do e-mail
export function NovaSenhaPage({ onPronto }: { onPronto: () => void }) {
  const [senha, setSenha] = useState("")
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErro(null)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setBusy(false)
    if (error) return setErro(erroDeLogin(error))
    toast.success("Senha nova salva")
    onPronto()
  }
  return (
    <div className="grid min-h-[100dvh] place-items-center px-4">
      <section className="painel w-full max-w-[400px] rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Criar senha nova</h2>
        <p className="mb-5 text-sm text-muted-foreground">Escolha a senha que vai usar daqui pra frente.</p>
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Campo id="nova" rotulo="Senha nova" dica="Pelo menos 6 caracteres.">
            <CampoSenha id="nova" valor={senha} onChange={setSenha} auto="new-password" />
          </Campo>
          {erro && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={busy} className="h-11">{busy && <Loader2 className="size-4 animate-spin" />} Salvar senha</Button>
        </form>
      </section>
    </div>
  )
}
