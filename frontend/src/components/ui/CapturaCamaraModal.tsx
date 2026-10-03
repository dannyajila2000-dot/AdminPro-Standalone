import { useEffect, useRef, useState } from 'react'
import { X, Camera } from 'lucide-react'

interface Props {
  onCapturar: (archivo: File) => void
  onCerrar: () => void
}

export function CapturaCamaraModal({ onCapturar, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.')
      })

    return () => {
      cancelado = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const capturar = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapturar(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-[var(--color-bg-card)] p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Tomar foto</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="mt-4 w-full rounded-lg bg-black" />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
          >
            Cancelar
          </button>
          {!error && (
            <button
              type="button"
              onClick={capturar}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primario)] px-3 py-1.5 text-sm font-medium text-[var(--color-primario-texto)] hover:brightness-90"
            >
              <Camera size={16} />
              Capturar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
