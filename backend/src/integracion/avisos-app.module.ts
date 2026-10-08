import { Global, Module } from '@nestjs/common';
import { AvisosAppService } from './avisos-app.service';

/** Global para que clientes, membresías y sucursales puedan avisar a la app sin importar el módulo de integración. */
@Global()
@Module({ providers: [AvisosAppService], exports: [AvisosAppService] })
export class AvisosAppModule {}
