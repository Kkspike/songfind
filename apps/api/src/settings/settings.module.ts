import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [SchedulerModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
