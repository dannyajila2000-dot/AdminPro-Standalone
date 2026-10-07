import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface ContextoIntegracion {
  empresaId: string;
  codigoGimnasio: string;
}

export const hashDeClave = (clave: string) => createHash('sha256').update(clave).digest('hex');

/**
 * Protege las rutas que consume la app del socio (servidor a servidor). La clave llega en la cabecera
 * `x-api-key`; en la base solo existe su hash, así que ni con acceso a la tabla se puede reconstruir.
 * Deja en `request.integracion` la empresa a la que pertenece esa clave.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest();
    const clave = peticion.headers['x-api-key'];
    if (typeof clave !== 'string' || clave.length < 20) {
      throw new UnauthorizedException('Clave de integración inválida');
    }

    const integracion = await this.prisma.integracionApp.findUnique({
      where: { apiKeyHash: hashDeClave(clave) },
    });
    if (!integracion || !integracion.activa) {
      throw new UnauthorizedException('Clave de integración inválida');
    }

    peticion.integracion = {
      empresaId: integracion.empresaId,
      codigoGimnasio: integracion.codigoGimnasio,
    } satisfies ContextoIntegracion;
    return true;
  }
}
