/**
 * Si la cuenta puede cambiar su propia clave y editar su perfil. Es la misma regla que aplica el servidor
 * (`puedeCambiarSuClave`): no pueden las cuentas de solo lectura ni las que tienen el permiso marcador
 * `restricciones.sin-cambio-de-clave` (cuentas de demostración), salvo que administren usuarios.
 */
export function puedeCambiarSuClave(permisos: readonly string[] | undefined): boolean {
  const soloLectura =
    !!permisos?.length && permisos.every((p) => p.endsWith('.leer') || p === 'clientes.ver-todas-sucursales')
  if (soloLectura) return false
  const bloqueada = !!permisos?.includes('restricciones.sin-cambio-de-clave') && !permisos.includes('usuarios.actualizar')
  return !bloqueada
}
