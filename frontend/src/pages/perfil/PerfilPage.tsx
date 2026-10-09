import { useEffect, useState } from 'react'
import { useGetIdentity } from '@refinedev/core'
import { axiosInstance } from '../../lib/axios'
import type { Identity } from '../../lib/identity'
import { puedeCambiarSuClave } from '../../lib/permisos'
import { Avatar } from '../../components/ui/Avatar'
import { CargandoPantalla } from '../../components/ui/CargandoPantalla'
import { PerfilInfoForm, type PerfilValues } from './PerfilInfoForm'
import { PerfilSeguridadForm } from './PerfilSeguridadForm'

interface PerfilCompleto extends PerfilValues {
  email: string
  creadoEn: string
}

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'seguridad', label: 'Seguridad' },
] as const

type TabId = (typeof TABS)[number]['id']

export function PerfilPage() {
  const { data: identity } = useGetIdentity<Identity>()
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null)
  const [tab, setTab] = useState<TabId>('perfil')
  // Las cuentas de demostración no ven la parte de seguridad ni pueden editar su perfil.
  const puedeEditar = puedeCambiarSuClave(identity?.permisos)
  const pestanas = puedeEditar ? TABS : TABS.filter((t) => t.id === 'perfil')

  const cargarPerfil = () => {
    axiosInstance.get<PerfilCompleto>('/usuarios/me').then(({ data }) => setPerfil(data))
  }

  useEffect(() => {
    cargarPerfil()
  }, [])

  if (!perfil) {
    return <CargandoPantalla minHeight={400} />
  }

  const miembroDesde = new Date(perfil.creadoEn).toLocaleDateString('es', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm">
        <div className="h-28 bg-gradient-to-r from-[var(--color-primario)] to-[var(--color-primario)]/70" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
            <div className="rounded-full bg-[var(--color-bg-card)] p-1 shadow-sm">
              <Avatar nombre={perfil.nombre} fotoUrl={perfil.fotoUrl} size={96} />
            </div>
            <div className="pb-1">
              <h1 className="text-xl font-bold text-[var(--color-text)]">{perfil.nombre}</h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {perfil.cargo ? `${perfil.cargo} · ` : ''}
                {identity?.empresa.nombre}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-text-muted)]">
            <span>{perfil.email}</span>
            {perfil.telefono && <span>{perfil.telefono}</span>}
            <span>Miembro desde {miembroDesde}</span>
          </div>

          {perfil.bio && <p className="mt-3 max-w-xl text-sm text-[var(--color-text-muted)]">{perfil.bio}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm">
        <div className="flex gap-1 border-b border-[var(--color-border)] px-6">
          {pestanas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-3 py-3 text-sm font-medium transition ${
                tab === t.id
                  ? 'border-[var(--color-primario)] text-[var(--color-text)]'
                  : 'border-transparent text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'perfil' && !puedeEditar ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Esta cuenta es de demostración: el perfil no se puede editar.
            </p>
          ) : tab === 'perfil' ? (
            <PerfilInfoForm
              valoresIniciales={{
                nombre: perfil.nombre,
                cargo: perfil.cargo ?? '',
                telefono: perfil.telefono ?? '',
                bio: perfil.bio ?? '',
                fotoUrl: perfil.fotoUrl ?? '',
              }}
              onGuardado={cargarPerfil}
            />
          ) : (
            <PerfilSeguridadForm />
          )}
        </div>
      </div>
    </div>
  )
}
