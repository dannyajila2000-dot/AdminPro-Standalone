import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Copy, Search, X, Users } from 'lucide-react'
import { CanAccess } from '@refinedev/core'
import { axiosInstance } from '../../lib/axios'
import { mensajeError } from '../../lib/errores'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { Spinner } from '../../components/ui/Spinner'
import { CargandoPantalla } from '../../components/ui/CargandoPantalla'

interface Permiso {
  id: string
  clave: string
  etiqueta: string
}

interface Rol {
  id: string
  empresaId: string | null
  nombre: string
  descripcion: string | null
  permisos: { permiso: Permiso }[]
  _count?: { usuarios: number }
}

function grupoDe(clave: string) {
  return clave.split('.')[0]
}

export function RolesPermisosPage() {
  const [roles, setRoles] = useState<Rol[]>([])
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [cargando, setCargando] = useState(true)
  const { confirmar, dialog } = useConfirm()

  const [rolSeleccionadoId, setRolSeleccionadoId] = useState<string | null>(null)
  const [permisosMarcados, setPermisosMarcados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [busquedaPermiso, setBusquedaPermiso] = useState('')

  const [nombreNuevoRol, setNombreNuevoRol] = useState('')
  const [descripcionNuevoRol, setDescripcionNuevoRol] = useState('')
  const [creandoRol, setCreandoRol] = useState(false)
  const [clonandoDesde, setClonandoDesde] = useState<{ nombre: string; permisoIds: Set<string> } | null>(
    null,
  )

  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreEdit, setNombreEdit] = useState('')
  const [descripcionEdit, setDescripcionEdit] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    try {
      const [r, p] = await Promise.all([
        axiosInstance.get<Rol[]>('/roles'),
        axiosInstance.get<Permiso[]>('/permisos'),
      ])
      setRoles(r.data.filter((rol) => rol.empresaId !== null))
      setPermisos(p.data)
    } catch {
      toast.error('No se pudieron cargar los roles y permisos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const rolSeleccionado = roles.find((r) => r.id === rolSeleccionadoId) ?? null

  const seleccionarRol = (rol: Rol) => {
    setRolSeleccionadoId(rol.id)
    setPermisosMarcados(new Set(rol.permisos.map((p) => p.permiso.id)))
    setEditandoNombre(false)
    setBusquedaPermiso('')
  }

  const permisosFiltrados = useMemo(() => {
    const q = busquedaPermiso.trim().toLowerCase()
    if (!q) return permisos
    return permisos.filter(
      (p) => p.etiqueta.toLowerCase().includes(q) || p.clave.toLowerCase().includes(q),
    )
  }, [permisos, busquedaPermiso])

  const gruposPermisos = useMemo(() => {
    const grupos = new Map<string, Permiso[]>()
    for (const permiso of permisosFiltrados) {
      const grupo = grupoDe(permiso.clave)
      if (!grupos.has(grupo)) grupos.set(grupo, [])
      grupos.get(grupo)!.push(permiso)
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [permisosFiltrados])

  const alternarPermiso = (permisoId: string) => {
    setPermisosMarcados((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(permisoId)) nuevo.delete(permisoId)
      else nuevo.add(permisoId)
      return nuevo
    })
  }

  const alternarGrupo = (permisosDelGrupo: Permiso[], marcarTodos: boolean) => {
    setPermisosMarcados((prev) => {
      const nuevo = new Set(prev)
      for (const permiso of permisosDelGrupo) {
        if (marcarTodos) nuevo.add(permiso.id)
        else nuevo.delete(permiso.id)
      }
      return nuevo
    })
  }

  const guardarPermisos = async () => {
    if (!rolSeleccionado) return
    setGuardando(true)
    try {
      await axiosInstance.patch(`/roles/${rolSeleccionado.id}/permisos`, {
        permisoIds: [...permisosMarcados],
      })
      toast.success('Permisos actualizados')
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudieron guardar los permisos'))
    } finally {
      setGuardando(false)
    }
  }

  const crearRol = async () => {
    if (!nombreNuevoRol.trim()) return
    setCreandoRol(true)
    try {
      const { data: nuevoRol } = await axiosInstance.post<Rol>('/roles', {
        nombre: nombreNuevoRol,
        descripcion: descripcionNuevoRol || undefined,
      })
      if (clonandoDesde && clonandoDesde.permisoIds.size > 0) {
        await axiosInstance.patch(`/roles/${nuevoRol.id}/permisos`, {
          permisoIds: [...clonandoDesde.permisoIds],
        })
      }
      setNombreNuevoRol('')
      setDescripcionNuevoRol('')
      setClonandoDesde(null)
      toast.success('Rol creado')
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo crear el rol'))
    } finally {
      setCreandoRol(false)
    }
  }

  const clonarRol = (rol: Rol) => {
    setNombreNuevoRol(`${rol.nombre} (copia)`)
    setDescripcionNuevoRol(rol.descripcion ?? '')
    setClonandoDesde({ nombre: rol.nombre, permisoIds: new Set(rol.permisos.map((p) => p.permiso.id)) })
  }

  const cancelarClonacion = () => {
    setClonandoDesde(null)
    setNombreNuevoRol('')
    setDescripcionNuevoRol('')
  }

  const iniciarEdicionNombre = () => {
    if (!rolSeleccionado) return
    setNombreEdit(rolSeleccionado.nombre)
    setDescripcionEdit(rolSeleccionado.descripcion ?? '')
    setEditandoNombre(true)
  }

  const guardarNombre = async () => {
    if (!rolSeleccionado || !nombreEdit.trim()) return
    setGuardandoNombre(true)
    try {
      await axiosInstance.patch(`/roles/${rolSeleccionado.id}`, {
        nombre: nombreEdit,
        descripcion: descripcionEdit || undefined,
      })
      toast.success('Rol actualizado')
      setEditandoNombre(false)
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo actualizar el rol'))
    } finally {
      setGuardandoNombre(false)
    }
  }

  const eliminarRol = async (rol: Rol) => {
    const confirmado = await confirmar(
      `Eliminar «${rol.nombre}»`,
      'Esta acción no se puede deshacer. Solo se puede eliminar si nadie tiene este rol asignado.',
      'Eliminar',
    )
    if (!confirmado) return

    setEliminando(true)
    try {
      await axiosInstance.delete(`/roles/${rol.id}`)
      toast.success('Rol eliminado')
      if (rolSeleccionadoId === rol.id) setRolSeleccionadoId(null)
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo eliminar el rol'))
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div>
      {dialog}

      <h1 className="text-xl font-bold text-[var(--color-text)]">Roles y permisos</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Crea roles y define qué puede ver o hacer cada uno. Luego asigna un rol a cada colaborador
        desde la página de Usuarios.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
            Nuevo rol
          </label>
          <input
            value={nombreNuevoRol}
            onChange={(e) => setNombreNuevoRol(e.target.value)}
            placeholder="Ej: Recepcionista"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
            Descripción (opcional)
          </label>
          <input
            value={descripcionNuevoRol}
            onChange={(e) => setDescripcionNuevoRol(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          />
        </div>
        <CanAccess resource="roles" action="create">
          <button
            type="button"
            onClick={crearRol}
            disabled={creandoRol || !nombreNuevoRol.trim()}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-50"
          >
            {creandoRol ? 'Creando…' : clonandoDesde ? 'Crear copia' : 'Crear rol'}
          </button>
        </CanAccess>
        {clonandoDesde && (
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            Copiando {clonandoDesde.permisoIds.size} permiso(s) de «{clonandoDesde.nombre}»
            <button
              type="button"
              onClick={cancelarClonacion}
              className="rounded p-0.5 hover:bg-[var(--color-bg-subtle)]"
              aria-label="Cancelar clonación"
            >
              <X size={12} />
            </button>
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-2">
          {cargando && <CargandoPantalla minHeight={80} />}
          {!cargando && roles.length === 0 && (
            <p className="p-2 text-sm text-[var(--color-text-faint)]">Sin roles todavía</p>
          )}
          {roles.map((rol) => (
            <div key={rol.id} className="group relative">
              <button
                type="button"
                onClick={() => seleccionarRol(rol)}
                className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm ${
                  rolSeleccionadoId === rol.id
                    ? 'bg-[var(--color-primario)] text-[var(--color-primario-texto)]'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)]'
                }`}
              >
                <span className="truncate">{rol.nombre}</span>
                <span
                  className={`flex shrink-0 items-center gap-1 text-xs ${
                    rolSeleccionadoId === rol.id
                      ? 'text-[var(--color-primario-texto)]/80'
                      : 'text-[var(--color-text-faint)]'
                  }`}
                >
                  <Users size={11} />
                  {rol._count?.usuarios ?? 0}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  clonarRol(rol)
                }}
                title={`Clonar «${rol.nombre}»`}
                className={`absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 group-hover:opacity-100 ${
                  rolSeleccionadoId === rol.id
                    ? 'text-[var(--color-primario-texto)]/80 hover:bg-black/10'
                    : 'text-[var(--color-text-faint)] hover:bg-[var(--color-bg-subtle)]'
                }`}
              >
                <Copy size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
          {!rolSeleccionado && (
            <p className="text-sm text-[var(--color-text-faint)]">
              Selecciona un rol de la izquierda para ver y editar sus permisos.
            </p>
          )}

          {rolSeleccionado && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                {!editandoNombre ? (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[var(--color-text)]">
                        {rolSeleccionado.nombre}
                      </h2>
                      <span className="flex items-center gap-1 rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-xs text-[var(--color-text-muted)]">
                        <Users size={11} />
                        {rolSeleccionado._count?.usuarios ?? 0} persona(s)
                      </span>
                    </div>
                    {rolSeleccionado.descripcion && (
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {rolSeleccionado.descripcion}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <input
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                      placeholder="Nombre del rol"
                    />
                    <input
                      value={descripcionEdit}
                      onChange={(e) => setDescripcionEdit(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                      placeholder="Descripción (opcional)"
                    />
                    <button
                      type="button"
                      onClick={guardarNombre}
                      disabled={guardandoNombre || !nombreEdit.trim()}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primario)] px-3 py-1.5 text-sm text-[var(--color-primario-texto)] disabled:opacity-50"
                    >
                      {guardandoNombre && <Spinner size={12} />}
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoNombre(false)}
                      className="rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <div className="flex shrink-0 items-center gap-1">
                  {!editandoNombre && (
                    <CanAccess resource="roles" action="edit">
                      <button
                        type="button"
                        onClick={iniciarEdicionNombre}
                        title="Renombrar rol"
                        className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
                      >
                        <Pencil size={14} />
                      </button>
                    </CanAccess>
                  )}
                  <CanAccess resource="roles" action="delete">
                    <button
                      type="button"
                      onClick={() => eliminarRol(rolSeleccionado)}
                      disabled={eliminando || (rolSeleccionado._count?.usuarios ?? 0) > 0}
                      title={
                        (rolSeleccionado._count?.usuarios ?? 0) > 0
                          ? 'Quítale este rol a todos primero para poder eliminarlo'
                          : 'Eliminar rol'
                      }
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </CanAccess>
                  <CanAccess resource="roles" action="edit">
                    <PrimaryButton
                      type="button"
                      onClick={guardarPermisos}
                      disabled={guardando}
                      className="ml-1 flex items-center gap-2"
                    >
                      {guardando && <Spinner size={14} />}
                      {guardando ? 'Guardando…' : 'Guardar cambios'}
                    </PrimaryButton>
                  </CanAccess>
                </div>
              </div>

              <div className="relative mt-4 max-w-xs">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
                />
                <input
                  value={busquedaPermiso}
                  onChange={(e) => setBusquedaPermiso(e.target.value)}
                  placeholder="Buscar un permiso…"
                  className="w-full rounded-lg border border-[var(--color-border)] py-1.5 pl-8 pr-3 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {gruposPermisos.map(([grupo, permisosDelGrupo]) => {
                  const todosMarcados = permisosDelGrupo.every((p) => permisosMarcados.has(p.id))
                  return (
                    <div
                      key={grupo}
                      className="rounded-lg border border-[var(--color-border)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold capitalize text-[var(--color-text)]">
                          {grupo.replace('-', ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => alternarGrupo(permisosDelGrupo, !todosMarcados)}
                          className="text-xs text-[var(--color-primario-legible)] hover:underline"
                        >
                          {todosMarcados ? 'Ninguno' : 'Todos'}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {permisosDelGrupo.map((permiso) => (
                          <label
                            key={permiso.id}
                            className="flex items-center gap-2 text-sm text-[var(--color-text)]"
                          >
                            <input
                              type="checkbox"
                              checked={permisosMarcados.has(permiso.id)}
                              onChange={() => alternarPermiso(permiso.id)}
                            />
                            {permiso.etiqueta}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {gruposPermisos.length === 0 && (
                  <p className="text-sm text-[var(--color-text-faint)] sm:col-span-2">
                    Sin permisos que coincidan con «{busquedaPermiso}»
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
