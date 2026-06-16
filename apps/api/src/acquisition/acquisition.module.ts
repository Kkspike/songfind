import { Module } from '@nestjs/common';
import { AcquisitionController } from './acquisition.controller';
import { AcquisitionService } from './acquisition.service';
import { MatchingModule } from '../matching/matching.module';
import { NasScannerModule } from '../nas-scanner/nas-scanner.module';
import { YoutubeFallbackModule } from '../youtube-fallback/youtube-fallback.module';

@Module({
  imports: [MatchingModule, NasScannerModule, YoutubeFallbackModule],
  controllers: [AcquisitionController],
  providers: [AcquisitionService],
})
export class AcquisitionModule {}
