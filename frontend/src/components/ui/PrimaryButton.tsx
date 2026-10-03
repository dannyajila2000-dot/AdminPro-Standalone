import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

const BASE_CLASS =
  'rounded-lg bg-[var(--color-primario)] px-4 py-2 text-sm font-medium text-[var(--color-primario-texto)] shadow-sm transition hover:brightness-90 active:brightness-95 disabled:opacity-50 disabled:hover:brightness-100'

export function PrimaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`${BASE_CLASS} ${className}`} />
}

export function PrimaryLinkButton({
  className = '',
  ...props
}: LinkProps) {
  return <Link {...props} className={`${BASE_CLASS} ${className}`} />
}
