import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, MessageCircle, Smartphone } from 'lucide-react'
import { CanAccess } from '@refinedev/core'
import { axiosInstance } from '../../lib/axios'
import { PrimaryButton } from './PrimaryButton'
import { Spinner } from './Spinner'

type EstadoApp = 'sin_invitar' | 'invitado' | 'invitacion_vencida' | 'activada'

interface EstadoAppSocio {
  estado: EstadoApp
  integracionConfigurada: boolean
  tieneCorreo: boolean
  invitadoEn: string | null
  activadoEn: string | null
  codigoVenceEn: string | null
}

interface Invitacion {
  enviado: boolean
  codigo: string
  codigoGimnasio: string
  expiraEn: string
}

const ETIQUETA: Record<EstadoApp, { texto: string; clase: string }> = {
  sin_invitar: { texto: 'Sin invitar', clase: 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)]' },
  invitado: { texto: 'Invitado', clase: 'bg-amber-100 text-amber-700' },
  invitacion_vencida: { texto: 'Invitación vencida', clase: 'bg-red-100 text-red-700' },
  activada: { texto: 'Cuenta activa', clase: 'bg-emerald-100 text-emerald-700' },
}

/** 0991234567 -> 593991234567 (formato que pide wa.me); si ya trae el código de país, se respeta. */
function telefonoParaWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.startsWith('593')) return digitos
  if (digitos.startsWith('0') && digitos.length >= 9) return `593${digitos.slice(1)}`
  return digitos.length >= 9 ? digitos : null
}

function mensajeError(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}

interface Props {
  clienteId: string
  nombre: string
  email: string | null
  telefono: string | null
}

/** Estado del socio en la app móvil y botón para invitarlo. El código de activación se muestra aquí y se envía por correo. */
export function TarjetaAppSocio({ clienteId, nombre, email, telefono }: Props) {
  const [estado, setEstado] = useState<EstadoAppSocio | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [invitacion, setInvitacion] = useState<Invitacion | null>(null)

  const cargar = useCallback(
    () =>
      axiosInstance
        .get<EstadoAppSocio>(`/clientes/${clienteId}/app`)
        .then(({ data }) => setEstado(data))
        .catch(() => setEstado(null)),
    [clienteId],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInvitacion(null)
    void cargar()
  }, [cargar])

  const invitar = async () => {
    setEnviando(true)
    try {
      const { data } = await axiosInstance.post<Invitacion>(`/clientes/${clienteId}/invitar-app`)
      setInvitacion(data)
      toast.success(data.enviado ? `Invitación enviada a ${email}` : 'Código generado. No se pudo enviar el correo: compártelo tú.')
      await cargar()
    } catch (error) {
      toast.error(mensajeError(error, 'No se pudo invitar al socio'))
    } finally {
      setEnviando(false)
    }
  }

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  if (!estado) return null
  const etiqueta = ETIQUETA[estado.estado]
  const puedeInvitar = estado.estado !== 'activada' && estado.tieneCorreo && estado.integracionConfigurada

  const whatsapp = telefonoParaWhatsapp(telefono)
  const mensajeWhatsapp = invitacion
    ? `Hola ${nombre.split(' ')[0]}, te invitamos a usar nuestra app. Código del gimnasio: ${invitacion.codigoGimnasio}. Tu código de activación: ${invitacion.codigo}. Abre la app, toca "Activar mi cuenta" y escribe tu correo (${email}) con esos códigos.`
    : ''

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-[var(--sombra-sm)]">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Smartphone size={13} /> App del socio
        </p>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${etiqueta.clase}`}>{etiqueta.texto}</span>
      </div>

      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        {estado.estado === 'activada' && estado.activadoEn
          ? `Activó su cuenta el ${new Date(estado.activadoEn).toLocaleDateString()}`
          : estado.estado === 'invitado' && estado.codigoVenceEn
            ? `Su código vence el ${new Date(estado.codigoVenceEn).toLocaleDateString()}`
            : estado.estado === 'invitacion_vencida'
              ? 'El código venció: envía una invitación nueva.'
              : 'Aún no puede entrar a la app.'}
      </p>

      {!estado.integracionConfigurada && estado.estado !== 'activada' && (
        <p className="mt-2 text-xs text-amber-600">La conexión con la app aún no está configurada para esta empresa.</p>
      )}
      {estado.integracionConfigurada && !estado.tieneCorreo && estado.estado !== 'activada' && (
        <p className="mt-2 text-xs text-amber-600">Agrega un correo al socio para poder invitarlo.</p>
      )}

      <CanAccess resource="clientes" action="edit">
        {estado.estado !== 'activada' && (
          <PrimaryButton
            type="button"
            onClick={invitar}
            disabled={enviando || !puedeInvitar}
            className="mt-3 flex items-center gap-2"
          >
            {enviando && <Spinner size={14} />}
            {estado.estado === 'sin_invitar' ? 'Invitar a la app' : 'Enviar invitación nueva'}
          </PrimaryButton>
        )}
      </CanAccess>

      {invitacion && (
        <div className="mt-3 rounded-lg bg-[var(--color-primario-suave)] p-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            {invitacion.enviado ? `Enviamos el código a ${email}. También puedes compartirlo:` : 'No se pudo enviar el correo. Comparte este código con el socio:'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-[0.25em] text-[var(--color-text)]">{invitacion.codigo}</span>
            <button
              type="button"
              onClick={() => copiar(invitacion.codigo)}
              title="Copiar código"
              className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              <Copy size={16} />
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Código del gimnasio: <b className="text-[var(--color-text)]">{invitacion.codigoGimnasio}</b> · vence el{' '}
            {new Date(invitacion.expiraEn).toLocaleDateString()}
          </p>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensajeWhatsapp)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primario-legible)] hover:underline"
            >
              <MessageCircle size={14} /> Enviar por WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  )
}
