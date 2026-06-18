import { Module } from '@nestjs/common';
import { LidarrController } from './lidarr.controller';
import { LidarrService } from './lidarr.service';
import { LidarrAcquisitionService } from './lidarr-acquisition.service';
import { AlbumLookupService } from './album-lookup.service';

@Module({
  controllers: [LidarrController],
  providers: [LidarrService, LidarrAcquisitionService, AlbumLookupService],
  exports: [LidarrService, LidarrAcquisitionService],
})
export class LidarrModule {}
