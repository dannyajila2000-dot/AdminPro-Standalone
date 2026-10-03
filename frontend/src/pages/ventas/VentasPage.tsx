import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { Trash2, ShoppingCart, Plus, Minus, Receipt } from 'lucide-react'
import { CanAccess, useGetIdentity } from '@refinedev/core'
import type { Identity } from '../../lib/identity'
import { axiosInstance } from '../../lib/axios'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { Spinner } from '../../components/ui/Spinner'
import { CargandoPantalla } from '../../components/ui/CargandoPantalla'
import { SelectorCliente } from '../../components/ui/SelectorCliente'
import { ComprobanteUploadField } from '../../components/ui/ComprobanteUploadField'
import { useConfirm } from '../../components/ui/ConfirmDialog'

const METODOS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'deuna', 'otro']

function fechaHaceDias(dias: number) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - dias)
  return fecha.toISOString().slice(0, 10)
}

interface Producto {
  id: string
  tipo: string
  nombre: string
  sku: string | null
  precio: string
  stock: number | null
  stockMinimo: number | null
  unidadMedida: string
  imagenUrl: string | null
}

interface ClienteBasico {
  id: string
  nombre: string
  email?: string | null
  telefono?: string | null
}

interface CategoriaMovimiento {
  id: string
  nombre: string
}

interface ItemCarrito {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  stockDisponible: number | null
}

interface OrdenItem {
  id: string
  cantidad: number
  precioUnit: string
  producto: { id: string; nombre: string; sku: string | null }
}

interface Orden {
  id: string
  estado: string
  total: string
  descuento: string
  notas: string | null
  creadoEn: string
  cliente: ClienteBasico | null
  usuario: { id: string; nombre: string }
  items: OrdenItem[]
  movimientosCuenta: { metodoPago: string | null; numeroComprobante: string | null }[]
}

function mensajeError(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  )
}

export function VentasPage() {
  const { confirmar, dialog } = useConfirm()
  const { data: identity } = useGetIdentity<Identity>()

  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<ClienteBasico[]>([])
  const [categoriasIngreso, setCategoriasIngreso] = useState<CategoriaMovimiento[]>([])
  const [ventas, setVentas] = useState<Orden[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoVentas, setCargandoVentas] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [clienteId, setClienteId] = useState('')
  const [categoriaIngresoId, setCategoriaIngresoId] = useState('')
  const [metodoPago, setMetodoPago] = useState(METODOS_PAGO[0])
  const [numeroComprobante, setNumeroComprobante] = useState('')
  const [comprobanteUrl, setComprobanteUrl] = useState('')
  const [notas, setNotas] = useState('')
  const [descuentoTipo, setDescuentoTipo] = useState<'porcentaje' | 'monto'>('porcentaje')
  const [descuentoValor, setDescuentoValor] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [guardandoEnEspera, setGuardandoEnEspera] = useState(false)

  const [modalConfirmar, setModalConfirmar] = useState<Orden | null>(null)
  const [confirmCategoriaIngresoId, setConfirmCategoriaIngresoId] = useState('')
  const [confirmMetodoPago, setConfirmMetodoPago] = useState(METODOS_PAGO[0])
  const [confirmNumeroComprobante, setConfirmNumeroComprobante] = useState('')
  const [confirmComprobanteUrl, setConfirmComprobanteUrl] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  const [filtroDesde, setFiltroDesde] = useState(fechaHaceDias(30))
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroTextoVentas, setFiltroTextoVentas] = useState('')

  const cargarVentas = (desde?: string, hasta?: string) =>
    axiosInstance
      .get<Orden[]>('/ventas', { params: { desde: desde || undefined, hasta: hasta || undefined } })
      .then(({ data }) => setVentas(data))

  const cargarProductos = () =>
    axiosInstance.get<Producto[]>('/productos').then(({ data }) => setProductos(data))

  useEffect(() => {
    setCargando(true)
    Promise.all([
      cargarProductos(),
      axiosInstance.get<ClienteBasico[]>('/clientes').then(({ data }) => setClientes(data)),
      axiosInstance
        .get<CategoriaMovimiento[]>('/categorias-movimiento', { params: { tipo: 'ingreso' } })
        .then(({ data }) => setCategoriasIngreso(data))
        .catch(() => {
          /* módulo Cuentas puede no estar activo */
        }),
    ])
      .catch(() => toast.error('No se pudo cargar la información'))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setCargandoVentas(true)
    cargarVentas(filtroDesde, filtroHasta)
      .catch(() => toast.error('No se pudieron cargar las ventas'))
      .finally(() => setCargandoVentas(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDesde, filtroHasta])

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter(
      (p) => p.nombre.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q),
    )
  }, [busqueda, productos])

  const ventasFiltradas = useMemo(() => {
    const q = filtroTextoVentas.trim().toLowerCase()
    if (!q) return ventas
    return ventas.filter(
      (v) =>
        (v.cliente?.nombre.toLowerCase().includes(q) ?? false) ||
        v.usuario.nombre.toLowerCase().includes(q) ||
        v.items.some((item) => item.producto.nombre.toLowerCase().includes(q)),
    )
  }, [filtroTextoVentas, ventas])

  const agregarAlCarrito = (producto: Producto) => {
    setCarrito((prev) => {
      const existente = prev.find((item) => item.productoId === producto.id)
      if (existente) {
        if (existente.stockDisponible != null && existente.cantidad >= existente.stockDisponible) {
          toast.error('No hay más stock disponible de este producto')
          return prev
        }
        return prev.map((item) =>
          item.productoId === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item,
        )
      }
      return [
        ...prev,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: Number(producto.precio),
          cantidad: 1,
          stockDisponible: producto.stock,
        },
      ]
    })
  }

  const cambiarCantidad = (productoId: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.productoId !== productoId) return item
          const nuevaCantidad = item.cantidad + delta
          if (item.stockDisponible != null && nuevaCantidad > item.stockDisponible) {
            toast.error('No hay más stock disponible de este producto')
            return item
          }
          return { ...item, cantidad: nuevaCantidad }
        })
        .filter((item) => item.cantidad > 0),
    )
  }

  const setCantidadExacta = (productoId: string, valor: number) => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.productoId !== productoId) return item
        if (!Number.isFinite(valor) || valor < 1) return item
        if (item.stockDisponible != null && valor > item.stockDisponible) {
          toast.error(`No hay más stock disponible: solo hay ${item.stockDisponible}`)
          return { ...item, cantidad: item.stockDisponible }
        }
        return { ...item, cantidad: Math.floor(valor) }
      }),
    )
  }

  const quitarDelCarrito = (productoId: string) => {
    setCarrito((prev) => prev.filter((item) => item.productoId !== productoId))
  }

  const vaciarCarrito = () => setCarrito([])

  const buscarPorEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const q = busqueda.trim().toLowerCase()
    if (!q) return
    const coincidencia = productos.find((p) => p.sku?.toLowerCase() === q)
    if (!coincidencia) return
    agregarAlCarrito(coincidencia)
    setBusqueda('')
  }

  const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0)
  const descuentoNumero = Number(descuentoValor) || 0
  const descuentoCalculado = Math.min(
    Math.max(descuentoTipo === 'porcentaje' ? subtotal * (descuentoNumero / 100) : descuentoNumero, 0),
    subtotal,
  )
  const total = subtotal - descuentoCalculado

  const limpiarVenta = () => {
    setCarrito([])
    setClienteId('')
    setCategoriaIngresoId('')
    setMetodoPago(METODOS_PAGO[0])
    setNumeroComprobante('')
    setComprobanteUrl('')
    setDescuentoTipo('porcentaje')
    setDescuentoValor('')
    setNotas('')
  }

  const registrarVenta = async (enEspera: boolean) => {
    if (carrito.length === 0) return
    const setLoading = enEspera ? setGuardandoEnEspera : setRegistrando
    setLoading(true)
    try {
      await axiosInstance.post('/ventas', {
        clienteId: clienteId || undefined,
        notas: notas || undefined,
        categoriaIngresoId: categoriaIngresoId || undefined,
        metodoPago: categoriaIngresoId ? metodoPago : undefined,
        numeroComprobante: categoriaIngresoId ? numeroComprobante || undefined : undefined,
        comprobanteUrl: categoriaIngresoId ? comprobanteUrl || undefined : undefined,
        descuento: descuentoCalculado || undefined,
        enEspera,
        items: carrito.map((item) => ({ productoId: item.productoId, cantidad: item.cantidad })),
      })
      toast.success(enEspera ? 'Venta guardada en espera' : 'Venta registrada')
      limpiarVenta()
      await Promise.all([cargarProductos(), cargarVentas(filtroDesde, filtroHasta)])
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo registrar la venta'))
    } finally {
      setLoading(false)
    }
  }

  const abrirConfirmar = (orden: Orden) => {
    setModalConfirmar(orden)
    setConfirmCategoriaIngresoId('')
    setConfirmMetodoPago(METODOS_PAGO[0])
    setConfirmNumeroComprobante('')
    setConfirmComprobanteUrl('')
  }

  const confirmarVentaPendiente = async () => {
    if (!modalConfirmar) return
    setConfirmando(true)
    try {
      await axiosInstance.post(`/ventas/${modalConfirmar.id}/confirmar`, {
        categoriaIngresoId: confirmCategoriaIngresoId || undefined,
        metodoPago: confirmCategoriaIngresoId ? confirmMetodoPago : undefined,
        numeroComprobante: confirmCategoriaIngresoId ? confirmNumeroComprobante || undefined : undefined,
        comprobanteUrl: confirmCategoriaIngresoId ? confirmComprobanteUrl || undefined : undefined,
      })
      toast.success('Venta confirmada — stock descontado')
      setModalConfirmar(null)
      await Promise.all([cargarProductos(), cargarVentas(filtroDesde, filtroHasta)])
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo confirmar la venta'))
    } finally {
      setConfirmando(false)
    }
  }

  const eliminarVenta = async (orden: Orden) => {
    const esPendiente = orden.estado === 'pendiente'
    const confirmado = await confirmar(
      esPendiente ? 'Cancelar venta en espera' : 'Eliminar venta',
      esPendiente
        ? '¿Cancelar esta venta en espera? No se llegó a descontar stock, así que solo se borra el registro.'
        : `¿Eliminar esta venta de $${Number(orden.total).toFixed(2)}? Se revertirá el stock descontado.`,
      esPendiente ? 'Cancelar venta' : 'Eliminar',
    )
    if (!confirmado) return
    try {
      await axiosInstance.delete(`/ventas/${orden.id}`)
      toast.success(esPendiente ? 'Venta en espera cancelada' : 'Venta eliminada y stock revertido')
      await Promise.all([cargarProductos(), cargarVentas(filtroDesde, filtroHasta)])
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo eliminar la venta'))
    }
  }

  const imprimirRecibo = (orden: Orden) => {
    const ventana = window.open('', '_blank', 'width=380,height=600')
    if (!ventana) return
    const metodoPagoOrden = orden.movimientosCuenta[0]?.metodoPago
    const subtotalOrden = orden.items.reduce(
      (suma, item) => suma + item.cantidad * Number(item.precioUnit),
      0,
    )
    const descuentoOrden = Number(orden.descuento)
    const filas = orden.items
      .map(
        (item) =>
          `<tr><td>${item.cantidad}× ${item.producto.nombre}</td><td style="text-align:right">$${(
            item.cantidad * Number(item.precioUnit)
          ).toFixed(2)}</td></tr>`,
      )
      .join('')
    const empresa = identity?.empresa
    ventana.document.write(`<!doctype html>
<html><head><title>Recibo</title><style>
  body { font-family: monospace; padding: 16px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { margin: 2px 0; font-size: 12px; }
  .encabezado { border-bottom: 1px dashed #111; padding-bottom: 8px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  td { padding: 3px 0; }
  .fila { display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px; }
  .total { border-top: 1px dashed #111; margin-top: 8px; padding-top: 6px; font-weight: bold; display: flex; justify-content: space-between; }
</style></head><body>
  ${
    empresa
      ? `<div class="encabezado">
    <h1>${empresa.razonSocial || empresa.nombre}</h1>
    ${empresa.ruc ? `<p>RUC: ${empresa.ruc}</p>` : ''}
    ${empresa.direccion ? `<p>${empresa.direccion}</p>` : ''}
    ${empresa.telefono ? `<p>Tel: ${empresa.telefono}</p>` : ''}
  </div>`
      : '<h1>Recibo de venta</h1>'
  }
  <p>${new Date(orden.creadoEn).toLocaleString()}</p>
  <p>Cliente: ${orden.cliente?.nombre ?? 'Sin cliente'}</p>
  <p>Vendedor: ${orden.usuario.nombre}</p>
  ${metodoPagoOrden ? `<p>Método de pago: ${metodoPagoOrden}</p>` : ''}
  <table>${filas}</table>
  ${
    descuentoOrden > 0
      ? `<div class="fila"><span>Subtotal</span><span>$${subtotalOrden.toFixed(2)}</span></div>
  <div class="fila"><span>Descuento</span><span>-$${descuentoOrden.toFixed(2)}</span></div>`
      : ''
  }
  <div class="total"><span>Total</span><span>$${Number(orden.total).toFixed(2)}</span></div>
  ${orden.notas ? `<p style="margin-top:8px">Notas: ${orden.notas}</p>` : ''}
</body></html>`)
    ventana.document.close()
    ventana.focus()
    ventana.print()
  }

  if (cargando) {
    return <CargandoPantalla minHeight={300} />
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--color-text)]">Ventas</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Punto de venta: agrega productos al carrito, confirma y el stock se descuenta
        automáticamente.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={buscarPorEnter}
            placeholder="Buscar producto por nombre o SKU… (Enter con SKU exacto lo agrega directo)"
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          />

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productosFiltrados.map((producto) => {
              const esServicio = producto.tipo === 'servicio'
              const sinStock = !esServicio && (producto.stock ?? 0) <= 0
              const stockBajo =
                !esServicio &&
                !sinStock &&
                producto.stockMinimo != null &&
                (producto.stock ?? 0) <= producto.stockMinimo
              return (
                <button
                  key={producto.id}
                  type="button"
                  disabled={sinStock}
                  onClick={() => agregarAlCarrito(producto)}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-left shadow-[var(--sombra-sm)] transition hover:border-[var(--color-primario)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {producto.imagenUrl ? (
                    <img
                      src={producto.imagenUrl}
                      alt=""
                      className="mb-2 h-20 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-2 h-20 w-full rounded-lg bg-[var(--color-bg)]" />
                  )}
                  <p className="text-sm font-medium text-[var(--color-text)]">{producto.nombre}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    ${Number(producto.precio).toFixed(2)}
                    {!esServicio && (
                      <>
                        {' '}
                        ·{' '}
                        <span className={stockBajo ? 'font-medium text-amber-600' : undefined}>
                          stock {producto.stock ?? 0} {producto.unidadMedida}
                        </span>
                      </>
                    )}
                  </p>
                </button>
              )
            })}
            {productosFiltrados.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-[var(--color-text-faint)]">
                Sin productos
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--sombra-sm)]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <ShoppingCart size={16} />
              Carrito
              {carrito.length > 0 && (
                <span className="rounded-full bg-[var(--color-primario)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-primario-texto)]">
                  {carrito.reduce((suma, item) => suma + item.cantidad, 0)}
                </span>
              )}
            </h2>
            {carrito.length > 0 && (
              <button
                type="button"
                onClick={vaciarCarrito}
                className="text-xs text-[var(--color-text-muted)] hover:underline"
              >
                Vaciar
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {carrito.length === 0 && (
              <p className="py-4 text-center text-sm text-[var(--color-text-faint)]">
                Agrega productos desde la izquierda
              </p>
            )}
            {carrito.map((item) => (
              <div
                key={item.productoId}
                className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-medium text-[var(--color-text)]">{item.nombre}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    ${item.precio.toFixed(2)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(item.productoId, -1)}
                    className="rounded border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-subtle)]"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={item.stockDisponible ?? undefined}
                    value={item.cantidad}
                    onChange={(e) => setCantidadExacta(item.productoId, Number(e.target.value))}
                    className="w-14 rounded border border-[var(--color-border)] px-1 py-0.5 text-center text-sm focus:border-[var(--color-primario)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(item.productoId, 1)}
                    className="rounded border border-[var(--color-border)] p-1 hover:bg-[var(--color-bg-subtle)]"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => quitarDelCarrito(item.productoId)}
                    className="ml-1 rounded p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {clientes.length > 0 && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
                Cliente (opcional)
              </label>
              <SelectorCliente
                clientes={clientes}
                value={clienteId}
                onChange={setClienteId}
                opcionSinCliente="Sin cliente"
              />
            </div>
          )}

          {categoriasIngreso.length > 0 && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
                Registrar como ingreso en Cuentas (opcional)
              </label>
              <select
                value={categoriaIngresoId}
                onChange={(e) => setCategoriaIngresoId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
              >
                <option value="">No registrar</option>
                {categoriasIngreso.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              {categoriaIngresoId && (
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
                      Método de pago
                    </label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                    >
                      {METODOS_PAGO.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
                      N° de comprobante (opcional)
                    </label>
                    <input
                      value={numeroComprobante}
                      onChange={(e) => setNumeroComprobante(e.target.value)}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                    />
                  </div>
                  <ComprobanteUploadField value={comprobanteUrl} onChange={setComprobanteUrl} />
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
              Notas (opcional)
            </label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
          </div>

          {carrito.length > 0 && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">
                Descuento (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={descuentoValor}
                  onChange={(e) => setDescuentoValor(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                />
                <select
                  value={descuentoTipo}
                  onChange={(e) => setDescuentoTipo(e.target.value as typeof descuentoTipo)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                >
                  <option value="porcentaje">%</option>
                  <option value="monto">$</option>
                </select>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-1 text-sm">
            {descuentoCalculado > 0 && (
              <>
                <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                  <span>Descuento</span>
                  <span>-${descuentoCalculado.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between font-semibold text-[var(--color-text)]">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <CanAccess resource="ventas" action="create">
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => registrarVenta(true)}
                disabled={guardandoEnEspera || registrando || carrito.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] disabled:opacity-50"
              >
                {guardandoEnEspera && <Spinner size={14} />}
                {guardandoEnEspera ? 'Guardando…' : 'Guardar en espera'}
              </button>
              <PrimaryButton
                type="button"
                onClick={() => registrarVenta(false)}
                disabled={registrando || guardandoEnEspera || carrito.length === 0}
                className="flex flex-1 items-center justify-center gap-2"
              >
                {registrando && <Spinner size={14} />}
                {registrando ? 'Registrando…' : 'Registrar venta'}
              </PrimaryButton>
            </div>
          </CanAccess>
        </div>
      </div>

      <h2 className="mt-8 text-base font-semibold text-[var(--color-text)]">Ventas recientes</h2>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">Desde</label>
          <input
            type="date"
            value={filtroDesde}
            onChange={(e) => setFiltroDesde(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text)]">Hasta</label>
          <input
            type="date"
            value={filtroHasta}
            onChange={(e) => setFiltroHasta(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
          />
        </div>
        <input
          value={filtroTextoVentas}
          onChange={(e) => setFiltroTextoVentas(e.target.value)}
          placeholder="Buscar por cliente, vendedor o producto…"
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primario)] focus:outline-none"
        />
      </div>

      <div className="relative mt-2 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--sombra-sm)]">
        {cargandoVentas && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-bg-card)]/70 text-sm text-[var(--color-text-muted)]">
            <Spinner size={18} />
            Actualizando…
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Vendedor</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {ventasFiltradas.map((orden) => {
              const esPendiente = orden.estado === 'pendiente'
              return (
                <tr key={orden.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2">{new Date(orden.creadoEn).toLocaleString()}</td>
                  <td className="px-4 py-2">{orden.cliente?.nombre ?? '—'}</td>
                  <td className="px-4 py-2 text-[var(--color-text-muted)]">
                    {orden.items.map((item) => `${item.cantidad}× ${item.producto.nombre}`).join(', ')}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-text-muted)]">{orden.usuario.nombre}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        esPendiente
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {esPendiente ? 'En espera' : 'Completada'}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium">${Number(orden.total).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {esPendiente ? (
                        <CanAccess resource="ventas" action="create">
                          <button
                            type="button"
                            onClick={() => abrirConfirmar(orden)}
                            className="rounded px-2 py-1 text-xs text-[var(--color-primario-legible)] hover:bg-[var(--color-bg-subtle)]"
                          >
                            Confirmar
                          </button>
                        </CanAccess>
                      ) : (
                        <button
                          type="button"
                          onClick={() => imprimirRecibo(orden)}
                          title="Imprimir recibo"
                          className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)]"
                        >
                          <Receipt size={14} />
                        </button>
                      )}
                      <CanAccess resource="ventas" action="delete">
                        <button
                          type="button"
                          onClick={() => eliminarVenta(orden)}
                          title={esPendiente ? 'Cancelar venta en espera' : 'Eliminar'}
                          className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </CanAccess>
                    </div>
                  </td>
                </tr>
              )
            })}
            {ventasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-faint)]">
                  {cargandoVentas ? (
                    <CargandoPantalla minHeight={80} />
                  ) : filtroTextoVentas ? (
                    'Sin resultados para tu búsqueda'
                  ) : (
                    'Sin ventas en este rango de fechas'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalConfirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-lg bg-[var(--color-bg-card)] p-6 shadow-lg">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              Confirmar venta en espera
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Se descontará el stock ahora mismo — ${Number(modalConfirmar.total).toFixed(2)},{' '}
              {modalConfirmar.items.length} producto(s).
            </p>

            {categoriasIngreso.length > 0 && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                  Registrar como ingreso en Cuentas (opcional)
                </label>
                <select
                  value={confirmCategoriaIngresoId}
                  onChange={(e) => setConfirmCategoriaIngresoId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                >
                  <option value="">No registrar</option>
                  {categoriasIngreso.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>

                {confirmCategoriaIngresoId && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                        Método de pago
                      </label>
                      <select
                        value={confirmMetodoPago}
                        onChange={(e) => setConfirmMetodoPago(e.target.value)}
                        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                      >
                        {METODOS_PAGO.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                        N° de comprobante (opcional)
                      </label>
                      <input
                        value={confirmNumeroComprobante}
                        onChange={(e) => setConfirmNumeroComprobante(e.target.value)}
                        className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
                      />
                    </div>
                    <ComprobanteUploadField
                      value={confirmComprobanteUrl}
                      onChange={setConfirmComprobanteUrl}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalConfirmar(null)}
                className="rounded px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
              >
                Cancelar
              </button>
              <PrimaryButton
                type="button"
                onClick={confirmarVentaPendiente}
                disabled={confirmando}
                className="flex items-center gap-2"
              >
                {confirmando && <Spinner size={14} />}
                {confirmando ? 'Confirmando…' : 'Confirmar venta'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {dialog}
    </div>
  )
}
