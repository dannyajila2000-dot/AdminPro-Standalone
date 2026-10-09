import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import {
  esSoloLectura,
  NoSoloLecturaGuard,
  PERMISO_SIN_CAMBIO_DE_CLAVE,
  puedeCambiarSuClave,
  PuedeCambiarSuClaveGuard,
} from './no-solo-lectura.guard';

const contexto = (permisos: string[] | undefined, conUsuario = true) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: conUsuario ? { permisos } : undefined }) }),
  }) as unknown as ExecutionContext;

describe('cuentas de solo lectura', () => {
  it('solo lectura = todos los permisos son de consulta', () => {
    expect(esSoloLectura(['clientes.leer', 'citas.leer'])).toBe(true);
    expect(esSoloLectura(['clientes.leer', 'clientes.actualizar'])).toBe(false);
    expect(esSoloLectura(['clientes.leer', 'clientes.ver-todas-sucursales'])).toBe(true);
    expect(esSoloLectura([])).toBe(false);
    expect(esSoloLectura(undefined)).toBe(false);
  });

  it('bloquea a una cuenta de solo lectura', () => {
    expect(() => new NoSoloLecturaGuard().canActivate(contexto(['clientes.leer']))).toThrow(ForbiddenException);
  });

  it('deja pasar a quien puede escribir', () => {
    expect(new NoSoloLecturaGuard().canActivate(contexto(['clientes.leer', 'clientes.crear']))).toBe(true);
  });
});

describe('cambiar la propia clave', () => {
  it('una cuenta con el marcador no puede, aunque escriba en el resto del sistema', () => {
    expect(puedeCambiarSuClave(['clientes.leer', 'clientes.crear', PERMISO_SIN_CAMBIO_DE_CLAVE])).toBe(false);
    expect(() =>
      new PuedeCambiarSuClaveGuard().canActivate(contexto(['clientes.crear', PERMISO_SIN_CAMBIO_DE_CLAVE])),
    ).toThrow(ForbiddenException);
  });

  it('una cuenta de solo lectura tampoco', () => {
    expect(puedeCambiarSuClave(['clientes.leer'])).toBe(false);
  });

  it('el resto sí, y un Admin con el marcador (por error) no queda bloqueado', () => {
    expect(puedeCambiarSuClave(['clientes.crear'])).toBe(true);
    expect(puedeCambiarSuClave(['usuarios.actualizar', PERMISO_SIN_CAMBIO_DE_CLAVE])).toBe(true);
  });
});
