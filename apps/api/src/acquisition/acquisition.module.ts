import { Module } from '@nestjs/common';
import { AcquisitionController } from './acquisition.controller';
import { AcquisitionService } from './acquisition.service';
import { MatchingModule } from '../matching/matching.module';
import { NasScannerModule } from '../nas-scanner/nas-scanner.module';
import { YoutubeFallbackModule } from '../youtube-fallback/youtube-fallback.module';
import { LidarrModule } from '../lidarr/lidarr.module';

@Module({
  imports: [MatchingModule, NasScannerModule, YoutubeFallbackModule, LidarrModule],
  controllers: [AcquisitionController],
  providers: [AcquisitionService],
  exports: [AcquisitionService],
})
export class AcquisitionModule {}
