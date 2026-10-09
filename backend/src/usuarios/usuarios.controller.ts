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
import { NoSoloLecturaGuard } from '../common/guards/no-solo-lectura.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CheckPermissions } from '../common/decorators/permissions.decorator';
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { AsignarRolesDto } from './dto/asignar-roles.dto';
import { AsignarSucursalDto } from './dto/asignar-sucursal.dto';
import { CambiarActivoDto } from './dto/cambiar-activo.dto';
import { UpdateUsuarioAdminDto } from './dto/update-usuario-admin.dto';

@ApiTags('usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @CheckPermissions('usuarios.leer')
  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.usuariosService.findAll(user.empresaId);
  }

  // Sin @CheckPermissions: cualquier usuario autenticado puede ver/editar su propio perfil.
  @Get('me')
  findSelf(@CurrentUser() user: RequestUser) {
    return this.usuariosService.findOne(user.empresaId, user.id);
  }

  @UseGuards(NoSoloLecturaGuard)
  @Patch('me')
  updateSelf(@CurrentUser() user: RequestUser, @Body() dto: UpdatePerfilDto) {
    return this.usuariosService.updateSelf(user.id, dto);
  }

  @UseGuards(NoSoloLecturaGuard)
  @Patch('me/password')
  cambiarPassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.usuariosService.cambiarPassword(user.id, dto);
  }

  @CheckPermissions('usuarios.leer')
  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.usuariosService.findOne(user.empresaId, id);
  }

  @CheckPermissions('usuarios.leer')
  @Get(':id/perfil')
  perfilCompleto(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.usuariosService.perfilCompleto(
      user.empresaId,
      id,
      user.permisos,
    );
  }

  @CheckPermissions('usuarios.crear')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(user.empresaId, user.id, dto);
  }

  @CheckPermissions('usuarios.actualizar')
  @Patch(':id')
  updateAdmin(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioAdminDto,
  ) {
    return this.usuariosService.updateAdmin(user.empresaId, user.id, id, dto);
  }

  @CheckPermissions('usuarios.actualizar')
  @Patch(':id/roles')
  asignarRoles(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AsignarRolesDto,
  ) {
    return this.usuariosService.asignarRoles(user.empresaId, user.id, id, dto);
  }

  @CheckPermissions('usuarios.actualizar')
  @Patch(':id/sucursal')
  asignarSucursal(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: AsignarSucursalDto,
  ) {
    return this.usuariosService.asignarSucursal(
      user.empresaId,
      user.id,
      id,
      dto.sucursalId ?? null,
    );
  }

  @CheckPermissions('usuarios.actualizar')
  @Patch(':id/activo')
  cambiarActivo(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CambiarActivoDto,
  ) {
    return this.usuariosService.cambiarActivo(
      user.empresaId,
      user.id,
      id,
      dto.activo,
    );
  }

  @CheckPermissions('usuarios.actualizar')
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.usuariosService.remove(user.empresaId, user.id, id);
  }
}
