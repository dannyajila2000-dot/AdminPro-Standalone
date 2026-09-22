import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return empresa;
  }

  /** Cada despliegue sirve a una sola empresa: usada por la pantalla de login (sin autenticación) para mostrar su marca. */
  async findBrandingPublico() {
    const generico = { nombre: 'GymPro', logoUrl: null, colorPrimario: null };
    const empresa = await this.prisma.empresa.findFirst({
      orderBy: { creadoEn: 'asc' },
      select: { nombre: true, logoUrl: true, colorPrimario: true },
    });
    return empresa ?? generico;
  }

  async update(id: string, actorId: string, dto: UpdateEmpresaDto) {
    await this.findOne(id);

    let empresa;
    try {
      empresa = await this.prisma.empresa.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ese identificador de enlace ya está en uso');
      }
      throw error;
    }

    return empresa;
  }
}
