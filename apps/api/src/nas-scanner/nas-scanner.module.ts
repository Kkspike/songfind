import { Module } from '@nestjs/common';
import { NasScannerController } from './nas-scanner.controller';
import { NasScannerService } from './nas-scanner.service';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [MatchingModule],
  controllers: [NasScannerController],
  providers: [NasScannerService],
  exports: [NasScannerService],
})
export class NasScannerModule {}
