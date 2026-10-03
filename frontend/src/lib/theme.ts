/** Mezcla un color hex hacia blanco un `factor` (0 = igual, 1 = blanco puro). */
function aclararHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mezclar = (c: number) => Math.round(c + (255 - c) * factor).toString(16).padStart(2, '0')
  return `#${mezclar(r)}${mezclar(g)}${mezclar(b)}`
}

export const COLOR_MARCA_POR_DEFECTO = '#0284c7'
// Hasta ahora el esquema guardaba este azul pizarra como valor por defecto en cada empresa; se trata
// como "sin color propio" para que pase a la paleta de gymProApp sin tocar la base de datos.
const COLOR_MARCA_ANTERIOR = '#0f172a'

export function esColorMarcaAnterior(color?: string | null): boolean {
  return color?.toLowerCase() === COLOR_MARCA_ANTERIOR
}

/** El color de marca que realmente se usa: el de la empresa, o el de gymProApp si no tiene uno propio. */
export function colorMarcaEfectivo(color?: string | null): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) && !esColorMarcaAnterior(color) ? color : COLOR_MARCA_POR_DEFECTO
}

export function aplicarColorPrimario(color?: string | null) {
  const valido = colorMarcaEfectivo(color)
  const raiz = document.documentElement.style
  raiz.setProperty('--color-primario', valido)
  // El color de marca puede ser cualquier tono que el cliente elija (a menudo oscuro,
  // pensado para texto blanco encima). Usado como texto sobre un fondo oscuro se
  // vuelve ilegible, así que en modo oscuro se usa una versión aclarada — ver el
  // token --color-primario-legible en index.css.
  raiz.setProperty('--color-primario-legible-light', valido)
  raiz.setProperty('--color-primario-legible-dark', aclararHex(valido, 0.6))
}

const TEMA_KEY = 'backoffice_tema'

export type Tema = 'light' | 'dark' | 'system'

const mediaOscuro = () => window.matchMedia('(prefers-color-scheme: dark)')

export function obtenerTemaGuardado(): Tema {
  const guardado = localStorage.getItem(TEMA_KEY)
  return guardado === 'light' || guardado === 'dark' || guardado === 'system'
    ? guardado
    : 'system'
}

function resolverOscuro(tema: Tema): boolean {
  return tema === 'dark' || (tema === 'system' && mediaOscuro().matches)
}

export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle('dark', resolverOscuro(tema))
  localStorage.setItem(TEMA_KEY, tema)
}

/**
 * Llamar una sola vez al iniciar la app. Además de aplicar el tema guardado (el
 * flash inicial ya lo evita el script inline en index.html), deja el modo "Sistema"
 * escuchando cambios en vivo del SO — así si el usuario cambia de claro a oscuro en
 * Windows/macOS mientras la pestaña sigue abierta, la app se actualiza sola.
 */
export function inicializarTema() {
  aplicarTema(obtenerTemaGuardado())

  mediaOscuro().addEventListener('change', (e) => {
    if (obtenerTemaGuardado() === 'system') {
      document.documentElement.classList.toggle('dark', e.matches)
    }
  })
}
