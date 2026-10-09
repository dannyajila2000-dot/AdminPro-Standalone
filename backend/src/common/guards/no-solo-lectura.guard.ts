import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestUser } from '../decorators/current-user.decorator';

/** Permisos que solo consultan: `*.leer` y el de ver los clientes de todas las sucursales. */
const esDeConsulta = (p: string) => p.endsWith('.leer') || p === 'clientes.ver-todas-sucursales';

/** Una cuenta es "de solo lectura" cuando todos sus permisos son de consulta. */
export function esSoloLectura(permisos: readonly string[] | undefined): boolean {
  return !!permisos?.length && permisos.every(esDeConsulta);
}

/**
 * Cierra las rutas "de uso propio" (cambiar la propia clave o el perfil, subir archivos, marcar asistencia) a las
 * cuentas de solo lectura. Esas rutas no piden ningún permiso, así que sin esto una cuenta de demostración o de
 * consulta podría cambiar su clave, llenar el almacenamiento de archivos o registrar asistencia.
 * Se usa después de JwtAuthGuard.
 */
@Injectable()
export class NoSoloLecturaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: RequestUser | undefined = context.switchToHttp().getRequest().user;
    if (user && esSoloLectura(user.permisos)) {
      throw new ForbiddenException('Esta cuenta es de solo lectura y no puede hacer esta acción');
    }
    return true;
  }
}

/**
 * Permiso "marcador": quien lo tiene no puede cambiar su propia clave ni editar su perfil, aunque pueda escribir en
 * el resto del sistema (pensado para cuentas de demostración). No da acceso a nada; solo restringe. Se ignora si la
 * cuenta puede administrar usuarios, para que un Admin nunca quede sin poder cambiar su clave.
 */
export const PERMISO_SIN_CAMBIO_DE_CLAVE = 'restricciones.sin-cambio-de-clave';

export function puedeCambiarSuClave(permisos: readonly string[] | undefined): boolean {
  if (esSoloLectura(permisos)) return false;
  const bloqueada = !!permisos?.includes(PERMISO_SIN_CAMBIO_DE_CLAVE) && !permisos.includes('usuarios.actualizar');
  return !bloqueada;
}

/** Para las rutas de cambiar la propia clave y el propio perfil. Se usa después de JwtAuthGuard. */
@Injectable()
export class PuedeCambiarSuClaveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: RequestUser | undefined = context.switchToHttp().getRequest().user;
    if (user && !puedeCambiarSuClave(user.permisos)) {
      throw new ForbiddenException('Esta cuenta no puede cambiar su clave ni su perfil');
    }
    return true;
  }
}
