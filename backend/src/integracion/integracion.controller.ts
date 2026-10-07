import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { ApiKeyGuard, type ContextoIntegracion } from './api-key.guard';
import { IntegracionService } from './integracion.service';

class ActivarDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' })
  codigo!: string;
}

class ConfirmarDto {
  @IsString()
  clienteId!: string;
}

/**
 * Rutas para la app del socio (gymProApp), de servidor a servidor: se autentican con la cabecera
 * `x-api-key`, no con una sesión de usuario del panel. Son pocas a propósito.
 */
@ApiTags('integracion')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('integracion')
export class IntegracionController {
  constructor(private readonly integracion: IntegracionService) {}

  @Get('sucursales')
  sucursales(@Req() peticion: { integracion: ContextoIntegracion }) {
    return this.integracion.sucursales(peticion.integracion.empresaId);
  }

  /** Comprueba correo + código y devuelve la ficha del socio (sin consumir el código). */
  @Post('activar')
  @HttpCode(200)
  activar(@Req() peticion: { integracion: ContextoIntegracion }, @Body() dto: ActivarDto) {
    return this.integracion.validarActivacion(peticion.integracion.empresaId, dto.email, dto.codigo);
  }

  /** La app ya creó la cuenta: marca al socio como activado y anula el código. */
  @Post('activar/confirmar')
  @HttpCode(200)
  confirmar(@Req() peticion: { integracion: ContextoIntegracion }, @Body() dto: ConfirmarDto) {
    return this.integracion.confirmarActivacion(peticion.integracion.empresaId, dto.clienteId);
  }

  /** Estado actual del socio: se consulta al iniciar sesión para saber si su membresía sigue vigente. */
  @Get('socios/:clienteId/estado')
  estado(@Req() peticion: { integracion: ContextoIntegracion }, @Param('clienteId') clienteId: string) {
    return this.integracion.estadoDeSocio(peticion.integracion.empresaId, clienteId);
  }
}
