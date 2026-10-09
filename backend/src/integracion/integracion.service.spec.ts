import { BadRequestException } from '@nestjs/common';
import {
  generarCodigo,
  hashDeCodigo,
  IntegracionService,
  MAX_INTENTOS_CODIGO,
} from './integracion.service';

type Socio = {
  id: string;
  empresaId: string;
  activo: boolean;
  email: string;
  appCodigoHash: string | null;
  appCodigoExpiraEn: Date | null;
  appIntentosFallidos: number;
};

/** Base de datos mínima en memoria: lo justo para ejercitar la validación del código. */
function crear(socio: Socio) {
  const estado = { ...socio };
  const prisma = {
    cliente: {
      findMany: jest.fn(async () => (estado.appCodigoHash ? [{ ...estado }] : [])),
      findFirst: jest.fn(async () => ({
        id: estado.id, nombres: 'Ana', apellidos: 'Pérez', email: estado.email, telefono: null, activo: true, sucursal: null,
        appCodigoHash: estado.appCodigoHash, appCodigoExpiraEn: estado.appCodigoExpiraEn,
      })),
      update: jest.fn(async ({ data }: { data: Partial<Socio> }) => Object.assign(estado, data)),
      updateMany: jest.fn(async ({ data }: { data: Partial<Socio> }) => { Object.assign(estado, data); return { count: 1 }; }),
    },
  };
  const membresias = { resumenDeSocio: jest.fn(async () => ({ estado: 'activo', plan: 'Mensual', fechaVencimiento: null, diasRestantes: 20 })) };
  const servicio = new IntegracionService(prisma as never, membresias as never);
  return { servicio, estado };
}

const socioBase = (codigo: string | null, venceEnDias = 7): Socio => ({
  id: 'cli-1',
  empresaId: 'emp-1',
  activo: true,
  email: 'ana@example.com',
  appCodigoHash: codigo ? hashDeCodigo('cli-1', codigo) : null,
  appCodigoExpiraEn: new Date(Date.now() + venceEnDias * 86_400_000),
  appIntentosFallidos: 0,
});

describe('códigos de activación', () => {
  it('generarCodigo da siempre 6 dígitos (con ceros a la izquierda)', () => {
    for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
  });

  it('el hash depende del socio: el mismo código en dos socios no coincide', () => {
    expect(hashDeCodigo('a', '123456')).not.toBe(hashDeCodigo('b', '123456'));
    expect(hashDeCodigo('a', '123456')).toBe(hashDeCodigo('a', '123456'));
  });

  it('con el código correcto devuelve la ficha y NO lo consume todavía', async () => {
    const { servicio, estado } = crear(socioBase('123456'));
    const ficha = await servicio.validarActivacion('emp-1', 'ANA@example.com', '123456');
    expect(ficha.clienteId).toBe('cli-1');
    expect(ficha.membresia.estado).toBe('activo');
    expect(estado.appCodigoHash).not.toBeNull();
  });

  it('confirmarActivacion lo consume y marca al socio como activado', async () => {
    const { servicio, estado } = crear(socioBase('123456'));
    await servicio.confirmarActivacion('emp-1', 'cli-1', '123456');
    expect(estado.appCodigoHash).toBeNull();
    expect(estado).toHaveProperty('appActivadoEn');
  });

  it('confirmarActivacion rechaza sin el código correcto (no se puede activar solo con el clienteId)', async () => {
    const { servicio, estado } = crear(socioBase('123456'));
    await expect(servicio.confirmarActivacion('emp-1', 'cli-1', '000000')).rejects.toBeInstanceOf(BadRequestException);
    expect(estado.appCodigoHash).not.toBeNull();
    expect(estado).not.toHaveProperty('appActivadoEn');
  });

  it('con un código incorrecto cuenta el intento, y al llegar al máximo anula el código', async () => {
    const { servicio, estado } = crear(socioBase('123456'));
    for (let i = 1; i < MAX_INTENTOS_CODIGO; i++) {
      await expect(servicio.validarActivacion('emp-1', 'ana@example.com', '000000')).rejects.toBeInstanceOf(BadRequestException);
      expect(estado.appIntentosFallidos).toBe(i);
    }
    await expect(servicio.validarActivacion('emp-1', 'ana@example.com', '000000')).rejects.toBeInstanceOf(BadRequestException);
    expect(estado.appCodigoHash).toBeNull();
    // ya con el código bueno no sirve: hay que invitar de nuevo
    await expect(servicio.validarActivacion('emp-1', 'ana@example.com', '123456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un código vencido se rechaza aunque sea el correcto', async () => {
    const { servicio } = crear(socioBase('123456', -1));
    await expect(servicio.validarActivacion('emp-1', 'ana@example.com', '123456')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el mensaje de error no revela si el correo existe o si el código venció', async () => {
    const sinInvitar = crear(socioBase(null));
    const vencido = crear(socioBase('123456', -1));
    const a = await sinInvitar.servicio.validarActivacion('emp-1', 'x@example.com', '123456').catch((e) => e.message);
    const b = await vencido.servicio.validarActivacion('emp-1', 'ana@example.com', '123456').catch((e) => e.message);
    expect(a).toBe(b);
  });
});
