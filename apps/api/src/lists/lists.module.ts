import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { ImportService } from './import.service';
import { ExportService } from './export.service';
import { TrackUpsertService } from './track-upsert.service';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [MulterModule.register(), MatchingModule],
  controllers: [ListsController],
  providers: [ListsService, ImportService, ExportService, TrackUpsertService],
  exports: [TrackUpsertService],
})
export class ListsModule {}
