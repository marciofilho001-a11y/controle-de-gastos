import { useState } from "react"
import { toast } from "sonner"
import { LogOut, Key, Loader2 } from "@/lib/icons"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { erroDeLogin } from "@/lib/auth"
import { useFinData } from "@/hooks/use-fin-data"

export function MenuUsuario({ nome, email }: { nome: string; email: string }) {
  const [trocar, setTrocar] = useState(false)
  const inicial = (nome || email).trim().charAt(0).toUpperCase() || "?"

  async function sair() {
    await supabase.auth.signOut()
    useFinData.getState().limpar()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="press grid size-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-primary/25 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Conta de ${nome}`}
          >
            {inicial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-semibold">{nome}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTrocar(true)} className="gap-2.5"><Key className="size-4" /> Trocar senha</DropdownMenuItem>
          <DropdownMenuItem onSelect={sair} className="gap-2.5 text-destructive focus:text-destructive"><LogOut className="size-4" /> Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TrocarSenha aberto={trocar} onOpenChange={setTrocar} />
    </>
  )
}

function TrocarSenha({ aberto, onOpenChange }: { aberto: boolean; onOpenChange: (v: boolean) => void }) {
  const [senha, setSenha] = useState("")
  const [conf, setConf] = useState("")
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== conf) return setErro("As duas senhas não são iguais.")
    setBusy(true); setErro(null)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setBusy(false)
    if (error) return setErro(erroDeLogin(error))
    toast.success("Senha trocada")
    setSenha(""); setConf(""); onOpenChange(false)
  }
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Trocar senha</DialogTitle>
          <DialogDescription>A senha nova vale no próximo login, em qualquer aparelho.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s1">Senha nova</Label>
            <Input id="s1" type="password" autoComplete="new-password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s2">Repita a senha nova</Label>
            <Input id="s2" type="password" autoComplete="new-password" minLength={6} required value={conf} onChange={(e) => setConf(e.target.value)} />
          </div>
          {erro && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
