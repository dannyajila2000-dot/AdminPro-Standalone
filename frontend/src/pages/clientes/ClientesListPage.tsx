import { useEffect, useMemo, useState } from 'react'
import { CanAccess } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { axiosInstance } from '../../lib/axios'
import { useBusquedaPaginada } from '../../hooks/useBusquedaPaginada'
import { useSucursalActiva } from '../../hooks/useSucursalActiva'
import { SearchInput } from '../../components/ui/SearchInput'
import { Pagination } from '../../components/ui/Pagination'
import { PrimaryLinkButton } from '../../components/ui/PrimaryButton'
import { ExportarExcelButton } from '../../components/ui/ExportarExcelButton'
import { CargandoPantalla } from '../../components/ui/CargandoPantalla'
import { Avatar } from '../../components/ui/Avatar'
import { SucursalActivaSelector } from '../../components/ui/SucursalActivaSelector'
import {
  EstadoMembresiaBadge,
  ESTADO_MEMBRESIA_LABEL,
  type EstadoMembresia,
} from '../../components/ui/EstadoMembresiaBadge'

interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  etiqueta: string | null
  fotoUrl: string | null
  sexo: string | null
  creadoEn: string
  sucursal: { id: string; nombre: string } | null
  estadoMembresia: { estado: EstadoMembresia; diasRestantes: number | null; plan: string | null } | null
}

export function ClientesListPage() {
  const navigate = useNavigate()
  const { puedeVerTodasSucursales, sucursales, sucursalActivaId, setSucursalActivaId } =
    useSucursalActiva()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    axiosInstance
      .get<Cliente[]>('/clientes')
      .then(({ data }) => setClientes(data))
      .catch(() => toast.error('No se pudo cargar la lista de clientes'))
      .finally(() => setCargando(false))
  }, [])

  const clientesEnSucursal = useMemo(() => {
    if (!puedeVerTodasSucursales || !sucursalActivaId) return clientes
    return clientes.filter((c) => c.sucursal?.id === sucursalActivaId)
  }, [clientes, sucursalActivaId, puedeVerTodasSucursales])

  const {
    query,
    setQuery,
    pageItems,
    filtrados,
    pagina,
    setPagina,
    totalPaginas,
    totalFiltrados,
  } = useBusquedaPaginada(clientesEnSucursal, (c) => `${c.nombre} ${c.email ?? ''} ${c.etiqueta ?? ''}`)

  const filasCSV = filtrados.map((c) => ({
    nombre: c.nombre,
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    etiqueta: c.etiqueta ?? '',
    estadoMembresia: c.estadoMembresia ? ESTADO_MEMBRESIA_LABEL[c.estadoMembresia.estado] : '',
    creado: new Date(c.creadoEn).toLocaleDateString(),
  }))

  if (cargando) {
    return <CargandoPantalla minHeight={300} />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Clientes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ExportarExcelButton nombreArchivo="clientes.csv" filas={filasCSV} />
          <CanAccess resource="clientes" action="create">
            <PrimaryLinkButton to="/clientes/nuevo" className="flex items-center gap-2">
              <Plus size={16} />
              Nuevo cliente
            </PrimaryLinkButton>
          </CanAccess>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre, email o etiqueta…" />
        {puedeVerTodasSucursales && (
          <SucursalActivaSelector
            sucursales={sucursales}
            value={sucursalActivaId}
            onChange={setSucursalActivaId}
          />
        )}
      </div>

      <div className="mt-3">
        {pageItems.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center text-sm text-[var(--color-text-faint)] shadow-[var(--sombra-sm)]">
            {query ? 'Sin resultados para tu búsqueda' : 'Sin clientes todavía'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((cliente) => (
              <div
                key={cliente.id}
                onClick={() => navigate(`/clientes/${cliente.id}`)}
                className="flex cursor-pointer flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--sombra-sm)] transition-colors hover:border-[var(--color-primario)]"
              >
                <div className="flex items-center gap-3">
                  <Avatar nombre={cliente.nombre} fotoUrl={cliente.fotoUrl} size={48} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">
                      {cliente.nombre}
                    </p>
                    {cliente.email && (
                      <p className="truncate text-xs text-[var(--color-text-faint)]">{cliente.email}</p>
                    )}
                  </div>
                  {cliente.estadoMembresia && (
                    <EstadoMembresiaBadge estado={cliente.estadoMembresia.estado} className="ml-auto" />
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  {cliente.telefono && <span>{cliente.telefono}</span>}
                  {cliente.etiqueta && (
                    <span className="rounded bg-[var(--color-bg-muted)] px-1.5 py-0.5 font-medium text-[var(--color-text-muted)]">
                      {cliente.etiqueta}
                    </span>
                  )}
                  {puedeVerTodasSucursales && cliente.sucursal && (
                    <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[var(--color-text-faint)]">
                      {cliente.sucursal.nombre}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-[var(--color-text-faint)]">
                  Cliente desde {new Date(cliente.creadoEn).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
        {totalPaginas > 1 && (
          <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)]">
            <Pagination pagina={pagina} totalPaginas={totalPaginas} onChange={setPagina} total={totalFiltrados} />
          </div>
        )}
      </div>
    </div>
  )
}
