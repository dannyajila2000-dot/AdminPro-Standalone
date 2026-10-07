import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CheckPermissions } from '../common/decorators/permissions.decorator';
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @CheckPermissions('clientes.leer')
  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.clientesService.findAll(user.empresaId, user.permisos, user.sucursalId);
  }

  @CheckPermissions('clientes.leer')
  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.clientesService.findOne(user.empresaId, id, user.permisos, user.sucursalId);
  }

  @CheckPermissions('clientes.leer')
  @Get(':id/perfil')
  findPerfil(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.clientesService.findPerfil(user.empresaId, id, user.permisos, user.sucursalId);
  }

  @CheckPermissions('clientes.crear')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateClienteDto) {
    return this.clientesService.create(
      user.empresaId,
      user.id,
      dto,
      user.permisos,
      user.sucursalId,
    );
  }

  @CheckPermissions('clientes.actualizar')
  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.clientesService.update(
      user.empresaId,
      user.id,
      id,
      dto,
      user.permisos,
      user.sucursalId,
    );
  }

  @CheckPermissions('clientes.leer')
  @Get(':id/app')
  estadoApp(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.clientesService.estadoApp(user.empresaId, id, user.permisos, user.sucursalId);
  }

  @CheckPermissions('clientes.actualizar')
  @Post(':id/invitar-app')
  invitarApp(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.clientesService.invitarApp(user.empresaId, id, user.permisos, user.sucursalId);
  }

  @CheckPermissions('clientes.eliminar')
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.clientesService.remove(user.empresaId, id, user.permisos, user.sucursalId);
  }
}
