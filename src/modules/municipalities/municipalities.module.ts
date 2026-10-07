import { Module } from '@nestjs/common';
import { MunicipalitiesController } from './municipalities.controller';
import { MunicipalitiesService } from './municipalities.service';
import { MunicipalityResolutionService } from './municipality-resolution.service';

@Module({
  controllers: [MunicipalitiesController],
  providers: [MunicipalitiesService, MunicipalityResolutionService],
  exports: [MunicipalitiesService, MunicipalityResolutionService],
})
export class MunicipalitiesModule {}
