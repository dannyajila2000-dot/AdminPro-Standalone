import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { EmpresasModule } from './empresas/empresas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { RolesPermisosModule } from './roles-permisos/roles-permisos.module';
import { ClientesModule } from './clientes/clientes.module';
import { IntegracionModule } from './integracion/integracion.module';
import { UploadsModule } from './uploads/uploads.module';
import { RecursosModule } from './recursos/recursos.module';
import { TiposCitaModule } from './tipos-cita/tipos-cita.module';
import { CitasModule } from './citas/citas.module';
import { ActivosModule } from './activos/activos.module';
import { ProductosModule } from './productos/productos.module';
import { AsistenciaModule } from './asistencia/asistencia.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { VentasModule } from './ventas/ventas.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { SucursalesModule } from './sucursales/sucursales.module';
import { NominaModule } from './nomina/nomina.module';
import { MembresiasModule } from './membresias/membresias.module';
import { MedicionesModule } from './mediciones/mediciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    NotificacionesModule,
    AuthModule,
    EmpresasModule,
    UsuariosModule,
    RolesPermisosModule,
    ClientesModule,
    IntegracionModule,
    UploadsModule,
    RecursosModule,
    TiposCitaModule,
    CitasModule,
    ActivosModule,
    ProductosModule,
    AsistenciaModule,
    CuentasModule,
    VentasModule,
    DashboardModule,
    ProveedoresModule,
    SucursalesModule,
    NominaModule,
    MembresiasModule,
    MedicionesModule,
  ],
})
export class AppModule {}
