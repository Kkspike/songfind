import { Module } from '@nestjs/common';
import { AzuracastController } from './azuracast.controller';
import { AzuracastService } from './azuracast.service';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [MatchingModule],
  controllers: [AzuracastController],
  providers: [AzuracastService],
  exports: [AzuracastService],
})
export class AzuracastModule {}
