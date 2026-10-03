import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CanAccess, useGetIdentity } from '@refinedev/core'
import { axiosInstance } from '../../lib/axios'
import { aplicarColorPrimario, colorMarcaEfectivo, esColorMarcaAnterior } from '../../lib/theme'
import type { Identity } from '../../lib/identity'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { ImageUploadField } from '../../components/ui/ImageUploadField'
import { CargandoPantalla } from '../../components/ui/CargandoPantalla'

const ZONAS_HORARIAS = [
  { value: 'America/Guayaquil', label: 'Ecuador continental (America/Guayaquil, UTC-5)' },
  { value: 'Pacific/Galapagos', label: 'Galápagos (Pacific/Galapagos, UTC-6)' },
]

const COLOR_HEX_REGEX = /^#[0-9a-fA-F]{6}$/

const empresaSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  razonSocial: z.string().optional(),
  ruc: z
    .string()
    .regex(/^\d{13}$/, 'El RUC debe tener 13 dígitos')
    .optional()
    .or(z.literal('')),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  zonaHoraria: z.string().optional(),
  logoUrl: z.string().optional(),
  colorPrimario: z.string().regex(COLOR_HEX_REGEX, 'Formato hex, ej. #0284C7').optional().or(z.literal('')),
})

type EmpresaValues = z.infer<typeof empresaSchema>

function VistaPrevia({
  nombre,
  logoUrl,
  colorPrimario,
}: {
  nombre: string
  logoUrl?: string
  colorPrimario?: string
}) {
  const color = colorMarcaEfectivo(colorPrimario)
  const nombreVisible = nombre.trim() || 'Tu empresa'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
          Así se ve en el sidebar
        </p>
        <div
          className="flex items-center gap-2 rounded-xl p-3 shadow-[var(--sombra-sm)]"
          style={{ backgroundColor: color }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-7 w-7 rounded object-cover" />
          ) : (
            <div className="h-7 w-7 rounded bg-white/20" />
          )}
          <span className="truncate text-sm font-semibold text-white">{nombreVisible}</span>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
          Así se ve en el login
        </p>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="h-10 w-10 rounded bg-[var(--color-bg-muted)]" />
          )}
          <span className="text-sm font-semibold text-[var(--color-text)]">{nombreVisible}</span>
          <div
            className="mt-1 w-full rounded-lg py-1.5 text-center text-xs font-medium text-white"
            style={{ backgroundColor: color }}
          >
            Iniciar sesión
          </div>
        </div>
      </div>
    </div>
  )
}

export function EmpresaPage() {
  const { data: identity } = useGetIdentity<Identity>()
  const [cargando, setCargando] = useState(true)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmpresaValues>({ resolver: zodResolver(empresaSchema) })

  const colorActual = watch('colorPrimario')
  const nombreActual = watch('nombre')
  const logoActual = watch('logoUrl')

  useEffect(() => {
    if (!identity?.empresaId) return
    axiosInstance
      .get(`/empresas/${identity.empresaId}`)
      .then(({ data }) => {
        reset({
          nombre: data.nombre ?? '',
          razonSocial: data.razonSocial ?? '',
          ruc: data.ruc ?? '',
          direccion: data.direccion ?? '',
          telefono: data.telefono ?? '',
          email: data.email ?? '',
          zonaHoraria: data.zonaHoraria ?? 'America/Guayaquil',
          logoUrl: data.logoUrl ?? '',
          colorPrimario: esColorMarcaAnterior(data.colorPrimario) ? '' : (data.colorPrimario ?? ''),
        })
      })
      .finally(() => setCargando(false))
  }, [identity?.empresaId, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!identity?.empresaId) return
    try {
      await axiosInstance.patch(`/empresas/${identity.empresaId}`, {
        nombre: values.nombre,
        razonSocial: values.razonSocial || null,
        ruc: values.ruc || null,
        direccion: values.direccion || null,
        telefono: values.telefono || null,
        email: values.email || null,
        zonaHoraria: values.zonaHoraria || undefined,
        logoUrl: values.logoUrl || null,
        colorPrimario: values.colorPrimario || null,
      })
      toast.success('Empresa actualizada')
      aplicarColorPrimario(values.colorPrimario)
      // recarga para refrescar el logo/color en toda la app (sidebar, login, etc.)
      window.location.reload()
    } catch {
      toast.error('No se pudo actualizar la empresa')
    }
  })

  if (cargando) {
    return <CargandoPantalla minHeight={300} />
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-[var(--color-text)]">Mi empresa</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        El nombre, logo y color se ven en el sidebar y en la pantalla de login. El RUC,
        dirección y teléfono aparecen como encabezado en los recibos que imprimes.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Nombre comercial
            </label>
            <input
              {...register('nombre')}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
            {errors.nombre && (
              <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Razón social (opcional)
            </label>
            <input
              {...register('razonSocial')}
              placeholder="Si es distinta al nombre comercial"
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">
              El nombre legal registrado en el SRI. Si lo llenas, aparece en los recibos en vez
              del nombre comercial.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">RUC</label>
            <input
              {...register('ruc')}
              placeholder="1234567890001"
              maxLength={13}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
            {errors.ruc && <p className="mt-1 text-xs text-red-600">{errors.ruc.message}</p>}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Teléfono
              </label>
              <input
                {...register('telefono')}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Email
              </label>
              <input
                {...register('email')}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Dirección
            </label>
            <input
              {...register('direccion')}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Zona horaria
            </label>
            <select
              {...register('zonaHoraria')}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            >
              {ZONAS_HORARIAS.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>

          <ImageUploadField
            label="Logo"
            value={watch('logoUrl')}
            onChange={(url) => setValue('logoUrl', url, { shouldDirty: true })}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Color primario
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorMarcaEfectivo(colorActual)}
                onChange={(e) =>
                  setValue('colorPrimario', e.target.value, { shouldDirty: true })
                }
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-[var(--color-border)]"
              />
              <input
                {...register('colorPrimario')}
                placeholder="#0284C7"
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
              />
            </div>
            {errors.colorPrimario && (
              <p className="mt-1 text-xs text-red-600">{errors.colorPrimario.message}</p>
            )}
          </div>

          <CanAccess resource="empresas" action="edit">
            <PrimaryButton type="submit" disabled={isSubmitting} className="mt-2">
              {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </PrimaryButton>
          </CanAccess>
        </form>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--sombra-sm)] lg:sticky lg:top-4 lg:self-start">
          <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Vista previa</p>
          <VistaPrevia nombre={nombreActual ?? ''} logoUrl={logoActual} colorPrimario={colorActual} />
        </div>
      </div>
    </div>
  )
}
