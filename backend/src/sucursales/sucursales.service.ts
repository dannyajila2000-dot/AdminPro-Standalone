import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AvisosAppService } from '../integracion/avisos-app.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';

const INCLUDE_SUCURSAL = {
  encargado: { select: { id: true, nombre: true } },
  _count: { select: { usuarios: true, recursos: true, activos: true, clientes: true } },
} as const;

@Injectable()
export class SucursalesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly avisos?: AvisosAppService,
  ) {}

  findAll(empresaId: string, incluirInactivas = false) {
    return this.prisma.sucursal.findMany({
      where: { empresaId, ...(incluirInactivas ? {} : { activa: true }) },
      include: INCLUDE_SUCURSAL,
      orderBy: { nombre: 'asc' },
    });
  }

  private async validarEncargado(empresaId: string, encargadoId?: string) {
    if (!encargadoId) return;
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: encargadoId, empresaId },
    });
    if (!usuario) {
      throw new BadRequestException('El encargado seleccionado no pertenece a tu empresa');
    }
  }

  /** Nombre único por empresa, sin importar mayúsculas ni espacios de más — evita crear
   * "Sucursal Norte" dos veces por distraído. `ignorarId` se usa al editar, para no chocar
   * contra el propio registro que se está guardando. */
  private async validarNombreUnico(empresaId: string, nombre: string, ignorarId?: string) {
    const duplicada = await this.prisma.sucursal.findFirst({
      where: {
        empresaId,
        id: ignorarId ? { not: ignorarId } : undefined,
        nombre: { equals: nombre.trim(), mode: 'insensitive' },
      },
    });
    if (duplicada) {
      throw new ConflictException(`Ya existe una sucursal llamada "${nombre.trim()}"`);
    }
  }

  async create(empresaId: string, dto: CreateSucursalDto) {
    await this.validarEncargado(empresaId, dto.encargadoId);
    await this.validarNombreUnico(empresaId, dto.nombre);

    return this.prisma.sucursal.create({
      data: { empresaId, ...dto, nombre: dto.nombre.trim(), encargadoId: dto.encargadoId || undefined },
      include: INCLUDE_SUCURSAL,
    });
  }

  async update(empresaId: string, id: string, dto: UpdateSucursalDto) {
    const existente = await this.prisma.sucursal.findFirst({
      where: { id, empresaId },
    });
    if (!existente) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    await this.validarEncargado(empresaId, dto.encargadoId);
    if (dto.nombre) {
      await this.validarNombreUnico(empresaId, dto.nombre, id);
    }

    const actualizada = await this.prisma.sucursal.update({
      where: { id },
      data: {
        ...dto,
        nombre: dto.nombre?.trim(),
        encargadoId: dto.encargadoId === '' ? null : dto.encargadoId,
      },
      include: INCLUDE_SUCURSAL,
    });
    void this.avisos?.avisarSucursal(id);
    return actualizada;
  }

  async findPerfilSucursal(empresaId: string, id: string) {
    const sucursal = await this.prisma.sucursal.findFirst({
      where: { id, empresaId },
      include: INCLUDE_SUCURSAL,
    });
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const [usuarios, recursos, activos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { empresaId, sucursalId: id },
        select: { id: true, nombre: true, email: true, cargo: true, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.recurso.findMany({
        where: { empresaId, sucursalId: id },
        select: { id: true, nombre: true, tipo: true, activo: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.activo.findMany({
        where: { empresaId, sucursalId: id },
        select: { id: true, nombre: true, estado: true, categoriaActivo: { select: { nombre: true } } },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    return { sucursal, usuarios, recursos, activos };
  }

  async remove(empresaId: string, id: string) {
    const sucursal = await this.prisma.sucursal.findFirst({
      where: { id, empresaId },
      include: INCLUDE_SUCURSAL,
    });
    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    // Solo se puede eliminar una sucursal que nunca se usó — si tiene empleados, recursos,
    // activos o clientes asignados, la vía correcta es desactivarla, no perder esa asociación.
    // Nota: a diferencia de usuarios/recursos/activos (que se desvinculan solos al eliminar la
    // sucursal), un cliente SIEMPRE debe pertenecer a una sucursal, así que este chequeo es
    // obligatorio: sin él, Postgres rechaza el DELETE con un error crudo de FK.
    if (
      sucursal._count.usuarios > 0 ||
      sucursal._count.recursos > 0 ||
      sucursal._count.activos > 0 ||
      sucursal._count.clientes > 0
    ) {
      throw new ConflictException(
        'Esta sucursal tiene empleados, recursos, activos o clientes asignados y no se puede eliminar. Desactívala en su lugar.',
      );
    }

    await this.prisma.sucursal.delete({ where: { id } });
  }
}
