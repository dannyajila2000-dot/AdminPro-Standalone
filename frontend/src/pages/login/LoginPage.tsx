import { useLogin } from '@refinedev/core'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { usePublicBranding } from '../../hooks/usePublicBranding'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import { PasswordInput } from '../../components/ui/PasswordInput'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const branding = usePublicBranding()
  const { mutate: login, isPending, data } = useLogin<LoginValues>()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={handleSubmit((values) => login(values))}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 shadow-[var(--sombra-lg)]"
      >
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.nombre} className="h-10" />
        ) : (
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            {branding?.nombre ?? 'GymPro'}
          </h1>
        )}
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Inicia sesión para continuar</p>

        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Email
            </label>
            <input
              type="email"
              {...register('email')}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primario)] focus:outline-none"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">
              Contraseña
            </label>
            <PasswordInput {...register('password')} />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
            <Link
              to="/forgot-password"
              className="mt-1 inline-block text-xs text-[var(--color-text-muted)] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {data?.success === false && (
            <p className="text-sm text-red-600">{data.error?.message}</p>
          )}

          <PrimaryButton type="submit" disabled={isPending} className="mt-2">
            {isPending ? 'Ingresando…' : 'Ingresar'}
          </PrimaryButton>
        </div>
      </form>
    </div>
  )
}
