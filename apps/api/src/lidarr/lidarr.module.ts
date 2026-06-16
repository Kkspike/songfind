import { Module } from '@nestjs/common';
import { LidarrController } from './lidarr.controller';
import { LidarrService } from './lidarr.service';
import { LidarrAcquisitionService } from './lidarr-acquisition.service';

@Module({
  controllers: [LidarrController],
  providers: [LidarrService, LidarrAcquisitionService],
  exports: [LidarrService, LidarrAcquisitionService],
})
export class LidarrModule {}
