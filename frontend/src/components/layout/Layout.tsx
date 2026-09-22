import { useEffect, useMemo, useState } from 'react'
import { useGetIdentity } from '@refinedev/core'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Menu, Search } from 'lucide-react'
import type { Identity } from '../../lib/identity'
import { aplicarColorPrimario } from '../../lib/theme'
import { buildAbility } from '../../ability/ability'
import { ThemeToggle } from '../ui/ThemeToggle'
import { NotificationBell } from '../ui/NotificationBell'
import { CommandPalette } from '../ui/CommandPalette'
import { UserMenu } from '../ui/UserMenu'
import { NAV_ITEMS, esGrupoNav, type NavLeaf } from '../../lib/navigation'

interface SidebarProps {
  identity?: Identity
  abierto: boolean
  onCerrar: () => void
}

function esRutaActiva(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function Sidebar({ identity, abierto, onCerrar }: SidebarProps) {
  const location = useLocation()
  // solo guarda los grupos que el usuario abrió/cerró a mano — si un grupo no
  // está aquí, su estado por defecto es "abierto si estás en una de sus páginas"
  const [overridesGrupo, setOverridesGrupo] = useState<Record<string, boolean>>({})

  const ability = useMemo(() => buildAbility(identity?.permisos ?? []), [identity?.permisos])

  const puedeVerItem = (item: NavLeaf) =>
    item.sinPermiso || ability.can(`${item.resource}.leer`, 'all')

  const claseEnlace = (activo: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      activo
        ? 'bg-[var(--color-primario-suave)] text-[var(--color-primario-legible)]'
        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
    }`

  const alternarGrupo = (label: string, abiertoPorDefecto: boolean) => {
    setOverridesGrupo((prev) => ({
      ...prev,
      [label]: !(prev[label] ?? abiertoPorDefecto),
    }))
  }

  return (
    <>
      {/* Overlay solo en móvil, cuando el drawer está abierto */}
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onCerrar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-card)] transition-transform duration-200 ease-in-out md:relative md:z-auto md:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          {identity?.empresa.logoUrl ? (
            <img
              src={identity.empresa.logoUrl}
              alt={identity.empresa.nombre}
              className="h-8 max-w-full object-contain"
            />
          ) : (
            <span className="truncate text-lg font-bold tracking-tight text-[var(--color-text)]">
              {identity?.empresa.nombre ?? 'GymPro'}
            </span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          {NAV_ITEMS.map((item) => {
            if (esGrupoNav(item)) {
              const hijosVisibles = item.children.filter(puedeVerItem)
              if (hijosVisibles.length === 0) return null

              const algunHijoActivo = hijosVisibles.some((hijo) =>
                esRutaActiva(location.pathname, hijo.to),
              )
              const grupoAbierto = overridesGrupo[item.label] ?? algunHijoActivo
              const Icono = item.icon

              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => alternarGrupo(item.label, algunHijoActivo)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      algunHijoActivo
                        ? 'text-[var(--color-text)]'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icono className="h-4 w-4 shrink-0" strokeWidth={2} />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    {grupoAbierto ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>

                  {grupoAbierto && (
                    <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-3">
                      {hijosVisibles.map((hijo) => {
                        const HijoIcono = hijo.icon
                        const hijoActivo = esRutaActiva(location.pathname, hijo.to)
                        return (
                          <Link
                            key={hijo.to}
                            to={hijo.to}
                            onClick={onCerrar}
                            className={claseEnlace(hijoActivo)}
                          >
                            <HijoIcono className="h-4 w-4 shrink-0" strokeWidth={2} />
                            <span className="truncate">{hijo.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            if (!puedeVerItem(item)) return null

            const Icono = item.icon
            const activo = esRutaActiva(location.pathname, item.to)
            return (
              <Link key={item.to} to={item.to} onClick={onCerrar} className={claseEnlace(activo)}>
                <Icono className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export function Layout() {
  const { data: identity } = useGetIdentity<Identity>()
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const [paletaAbierta, setPaletaAbierta] = useState(false)
  const location = useLocation()

  useEffect(() => {
    aplicarColorPrimario(identity?.empresa.colorPrimario)
  }, [identity?.empresa.colorPrimario])

  // Cierra el drawer móvil automáticamente al navegar
  useEffect(() => {
    setSidebarAbierto(false)
  }, [location.pathname])

  return (
    <>
      <CommandPalette abierto={paletaAbierta} onCambiar={setPaletaAbierta} />
      <div className="flex min-h-screen bg-[var(--color-bg)]">
        <Sidebar
          identity={identity}
          abierto={sidebarAbierto}
          onCerrar={() => setSidebarAbierto(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]/80 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarAbierto((v) => !v)}
                className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] md:hidden"
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletaAbierta(true)}
                aria-label="Buscar"
                className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] sm:hidden"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setPaletaAbierta(true)}
                className="hidden items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] sm:flex"
              >
                <Search className="h-4 w-4" />
                Buscar
                <kbd className="rounded-lg border border-[var(--color-border)] px-1.5 py-0.5 text-xs">
                  Ctrl K
                </kbd>
              </button>
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  )
}
