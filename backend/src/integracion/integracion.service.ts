import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { MembresiasService } from '../membresias/membresias.service';
import { PrismaService } from '../prisma/prisma.service';

/** Tras estos intentos fallidos el código se anula y hay que invitar de nuevo al socio. */
export const MAX_INTENTOS_CODIGO = 5;
export const VIGENCIA_CODIGO_DIAS = 7;

const MENSAJE_CODIGO_INVALIDO = 'El código no es válido o ya venció. Pide al gimnasio que te invite de nuevo.';

/** El código se guarda con el id del socio como sal, para que dos socios con el mismo código tengan hashes distintos. */
export function hashDeCodigo(clienteId: string, codigo: string) {
  return createHash('sha256').update(`${clienteId}:${codigo}`).digest('hex');
}

export function generarCodigo() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function iguales(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

@Injectable()
export class IntegracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membresias: MembresiasService,
  ) {}

  sucursales(empresaId: string) {
    return this.prisma.sucursal.findMany({
      where: { empresaId, activa: true },
      select: { id: true, nombre: true, direccion: true },
      orderBy: { nombre: 'asc' },
    });
  }

  /** Los datos del socio que la app necesita: quién es, a qué sucursal va y cómo está su membresía. */
  private async fichaDeSocio(empresaId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        email: true,
        telefono: true,
        activo: true,
        sucursal: { select: { id: true, nombre: true, direccion: true, telefono: true } },
      },
    });
    if (!cliente) throw new NotFoundException('Socio no encontrado');

    return {
      clienteId: cliente.id,
      nombres: cliente.nombres,
      apellidos: cliente.apellidos,
      email: cliente.email,
      telefono: cliente.telefono,
      activo: cliente.activo,
      sucursal: cliente.sucursal,
      membresia: await this.membresias.resumenDeSocio(empresaId, cliente.id),
    };
  }

  estadoDeSocio(empresaId: string, clienteId: string) {
    return this.fichaDeSocio(empresaId, clienteId);
  }

  /**
   * Comprueba el correo y el código de activación y devuelve la ficha del socio, SIN consumir el código:
   * se consume en `confirmarActivacion`, cuando la app ya creó la cuenta. Así, si la app falla a medias,
   * el socio puede volver a intentarlo con el mismo código.
   */
  async validarActivacion(empresaId: string, email: string, codigo: string) {
    const candidatos = await this.prisma.cliente.findMany({
      where: {
        empresaId,
        activo: true,
        email: { equals: email.trim(), mode: 'insensitive' },
        appCodigoHash: { not: null },
      },
    });
    // Si varios socios compartieran correo, solo cuentan los que tienen una invitación pendiente.
    if (candidatos.length !== 1) throw new BadRequestException(MENSAJE_CODIGO_INVALIDO);
    const cliente = candidatos[0];

    if (!cliente.appCodigoExpiraEn || cliente.appCodigoExpiraEn < new Date()) {
      throw new BadRequestException(MENSAJE_CODIGO_INVALIDO);
    }

    if (!iguales(cliente.appCodigoHash!, hashDeCodigo(cliente.id, codigo.trim()))) {
      const intentos = cliente.appIntentosFallidos + 1;
      await this.prisma.cliente.update({
        where: { id: cliente.id },
        data:
          intentos >= MAX_INTENTOS_CODIGO
            ? { appIntentosFallidos: 0, appCodigoHash: null, appCodigoExpiraEn: null }
            : { appIntentosFallidos: intentos },
      });
      throw new BadRequestException(MENSAJE_CODIGO_INVALIDO);
    }

    return this.fichaDeSocio(empresaId, cliente.id);
  }

  /**
   * Guarda una medición (peso y estatura) que el socio registró en la app. Queda en su ficha como cualquier otra,
   * a nombre del usuario más antiguo del gimnasio (la medición exige un usuario) y con una nota que dice de dónde
   * viene. `origenId` es el id del registro en la app: si la app reintenta, no se duplica.
   */
  async registrarMedicion(
    empresaId: string,
    clienteId: string,
    dto: { origenId: string; fecha: string; peso: number; talla: number },
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId, appActivadoEn: { not: null } },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Socio no encontrado');

    const existente = await this.prisma.medicionCorporal.findUnique({ where: { origenApp: dto.origenId } });
    if (existente) return { ok: true, duplicada: true };

    const usuario = await this.prisma.usuario.findFirst({
      where: { empresaId, activo: true },
      orderBy: { creadoEn: 'asc' },
      select: { id: true },
    });
    if (!usuario) throw new BadRequestException('El gimnasio no tiene usuarios activos');

    await this.prisma.medicionCorporal.create({
      data: {
        empresaId,
        clienteId,
        fecha: new Date(dto.fecha),
        peso: dto.peso,
        talla: dto.talla,
        notas: 'Registrada por el socio desde la app',
        usuarioId: usuario.id,
        origenApp: dto.origenId,
      },
    });
    return { ok: true, duplicada: false };
  }

  /**
   * Vuelve a exigir el código (ya validado en `validarActivacion`) antes de activar: si solo pidiera el
   * clienteId, cualquiera con la x-api-key podría activar a un socio arbitrario sin conocer su código,
   * saltándose por completo la protección de intentos/expiración.
   */
  async confirmarActivacion(empresaId: string, clienteId: string, codigo: string) {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
    if (!cliente) throw new NotFoundException('Socio no encontrado');

    if (
      !cliente.appCodigoHash ||
      !cliente.appCodigoExpiraEn ||
      cliente.appCodigoExpiraEn < new Date() ||
      !iguales(cliente.appCodigoHash, hashDeCodigo(cliente.id, codigo.trim()))
    ) {
      throw new BadRequestException(MENSAJE_CODIGO_INVALIDO);
    }

    const resultado = await this.prisma.cliente.updateMany({
      where: { id: clienteId, empresaId },
      data: { appActivadoEn: new Date(), appCodigoHash: null, appCodigoExpiraEn: null, appIntentosFallidos: 0 },
    });
    if (!resultado.count) throw new NotFoundException('Socio no encontrado');
    return { ok: true };
  }
}
