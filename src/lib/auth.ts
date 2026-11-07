import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useFinData } from "@/hooks/use-fin-data"

// Sessão do Supabase Auth: undefined = ainda verificando; null = sem login
export function useSessao() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined)
  const [recuperando, setRecuperando] = useState(false)   // veio do link "esqueci a senha"

  useEffect(() => {
    let uid: string | null | undefined
    // conta mudou (entrou, saiu, trocou): limpa o que estava carregado antes de mostrar a nova
    const aplicar = (s: Session | null) => {
      const novo = s?.user.id ?? null
      if (uid !== undefined && novo !== uid) useFinData.getState().limpar()
      uid = novo
      setSessao(s)
    }
    supabase.auth.getSession().then(({ data }) => aplicar(data.session))
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true)
      aplicar(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return { sessao, recuperando, fimRecuperacao: () => setRecuperando(false) }
}

export function nomeDoUsuario(s: Session | null | undefined): string {
  const m = s?.user.user_metadata ?? {}
  return String(m.nome || m.full_name || s?.user.email?.split("@")[0] || "")
}

// mensagens do Supabase em português, sem jargão
export function erroDeLogin(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "")
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha errados."
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar: abra o link que chegou na sua caixa de entrada."
  if (/already registered|already been registered|user already exists/i.test(msg)) return "Já existe uma conta com esse e-mail. Use Entrar."
  if (/password should be at least|at least 6/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres."
  if (/unable to validate email|invalid format|email address .* is invalid/i.test(msg)) return "Esse e-mail não parece válido."
  if (/rate limit|too many|security purposes/i.test(msg)) return "Muitas tentativas seguidas. Espere um minuto e tente de novo."
  if (/same.*password|different from the old/i.test(msg)) return "A nova senha precisa ser diferente da atual."
  if (/failed to fetch|network/i.test(msg)) return "Sem conexão. Confira a internet e tente de novo."
  return msg || "Algo deu errado. Tente de novo."
}
