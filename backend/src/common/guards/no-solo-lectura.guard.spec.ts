import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { esSoloLectura, NoSoloLecturaGuard } from './no-solo-lectura.guard';

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
