// Redimensiona e comprime uma imagem para usar como ícone (quadrado, sem cortar).
export function comprimirImagemParaIcone(file: File, tamanhoMax = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const ladoMaior = Math.max(img.width, img.height)
        const lado = Math.min(ladoMaior, tamanhoMax)
        const escala = lado / ladoMaior
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)
        const canvas = document.createElement("canvas")
        canvas.width = lado
        canvas.height = lado
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("Canvas indisponível"))
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        // centraliza a imagem inteira, com transparência nas bordas (não corta)
        ctx.drawImage(img, 0, 0, img.width, img.height, (lado - w) / 2, (lado - h) / 2, w, h)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = () => reject(new Error("Não foi possível ler essa imagem"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"))
    reader.readAsDataURL(file)
  })
}
