import { Module } from '@nestjs/common';
import { MembresiasModule } from '../membresias/membresias.module';
import { ApiKeyGuard } from './api-key.guard';
import { IntegracionController } from './integracion.controller';
import { IntegracionService } from './integracion.service';

@Module({
  imports: [MembresiasModule],
  controllers: [IntegracionController],
  providers: [IntegracionService, ApiKeyGuard],
})
export class IntegracionModule {}
