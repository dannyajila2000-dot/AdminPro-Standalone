import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Avisa a la app del socio (gymProApp) de que algo cambió en AdminPro, para que lo vuelva a consultar de inmediato
 * en vez de esperar su próxima consulta periódica. El aviso solo lleva el id del socio (la app pide el detalle),
 * nunca falla la operación que lo origina y no hace nada si no está configurado (GYMPRO_URL y GYMPRO_AVISO_CLAVE).
 */
@Injectable()
export class AvisosAppService {
  private readonly logger = new Logger(AvisosAppService.name);

  constructor(private readonly prisma: PrismaService) {}

  private configurado() {
    return !!process.env.GYMPRO_URL && !!process.env.GYMPRO_AVISO_CLAVE;
  }

  /** Avisa por un socio, solo si ya activó su cuenta en la app. */
  async avisarSocio(clienteId: string): Promise<void> {
    if (!this.configurado()) return;
    try {
      const socio = await this.prisma.cliente.findFirst({
        where: { id: clienteId, appActivadoEn: { not: null } },
        select: { id: true },
      });
      if (socio) await this.enviar(socio.id);
    } catch (e) {
      this.logger.warn(`No se pudo avisar a la app (socio ${clienteId}): ${(e as Error).message}`);
    }
  }

  /** Avisa por todos los socios activados de una sucursal (por ejemplo, si cambia su nombre o dirección). */
  async avisarSucursal(sucursalId: string): Promise<void> {
    if (!this.configurado()) return;
    try {
      const socios = await this.prisma.cliente.findMany({
        where: { sucursalId, appActivadoEn: { not: null } },
        select: { id: true },
      });
      await Promise.allSettled(socios.map((s) => this.enviar(s.id)));
    } catch (e) {
      this.logger.warn(`No se pudo avisar a la app (sucursal ${sucursalId}): ${(e as Error).message}`);
    }
  }

  private async enviar(clienteId: string) {
    const respuesta = await fetch(`${process.env.GYMPRO_URL!.replace(/\/$/, '')}/integracion/aviso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-aviso-clave': process.env.GYMPRO_AVISO_CLAVE! },
      body: JSON.stringify({ clienteId }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!respuesta.ok) throw new Error(`la app respondió ${respuesta.status}`);
  }
}
