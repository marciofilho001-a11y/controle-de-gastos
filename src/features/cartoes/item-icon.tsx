import { useRef } from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useFinData } from "@/hooks/use-fin-data"
import { catInfo, catColor } from "@/lib/categorias"
import { normalizarDescricao } from "@/lib/selectors"
import { comprimirImagemParaIcone } from "@/lib/image"
import { cn } from "@/lib/utils"

// Ícone de um lançamento: imagem custom (vinculada ao nome) OU ícone da categoria.
// Clicar abre o seletor de imagem; se já tem imagem própria, mostra botão de restaurar.
export function ItemIcon({
  descricao,
  categoria,
  size = 32,
}: {
  descricao: string
  categoria: string
  size?: number
}) {
  const { descricaoIcones, categoriaIcones, loadAll } = useFinData()
  const inputRef = useRef<HTMLInputElement>(null)
  const dn = normalizarDescricao(descricao)
  const imgCustom = dn ? descricaoIcones[dn] : undefined
  const imgCategoria = categoriaIcones[categoria]
  const cor = catColor(categoria)
  const Icon = catInfo(categoria).icon
  const temImagemPropria = !!imgCustom
  const temImagemCategoria = !!imgCategoria

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem (PNG ou JPG)")
      return
    }
    if (!dn) {
      toast.error("Esse lançamento não tem nome pra vincular o ícone")
      return
    }
    try {
      const imagem = await comprimirImagemParaIcone(file, 192)
      const { error } = await supabase
        .from("fin_descricao_icones")
        .upsert({ descricao_norm: dn, imagem, atualizado_em: new Date().toISOString() })
      if (error) throw error
      toast.success(`Ícone de "${descricao}" salvo! Vale pra qualquer lançamento com esse nome.`)
      await loadAll()
    } catch (err) {
      toast.error("Erro ao processar a imagem", { description: err instanceof Error ? err.message : "" })
    }
  }

  async function restaurar(ev: React.MouseEvent) {
    ev.stopPropagation()
    try {
      if (temImagemPropria) {
        const { error } = await supabase.from("fin_descricao_icones").delete().eq("descricao_norm", dn)
        if (error) throw error
        toast.success("Ícone restaurado ao padrão")
      } else if (temImagemCategoria) {
        const { error } = await supabase.from("fin_categoria_icones").delete().eq("categoria", categoria)
        if (error) throw error
        toast.success("Ícone da categoria removido")
      }
      await loadAll()
    } catch (err) {
      toast.error("Erro ao restaurar", { description: err instanceof Error ? err.message : "" })
    }
  }

  const img = imgCustom || imgCategoria

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Clique pra usar sua própria imagem nesse lançamento (vale pra todos com o mesmo nome)"
        className={cn("grid place-items-center overflow-hidden rounded-lg transition-transform hover:scale-105")}
        style={{
          width: size, height: size,
          background: img ? "transparent" : `${cor}1f`,
          color: cor,
          border: img ? "1px solid var(--border)" : `1px solid ${cor}3a`,
        }}
      >
        {img ? (
          <img src={img} alt="" className="size-full object-contain" />
        ) : (
          <Icon style={{ width: size * 0.55, height: size * 0.55 }} />
        )}
      </button>
      {(temImagemPropria || temImagemCategoria) && (
        <button
          type="button"
          onClick={restaurar}
          title="Restaurar ícone padrão"
          className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-secondary text-muted-foreground ring-1 ring-border hover:text-foreground"
        >
          <RotateCcw className="size-2.5" />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
    </span>
  )
}
