import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Archive, ArchiveRestore, Copy, X } from 'lucide-react'
import { CanAccess } from '@refinedev/core'
import { axiosInstance } from '../../lib/axios'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { Spinner } from '../../components/ui/Spinner'
import { CargandoPantalla } from '../../components/ui/CargandoPantalla'

function mensajeError(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  )
}

interface RecursoBasico {
  id: string
  nombre: string
}

interface TipoCita {
  id: string
  nombre: string
  descripcion: string | null
  duracionMinutos: number
  bufferMinutos: number
  precio: string | null
  color: string
  activo: boolean
  recursos: RecursoBasico[]
}

export function TiposCitaPage() {
  const [tipos, setTipos] = useState<TipoCita[]>([])
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [duracionMinutos, setDuracionMinutos] = useState(30)
  const [bufferMinutos, setBufferMinutos] = useState(0)
  const [precio, setPrecio] = useState('')
  const [color, setColor] = useState('#c9a227')
  const [creando, setCreando] = useState(false)
  const [mostrarArchivados, setMostrarArchivados] = useState(false)
  const [clonandoDesde, setClonandoDesde] = useState<string | null>(null)

  const [tipoEdit, setTipoEdit] = useState<TipoCita | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [descripcionEdit, setDescripcionEdit] = useState('')
  const [duracionEdit, setDuracionEdit] = useState(30)
  const [bufferEdit, setBufferEdit] = useState(0)
  const [precioEdit, setPrecioEdit] = useState('')
  const [colorEdit, setColorEdit] = useState('#c9a227')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [cambiandoActivoId, setCambiandoActivoId] = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await axiosInstance.get<TipoCita[]>('/tipos-cita', {
        params: mostrarArchivados ? { incluirInactivos: 'true' } : {},
      })
      setTipos(data)
    } catch {
      toast.error('No se pudieron cargar los tipos de cita')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarArchivados])

  const limpiarFormCrear = () => {
    setNombre('')
    setDescripcion('')
    setDuracionMinutos(30)
    setBufferMinutos(0)
    setPrecio('')
    setColor('#c9a227')
    setClonandoDesde(null)
  }

  const crear = async () => {
    if (!nombre.trim() || duracionMinutos <= 0) return
    setCreando(true)
    try {
      await axiosInstance.post('/tipos-cita', {
        nombre,
        descripcion: descripcion || undefined,
        duracionMinutos,
        bufferMinutos,
        precio: precio ? Number(precio) : undefined,
        color,
      })
      limpiarFormCrear()
      toast.success('Tipo de cita creado')
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo crear el tipo de cita'))
    } finally {
      setCreando(false)
    }
  }

  const clonar = (tipo: TipoCita) => {
    setNombre(`${tipo.nombre} (copia)`)
    setDescripcion(tipo.descripcion ?? '')
    setDuracionMinutos(tipo.duracionMinutos)
    setBufferMinutos(tipo.bufferMinutos)
    setPrecio(tipo.precio ?? '')
    setColor(tipo.color)
    setClonandoDesde(tipo.nombre)
  }

  const abrirEdicion = (tipo: TipoCita) => {
    setTipoEdit(tipo)
    setNombreEdit(tipo.nombre)
    setDescripcionEdit(tipo.descripcion ?? '')
    setDuracionEdit(tipo.duracionMinutos)
    setBufferEdit(tipo.bufferMinutos)
    setPrecioEdit(tipo.precio ?? '')
    setColorEdit(tipo.color)
  }

  const guardarEdicion = async () => {
    if (!tipoEdit || !nombreEdit.trim() || duracionEdit <= 0) return
    setGuardandoEdit(true)
    try {
      await axiosInstance.patch(`/tipos-cita/${tipoEdit.id}`, {
        nombre: nombreEdit,
        descripcion: descripcionEdit || null,
        duracionMinutos: duracionEdit,
        bufferMinutos: bufferEdit,
        precio: precioEdit ? Number(precioEdit) : null,
        color: colorEdit,
      })
      toast.success('Tipo de cita actualizado')
      setTipoEdit(null)
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo actualizar el tipo de cita'))
    } finally {
      setGuardandoEdit(false)
    }
  }

  const alternarActivo = async (tipo: TipoCita) => {
    setCambiandoActivoId(tipo.id)
    try {
      await axiosInstance.patch(`/tipos-cita/${tipo.id}`, { activo: !tipo.activo })
      toast.success(tipo.activo ? 'Tipo de cita archivado' : 'Tipo de cita reactivado')
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo actualizar el tipo de cita'))
    } finally {
      setCambiandoActivoId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-text)]">Tipos de cita</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Los distintos servicios que se pueden agendar (por ejemplo: consulta, corte de cabello,
        mantenimiento). Cada uno define su duración y el colchón de tiempo antes de la siguiente
        cita.
      </p>

      <CanAccess resource="tipos-cita" action="create">
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Nombre
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
              placeholder="Ej: Consulta general"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Duración (min)
            </label>
            <input
              type="number"
              min={5}
              step={5}
              value={duracionMinutos}
              onChange={(e) => setDuracionMinutos(Number(e.target.value))}
              className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Colchón (min)
            </label>
            <input
              type="number"
              min={0}
              step={5}
              value={bufferMinutos}
              onChange={(e) => setBufferMinutos(Number(e.target.value))}
              className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Precio (opcional)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="$"
              className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Color
            </label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 rounded-lg border border-[var(--color-border)]"
            />
          </div>
          <div className="w-full">
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Descripción (opcional)
            </label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué incluye este servicio…"
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
          </div>
          <PrimaryButton type="button" onClick={crear} disabled={creando || !nombre.trim()}>
            {creando ? 'Creando…' : clonandoDesde ? 'Crear copia' : 'Agregar tipo de cita'}
          </PrimaryButton>
          {clonandoDesde && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              Copiando de «{clonandoDesde}»
              <button
                type="button"
                onClick={limpiarFormCrear}
                className="rounded p-0.5 hover:bg-[var(--color-bg-subtle)]"
                aria-label="Cancelar clonación"
              >
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      </CanAccess>

      <div className="mt-4 flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={mostrarArchivados}
            onChange={(e) => setMostrarArchivados(e.target.checked)}
          />
          Mostrar archivados
        </label>
      </div>

      <div className="relative mt-2 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-bg-card)]/70 text-sm text-[var(--color-text-muted)]">
            <Spinner size={18} />
            Actualizando…
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Duración</th>
              <th className="px-4 py-2">Colchón</th>
              <th className="px-4 py-2">Precio</th>
              <th className="px-4 py-2">Color</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">
                  {t.nombre}
                  {!t.activo && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      Archivado
                    </span>
                  )}
                  {t.recursos.length > 0 && (
                    <p className="text-xs text-[var(--color-text-faint)]">
                      Ofrecido por: {t.recursos.map((r) => r.nombre).join(', ')}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2">{t.duracionMinutos} min</td>
                <td className="px-4 py-2">{t.bufferMinutos} min</td>
                <td className="px-4 py-2 text-[var(--color-text-muted)]">
                  {t.precio ? `$${Number(t.precio).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-[var(--color-border)] align-middle"
                    style={{ backgroundColor: t.color }}
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <CanAccess resource="tipos-cita" action="create">
                      <button
                        type="button"
                        onClick={() => clonar(t)}
                        title={`Duplicar «${t.nombre}»`}
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
                      >
                        <Copy size={14} />
                      </button>
                    </CanAccess>
                    <CanAccess resource="tipos-cita" action="edit">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(t)}
                        title="Editar tipo de cita"
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarActivo(t)}
                        disabled={cambiandoActivoId === t.id}
                        title={t.activo ? 'Archivar tipo de cita' : 'Reactivar tipo de cita'}
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-50"
                      >
                        {cambiandoActivoId === t.id ? (
                          <Spinner size={14} />
                        ) : t.activo ? (
                          <Archive size={14} />
                        ) : (
                          <ArchiveRestore size={14} />
                        )}
                      </button>
                    </CanAccess>
                  </div>
                </td>
              </tr>
            ))}
            {tipos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-text-faint)]">
                  {loading ? <CargandoPantalla minHeight={80} /> : 'Sin tipos de cita todavía'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tipoEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-lg bg-[var(--color-bg-card)] p-6 shadow-lg">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Editar tipo de cita
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  Nombre
                </label>
                <input
                  value={nombreEdit}
                  onChange={(e) => setNombreEdit(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    Duración (min)
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={duracionEdit}
                    onChange={(e) => setDuracionEdit(Number(e.target.value))}
                    className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    Colchón (min)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={bufferEdit}
                    onChange={(e) => setBufferEdit(Number(e.target.value))}
                    className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    Precio
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={precioEdit}
                    onChange={(e) => setPrecioEdit(e.target.value)}
                    placeholder="$"
                    className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    Color
                  </label>
                  <input
                    type="color"
                    value={colorEdit}
                    onChange={(e) => setColorEdit(e.target.value)}
                    className="h-9 w-14 rounded-lg border border-[var(--color-border)]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  Descripción
                </label>
                <input
                  value={descripcionEdit}
                  onChange={(e) => setDescripcionEdit(e.target.value)}
                  placeholder="Qué incluye este servicio…"
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTipoEdit(null)}
                className="rounded px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
              >
                Cancelar
              </button>
              <PrimaryButton
                type="button"
                onClick={guardarEdicion}
                disabled={guardandoEdit || !nombreEdit.trim() || duracionEdit <= 0}
                className="flex items-center gap-2"
              >
                {guardandoEdit && <Spinner size={14} />}
                {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
