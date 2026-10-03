import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CanAccess, useGetIdentity } from '@refinedev/core'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus } from 'lucide-react'
import { axiosInstance } from '../../lib/axios'
import { buildAbility } from '../../ability/ability'
import type { Identity } from '../../lib/identity'
import { inicioDiaLocalISO, finDiaLocalISO } from '../../lib/fechas'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { Spinner } from '../../components/ui/Spinner'
import { ExportarExcelButton } from '../../components/ui/ExportarExcelButton'
import { ComprobanteUploadField } from '../../components/ui/ComprobanteUploadField'
import { MontoInput } from '../../components/ui/MontoInput'
import { CargandoPantalla } from '../../components/ui/CargandoPantalla'
import { useConfirm } from '../../components/ui/ConfirmDialog'

const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'deuna', 'otro']

type Periodo = 'mes' | 'anio' | 'todo' | 'personalizado'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'mes', label: 'Este mes' },
  { value: 'anio', label: 'Este año' },
  { value: 'todo', label: 'Todo' },
]

function aInputFechaLocal(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate(),
  ).padStart(2, '0')}`
}

function rangoDelPeriodo(periodo: Periodo): { desde: string; hasta: string } {
  const hoy = new Date()
  if (periodo === 'anio') {
    return { desde: `${hoy.getFullYear()}-01-01`, hasta: aInputFechaLocal(hoy) }
  }
  if (periodo === 'todo') {
    return { desde: '2000-01-01', hasta: aInputFechaLocal(hoy) }
  }
  return {
    desde: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`,
    hasta: aInputFechaLocal(hoy),
  }
}

interface Categoria {
  id: string
  tipo: 'ingreso' | 'egreso'
  nombre: string
}

interface ClienteBasico {
  id: string
  nombre: string
}

interface Movimiento {
  id: string
  tipo: 'ingreso' | 'egreso'
  categoriaId: string
  monto: string
  fecha: string
  descripcion: string | null
  metodoPago: string | null
  numeroComprobante: string | null
  comprobanteUrl: string | null
  clienteId: string | null
  categoria: Categoria
  cliente: ClienteBasico | null
  usuario: { id: string; nombre: string }
}

interface Resumen {
  totalIngresos: number
  totalEgresos: number
  balance: number
  porMes: { mes: string; ingresos: number; egresos: number }[]
  porCategoria: { categoriaId: string; nombre: string; tipo: string; total: number }[]
}

interface FormularioMovimiento {
  id: string | null
  tipo: 'ingreso' | 'egreso'
  categoriaId: string
  monto: number
  fecha: string
  descripcion: string
  metodoPago: string
  numeroComprobante: string
  comprobanteUrl: string
  clienteId: string
}

function aInputFecha(fechaISO: string) {
  return fechaISO.slice(0, 10)
}

function mensajeError(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  )
}

function formatoMoneda(monto: number) {
  return `$${monto.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function CuentasPage() {
  const { data: identity } = useGetIdentity<Identity>()
  const ability = useMemo(() => buildAbility(identity?.permisos ?? []), [identity?.permisos])
  const puedeEditar = ability.can('cuentas.actualizar', 'all')

  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargando, setCargando] = useState(true)

  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCategoriaId, setFiltroCategoriaId] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const rangoInicial = rangoDelPeriodo('mes')
  const [desde, setDesde] = useState(rangoInicial.desde)
  const [hasta, setHasta] = useState(rangoInicial.hasta)

  const elegirPeriodo = (p: Periodo) => {
    setPeriodo(p)
    const rango = rangoDelPeriodo(p)
    setDesde(rango.desde)
    setHasta(rango.hasta)
  }

  const [form, setForm] = useState<FormularioMovimiento | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [nombreNuevaCategoria, setNombreNuevaCategoria] = useState('')
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const { confirmar, dialog } = useConfirm()

  const cargarCategorias = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get<Categoria[]>('/categorias-movimiento')
      setCategorias(data)
    } catch {
      toast.error('No se pudieron cargar las categorías')
    }
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = {
        desde: desde ? inicioDiaLocalISO(desde) : undefined,
        hasta: hasta ? finDiaLocalISO(hasta) : undefined,
      }
      const [r, m] = await Promise.all([
        axiosInstance.get<Resumen>('/cuentas/resumen', { params }),
        axiosInstance.get<Movimiento[]>('/cuentas', {
          params: { ...params, tipo: filtroTipo || undefined, categoriaId: filtroCategoriaId || undefined },
        }),
      ])
      setResumen(r.data)
      setMovimientos(m.data)
    } catch {
      toast.error('No se pudo cargar la información de cuentas')
    } finally {
      setCargando(false)
    }
  }, [desde, hasta, filtroTipo, filtroCategoriaId])

  useEffect(() => {
    cargarCategorias()
  }, [cargarCategorias])

  useEffect(() => {
    cargar()
  }, [cargar])

  const categoriasDelTipo = useMemo(
    () => (tipo: 'ingreso' | 'egreso') => categorias.filter((c) => c.tipo === tipo),
    [categorias],
  )

  const maxCategoria = useMemo(
    () => Math.max(1, ...(resumen?.porCategoria.map((c) => c.total) ?? [1])),
    [resumen],
  )

  const abrirCreacion = () => {
    const primeraCategoria = categoriasDelTipo('ingreso')[0]
    setForm({
      id: null,
      tipo: 'ingreso',
      categoriaId: primeraCategoria?.id ?? '',
      monto: 0,
      fecha: aInputFechaLocal(new Date()),
      descripcion: '',
      metodoPago: METODOS_PAGO[0],
      numeroComprobante: '',
      comprobanteUrl: '',
      clienteId: '',
    })
  }

  const abrirEdicion = (m: Movimiento) => {
    setForm({
      id: m.id,
      tipo: m.tipo,
      categoriaId: m.categoriaId,
      monto: Number(m.monto),
      fecha: aInputFecha(m.fecha),
      descripcion: m.descripcion ?? '',
      metodoPago: m.metodoPago ?? METODOS_PAGO[0],
      numeroComprobante: m.numeroComprobante ?? '',
      comprobanteUrl: m.comprobanteUrl ?? '',
      clienteId: m.clienteId ?? '',
    })
  }

  const cambiarTipoForm = (tipo: 'ingreso' | 'egreso') => {
    const primeraCategoria = categoriasDelTipo(tipo)[0]
    setForm((prev) => (prev ? { ...prev, tipo, categoriaId: primeraCategoria?.id ?? '' } : prev))
  }

  const crearCategoriaRapida = async () => {
    if (!form || !nombreNuevaCategoria.trim()) return
    setCreandoCategoria(true)
    try {
      const { data } = await axiosInstance.post<Categoria>('/categorias-movimiento', {
        tipo: form.tipo,
        nombre: nombreNuevaCategoria,
      })
      setNombreNuevaCategoria('')
      await cargarCategorias()
      setForm((prev) => (prev ? { ...prev, categoriaId: data.id } : prev))
      toast.success('Categoría creada')
    } catch {
      toast.error('No se pudo crear la categoría')
    } finally {
      setCreandoCategoria(false)
    }
  }

  const guardar = async () => {
    if (!form || !form.categoriaId || form.monto <= 0) return
    setGuardando(true)
    try {
      const payload = {
        tipo: form.tipo,
        categoriaId: form.categoriaId,
        monto: form.monto,
        fecha: inicioDiaLocalISO(form.fecha),
        descripcion: form.descripcion || undefined,
        metodoPago: form.metodoPago || undefined,
        numeroComprobante: form.numeroComprobante || undefined,
        comprobanteUrl: form.comprobanteUrl || undefined,
        clienteId: form.clienteId || undefined,
      }

      if (form.id) {
        await axiosInstance.patch(`/cuentas/${form.id}`, payload)
        toast.success('Movimiento actualizado')
      } else {
        await axiosInstance.post('/cuentas', payload)
        toast.success('Movimiento registrado')
      }
      setForm(null)
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo guardar el movimiento'))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!form?.id) return
    const confirmado = await confirmar(
      'Eliminar movimiento',
      '¿Seguro que quieres eliminarlo? Esta acción no se puede deshacer.',
    )
    if (!confirmado) return

    setGuardando(true)
    try {
      await axiosInstance.delete(`/cuentas/${form.id}`)
      toast.success('Movimiento eliminado')
      setForm(null)
      await cargar()
    } catch {
      toast.error('No se pudo eliminar el movimiento')
    } finally {
      setGuardando(false)
    }
  }

  const filasCSV = movimientos.map((m) => ({
    tipo: m.tipo,
    categoria: m.categoria.nombre,
    monto: m.monto,
    fecha: new Date(m.fecha).toLocaleDateString(),
    descripcion: m.descripcion ?? '',
    metodoPago: m.metodoPago ?? '',
    numeroComprobante: m.numeroComprobante ?? '',
    cliente: m.cliente?.nombre ?? '',
    registradoPor: m.usuario.nombre,
  }))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Cuentas</h1>
        <CanAccess resource="cuentas" action="create">
          <PrimaryButton type="button" onClick={abrirCreacion} className="flex items-center gap-2">
            <Plus size={16} />
            Registrar movimiento
          </PrimaryButton>
        </CanAccess>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Ingresos y egresos de tu negocio, con foto o PDF del comprobante cuando lo necesites.
      </p>

      <div className="mt-4 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1 w-fit">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => elegirPeriodo(p.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              periodo === p.value
                ? 'bg-[var(--color-primario)] text-[var(--color-primario-texto)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPeriodo('personalizado')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            periodo === 'personalizado'
              ? 'bg-[var(--color-primario)] text-[var(--color-primario-texto)]'
              : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'
          }`}
        >
          Personalizado
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setPeriodo('personalizado')
              setDesde(e.target.value)
            }}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => {
              setPeriodo('personalizado')
              setHasta(e.target.value)
            }}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
            Categoría
          </label>
          <select
            value={filtroCategoriaId}
            onChange={(e) => setFiltroCategoriaId(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        {cargando && <Spinner size={18} className="text-[var(--color-text-muted)]" />}
      </div>

      {resumen && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
              <p className="text-sm text-[var(--color-text-muted)]">Ingresos</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-serie-ingreso)]">
                {formatoMoneda(resumen.totalIngresos)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
              <p className="text-sm text-[var(--color-text-muted)]">Egresos</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-serie-egreso)]">
                {formatoMoneda(resumen.totalEgresos)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
              <p className="text-sm text-[var(--color-text-muted)]">Balance</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  resumen.balance >= 0 ? 'text-emerald-600' : 'text-[var(--color-serie-egreso)]'
                }`}
              >
                {resumen.balance >= 0 ? '▲ ' : '▼ '}
                {formatoMoneda(resumen.balance)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Ingresos vs egresos por mes</h2>
              <div className="mt-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resumen.porMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                      axisLine={{ stroke: 'var(--color-border)' }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => formatoMoneda(Number(value))}
                      contentStyle={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        color: 'var(--color-text)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="var(--color-serie-ingreso)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="egresos" name="Egresos" fill="var(--color-serie-egreso)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {resumen.porMes.length === 0 && (
                <p className="text-center text-sm text-[var(--color-text-faint)]">
                  Sin movimientos en este rango
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)] p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Por categoría</h2>
              <div className="mt-3 flex flex-col gap-2">
                {resumen.porCategoria.map((c) => (
                  <div key={c.categoriaId}>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text)]">{c.nombre}</span>
                      <span className="text-[var(--color-text-muted)]">{formatoMoneda(c.total)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded bg-[var(--color-bg-subtle)]">
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${(c.total / maxCategoria) * 100}%`,
                          backgroundColor:
                            c.tipo === 'ingreso' ? 'var(--color-serie-ingreso)' : 'var(--color-serie-egreso)',
                        }}
                      />
                    </div>
                  </div>
                ))}
                {resumen.porCategoria.length === 0 && (
                  <p className="text-sm text-[var(--color-text-faint)]">Sin movimientos en este rango</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Movimientos</h2>
        <ExportarExcelButton nombreArchivo="cuentas.csv" filas={filasCSV} />
      </div>

      <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Categoría</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Monto</th>
              <th className="px-4 py-2">Comprobante</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr
                key={m.id}
                onClick={puedeEditar ? () => abrirEdicion(m) : undefined}
                className={`border-t border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] ${
                  puedeEditar ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-4 py-2 text-[var(--color-text-muted)]">
                  {new Date(m.fecha).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      color: m.tipo === 'ingreso' ? 'var(--color-serie-ingreso)' : 'var(--color-serie-egreso)',
                      backgroundColor:
                        m.tipo === 'ingreso' ? 'rgba(42,120,214,0.12)' : 'rgba(227,73,72,0.12)',
                    }}
                  >
                    {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                  </span>
                </td>
                <td className="px-4 py-2">{m.categoria.nombre}</td>
                <td className="px-4 py-2 text-[var(--color-text-muted)]">
                  {m.descripcion ?? '—'}
                </td>
                <td className="px-4 py-2 font-medium">{formatoMoneda(Number(m.monto))}</td>
                <td className="px-4 py-2">
                  {m.comprobanteUrl ? (
                    <a
                      href={m.comprobanteUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--color-primario-legible)] hover:underline"
                    >
                      Ver
                    </a>
                  ) : (
                    <span className="text-[var(--color-text-faint)]">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-xs text-[var(--color-text-faint)]">
                  Editar
                </td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-faint)]">
                  {cargando ? <CargandoPantalla minHeight={80} /> : 'Sin movimientos en este rango'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-[var(--color-bg-card)] p-6 shadow-lg">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              {form.id ? 'Editar movimiento' : 'Nuevo movimiento'}
            </h2>

            <div className="mt-4 flex flex-col gap-3">
              {!form.id && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cambiarTipoForm('ingreso')}
                    className={`flex-1 rounded border px-3 py-2 text-sm ${
                      form.tipo === 'ingreso'
                        ? 'border-[var(--color-serie-ingreso)] bg-[var(--color-bg-subtle)] text-[var(--color-text)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    Ingreso
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarTipoForm('egreso')}
                    className={`flex-1 rounded border px-3 py-2 text-sm ${
                      form.tipo === 'egreso'
                        ? 'border-[var(--color-serie-egreso)] bg-[var(--color-bg-subtle)] text-[var(--color-text)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    Egreso
                  </button>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  Categoría
                </label>
                <div className="flex gap-2">
                  <select
                    value={form.categoriaId}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, categoriaId: e.target.value } : prev))}
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  >
                    <option value="">Selecciona…</option>
                    {categoriasDelTipo(form.tipo).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <CanAccess resource="cuentas" action="create">
                  <div className="mt-2 flex gap-2">
                    <input
                      value={nombreNuevaCategoria}
                      onChange={(e) => setNombreNuevaCategoria(e.target.value)}
                      placeholder="Nueva categoría…"
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs focus:border-[var(--color-primario)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={crearCategoriaRapida}
                      disabled={creandoCategoria || !nombreNuevaCategoria.trim()}
                      className="shrink-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  </div>
                </CanAccess>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Monto</label>
                  <MontoInput
                    value={form.monto}
                    onChange={(monto) => setForm((prev) => (prev ? { ...prev, monto } : prev))}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, fecha: e.target.value } : prev))}
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  Descripción
                </label>
                <input
                  value={form.descripcion}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, descripcion: e.target.value } : prev))}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    Método de pago
                  </label>
                  <select
                    value={form.metodoPago}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, metodoPago: e.target.value } : prev))}
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  >
                    {METODOS_PAGO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                    N° comprobante
                  </label>
                  <input
                    value={form.numeroComprobante}
                    onChange={(e) =>
                      setForm((prev) => (prev ? { ...prev, numeroComprobante: e.target.value } : prev))
                    }
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  />
                </div>
              </div>

              <ComprobanteUploadField
                value={form.comprobanteUrl}
                onChange={(url) => setForm((prev) => (prev ? { ...prev, comprobanteUrl: url } : prev))}
              />
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              {form.id ? (
                <CanAccess resource="cuentas" action="delete">
                  <button
                    type="button"
                    onClick={eliminar}
                    disabled={guardando}
                    className="flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {guardando && <Spinner size={14} />}
                    Eliminar
                  </button>
                </CanAccess>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
                >
                  Cancelar
                </button>
                <CanAccess resource="cuentas" action={form.id ? 'edit' : 'create'}>
                  <PrimaryButton
                    type="button"
                    onClick={guardar}
                    disabled={guardando || !form.categoriaId || form.monto <= 0}
                    className="flex items-center gap-2"
                  >
                    {guardando && <Spinner size={14} />}
                    {guardando ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Registrar'}
                  </PrimaryButton>
                </CanAccess>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog}
    </div>
  )
}
