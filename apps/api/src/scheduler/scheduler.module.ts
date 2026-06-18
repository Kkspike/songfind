import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { NasScannerModule } from '../nas-scanner/nas-scanner.module';
import { AzuracastModule } from '../azuracast/azuracast.module';
import { AcquisitionModule } from '../acquisition/acquisition.module';

@Module({
  imports: [ScheduleModule.forRoot(), NasScannerModule, AzuracastModule, AcquisitionModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
