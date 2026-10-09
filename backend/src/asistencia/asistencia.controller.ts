import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NoSoloLecturaGuard } from '../common/guards/no-solo-lectura.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CheckPermissions } from '../common/decorators/permissions.decorator';
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator';
import { AsistenciaService } from './asistencia.service';
import { MarcarAsistenciaDto } from './dto/marcar-asistencia.dto';

@ApiTags('asistencia')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('asistencia')
export class AsistenciaController {
  constructor(private readonly asistenciaService: AsistenciaService) {}

  // Sin @CheckPermissions: cualquier colaborador puede marcar y ver su propia asistencia.
  @Get('estado')
  estado(@CurrentUser() user: RequestUser) {
    return this.asistenciaService.estadoActual(user.empresaId, user.id);
  }

  @UseGuards(NoSoloLecturaGuard)
  @Post('marcar')
  marcar(@CurrentUser() user: RequestUser, @Body() dto: MarcarAsistenciaDto) {
    return this.asistenciaService.marcar(user.empresaId, user.id, dto);
  }

  @Get('mias')
  mias(
    @CurrentUser() user: RequestUser,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.asistenciaService.misMarcaciones(user.empresaId, user.id, desde, hasta);
  }

  @CheckPermissions('asistencia.leer')
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('usuarioId') usuarioId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.asistenciaService.findAll(user.empresaId, usuarioId, desde, hasta);
  }
}
