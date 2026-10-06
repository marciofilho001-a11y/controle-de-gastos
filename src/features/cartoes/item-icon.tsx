import { useState } from "react"
import { RotateCcw } from "@/lib/icons"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useFinData } from "@/hooks/use-fin-data"
import { catInfo, catColor } from "@/lib/categorias"
import { normalizarDescricao } from "@/lib/selectors"
import { logoDoLancamento, SEM_LOGO } from "@/lib/marcas"
import { SeletorLogo } from "@/components/seletor-logo"
import { cn } from "@/lib/utils"
import { useCorLogo } from "@/components/logo-avatar"

// Ícone de um lançamento: imagem escolhida > logo da marca (Simple Icons) > imagem da categoria > ícone da categoria.
// Clicar abre o seletor de logo; se tem imagem da categoria, mostra botão de restaurar.
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
  const [seletor, setSeletor] = useState(false)
  const dn = normalizarDescricao(descricao)
  const imgCustom = logoDoLancamento(descricao, descricaoIcones)
  const semLogo = dn ? descricaoIcones[dn] === SEM_LOGO : false
  const imgCategoria = categoriaIcones[categoria]
  const cor = catColor(categoria)
  const Icon = catInfo(categoria).icon
  const temImagemPropria = !!(dn && descricaoIcones[dn])
  const temImagemCategoria = !!imgCategoria

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

  const img = imgCustom || (semLogo ? undefined : imgCategoria)
  const info = useCorLogo(img)
  const glow = img ? info?.cor || "transparent" : cor

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => (dn ? setSeletor(true) : toast.error("Esse lançamento não tem nome pra vincular o logo"))}
        title="Trocar logo (vale pra todos com o mesmo nome)"
        className={cn("grid place-items-center overflow-hidden rounded-full transition-transform hover:scale-105")}
        style={{
          width: size, height: size,
          background: img ? info?.fundo || "var(--background)" : `${cor}1f`,
          color: cor,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${glow} 55%, transparent), 0 0 ${Math.round(size * 0.4)}px color-mix(in srgb, ${glow} 45%, transparent)`,
        }}
      >
        {img ? (
          info ? <img src={info.img} alt="" className="size-full object-cover" draggable={false} /> : null
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
      {seletor && <SeletorLogo descricao={descricao} open={seletor} onOpenChange={setSeletor} />}
    </span>
  )
}
