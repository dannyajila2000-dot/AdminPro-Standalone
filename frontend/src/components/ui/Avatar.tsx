interface Props {
  nombre?: string
  fotoUrl?: string | null
  size?: number
}

export function Avatar({ nombre, fotoUrl, size = 32 }: Props) {
  const iniciales = (nombre ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase())
    .join('')

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nombre ?? 'Foto de perfil'}
        style={{ width: size, height: size }}
        className="rounded-full object-cover ring-1 ring-[var(--color-border)]"
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-full bg-[var(--color-primario)] text-xs font-semibold text-[var(--color-primario-texto)] ring-1 ring-[var(--color-border)]"
    >
      {iniciales || '?'}
    </div>
  )
}
