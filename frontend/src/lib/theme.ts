/** Mezcla un color hex hacia blanco un `factor` (0 = igual, 1 = blanco puro). */
function aclararHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mezclar = (c: number) => Math.round(c + (255 - c) * factor).toString(16).padStart(2, '0')
  return `#${mezclar(r)}${mezclar(g)}${mezclar(b)}`
}

/** Mezcla un color hex hacia negro un `factor` (0 = igual, 1 = negro puro). */
function oscurecerHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mezclar = (c: number) => Math.round(c * (1 - factor)).toString(16).padStart(2, '0')
  return `#${mezclar(r)}${mezclar(g)}${mezclar(b)}`
}

/** Luminancia relativa (0 = negro, 1 = blanco) según WCAG. */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

/** Texto legible sobre un fondo de ese color: negro si es claro (dorado, amarillo), blanco si es oscuro. */
export function colorTextoSobre(hex: string): '#111111' | '#ffffff' {
  return luminancia(hex) > 0.179 ? '#111111' : '#ffffff'
}

// Paleta de gymProApp: dorado sobre blanco.
export const COLOR_MARCA_POR_DEFECTO = '#c9a227'
// Colores que el sistema guardaba (o proponía) por defecto antes: se tratan como "sin color propio"
// para que pasen a la paleta de gymProApp sin tocar la base de datos.
const COLORES_MARCA_ANTERIORES = ['#0f172a', '#0284c7']

export function esColorMarcaAnterior(color?: string | null): boolean {
  return !!color && COLORES_MARCA_ANTERIORES.includes(color.toLowerCase())
}

/** El color de marca que realmente se usa: el de la empresa, o el de gymProApp si no tiene uno propio. */
export function colorMarcaEfectivo(color?: string | null): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) && !esColorMarcaAnterior(color) ? color : COLOR_MARCA_POR_DEFECTO
}

export function aplicarColorPrimario(color?: string | null) {
  const valido = colorMarcaEfectivo(color)
  const raiz = document.documentElement.style
  // Un color claro (como el dorado) no se lee como texto sobre fondo blanco: se oscurece. Y uno oscuro
  // no se lee como texto sobre fondo oscuro: se aclara. Ver el token --color-primario-legible en index.css.
  const esClaro = luminancia(valido) > 0.3
  raiz.setProperty('--color-primario', valido)
  raiz.setProperty('--color-primario-suave', `${valido}1f`)
  raiz.setProperty('--color-primario-texto', colorTextoSobre(valido))
  raiz.setProperty('--color-primario-legible-light', esClaro ? oscurecerHex(valido, 0.3) : valido)
  raiz.setProperty('--color-primario-legible-dark', esClaro ? valido : aclararHex(valido, 0.6))
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
